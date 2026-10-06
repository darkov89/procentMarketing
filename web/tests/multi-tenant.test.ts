import { describe, it } from "node:test";
import assert from "node:assert";
import { tenants, tenantMembers, leads, offers, messages, leadTasks, leadDeals } from "../src/lib/db/schema";

describe("Multi-Tenant & Outreach History Invariants", () => {
  it("verifies multi-tenant schema tables and columns are defined", () => {
    assert.ok(tenants.id);
    assert.ok(tenants.slug);
    assert.ok(tenants.name);
    assert.ok(tenants.plan);
    assert.ok(tenants.isActive);
    assert.ok(tenants.enabledModules);

    assert.ok(tenantMembers.id);
    assert.ok(tenantMembers.tenantId);
    assert.ok(tenantMembers.userId);
    assert.ok(tenantMembers.role);

    assert.ok(leads.tenantId);
    assert.ok(leads.pkeEmailStatus);
    assert.ok(leads.pkePhoneStatus);
    assert.ok(leads.csrPriority);
    assert.ok(leads.evidenceUrl);
    assert.ok(offers.tenantId);
    assert.ok(messages.tenantId);
    assert.ok(offers.viewCount);
    assert.ok(offers.lastViewedAt);

    assert.ok(leadTasks.id);
    assert.ok(leadTasks.tenantId);
    assert.ok(leadTasks.leadId);
    assert.ok(leadTasks.dueAt);
    assert.ok(leadTasks.taskType);

    assert.ok(leadDeals.id);
    assert.ok(leadDeals.tenantId);
    assert.ok(leadDeals.leadId);
    assert.ok(leadDeals.declaredAmount);
    assert.ok(leadDeals.paidAmount);
  });

  it("calculates tenant outreach KPIs correctly from history array", () => {
    const mockHistory = [
      {
        leadId: 1,
        totalSent: 2,
        status: "replied_interested",
        offer: { viewCount: 3 },
      },
      {
        leadId: 2,
        totalSent: 1,
        status: "sent",
        offer: { viewCount: 1 },
      },
      {
        leadId: 3,
        totalSent: 1,
        status: "sent",
        offer: { viewCount: 0 },
      },
      {
        leadId: 4,
        totalSent: 3,
        status: "meeting_booked",
        offer: { viewCount: 5 },
      },
    ];

    const totalOutreached = mockHistory.length;
    const totalMessagesSent = mockHistory.reduce((sum, h) => sum + h.totalSent, 0);
    const leadsWithOfferViews = mockHistory.filter((h) => (h.offer?.viewCount || 0) > 0).length;
    const totalOfferViews = mockHistory.reduce((sum, h) => sum + (h.offer?.viewCount || 0), 0);
    const repliesCount = mockHistory.filter((h) =>
      ["replied_interested", "meeting_booked"].includes(h.status)
    ).length;
    const meetingsBookedCount = mockHistory.filter((h) => h.status === "meeting_booked").length;

    assert.strictEqual(totalOutreached, 4);
    assert.strictEqual(totalMessagesSent, 7);
    assert.strictEqual(leadsWithOfferViews, 3);
    assert.strictEqual(totalOfferViews, 9);
    assert.strictEqual(repliesCount, 2);
    assert.strictEqual(meetingsBookedCount, 1);

    const offerViewRate = Math.round((leadsWithOfferViews / totalOutreached) * 100);
    const replyRate = Math.round((repliesCount / totalOutreached) * 100);
    const meetingRate = Math.round((meetingsBookedCount / totalOutreached) * 100);

    assert.strictEqual(offerViewRate, 75); // 3 of 4
    assert.strictEqual(replyRate, 50);      // 2 of 4
    assert.strictEqual(meetingRate, 25);    // 1 of 4
  });
});
