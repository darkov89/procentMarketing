import { JobRecord } from "./queue";
import { sendMessage } from "@/lib/send-service";
import { advanceLeadSequence } from "@/modules/campaigns/sequence-engine";
import { processSearchRunBatch } from "@/modules/discovery/search-runner";
import { MockDiscoverySource } from "@/modules/discovery/mock-source";
import { GooglePlacesSource } from "@/modules/discovery/google-places";
import { auditWebsite } from "@/lib/auditor";
import { qualifyLead } from "@/lib/qualifier";
import { generateOfferContent } from "@/lib/gemini";
import { pollInboxAndProcess } from "@/lib/mail-service";
import { db, leads, audits, offers, evidence, appSettings } from "@/lib/db";
import { eq, and, isNotNull, inArray, lt } from "drizzle-orm";
import { transitionLead, LeadStatus } from "@/lib/state-machine";
import slugify from "slugify";
import crypto from "crypto";

export type JobHandler = (job: JobRecord) => Promise<Record<string, unknown> | void>;

export class JobRegistry {
  private handlers = new Map<string, JobHandler>();

  register(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }
}

export const jobRegistry = new JobRegistry();

// 1. send_message: routes through single SMTP send path (Invariant 2)
jobRegistry.register("send_message", async (job) => {
  const payload = job.payload as { messageId?: number; ignoreWindow?: boolean };
  if (!payload?.messageId) {
    throw new Error("Missing messageId in send_message job payload");
  }
  const result = await sendMessage(payload.messageId, { ignoreWindow: payload.ignoreWindow });
  if (!result.success && result.status === "failed") {
    throw new Error(result.reason || "Błąd wysyłki SMTP");
  }
  return { ...result };
});

// 2. advance_sequence: executes next campaign sequence step
jobRegistry.register("advance_sequence", async (job) => {
  const payload = job.payload as { sequenceRunId?: number };
  if (!payload?.sequenceRunId) {
    throw new Error("Missing sequenceRunId in advance_sequence job payload");
  }
  const result = await advanceLeadSequence(payload.sequenceRunId);
  return { ...result };
});

// 3. search_cell: processes Google Places search cell with budget check and checkpoints
jobRegistry.register("search_cell", async (job) => {
  const payload = job.payload as { runId?: number; queryText?: string; limit?: number; useMock?: boolean };
  if (!payload?.runId) {
    throw new Error("Missing runId in search_cell job payload");
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
  const source = payload.useMock || !apiKey
    ? new MockDiscoverySource()
    : new GooglePlacesSource({ apiKey });
  const result = await processSearchRunBatch(job.tenantId, payload.runId, source, {
    maxCellsToProcess: payload.limit || 5,
    queryText: payload.queryText || "",
  });
  return { ...result };
});

// 4. poll_inbox: polls IMAP and processes replies/bounces/unsubscribes
jobRegistry.register("poll_inbox", async () => {
  const result = await pollInboxAndProcess();
  return { ...result };
});

// 5. audit_lead: performs website audit
jobRegistry.register("audit_lead", async (job) => {
  const payload = job.payload as { leadId?: number };
  if (!payload?.leadId) {
    throw new Error("Missing leadId in audit_lead job payload");
  }
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, payload.leadId) });
  if (!lead || !lead.website) {
    await transitionLead({ leadId: payload.leadId, toStatus: "audit_failed", reason: "Brak strony WWW", actor: `worker:job_${job.id}` });
    throw new Error("Brak strony WWW dla leada");
  }

  const auditData = await auditWebsite(lead.website);
  await db.insert(audits).values({ tenantId: lead.tenantId, leadId: lead.id, ...auditData, auditedAt: new Date() }).onConflictDoNothing();
  return { ...auditData };
});

// 6. qualify_lead: scores and qualifies lead
jobRegistry.register("qualify_lead", async (job) => {
  const payload = job.payload as { leadId?: number };
  if (!payload?.leadId) {
    throw new Error("Missing leadId in qualify_lead job payload");
  }
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, payload.leadId), with: { audit: true } });
  if (!lead) {
    throw new Error("Lead nie istnieje");
  }

  const qRes = qualifyLead(lead, lead.audit);
  await db.update(leads).set({ score: qRes.totalScore, scoreBreakdown: qRes.breakdown, updatedAt: new Date() }).where(eq(leads.id, lead.id));
  await transitionLead({
    leadId: lead.id,
    toStatus: qRes.suggestedStatus as LeadStatus,
    reason: qRes.rejectionReason || qRes.reviewReason,
    actor: `worker:job_${job.id}`,
  });
  return { ...qRes };
});

