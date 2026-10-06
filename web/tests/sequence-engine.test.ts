import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  campaigns,
  campaignLeads,
  sequenceRuns,
  tasks,
  messages,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { advanceLeadSequence } from "@/modules/campaigns/sequence-engine";

describe("Sequence Engine & Brief Flow Integration (Step 2.3)", () => {
  it("enforces brief flow: sends email, waits, and blocks phone task without permission", async () => {
    // We test with Szumi Las campaign (id 18)
    const [szumiLasCampaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.tenantId, 18))
      .limit(1);

    assert.ok(szumiLasCampaign, "Szumi Las campaign must exist");

    const [testCampaignLead] = await db
      .select({ id: campaignLeads.id, leadId: campaignLeads.leadId })
      .from(campaignLeads)
      .where(eq(campaignLeads.campaignId, szumiLasCampaign.id))
      .limit(1);

    assert.ok(testCampaignLead, "Test campaign lead must exist");

    // Create a fresh sequence run for testing
    const [seqRun] = await db
      .insert(sequenceRuns)
      .values({
        tenantId: 18,
        campaignLeadId: testCampaignLead.id,
        stepIndex: 0,
        status: "active",
        nextRunAt: new Date(),
      })
      .returning();

    // Step 0: send_email
    const step0Res = await advanceLeadSequence(seqRun.id);
    assert.equal(step0Res.success, true);
    assert.equal(step0Res.actionTaken, "email_queued");

    // Verify stepIndex advanced to 1 (which is wait 2 business days)
    const [runAfterStep0] = await db
      .select()
      .from(sequenceRuns)
      .where(eq(sequenceRuns.id, seqRun.id));

    assert.equal(runAfterStep0.stepIndex, 1);
    assert.ok(runAfterStep0.nextRunAt! > new Date(), "nextRunAt must be in the future after wait step");

    // Advance to step 2 (call1, requiring phone permission)
    await db
      .update(sequenceRuns)
      .set({ stepIndex: 2, nextRunAt: new Date() })
      .where(eq(sequenceRuns.id, seqRun.id));

    // Case A: No phone permission in channel_permissions (status is not 'yes')
    const step2NoPermRes = await advanceLeadSequence(seqRun.id);
    assert.equal(step2NoPermRes.success, true);
    assert.equal(step2NoPermRes.actionTaken, "task_created");

    // Verify a verify_channel task was created instead of phone_call
    const [createdTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.campaignLeadId, testCampaignLead.id), eq(tasks.tenantId, 18)))
      .orderBy(eq(tasks.id, tasks.id));

    assert.ok(createdTask);
    assert.equal(createdTask.type, "verify_channel", "Must create verify_channel task when phone permission != yes");

    // Cleanup test data
    await db.delete(tasks).where(eq(tasks.campaignLeadId, testCampaignLead.id));
    await db.delete(sequenceRuns).where(eq(sequenceRuns.id, seqRun.id));
    await db
      .delete(messages)
      .where(and(eq(messages.leadId, testCampaignLead.leadId), eq(messages.tenantId, 18)));
  });
});
