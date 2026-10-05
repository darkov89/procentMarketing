import { NextResponse } from "next/server";
import { db, leads, messages } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { composeEmail, composeFollowupEmail } from "@/lib/outreach";
import { requireUser } from "@/lib/auth";
import { sendMessage } from "@/lib/send-service";
import crypto from "crypto";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
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

    const outboundSent = leadMessages.filter(
      (m) => m.direction === "outbound" && m.status === "sent"
    );
    const alreadySent = outboundSent.length > 0;
    const canSendFollowup = outboundSent.length > 0 && outboundSent.length < 4 && lead.status !== "unsubscribed";

    if (lead.offer) {
      initialDraft = composeEmail(lead, lead.offer, contactName);
      const originalSent = leadMessages.find((m) => m.direction === "outbound");
      const nextStepNumber = Math.min(3, Math.max(1, outboundSent.length));
      followupDraft = await composeFollowupEmail(lead, lead.offer, originalSent?.subject, contactName, nextStepNumber);
    }

    return NextResponse.json({
      success: true,
      lead,
      messages: leadMessages,
      initialDraft,
      followupDraft,
      alreadySent,
      canSendFollowup,
      outboundCount: outboundSent.length,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
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

    // Check existing outbound sent messages
    const sentMessages = await db.query.messages.findMany({
      where: and(eq(messages.leadId, leadId), eq(messages.direction, "outbound"), eq(messages.status, "sent")),
      orderBy: [desc(messages.createdAt)],
    });

    // 1. Prepare draft
    let draft;
    let inReplyTo: string | null = null;
    let sequenceStep = 1;

    if (isFollowup) {
      if (sentMessages.length === 0) {
        return NextResponse.json(
          { success: false, error: "Nie można wysłać follow-up bez uprzedniej wysyłki pierwszego maila." },
          { status: 400 }
        );
      }
      if (sentMessages.length >= 4) {
        return NextResponse.json(
          { success: false, error: "Osiągnięto limit 3 wiadomości follow-up (4 wiadomości łącznie)." },
          { status: 400 }
        );
      }

      const originalSent = sentMessages[0];
      inReplyTo = originalSent.messageId || null;
      sequenceStep = sentMessages.length + 1;
      const stepNumber = Math.min(3, Math.max(1, sentMessages.length));
      draft = await composeFollowupEmail(lead, lead.offer, originalSent.subject, contactName, stepNumber);
    } else {
      if (sentMessages.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Wiadomość została już wcześniej wysłana do tego leada. Użyj opcji Follow-up.",
            alreadySent: true,
          },
          { status: 400 }
        );
      }
      draft = composeEmail(lead, lead.offer, contactName);
    }

    if (body.subject) draft.subject = body.subject;
    if (body.bodyText) draft.bodyText = body.bodyText;

    // 2. Compute idempotency key
    const idempString = `${leadId}:${draft.subject}:${sequenceStep}:email`;
    const idempotencyKey = crypto.createHash("sha256").update(idempString).digest("hex");

    // 3. Insert message in 'scheduled' status
    const [scheduledMsg] = await db
      .insert(messages)
      .values({
        leadId,
        direction: "outbound",
        channel: "email",
        status: "scheduled",
        idempotencyKey,
        inReplyTo: inReplyTo || undefined,
        subject: draft.subject,
        bodyText: draft.bodyText,
        bodyHtml: draft.bodyHtml,
        sequenceStep,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    const targetMsgId = scheduledMsg
      ? scheduledMsg.id
      : (
          await db.query.messages.findFirst({
            where: eq(messages.idempotencyKey, idempotencyKey),
          })
        )?.id;

    if (!targetMsgId) {
      return NextResponse.json(
        { success: false, error: "Nie udało się utworzyć rekordu wiadomości (konflikt idempotencji)." },
        { status: 400 }
      );
    }

    // 4. INVARIANT 2: Dispatch strictly via sendMessage(messageId)
    const sendRes = await sendMessage(targetMsgId, {
      ignoreWindow: body.ignoreWindow ?? false,
    });

    return NextResponse.json({
      success: sendRes.success,
      result: sendRes,
      isFollowup,
      sequenceStep,
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("Outreach error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
