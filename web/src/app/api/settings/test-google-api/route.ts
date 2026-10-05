import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { testGoogleApiKey } from "@/lib/google-places";

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const key = body.apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_KEY || "";

    if (!key) {
      return NextResponse.json({
        success: false,
        error: "Brak klucza Google API do przetestowania.",
        diagnostic: {
          isValid: false,
          status: "INVALID_KEY",
          message: "Wklej klucz Google API przed uruchomieniem testu.",
          actionableHint: "Wklej klucz Google Maps / Places API w polu formularza.",
        },
      });
    }

    const diagnostic = await testGoogleApiKey(key);

    return NextResponse.json({
      success: diagnostic.isValid,
      diagnostic,
      message: diagnostic.message,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
