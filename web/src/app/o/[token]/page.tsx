import { db, offers, evidence, leadEvents } from "@/lib/db";
import { eq, or } from "drizzle-orm";
import { renderOfferPage } from "@/lib/html-renderer";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dedykowana Strategia Automatyzacji | Procent Marketing",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SecureOfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || token.length < 8) {
    notFound();
  }

  // Find offer by secure token (or slug fallback)
  const offer = await db.query.offers.findFirst({
    where: or(eq(offers.token, token), eq(offers.slug, token)),
    with: {
      lead: {
        with: {
          audit: true,
          evidence: true,
        },
      },
    },
  });

  if (!offer || !offer.lead) {
    notFound();
  }

  // Check 60-day expiration
  if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-[#0A0E17] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md bg-[#141C2E] border border-[#28354D] rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 bg-[#FFE600]/10 text-[#FFE600] rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            ⏳
          </div>
          <h1 className="text-xl font-black mb-2">Ta oferta wygasła</h1>
          <p className="text-sm text-[#94A3B8] mb-6">
            Dedykowana propozycja dla firmy <strong className="text-white">{offer.lead.companyName}</strong> wygasła po 60 dniach od wygenerowania.
          </p>
          <a
            href="https://procentmarketing.pl"
            className="inline-block bg-[#FFE600] text-black font-extrabold px-6 py-3 rounded-xl hover:bg-[#FFF04D] transition-all text-xs uppercase tracking-wider"
          >
            Skontaktuj się z Procent Marketing
          </a>
        </div>
      </div>
    );
  }

  // Track recipient interaction / offer page view
  try {
    await db
      .update(offers)
      .set({
        viewCount: (offer.viewCount || 0) + 1,
        lastViewedAt: new Date(),
      })
      .where(eq(offers.id, offer.id));

    await db.insert(leadEvents).values({
      leadId: offer.leadId,
      tenantId: offer.tenantId,
      fromStatus: offer.lead.status,
      toStatus: offer.lead.status,
      reason: `Klient otworzył stronę oferty (/o/${token}) - wyświetlenie #${(offer.viewCount || 0) + 1}`,
      actor: "recipient",
      metadata: { token, viewNumber: (offer.viewCount || 0) + 1 },
    });
  } catch (trackErr) {
    console.error("Track view error:", trackErr);
  }

  const offerContent = {
    heroHeadline: offer.title,
    heroObservation: offer.heroObservation,
    observations: (offer.observationsEvidence as any[]) || [],
    proposedModules: (offer.proposedModules as any[]) || [],
    pricingRange: offer.pricingRange || "od 2 800 zł / mies.",
    processSteps: (offer.processSteps as any[]) || [],
    ctaText: offer.ctaText || "Umów bezpłatną konsultację",
  };

  const senderInfo = {
    name: offer.senderName,
    role: offer.senderRole,
    company: offer.senderCompany,
    email: offer.senderEmail,
    phone: offer.senderPhone,
    website: offer.senderWebsite,
    customNote: offer.customNote,
    bookingUrl: offer.bookingUrl,
  };

  const bookingUrl =
    offer.bookingUrl && !offer.bookingUrl.startsWith("/o/")
      ? offer.bookingUrl
      : `https://cal.com/procentmarketing/15min?name=${encodeURIComponent(offer.lead.companyName)}`;

  const html = renderOfferPage(
    offerContent,
    { companyName: offer.lead.companyName, city: offer.lead.city },
    offer.slug,
    bookingUrl,
    senderInfo
  );

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ width: "100%", height: "100%", minHeight: "100vh" }}
      />
    </>
  );
}
