import { NextResponse } from "next/server";
import { db, leads, audits } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auditWebsite } from "@/lib/auditor";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id, 10);

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { audit: true },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie znaleziony" }, { status: 404 });
    }

    if (!lead.website) {
      return NextResponse.json({ success: false, error: "Lead nie posiada adresu strony WWW" }, { status: 400 });
    }

    const auditData = await auditWebsite(lead.website);

    if (lead.audit) {
      await db
        .update(audits)
        .set({
          ...auditData,
          auditedAt: new Date(),
        })
        .where(eq(audits.id, lead.audit.id));
    } else {
      await db.insert(audits).values({
        leadId,
        ...auditData,
        auditedAt: new Date(),
      });
    }

    // Auto-update email if found on site and missing on lead
    if (!lead.emailPrimary && auditData.emailsScraped.length > 0) {
      await db
        .update(leads)
        .set({ emailPrimary: auditData.emailsScraped[0] })
        .where(eq(leads.id, leadId));
    }

    return NextResponse.json({ success: true, audit: auditData });
  } catch (err: any) {
    console.error("Audit error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