// 7. generate_offer: generates tailored offer content
jobRegistry.register("generate_offer", async (job) => {
  const payload = job.payload as { leadId?: number };
  if (!payload?.leadId) {
    throw new Error("Missing leadId in generate_offer job payload");
  }
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, payload.leadId), with: { audit: true } });
  if (!lead) {
    throw new Error("Lead nie istnieje");
  }

  const senderSetting = await db.query.appSettings.findFirst({
    where: and(eq(appSettings.tenantId, lead.tenantId), eq(appSettings.key, "sender_profile")),
  });
  const defaultSender = senderSetting?.value as any;
  const offerContent = await generateOfferContent(lead, lead.audit, { senderProfile: defaultSender });
  const safeSlug = slugify(`${lead.companyName}-${lead.city || "polska"}`.toLowerCase(), { strict: true, lower: true }).slice(0, 70);
  const secureToken = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const offerUrl = `/o/${secureToken}`;

  const evidenceIds: number[] = [];
  if (Array.isArray(offerContent.observations)) {
    for (const obs of offerContent.observations) {
      const [ev] = await db.insert(evidence).values({
        tenantId: lead.tenantId,
        leadId: lead.id,
        claimType: obs.evidenceKey || "audit_finding",
        claimValue: `${obs.finding} (Wpływ: ${obs.impact})`,
        source: "auditor_v2",
        sourceUrl: lead.website || null,
        snippet: obs.finding,
        confidence: 1.0,
        createdAt: new Date(),
      }).returning();
      evidenceIds.push(ev.id);
    }
  }

  await db.insert(offers).values({
    tenantId: lead.tenantId,
    leadId: lead.id,
    slug: safeSlug,
    token: secureToken,
    noindex: true,
    evidenceIds,
    title: offerContent.heroHeadline,
    heroObservation: offerContent.heroObservation,
    observationsEvidence: offerContent.observations,
    proposedModules: offerContent.proposedModules,
    pricingRange: offerContent.pricingRange,
    processSteps: offerContent.processSteps,
    bookingUrl: defaultSender?.bookingUrl || offerUrl,
    deployUrl: offerUrl,
    senderName: defaultSender?.senderName || "Dariusz",
    senderRole: defaultSender?.senderRole || "Założyciel & Strateg B2B",
    senderEmail: defaultSender?.senderEmail || "kontakt@procentmarketing.pl",
    senderPhone: defaultSender?.senderPhone || null,
    senderCompany: defaultSender?.senderCompany || "Procent Marketing",
    senderWebsite: defaultSender?.senderWebsite || "https://procentmarketing.pl",
    customNote: defaultSender?.customNote || null,
    ctaText: offerContent.ctaText || defaultSender?.defaultCtaText || "Umów bezpłatną konsultację",
    status: "published",
    expiresAt,
    publishedAt: new Date(),
  }).onConflictDoNothing();

  await transitionLead({
    leadId: lead.id,
    toStatus: "offer_ready",
    reason: `Wygenerowano dedykowaną stronę oferty (${offerUrl})`,
    actor: `worker:job_${job.id}`,
  });

  return { offerUrl, token: secureToken };
});

// 8. rollup_stats & cleanup
jobRegistry.register("rollup_stats", async (job) => {
  return { tenantId: job.tenantId, rolledUpAt: new Date().toISOString() };
});

// 9. cleanup: retention policy enforcement (GDPR data minimization art. 5 ust. 1 lit. c)
jobRegistry.register("cleanup", async (job) => {
  const payload = (job.payload || {}) as { retentionDays?: number };
  const retentionDays = payload.retentionDays || 90;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Find terminal leads older than cutoffDate
  const terminalLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, job.tenantId),
        inArray(leads.status, ["won", "lost", "unsubscribed", "blocked"]),
        lt(leads.updatedAt, cutoffDate)
      )
    );

  let cleanedAuditsCount = 0;
  const terminalLeadIds = terminalLeads.map((l) => l.id);

  if (terminalLeadIds.length > 0) {
    const updated = await db
      .update(audits)
      .set({ rawEvidence: null })
      .where(
        and(
          eq(audits.tenantId, job.tenantId),
          inArray(audits.leadId, terminalLeadIds),
          isNotNull(audits.rawEvidence)
        )
      )
      .returning({ id: audits.id });
    cleanedAuditsCount = updated.length;
  }

  return {
    tenantId: job.tenantId,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    cleanedAuditsCount,
    cleanedAt: new Date().toISOString(),
  };
});
