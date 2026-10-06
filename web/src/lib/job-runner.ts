import { db, jobs, leads, audits, offers, messages, evidence } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { auditWebsite } from "./auditor";
import { qualifyLead } from "./qualifier";
import { generateOfferContent } from "./gemini";
import { sendMessage } from "./send-service";
import { pollInboxAndProcess } from "./mail-service";
import { transitionLead, LeadStatus } from "./state-machine";
import { addPolishBusinessDays } from "./polish-calendar";
import { composeFollowupEmail } from "./outreach";
import crypto from "crypto";
import slugify from "slugify";

export type JobType =
  | "audit_lead"
  | "qualify_lead"
  | "generate_offer"
  | "send_scheduled_message"
  | "poll_inbox"
  | "process_followups";

export interface EnqueueOptions {
  tenantId?: number;
  runAt?: Date;
  maxAttempts?: number;
}

/**
 * Enqueue a new idempotent background job.
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
) {
  const [job] = await db
    .insert(jobs)
    .values({
      tenantId: options.tenantId || (payload.tenantId as number) || 1,
      type,
      payload,
      status: "pending",
      runAt: options.runAt || new Date(),
      maxAttempts: options.maxAttempts || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return job;
}

/**
 * Atomically claims the next pending job using PostgreSQL SKIP LOCKED semantics.
 */
