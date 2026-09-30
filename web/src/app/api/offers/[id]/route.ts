import { NextResponse } from "next/server";
import { db, leads, offers, evidence } from "@/lib/db";
import { eq } from "drizzle-orm";
import slugify from "slugify";
import crypto from "crypto";
import { generateOfferContent, OfferContent } from "@/lib/gemini";
import { requireUser } from "@/lib/auth";
import { transitionLead } from "@/lib/state-machine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const leadId = parseInt(id, 10);
    const body = await req.json().catch(() => ({}));

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { audit: true, offer: true },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie znaleziony" }, { status: 404 });
    }

    // Either use manually provided offer content from UI editor or generate with Gemini AI
    let offerContent: OfferContent;
    if (body.title && body.heroObservation && body.proposedModules) {
      offerContent = {
        heroHeadline: body.title,
        heroObservation: body.heroObservation,
        observations: body.observations || [],
        proposedModules: body.proposedModules || [],
        pricingRange: body.pricingRange || "od 2 800 zł / mies.",
        processSteps: body.processSteps || [],
        ctaText: body.ctaText || "Umów bezpłatną konsultację",
      };
    } else {
      offerContent = await generateOfferContent(lead, lead.audit);
    }

    const safeSlug = slugify(`${lead.companyName}-${lead.city || "legnica"}`.toLowerCase(), {
      strict: true,
      lower: true,
    }).slice(0, 70);

    // Generate secure, non-predictable 32-character token (at least 22 chars)
    const secureToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    const offerUrl = `/o/${secureToken}`;

    // Record verified evidence items in the evidence table
    const recordedEvidenceIds: number[] = [];
    if (Array.isArray(offerContent.observations)) {
      for (const obs of offerContent.observations) {
        const [ev] = await db
          .insert(evidence)
          .values({
            leadId,
            claimType: obs.evidenceKey || "audit_finding",
            claimValue: `${obs.finding} (Wpływ: ${obs.impact})`,
            source: "auditor_v2",
            sourceUrl: lead.website || null,
            snippet: obs.finding,
            confidence: 1.0,
            createdAt: new Date(),
          })
          .returning();
        recordedEvidenceIds.push(ev.id);
      }
    }

    let savedOffer;
    if (lead.offer) {
      const [updated] = await db
        .update(offers)
        .set({
          title: offerContent.heroHeadline,
          heroObservation: offerContent.heroObservation,
          observationsEvidence: offerContent.observations,
          proposedModules: offerContent.proposedModules,
          pricingRange: offerContent.pricingRange,
          processSteps: offerContent.processSteps,
          bookingUrl: offerUrl,
          deployUrl: offerUrl,
          token: lead.offer.token || secureToken,
          noindex: true,
          evidenceIds: recordedEvidenceIds,
          status: "published",
          expiresAt: lead.offer.expiresAt || expiresAt,
          publishedAt: new Date(),
        })
        .where(eq(offers.id, lead.offer.id))
        .returning();
      savedOffer = updated;
    } else {
      const [created] = await db
        .insert(offers)
        .values({
          leadId,
          slug: safeSlug,
          token: secureToken,
          noindex: true,
          evidenceIds: recordedEvidenceIds,
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
      savedOffer = created;
    }

    // INVARIANT 3: Update lead status through transitionLead()
    await transitionLead({
      leadId,
      toStatus: "offer_ready",
      reason: `Wygenerowano dedykowaną stronę oferty (${offerUrl})`,
      actor: `user:${user.id}`,
      forceAdminOverride: true,
    });

    return NextResponse.json({
      success: true,
      offer: savedOffer,
      offerUrl,
      token: savedOffer.token,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Offer generation error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
