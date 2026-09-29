import { NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { qualifyLead, LeadDecision } from "@/lib/qualifier";

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

    const qRes = qualifyLead(lead, lead.audit);

    const [updatedLead] = await db
      .update(leads)
      .set({
        score: qRes.totalScore,
        status: qRes.suggestedStatus,
        rejectionReason:
          qRes.decision === LeadDecision.AUTO_QUALIFIED
            ? null
            : qRes.rejectionReason || qRes.reviewReason,
        scoreBreakdown: qRes.breakdown,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return NextResponse.json({ success: true, lead: updatedLead, result: qRes });
  } catch (err: any) {
    console.error("Qualify error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
