import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  db,
  tenants,
  users,
  sessions,
  tenantMembers,
  events,
} from "../src/lib/db";
import { eq, and } from "drizzle-orm";
import {
  validateSessionToken,
  can,
  createSession,
  ACTIVE_TENANT_COOKIE_NAME,
} from "../src/lib/auth";

describe("Tenant Switcher & Super Admin Security Invariants", () => {
  const timestamp = Date.now();

  let tenantA: typeof tenants.$inferSelect;
  let tenantB: typeof tenants.$inferSelect;
  let regularUser: typeof users.$inferSelect;
  let adminUser: typeof users.$inferSelect;
  let regularSessionToken: string;
  let adminSessionToken: string;

  before(async () => {
    // 1. Create two isolated test tenants
    [tenantA] = await db
      .insert(tenants)
      .values({
        slug: `test-tenant-a-${timestamp}`,
        name: `Test Tenant A ${timestamp}`,
        plan: "pro",
        isActive: true,
      })
      .returning();

    [tenantB] = await db
      .insert(tenants)
      .values({
        slug: `test-tenant-b-${timestamp}`,
        name: `Test Tenant B ${timestamp}`,
        plan: "pro",
        isActive: true,
      })
      .returning();

    // 2. Create a regular user (member only in Tenant A)
    const dummyHash = crypto.randomBytes(32).toString("hex");
    [regularUser] = await db
      .insert(users)
      .values({
        email: `regular-${timestamp}@test.pl`,
        name: "Regular Member",
        role: "member",
        passwordHash: dummyHash,
      })
      .returning();

    await db.insert(tenantMembers).values({
      tenantId: tenantA.id,
      userId: regularUser.id,
      role: "member",
      capabilities: ["approve_batch"],
    });

    const regSession = await createSession(regularUser.id);
    regularSessionToken = regSession.token;

    // 3. Create a Super Admin user (global role 'admin', directly assigned to Tenant A)
    [adminUser] = await db
      .insert(users)
      .values({
        email: `admin-${timestamp}@test.pl`,
        name: "Global Super Admin",
        role: "admin",
        passwordHash: dummyHash,
      })
      .returning();

    await db.insert(tenantMembers).values({
      tenantId: tenantA.id,
      userId: adminUser.id,
      role: "owner",
      capabilities: ["*"],
    });

    const admSession = await createSession(adminUser.id);
    adminSessionToken = admSession.token;
  });

  after(async () => {
    // Clean up test records
    await db.delete(events).where(eq(events.tenantId, tenantA.id));
    await db.delete(events).where(eq(events.tenantId, tenantB.id));
    await db.delete(sessions).where(eq(sessions.userId, regularUser.id));
    await db.delete(sessions).where(eq(sessions.userId, adminUser.id));
    await db.delete(tenantMembers).where(eq(tenantMembers.userId, regularUser.id));
    await db.delete(tenantMembers).where(eq(tenantMembers.userId, adminUser.id));
    await db.delete(users).where(eq(users.id, regularUser.id));
    await db.delete(users).where(eq(users.id, adminUser.id));
    await db.delete(tenants).where(eq(tenants.id, tenantA.id));
    await db.delete(tenants).where(eq(tenants.id, tenantB.id));
  });

  it("resolves default active tenant correctly for regular user and superadmin", async () => {
    const regUserSafe = await validateSessionToken(regularSessionToken);
    assert.ok(regUserSafe);
    assert.equal(regUserSafe.tenantId, tenantA.id, "Regular user defaults to Tenant A");
    assert.equal(regUserSafe.isSuperAdmin, false);

    const admUserSafe = await validateSessionToken(adminSessionToken);
    assert.ok(admUserSafe);
    assert.equal(admUserSafe.tenantId, tenantA.id, "Admin user defaults to Tenant A");
    assert.equal(admUserSafe.isSuperAdmin, true);
  });

  it("FAIL-CLOSED: prevents regular user from accessing unauthorized tenant even if requested in cookie/parameter", async () => {
    // Regular user is ONLY in Tenant A, attempting to request Tenant B
    const tamperedUserSafe = await validateSessionToken(regularSessionToken, tenantB.id);
    assert.ok(tamperedUserSafe);
    assert.equal(
      tamperedUserSafe.tenantId,
      tenantA.id,
      "Must fail-closed to Tenant A and forbid Tenant B access"
    );
    assert.notEqual(tamperedUserSafe.tenantId, tenantB.id);
  });

  it("SUPER ADMIN: allows global admin to switch to ANY active tenant without explicit membership", async () => {
    // Admin is directly member of Tenant A, but requests Tenant B
    const adminInB = await validateSessionToken(adminSessionToken, tenantB.id);
    assert.ok(adminInB);
    assert.equal(adminInB.tenantId, tenantB.id, "Super Admin can access Tenant B");
    assert.equal(adminInB.tenantName, tenantB.name);
    assert.equal(adminInB.tenantRole, "superadmin");
    assert.equal(adminInB.isSuperAdmin, true);
    assert.ok(can(adminInB, "anything_at_all"), "Super Admin possesses wildcard capabilities");
  });

  it("POST /api/tenants/switch strictly forbids unauthorized regular user with 403", async () => {
    const { POST } = await import("../src/app/api/tenants/switch/route");

    // Mock request from regular user attempting to switch to Tenant B
    const fakeRequest = new Request("http://localhost:3000/api/tenants/switch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `pm_session_token=${regularSessionToken}`,
      },
      body: JSON.stringify({ tenantId: tenantB.id }),
    });

    const response = await POST(fakeRequest);
    assert.equal(response.status, 403, "Must return 403 Forbidden for unauthorized tenant switch");

    const json = await response.json();
    assert.equal(json.success, false);
    assert.match(json.error, /Brak dostępu/);
  });

  it("POST /api/tenants/switch allows Super Admin to switch to any tenant and logs audit event", async () => {
    const { POST } = await import("../src/app/api/tenants/switch/route");

    // Mock request from Super Admin switching to Tenant B
    const fakeRequest = new Request("http://localhost:3000/api/tenants/switch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `pm_session_token=${adminSessionToken}`,
      },
      body: JSON.stringify({ tenantId: tenantB.id }),
    });

    const response = await POST(fakeRequest);
    assert.equal(response.status, 200, "Super admin switch must return 200 OK");

    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(json.activeTenantId, tenantB.id);

    // Verify cookie was set
    const setCookieHeader = response.headers.get("set-cookie");
    assert.ok(setCookieHeader);
    assert.ok(setCookieHeader.includes(ACTIVE_TENANT_COOKIE_NAME));
    assert.ok(setCookieHeader.includes(String(tenantB.id)));

    // Verify audit event was logged in events table (EU AI Act / RODO auditability)
    const auditEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.tenantId, tenantB.id), eq(events.eventType, "tenant_switched")));

    assert.ok(auditEvents.length > 0, "Audit event must be recorded in events table");
    const lastAudit = auditEvents[auditEvents.length - 1];
    const payload = lastAudit.payload as Record<string, unknown>;
    assert.equal(payload.userId, adminUser.id);
    assert.equal(payload.toTenantId, tenantB.id);
    assert.equal(payload.isSuperAdmin, true);
  });
});
