import { NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { qualifyLead, LeadDecision } from "@/lib/qualifier";
import { requireUser } from "@/lib/auth";
import { transitionLead, LeadStatus } from "@/lib/state-machine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
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
    const reason = qRes.decision === LeadDecision.AUTO_QUALIFIED
      ? null
      : qRes.rejectionReason || qRes.reviewReason;

    // 1. Update score & breakdown
    await db
      .update(leads)
      .set({
        score: qRes.totalScore,
        scoreBreakdown: qRes.breakdown,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    // 2. INVARIANT 3: State transition strictly via transitionLead()
    await transitionLead({
      leadId,
      toStatus: qRes.suggestedStatus as LeadStatus,
      reason,
      actor: `user:${user.id}`,
      forceAdminOverride: true,
    });

    const updatedLead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { audit: true, offer: true },
    });

    return NextResponse.json({ success: true, lead: updatedLead, result: qRes });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Qualify error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
