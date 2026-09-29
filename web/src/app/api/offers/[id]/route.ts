import { NextResponse } from "next/server";
import { db, leads, offers } from "@/lib/db";
import { eq } from "drizzle-orm";
import slugify from "slugify";
import { generateOfferContent, OfferContent } from "@/lib/gemini";
import { renderOfferPage } from "@/lib/html-renderer";
import { deployToNetlify } from "@/lib/netlify";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const html = renderOfferPage(offerContent, lead, safeSlug);
    const deployRes = await deployToNetlify(html, safeSlug);

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
          bookingUrl: deployRes.url,
          deployUrl: deployRes.url,
          netlifyDeployId: deployRes.deployId,
          status: "published",
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
      savedOffer = created;
    }

    // Update lead status
    await db
      .update(leads)
      .set({ status: "offer_published", updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    return NextResponse.json({
      success: true,
      offer: savedOffer,
      html,
      deployResult: deployRes,
    });
  } catch (err: any) {
    console.error("Offer generation error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
