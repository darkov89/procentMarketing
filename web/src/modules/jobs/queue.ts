import { db, jobs, withSystemContext } from "@/lib/db";
import { eq, sql, and } from "drizzle-orm";

export type SystemJobType =
  | "search_cell"
  | "enrich_lead"
  | "research_lead"
  | "qualify_lead"
  | "advance_sequence"
  | "send_message"
  | "poll_inbox"
  | "refresh_place"
  | "rollup_stats"
  | "cleanup"
  | "audit_lead"
  | "generate_offer"
  | "test_job";

export interface EnqueueJobParams {
  tenantId: number;
  campaignId?: number | null;
  type: SystemJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

export interface ClaimJobOptions {
  workerId: string;
  heartbeatTimeoutSeconds?: number;
  maxActivePerTenant?: number;
}

export interface JobRecord {
  id: number;
  tenantId: number;
  campaignId: number | null;
  type: string;
  idempotencyKey: string | null;
  priority: number;
  payload: unknown;
  result: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  heartbeatAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  runAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobQueue {
  enqueue(params: EnqueueJobParams): Promise<{ job: JobRecord; isDuplicate: boolean }>;
  claimNextJob(options: ClaimJobOptions): Promise<JobRecord | null>;
  heartbeat(jobId: number, workerId: string): Promise<boolean>;
  complete(jobId: number, result?: Record<string, unknown>): Promise<void>;
  fail(jobId: number, error: string): Promise<{ retried: boolean; deadLetter: boolean }>;
}

export class PostgresJobQueue implements JobQueue {
  /**
   * Idempotently enqueues a job.
   * If an idempotencyKey is provided and a job already exists for the tenant, returns existing job.
   */
  async enqueue(params: EnqueueJobParams): Promise<{ job: JobRecord; isDuplicate: boolean }> {
    if (!params.tenantId) {
      throw new Error("tenantId is required to enqueue a job");
    }

    if (params.idempotencyKey) {
      // Check for existing job
      const existing = await withSystemContext(async () => {
        return await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.tenantId, params.tenantId), eq(jobs.idempotencyKey, params.idempotencyKey!)))
          .limit(1);
      });

      if (existing.length > 0) {
        return { job: existing[0] as JobRecord, isDuplicate: true };
      }
    }

    const inserted = await withSystemContext(async () => {
      const rows = await db
        .insert(jobs)
        .values({
          tenantId: params.tenantId,
          campaignId: params.campaignId || null,
          type: params.type,
          idempotencyKey: params.idempotencyKey || null,
          priority: params.priority !== undefined ? params.priority : 50,
          payload: params.payload,
          status: "pending",
          maxAttempts: params.maxAttempts || 3,
          runAt: params.runAt || new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();

      if (rows.length > 0) {
        return rows[0];
      }

      // If onConflict hit concurrently
      if (params.idempotencyKey) {
        const [conflictRow] = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.tenantId, params.tenantId), eq(jobs.idempotencyKey, params.idempotencyKey)))
          .limit(1);
        return conflictRow;
      }

      throw new Error("Failed to insert job into queue");
    });

    return { job: inserted as JobRecord, isDuplicate: false };
  }

  /**
   * Claims the next runnable job using PostgreSQL FOR UPDATE SKIP LOCKED.
   * Enforces:
   * 1. Fair share across tenants (round-robin / max active jobs per tenant limit).
   * 2. Recovers hung jobs whose heartbeat expired (heartbeat_at older than threshold).
   * 3. Respects job priority (ascending: smaller number = higher priority).
   */
  async claimNextJob(options: ClaimJobOptions): Promise<JobRecord | null> {
    const workerId = options.workerId;
    const heartbeatTimeoutSeconds = options.heartbeatTimeoutSeconds || 300; // 5 min default
    const maxActivePerTenant = options.maxActivePerTenant || 5;

    return await withSystemContext(async () => {
      const claimedRows = await db
        .update(jobs)
        .set({
          status: "running",
          lockedAt: new Date(),
          heartbeatAt: new Date(),
          lockedBy: workerId,
          attempts: sql`${jobs.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(
          sql`${jobs.id} = (
            WITH tenant_running_counts AS (
              SELECT tenant_id, count(*)::int AS running_count
              FROM jobs
              WHERE status = 'running'
                AND (heartbeat_at IS NULL OR heartbeat_at >= NOW() - (${heartbeatTimeoutSeconds} || ' seconds')::interval)
              GROUP BY tenant_id
            ),
            candidate_jobs AS (
              SELECT j.id
              FROM jobs j
              LEFT JOIN tenant_running_counts trc ON trc.tenant_id = j.tenant_id
              WHERE (
                j.status = 'pending'
                OR (j.status = 'running' AND j.heartbeat_at < NOW() - (${heartbeatTimeoutSeconds} || ' seconds')::interval)
              )
              AND j.run_at <= NOW()
              AND COALESCE(trc.running_count, 0) < ${maxActivePerTenant}
              ORDER BY j.priority ASC, j.run_at ASC, j.id ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            )
            SELECT id FROM candidate_jobs
          )`
        )
        .returning();

      return (claimedRows[0] as JobRecord) || null;
    });
  }

  /**
   * Refreshes the heartbeat timestamp of a currently running job to prevent takeover.
   */
  async heartbeat(jobId: number, workerId: string): Promise<boolean> {
    return await withSystemContext(async () => {
      const updated = await db
        .update(jobs)
        .set({
          heartbeatAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, "running"), eq(jobs.lockedBy, workerId)))
        .returning({ id: jobs.id });

      return updated.length > 0;
    });
  }

  /**
   * Marks job completed and stores the execution result.
   */
  async complete(jobId: number, result?: Record<string, unknown>): Promise<void> {
    await withSystemContext(async () => {
      await db
        .update(jobs)
        .set({
          status: "completed",
          result: result || null,
          lockedAt: null,
          lockedBy: null,
          heartbeatAt: null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));
    });
  }

  /**
   * Marks job failed, re-scheduling with backoff if attempts < maxAttempts,
   * or moving to dead_letter if maxAttempts reached.
   */
  async fail(jobId: number, error: string): Promise<{ retried: boolean; deadLetter: boolean }> {
    return await withSystemContext(async () => {
      const [current] = await db
        .select({ attempts: jobs.attempts, maxAttempts: jobs.maxAttempts })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!current) {
        return { retried: false, deadLetter: false };
      }

      const canRetry = current.attempts < current.maxAttempts;

      if (canRetry) {
        // Exponential backoff: 30s * 2^(attempts-1)
        const delaySeconds = Math.min(30 * Math.pow(2, Math.max(0, current.attempts - 1)), 3600);
        const nextRunAt = new Date(Date.now() + delaySeconds * 1000);

        await db
          .update(jobs)
          .set({
            status: "pending",
            lastError: error,
            runAt: nextRunAt,
            lockedAt: null,
            lockedBy: null,
            heartbeatAt: null,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobId));

        return { retried: true, deadLetter: false };
      } else {
        // Exceeded maxAttempts -> Dead-Letter
        await db
          .update(jobs)
          .set({
            status: "dead_letter",
            lastError: `Exhausted ${current.attempts}/${current.maxAttempts} attempts: ${error}`,
            lockedAt: null,
            lockedBy: null,
            heartbeatAt: null,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobId));

        return { retried: false, deadLetter: true };
      }
    });
  }
}

export const jobQueue = new PostgresJobQueue();
