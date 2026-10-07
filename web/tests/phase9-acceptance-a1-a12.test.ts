import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  db,
  tenants,
  leads,
  messages,
  batches,
  campaigns,
  campaignLeads,
  channelPermissions,
  playbooks,
  playbookVersions,
  sequenceRuns,
  tasks,
  outcomes,
  suppression,
  blocks,
  jobs,
  withTenant,
} from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { sendMessage, isSuppressed } from "@/lib/send-service";
import { processInboundEmail } from "@/modules/mail/inbox-poller";
import { advanceLeadSequence } from "@/modules/campaigns/sequence-engine";
import { addPolishBusinessDays, isPolishPublicHoliday } from "@/lib/polish-calendar";
import { evaluateFitRubric } from "@/modules/research/evidence-verifier";
import { calculateDashboardMetrics } from "@/modules/analytics/dashboard-metrics";
import { jobQueue } from "@/modules/jobs/queue";
import {
  AGENCY_SALES_PRESET,
  SPONSORSHIP_FUNDRAISING_PRESET,
  playbookSchema,
  lintPlaybook,
} from "@/modules/campaigns/playbook.schema";

describe("Phase 9 Acceptance Tests (Brief Scenarios A1-A12 & Presets)", () => {
  // -------------------------------------------------------------
  // A1: Wysyłka pierwszego maila na skrzynkę testową, job odpalony 2 razy -> dokładnie jedna wiadomość
  // -------------------------------------------------------------
  it("A1: enforces single send idempotency when send is triggered twice", async () => {
    const slug = `a1-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A1 Idempotency Tenant" })
      .returning();

    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma A1 Test Sp. z o.o.",
        emailPrimary: `a1-${Date.now()}@test-idempotency.pl`,
        status: "approved",
        sourceName: "test_suite",
        contactBasis: "inquiry",
        isFixture: false,
      })
      .returning();

    const idempKey = `a1_idemp_${Date.now()}`;
    const [msg] = await db
      .insert(messages)
      .values({
        tenantId: testTenant.id,
        leadId: testLead.id,
        direction: "outbound",
        channel: "email",
        status: "pending",
        idempotencyKey: idempKey,
        sequenceStep: 0,
        createdAt: new Date(),
      })
      .returning();

    // 1st run of send
    const res1 = await sendMessage(msg.id, { ignoreWindow: true });
    // In test environment without live credentials, it attempts send (or sets test mode)
    // The message is claimed or updated
    assert.ok(res1);

    // 2nd run of send with same messageId
    const res2 = await sendMessage(msg.id, { ignoreWindow: true });
    assert.equal(res2.success, false);
    assert.equal(res2.status, "blocked");
    assert.ok(res2.reason?.includes("została już zarezerwowana") || res2.reason?.includes("przez inny proces"));

    // Check DB: exactly 1 message exists with this idempotency key
    const allMsgs = await db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, testTenant.id), eq(messages.idempotencyKey, idempKey)));
    assert.equal(allMsgs.length, 1, "Exactly one message record must exist");

    // Clean up
    await db.delete(messages).where(eq(messages.id, msg.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A2: Odpowiedź na mail -> sekwencja wstrzymana, zadanie u Dawida, brak dalszych wysyłek
  // -------------------------------------------------------------
  it("A2: pauses sequence and prevents further outbound sends when lead replies", async () => {
    const slug = `a2-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A2 Reply Tenant" })
      .returning();

    const testEmail = `a2-reply-${Date.now()}@partner.pl`;
    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma A2 Odpowiedź S.A.",
        emailPrimary: testEmail,
        status: "in_sequence",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania A2",
        status: "active",
        playbookVersionId: 1,
        testMode: true,
      })
      .returning();

    const [campLead] = await db
      .insert(campaignLeads)
      .values({
        tenantId: testTenant.id,
        campaignId: camp.id,
        leadId: testLead.id,
        state: "in_sequence",
      })
      .returning();

    const [seqRun] = await db
      .insert(sequenceRuns)
      .values({
        tenantId: testTenant.id,
        campaignLeadId: campLead.id,
        stepIndex: 1,
        status: "active",
        nextRunAt: new Date(),
      })
      .returning();

    // Inbound reply arrives
    const inboundRes = await processInboundEmail(
      {
        uid: Date.now(),
        from: testEmail,
        subject: "Re: Zapytanie o współpracę",
        text: "Dzień dobry, chętnie porozmawiamy o szczegółach w najbliższy czwartek.",
        date: new Date(),
      },
      testTenant.id
    );

    assert.equal(inboundRes.processed, true);
    assert.equal(inboundRes.classification, "reply_interested");

    // Sequence run must be paused with stopReason: 'reply'
    const [updatedRun] = await db
      .select()
      .from(sequenceRuns)
      .where(eq(sequenceRuns.id, seqRun.id));
    assert.equal(updatedRun.status, "paused");
    assert.equal(updatedRun.stopReason, "reply");

    // Verify advancing sequence does nothing because status is paused
    const advRes = await advanceLeadSequence(seqRun.id);
    assert.equal(advRes.success, false);
    assert.ok(advRes.error?.includes("Aktywny przebieg"));

    // Clean up
    await db.delete(sequenceRuns).where(eq(sequenceRuns.id, seqRun.id));
    await db.delete(campaignLeads).where(eq(campaignLeads.id, campLead.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(messages).where(eq(messages.leadId, testLead.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A3: Odmowa / wypisanie -> blok w blocks, zadania anulowane
  // -------------------------------------------------------------
  it("A3: writes block and cancels open tasks on refusal / unsubscribe", async () => {
    const slug = `a3-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A3 Refusal Tenant" })
      .returning();

    const testEmail = `a3-refusal-${Date.now()}@odmowa.pl`;
    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma A3 Odmowa Sp. z o.o.",
        emailPrimary: testEmail,
        status: "in_sequence",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania A3",
        status: "active",
        playbookVersionId: 1,
        testMode: true,
      })
      .returning();

    const [campLead] = await db
      .insert(campaignLeads)
      .values({
        tenantId: testTenant.id,
        campaignId: camp.id,
        leadId: testLead.id,
        state: "in_sequence",
      })
      .returning();

    const [openTask] = await db
      .insert(tasks)
      .values({
        tenantId: testTenant.id,
        campaignLeadId: campLead.id,
        type: "phone_call",
        dueAt: new Date(),
        status: "open",
      })
      .returning();

    // Inbound refusal email arrives
    const inboundRes = await processInboundEmail(
      {
        uid: Date.now(),
        from: testEmail,
        subject: "Re: Oferta",
        text: "Proszę mnie natychmiast wypisać z bazy, nie jesteśmy zainteresowani.",
        date: new Date(),
      },
      testTenant.id
    );

    assert.equal(inboundRes.processed, true);
    assert.ok(
      ["unsubscribe", "refusal"].includes(inboundRes.classification),
      "Must classify as unsubscribe or refusal"
    );

    // Task must be cancelled
    const [updatedTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, openTask.id));
    assert.equal(updatedTask.status, "cancelled");

    // Block must be persisted in blocks and suppression
    const emailHash = crypto.createHash("sha256").update(testEmail.toLowerCase()).digest("hex");
    const [blockRecord] = await db
      .select()
      .from(blocks)
      .where(and(eq(blocks.tenantId, testTenant.id), eq(blocks.hash, emailHash)));
    assert.ok(blockRecord, "Block record must exist in blocks table");

    const suppCheck = await isSuppressed({ email: testEmail, tenantId: testTenant.id });
    assert.equal(suppCheck.suppressed, true);

    // Clean up
    await db.delete(tasks).where(eq(tasks.id, openTask.id));
    await db.delete(blocks).where(and(eq(blocks.tenantId, testTenant.id), eq(blocks.hash, emailHash)));
    await db.delete(suppression).where(and(eq(suppression.tenantId, testTenant.id), eq(suppression.hashedEmail, emailHash)));
    await db.delete(campaignLeads).where(eq(campaignLeads.id, campLead.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(messages).where(eq(messages.leadId, testLead.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A4: Zwrot (bounce) -> zadanie telefoniczne blocked z powodem
  // -------------------------------------------------------------
  it("A4: transitions open phone task to blocked on bounce", async () => {
    const slug = `a4-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A4 Bounce Tenant" })
      .returning();

    const bounceTargetEmail = `a4-bounce-${Date.now()}@odbicie.pl`;
    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma A4 Bounce Sp. z o.o.",
        emailPrimary: bounceTargetEmail,
        status: "in_sequence",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania A4",
        status: "active",
        playbookVersionId: 1,
        testMode: true,
      })
      .returning();

    const [campLead] = await db
      .insert(campaignLeads)
      .values({
        tenantId: testTenant.id,
        campaignId: camp.id,
        leadId: testLead.id,
        state: "in_sequence",
      })
      .returning();

    const [openPhoneTask] = await db
      .insert(tasks)
      .values({
        tenantId: testTenant.id,
        campaignLeadId: campLead.id,
        type: "phone_call",
        dueAt: new Date(),
        status: "open",
      })
      .returning();

    // Inbound bounce notification arrives
    const inboundRes = await processInboundEmail(
      {
        uid: Date.now(),
        from: bounceTargetEmail,
        subject: "Mail delivery failed: returning message to sender",
        text: "Diagnostic code: recipient rejected; mailbox unavailable",
        date: new Date(),
      },
      testTenant.id
    );

    assert.equal(inboundRes.processed, true);
    assert.equal(inboundRes.classification, "bounce");

    // Phone task must be blocked with explanatory reason
    const [updatedTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, openPhoneTask.id));
    assert.equal(updatedTask.status, "blocked");
    assert.ok(updatedTask.blockedReason?.includes("bounce"));

    // Clean up
    await db.delete(tasks).where(eq(tasks.id, openPhoneTask.id));
    await db.delete(campaignLeads).where(eq(campaignLeads.id, campLead.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(messages).where(eq(messages.leadId, testLead.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A5: Błąd SMTP -> retry z backoffem, po limicie job w dead-letter, brak sent
  // -------------------------------------------------------------
  it("A5: retries failing job and moves to dead-letter after max attempts without sent status", async () => {
    const slug = `a5-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A5 SMTP Retry Tenant" })
      .returning();

    const deadJobKey = `a5_dead_${Date.now()}`;

    // Enqueue job with maxAttempts = 2 targeting non-existent message (-999)
    const enq = await jobQueue.enqueue({
      tenantId: testTenant.id,
      type: "send_message",
      idempotencyKey: deadJobKey,
      payload: { messageId: -999 },
      maxAttempts: 2,
    });

    assert.equal(enq.job.status, "pending");

    // Claim 1: fails, attempts becomes 1
    const claim1 = await jobQueue.claimNextJob({ workerId: "w1", tenantId: testTenant.id });
    assert.ok(claim1);
    await jobQueue.fail(claim1.id, "Connection refused: SMTP port 587");

    // Claim 2: fails, exhausts maxAttempts=2 -> transitions to dead_letter
    await db.update(jobs).set({ runAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, claim1.id));
    const claim2 = await jobQueue.claimNextJob({ workerId: "w1", tenantId: testTenant.id });
    assert.ok(claim2);
    await jobQueue.fail(claim2.id, "Connection refused: SMTP port 587");

    const [finalJob] = await db.select().from(jobs).where(eq(jobs.id, claim1.id));
    assert.equal(finalJob.status, "dead_letter");
    assert.equal(finalJob.attempts, 2);

    // Clean up
    await db.delete(jobs).where(eq(jobs.id, claim1.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A6: Daty zadań -> zadanie po 2 dniach roboczych PL (pomija weekend i święta)
  // -------------------------------------------------------------
  it("A6: accurately calculates +2 Polish business days skipping weekends and holidays", () => {
    // Wednesday 2026-10-07 + 2 business days = Friday 2026-10-09
    const wednesday = new Date("2026-10-07T10:00:00Z");
    const dueFriday = addPolishBusinessDays(wednesday, 2);
    assert.equal(dueFriday.getDay(), 5, "Wednesday + 2 business days must be Friday");

    // Friday 2026-10-09 + 2 business days skips Sat & Sun = Tuesday 2026-10-13
    const friday = new Date("2026-10-09T10:00:00Z");
    const dueTuesday = addPolishBusinessDays(friday, 2);
    assert.equal(dueTuesday.getDay(), 2, "Friday + 2 business days must be Tuesday (skipping weekend)");

    // Polish holiday check: Nov 11 (Święto Niepodległości) is statutory holiday
    const nov11 = new Date("2026-11-11T10:00:00Z");
    assert.equal(isPolishPublicHoliday(nov11), true);

    // Tuesday Nov 10 + 2 business days skips Wednesday Nov 11 -> due Friday Nov 13
    const nov10 = new Date("2026-11-10T10:00:00Z");
    const dueAfterHoliday = addPolishBusinessDays(nov10, 2);
    assert.equal(dueAfterHoliday.getDay(), 5, "Tuesday before Nov 11 holiday + 2 business days must land on Friday");
  });

  // -------------------------------------------------------------
  // A7: Reimport tego samego pliku/wyszukiwania -> brak zdublowanych leadów, blokady zachowane
  // -------------------------------------------------------------
  it("A7: preserves existing suppression blocks and prevents re-sending upon re-import", async () => {
    const slug = `a7-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A7 Reimport Tenant" })
      .returning();

    const testEmail = `a7-optout-${Date.now()}@firma.pl`;
    const emailHash = crypto.createHash("sha256").update(testEmail.toLowerCase()).digest("hex");

    // Previously unsubscribed lead put into blocks
    await db.insert(blocks).values({
      tenantId: testTenant.id,
      kind: "email",
      hash: emailHash,
      reason: "unsubscribe",
      source: "prior_contact",
    });

    // Re-import attempt: suppression check must immediately catch it
    const check = await isSuppressed({ email: testEmail, tenantId: testTenant.id });
    assert.equal(check.suppressed, true, "Re-imported lead must remain suppressed from blocks");

    // Clean up
    await db.delete(blocks).where(and(eq(blocks.tenantId, testTenant.id), eq(blocks.hash, emailHash)));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A8: Brak zatwierdzonej partii -> zero wysyłek
  // -------------------------------------------------------------
  it("A8: strictly blocks outbound send when lead is not in an approved batch", async () => {
    const slug = `a8-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A8 Batch Tenant" })
      .returning();

    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania A8",
        status: "active",
        playbookVersionId: 2, // sponsorship_fundraising preset (requires approved batch)
        testMode: true,
      })
      .returning();

    // Draft batch (not approved)
    const [draftBatch] = await db
      .insert(batches)
      .values({
        tenantId: testTenant.id,
        campaignId: camp.id,
        size: 20,
        status: "draft",
      })
      .returning();

    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma A8 Szkic Partii",
        emailPrimary: `a8-${Date.now()}@szkic-partii.pl`,
        status: "approved",
        sourceName: "test_suite",
        isFixture: false,
      })
      .returning();

    await db.insert(campaignLeads).values({
      tenantId: testTenant.id,
      campaignId: camp.id,
      leadId: testLead.id,
      state: "approved",
      batchId: draftBatch.id,
    });

    const [msg] = await db
      .insert(messages)
      .values({
        tenantId: testTenant.id,
        leadId: testLead.id,
        direction: "outbound",
        channel: "email",
        status: "pending",
        idempotencyKey: `a8_msg_${Date.now()}`,
        sequenceStep: 0,
      })
      .returning();

    // Send attempt must be blocked because batch is in draft status
    const sendRes = await sendMessage(msg.id, { ignoreWindow: true });
    assert.equal(sendRes.success, false);
    assert.equal(sendRes.status, "blocked");
    assert.ok(sendRes.reason?.includes("partia") && sendRes.reason?.includes("nie została zatwierdzona"));

    // Clean up
    await db.delete(messages).where(eq(messages.id, msg.id));
    await db.delete(campaignLeads).where(and(eq(campaignLeads.leadId, testLead.id), eq(campaignLeads.tenantId, testTenant.id)));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(batches).where(eq(batches.id, draftBatch.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A9: Kanał telefoniczny to_check -> brak zadania telefonicznego, jest verify_channel
  // -------------------------------------------------------------
  it("A9: creates verify_channel task when phone permission is to_check instead of phone_call", async () => {
    const slug = `a9-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A9 PKE Phone Gate Tenant" })
      .returning();

    const [testPlaybook] = await db
      .insert(playbooks)
      .values({ tenantId: testTenant.id, name: "Playbook A9" })
      .returning();

    const [pbVer] = await db
      .insert(playbookVersions)
      .values({
        playbookId: testPlaybook.id,
        version: 1,
        definition: SPONSORSHIP_FUNDRAISING_PRESET,
      })
      .returning();

    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania A9",
        status: "active",
        playbookVersionId: pbVer.id,
        testMode: true,
      })
      .returning();

    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma A9 Phone to_check Sp. z o.o.",
        emailPrimary: `a9-${Date.now()}@pke-gate.pl`,
        status: "in_sequence",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    const [campLead] = await db
      .insert(campaignLeads)
      .values({
        tenantId: testTenant.id,
        campaignId: camp.id,
        leadId: testLead.id,
        state: "in_sequence",
      })
      .returning();

    // Channel permission phone = 'to_check' (NOT 'yes')
    await db.insert(channelPermissions).values({
      tenantId: testTenant.id,
      campaignLeadId: campLead.id,
      channel: "phone",
      status: "to_check",
    });

    // Sequence at step 2 (call1: create_task requiring phone permission)
    const [seqRun] = await db
      .insert(sequenceRuns)
      .values({
        tenantId: testTenant.id,
        campaignLeadId: campLead.id,
        stepIndex: 2,
        status: "active",
        nextRunAt: new Date(),
      })
      .returning();

    const advRes = await advanceLeadSequence(seqRun.id);
    assert.equal(advRes.success, true);
    assert.equal(advRes.actionTaken, "task_created");

    // Verify task is of type 'verify_channel', not 'phone_call'
    const [createdTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.campaignLeadId, campLead.id));

    assert.ok(createdTask);
    assert.equal(createdTask.type, "verify_channel");
    assert.ok(createdTask.blockedReason?.includes("Brak potwierdzonej zgody na kontakt telefoniczny"));

    // Clean up
    await db.delete(tasks).where(eq(tasks.id, createdTask.id));
    await db.delete(sequenceRuns).where(eq(sequenceRuns.id, seqRun.id));
    await db.delete(channelPermissions).where(eq(channelPermissions.campaignLeadId, campLead.id));
    await db.delete(campaignLeads).where(eq(campaignLeads.id, campLead.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(playbookVersions).where(eq(playbookVersions.id, pbVer.id));
    await db.delete(playbooks).where(eq(playbooks.id, testPlaybook.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A10: Rekord bez dowodu -> priorytet 3, ręczna ocena, brak automatycznej sekwencji
  // -------------------------------------------------------------
  it("A10: evaluates record with no evidence as priority 3 with mandatory manual review", () => {
    const rubric = SPONSORSHIP_FUNDRAISING_PRESET.fitRubric;

    // Evaluated with 0 matching CSR evidence
    const evaluation = evaluateFitRubric([], rubric);
    assert.equal(evaluation.requiresManualReview, true, "Priority 3 / fallback must require manual review");
    assert.ok(evaluation.priority === 3 || evaluation.priority === null, "No evidence must be priority 3 or null");
  });

  // -------------------------------------------------------------
  // A11: Deklaracja bez wpłaty -> nie wlicza się do wpłat na dashboardzie
  // -------------------------------------------------------------
  it("A11: pledged outcome does not count as paid until confirmed by Ania", async () => {
    const slug = `a11-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "A11 Finance Tenant" })
      .returning();

    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Darczyńca Sp. z o.o.",
        status: "new",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania A11",
        status: "active",
        playbookVersionId: 1,
        testMode: true,
      })
      .returning();

    const [campLead] = await db
      .insert(campaignLeads)
      .values({
        tenantId: testTenant.id,
        campaignId: camp.id,
        leadId: testLead.id,
        state: "pledged",
      })
      .returning();

    // 1. Dawid enters pledged amount of 10,000 PLN (1,000,000 groszy)
    const [outcome] = await db
      .insert(outcomes)
      .values({
        tenantId: testTenant.id,
        campaignLeadId: campLead.id,
        pledgedMinor: 1000000,
        currency: "PLN",
        paidMinor: 0,
        paymentConfirmedAt: null,
      })
      .returning();

    // Check dashboard metrics: totalPaidMinor must be 0!
    const metricsBefore = await calculateDashboardMetrics({ tenantId: testTenant.id });
    assert.equal(metricsBefore.financials.totalPaidMinor, 0, "Unconfirmed pledge must not count as paid");
    assert.equal(metricsBefore.financials.totalPledgedMinor, 1000000);

    // 2. Ania confirms payment
    await db
      .update(outcomes)
      .set({
        paidMinor: 1000000,
        paymentConfirmedAt: new Date(),
      })
      .where(eq(outcomes.id, outcome.id));

    const metricsAfter = await calculateDashboardMetrics({ tenantId: testTenant.id });
    assert.equal(metricsAfter.financials.totalPaidMinor, 1000000, "Confirmed payment must be counted in dashboard");

    // Clean up
    await db.delete(outcomes).where(eq(outcomes.id, outcome.id));
    await db.delete(campaignLeads).where(eq(campaignLeads.id, campLead.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // A12: Dwóch tenantów: agencja i fundacja jednocześnie -> brak wycieku danych
  // -------------------------------------------------------------
  it("A12: strictly isolates data between agency and foundation tenants under RLS", async () => {
    const slugA = `tenant-agency-${Date.now()}`;
    const slugB = `tenant-ngo-${Date.now()}`;

    const [tenantA] = await db.insert(tenants).values({ slug: slugA, name: "Agencja A" }).returning();
    const [tenantB] = await db.insert(tenants).values({ slug: slugB, name: "Fundacja B" }).returning();

    const [leadA] = await db
      .insert(leads)
      .values({
        tenantId: tenantA.id,
        companyName: "Tylko w Agencji A",
        status: "new",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    const [leadB] = await db
      .insert(leads)
      .values({
        tenantId: tenantB.id,
        companyName: "Tylko w Fundacji B",
        status: "new",
        sourceName: "test_suite",
        isFixture: true,
      })
      .returning();

    // Query under tenantA scope
    const resultTenantA = await withTenant(tenantA.id, async (tx) => {
      return await tx.select().from(leads);
    });

    assert.ok(resultTenantA.some((l) => l.id === leadA.id));
    assert.ok(!resultTenantA.some((l) => l.id === leadB.id), "Tenant A must never see Tenant B records");

    // Query under tenantB scope
    const resultTenantB = await withTenant(tenantB.id, async (tx) => {
      return await tx.select().from(leads);
    });

    assert.ok(resultTenantB.some((l) => l.id === leadB.id));
    assert.ok(!resultTenantB.some((l) => l.id === leadA.id), "Tenant B must never see Tenant A records");

    // Clean up
    await db.delete(leads).where(eq(leads.id, leadA.id));
    await db.delete(leads).where(eq(leads.id, leadB.id));
    await db.delete(tenants).where(eq(tenants.id, tenantA.id));
    await db.delete(tenants).where(eq(tenants.id, tenantB.id));
  });

  // -------------------------------------------------------------
  // 9.3: Preset agency_sales regression test
  // -------------------------------------------------------------
  it("9.3: verifies agency_sales preset maintains legacy Procent Marketing behavior", () => {
    const parsed = playbookSchema.safeParse(AGENCY_SALES_PRESET);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;

    const data = parsed.data;
    assert.equal(data.modules.audit, true, "Agency sales must have audit module enabled");
    assert.equal(data.modules.offers, true, "Agency sales must have offers module enabled");
    assert.equal(data.modules.pricing, true, "Agency sales must have pricing module enabled");

    // Verify 4 outbound emails (initial + 3 follow-ups)
    const emailSteps = data.sequence.filter((s) => s.type === "send_email");
    assert.equal(emailSteps.length, 4, "Agency sales must have exactly 4 outbound email steps");

    const issues = lintPlaybook(data);
    const errors = issues.filter((i) => i.severity === "error");
    assert.equal(errors.length, 0, "Agency sales must have 0 lint errors");
  });
});
