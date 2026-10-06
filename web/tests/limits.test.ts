import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  consume,
  getTenantLimit,
  setTenantLimit,
  getTenantUsage,
  LimitExceededError,
  getCurrentPeriodKey,
} from "@/lib/limits";
import { db, tenantLimits, usageCounters } from "@/lib/db";
import { and, eq } from "drizzle-orm";

describe("Tenant Quotas & Usage Limits (Step 1.5)", () => {
  const testTenantId = 1;
  const testMetric = "test_custom_metric";
  const testPeriod = "test-period-2026-10";

  it("calculates current period key correctly in YYYY-MM format", () => {
    const key = getCurrentPeriodKey(new Date("2026-10-15T12:00:00Z"));
    assert.equal(key, "2026-10");
  });

  it("allows consumption when metric is unlimited", async () => {
    // Clean up test data
    await db
      .delete(usageCounters)
      .where(and(eq(usageCounters.tenantId, testTenantId), eq(usageCounters.metric, testMetric)));
    await db
      .delete(tenantLimits)
      .where(and(eq(tenantLimits.tenantId, testTenantId), eq(tenantLimits.metric, testMetric)));

    const res1 = await consume(testTenantId, testMetric, 5, testPeriod);
    assert.equal(res1.current, 5);
    assert.equal(res1.limit, null);

    const res2 = await consume(testTenantId, testMetric, 3, testPeriod);
    assert.equal(res2.current, 8);
    assert.equal(res2.limit, null);

    const currentUsage = await getTenantUsage(testTenantId, testMetric, testPeriod);
    assert.equal(currentUsage, 8);
  });

  it("enforces tenant limit and throws LimitExceededError when quota exceeded", async () => {
    // Set hard limit of 10 for testMetric
    await setTenantLimit(testTenantId, testMetric, 10);
    const limit = await getTenantLimit(testTenantId, testMetric);
    assert.equal(limit, 10);

    // Current usage is 8, consuming 2 should succeed (reaches 10)
    const res = await consume(testTenantId, testMetric, 2, testPeriod);
    assert.equal(res.current, 10);
    assert.equal(res.limit, 10);

    // Consuming 1 more must fail and throw LimitExceededError
    await assert.rejects(
      async () => {
        await consume(testTenantId, testMetric, 1, testPeriod);
      },
      (err: unknown) => {
        assert.ok(err instanceof LimitExceededError);
        assert.equal(err.metric, testMetric);
        assert.equal(err.current, 10);
        assert.equal(err.limit, 10);
        return true;
      },
      "Must reject consumption when exceeding configured limit"
    );

    // Verify counter was NOT incremented on failed consume
    const usageAfterReject = await getTenantUsage(testTenantId, testMetric, testPeriod);
    assert.equal(usageAfterReject, 10);

    // Cleanup
    await db
      .delete(usageCounters)
      .where(and(eq(usageCounters.tenantId, testTenantId), eq(usageCounters.metric, testMetric)));
    await db
      .delete(tenantLimits)
      .where(and(eq(tenantLimits.tenantId, testTenantId), eq(tenantLimits.metric, testMetric)));
  });
});
