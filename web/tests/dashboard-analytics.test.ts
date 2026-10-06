import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  upsertDailyRollupMetrics,
  getAggregatedRollupMetrics,
} from "../src/modules/analytics/rollup-engine";
import {
  calculateDashboardMetrics,
} from "../src/modules/analytics/dashboard-metrics";
import { eq } from "drizzle-orm";
import {
  leads,
  campaigns,
  campaignLeads,
  outcomes,
  withTenant,
} from "../src/lib/db";

describe("Phase 7 Dashboard & Analytics Invariants", () => {
  const TEST_TENANT_ID = 1;

  describe("Daily Stats Rollup Engine (stats_daily)", () => {
    it("upserts daily metrics and aggregates correctly over date range", async () => {
      const today = "2026-03-20";

      // 1. Upsert initial metrics
      await upsertDailyRollupMetrics({
        tenantId: TEST_TENANT_ID,
        date: today,
        metrics: {
          discovered: 25,
          sent: 10,
          replies: 2,
        },
      });

      // 2. Query aggregated metrics
      const aggregated1 = await getAggregatedRollupMetrics({
        tenantId: TEST_TENANT_ID,
        startDate: today,
        endDate: today,
      });

      assert.equal(aggregated1["discovered"], 25);
      assert.equal(aggregated1["sent"], 10);
      assert.equal(aggregated1["replies"], 2);

      // 3. Update/Overwrite daily metrics for the same date (idempotent daily rollup)
      await upsertDailyRollupMetrics({
        tenantId: TEST_TENANT_ID,
        date: today,
        metrics: {
          discovered: 30,
          sent: 12,
          replies: 3,
        },
      });

      const aggregated2 = await getAggregatedRollupMetrics({
        tenantId: TEST_TENANT_ID,
        startDate: today,
        endDate: today,
      });

      assert.equal(aggregated2["discovered"], 30);
      assert.equal(aggregated2["sent"], 12);
      assert.equal(aggregated2["replies"], 3);
    });
  });

  describe("Financial Outcomes Invariant (Confirmed Payments Only)", () => {
    it("pledged amount NEVER counts as paid until payment is confirmed (Zero Guessing / Invariant 5)", async () => {
      const suffix = Date.now();

      // Create lead and campaign lead
      const lead = await withTenant(TEST_TENANT_ID, async (tx) => {
        const [l] = await tx
          .insert(leads)
          .values({
            tenantId: TEST_TENANT_ID,
            companyName: `Firma Pledges ${suffix}`,
            status: "in_sequence",
            sourceName: "test_suite",
          })
          .returning();
        return l;
      });

      const cLead = await withTenant(TEST_TENANT_ID, async (tx) => {
        const [cl] = await tx
          .insert(campaignLeads)
          .values({
            tenantId: TEST_TENANT_ID,
            campaignId: 1,
            leadId: lead.id,
            state: "pledged",
          })
          .returning();
        return cl;
      });

      const initialMetrics = await calculateDashboardMetrics({ tenantId: TEST_TENANT_ID });
      const initialPaidCount = initialMetrics.financials.paidCount;
      const initialPaidAmount = initialMetrics.financials.totalPaidMinor;

      // Insert unconfirmed outcome (pledged = 10 000 zł, but paymentConfirmedAt = NULL)
      await withTenant(TEST_TENANT_ID, async (tx) => {
        await tx.insert(outcomes).values({
          tenantId: TEST_TENANT_ID,
          campaignLeadId: cLead.id,
          pledgedMinor: 1000000, // 10 000 zł
          paidMinor: 1000000,
          paymentConfirmedAt: null, // NOT CONFIRMED YET!
        });
      });

      const metricsBefore = await calculateDashboardMetrics({ tenantId: TEST_TENANT_ID });
      assert.ok(metricsBefore.financials.totalPledgedMinor >= 1000000);
      // Confirmed paid must strictly exclude unconfirmed outcome!
      assert.equal(
        metricsBefore.financials.paidCount,
        initialPaidCount,
        "Unconfirmed payment must NOT count in paidCount"
      );
      assert.equal(
        metricsBefore.financials.totalPaidMinor,
        initialPaidAmount,
        "Unconfirmed payment must NOT count in totalPaidMinor"
      );

      // Now simulate payment confirmation
      await withTenant(TEST_TENANT_ID, async (tx) => {
        await tx
          .update(outcomes)
          .set({ paymentConfirmedAt: new Date() })
          .where(eq(outcomes.campaignLeadId, cLead.id));
      });

      const metricsAfter = await calculateDashboardMetrics({ tenantId: TEST_TENANT_ID });
      assert.equal(
        metricsAfter.financials.paidCount,
        initialPaidCount + 1,
        "Confirmed payment must increment paidCount by exactly 1"
      );
      assert.equal(
        metricsAfter.financials.totalPaidMinor,
        initialPaidAmount + 1000000,
        "Confirmed payment must add paidMinor to totalPaidMinor"
      );
    });
  });

  describe("Playbook Module Visibility in Dashboard", () => {
    it("adapts dashboard metrics visibility based on campaign playbook modules", async () => {
      // 1. Create a campaign with Foundation mode (playbookVersion 10: sponsorship_fundraising)
      const [campFoundation] = await withTenant(TEST_TENANT_ID, async (tx) => {
        return await tx
          .insert(campaigns)
          .values({
            tenantId: TEST_TENANT_ID,
            name: `Kampania Fundacji ${Date.now()}`,
            playbookVersionId: 10, // preset: sponsorship_fundraising (modules.offers = false)
            status: "active",
          })
          .returning();
      });

      const metricsFoundation = await calculateDashboardMetrics({
        tenantId: TEST_TENANT_ID,
        campaignId: campFoundation.id,
      });

      assert.equal(metricsFoundation.modulesEnabled.offers, false, "Foundation campaign must have offers disabled");
      assert.equal(metricsFoundation.mailQueue.totalOfferViews, 0, "OfferViews must be 0 when offers module is disabled");

      // 2. Create campaign with Agency Sales mode (playbookVersion 1: agency_sales)
      const [campAgency] = await withTenant(TEST_TENANT_ID, async (tx) => {
        return await tx
          .insert(campaigns)
          .values({
            tenantId: TEST_TENANT_ID,
            name: `Kampania Agencji ${Date.now()}`,
            playbookVersionId: 1, // preset: agency_sales (modules.offers = true)
            status: "active",
          })
          .returning();
      });

      const metricsAgency = await calculateDashboardMetrics({
        tenantId: TEST_TENANT_ID,
        campaignId: campAgency.id,
      });

      assert.equal(metricsAgency.modulesEnabled.offers, true, "Agency campaign must have offers enabled");
    });
  });
});
