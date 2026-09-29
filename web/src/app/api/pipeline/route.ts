import { NextResponse } from "next/server";
import { db, leads, audits, offers, messages } from "@/lib/db";
import { eq, or, notIlike, isNull } from "drizzle-orm";
import { auditWebsite } from "@/lib/auditor";
import { qualifyLead, LeadDecision } from "@/lib/qualifier";
import { generateOfferContent } from "@/lib/gemini";
import { renderOfferPage } from "@/lib/html-renderer";
import { deployToNetlify } from "@/lib/netlify";
import { composeEmail, sendEmailSafely } from "@/lib/outreach";
import slugify from "slugify";

export async function POST() {
  const report = {
    auditedCount: 0,
    emailsScrapedCount: 0,
    qualifiedCount: 0,
    needsReviewCount: 0,
    disqualifiedCount: 0,
    offersGeneratedCount: 0,
    emailsSentCount: 0,
    errors: [] as string[],
  };

  try {
    const allLeads = await db.query.leads.findMany({
      where: or(isNull(leads.city), notIlike(leads.city, "%wroc%")),
      with: { audit: true, offer: true, contacts: true, messages: true },
    });

    // 1. AUDIT & SCRAPE ("Co robi firma" + Deep Email Scraping)
    for (const lead of allLeads) {
      if (lead.website && !lead.audit) {
        try {
          const auditData = await auditWebsite(lead.website);
          const [createdAudit] = await db
            .insert(audits)
            .values({
              leadId: lead.id,
              ...auditData,
              auditedAt: new Date(),
            })
            .returning();
          lead.audit = createdAudit;
          report.auditedCount++;

          // Auto-save scraped email to lead if missing!
          if (!lead.emailPrimary && auditData.emailsScraped.length > 0) {
            await db
              .update(leads)
              .set({ emailPrimary: auditData.emailsScraped[0], updatedAt: new Date() })
              .where(eq(leads.id, lead.id));
            lead.emailPrimary = auditData.emailsScraped[0];
            report.emailsScrapedCount++;
          }
        } catch (e: any) {
          report.errors.push(`Audyt #${lead.id} błąd: ${e.message}`);
        }
      }
    }

    // 2. QUALIFY
    for (const lead of allLeads) {
      if (lead.status === "new") {
        try {
          const qRes = qualifyLead(lead, lead.audit);
          await db
            .update(leads)
            .set({
              score: qRes.totalScore,
              status: qRes.suggestedStatus,
              scoreBreakdown: qRes.breakdown,
              rejectionReason:
                qRes.decision === LeadDecision.AUTO_QUALIFIED
                  ? null
                  : qRes.rejectionReason || qRes.reviewReason,
              updatedAt: new Date(),
            })
            .where(eq(leads.id, lead.id));

          lead.status = qRes.suggestedStatus;

          if (qRes.decision === LeadDecision.AUTO_QUALIFIED) report.qualifiedCount++;
          else if (qRes.decision === LeadDecision.NEEDS_REVIEW) report.needsReviewCount++;
          else report.disqualifiedCount++;
        } catch (e: any) {
          report.errors.push(`Kwalifikacja #${lead.id} błąd: ${e.message}`);
        }
      }
    }

    // 3. GENERATE OFFER
    for (const lead of allLeads) {
      if (lead.status === "qualified" && !lead.offer) {
        try {
          const offerContent = await generateOfferContent(lead, lead.audit);
          const safeSlug = slugify(`${lead.companyName}-${lead.city || "legnica"}`.toLowerCase(), {
            strict: true,
            lower: true,
          }).slice(0, 70);

          const html = renderOfferPage(offerContent, lead, safeSlug);
          const deployRes = await deployToNetlify(html, safeSlug);

          const [createdOffer] = await db
            .insert(offers)
            .values({
              leadId: lead.id,
              slug: safeSlug,
              title: offerContent.heroHeadline,
              heroObservation: offerContent.heroObservation,
              observationsEvidence: offerContent.observations,
              proposedModules: offerContent.proposedModules,
              pricingRange: offerContent.pricingRange,
              processSteps: offerContent.processSteps,
              bookingUrl: deployRes.url,
              deployUrl: deployRes.url,
              netlifyDeployId: deployRes.deployId,
              status: "published",
              publishedAt: new Date(),
            })
            .returning();

          await db
            .update(leads)
            .set({ status: "offer_published", updatedAt: new Date() })
            .where(eq(leads.id, lead.id));

          lead.offer = createdOffer;
          lead.status = "offer_published";
          report.offersGeneratedCount++;
        } catch (e: any) {
          report.errors.push(`Oferta #${lead.id} błąd: ${e.message}`);
        }
      }
    }

    // 4. SEND EMAIL
    for (const lead of allLeads) {
      if (lead.status === "offer_published" && lead.offer) {
        const hasSent = lead.messages?.some(
          (m) => m.direction === "outbound" && m.channel === "email" && m.status === "sent"
        );
        if (!hasSent) {
          if (!lead.emailPrimary) {
            // Cannot dispatch outreach email without an address
            continue;
          }
          try {
            const contactName = lead.contacts?.[0]?.firstName || null;
            const draft = composeEmail(lead, lead.offer, contactName);
            const sendRes = await sendEmailSafely({
              leadId: lead.id,
              draft,
              leadNip: lead.nip,
              leadPhone: lead.phoneNormalized,
              ignoreWindow: true,
            });

            if (sendRes.success) {
              await db
                .update(leads)
                .set({ status: "sent", updatedAt: new Date() })
                .where(eq(leads.id, lead.id));
              report.emailsSentCount++;
            }
          } catch (e: any) {
            report.errors.push(`Outreach #${lead.id} błąd: ${e.message}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("Pipeline run failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
