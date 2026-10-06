import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withTenant, leads, pool } from "@/lib/db";
import { sql } from "drizzle-orm";

describe("Row-Level Security & Tenant Isolation (R4)", () => {
  it("strictly isolates tenant data: query without WHERE filter only returns current tenant records", async () => {
    // We test using two distinct tenant IDs: 1 and a non-existent or secondary tenant ID (e.g., 999999)
    const tenant1Leads = await withTenant(1, async (tx) => {
      // Intentionally execute raw query WITHOUT WHERE filter on leads
      const rows = await tx.select().from(leads);
      return rows;
    });

    // Tenant 1 has leads
    assert.ok(tenant1Leads.length > 0, "Tenant 1 should have leads");
    for (const lead of tenant1Leads) {
      assert.equal(lead.tenantId, 1, "Every row returned under withTenant(1) must belong to tenant 1");
    }

    // Now query as tenant 999999 (which has 0 leads)
    const tenantOtherLeads = await withTenant(999999, async (tx) => {
      // Query without WHERE filter
      const rows = await tx.select().from(leads);
      return rows;
    });

    assert.equal(
      tenantOtherLeads.length,
      0,
      "Tenant 999999 must see 0 leads even without WHERE filter because RLS isolates tenant data"
    );
  });

  it("strictly returns 0 rows when app_rw queries without app.tenant_id setting", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN;");
      await client.query("SET ROLE app_rw;");
      // Intentionally do NOT set app.tenant_id
      const res = await client.query("SELECT * FROM leads;");
      assert.equal(res.rows.length, 0, "Querying as app_rw without tenant context must return 0 rows");
      await client.query("RESET ROLE;");
      await client.query("ROLLBACK;");
    } finally {
      client.release();
    }
  });

  it("strictly rejects inserting row with mismatched tenant_id under withTenant", async () => {
    let thrownError: Error | null = null;
    try {
      await withTenant(1, async (tx) => {
        // Attempt to insert record with tenantId: 2 while scoped to tenant 1
        await tx.execute(
          sql`INSERT INTO leads (tenant_id, company_name, created_at, updated_at) VALUES (2, 'Malicious Insert', NOW(), NOW())`
        );
      });
    } catch (err) {
      thrownError = err as Error;
    }

    assert.ok(thrownError, "Should have thrown an error");
    const causeMsg = (thrownError as { cause?: { message?: string } }).cause?.message || "";
    const fullMessage = `${thrownError.message || ""} ${causeMsg}`;
    assert.match(
      fullMessage,
      /new row violates row-level security policy/,
      "Database must throw RLS violation when trying to insert record for a different tenant"
    );
  });
});
