import { NextResponse } from "next/server";
import { db, leads, messages } from "@/lib/db";
import { eq, inArray, and } from "drizzle-orm";
import { composeEmail } from "@/lib/outreach";
import { requireUser } from "@/lib/auth";
import { sendMessage } from "@/lib/send-service";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const requestedLeadIds: number[] | undefined = body.leadIds;

    let targetLeads;
    if (requestedLeadIds && requestedLeadIds.length > 0) {
      targetLeads = await db.query.leads.findMany({
        where: inArray(leads.id, requestedLeadIds),
        with: { offer: true, contacts: true, messages: true },
      });
    } else {
      // Find all leads that are approved or offer_ready / offer_published and have an offer
      targetLeads = await db.query.leads.findMany({
        where: inArray(leads.status, ["approved", "offer_ready", "offer_published"]),
        with: { offer: true, contacts: true, messages: true },
      });
    }

    const results = {
      total: targetLeads.length,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      blockedCount: 0,
      errors: [] as string[],
      details: [] as {
        leadId: number;
        companyName: string;
        recipient: string;
        wasTestMode: boolean;
        status: string;
      }[],
    };

    const ignoreWindow = Boolean(body.ignoreWindow);

    for (const lead of targetLeads) {
      if (!lead.offer) {
        results.skippedCount++;
        results.errors.push(`Lead #${lead.id} (${lead.companyName}): Brak wygenerowanej oferty.`);
        continue;
      }

      if (!lead.emailPrimary) {
        results.skippedCount++;
        results.errors.push(`Lead #${lead.id} (${lead.companyName}): Brak adresu e-mail.`);
        continue;
      }

      const alreadySent = lead.messages?.some(
        (m) => m.direction === "outbound" && m.channel === "email" && m.status === "sent"
      );
      if (alreadySent || lead.status === "sent" || lead.status === "in_sequence" || lead.status === "unsubscribed") {
        results.skippedCount++;
        continue;
      }

      try {
        const contactName = lead.contacts?.[0]?.firstName || null;
        const draft = composeEmail(lead, lead.offer, contactName);

        const idempString = `${lead.id}:${draft.subject}:1:email`;
        const idempotencyKey = crypto.createHash("sha256").update(idempString).digest("hex");

        // 1. Insert message in scheduled status
        const [scheduledMsg] = await db
          .insert(messages)
          .values({
            leadId: lead.id,
            direction: "outbound",
            channel: "email",
            status: "scheduled",
            idempotencyKey,
            subject: draft.subject,
            bodyText: draft.bodyText,
            bodyHtml: draft.bodyHtml,
            sequenceStep: 1,
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
          results.skippedCount++;
          continue;
        }

        // 2. INVARIANT 2: Send strictly through sendMessage(messageId)
        const sendRes = await sendMessage(targetMsgId, { ignoreWindow });

        if (sendRes.success) {
          results.sentCount++;
          results.details.push({
            leadId: lead.id,
            companyName: lead.companyName,
            recipient: sendRes.recipient,
            wasTestMode: sendRes.isTestMode,
            status: sendRes.status,
          });
        } else if (sendRes.status === "blocked") {
          results.blockedCount++;
          results.errors.push(
            `Lead #${lead.id} (${lead.companyName}): Zablokowano - ${sendRes.reason}`
          );
        } else {
          results.failedCount++;
          results.errors.push(
            `Lead #${lead.id} (${lead.companyName}): ${sendRes.reason || "Błąd wysyłki"}`
          );
        }
      } catch (err: any) {
        results.failedCount++;
        results.errors.push(`Lead #${lead.id} (${lead.companyName}): ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    console.error("send-all error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
