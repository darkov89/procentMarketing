import { db, statsDaily, withSystemContext } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";

export interface RollupMetricsInput {
  tenantId: number;
  campaignId?: number | null;
  date: string; // YYYY-MM-DD
  metrics: Record<string, number>;
}

/**
 * Atomically records or increments daily rollup metrics in stats_daily table.
 */
export async function upsertDailyRollupMetrics(input: RollupMetricsInput): Promise<void> {
  const { tenantId, campaignId = null, date, metrics } = input;

  await withSystemContext(async () => {
    for (const [metric, value] of Object.entries(metrics)) {
      await db
        .insert(statsDaily)
        .values({
          tenantId,
          campaignId: campaignId || null,
          date,
          metric,
          value,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [statsDaily.tenantId, statsDaily.campaignId, statsDaily.date, statsDaily.metric],
          set: {
            value,
            updatedAt: new Date(),
          },
        });
    }
  });
}

/**
 * Aggregates rollup metrics for a given tenant, optional campaign and date range.
 */
export async function getAggregatedRollupMetrics(params: {
  tenantId: number;
  campaignId?: number | null;
  startDate?: string;
  endDate?: string;
}): Promise<Record<string, number>> {
  const { tenantId, campaignId, startDate, endDate } = params;

  return await withSystemContext(async () => {
    const conditions = [eq(statsDaily.tenantId, tenantId)];
    if (campaignId !== undefined && campaignId !== null) {
      conditions.push(eq(statsDaily.campaignId, campaignId));
    }
    if (startDate) {
      conditions.push(sql`${statsDaily.date} >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`${statsDaily.date} <= ${endDate}::date`);
    }

    const rows = await db
      .select({
        metric: statsDaily.metric,
        totalValue: sql<number>`SUM(${statsDaily.value})::bigint`,
      })
      .from(statsDaily)
      .where(and(...conditions))
      .groupBy(statsDaily.metric);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.metric] = Number(row.totalValue || 0);
    }
    return result;
  });
}
