import { NextResponse } from "next/server";
import { db, appSettings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser, requireTenant } from "@/lib/auth";

export interface SenderProfile {
  senderName: string;
  senderRole: string;
  senderEmail: string;
  senderPhone: string;
  senderCompany: string;
  senderWebsite: string;
  bookingUrl: string;
  customNote: string;
  companyDescription?: string;
  pricingModel?: "rev_share" | "hourly" | "fixed_project" | "monthly" | "custom";
  pricingCustomRate?: string;
  defaultCtaText?: string;
}

export const DEFAULT_SENDER_PROFILE: SenderProfile = {
  senderName: "Dariusz",
  senderRole: "Założyciel & Strateg B2B",
  senderEmail: "kontakt@procentmarketing.pl",
  senderPhone: "+48 700 000 000",
  senderCompany: "Procent Marketing",
  senderWebsite: "https://procentmarketing.pl",
  bookingUrl: "https://cal.com/procentmarketing/15min",
  customNote: "W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu.",
  companyDescription: "Procent Marketing — agencja automatyzacji pozyskiwania klientów i sprzedaży B2B. Specjalizujemy się w lejkach sprzedażowych, dedykowanych stronach ofertowych, wdrażaniu narzędzi do rezerwacji 24/7 oraz zaawansowanej analityce konwersji ROI. Dzielimy się zyskiem 50/50 ze zleceń (Success Fee) lub pracujemy w elastycznych modelach stałych (godzinowo / projektowo / abonament).",
  pricingModel: "rev_share",
  pricingCustomRate: "50% podział zysku (Success Fee)",
  defaultCtaText: "Sprawdź warunki współpracy",
};

export async function GET() {
  try {
    await requireUser();
    const record = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "sender_profile"),
    });

    if (record && record.value) {
      return NextResponse.json({
        success: true,
        profile: {
          ...DEFAULT_SENDER_PROFILE,
          ...(record.value as Partial<SenderProfile>),
        },
      });
    }

    return NextResponse.json({
      success: true,
      profile: DEFAULT_SENDER_PROFILE,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant();
    const body = await req.json();

    const profile: SenderProfile = {
      senderName: body.senderName || DEFAULT_SENDER_PROFILE.senderName,
      senderRole: body.senderRole || DEFAULT_SENDER_PROFILE.senderRole,
      senderEmail: body.senderEmail || DEFAULT_SENDER_PROFILE.senderEmail,
      senderPhone: body.senderPhone || DEFAULT_SENDER_PROFILE.senderPhone,
      senderCompany: body.senderCompany || DEFAULT_SENDER_PROFILE.senderCompany,
      senderWebsite: body.senderWebsite || DEFAULT_SENDER_PROFILE.senderWebsite,
      bookingUrl: body.bookingUrl || DEFAULT_SENDER_PROFILE.bookingUrl,
      customNote: body.customNote !== undefined ? body.customNote : DEFAULT_SENDER_PROFILE.customNote,
      companyDescription: body.companyDescription !== undefined ? body.companyDescription : DEFAULT_SENDER_PROFILE.companyDescription,
      pricingModel: body.pricingModel || DEFAULT_SENDER_PROFILE.pricingModel,
      pricingCustomRate: body.pricingCustomRate !== undefined ? body.pricingCustomRate : DEFAULT_SENDER_PROFILE.pricingCustomRate,
      defaultCtaText: body.defaultCtaText || DEFAULT_SENDER_PROFILE.defaultCtaText,
    };

    const existing = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "sender_profile"),
    });

    if (existing) {
      await db
        .update(appSettings)
        .set({
          value: profile,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, "sender_profile"));
    } else {
      await db.insert(appSettings).values({
        tenantId,
        key: "sender_profile",
        value: profile,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Domyślny profil i podpis nadawcy zostały pomyślnie zaktualizowane!",
      profile,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
