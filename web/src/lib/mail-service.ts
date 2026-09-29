import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { db, leads, messages, suppression } from "./db";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

export interface MailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpFromEmail?: string;
  smtpFromName?: string;

  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  imapTls?: boolean;
}

export function getResolvedMailConfig(overrides?: Partial<MailConfig>): MailConfig {
  return {
    smtpHost: overrides?.smtpHost || process.env.SMTP_HOST || "",
    smtpPort: overrides?.smtpPort || parseInt(process.env.SMTP_PORT || "587", 10),
    smtpUser: overrides?.smtpUser || process.env.SMTP_USER || "",
    smtpPass: overrides?.smtpPass || process.env.SMTP_PASSWORD || "",
    smtpSecure:
      overrides?.smtpSecure !== undefined
        ? overrides.smtpSecure
        : (overrides?.smtpPort || parseInt(process.env.SMTP_PORT || "587", 10)) === 465,
    smtpFromEmail: overrides?.smtpFromEmail || process.env.SMTP_FROM_EMAIL || "kontakt@procentmarketing.pl",
    smtpFromName: overrides?.smtpFromName || process.env.SMTP_FROM_NAME || "Procent Marketing",

    imapHost: overrides?.imapHost || process.env.IMAP_HOST || "",
    imapPort: overrides?.imapPort || parseInt(process.env.IMAP_PORT || "993", 10),
    imapUser: overrides?.imapUser || process.env.IMAP_USER || process.env.SMTP_USER || "",
    imapPass: overrides?.imapPass || process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD || "",
    imapTls:
      overrides?.imapTls !== undefined
        ? overrides.imapTls
        : (overrides?.imapPort || parseInt(process.env.IMAP_PORT || "993", 10)) === 993,
  };
}

/**
 * Test SMTP connection and authentication
 */
