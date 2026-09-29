import { NextResponse } from "next/server";
import { db, leads, audits, offers, messages, contacts } from "@/lib/db";
import { desc, or, ilike, notIlike, isNull, eq } from "drizzle-orm";
import { validateGeo } from "@/lib/geo";
import { normalizeNip, normalizePhone } from "@/lib/dedup";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase();
    const city = searchParams.get("city");
    const status = searchParams.get("status");

    // Fetch leads strictly excluding Wrocław, with joined audit, offer, contacts, messages
    const allLeads = await db.query.leads.findMany({
      where: or(isNull(leads.city), notIlike(leads.city, "%wroc%")),
      orderBy: [desc(leads.score), desc(leads.id)],
      with: {
        audit: true,
        offer: true,
        contacts: true,
        messages: true,
      },
    });

    let filtered = allLeads;

    if (city && city !== "all") {
      filtered = filtered.filter((l) => l.city?.toLowerCase() === city.toLowerCase());
    }

    if (status && status !== "all") {
      filtered = filtered.filter((l) => l.status === status);
    }

    if (search) {
      filtered = filtered.filter(
        (l) =>
          l.companyName.toLowerCase().includes(search) ||
          l.industry?.toLowerCase().includes(search) ||
          l.phoneNormalized?.includes(search) ||
          l.emailPrimary?.toLowerCase().includes(search) ||
          l.city?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, leads: filtered });
  } catch (err: any) {
    console.error("Error fetching leads:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { companyName, city, address, website, email, phone, industry } = body;

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: "Nazwa firmy jest wymagana" },
        { status: 400 }
      );
    }

    // Geo validation
    const geo = validateGeo({ city, address });
    if (!geo.isAllowed) {
      return NextResponse.json(
        { success: false, error: geo.rejectionReason },
        { status: 400 }
      );
    }

    const normPhone = normalizePhone(phone);
    const [newLead] = await db
      .insert(leads)
      .values({
        companyName,
        city: city || "Legnica",
        address,
        website,
        emailPrimary: email,
        phoneNormalized: normPhone,
        industry: industry || "Inna branża",
        distanceKm: geo.distanceKm,
        status: "new",
        sourceName: "manual_js_ui",
      })
      .returning();

    return NextResponse.json({ success: true, lead: newLead });
  } catch (err: any) {
    console.error("Error creating lead:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
