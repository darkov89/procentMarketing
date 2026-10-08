import { NextResponse } from "next/server";
import crypto from "crypto";
import { db, leads, leadTasks, suppression, blocks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { transitionLead } from "@/lib/state-machine";

export const dynamic = "force-dynamic";

/**
 * Endpoint obsługujący opt-out odbiorców (List-Unsubscribe RFC 8058 oraz link w stopce).
 * Autoryzowany kryptograficznym tokenem generowanym w send-service.ts:
 * sha256("optout:<leadId>:<tenantId>").slice(0, 16)
 */
export async function GET(req: Request) {
  return handleUnsubscribe(req, "GET");
}

export async function POST(req: Request) {
  return handleUnsubscribe(req, "POST");
}

async function handleUnsubscribe(req: Request, method: "GET" | "POST") {
  try {
    const url = new URL(req.url);
    let leadIdStr = url.searchParams.get("leadId");
    let token = url.searchParams.get("token");

    if (method === "POST" && (!leadIdStr || !token)) {
      try {
        const body = await req.json();
        leadIdStr = leadIdStr || body.leadId;
        token = token || body.token;
      } catch {
        // Fall back to query params
      }
    }

    if (!leadIdStr || !token) {
      if (method === "POST") {
        return NextResponse.json(
          { success: false, error: "Brak wymaganych parametrów leadId oraz token." },
          { status: 400 }
        );
      }
      return renderHtmlResponse({
        title: "Błąd żądania",
        heading: "Nieprawidłowy link wypisania",
        message: "Link jest niekompletny lub uszkodzony. Skontaktuj się z administratorem, aby zgłosić rezygnację.",
        isSuccess: false,
      });
    }

    const leadId = Number.parseInt(leadIdStr, 10);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      if (method === "POST") {
        return NextResponse.json({ success: false, error: "Nieprawidłowy leadId." }, { status: 400 });
      }
      return renderHtmlResponse({
        title: "Błąd identyfikatora",
        heading: "Nieprawidłowy identyfikator",
        message: "Podany identyfikator kontaktu jest niepoprawny.",
        isSuccess: false,
      });
    }

    // 1. Fetch lead record
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      if (method === "POST") {
        return NextResponse.json({ success: false, error: "Rekord kontaktu nie istnieje." }, { status: 404 });
      }
      return renderHtmlResponse({
        title: "Nie znaleziono kontaktu",
        heading: "Kontakt nie istnieje",
        message: "Ten adres e-mail nie figuruje już w naszej bazie danych.",
        isSuccess: false,
      });
    }

    // 2. Validate cryptographic opt-out token
    const expectedToken = crypto
      .createHash("sha256")
      .update(`optout:${lead.id}:${lead.tenantId}`)
      .digest("hex")
      .slice(0, 16);

    if (token !== expectedToken) {
      if (method === "POST") {
        return NextResponse.json({ success: false, error: "Nieprawidłowy token opt-out." }, { status: 403 });
      }
      return renderHtmlResponse({
        title: "Brak autoryzacji",
        heading: "Nieprawidłowy lub wygasły link",
        message: "Podany token bezpieczeństwa jest nieprawidłowy. Odmowa dostępu.",
        isSuccess: false,
      });
    }

    // 3. Apply state transition & suppression if not already unsubscribed
    if (lead.status !== "unsubscribed") {
      try {
        await transitionLead({
          leadId: lead.id,
          toStatus: "unsubscribed",
          reason: "Opt-out odbiorcy (kliknięcie w link wypisania / nagłówek List-Unsubscribe)",
          actor: "recipient",
        });
      } catch (err: unknown) {
        console.warn("transitionLead during unsubscribe:", err);
      }

      const now = new Date();
      const blocksToInsert: Array<{
        tenantId: number;
        kind: string;
        hash: string;
        reason: string;
        source: string;
      }> = [];

      // E-mail suppression & SHA-256 block
      if (lead.emailPrimary) {
        const cleanEmail = lead.emailPrimary.toLowerCase().trim();
        const emailHash = crypto.createHash("sha256").update(cleanEmail).digest("hex");

        blocksToInsert.push({
          tenantId: lead.tenantId,
          kind: "email",
          hash: emailHash,
          reason: "opt_out",
          source: "recipient_unsubscribe",
        });

        await db
          .insert(suppression)
          .values({
            tenantId: lead.tenantId,
            kind: "email",
            hash: emailHash,
            hashedEmail: emailHash,
            rawIdentifier: cleanEmail,
            reason: "Opt-out recipient request (Art. 14 RODO / u.ś.u.d.e.)",
            createdAt: now,
          })
          .onConflictDoNothing();
      }

      // Phone block
      if (lead.phoneNormalized) {
        const phoneDigits = lead.phoneNormalized.replace(/\D/g, "");
        if (phoneDigits.length >= 7) {
          const phoneHash = crypto.createHash("sha256").update(phoneDigits).digest("hex");
          blocksToInsert.push({
            tenantId: lead.tenantId,
            kind: "phone",
            hash: phoneHash,
            reason: "opt_out",
            source: "recipient_unsubscribe",
          });
        }
      }

      // NIP block
      if (lead.nip) {
        const nipDigits = lead.nip.replace(/\D/g, "");
        if (nipDigits.length >= 8) {
          const nipHash = crypto.createHash("sha256").update(nipDigits).digest("hex");
          blocksToInsert.push({
            tenantId: lead.tenantId,
            kind: "nip",
            hash: nipHash,
            reason: "opt_out",
            source: "recipient_unsubscribe",
          });
        }
      }

      // Domain block
      if (lead.website) {
        try {
          const host = new URL(lead.website).hostname.toLowerCase().replace(/^www\./, "");
          if (host.length > 3) {
            const domainHash = crypto.createHash("sha256").update(host).digest("hex");
            blocksToInsert.push({
              tenantId: lead.tenantId,
              kind: "domain",
              hash: domainHash,
              reason: "opt_out",
              source: "recipient_unsubscribe",
            });
          }
        } catch {
          // ignore invalid url
        }
      }

      if (blocksToInsert.length > 0) {
        await db.insert(blocks).values(blocksToInsert).onConflictDoNothing();
      }

      // Cancel any remaining open tasks
      await db
        .update(leadTasks)
        .set({ status: "cancelled", completedAt: now })
        .where(and(eq(leadTasks.leadId, lead.id), eq(leadTasks.status, "open")));
    }

    if (method === "POST") {
      return NextResponse.json({
        success: true,
        message: "Pomyślnie wypisano z listy korespondencji.",
      });
    }

    return renderHtmlResponse({
      title: "Wypisano z korespondencji",
      heading: "Zostałeś pomyślnie wypisany",
      message: `Twój adres e-mail (${lead.emailPrimary || "wskazany kontakt"}) został trwale dodany do listy blokad (suppression list). Nie otrzymasz już żadnych kolejnych wiadomości od nas.`,
      isSuccess: true,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Unsubscribe API error:", errorMsg);
    if (method === "POST") {
      return NextResponse.json({ success: false, error: "Błąd serwera podczas przetwarzania rezygnacji." }, { status: 500 });
    }
    return renderHtmlResponse({
      title: "Błąd przetwarzania",
      heading: "Wystąpił nieoczekiwany błąd",
      message: "Przepraszamy, wystąpił problem podczas przetwarzania żądania. Prosimy spróbować ponownie lub odpowiedzieć na wiadomość z żądaniem wypisania.",
      isSuccess: false,
    });
  }
}

function renderHtmlResponse(params: {
  title: string;
  heading: string;
  message: string;
  isSuccess: boolean;
}) {
  const iconSvg = params.isSuccess
    ? `<svg class="w-12 h-12 text-emerald-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>`
    : `<svg class="w-12 h-12 text-rose-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
       </svg>`;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${params.title} — Procent Marketing</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0A0C10] text-[#F3F4F6] min-h-screen flex items-center justify-center p-4 antialiased">
  <div class="max-w-md w-full bg-[#141C2E] border border-[#28354D] rounded-3xl p-8 text-center shadow-2xl">
    ${iconSvg}
    <h1 class="text-xl font-bold text-white mb-2">${params.heading}</h1>
    <p class="text-sm text-slate-300 mb-6 leading-relaxed">${params.message}</p>
    <div class="pt-6 border-t border-[#28354D] text-xs text-slate-500">
      <p>Zgodność z art. 17 RODO oraz ustawą o świadczeniu usług drogą elektroniczną.</p>
      <p class="mt-1 font-mono text-[11px] text-slate-600">Procent Marketing · Bezpieczeństwo i Transparentność</p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: params.isSuccess ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