export async function testSmtpConnection(customConfig?: Partial<MailConfig>): Promise<{
  success: boolean;
  message: string;
  host: string;
  port: number;
}> {
  const cfg = getResolvedMailConfig(customConfig);

  if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
    return {
      success: false,
      message: "Brak wymaganych danych konfiguracyjnych SMTP (host, użytkownik, hasło).",
      host: cfg.smtpHost || "brak",
      port: cfg.smtpPort || 587,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
      connectionTimeout: 8000,
    });

    await transporter.verify();

    return {
      success: true,
      message: `Połączenie z serwerem SMTP (${cfg.smtpHost}:${cfg.smtpPort || 587}) nawiązane pomyślnie! Autoryzacja użytkownika ${cfg.smtpUser} zakończona sukcesem.`,
      host: cfg.smtpHost,
      port: cfg.smtpPort || 587,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Błąd połączenia z SMTP (${cfg.smtpHost}:${cfg.smtpPort || 587}): ${err?.message || String(err)}`,
      host: cfg.smtpHost,
      port: cfg.smtpPort || 587,
    };
  }
}

/**
 * Test IMAP connection and mailbox listing
 */
export async function testImapConnection(customConfig?: Partial<MailConfig>): Promise<{
  success: boolean;
  message: string;
  host: string;
  port: number;
  unreadCount?: number;
  totalCount?: number;
}> {
  const cfg = getResolvedMailConfig(customConfig);

  if (!cfg.imapHost || !cfg.imapUser || !cfg.imapPass) {
    return {
      success: false,
      message: "Brak wymaganych danych konfiguracyjnych IMAP (host, użytkownik, hasło).",
      host: cfg.imapHost || "brak",
      port: cfg.imapPort || 993,
    };
  }

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort || 993,
    secure: cfg.imapTls,
    auth: {
      user: cfg.imapUser,
      pass: cfg.imapPass,
    },
    logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.status("INBOX", { messages: true, unseen: true });
    await client.logout();

    const totalCount = mailbox && typeof mailbox === "object" ? mailbox.messages || 0 : 0;
    const unreadCount = mailbox && typeof mailbox === "object" ? mailbox.unseen || 0 : 0;

    return {
      success: true,
      message: `Połączenie z serwerem IMAP (${cfg.imapHost}:${cfg.imapPort || 993}) poprawne! Skrzynka INBOX zawiera ${totalCount} wiadomości (${unreadCount} nieprzeczytanych).`,
      host: cfg.imapHost,
      port: cfg.imapPort || 993,
      unreadCount,
      totalCount,
    };
  } catch (err: any) {
    try {
      await client.logout();
    } catch {}

    return {
      success: false,
      message: `Błąd połączenia z IMAP (${cfg.imapHost}:${cfg.imapPort || 993}): ${err?.message || String(err)}`,
      host: cfg.imapHost,
      port: cfg.imapPort || 993,
    };
  }
}

/**
 * Classify email reply text using Gemini AI or heuristic fallback
 */
export async function classifyEmailReply(
  subject: string,
  body: string
): Promise<{
  classification: "interested" | "question" | "not_interested" | "unsubscribe" | "auto_reply" | "bounce" | "other";
  confidence: number;
  reason: string;
}> {
  const textLower = (subject + " " + body).toLowerCase();

  // 1. Strict unsubscribe / STOP keywords
  if (
    textLower.includes("stop") ||
    textLower.includes("wypisz") ||
    textLower.includes("nie chcę") ||
    textLower.includes("usunąć z bazy") ||
    textLower.includes("proszę o usunięcie") ||
    textLower.includes("wypisanie")
  ) {
    return {
      classification: "unsubscribe",
      confidence: 0.99,
      reason: "Wykryto słowo kluczowe rezygnacji (opt-out / STOP).",
    };
  }

  // 2. Strict negative keywords
  if (
    textLower.includes("nie dziękuję") ||
    textLower.includes("nie jesteśmy zainteresowani") ||
    textLower.includes("nie jestem zainteresowany") ||
    textLower.includes("brak zainteresowania")
  ) {
    return {
      classification: "not_interested",
      confidence: 0.95,
      reason: "Wykryto jednoznaczną odmowę.",
    };
  }

  // 3. Auto-reply keywords
  if (
    textLower.includes("jestem na urlopie") ||
    textLower.includes("out of office") ||
    textLower.includes("auto-reply") ||
    textLower.includes("automatyczna odpowiedź") ||
    textLower.includes("nieobecny w biurze")
  ) {
    return {
      classification: "auto_reply",
      confidence: 0.95,
      reason: "Wykryto automatyczną odpowiedź o nieobecności.",
    };
  }

  // 4. Try Gemini AI if available
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Przeanalizuj treść odpowiedzi na maila biznesowego agencji marketingowej:
Temat: ${subject}
Treść: ${body}

Sklasyfikuj intencję nadawcy jako dokładnie jedną z wartości:
- "interested" (zainteresowany, chce porozmawiać, pyta o termin, prosi o kontakt)
- "question" (zadaje konkretne pytanie o ofertę, koszty, technologię)
- "not_interested" (nie jest zainteresowany ofertą)
- "unsubscribe" (żąda usunięcia z bazy, pisze STOP lub odwołuje się do RODO)
- "auto_reply" (autoresponder, urlop)
- "bounce" (wiadomość zwrotna o niedoręczeniu)
- "other" (inna treść)

Zwróć odpowiedź w czystym formacie JSON:
{
  "classification": "interested",
  "confidence": 0.9,
  "reason": "krótkie uzasadnienie po polsku"
}`;

      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      if (res.text) {
        const parsed = JSON.parse(res.text);
        if (parsed.classification) {
          return {
            classification: parsed.classification,
            confidence: parsed.confidence || 0.85,
            reason: parsed.reason || "Klasyfikacja AI",
          };
        }
      }
    } catch (e) {
      console.warn("Gemini reply classification error, falling back to heuristics:", e);
    }
  }

  // 5. Positive keywords heuristic fallback
  if (
    textLower.includes("chętnie") ||
    textLower.includes("porozmawiajmy") ||
    textLower.includes("proszę o telefon") ||
    textLower.includes("kontakt") ||
    textLower.includes("spotkanie") ||
    textLower.includes("rezerwacj")
  ) {
    return {
      classification: "interested",
      confidence: 0.8,
      reason: "Wykryto słowa kluczowe zainteresowania ofertą.",
    };
  }

  if (textLower.includes("?") || textLower.includes("ile") || textLower.includes("koszt") || textLower.includes("jak")) {
    return {
      classification: "question",
      confidence: 0.75,
      reason: "Wykryto pytanie dotyczące oferty.",
    };
  }

  return {
    classification: "other",
    confidence: 0.6,
    reason: "Wiadomość wymaga weryfikacji ręcznej.",
  };
}

/**
 * Poll inbox for replies and process them autonomously
 */
