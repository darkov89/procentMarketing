import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jobQueue } from "../src/modules/jobs/queue";
import { jobRegistry } from "../src/modules/jobs/registry";
import { runQueueTick } from "../src/modules/jobs/worker";
import { db, jobs, withSystemContext } from "../src/lib/db";
import { eq } from "drizzle-orm";

describe("Phase 6 Jobs Queue, Fair Share & Worker Invariants", () => {
  const TENANT_A = 1;

  it("enforces idempotent enqueue: exact same idempotencyKey returns existing job without duplicates", async () => {
    const idempKey = `idemp_test_${Date.now()}`;

    const res1 = await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "cleanup",
      idempotencyKey: idempKey,
      payload: { test: 1 },
      priority: 10,
    });

    assert.equal(res1.isDuplicate, false);
    assert.equal(res1.job.status, "pending");

    const res2 = await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "cleanup",
      idempotencyKey: idempKey,
      payload: { test: 2 },
    });

    assert.equal(res2.isDuplicate, true);
    assert.equal(res2.job.id, res1.job.id, "Duplicate enqueue must return original job id");
  });

  it("claims jobs atomically with FOR UPDATE SKIP LOCKED without duplicate claims", async () => {
    const suffix = Date.now();
    await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "cleanup",
      idempotencyKey: `claim_1_${suffix}`,
      payload: { index: 1 },
      priority: 20,
    });

    await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "cleanup",
      idempotencyKey: `claim_2_${suffix}`,
      payload: { index: 2 },
      priority: 30,
    });

    // Concurrent claim from 2 different workers
    const [claimedByWorker1, claimedByWorker2] = await Promise.all([
      jobQueue.claimNextJob({ workerId: "worker_alpha" }),
      jobQueue.claimNextJob({ workerId: "worker_beta" }),
    ]);

    assert.ok(claimedByWorker1, "Worker 1 must claim a job");
    assert.ok(claimedByWorker2, "Worker 2 must claim a job");
    assert.notEqual(
      claimedByWorker1?.id,
      claimedByWorker2?.id,
      "Two workers must NEVER claim the exact same job concurrently!"
    );

    // Clean up
    if (claimedByWorker1) await jobQueue.complete(claimedByWorker1.id);
    if (claimedByWorker2) await jobQueue.complete(claimedByWorker2.id);
  });

  it("recovers hung jobs when heartbeat expires", async () => {
    const suffix = Date.now();
    const { job } = await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "cleanup",
      idempotencyKey: `hung_job_${suffix}`,
      payload: { hung: true },
      priority: 1, // High priority to be claimed first!
    });

    // Manually simulate a crashed worker by setting status = 'running' with an expired heartbeat
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await withSystemContext(async () => {
      await db
        .update(jobs)
        .set({
          status: "running",
          lockedBy: "dead_worker_999",
          heartbeatAt: tenMinutesAgo,
          lockedAt: tenMinutesAgo,
        })
        .where(eq(jobs.id, job.id));
    });

    // Next worker should reclaim this hung job
    const recovered = await jobQueue.claimNextJob({
      workerId: "rescuer_worker",
      heartbeatTimeoutSeconds: 60, // 1 min threshold
    });

    assert.ok(recovered, "Must reclaim expired hung job");
    assert.equal(recovered?.id, job.id);
    assert.equal(recovered?.lockedBy, "rescuer_worker");

    await jobQueue.complete(recovered.id);
  });

  it("transitions to dead-letter after exhausting maxAttempts", async () => {
    const suffix = Date.now();
    const { job } = await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "cleanup",
      idempotencyKey: `dead_letter_${suffix}`,
      payload: { fail: true },
      maxAttempts: 2,
    });

    // Attempt 1: Fail -> status pending with backoff
    const fail1 = await jobQueue.fail(job.id, "First network failure");
    assert.equal(fail1.retried, true);
    assert.equal(fail1.deadLetter, false);

    // Simulate 2nd attempt claim
    await withSystemContext(async () => {
      await db.update(jobs).set({ attempts: 2, status: "running" }).where(eq(jobs.id, job.id));
    });

    // Attempt 2: Fail -> status dead_letter
    const fail2 = await jobQueue.fail(job.id, "Second fatal failure");
    assert.equal(fail2.retried, false);
    assert.equal(fail2.deadLetter, true);

    const [finalJob] = await withSystemContext(async () => {
      return await db.select().from(jobs).where(eq(jobs.id, job.id));
    });

    assert.equal(finalJob.status, "dead_letter");
    assert.ok(finalJob.lastError?.includes("Exhausted 2/2 attempts"));
  });

  it("executes queue tick and dispatches registered handlers successfully", async () => {
    let customHandlerCalled = false;
    jobRegistry.register("test_job", async (_job) => {
      customHandlerCalled = true;
      return { success: true };
    });

    const suffix = Date.now();
    await jobQueue.enqueue({
      tenantId: TENANT_A,
      type: "test_job",
      idempotencyKey: `tick_${suffix}`,
      payload: { timestamp: suffix },
      priority: 1,
    });

    const summary = await runQueueTick({
      maxJobs: 5,
      timeLimitMs: 5000,
    });

    assert.ok(summary.processed >= 1, "Must process at least 1 job");
    assert.ok(summary.succeeded >= 1, "Must succeed at least 1 job");
    assert.equal(customHandlerCalled, true, "Registered job handler must have been executed");
  });
});
