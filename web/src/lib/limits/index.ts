import { tenantLimits, usageCounters, withTenant } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";

export class LimitExceededError extends Error {
  metric: string;
  current: number;
  limit: number;

  constructor(metric: string, current: number, limit: number) {
    super(
      `Przekroczono limit tenanta dla metryki "${metric}": aktualne zużycie ${current}, limit ${limit}.`
    );
    this.name = "LimitExceededError";
    this.metric = metric;
    this.current = current;
    this.limit = limit;
  }
}

export type SupportedMetric = "google_requests" | "emails_sent" | "llm_tokens" | "leads";

/**
 * Returns current period key (e.g. YYYY-MM for monthly counters)
 */
export function getCurrentPeriodKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Gets configured limit for tenant metric.
 * If not explicitly set in tenant_limits, returns null (unlimited).
 */
export async function getTenantLimit(
  tenantId: number,
  metric: SupportedMetric | string
): Promise<number | null> {
  const rows = await withTenant(tenantId, async (tx) => {
    return await tx
      .select({ limitValue: tenantLimits.limitValue })
      .from(tenantLimits)
      .where(and(eq(tenantLimits.tenantId, tenantId), eq(tenantLimits.metric, metric)))
      .limit(1);
  });

  return rows.length > 0 ? rows[0].limitValue : null;
}

/**
 * Sets or updates tenant limit for a given metric.
 */
export async function setTenantLimit(
  tenantId: number,
  metric: SupportedMetric | string,
  limitValue: number
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const existing = await tx
      .select({ id: tenantLimits.id })
      .from(tenantLimits)
      .where(and(eq(tenantLimits.tenantId, tenantId), eq(tenantLimits.metric, metric)))
      .limit(1);

    if (existing.length > 0) {
      await tx
        .update(tenantLimits)
        .set({ limitValue, updatedAt: new Date() })
        .where(eq(tenantLimits.id, existing[0].id));
    } else {
      await tx.insert(tenantLimits).values({
        tenantId,
        metric,
        limitValue,
        updatedAt: new Date(),
      });
    }
  });
}

/**
 * Gets current usage for tenant metric in given period.
 */
export async function getTenantUsage(
  tenantId: number,
  metric: SupportedMetric | string,
  period = getCurrentPeriodKey()
): Promise<number> {
  const rows = await withTenant(tenantId, async (tx) => {
    return await tx
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.tenantId, tenantId),
          eq(usageCounters.metric, metric),
          eq(usageCounters.period, period)
        )
      )
      .limit(1);
  });

  return rows.length > 0 ? rows[0].count : 0;
}

/**
 * Atomically checks limit and consumes `amount` units of `metric`.
 * If consumption would exceed configured limit, throws LimitExceededError and does not increment.
 */
export async function consume(
  tenantId: number,
  metric: SupportedMetric | string,
  amount = 1,
  period = getCurrentPeriodKey()
): Promise<{ current: number; limit: number | null }> {
  if (amount <= 0) {
    throw new Error(`Consumption amount must be positive, received: ${amount}`);
  }

  const limit = await getTenantLimit(tenantId, metric);

  // If a limit is configured, perform atomic check-and-increment inside transaction
  if (limit !== null) {
    return await withTenant(tenantId, async (tx) => {
      // Upsert row if not exists
      await tx
        .insert(usageCounters)
        .values({
          tenantId,
          metric,
          period,
          count: 0,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      // Lock row FOR UPDATE and check value
      const [currentRecord] = await tx
        .select({ count: usageCounters.count })
        .from(usageCounters)
        .where(
          and(
            eq(usageCounters.tenantId, tenantId),
            eq(usageCounters.metric, metric),
            eq(usageCounters.period, period)
          )
        )
        .for("update");

      const currentCount = currentRecord?.count || 0;
      if (currentCount + amount > limit) {
        throw new LimitExceededError(metric, currentCount, limit);
      }

      const [updated] = await tx
        .update(usageCounters)
        .set({
          count: sql`${usageCounters.count} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usageCounters.tenantId, tenantId),
            eq(usageCounters.metric, metric),
            eq(usageCounters.period, period)
          )
        )
        .returning({ count: usageCounters.count });

      return { current: updated.count, limit };
    });
  }

  // If unlimited, perform upsert increment under withTenant
  const res = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(usageCounters)
      .values({
        tenantId,
        metric,
        period,
        count: amount,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [usageCounters.tenantId, usageCounters.metric, usageCounters.period],
        set: {
          count: sql`${usageCounters.count} + ${amount}`,
          updatedAt: new Date(),
        },
      })
      .returning({ count: usageCounters.count });
    return row;
  });

  return { current: res.count, limit: null };
}