export async function pollInboxAndProcess(customConfig?: Partial<MailConfig>): Promise<{
  success: boolean;
  message: string;
  checkedCount: number;
  matchedCount: number;
  unsubscribedCount: number;
  interestedCount: number;
  processedItems: Array<{
    from: string;
    subject: string;
    classification: string;
    leadCompanyName?: string;
    actionTaken: string;
  }>;
}> {
  const cfg = getResolvedMailConfig(customConfig);

  if (!cfg.imapHost || !cfg.imapUser || !cfg.imapPass) {
    return {
      success: false,
      message: "Brak konfiguracji serwera IMAP do odpytywania skrzynki.",
      checkedCount: 0,
      matchedCount: 0,
      unsubscribedCount: 0,
      interestedCount: 0,
      processedItems: [],
    };
  }

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapTls,
    auth: {
      user: cfg.imapUser,
      pass: cfg.imapPass,
    },
    logger: false,
  });

  const processedItems: Array<{
    from: string;
    subject: string;
    classification: string;
    leadCompanyName?: string;
    actionTaken: string;
  }> = [];

  let checkedCount = 0;
  let matchedCount = 0;
  let unsubscribedCount = 0;
  let interestedCount = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch recent unseen messages, or messages from last 14 days
      const searchCriteria = { seen: false };
      const messageGenerator = client.fetch(searchCriteria, {
        envelope: true,
        source: true,
        flags: true,
      });

      for await (const msg of messageGenerator) {
        checkedCount++;
        if (!msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase().trim() || "";
        const subject = parsed.subject || "";
        const bodyText = parsed.text || "";
        const inReplyTo = parsed.inReplyTo || "";
        const messageIdHeader = parsed.messageId || "";

        if (!fromAddress) continue;

        // Try to match email with a Lead or Message
        let matchedLead = null;

        // A. Match by inReplyTo in messages table
        if (inReplyTo) {
          const originalMsg = await db.query.messages.findFirst({
            where: eq(messages.messageId, inReplyTo),
          });
          if (originalMsg) {
            matchedLead = await db.query.leads.findFirst({
              where: eq(leads.id, originalMsg.leadId),
            });
          }
        }

        // B. Match by lead emailPrimary or contact email
        if (!matchedLead) {
          matchedLead = await db.query.leads.findFirst({
            where: eq(leads.emailPrimary, fromAddress),
          });
        }

        if (matchedLead) {
          matchedCount++;

          // Classify the response
          const classification = await classifyEmailReply(subject, bodyText);

          // Generate unique idempotency key for inbound message
          const idempKey = crypto
            .createHash("sha256")
            .update(`inbound:${messageIdHeader || fromAddress}:${parsed.date?.toISOString() || Date.now()}`)
            .digest("hex");

          // Save inbound message
          await db
            .insert(messages)
            .values({
              leadId: matchedLead.id,
              direction: "inbound",
              channel: "email",
              status: "received",
              idempotencyKey: idempKey,
              messageId: messageIdHeader,
              inReplyTo: inReplyTo || undefined,
              subject,
              bodyText,
              bodyHtml: parsed.html || undefined,
              classification: classification.classification,
              classificationDetails: classification,
              sentAt: parsed.date || new Date(),
            })
            .onConflictDoNothing();

          let actionTaken = "";

          // Perform state transition based on classification
          if (classification.classification === "unsubscribe" || classification.classification === "not_interested") {
            unsubscribedCount++;
            actionTaken = "Wypisano z bazy i dodano do SuppressionList";

            // Update lead status
            await db
              .update(leads)
              .set({
                status: classification.classification === "unsubscribe" ? "unsubscribed" : "replied_negative",
                rejectionReason: classification.reason,
              })
              .where(eq(leads.id, matchedLead.id));

            // Add to suppression list (both email and domain)
            const hashedEmail = crypto.createHash("sha256").update(fromAddress).digest("hex");
            await db
              .insert(suppression)
              .values({
                hashedEmail,
                rawIdentifier: fromAddress,
                reason: `Odpowiedź ${classification.classification}: ${classification.reason}`,
              })
              .onConflictDoNothing();
          } else if (classification.classification === "interested") {
            interestedCount++;
            actionTaken = "Zaktualizowano status na 'replied_interested' (Wymaga kontaktu!)";

            await db
              .update(leads)
              .set({
                status: "replied_interested",
              })
              .where(eq(leads.id, matchedLead.id));
          } else if (classification.classification === "question") {
            actionTaken = "Zaktualizowano status na 'replied_question' (Klient pyta o ofertę)";

            await db
              .update(leads)
              .set({
                status: "replied_question",
              })
              .where(eq(leads.id, matchedLead.id));
          } else {
            actionTaken = `Zarejestrowano jako ${classification.classification}`;
          }

          processedItems.push({
            from: fromAddress,
            subject,
            classification: classification.classification,
            leadCompanyName: matchedLead.companyName,
            actionTaken,
          });

          // Mark message as seen on IMAP server
          if (msg.uid) {
            await client.messageFlagsAdd(msg.uid, ["\\Seen"]);
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return {
      success: true,
      message: `Przeszukano skrzynkę IMAP. Sprawdzono ${checkedCount} nowych wiadomości, dopasowano ${matchedCount} odpowiedzi do zarejestrowanych leadów.`,
      checkedCount,
      matchedCount,
      unsubscribedCount,
      interestedCount,
      processedItems,
    };
  } catch (err: any) {
    try {
      await client.logout();
    } catch {}

    return {
      success: false,
      message: `Błąd podczas odpytywania serwera IMAP: ${err?.message || String(err)}`,
      checkedCount,
      matchedCount,
      unsubscribedCount,
      interestedCount,
      processedItems,
    };
  }
}
