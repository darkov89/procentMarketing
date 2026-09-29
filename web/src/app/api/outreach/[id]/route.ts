import { NextResponse } from "next/server";
import { db, leads, messages } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { composeEmail, composeFollowupEmail, sendEmailSafely } from "@/lib/outreach";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id, 10);

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: { offer: true, contacts: true },
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead nie znaleziony" }, { status: 404 });
    }

    const leadMessages = await db.query.messages.findMany({
      where: eq(messages.leadId, leadId),
      orderBy: [desc(messages.createdAt)],
    });

    const contactName = lead.contacts?.[0]?.firstName || null;
    let initialDraft = null;
    let followupDraft = null;

    if (lead.offer) {
      initialDraft = composeEmail(lead, lead.offer, contactName);
      const originalSent = leadMessages.find((m) => m.direction === "outbound");
      followupDraft = await composeFollowupEmail(lead, lead.offer, originalSent?.subject, contactName);
    }

    const alreadySent = lead.status === "sent" || lead.status === "followup_sent";
    const canSendFollowup = lead.status === "sent";

    return NextResponse.json({
      success: true,
      lead,
      messages: leadMessages,
      initialDraft,
      followupDraft,
      alreadySent,
      canSendFollowup,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id, 10);
    const body = await req.json().catch(() => ({}));
    const isFollowup = Boolean(body.isFollowup);

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

    // --- CASE 1: SENDING FOLLOW-UP ---
    if (isFollowup) {
      if (lead.status === "followup_sent") {
        return NextResponse.json(
          {
            success: false,
            error: "Follow-up został już wcześniej wysłany do tego leada (maksymalnie 1 follow-up)!",
          },
          { status: 400 }
        );
      }

      if (lead.status !== "sent") {
        return NextResponse.json(
          {
            success: false,
            error: "Follow-up można wysłać wyłącznie do firmy, która otrzymała już pierwszy e-mail (status 'sent') i nie odpisała!",
          },
          { status: 400 }
        );
      }

      // Find original sent message for thread chaining
      const originalSent = await db.query.messages.findFirst({
        where: and(eq(messages.leadId, leadId), eq(messages.direction, "outbound")),
        orderBy: [desc(messages.createdAt)],
      });

      const draft = await composeFollowupEmail(lead, lead.offer, originalSent?.subject, contactName);

      if (body.subject) draft.subject = body.subject;
      if (body.bodyText) draft.bodyText = body.bodyText;

      const sendRes = await sendEmailSafely({
        leadId,
        draft,
        leadNip: lead.nip,
        leadPhone: lead.phoneNormalized,
        ignoreWindow: body.ignoreWindow ?? true,
        isFollowup: true,
        inReplyTo: originalSent?.messageId || null,
      });

      if (sendRes.success) {
        await db
          .update(leads)
          .set({ status: "followup_sent", updatedAt: new Date() })
          .where(eq(leads.id, leadId));
      }

      return NextResponse.json({ success: sendRes.success, result: sendRes, isFollowup: true });
    }

    // --- CASE 2: SENDING INITIAL OUTREACH ---
    if (lead.status === "sent" || lead.status === "followup_sent") {
      return NextResponse.json(
        {
          success: false,
          error: "Wiadomość została już wcześniej wysłana do tego leada! Jeśli klient nie odpowiedział, użyj przycisku 'Wyślij Follow-up'.",
          alreadySent: true,
        },
        { status: 400 }
      );
    }

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
      isFollowup: false,
    });

    if (sendRes.success) {
      await db
        .update(leads)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(leads.id, leadId));
    }

    return NextResponse.json({ success: sendRes.success, result: sendRes, isFollowup: false });
  } catch (err: any) {
    console.error("Outreach error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