export async function claimNextJob(workerId: string) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Use raw sql for atomic FOR UPDATE SKIP LOCKED
  const claimedRows = await db
    .update(jobs)
    .set({
      status: "running",
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: sql`${jobs.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(
      sql`${jobs.id} = (
        SELECT id FROM jobs
        WHERE (status = 'pending' OR (status = 'running' AND locked_at < ${fiveMinutesAgo}))
          AND run_at <= NOW()
        ORDER BY run_at ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )`
    )
    .returning();

  return claimedRows[0] || null;
}

/**
 * Mark a job completed.
 */
export async function markJobCompleted(jobId: number) {
  await db
    .update(jobs)
    .set({
      status: "completed",
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Mark a job failed, re-scheduling if attempts < maxAttempts.
 */
export async function markJobFailed(jobId: number, attempts: number, maxAttempts: number, error: string) {
  const canRetry = attempts < maxAttempts;
  const backoffSeconds = Math.pow(2, attempts) * 30; // 30s, 60s, 120s...
  const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

  await db
    .update(jobs)
    .set({
      status: canRetry ? "pending" : "failed",
      lastError: error,
      runAt: canRetry ? nextRunAt : undefined,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Execute a single claimed job.
 */
export async function executeJob(job: typeof jobs.$inferSelect): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const payload = (job.payload as Record<string, unknown>) || {};

  switch (job.type as JobType) {
    case "audit_lead": {
      const leadId = Number(payload.leadId);
      const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
      if (!lead || !lead.website) {
        await transitionLead({ leadId, toStatus: "audit_failed", reason: "Brak strony WWW", actor: `worker:job_${job.id}` });
        return { success: false, error: "Brak strony WWW" };
      }

      try {
        const auditData = await auditWebsite(lead.website);
        await db.insert(audits).values({ tenantId: lead.tenantId, leadId, ...auditData, auditedAt: new Date() }).onConflictDoNothing();

        // Enqueue qualification job
        await enqueueJob("qualify_lead", { leadId, tenantId: lead.tenantId }, { tenantId: lead.tenantId });
        return { success: true, result: auditData };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await transitionLead({ leadId, toStatus: "audit_failed", reason: message, actor: `worker:job_${job.id}` });
        return { success: false, error: message };
      }
    }

    case "qualify_lead": {
      const leadId = Number(payload.leadId);
      const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), with: { audit: true } });
      if (!lead) return { success: false, error: "Lead nie istnieje" };

      const qRes = qualifyLead(lead, lead.audit);
      await db.update(leads).set({ score: qRes.totalScore, scoreBreakdown: qRes.breakdown, updatedAt: new Date() }).where(eq(leads.id, leadId));
      await transitionLead({
        leadId,
        toStatus: qRes.suggestedStatus as LeadStatus,
        reason: qRes.rejectionReason || qRes.reviewReason,
        actor: `worker:job_${job.id}`,
      });

      if (qRes.suggestedStatus === "qualified") {
        await enqueueJob("generate_offer", { leadId, tenantId: lead.tenantId }, { tenantId: lead.tenantId });
      }

      return { success: true, result: qRes };
    }

    case "generate_offer": {
      const leadId = Number(payload.leadId);
      const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), with: { audit: true, offer: true } });
      if (!lead) return { success: false, error: "Lead nie istnieje" };

      const offerContent = await generateOfferContent(lead, lead.audit);
      const safeSlug = slugify(`${lead.companyName}-${lead.city || "legnica"}`.toLowerCase(), { strict: true, lower: true }).slice(0, 70);
      const secureToken = crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const offerUrl = `/o/${secureToken}`;

      // Insert evidence claims
      const evidenceIds: number[] = [];
      if (Array.isArray(offerContent.observations)) {
        for (const obs of offerContent.observations) {
          const [ev] = await db.insert(evidence).values({
            tenantId: lead.tenantId,
            leadId,
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
        leadId,
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
        bookingUrl: offerUrl,
        deployUrl: offerUrl,
        status: "published",
        expiresAt,
        publishedAt: new Date(),
      }).onConflictDoNothing().returning();

      await transitionLead({
        leadId,
        toStatus: "offer_ready",
        reason: `Wygenerowano dedykowaną stronę oferty (${offerUrl})`,
        actor: `worker:job_${job.id}`,
      });

      return { success: true, result: { offerUrl, token: secureToken } };
    }

    case "send_scheduled_message": {
      const messageId = Number(payload.messageId);
      const sendRes = await sendMessage(messageId, { ignoreWindow: Boolean(payload.ignoreWindow) });
      return { success: sendRes.success, result: sendRes };
    }

    case "poll_inbox": {
      const pollRes = await pollInboxAndProcess(payload.customConfig as any);
      return { success: pollRes.success, result: pollRes };
    }

    case "process_followups": {
      // 12. FOLLOW-UP ENGINE
      // Cadence: Initial -> +3 biz days FU1 -> +5 biz days FU2 -> +7 biz days FU3 -> +7 biz days silence -> lost(no_response)
      const inSequenceLeads = await db.query.leads.findMany({
        where: eq(leads.status, "in_sequence"),
        with: {
          offer: true,
          contacts: true,
          messages: true,
        },
      });

      let scheduledCount = 0;
      let lostCount = 0;
      const now = new Date();

      for (const l of inSequenceLeads) {
        if (!l.offer || !l.emailPrimary) continue;

        const sentOutbound = (l.messages || [])
          .filter((m) => m.direction === "outbound" && m.status === "sent")
          .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0));

        if (sentOutbound.length === 0) continue;

        const lastSent = sentOutbound[0];
        const lastSentDate = lastSent.sentAt || lastSent.createdAt;
        const currentStep = sentOutbound.length; // 1 = sent initial, 2 = sent FU1, 3 = sent FU2, 4 = sent FU3

        // Determine required delay in business days
        let requiredBusinessDays = 3;
        if (currentStep === 1) requiredBusinessDays = 3; // FU1 after 3 days
        else if (currentStep === 2) requiredBusinessDays = 5; // FU2 after 5 days
        else if (currentStep === 3) requiredBusinessDays = 7; // FU3 after 7 days
        else if (currentStep >= 4) {
          // After FU3 + 7 business days of silence -> lost(no_response)
          const lostThreshold = addPolishBusinessDays(lastSentDate, 7);
          if (now >= lostThreshold) {
            await transitionLead({
              leadId: l.id,
              toStatus: "lost",
              lostReason: "no_response_after_fu3",
              reason: "Brak odpowiedzi po 3 wiadomościach follow-up i 7 dniach roboczych",
              cooldownUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 12 months cooldown
              actor: `worker:job_${job.id}`,
            });
            lostCount++;
          }
          continue;
        }

        const dueDate = addPolishBusinessDays(lastSentDate, requiredBusinessDays);
        if (now >= dueDate) {
          const nextStep = currentStep + 1;
          const contactName = l.contacts?.[0]?.firstName || null;
          const draft = await composeFollowupEmail(l, l.offer, lastSent.subject, contactName);

          const idempString = `${l.id}:${draft.subject}:${nextStep}:email`;
          const idempotencyKey = crypto.createHash("sha256").update(idempString).digest("hex");

          const [scheduledMsg] = await db
            .insert(messages)
            .values({
              tenantId: l.tenantId,
              leadId: l.id,
              direction: "outbound",
              channel: "email",
              status: "scheduled",
              idempotencyKey,
              inReplyTo: lastSent.messageId || undefined,
              subject: draft.subject,
              bodyText: draft.bodyText,
              bodyHtml: draft.bodyHtml,
              sequenceStep: nextStep,
              createdAt: new Date(),
            })
            .onConflictDoNothing()
            .returning();

          if (scheduledMsg) {
            await enqueueJob(
              "send_scheduled_message",
              { messageId: scheduledMsg.id, tenantId: l.tenantId },
              { tenantId: l.tenantId }
            );
            scheduledCount++;
          }
        }
      }

      return { success: true, result: { checked: inSequenceLeads.length, scheduledCount, lostCount } };
    }

    default:
      return { success: false, error: `Nieznany typ zadania: ${job.type}` };
  }
}

/**
 * Runs a batch of jobs for a worker invocation.
 */
export async function runWorkerBatch(workerId: string = `worker_${Date.now()}`, maxJobs = 5) {
  let processed = 0;
  const results = [];

  while (processed < maxJobs) {
    const job = await claimNextJob(workerId);
    if (!job) break;

    try {
      const outcome = await executeJob(job);
      if (outcome.success) {
        await markJobCompleted(job.id);
      } else {
        await markJobFailed(job.id, job.attempts, job.maxAttempts, outcome.error || "Błąd wykonania zadania");
      }
      results.push({ jobId: job.id, type: job.type, ...outcome });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await markJobFailed(job.id, job.attempts, job.maxAttempts, message);
      results.push({ jobId: job.id, type: job.type, success: false, error: message });
    }

    processed++;
  }

  return { workerId, processed, results };
}
