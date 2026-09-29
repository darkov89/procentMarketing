import { db, offers, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { renderOfferPage } from "@/lib/html-renderer";
import { notFound } from "next/navigation";

export default async function OfferPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const offer = await db.query.offers.findFirst({
    where: eq(offers.slug, slug),
    with: { lead: true },
  });

  if (!offer || !offer.lead) {
    notFound();
  }

  const offerContent = {
    heroHeadline: offer.title,
    heroObservation: offer.heroObservation,
    observations: (offer.observationsEvidence as any[]) || [],
    proposedModules: (offer.proposedModules as any[]) || [],
    pricingRange: offer.pricingRange || "od 2 800 zł / mies.",
    processSteps: (offer.processSteps as any[]) || [],
    ctaText: "Umów bezpłatną konsultację",
  };

  const html = renderOfferPage(
    offerContent,
    { companyName: offer.lead.companyName, city: offer.lead.city },
    offer.slug,
    offer.bookingUrl
  );

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ width: "100%", height: "100%", minHeight: "100vh" }}
    />
  );
}
