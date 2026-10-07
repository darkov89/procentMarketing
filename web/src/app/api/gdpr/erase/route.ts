import { NextResponse } from "next/server";
import {
  db,
  leads,
  contacts,
  audits,
  blocks,
  suppression,
  tasks,
  sequenceRuns,
  campaignLeads,
  leadEvents,
} from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import crypto from "crypto";

function sha256(val: string): string {
  return crypto.createHash("sha256").update(val.toLowerCase().trim()).digest("hex");
}

function extractDomain(urlOrEmail: string): string | null {
  try {
    if (urlOrEmail.includes("@")) {
      return urlOrEmail.split("@")[1].toLowerCase().trim();
    }
    const parsed = new URL(urlOrEmail.startsWith("http") ? urlOrEmail : `https://${urlOrEmail}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase().trim();
  } catch {
    return null;
  }
}

/**
 * Technical support for Article 17 GDPR: Right to erasure ('right to be forgotten').
 * Anonymizes personal details from leads & contacts while recording irreversible
 * SHA-256 suppression hashes in the 'blocks' table to permanently prevent future outreach.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Brak wybranego tenanta." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const leadId = typeof body.leadId === "number" ? body.leadId : undefined;
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    const erasureReason = typeof body.reason === "string" ? body.reason : "gdpr_erasure_request";

    if (!leadId && !email) {
      return NextResponse.json(
        { error: "Podaj 'leadId' lub 'email', aby wykonać usunięcie danych (art. 17 RODO)." },
        { status: 400 }
      );
    }

    const whereClause = leadId
      ? and(eq(leads.tenantId, tenantId), eq(leads.id, leadId))
      : and(eq(leads.tenantId, tenantId), eq(leads.emailPrimary, email!));

    const [lead] = await db.select().from(leads).where(whereClause).limit(1);

    if (!lead) {
      return NextResponse.json(
        { error: "Nie znaleziono podmiotu dla podanych kryteriów w ramach tenanta." },
        { status: 404 }
      );
    }

    // 1. Calculate irreversible SHA-256 hashes for suppression
    const blocksToInsert: Array<{
      tenantId: number;
      kind: string;
      hash: string;
      reason: string;
      source: string;
    }> = [];

    if (lead.emailPrimary) {
      blocksToInsert.push({
        tenantId,
        kind: "email",
        hash: sha256(lead.emailPrimary),
        reason: "gdpr_erasure",
        source: "gdpr_erase_api",
      });

      const emailDomain = extractDomain(lead.emailPrimary);
      if (emailDomain && !["gmail.com", "wp.pl", "onet.pl", "interia.pl", "o2.pl"].includes(emailDomain)) {
        blocksToInsert.push({
          tenantId,
          kind: "domain",
          hash: sha256(emailDomain),
          reason: "gdpr_erasure",
          source: "gdpr_erase_api",
        });
      }
    }

    if (lead.phoneNormalized) {
      blocksToInsert.push({
        tenantId,
        kind: "phone",
        hash: sha256(lead.phoneNormalized.replace(/[^0-9]/g, "")),
        reason: "gdpr_erasure",
        source: "gdpr_erase_api",
      });
    }

    if (lead.nip) {
      blocksToInsert.push({
        tenantId,
        kind: "nip",
        hash: sha256(lead.nip.replace(/[^0-9]/g, "")),
        reason: "gdpr_erasure",
        source: "gdpr_erase_api",
      });
    }

    if (lead.website) {
      const siteDomain = extractDomain(lead.website);
      if (siteDomain) {
        blocksToInsert.push({
          tenantId,
          kind: "domain",
          hash: sha256(siteDomain),
          reason: "gdpr_erasure",
          source: "gdpr_erase_api",
        });
      }
    }

    // Insert blocks and legacy suppression
    for (const b of blocksToInsert) {
      await db.insert(blocks).values(b).onConflictDoNothing();
      if (b.kind === "email" && lead.emailPrimary) {
        await db
          .insert(suppression)
          .values({
            tenantId,
            kind: "email",
            hash: b.hash,
            hashedEmail: b.hash,
            rawIdentifier: lead.emailPrimary,
            reason: "gdpr_erasure",
          })
          .onConflictDoNothing();
      }
    }

    // 2. Anonymize Lead record
    const anonymizedEmail = `gdpr-erased-${lead.id}@anonymized.invalid`;
    await db
      .update(leads)
      .set({
        companyName: "[DANE ZANONIMIZOWANE NA WNIOSEK RODO]",
        emailPrimary: anonymizedEmail,
        phoneNormalized: null,
        address: null,
        city: null,
        status: "lost",
        lostReason: "gdpr_erasure",
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    // Clear raw evidence in audits if audit exists
    await db
      .update(audits)
      .set({ rawEvidence: null })
      .where(and(eq(audits.tenantId, tenantId), eq(audits.leadId, lead.id)));

    // 3. Anonymize Contacts
    await db
      .update(contacts)
      .set({
        firstName: "Anonim",
        lastName: "RODO",
        email: anonymizedEmail,
        phone: null,
      })
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.leadId, lead.id)));

    // 4. Cancel open tasks and active sequences for this lead
    const campLeads = await db
      .select({ id: campaignLeads.id })
      .from(campaignLeads)
      .where(and(eq(campaignLeads.tenantId, tenantId), eq(campaignLeads.leadId, lead.id)));

    const campaignLeadIds = campLeads.map((cl) => cl.id);
    if (campaignLeadIds.length > 0) {
      await db
        .update(tasks)
        .set({
          status: "cancelled",
          blockedReason: "RODO art. 17: Zadanie anulowane z powodu usunięcia danych",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            inArray(tasks.campaignLeadId, campaignLeadIds),
            eq(tasks.status, "open")
          )
        );

      await db
        .update(sequenceRuns)
        .set({
          status: "stopped",
          stopReason: "gdpr_erasure",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sequenceRuns.tenantId, tenantId),
            inArray(sequenceRuns.campaignLeadId, campaignLeadIds),
            eq(sequenceRuns.status, "active")
          )
        );
    }

    // 5. Audit event
    await db.insert(leadEvents).values({
      tenantId,
      leadId: lead.id,
      fromStatus: lead.status,
      toStatus: "lost",
      reason: `RODO art. 17: Anonimizacja danych osobowych na wniosek (operator: ${user.email}, powód: ${erasureReason})`,
      actor: user.email,
      metadata: {
        requestedBy: user.email,
        erasureReason,
        blocksCount: blocksToInsert.length,
      },
    });

    return NextResponse.json({
      legal_basis: "Article 17 GDPR (Right to erasure / Right to be forgotten)",
      success: true,
      leadId: lead.id,
      anonymized: true,
      blocksCreated: blocksToInsert.length,
      erasedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Zaloguj się") || message.includes("Brak uprawnień") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
