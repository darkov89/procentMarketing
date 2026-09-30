import { NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { desc, or, notIlike, isNull } from "drizzle-orm";
import * as XLSX from "xlsx";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
    const allLeads = await db.query.leads.findMany({
      where: or(isNull(leads.city), notIlike(leads.city, "%wroc%")),
      orderBy: [desc(leads.score), desc(leads.id)],
      with: { audit: true, offer: true, messages: true },
    });

    const rows = allLeads.map((l) => ({
      ID: l.id,
      "Nazwa Firmy": l.companyName,
      Miasto: l.city,
      Adres: l.address,
      "Odległość (km)": l.distanceKm,
      Branża: l.industry,
      Status: l.status,
      "Scoring (0-100)": l.score,
      Decyzja: (l.scoreBreakdown as any)?.decision || "unknown",
      Pewność: (l.scoreBreakdown as any)?.confidence || "medium",
      Telefon: l.phoneNormalized,
      "E-mail": l.emailPrimary,
      "Strona WWW": l.website,
      NIP: l.nip,
      KRS: l.krs,
      "SSL Aktywny": l.audit?.sslValid ? "Tak" : "Nie",
      "Responsywność Mobile": l.audit?.isResponsive ? "Tak" : "Nie",
      "GA4 Zainstalowane": l.audit?.hasGa4 ? "Tak" : "Nie",
      "Rezerwacja Online": l.audit?.hasOnlineBooking ? "Tak" : "Nie",
      "Tytuł Oferty": l.offer?.title || "-",
      "Widełki Cenowe": l.offer?.pricingRange || "-",
      "Link Oferty": l.offer?.deployUrl || "-",
      "Data Utworzenia": l.createdAt ? l.createdAt.toISOString().slice(0, 10) : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leady");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": 'attachment; filename="leads_procent_marketing.xlsx"',
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err: any) {
    console.error("Export error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
