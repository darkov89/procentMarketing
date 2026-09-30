import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_TRANSITIONS,
  TERMINAL_STATUSES,
  isValidTransition,
  IllegalStateTransitionError,
  transitionLead,
  LeadStatus,
} from "../src/lib/state-machine";
import { db, leads, leadEvents } from "../src/lib/db";
import { eq } from "drizzle-orm";

describe("Lead State Machine Invariants (Invariant 3)", () => {
  it("enforces allowed transitions across the entire lifecycle", () => {
    // Normal happy path
    assert.equal(isValidTransition("new", "enriching"), true);
    assert.equal(isValidTransition("enriching", "qualified"), true);
    assert.equal(isValidTransition("qualified", "offer_ready"), true);
    assert.equal(isValidTransition("offer_ready", "pending_approval"), true);
    assert.equal(isValidTransition("pending_approval", "approved"), true);
    assert.equal(isValidTransition("approved", "in_sequence"), true);
    assert.equal(isValidTransition("in_sequence", "meeting_booked"), true);
    assert.equal(isValidTransition("meeting_booked", "won"), true);

    // Self-transitions (idempotency)
    assert.equal(isValidTransition("in_sequence", "in_sequence"), true);
    assert.equal(isValidTransition("new", "new"), true);
  });

  it("strictly blocks illegal state skips and invalid backwards moves", () => {
    // Cannot skip qualification and jump straight to outreach
    assert.equal(isValidTransition("new", "in_sequence"), false);
    assert.equal(isValidTransition("new", "meeting_booked"), false);
    assert.equal(isValidTransition("enriching", "approved"), false);

    // Won is terminal
    assert.equal(isValidTransition("won", "new"), false);
    assert.equal(isValidTransition("won", "in_sequence"), false);

    // Unsubscribed cannot transition to active outreach
    assert.equal(isValidTransition("unsubscribed", "in_sequence"), false);
    assert.equal(isValidTransition("unsubscribed", "approved"), false);
    assert.equal(isValidTransition("unsubscribed", "new"), false);

    // Bounced cannot transition to outreach
    assert.equal(isValidTransition("bounced", "in_sequence"), false);
  });

  it("verifies terminal states list", () => {
    assert.ok(TERMINAL_STATUSES.includes("unsubscribed"));
    assert.ok(TERMINAL_STATUSES.includes("bounced"));
    assert.ok(TERMINAL_STATUSES.includes("replied_negative"));
    assert.ok(TERMINAL_STATUSES.includes("disqualified"));

    for (const term of TERMINAL_STATUSES) {
      assert.equal(
        isValidTransition(term, "in_sequence"),
        false,
        `Terminal status '${term}' must NEVER transition directly to 'in_sequence'`
      );
    }
  });

  it("IllegalStateTransitionError contains required debug context", () => {
    const err = new IllegalStateTransitionError(999, "new", "meeting_booked");
    assert.equal(err.leadId, 999);
    assert.equal(err.fromStatus, "new");
    assert.equal(err.toStatus, "meeting_booked");
    assert.match(err.message, /Niedozwolone przejście stanu leada #999/);
  });

  describe("transitionLead DB transaction and audit logging", () => {
    let testLeadId: number;

    before(async () => {
      // Insert isolated test fixture lead
      const [inserted] = await db
        .insert(leads)
        .values({
          companyName: "STATE MACHINE TEST FIXTURE SP Z O O",
          nip: "1111111111",
          emailPrimary: "fixture@state-machine-test.pl",
          city: "Legnica",
          sourceName: "test_fixture",
          status: "new",
          isFixture: true,
          contactBasis: "public_registry",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      testLeadId = inserted.id;
    });

    after(async () => {
      if (testLeadId) {
        await db.delete(leadEvents).where(eq(leadEvents.leadId, testLeadId));
        await db.delete(leads).where(eq(leads.id, testLeadId));
      }
    });

    it("successfully transitions lead through legal path and writes audit log to lead_events", async () => {
      const res = await transitionLead({
        leadId: testLeadId,
        toStatus: "enriching",
        actor: "test:runner",
        reason: "Rozpoczęcie audytu w teście jednostkowym",
        metadata: { testKey: "testValue" },
      });

      assert.equal(res.success, true);
      assert.equal(res.previousStatus, "new");
      assert.equal(res.currentStatus, "enriching");

      // Verify DB update
      const leadInDb = await db.query.leads.findFirst({
        where: eq(leads.id, testLeadId),
      });
      assert.equal(leadInDb?.status, "enriching");

      // Verify audit entry in lead_events
      const events = await db
        .select()
        .from(leadEvents)
        .where(eq(leadEvents.leadId, testLeadId));

      assert.equal(events.length >= 1, true);
      const latest = events[events.length - 1];
      assert.equal(latest.fromStatus, "new");
      assert.equal(latest.toStatus, "enriching");
      assert.equal(latest.actor, "test:runner");
      assert.equal(latest.reason, "Rozpoczęcie audytu w teście jednostkowym");
    });

    it("throws IllegalStateTransitionError and rejects illegal transition", async () => {
      // Lead is currently in 'enriching', attempting illegal jump to 'meeting_booked'
      await assert.rejects(
        async () => {
          await transitionLead({
            leadId: testLeadId,
            toStatus: "meeting_booked",
            actor: "test:hacker",
            reason: "Nieuprawniony skok",
          });
        },
        (err: any) => {
          assert.equal(err.name, "IllegalStateTransitionError");
          assert.equal(err.fromStatus, "enriching");
          assert.equal(err.toStatus, "meeting_booked");
          return true;
        }
      );

      // Verify status remained 'enriching'
      const leadInDb = await db.query.leads.findFirst({
        where: eq(leads.id, testLeadId),
      });
      assert.equal(leadInDb?.status, "enriching");
    });
  });
});
