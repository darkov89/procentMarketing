import { jobQueue } from "./queue";
import { jobRegistry } from "./registry";
import crypto from "crypto";

export interface TickOptions {
  workerId?: string;
  maxJobs?: number;
  timeLimitMs?: number;
}

export interface TickSummary {
  workerId: string;
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
  stoppedReason: "no_more_jobs" | "time_limit" | "job_limit";
  durationMs: number;
}

/**
 * Executes a single queue worker tick.
 * Designed for serverless runtimes (respects time limits, heartbeat, and graceful shutdown).
 */
export async function runQueueTick(options: TickOptions = {}): Promise<TickSummary> {
  const workerId = options.workerId || `worker_${crypto.randomBytes(4).toString("hex")}`;
  const maxJobs = options.maxJobs || 20;
  const timeLimitMs = options.timeLimitMs || 50000; // 50s default for serverless maxDuration 60s
  const startTime = Date.now();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;
  let stoppedReason: "no_more_jobs" | "time_limit" | "job_limit" = "no_more_jobs";

  while (processed < maxJobs) {
    // Check if time limit approaching
    if (Date.now() - startTime > timeLimitMs) {
      stoppedReason = "time_limit";
      break;
    }

    const job = await jobQueue.claimNextJob({ workerId });
    if (!job) {
      stoppedReason = "no_more_jobs";
      break;
    }

    processed++;

    const handler = jobRegistry.getHandler(job.type);
    if (!handler) {
      const err = `Brak zarejestrowanego handlera dla typu zadania: '${job.type}'`;
      const failRes = await jobQueue.fail(job.id, err);
      failed++;
      if (failRes.deadLetter) deadLettered++;
      continue;
    }

    try {
      // Execute handler
      const result = await handler(job);
      await jobQueue.complete(job.id, result || undefined);
      succeeded++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failRes = await jobQueue.fail(job.id, errorMsg);
      failed++;
      if (failRes.deadLetter) deadLettered++;
    }
  }

  if (processed >= maxJobs && stoppedReason === "no_more_jobs") {
    stoppedReason = "job_limit";
  }

  return {
    workerId,
    processed,
    succeeded,
    failed,
    deadLettered,
    stoppedReason,
    durationMs: Date.now() - startTime,
  };
}
