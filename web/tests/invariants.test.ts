import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { db, leads, messages, suppression, serviceCatalog, leadEvents } from "../src/lib/db";
import { sendMessage } from "../src/lib/send-service";
import { isSafeUrl } from "../src/lib/auditor";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

describe("System Core Invariants (Invariants 1, 2, 5, 6, 7)", () => {
  let fixtureLeadId: number;
  let fixtureMessageId: number;
  let normalLeadId: number;
  let normalMessageId: number;

  before(async () => {
    // 1. Create a Fixture Lead
    const [fLead] = await db
      .insert(leads)
      .values({
        companyName: "INVARIANT 1 FIXTURE TEST CO",
        nip: "9999999999",
        emailPrimary: "fixture-invariant@procentmarketing.pl",
        city: "Legnica",
        sourceName: "test_suite",
        status: "approved",
        isFixture: true,
        contactBasis: "public_registry",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    fixtureLeadId = fLead.id;

    const [fMsg] = await db
      .insert(messages)
      .values({
        leadId: fixtureLeadId,
        channel: "email",
        direction: "outbound",
        status: "scheduled",
        subject: "Wiadomość testowa dla fixture",
        bodyText: "Treść testowa",
        idempotencyKey: crypto.randomUUID(),
        sequenceStep: 0,
        createdAt: new Date(),
      })
      .returning();
    fixtureMessageId = fMsg.id;

    // 2. Create a Normal Test Lead (for other invariant tests)
    const [nLead] = await db
      .insert(leads)
      .values({
        companyName: "NORMAL TEST CO FOR INVARIANTS",
        nip: "8888888888",
        emailPrimary: "normal-test@procentmarketing.pl",
        city: "Legnica",
        sourceName: "test_suite",
        status: "approved",
        isFixture: false,
        contactBasis: "public_registry",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    normalLeadId = nLead.id;

    const [nMsg] = await db
      .insert(messages)
      .values({
        leadId: normalLeadId,
        channel: "email",
        direction: "outbound",
        status: "scheduled",
        subject: "Dedykowana propozycja współpracy",
        bodyText: "Treść propozycji",
        idempotencyKey: crypto.randomUUID(),
        sequenceStep: 0,
        createdAt: new Date(),
      })
      .returning();
    normalMessageId = nMsg.id;
  });

  after(async () => {
    // Clean up created entities
    if (fixtureMessageId) {
      await db.delete(messages).where(eq(messages.id, fixtureMessageId));
    }
    if (fixtureLeadId) {
      await db.delete(leadEvents).where(eq(leadEvents.leadId, fixtureLeadId));
      await db.delete(leads).where(eq(leads.id, fixtureLeadId));
    }

    if (normalMessageId) {
      await db.delete(messages).where(eq(messages.id, normalMessageId));
    }
    if (normalLeadId) {
      await db.delete(leadEvents).where(eq(leadEvents.leadId, normalLeadId));
      await db.delete(leads).where(eq(leads.id, normalLeadId));
    }
  });

  // =========================================================================
  // INVARIANT 1: ZERO SYNTHETIC / FAKE DATA CAN EVER BE SENT
  // =========================================================================
  describe("Invariant 1: Anti-hallucination & Fixture Isolation", () => {
    it("strictly blocks sendMessage when lead has isFixture: true", async () => {
      const result = await sendMessage(fixtureMessageId);

      assert.equal(result.success, false);
      assert.equal(result.status, "blocked");
      assert.match(result.reason || "", /fixture.*zabroniona/i);

      // Verify DB message status was marked failed
      const msgInDb = await db.query.messages.findFirst({
        where: eq(messages.id, fixtureMessageId),
      });
      assert.equal(msgInDb?.status, "failed");
      assert.match(msgInDb?.errorMessage || "", /fixture/i);
    });
  });

  // =========================================================================
  // INVARIANT 2: SINGLE SECURE SEND PATH (16 SAFEGUARD CHECKS)
  // =========================================================================
  describe("Invariant 2: Single SMTP Send Path & Kill Switches", () => {
    it("blocks send if STOP file kill switch exists on filesystem", async () => {
      // Create temporary STOP file in working directory
      const stopFilePath = path.resolve(process.cwd(), "STOP");
      fs.writeFileSync(stopFilePath, "EMERGENCY STOP FOR INVARIANT TEST");

      try {
        const result = await sendMessage(normalMessageId);
        assert.equal(result.success, false);
        assert.equal(result.status, "blocked");
        assert.match(result.reason || "", /kill switch/i);
      } finally {
        if (fs.existsSync(stopFilePath)) {
          fs.unlinkSync(stopFilePath);
        }
      }
    });

    it("blocks send when recipient is in suppression list", async () => {
      const suppressedEmail = "suppressed-lead@procentmarketing.pl";
      const hashedEmail = crypto.createHash("sha256").update(suppressedEmail).digest("hex");

      const [suppLead] = await db
        .insert(leads)
        .values({
          companyName: "SUPPRESSED TEST CO",
          nip: "7777777777",
          emailPrimary: suppressedEmail,
          city: "Legnica",
          sourceName: "test_suite",
          status: "approved",
          isFixture: false,
          contactBasis: "public_registry",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [suppMsg] = await db
        .insert(messages)
        .values({
          leadId: suppLead.id,
          channel: "email",
          direction: "outbound",
          status: "scheduled",
          subject: "Test suppression send",
          bodyText: "Treść",
          idempotencyKey: crypto.randomUUID(),
          sequenceStep: 0,
          createdAt: new Date(),
        })
        .returning();

      const [supp] = await db
        .insert(suppression)
        .values({
          hashedEmail,
          rawIdentifier: suppressedEmail,
          reason: "Wypisany z bazy w teście",
          createdAt: new Date(),
        })
        .returning();

      try {
        const result = await sendMessage(suppMsg.id);
        assert.equal(result.success, false);
        assert.equal(result.status, "blocked");
        assert.match(result.reason || "", /Wypisany z bazy w teście/i);
      } finally {
        await db.delete(messages).where(eq(messages.id, suppMsg.id));
        await db.delete(suppression).where(eq(suppression.id, supp.id));
        await db.delete(leads).where(eq(leads.id, suppLead.id));
      }
    });

    it("blocks send if lead is in terminal status 'unsubscribed' or 'lost'", async () => {
      const [termLead] = await db
        .insert(leads)
        .values({
          companyName: "TERMINAL LEAD TEST CO",
          nip: "6666666666",
          emailPrimary: "terminal-lead@procentmarketing.pl",
          city: "Legnica",
          sourceName: "test_suite",
          status: "unsubscribed", // Terminal status
          isFixture: false,
          contactBasis: "public_registry",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const [termMsg] = await db
        .insert(messages)
        .values({
          leadId: termLead.id,
          channel: "email",
          direction: "outbound",
          status: "scheduled",
          subject: "Wiadomość do wypisanego leada",
          bodyText: "Treść",
          idempotencyKey: crypto.randomUUID(),
          sequenceStep: 0,
          createdAt: new Date(),
        })
        .returning();

      try {
        const result = await sendMessage(termMsg.id);
        assert.equal(result.success, false);
        assert.equal(result.status, "blocked");
        assert.match(result.reason || "", /status końcowy.*unsubscribed/i);
      } finally {
        await db.delete(messages).where(eq(messages.id, termMsg.id));
        await db.delete(leads).where(eq(leads.id, termLead.id));
      }
    });
  });

  // =========================================================================
  // INVARIANT 6: SAFE WEB AUDITOR & SSRF PROTECTION
  // =========================================================================
  describe("Invariant 6: Safe Web Auditor & SSRF Guard", () => {
    it("isSafeUrl blocks loopback, private networks, and cloud metadata endpoints", () => {
      assert.equal(isSafeUrl("http://localhost"), false, "localhost blocked");
      assert.equal(isSafeUrl("http://localhost:8080/admin"), false, "localhost with port blocked");
      assert.equal(isSafeUrl("http://127.0.0.1"), false, "127.0.0.1 blocked");
      assert.equal(isSafeUrl("http://127.0.0.1:3000/api"), false, "127.0.0.1 with port blocked");
      assert.equal(isSafeUrl("http://0.0.0.0"), false, "0.0.0.0 blocked");
      assert.equal(isSafeUrl("http://::1"), false, "IPv6 ::1 blocked");

      // AWS/GCP instance metadata endpoint (SSRF prime target)
      assert.equal(isSafeUrl("http://169.254.169.254/latest/meta-data"), false, "metadata IP blocked");

      // Private RFC 1918 networks
      assert.equal(isSafeUrl("http://10.0.0.5/internal"), false, "10.x.x.x blocked");
      assert.equal(isSafeUrl("http://172.16.0.1"), false, "172.16.x.x blocked");
      assert.equal(isSafeUrl("http://192.168.1.1/router"), false, "192.168.x.x blocked");

      // Invalid schemes
      assert.equal(isSafeUrl("file:///etc/passwd"), false, "file scheme blocked");
      assert.equal(isSafeUrl("ftp://files.com"), false, "ftp scheme blocked");
      assert.equal(isSafeUrl("javascript:alert(1)"), false, "javascript scheme blocked");
    });

    it("isSafeUrl permits genuine public web addresses", () => {
      assert.equal(isSafeUrl("https://procentmarketing.pl"), true);
      assert.equal(isSafeUrl("https://archimed-legnica.pl"), true);
      assert.equal(isSafeUrl("http://example.com"), true);
      assert.equal(isSafeUrl("https://subdomain.company.pl/kontakt"), true);
    });
  });

  // =========================================================================
  // INVARIANT 5: SERVICE CATALOG INTEGRITY
  // =========================================================================
  describe("Invariant 5: Verified Service Catalog", () => {
    it("verifies service_catalog table contains vetted standard packages", async () => {
      const catalog = await db.select().from(serviceCatalog);
      assert.ok(catalog.length >= 4, "Must have at least 4 catalog packages");

      for (const item of catalog) {
        assert.ok(item.serviceName.length > 0, "Service name must be non-empty");
        assert.ok(item.description.length > 0, "Service description must be non-empty");
        assert.ok(item.basePrice > 0, "Base price must be greater than 0");
        assert.equal(item.priceUnit, "PLN", "Price unit must be PLN");
        assert.equal(item.active, true, "Package must be active");
      }
    });
  });

  // =========================================================================
  // INVARIANT 7: FOLLOW-UP CONSTRAINTS (MAX 3 FOLLOW-UPS)
  // =========================================================================
  describe("Invariant 7: Follow-up max 3 constraint", () => {
    it("strictly blocks messages with sequenceStep > 3", async () => {
      // Create message with illegal sequenceStep = 4 (which would be 5th message!)
      const [excessMsg] = await db
        .insert(messages)
        .values({
          leadId: normalLeadId,
          channel: "email",
          direction: "outbound",
          status: "scheduled",
          subject: "Piąta wiadomość do tego samego leada",
          bodyText: "Spam",
          idempotencyKey: crypto.randomUUID(),
          sequenceStep: 4, // > 3 is strictly forbidden by Invariant 7
          createdAt: new Date(),
        })
        .returning();

      try {
        const result = await sendMessage(excessMsg.id);
        assert.equal(result.success, false);
        assert.equal(result.status, "blocked");
        assert.match(result.reason || "", /maksymalna liczba follow-upów przekroczona/i);
      } finally {
        await db.delete(messages).where(eq(messages.id, excessMsg.id));
      }
    });
  });
});
