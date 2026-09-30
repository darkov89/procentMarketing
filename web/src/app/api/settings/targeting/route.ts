import { NextResponse } from "next/server";
import { db, appSettings } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface TargetingPreferences {
  targetRegion: string;
  defaultCity: string;
  defaultRadiusKm: number; // 0 means no radius limit (All Poland)
  targetIndustries: string[];
  targetCompanyScales: string[]; // ["mikro", "male", "msp"]
  excludedKeywords: string[];
  notes?: string;
}

const DEFAULT_PREFERENCES: TargetingPreferences = {
  targetRegion: "Dolnośląskie",
  defaultCity: "Wrocław",
  defaultRadiusKm: 35,
  targetIndustries: [
    "Stomatologia & Medycyna",
    "Biura Rachunkowe & Podatki",
    "Kancelarie Prawne",
    "Fotowoltaika & HVAC",
    "Automatyka B2B & Przemysł",
    "Budownictwo & Remonty",
    "Transport & Spedycja",
    "Serwis Samochodowy & Warsztaty",
    "Usługi IT & Nowe Technologie",
  ],
  targetCompanyScales: ["mikro", "male", "msp"],
  excludedKeywords: [],
  notes: "Własne kryteria targetowania i segmentacji rynku B2B",
};

export async function GET() {
  try {
    const record = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "targeting_preferences"),
    });

    if (record && record.value) {
      return NextResponse.json({
        success: true,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...(record.value as any),
        },
      });
    }

    return NextResponse.json({
      success: true,
      preferences: DEFAULT_PREFERENCES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const preferences: TargetingPreferences = {
      targetRegion: body.targetRegion || DEFAULT_PREFERENCES.targetRegion,
      defaultCity: body.defaultCity || DEFAULT_PREFERENCES.defaultCity,
      defaultRadiusKm:
        body.defaultRadiusKm !== undefined
          ? Number(body.defaultRadiusKm)
          : DEFAULT_PREFERENCES.defaultRadiusKm,
      targetIndustries: Array.isArray(body.targetIndustries)
        ? body.targetIndustries
        : DEFAULT_PREFERENCES.targetIndustries,
      targetCompanyScales: Array.isArray(body.targetCompanyScales)
        ? body.targetCompanyScales
        : DEFAULT_PREFERENCES.targetCompanyScales,
      excludedKeywords: Array.isArray(body.excludedKeywords)
        ? body.excludedKeywords
        : [],
      notes: body.notes || "",
    };

    const existing = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "targeting_preferences"),
    });

    if (existing) {
      await db
        .update(appSettings)
        .set({
          value: preferences,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, "targeting_preferences"));
    } else {
      await db.insert(appSettings).values({
        key: "targeting_preferences",
        value: preferences,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Preferencje targetowania i filtrów zostały zapisane pomyślnie!",
      preferences,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
