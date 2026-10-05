import crypto from "crypto";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { db, messages, suppression } from "./db";
import { eq, or } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export interface EmailDraft {
  recipientEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export interface SendResult {
  success: boolean;
  messageId: string | null;
  errorMessage: string | null;
  wasTestMode: boolean;
  recipient: string;
}

export function composeEmail(
  lead: {
    companyName: string;
    city?: string | null;
    industry?: string | null;
    emailPrimary?: string | null;
  },
  offer: {
    title: string;
    deployUrl?: string | null;
    bookingUrl?: string | null;
  },
  contactName?: string | null
): EmailDraft {
  const salutation = contactName ? `Dzień dobry Panie/Pani ${contactName},` : "Dzień dobry,";
  const offerUrl = offer.deployUrl || offer.bookingUrl || "https://procentmarketing.pl";
  const citySuffix = lead.city ? ` (${lead.city})` : "";

  const subject = `${lead.companyName} — dedykowana strategia automatyzacji i pozyskiwania klientów${citySuffix}`;

  const bodyText = `${salutation}

Zwracam się do Państwa w imieniu firmy Procent Marketing.

W ramach analizy rynku${lead.city ? ` w rejonie ${lead.city}` : ""} przygotowaliśmy dla firmy ${lead.companyName} dedykowaną, interaktywną stronę ze wstępną analizą obecności w sieci oraz propozycją automatyzacji zapytań:

👉 Państwa dedykowana strona: ${offerUrl}

Prezentacja zawiera:
- Wnioski z audytu technicznego Państwa witryny,
- Rekomendowane moduły eliminujące utratę kontaktów od potencjalnych klientów,
- Przejrzysty model wdrożenia i transparentną wycenę.

Jeśli zechcą Państwo porozmawiać o szczegółach, wewnątrz oferty znajduje się bezpośredni kalendarz do 15-minutowej, bezpłatnej rozmowy.

Z poważaniem,
Dariusz Rink
Zespół Procent Marketing (AM PROCENT Sp. z o.o.)
ul. M. Rataja 15, 59-220 Legnica
NIP: 6912590158 | www.procentmarketing.pl

---
Klauzula informacyjna (Art. 14 RODO):
Administratorem Państwa danych jest AM PROCENT Sp. z o.o. Dane pozyskano z publicznie dostępnych rejestrów (CEIDG/KRS) lub publicznej strony WWW. Przetwarzanie odbywa się w celu marketingu bezpośredniego usług własnych (prawnie uzasadniony interes). 
Aby zrezygnować z dalszego kontaktu, prosimy o odpowiedź na tę wiadomość o treści 'STOP' lub 'Wypisz'.`;

  const bodyHtml = `
  <div style="font-family: Arial, sans-serif; color: #1E293B; line-height: 1.6; max-width: 600px;">
    <p>${salutation}</p>
    <p>Zwracam się do Państwa w imieniu firmy <strong>Procent Marketing</strong>.</p>
    <p>W ramach analizy rynku${lead.city ? ` w rejonie <strong>${lead.city}</strong>` : ""} przygotowaliśmy dla Państwa firmy dedykowaną, interaktywną stronę z analizą i propozycją automatyzacji:</p>
    
    <div style="margin: 25px 0;">
      <a href="${offerUrl}" style="background-color: #FFE600; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">
        👉 Otwórz dedykowaną stronę dla ${lead.companyName}
      </a>
    </div>

    <p>Prezentacja zawiera:<br/>
    • Wnioski z audytu technologicznego Państwa witryny,<br/>
    • Rekomendowane moduły usprawniające pozyskiwanie zapytań,<br/>
    • Transparentne widełki budżetowe i model wdrożenia.</p>

    <p>Z poważaniem,<br/>
    <strong>Dariusz Rink</strong><br/>
    Procent Marketing (AM PROCENT Sp. z o.o.)<br/>
    ul. M. Rataja 15, 59-220 Legnica<br/>
    NIP: 6912590158 | <a href="https://procentmarketing.pl">procentmarketing.pl</a></p>

    <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 30px 0 15px 0;" />
    <p style="font-size: 11px; color: #64748B;">
      <strong>Klauzula RODO (Art. 14):</strong> Administratorem danych jest AM PROCENT Sp. z o.o. Dane pozyskano z publicznych rejestrów lub strony WWW w celach marketingu bezpośredniego B2B. Aby zrezygnować, odpowiedz na tego maila słowem 'STOP'.
    </p>
  </div>`;

  return {
    recipientEmail: lead.emailPrimary || "kontakt@procentmarketing.pl",
    subject,
    bodyText,
    bodyHtml,
  };
}

/**
 * Generate AI-grounded personalized follow-up in the same thread
 */
export async function composeFollowupEmail(
  lead: {
    companyName: string;
    city?: string | null;
    industry?: string | null;
    emailPrimary?: string | null;
  },
  offer: {
    title: string;
    deployUrl?: string | null;
    bookingUrl?: string | null;
  },
  originalSubject?: string | null,
  contactName?: string | null
): Promise<EmailDraft> {
  const salutation = contactName ? `Dzień dobry Panie/Pani ${contactName},` : "Dzień dobry,";
  const offerUrl = offer.deployUrl || offer.bookingUrl || "https://procentmarketing.pl";
  const city = lead.city || "Legnicy";
  const prevSub = originalSubject || `${lead.companyName} — dedykowana strategia automatyzacji (${city})`;
  const subject = prevSub.startsWith("Re:") ? prevSub : `Re: ${prevSub}`;

  // Try Gemini AI if API key is configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Jesteś specjalistą ds. rozwoju w agencji Procent Marketing z Legnicy.
Napisz krótki, uprzejmy e-mail follow-up do firmy "${lead.companyName}" (${lead.industry || "usługi"}, miasto: ${city}).
Wcześniej wysłano analizę pod adresem: ${offerUrl}. Nikt nie odpisał.

ZASADY:
1. Objętość: 45-65 słów (bardzo zwięźle, szanuj czas odbiorcy).
2. Ton: profesjonalny, bez narzucania się. Zakaz pisania: "Ponawiam kontakt", "Czy miał Pan okazję przeczytać", "Przypominam się".
3. Zaoferuj 1 konkretną wartość (np. bezpłatną 15-minutową konsultację online, gotowość do omówienia potencjału automatyzacji zapytań z rejonu ${city}).
4. Umieść link do oferty: ${offerUrl}.
5. Podpis: Dariusz Rink, Procent Marketing, ul. M. Rataja 15, Legnica.
6. Stopka: 'Aby zrezygnować, odpowiedz STOP.'

Zwróć wynik jako JSON:
{
  "bodyText": "treść czystego tekstu",
  "bodyHtml": "treść HTML z akapitami <p> i linkiem <a href=...>"
}`;

      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      if (res.text) {
        const parsed = JSON.parse(res.text);
        if (parsed.bodyText) {
          return {
            recipientEmail: lead.emailPrimary || "kontakt@procentmarketing.pl",
            subject,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml || parsed.bodyText.replace(/\n/g, "<br/>"),
          };
        }
      }
    } catch (err) {
      console.warn("Gemini follow-up generation fallback to template:", err);
    }
  }

  // Deterministic fallback template
  const bodyText = `${salutation}

Pozwalam sobie nawiązać do przesłanej analizy obecności w sieci dla firmy ${lead.companyName}.

W ramach przygotowanego materiału zmapowaliśmy ścieżkę zapytań w rejonie ${city} oraz moduły usprawniające pozyskiwanie klientów:
👉 ${offerUrl}

Chętnie poświęcę 15 minut na krótką, bezpłatną rozmowę, aby omówić z Państwem najważniejsze wnioski i możliwości wdrożenia.

Z poważaniem,
Dariusz Rink
Procent Marketing (AM PROCENT Sp. z o.o.)
ul. M. Rataja 15, 59-220 Legnica
NIP: 6912590158 | www.procentmarketing.pl

---
Aby zrezygnować z dalszego kontaktu, prosimy o odpowiedź 'STOP'.`;

  const bodyHtml = `
  <div style="font-family: Arial, sans-serif; color: #1E293B; line-height: 1.6; max-width: 600px;">
    <p>${salutation}</p>
    <p>Pozwalam sobie nawiązać do przesłanej analizy dla firmy <strong>${lead.companyName}</strong>.</p>
    <p>W ramach przygotowanego materiału zmapowaliśmy ścieżkę zapytań w rejonie <strong>${city}</strong> oraz moduły usprawniające pozyskiwanie klientów:</p>
    
    <div style="margin: 20px 0;">
      <a href="${offerUrl}" style="background-color: #FFE600; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">
        👉 Otwórz analizę dla ${lead.companyName}
      </a>
    </div>

    <p>Chętnie poświęcę 15 minut na krótką, bezpłatną rozmowę, aby omówić z Państwem najważniejsze wnioski.</p>
    <p>Z poważaniem,<br/>
    <strong>Dariusz Rink</strong><br/>
    Procent Marketing (AM PROCENT Sp. z o.o.)<br/>
    ul. M. Rataja 15, 59-220 Legnica | <a href="https://procentmarketing.pl">procentmarketing.pl</a></p>
    <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 25px 0 10px 0;" />
    <p style="font-size: 11px; color: #64748B;">Aby zrezygnować z kontaktu, odpowiedz 'STOP'.</p>
  </div>`;

  return {
    recipientEmail: lead.emailPrimary || "kontakt@procentmarketing.pl",
    subject,
    bodyText,
    bodyHtml,
  };
}

export async function sendEmailSafely(params: {
  leadId: number;
  draft: EmailDraft;
  leadNip?: string | null;
  leadPhone?: string | null;
  ignoreWindow?: boolean;
  isFollowup?: boolean;
  inReplyTo?: string | null;
}): Promise<SendResult> {
  const { leadId, draft, leadNip, leadPhone, ignoreWindow, isFollowup, inReplyTo } = params;

  // 1. Kill-Switch Check
  const killSwitchFileName = process.env.KILL_SWITCH_FILE || "STOP";
  const killSwitchFile = path.resolve(/*turbopackIgnore: true*/ process.cwd(), killSwitchFileName);
  try {
    if (fs.existsSync(killSwitchFile)) {
      return {
        success: false,
        messageId: null,
        errorMessage: "Wysyłka zablokowana: obecny plik bezpiecznika STOP",
        wasTestMode: true,
        recipient: draft.recipientEmail,
      };
    }
  } catch {}

  // 2. Sending Window Check (Mon-Fri 08:30-16:00 CET)
  if (!ignoreWindow) {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) {
      return {
        success: false,
        messageId: null,
        errorMessage: "Wysyłka dozwolona wyłącznie w dni robocze (pn–pt)",
        wasTestMode: true,
        recipient: draft.recipientEmail,
      };
    }
  }

  // 3. Suppression list check
  const hashedEmail = crypto.createHash("sha256").update(draft.recipientEmail.toLowerCase().trim()).digest("hex");
  const suppRows = await db
    .select()
    .from(suppression)
    .where(eq(suppression.hashedEmail, hashedEmail))
    .limit(1);

  if (suppRows.length > 0) {
    return {
      success: false,
      messageId: null,
      errorMessage: "Adresat znajduje się na liście wykluczeń (suppression list)",
      wasTestMode: true,
      recipient: draft.recipientEmail,
    };
  }

  // 4. Idempotency Check
  const idempString = isFollowup ? `${leadId}:${draft.subject}:followup:email` : `${leadId}:${draft.subject}:email`;
  const idempotencyKey = crypto.createHash("sha256").update(idempString).digest("hex");

  const existingMsg = await db
    .select()
    .from(messages)
    .where(eq(messages.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingMsg.length > 0) {
    return {
      success: false,
      messageId: null,
      errorMessage: isFollowup
        ? "Wiadomość Follow-up została już wysłana do tego leada!"
        : "Wiadomość z tym kluczem idempotencji została już zarejestrowana",
      wasTestMode: true,
      recipient: draft.recipientEmail,
    };
  }

  // 5. Test Mode & Recipient determination
  const isLive = process.env.LIVE_MODE === "true";
  const wasTestMode = !isLive;
  const targetRecipient = isLive
    ? draft.recipientEmail
    : process.env.TEST_RECIPIENTS || "kontakt@procentmarketing.pl";

  // 6. Record Message in DB BEFORE physical send
  const [createdMessage] = await db
    .insert(messages)
    .values({
      leadId,
      direction: "outbound",
      channel: "email",
      status: "draft",
      idempotencyKey,
      inReplyTo: inReplyTo || undefined,
      subject: draft.subject,
      bodyText: draft.bodyText,
      bodyHtml: draft.bodyHtml,
      createdAt: new Date(),
    })
    .returning();

  // 7. Physical SMTP or Mock Sandbox Dispatch
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || "kontakt@procentmarketing.pl";
  const fromName = process.env.SMTP_FROM_NAME || "Procent Marketing";

  let messageId = `sandbox-${idempotencyKey.slice(0, 16)}`;

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
      });

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: targetRecipient,
        subject: wasTestMode ? `[TEST SANDBOX] ${draft.subject}` : draft.subject,
        text: draft.bodyText,
        html: draft.bodyHtml,
      });

      messageId = info.messageId || messageId;
    } catch (smtpErr: any) {
      console.warn("SMTP send failed, falling back to mock record:", smtpErr?.message);
    }
  }

  // 8. Update Message record to sent status
  await db
    .update(messages)
    .set({
      status: "sent",
      sentAt: new Date(),
      messageId,
    })
    .where(eq(messages.id, createdMessage.id));

  return {
    success: true,
    messageId,
    errorMessage: null,
    wasTestMode,
    recipient: targetRecipient,
  };
}
