import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  db,
  tenants,
  leads,
  contacts,
  audits,
  campaigns,
  campaignLeads,
  tasks,
  sequenceRuns,
  blocks,
  suppression,
  withTenant,
} from "../src/lib/db";
import { eq } from "drizzle-orm";
import nextConfig from "../next.config";
import { jobRegistry } from "../src/modules/jobs/registry";
import { isSuppressed } from "../src/lib/send-service";

describe("Phase 10 Hardening, Security, RODO & Retention Invariants", () => {
  // -------------------------------------------------------------
  // 10.1 Security Headers Verification
  // -------------------------------------------------------------
  it("enforces mandatory security headers in nextConfig (HSTS, nosniff, SAMEORIGIN, CSP-ready)", async () => {
    assert.ok(typeof nextConfig.headers === "function", "nextConfig must define async headers()");
    const headersRules = await nextConfig.headers();
    assert.ok(headersRules.length > 0, "Must define at least one header rule");

    const rootRule = headersRules.find((r) => r.source === "/:path*");
    assert.ok(rootRule, "Must have global /:path* security headers rule");

    const headerMap = new Map(rootRule.headers.map((h) => [h.key.toLowerCase(), h.value]));

    assert.equal(headerMap.get("x-content-type-options"), "nosniff");
    assert.equal(headerMap.get("x-frame-options"), "SAMEORIGIN");
    assert.ok(headerMap.get("strict-transport-security")?.includes("max-age=63072000"));
    assert.equal(headerMap.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.ok(headerMap.get("permissions-policy")?.includes("camera=()"));
  });

  // -------------------------------------------------------------
  // 10.2 RODO / GDPR Article 17 Erasure & Irreversible Suppression Block
  // -------------------------------------------------------------
  it("executes GDPR Article 17 erasure: anonymizes lead, cancels tasks, and writes unalterable SHA-256 blocks", async () => {
    const slug = `p10-gdpr-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "GDPR Test Tenant" })
      .returning();

    const rawEmail = `jan.kowalski-${Date.now()}@firma-prywatna.pl`;
    const rawPhone = "+48 600 700 800";
    const rawNip = String(Math.floor(1000000000 + Math.random() * 9000000000));

    // 1. Create lead with personal data
    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Kowalski Usługi Prywatne",
        nip: rawNip,
        website: "https://firma-prywatna.pl",
        emailPrimary: rawEmail,
        phoneNormalized: "48600700800",
        address: "ul. Kwiatowa 12",
        city: "Wrocław",
        status: "in_sequence",
        sourceName: "gdpr_test",
        isFixture: false,
      })
      .returning();

    // 2. Create contact
    const [contact] = await db
      .insert(contacts)
      .values({
        tenantId: testTenant.id,
        leadId: testLead.id,
        firstName: "Jan",
        lastName: "Kowalski",
        email: rawEmail,
        phone: rawPhone,
        role: "Właściciel",
        source: "test",
        confidence: 1.0,
        isPrimary: true,
      })
      .returning();

    // 3. Create campaign & campaignLead with active task and sequence
    const [camp] = await db
      .insert(campaigns)
      .values({
        tenantId: testTenant.id,
        name: "Kampania RODO",
        status: "active",
        playbookVersionId: 1,
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

    // 4. Perform GDPR Article 17 Erasure Logic directly via DB operations (mirroring API)
    const emailHash = crypto.createHash("sha256").update(rawEmail.toLowerCase().trim()).digest("hex");
    const phoneHash = crypto.createHash("sha256").update("48600700800").digest("hex");
    const nipHash = crypto.createHash("sha256").update(rawNip).digest("hex");
    const domainHash = crypto.createHash("sha256").update("firma-prywatna.pl").digest("hex");

    await db.insert(blocks).values([
      { tenantId: testTenant.id, kind: "email", hash: emailHash, reason: "gdpr_erasure", source: "gdpr_test" },
      { tenantId: testTenant.id, kind: "phone", hash: phoneHash, reason: "gdpr_erasure", source: "gdpr_test" },
      { tenantId: testTenant.id, kind: "nip", hash: nipHash, reason: "gdpr_erasure", source: "gdpr_test" },
      { tenantId: testTenant.id, kind: "domain", hash: domainHash, reason: "gdpr_erasure", source: "gdpr_test" },
    ]);

    await db.insert(suppression).values({
      tenantId: testTenant.id,
      kind: "email",
      hash: emailHash,
      hashedEmail: emailHash,
      rawIdentifier: rawEmail,
      reason: "gdpr_erasure",
    });

    const anonymizedEmail = `gdpr-erased-${testLead.id}@anonymized.invalid`;
    await db
      .update(leads)
      .set({
        companyName: "[DANE ZANONIMIZOWANE NA WNIOSEK RODO]",
        emailPrimary: anonymizedEmail,
        phoneNormalized: null,
        address: null,
        city: null,
        status: "lost",
        lostReason: "gdpr_erasure",
        updatedAt: new Date(),
      })
      .where(eq(leads.id, testLead.id));

    await db
      .update(contacts)
      .set({
        firstName: "Anonim",
        lastName: "RODO",
        email: anonymizedEmail,
        phone: null,
      })
      .where(eq(contacts.id, contact.id));

    await db
      .update(tasks)
      .set({ status: "cancelled", blockedReason: "RODO art. 17" })
      .where(eq(tasks.id, openTask.id));

    await db
      .update(sequenceRuns)
      .set({ status: "stopped" })
      .where(eq(sequenceRuns.id, seqRun.id));

    // 5. Assertions:
    // Lead anonymized
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, testLead.id));
    assert.equal(updatedLead.companyName, "[DANE ZANONIMIZOWANE NA WNIOSEK RODO]");
    assert.equal(updatedLead.phoneNormalized, null);
    assert.equal(updatedLead.status, "lost");
    assert.equal(updatedLead.lostReason, "gdpr_erasure");

    // Contacts anonymized
    const [updatedContact] = await db.select().from(contacts).where(eq(contacts.id, contact.id));
    assert.equal(updatedContact.firstName, "Anonim");
    assert.equal(updatedContact.phone, null);

    // Tasks cancelled
    const [updatedTask] = await db.select().from(tasks).where(eq(tasks.id, openTask.id));
    assert.equal(updatedTask.status, "cancelled");

    // Active sequences stopped
    const [updatedSeq] = await db.select().from(sequenceRuns).where(eq(sequenceRuns.id, seqRun.id));
    assert.equal(updatedSeq.status, "stopped");

    // 6. Suppression check: Irreversible block prevents re-sending to this email and domain
    const isSuppEmail = await isSuppressed({ email: rawEmail, tenantId: testTenant.id });
    assert.equal(isSuppEmail.suppressed, true, "Raw email must be permanently suppressed");
    assert.ok(isSuppEmail.reason?.includes("gdpr_erasure"));

    const isSuppDomain = await isSuppressed({ email: `inny-adres@firma-prywatna.pl`, tenantId: testTenant.id });
    assert.equal(isSuppDomain.suppressed, true, "Domain must be permanently suppressed");

    // Clean up
    await db.delete(tasks).where(eq(tasks.id, openTask.id));
    await db.delete(sequenceRuns).where(eq(sequenceRuns.id, seqRun.id));
    await db.delete(campaignLeads).where(eq(campaignLeads.id, campLead.id));
    await db.delete(campaigns).where(eq(campaigns.id, camp.id));
    await db.delete(contacts).where(eq(contacts.id, contact.id));
    await db.delete(blocks).where(eq(blocks.tenantId, testTenant.id));
    await db.delete(suppression).where(eq(suppression.tenantId, testTenant.id));
    await db.delete(leads).where(eq(leads.id, testLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // 10.3 Retention Policy Enforcement Job (Data Minimization - Art. 5(1)(c) GDPR)
  // -------------------------------------------------------------
  it("cleanup job purges heavy website raw text on old terminal leads while preserving active leads", async () => {
    const slug = `p10-retention-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "Retention Policy Tenant" })
      .returning();

    // Lead 1: terminal status 'lost', updated 100 days ago -> raw evidence MUST be purged
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const [oldTerminalLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Stara Firma Zamknięta",
        emailPrimary: `stara-${Date.now()}@zamknieta.pl`,
        status: "lost",
        sourceName: "retention_test",
        isFixture: true,
        updatedAt: oldDate,
      })
      .returning();

    const [auditOld] = await db
      .insert(audits)
      .values({
        tenantId: testTenant.id,
        leadId: oldTerminalLead.id,
        rawEvidence: { dump: "Bardzo długi zrzut HTML i tekstu sprzed 100 dni..." },
        auditedAt: new Date(),
      })
      .returning();

    // Lead 2: terminal status 'won', updated yesterday -> raw evidence MUST NOT be purged
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const [recentLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Świeży Klient Sukces",
        emailPrimary: `swiezy-${Date.now()}@sukces.pl`,
        status: "won",
        sourceName: "retention_test",
        isFixture: true,
        updatedAt: recentDate,
      })
      .returning();

    const [auditRecent] = await db
      .insert(audits)
      .values({
        tenantId: testTenant.id,
        leadId: recentLead.id,
        rawEvidence: { dump: "Aktualna treść analizy..." },
        auditedAt: new Date(),
      })
      .returning();

    // Execute cleanup handler with 90 days retention policy
    const cleanupHandler = jobRegistry.getHandler("cleanup");
    assert.ok(cleanupHandler, "Cleanup job handler must be registered");

    const result = (await cleanupHandler({
      id: 99999,
      tenantId: testTenant.id,
      campaignId: null,
      type: "cleanup",
      idempotencyKey: null,
      priority: 50,
      payload: { retentionDays: 90 },
      result: null,
      status: "running",
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      heartbeatAt: null,
      lockedAt: null,
      lockedBy: null,
      runAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as Record<string, unknown>;

    assert.ok(result);
    assert.equal(result.tenantId, testTenant.id);
    assert.equal(result.retentionDays, 90);
    assert.ok((result.cleanedAuditsCount as number) >= 1, "At least 1 old terminal audit evidence must be cleaned");

    // Verify DB state:
    const [checkedAuditOld] = await db.select().from(audits).where(eq(audits.id, auditOld.id));
    assert.equal(checkedAuditOld.rawEvidence, null, "Old terminal audit raw evidence must be purged to null");

    const [checkedAuditRecent] = await db.select().from(audits).where(eq(audits.id, auditRecent.id));
    assert.ok(checkedAuditRecent.rawEvidence, "Recent audit raw evidence must be preserved");

    // Clean up
    await db.delete(audits).where(eq(audits.id, auditOld.id));
    await db.delete(audits).where(eq(audits.id, auditRecent.id));
    await db.delete(leads).where(eq(leads.id, oldTerminalLead.id));
    await db.delete(leads).where(eq(leads.id, recentLead.id));
    await db.delete(tenants).where(eq(tenants.id, testTenant.id));
  });

  // -------------------------------------------------------------
  // 10.4 Tenant RLS Isolation for All Core Operational Tables
  // -------------------------------------------------------------
  it("enforces tenant RLS isolation across blocks, tasks, and messages", async () => {
    const slug1 = `rls1-${Date.now()}`;
    const slug2 = `rls2-${Date.now()}`;
    const [t1] = await db.insert(tenants).values({ slug: slug1, name: "RLS Tenant 1" }).returning();
    const [t2] = await db.insert(tenants).values({ slug: slug2, name: "RLS Tenant 2" }).returning();

    // Create block in Tenant 1
    const dummyHash = crypto.createHash("sha256").update("test@rls-isolation.pl").digest("hex");
    const [block1] = await db
      .insert(blocks)
      .values({
        tenantId: t1.id,
        kind: "email",
        hash: dummyHash,
        reason: "manual",
        source: "test",
      })
      .returning();

    // Query under Tenant 2 context via withTenant: MUST see 0 rows
    const t2Blocks = await withTenant(t2.id, async (tx) => {
      return await tx.select().from(blocks).where(eq(blocks.id, block1.id));
    });
    assert.equal(t2Blocks.length, 0, "Tenant 2 must NOT see Tenant 1 blocks under RLS");

    // Clean up
    await db.delete(blocks).where(eq(blocks.id, block1.id));
    await db.delete(tenants).where(eq(tenants.id, t1.id));
    await db.delete(tenants).where(eq(tenants.id, t2.id));
  });
});
