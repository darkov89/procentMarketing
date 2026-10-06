import { NextResponse } from "next/server";
import { db, leads, audits, offers, evidence } from "@/lib/db";
import { eq, or, notIlike, isNull, inArray } from "drizzle-orm";
import { auditWebsite, AuditFetchError } from "@/lib/auditor";
import { qualifyLead, LeadDecision } from "@/lib/qualifier";
import { generateOfferContent } from "@/lib/gemini";
import { requireUser, requireTenant } from "@/lib/auth";
import { transitionLead, LeadStatus } from "@/lib/state-machine";
import crypto from "crypto";
import slugify from "slugify";

export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await req.json().catch(() => ({}));

    const report = {
      auditedCount: 0,
      auditFailedCount: 0,
      emailsScrapedCount: 0,
      qualifiedCount: 0,
      needsReviewCount: 0,
      disqualifiedCount: 0,
      offersGeneratedCount: 0,
      pendingApprovalCount: 0,
      emailsSentCount: 0,
      errors: [] as string[],
    };

    const allLeads = await db.query.leads.findMany({
      where: eq(leads.tenantId, tenantId),
      with: { audit: true, offer: true, contacts: true, messages: true },
    });

    // -------------------------------------------------------------------------
    // 1. AUDIT & SCRAPE ("Co robi firma" + Deep Email Scraping)
    // -------------------------------------------------------------------------
    for (const lead of allLeads) {
      if (lead.website && !lead.audit && lead.status !== "audit_failed") {
        try {
          const auditData = await auditWebsite(lead.website);
          const [createdAudit] = await db
            .insert(audits)
            .values({
              tenantId: lead.tenantId,
              leadId: lead.id,
              ...auditData,
              auditedAt: new Date(),
            })
            .returning();
          lead.audit = createdAudit;
          report.auditedCount++;

          // Auto-save scraped email to lead if verified on site
          if (!lead.emailPrimary && auditData.emailsScraped.length > 0) {
            await db
              .update(leads)
              .set({ emailPrimary: auditData.emailsScraped[0], updatedAt: new Date() })
              .where(eq(leads.id, lead.id));
            lead.emailPrimary = auditData.emailsScraped[0];
            report.emailsScrapedCount++;
          }
        } catch (e: any) {
          // INVARIANT 6: Set audit_failed if website cannot be fetched
          await transitionLead({
            leadId: lead.id,
            toStatus: "audit_failed",
            reason: e.message,
            actor: `user:${user.id}`,
            forceAdminOverride: true,
          });
          lead.status = "audit_failed";
          report.auditFailedCount++;
          report.errors.push(`Audyt #${lead.id} (${lead.companyName}): ${e.message}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. QUALIFY
    // -------------------------------------------------------------------------
    for (const lead of allLeads) {
      if (lead.status === "new" || lead.status === "enriching") {
        try {
          const qRes = qualifyLead(lead, lead.audit);
          const reason = qRes.decision === LeadDecision.AUTO_QUALIFIED
            ? null
            : qRes.rejectionReason || qRes.reviewReason;

          await db
            .update(leads)
            .set({
              score: qRes.totalScore,
              scoreBreakdown: qRes.breakdown,
              updatedAt: new Date(),
            })
            .where(eq(leads.id, lead.id));

          await transitionLead({
            leadId: lead.id,
            toStatus: qRes.suggestedStatus as LeadStatus,
            reason,
            actor: `user:${user.id}`,
            forceAdminOverride: true,
          });

          lead.status = qRes.suggestedStatus;

          if (qRes.decision === LeadDecision.AUTO_QUALIFIED) report.qualifiedCount++;
          else if (qRes.decision === LeadDecision.NEEDS_REVIEW) report.needsReviewCount++;
          else report.disqualifiedCount++;
        } catch (e: any) {
          report.errors.push(`Kwalifikacja #${lead.id}: ${e.message}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. GENERATE OFFER (Next.js /o/[token] with grounded evidence)
    // -------------------------------------------------------------------------
    for (const lead of allLeads) {
      if (lead.status === "qualified" && !lead.offer) {
        try {
          const offerContent = await generateOfferContent(lead, lead.audit);
          const safeSlug = slugify(`${lead.companyName}-${lead.city || "legnica"}`.toLowerCase(), {
            strict: true,
            lower: true,
          }).slice(0, 70);

          const secureToken = crypto.randomBytes(16).toString("hex"); // 32 hex chars
          const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
          const offerUrl = `/o/${secureToken}`;

          // Record evidence claims in database
          const evidenceIds: number[] = [];
          if (Array.isArray(offerContent.observations)) {
            for (const obs of offerContent.observations) {
              const [ev] = await db
                .insert(evidence)
                .values({
                  tenantId: lead.tenantId,
                  leadId: lead.id,
                  claimType: obs.evidenceKey || "audit_finding",
                  claimValue: `${obs.finding} (Wpływ: ${obs.impact})`,
                  source: "auditor_v2",
                  sourceUrl: lead.website || null,
                  snippet: obs.finding,
                  confidence: 1.0,
                  createdAt: new Date(),
                })
                .returning();
              evidenceIds.push(ev.id);
            }
          }

          const [createdOffer] = await db
            .insert(offers)
            .values({
              tenantId: lead.tenantId,
              leadId: lead.id,
              slug: safeSlug,
              token: secureToken,
              noindex: true,
              evidenceIds,
              title: offerContent.heroHeadline,
              heroObservation: offerContent.heroObservation,
              observationsEvidence: offerContent.observations,
              proposedModules: offerContent.proposedModules,
              pricingRange: offerContent.pricingRange,
              processSteps: offerContent.processSteps,
              bookingUrl: offerUrl,
              deployUrl: offerUrl,
              status: "published",
              expiresAt,
              publishedAt: new Date(),
            })
            .returning();

          await transitionLead({
            leadId: lead.id,
            toStatus: "offer_ready",
            reason: `Wygenerowano dedykowaną stronę oferty (${offerUrl})`,
            actor: `user:${user.id}`,
            forceAdminOverride: true,
          });

          lead.offer = createdOffer;
          lead.status = "offer_ready";
          report.offersGeneratedCount++;
        } catch (e: any) {
          report.errors.push(`Oferta #${lead.id}: ${e.message}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. PREPARE OUTREACH QUEUE (AI Act Art. 14 - Human Oversight)
    // Automated email dispatch is deliberately STOPPED per user request & AI Act.
    // Offers are queued in 'offer_ready' / 'pending_approval' for human 1-click batch sending.
    // -------------------------------------------------------------------------
    for (const lead of allLeads) {
      if ((lead.status === "offer_ready" || lead.status === "pending_approval") && lead.offer) {
        const hasSent = lead.messages?.some(
          (m) => m.direction === "outbound" && m.channel === "email" && m.status === "sent"
        );
        if (!hasSent) {
          report.pendingApprovalCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    if (err?.name === "AuthorizationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    console.error("Pipeline run failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
