import { NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { composeEmail, sendEmailSafely } from "@/lib/outreach";

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
      with: { offer: true, contacts: true },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie znaleziony" }, { status: 404 });
    }

    if (!lead.offer) {
      return NextResponse.json(
        { success: false, error: "Lead nie posiada jeszcze wygenerowanej oferty" },
        { status: 400 }
      );
    }

    const contactName = lead.contacts?.[0]?.firstName || null;
    const draft = composeEmail(lead, lead.offer, contactName);

    // If custom draft was passed from UI editor
    if (body.subject) draft.subject = body.subject;
    if (body.bodyText) draft.bodyText = body.bodyText;

    const sendRes = await sendEmailSafely({
      leadId,
      draft,
      leadNip: lead.nip,
      leadPhone: lead.phoneNormalized,
      ignoreWindow: body.ignoreWindow ?? true,
    });

    if (sendRes.success) {
      await db
        .update(leads)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(leads.id, leadId));
    }

    return NextResponse.json({ success: sendRes.success, result: sendRes });
  } catch (err: any) {
    console.error("Outreach error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
