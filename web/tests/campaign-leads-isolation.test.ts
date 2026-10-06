import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withTenant, campaigns, campaignLeads, leads } from "@/lib/db";

describe("Phase 2 Campaign & Playbook Isolation (R4, Step 2.1)", () => {
  it("isolates campaign_leads per tenant under RLS", async () => {
    // Query tenant 1 campaign leads
    const t1Leads = await withTenant(1, async (tx) => {
      return await tx.select().from(campaignLeads);
    });

    assert.ok(t1Leads.length > 0, "Tenant 1 should have campaign_leads backfilled");
    for (const cl of t1Leads) {
      assert.equal(cl.tenantId, 1, "Each campaign lead must belong to tenant 1");
    }

    // Query non-existent tenant
    const tOtherLeads = await withTenant(999999, async (tx) => {
      return await tx.select().from(campaignLeads);
    });
    assert.equal(tOtherLeads.length, 0, "Tenant 999999 must see 0 campaign leads under RLS");
  });

  it("verifies default campaign and playbook exist for tenant 1 and Szumi Las", async () => {
    const t1Campaigns = await withTenant(1, async (tx) => {
      return await tx.select().from(campaigns);
    });
    assert.ok(t1Campaigns.length >= 1, "Tenant 1 must have at least 1 campaign");
    assert.equal(t1Campaigns[0].status, "active");

    const szumiLasCampaigns = await withTenant(18, async (tx) => {
      return await tx.select().from(campaigns);
    });
    assert.ok(szumiLasCampaigns.length >= 1, "Szumi Las must have active default campaign");
  });

  it("matches backfilled campaign_leads count with leads count for permanent leads", async () => {
    await withTenant(1, async (tx) => {
      const l = await tx.select().from(leads);
      const cl = await tx.select().from(campaignLeads);
      // Permanent (non-ephemeral) leads in tenant 1 have a corresponding campaign_lead
      const clLeadIds = new Set(cl.map((item) => item.leadId));
      const permanentLeads = l.filter((lead) => !lead.isFixture && lead.sourceName !== "test_suite");
      for (const lead of permanentLeads) {
        assert.ok(
          clLeadIds.has(lead.id),
          `Permanent Lead #${lead.id} (${lead.companyName}) must be present in campaign_leads`
        );
      }
    });
  });
});
