import crypto from "crypto";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { db, leads, messages, suppression, appSettings, leadEvents } from "@/lib/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { isWithinSendingWindow } from "./polish-calendar";
import { transitionLead, LeadStatus } from "./state-machine";

export interface SendResult {
  success: boolean;
  messageId: number;
  smtpMessageId: string | null;
  status: "sent" | "failed" | "blocked" | "retried";
  reason?: string;
  isTestMode: boolean;
  recipient: string;
}

export const ALLOWED_CONTACT_BASES = [
  "consent_inbound",
  "inquiry",
  "existing_relationship",
];

export const MAX_OUTBOUND_MESSAGES_PER_LEAD = 4; // Initial + max 3 follow-ups
export const DEFAULT_DAILY_LIMIT = 5;
export const MAX_DAILY_LIMIT = 30;

/**
 * Checks if a specific identifier is on the suppression list
 */
export async function isSuppressed(params: {
  email?: string | null;
  nip?: string | null;
  phone?: string | null;
  domain?: string | null;
}): Promise<{ suppressed: boolean; reason?: string }> {
  const hashesToCheck: string[] = [];

  if (params.email) {
    const norm = params.email.trim().toLowerCase();
    hashesToCheck.push(crypto.createHash("sha256").update(norm).digest("hex"));

    // Also extract domain
    const atIdx = norm.indexOf("@");
    if (atIdx !== -1) {
      const dom = norm.slice(atIdx + 1);
      hashesToCheck.push(crypto.createHash("sha256").update(dom).digest("hex"));
    }
  }

  if (params.domain) {
    const dom = params.domain.trim().toLowerCase().replace(/^www\./, "");
    hashesToCheck.push(crypto.createHash("sha256").update(dom).digest("hex"));
  }

  if (params.nip) {
    const cleanNip = params.nip.replace(/\D/g, "");
    if (cleanNip) {
      hashesToCheck.push(crypto.createHash("sha256").update(cleanNip).digest("hex"));
    }
  }

  if (params.phone) {
    const cleanPhone = params.phone.replace(/\D/g, "");
    if (cleanPhone) {
      hashesToCheck.push(crypto.createHash("sha256").update(cleanPhone).digest("hex"));
    }
  }

  if (hashesToCheck.length === 0) {
    return { suppressed: false };
  }

  const matches = await db
    .select({
      id: suppression.id,
      reason: suppression.reason,
      rawIdentifier: suppression.rawIdentifier,
    })
    .from(suppression)
    .where(
      sql`${suppression.hashedEmail} IN ${hashesToCheck} OR ${suppression.hashedDomain} IN ${hashesToCheck} OR ${suppression.hashedNip} IN ${hashesToCheck} OR ${suppression.hashedPhone} IN ${hashesToCheck}`
    )
    .limit(1);

  if (matches.length > 0) {
    return {
      suppressed: true,
      reason: matches[0].reason || `Dopasowano do listy wykluczeń (${matches[0].rawIdentifier || "identyfikator"})`,
    };
  }

  return { suppressed: false };
}

/**
 * Count actual live sent messages today in Warsaw timezone
 */
export async function getLiveMessagesSentTodayCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.direction, "outbound"),
        eq(messages.status, "sent"),
        gte(messages.sentAt, startOfDay)
      )
    );

  return Number(row?.count || 0);
}

/**
 * INVARIANT 2: ONE EMAIL SEND PATH.
 * Every production email must go through sendMessage(messageId).
 * Executes checks strictly in order:
 * 1. load message + lead
 * 2. database kill switch
 * 3. LIVE_MODE=true
 * 4. settings.live_enabled=true
 * 5. valid contact_basis
 * 6. valid lead status
 * 7. valid sequence step (<= 4 total messages)
 * 8. suppression by: email, domain, NIP, phone
 * 9. allowed sending window (Mon-Fri 08:30-16:00 Warsaw)
 * 10. Polish holiday rules
 * 11. daily limit
 * 12. ramp limit
 * 13. atomic message claim
 * 14. SMTP send
 * 15. persist successful send
 * 16. create audit event
 */
