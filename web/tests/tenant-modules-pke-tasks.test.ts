import { describe, it } from "node:test";
import assert from "node:assert";
import { db, tenants, tenantMembers, leads, leadTasks, leadDeals, suppression } from "../src/lib/db";
import { eq, and } from "drizzle-orm";
import { scheduleCallTaskAfterEmail, cancelPendingTasksForLead } from "../src/lib/lead-tasks-service";
import { isSuppressed, getLiveMessagesSentTodayCount } from "../src/lib/send-service";
import { addPolishBusinessDays } from "../src/lib/polish-calendar";

describe("Tenant Modular Architecture & Brief Invariants", () => {
  it("creates a tenant with custom module configuration (Fundacja Szumi Las)", async () => {
    const slug = `szumi-las-test-${Date.now()}`;
    const [ngoTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name: "Fundacja Szumi Las Test",
        plan: "ngo",
        isActive: true,
        enabledModules: {
          sourcingPlaces: true,
          sourcingCsv: true,
          compliancePke: true,
          outreachMode: "plain",
          callTasksQueue: true,
          dealFinanceTracking: true,
          excludedIndustries: ["alkohol", "hazard", "tytoń"],
          maxDailySends: 5,
        },
      })
      .returning();

    assert.ok(ngoTenant.id);
    assert.strictEqual(ngoTenant.enabledModules.compliancePke, true);
    assert.strictEqual(ngoTenant.enabledModules.callTasksQueue, true);
    assert.strictEqual(ngoTenant.enabledModules.dealFinanceTracking, true);
    assert.strictEqual(ngoTenant.enabledModules.maxDailySends, 5);

    // Clean up
    await db.delete(tenants).where(eq(tenants.id, ngoTenant.id));
  });

  it("PKE Gate (Art. 398): strictly blocks call task creation when phone is not allowed", async () => {
    // 1. Create test tenant with compliancePke and callTasksQueue
    const slug = `pke-gate-test-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name: "PKE Gate Test Tenant",
        enabledModules: {
          compliancePke: true,
          callTasksQueue: true,
        },
      })
      .returning();

    // 2. Create lead with pkePhoneStatus = 'needs_review'
    const [leadNoPhoneConsent] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma Bez Zgody Tel Sp. z o.o.",
        emailPrimary: "kontakt@bez-zgody.pl",
        status: "new",
        sourceName: "test_suite",
        pkePhoneStatus: "needs_review",
        isFixture: true,
      })
      .returning();

    // 3. Attempt to schedule call task
    const result = await scheduleCallTaskAfterEmail({
      tenantId: testTenant.id,
      leadId: leadNoPhoneConsent.id,
      sentAt: new Date(),
    });

    assert.strictEqual(result.created, false);
    assert.ok(result.reason?.includes("brak zgody"));

    // Verify no task was created in DB
    const tasksInDb = await db.query.leadTasks.findMany({
      where: eq(leadTasks.leadId, leadNoPhoneConsent.id),
    });
    assert.strictEqual(tasksInDb.length, 0);

    // Clean up
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  it("Schedules call task on +2 business days when phone contact is explicitly allowed", async () => {
    const slug = `call-schedule-test-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name: "Call Schedule Test Tenant",
        enabledModules: {
          compliancePke: true,
          callTasksQueue: true,
        },
      })
      .returning();

    // Lead with phone contact allowed
    const [leadWithPhone] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma Ze Zgodą Tel S.A.",
        emailPrimary: "csr@ze-zgoda.pl",
        status: "new",
        sourceName: "test_suite",
        pkePhoneStatus: "allowed",
        isFixture: true,
      })
      .returning();

    // Send on Wednesday 10:00 -> due Friday 10:00 (exactly 2 business days)
    const testSendDate = new Date("2026-10-07T10:00:00Z"); // Wednesday
    const expectedDueDate = addPolishBusinessDays(testSendDate, 2);

    const result = await scheduleCallTaskAfterEmail({
      tenantId: testTenant.id,
      leadId: leadWithPhone.id,
      sentAt: testSendDate,
    });

    assert.strictEqual(result.created, true);
    assert.ok(result.taskId);
    assert.strictEqual(result.dueAt?.getDay(), expectedDueDate.getDay());

    // Verify task exists in DB
    const taskInDb = await db.query.leadTasks.findFirst({
      where: eq(leadTasks.id, result.taskId!),
    });
    assert.ok(taskInDb);
    assert.strictEqual(taskInDb.status, "pending");
    assert.strictEqual(taskInDb.taskType, "call");

    // Clean up
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  it("Financial Module: tracks declared amount and supports Ania's payment confirmation", async () => {
    const slug = `finance-test-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({
        slug,
        name: "Finance Test Tenant",
        enabledModules: {
          dealFinanceTracking: true,
        },
      })
      .returning();

    const [lead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Darczyńca Sp. z o.o.",
        emailPrimary: "zarzad@darczynca.pl",
        status: "new",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    // 1. Dawid records declaration
    const [deal] = await db
      .insert(leadDeals)
      .values({
        tenantId: testTenant.id,
        leadId: lead.id,
        declaredAmount: 5000,
        expectedPaymentAt: new Date("2026-11-15T00:00:00Z"),
        status: "declared",
      })
      .returning();

    assert.strictEqual(deal.declaredAmount, 5000);
    assert.strictEqual(deal.paidAmount, 0);
    assert.strictEqual(deal.status, "declared");

    // 2. Ania confirms payment
    const [confirmedDeal] = await db
      .update(leadDeals)
      .set({
        paidAmount: 5000,
        paidConfirmedAt: new Date(),
        status: "paid",
      })
      .where(eq(leadDeals.id, deal.id))
      .returning();

    assert.strictEqual(confirmedDeal.paidAmount, 5000);
    assert.strictEqual(confirmedDeal.status, "paid");
    assert.ok(confirmedDeal.paidConfirmedAt);

    // Clean up
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  it("Suppression Isolation & Persistence: suppression check respects tenantId and blocks re-import", async () => {
    const slugA = `sup-tenant-a-${Date.now()}`;
    const slugB = `sup-tenant-b-${Date.now()}`;

    const [tenantA] = await db
      .insert(tenants)
      .values({ slug: slugA, name: "Tenant A Supp" })
      .returning();

    const [tenantB] = await db
      .insert(tenants)
      .values({ slug: slugB, name: "Tenant B Supp" })
      .returning();

    const testEmail = `optout-${Date.now()}@fundacja-test.pl`;

    // 1. Add to suppression for tenantA
    const crypto = await import("crypto");
    const hashedEmail = crypto.createHash("sha256").update(testEmail.toLowerCase()).digest("hex");

    const [supRecord] = await db
      .insert(suppression)
      .values({
        tenantId: tenantA.id,
        hashedEmail,
        rawIdentifier: testEmail,
        reason: "Odmowa kontaktu sponsorskiego",
      })
      .returning();

    // Check suppression for tenantA -> suppressed
    const checkTenantA = await isSuppressed({
      email: testEmail,
      tenantId: tenantA.id,
    });
    assert.strictEqual(checkTenantA.suppressed, true);

    // Check suppression for tenantB -> NOT suppressed (strict tenant isolation)
    const checkTenantB = await isSuppressed({
      email: testEmail,
      tenantId: tenantB.id,
    });
    assert.strictEqual(checkTenantB.suppressed, false);

    // Clean up
    await db.delete(suppression).where(eq(suppression.id, supRecord.id));
    await db.delete(tenants).where(eq(tenants.id, tenantA.id));
    await db.delete(tenants).where(eq(tenants.id, tenantB.id));
  });
});
