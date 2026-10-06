import { NextResponse } from "next/server";
import { db, leads, offers, evidence, appSettings, leadEvents } from "@/lib/db";
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

    // Load default sender profile from app_settings
    const senderSetting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "sender_profile"),
    });
    const defaultSender = (senderSetting?.value as any) || {
      senderName: "Dariusz",
      senderRole: "Założyciel & Strateg B2B",
      senderEmail: "kontakt@procentmarketing.pl",
      senderPhone: "+48 700 000 000",
      senderCompany: "Procent Marketing",
      senderWebsite: "https://procentmarketing.pl",
      bookingUrl: "https://cal.com/procentmarketing/15min",
      customNote: "W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu.",
    };

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

    const safeSlug = slugify(`${lead.companyName}-${lead.city || "polska"}`.toLowerCase(), {
      strict: true,
      lower: true,
    }).slice(0, 70);

    // Generate secure, non-predictable 32-character token (at least 22 chars)
    const secureToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    const offerUrl = `/o/${secureToken}`;

    // Sender details resolution (body override > defaultSender)
    const senderName = body.senderName !== undefined ? body.senderName : defaultSender.senderName;
    const senderRole = body.senderRole !== undefined ? body.senderRole : defaultSender.senderRole;
    const senderEmail = body.senderEmail !== undefined ? body.senderEmail : defaultSender.senderEmail;
    const senderPhone = body.senderPhone !== undefined ? body.senderPhone : defaultSender.senderPhone;
    const senderCompany = body.senderCompany !== undefined ? body.senderCompany : defaultSender.senderCompany;
    const senderWebsite = body.senderWebsite !== undefined ? body.senderWebsite : defaultSender.senderWebsite;
    const customNote = body.customNote !== undefined ? body.customNote : defaultSender.customNote;
    const ctaText = body.ctaText || "Umów bezpłatną konsultację";
    const customBookingUrl = body.bookingUrl || defaultSender.bookingUrl || offerUrl;

    // Record verified evidence items in the evidence table
    const recordedEvidenceIds: number[] = [];
    if (Array.isArray(offerContent.observations)) {
      for (const obs of offerContent.observations) {
        const [ev] = await db
          .insert(evidence)
          .values({
            tenantId: lead.tenantId,
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
          bookingUrl: customBookingUrl,
          deployUrl: offerUrl,
          token: lead.offer.token || secureToken,
          noindex: true,
          evidenceIds: recordedEvidenceIds,
          senderName,
          senderRole,
          senderEmail,
          senderPhone,
          senderCompany,
          senderWebsite,
          customNote,
          ctaText,
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
          tenantId: lead.tenantId,
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
          bookingUrl: customBookingUrl,
          deployUrl: offerUrl,
          senderName,
          senderRole,
          senderEmail,
          senderPhone,
          senderCompany,
          senderWebsite,
          customNote,
          ctaText,
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

export async function PUT(
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
      with: { offer: true },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie znaleziony" }, { status: 404 });
    }

    if (!lead.offer) {
      return NextResponse.json({ success: false, error: "Oferta dla tego leada jeszcze nie istnieje. Wygeneruj ją najpierw." }, { status: 404 });
    }

    // Update existing offer with customized text, modules, pricing and signature
    const [updated] = await db
      .update(offers)
      .set({
        title: body.title !== undefined ? body.title : lead.offer.title,
        heroObservation: body.heroObservation !== undefined ? body.heroObservation : lead.offer.heroObservation,
        pricingRange: body.pricingRange !== undefined ? body.pricingRange : lead.offer.pricingRange,
        ctaText: body.ctaText !== undefined ? body.ctaText : lead.offer.ctaText,
        proposedModules: body.proposedModules !== undefined ? body.proposedModules : lead.offer.proposedModules,
        observationsEvidence: body.observationsEvidence !== undefined ? body.observationsEvidence : lead.offer.observationsEvidence,
        processSteps: body.processSteps !== undefined ? body.processSteps : lead.offer.processSteps,
        bookingUrl: body.bookingUrl !== undefined ? body.bookingUrl : lead.offer.bookingUrl,
        senderName: body.senderName !== undefined ? body.senderName : lead.offer.senderName,
        senderRole: body.senderRole !== undefined ? body.senderRole : lead.offer.senderRole,
        senderEmail: body.senderEmail !== undefined ? body.senderEmail : lead.offer.senderEmail,
        senderPhone: body.senderPhone !== undefined ? body.senderPhone : lead.offer.senderPhone,
        senderCompany: body.senderCompany !== undefined ? body.senderCompany : lead.offer.senderCompany,
        senderWebsite: body.senderWebsite !== undefined ? body.senderWebsite : lead.offer.senderWebsite,
        customNote: body.customNote !== undefined ? body.customNote : lead.offer.customNote,
      })
      .where(eq(offers.id, lead.offer.id))
      .returning();

    // Log modification event in lead_events for full audit trail
    await db.insert(leadEvents).values({
      tenantId: lead.tenantId,
      leadId,
      fromStatus: lead.status,
      toStatus: lead.status,
      reason: "Ręczna edycja treści i podpisu oferty w panelu",
      actor: `user:${user.id}`,
      metadata: {
        editedBy: user.email,
        title: updated.title,
        senderName: updated.senderName,
        pricingRange: updated.pricingRange,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Oferta i podpis nadawcy zostały zaktualizowane pomyślnie!",
      offer: updated,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Offer update error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