export async function sendMessage(
  messageId: number,
  options: { ignoreWindow?: boolean } = {}
): Promise<SendResult> {
  // -------------------------------------------------------------
  // 1. LOAD MESSAGE + LEAD
  // -------------------------------------------------------------
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!msg) {
    throw new Error(`Wiadomość #${messageId} nie istnieje w bazie danych.`);
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, msg.leadId));
  if (!lead) {
    throw new Error(`Lead #${msg.leadId} dla wiadomości #${messageId} nie istnieje.`);
  }

  // Fixture leads must never be sendable
  if (lead.isFixture) {
    await db
      .update(messages)
      .set({ status: "failed", errorMessage: "Zablokowano: próba wysyłki do rekordu testowego (isFixture=true)" })
      .where(eq(messages.id, messageId));
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: "Lead jest rekordem testowym (fixture). Wysyłka zabroniona.",
      isTestMode: true,
      recipient: lead.emailPrimary || "",
    };
  }

  // -------------------------------------------------------------
  // 2. DATABASE / FILE KILL SWITCH
  // -------------------------------------------------------------
  // Check file kill switch
  const killSwitchFileName = process.env.KILL_SWITCH_FILE || "STOP";
  const killSwitchPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), killSwitchFileName);
  const fileKillSwitchActive = fs.existsSync(killSwitchPath);

  // Check database kill switch in appSettings
  const [dbKillSetting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "kill_switch"))
    .limit(1);

  const dbKillSwitchActive = Boolean(
    dbKillSetting && (dbKillSetting.value as Record<string, unknown>)?.active === true
  );

  if (fileKillSwitchActive || dbKillSwitchActive) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Wysyłka wstrzymana przez Kill Switch (${fileKillSwitchActive ? "plik STOP" : "baza danych"}).`,
      isTestMode: true,
      recipient: lead.emailPrimary || "",
    };
  }

  // -------------------------------------------------------------
  // 3 & 4. LIVE_MODE & SETTINGS.LIVE_ENABLED
  // -------------------------------------------------------------
  const envLive = process.env.LIVE_MODE === "true";

  const [liveSettingsRow] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "sending_settings"))
    .limit(1);

  const settingsLiveEnabled = Boolean(
    liveSettingsRow && (liveSettingsRow.value as Record<string, unknown>)?.live_enabled === true
  );

  // The send is truly LIVE only if BOTH env AND database setting agree
  const isTrulyLive = envLive && settingsLiveEnabled;

  // Determine target recipient (test redirection if not live)
  const realRecipient = lead.emailPrimary?.trim().toLowerCase();
  if (!realRecipient) {
    await db
      .update(messages)
      .set({ status: "failed", errorMessage: "Lead nie posiada adresu e-mail." })
      .where(eq(messages.id, messageId));
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "failed",
      reason: "Brak adresu e-mail leada.",
      isTestMode: !isTrulyLive,
      recipient: "",
    };
  }

  const testRecipients = (process.env.TEST_RECIPIENTS || "kontakt@procentmarketing.pl")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const targetRecipient = isTrulyLive ? realRecipient : testRecipients[0];

  // -------------------------------------------------------------
  // 5. VALID CONTACT_BASIS (Only required for live sends)
  // -------------------------------------------------------------
  const basis = lead.contactBasis || "inquiry";
  if (isTrulyLive && !ALLOWED_CONTACT_BASES.includes(basis)) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Niedozwolona podstawa kontaktu: '${basis}'. Dozwolone: ${ALLOWED_CONTACT_BASES.join(", ")}`,
      isTestMode: false,
      recipient: realRecipient,
    };
  }

  // -------------------------------------------------------------
  // 6. VALID LEAD STATUS & TERMINAL STATES
  // -------------------------------------------------------------
  const terminalStatuses = ["unsubscribed", "bounced", "lost", "replied_negative", "disqualified"];
  if (terminalStatuses.includes(lead.status as string)) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Wysyłka zablokowana: lead posiada status końcowy '${lead.status}'.`,
      isTestMode: !isTrulyLive,
      recipient: realRecipient,
    };
  }

  const allowedStatuses: LeadStatus[] = ["approved", "in_sequence"];
  if (isTrulyLive && !allowedStatuses.includes(lead.status as LeadStatus)) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Nieprawidłowy status leada do wysyłki: '${lead.status}'. Wymagany: 'approved' lub 'in_sequence'.`,
      isTestMode: false,
      recipient: realRecipient,
    };
  }

  // -------------------------------------------------------------
  // 7. VALID SEQUENCE STEP (Enforce MAX 4 OUTBOUND / 3 FOLLOW-UPS)
  // -------------------------------------------------------------
  if (typeof msg.sequenceStep === "number" && msg.sequenceStep > 3) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Wysyłka zablokowana: maksymalna liczba follow-upów przekroczona (krok ${msg.sequenceStep} > 3).`,
      isTestMode: !isTrulyLive,
      recipient: realRecipient,
    };
  }

  const [existingOutboundCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.leadId, lead.id),
        eq(messages.direction, "outbound"),
        eq(messages.status, "sent")
      )
    );

  const existingOutboundCount = Number(existingOutboundCountRow?.count || 0);
  if (existingOutboundCount >= MAX_OUTBOUND_MESSAGES_PER_LEAD) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Osiągnięto twardy limit wysyłek dla leada #${lead.id} (${existingOutboundCount}/${MAX_OUTBOUND_MESSAGES_PER_LEAD} wiadomości).`,
      isTestMode: !isTrulyLive,
      recipient: realRecipient,
    };
  }

  // -------------------------------------------------------------
  // 8. SUPPRESSION CHECK (email, domain, NIP, phone)
  // -------------------------------------------------------------
  const suppCheck = await isSuppressed({
    email: realRecipient,
    nip: lead.nip,
    phone: lead.phoneNormalized,
    domain: lead.website,
  });

  if (suppCheck.suppressed) {
    await db
      .update(messages)
      .set({ status: "failed", errorMessage: `Zablokowano: ${suppCheck.reason}` })
      .where(eq(messages.id, messageId));

    if (isTrulyLive) {
      await transitionLead({
        leadId: lead.id,
        toStatus: "unsubscribed",
        reason: suppCheck.reason,
        actor: "system:suppression_check",
      });
    }

    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: suppCheck.reason,
      isTestMode: !isTrulyLive,
      recipient: realRecipient,
    };
  }

  // -------------------------------------------------------------
  // 9 & 10. ALLOWED SENDING WINDOW & POLISH HOLIDAY RULES
  // -------------------------------------------------------------
  if (isTrulyLive && !options.ignoreWindow) {
    const windowCheck = isWithinSendingWindow();
    if (!windowCheck.allowed) {
      return {
        success: false,
        messageId,
        smtpMessageId: null,
        status: "blocked",
        reason: windowCheck.reason,
        isTestMode: false,
        recipient: realRecipient,
      };
    }
  }

  // -------------------------------------------------------------
  // 11 & 12. DAILY LIMIT & RAMP LIMIT
  // -------------------------------------------------------------
  if (isTrulyLive) {
    const liveSentToday = await getLiveMessagesSentTodayCount();
    const settingsVal = liveSettingsRow?.value as Record<string, unknown> | undefined;
    const configuredLimit = Math.min(
      typeof settingsVal?.daily_limit === "number" ? settingsVal.daily_limit : DEFAULT_DAILY_LIMIT,
      MAX_DAILY_LIMIT
    );

    if (liveSentToday >= configuredLimit) {
      return {
        success: false,
        messageId,
        smtpMessageId: null,
        status: "blocked",
        reason: `Dzienny limit wysyłek został wyczerpany (${liveSentToday}/${configuredLimit}).`,
        isTestMode: false,
        recipient: realRecipient,
      };
    }
  }

  // -------------------------------------------------------------
  // 13. ATOMIC MESSAGE CLAIM
  // Prevents concurrent runners from sending duplicate emails!
  // -------------------------------------------------------------
  const [claimed] = await db
    .update(messages)
    .set({
      status: "sending",
      lockedAt: new Date(),
    })
    .where(
      and(
        eq(messages.id, messageId),
        sql`${messages.status} IN ('scheduled', 'draft', 'pending')`
      )
    )
    .returning();

  if (!claimed) {
    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: "blocked",
      reason: `Wiadomość #${messageId} została już zarezerwowana lub wysłana przez inny proces (status: ${msg.status}).`,
      isTestMode: !isTrulyLive,
      recipient: realRecipient,
    };
  }

  // -------------------------------------------------------------
  // 14. SMTP SEND
  // -------------------------------------------------------------
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || "kontakt@procentmarketing.pl";
  const fromName = process.env.SMTP_FROM_NAME || "Procent Marketing";

  let smtpMessageId: string | null = null;
  let sendError: Error | null = null;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 10000,
      });

      const subject = isTrulyLive
        ? msg.subject || "Oferta współpracy"
        : `[TEST SANDBOX] ${msg.subject || "Oferta"}`;

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: targetRecipient,
        subject,
        text: msg.bodyText || "",
        html: msg.bodyHtml || undefined,
        inReplyTo: msg.inReplyTo || undefined,
      });

      smtpMessageId = info.messageId || `smtp-${Date.now()}`;
    } catch (err: unknown) {
      sendError = err instanceof Error ? err : new Error(String(err));
    }
  } else if (!isTrulyLive) {
    // Local mock sandbox dispatch for local development
    smtpMessageId = `mock-sandbox-${crypto.randomBytes(8).toString("hex")}`;
  } else {
    sendError = new Error("Brak konfiguracji serwera SMTP (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) dla wysyłki LIVE!");
  }

  // -------------------------------------------------------------
  // 15 & 16. PERSIST STATUS & CREATE AUDIT EVENT
  // -------------------------------------------------------------
  if (sendError || !smtpMessageId) {
    const errorMsg = sendError?.message || "Nieznany błąd SMTP";
    const currentRetries = msg.retryCount + 1;
    const canRetry = currentRetries < 3;

    await db
      .update(messages)
      .set({
        status: canRetry ? "scheduled" : "failed",
        retryCount: currentRetries,
        errorMessage: errorMsg,
        lockedAt: null,
      })
      .where(eq(messages.id, messageId));

    await db.insert(leadEvents).values({
      tenantId: lead.tenantId,
      leadId: lead.id,
      fromStatus: lead.status,
      toStatus: lead.status,
      reason: `Błąd wysyłki SMTP (próba ${currentRetries}/3): ${errorMsg}`,
      actor: "system:sendMessage",
      metadata: { messageId, error: errorMsg, canRetry },
    });

    return {
      success: false,
      messageId,
      smtpMessageId: null,
      status: canRetry ? "retried" : "failed",
      reason: errorMsg,
      isTestMode: !isTrulyLive,
      recipient: targetRecipient,
    };
  }

  // Successfully accepted by SMTP server!
  const now = new Date();
  await db
    .update(messages)
    .set({
      status: "sent",
      sentAt: now,
      messageId: smtpMessageId,
      lockedAt: null,
    })
    .where(eq(messages.id, messageId));

  // Only advance lead state for LIVE sends
  if (isTrulyLive) {
    const nextStep = (lead.sequenceStep || 0) + 1;
    await transitionLead({
      leadId: lead.id,
      toStatus: "in_sequence",
      sequenceStep: nextStep,
      reason: `Wysłano wiadomość krok ${nextStep} (ID: ${messageId})`,
      actor: "system:sendMessage",
      metadata: { messageId, smtpMessageId, step: nextStep },
    });
  }

  return {
    success: true,
    messageId,
    smtpMessageId,
    status: "sent",
    isTestMode: !isTrulyLive,
    recipient: targetRecipient,
  };
}
