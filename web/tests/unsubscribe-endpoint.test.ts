import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { db, tenants, leads, leadTasks, suppression, blocks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { GET, POST } from "@/app/api/unsubscribe/route";

describe("Opt-Out & Unsubscribe Endpoint (RFC 8058 / R5 / R6)", () => {
  it("rejects request with missing or invalid token", async () => {
    // 1. Missing params
    const req1 = new Request("http://localhost:3000/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const res1 = await POST(req1);
    assert.equal(res1.status, 400);

    // 2. Invalid token
    const req2 = new Request("http://localhost:3000/api/unsubscribe?leadId=999999&token=invalid_token", { method: "POST" });
    const res2 = await POST(req2);
    assert.equal(res2.status, 404);
  });

  it("successfully processes opt-out, cancels tasks, and writes blocks/suppression", async () => {
    const slug = `unsub-tenant-${Date.now()}`;
    const [testTenant] = await db
      .insert(tenants)
      .values({ slug, name: "Unsubscribe Test Tenant" })
      .returning();

    const rawEmail = `test-unsub-${Date.now()}@firma-testowa.pl`;
    const [testLead] = await db
      .insert(leads)
      .values({
        tenantId: testTenant.id,
        companyName: "Firma Do Wypisania Sp. z o.o.",
        emailPrimary: rawEmail,
        phoneNormalized: "+48500600700",
        nip: String(Date.now()).slice(0, 10),
        website: "https://firma-testowa.pl",
        status: "in_sequence",
        sourceName: "test_suite",
        contactBasis: "inquiry",
        isFixture: false,
      })
      .returning();

    // Create an open task for this lead
    const [openTask] = await db
      .insert(leadTasks)
      .values({
        tenantId: testTenant.id,
        leadId: testLead.id,
        taskType: "phone_call",
        title: "Zadzwoń do prezesa",
        status: "open",
        dueAt: new Date(),
      })
      .returning();

    // Compute expected token
    const validToken = crypto
      .createHash("sha256")
      .update(`optout:${testLead.id}:${testLead.tenantId}`)
      .digest("hex")
      .slice(0, 16);

    // 1. POST request (RFC 8058 One-Click)
    const postReq = new Request(
      `http://localhost:3000/api/unsubscribe?leadId=${testLead.id}&token=${validToken}`,
      { method: "POST" }
    );
    const postRes = await POST(postReq);
    assert.equal(postRes.status, 200);
    const postBody = await postRes.json();
    assert.equal(postBody.success, true);

    // Check DB: lead is unsubscribed
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, testLead.id));
    assert.equal(updatedLead.status, "unsubscribed");

    // Check DB: task is cancelled
    const [updatedTask] = await db.select().from(leadTasks).where(eq(leadTasks.id, openTask.id));
    assert.equal(updatedTask.status, "cancelled");

    // Check DB: blocks table has SHA-256 entries
    const emailHash = crypto.createHash("sha256").update(rawEmail.toLowerCase().trim()).digest("hex");
    const blockRows = await db
      .select()
      .from(blocks)
      .where(and(eq(blocks.tenantId, testTenant.id), eq(blocks.hash, emailHash)));
    assert.ok(blockRows.length > 0, "Email hash must be present in blocks table");

    // Check DB: suppression table has entry
    const suppRows = await db
      .select()
      .from(suppression)
      .where(and(eq(suppression.tenantId, testTenant.id), eq(suppression.hash, emailHash)));
    assert.ok(suppRows.length > 0, "Email must be present in suppression table");

    // 2. GET request (user clicking link in email footer)
    const getReq = new Request(
      `http://localhost:3000/api/unsubscribe?leadId=${testLead.id}&token=${validToken}`,
      { method: "GET" }
    );
    const getRes = await GET(getReq);
    assert.equal(getRes.status, 200);
    const html = await getRes.text();
    assert.ok(html.includes("Zostałeś pomyślnie wypisany"));
  });
});
