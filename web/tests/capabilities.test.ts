import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { can, SafeUser } from "@/lib/auth";

describe("Granular Permissions & Capabilities (D6, Step 1.4)", () => {
  it("grants full capabilities to owner role (wildcard '*')", () => {
    const ownerUser: SafeUser = {
      id: 1,
      email: "owner@example.com",
      name: "Owner User",
      role: "admin",
      tenantId: 1,
      tenantRole: "owner",
      capabilities: [],
    };

    assert.equal(can(ownerUser, "confirm_payment"), true);
    assert.equal(can(ownerUser, "approve_batch"), true);
    assert.equal(can(ownerUser, "manage_mailbox"), true);
    assert.equal(can(ownerUser, "manage_playbook"), true);
    assert.equal(can(ownerUser, "any_custom_permission"), true);
  });

  it("grants confirm_payment to admin role by default", () => {
    const adminUser: SafeUser = {
      id: 2,
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      tenantId: 1,
      tenantRole: "admin",
      capabilities: [],
    };

    assert.equal(can(adminUser, "confirm_payment"), true);
    assert.equal(can(adminUser, "approve_batch"), true);
    assert.equal(can(adminUser, "manage_playbook"), true);
  });

  it("denies confirm_payment to standard member without explicit capability", () => {
    const memberUser: SafeUser = {
      id: 3,
      email: "member@example.com",
      name: "Member User",
      role: "member",
      tenantId: 1,
      tenantRole: "member",
      capabilities: ["approve_batch"],
    };

    assert.equal(can(memberUser, "approve_batch"), true);
    assert.equal(can(memberUser, "confirm_payment"), false, "Member must NOT have confirm_payment capability");
    assert.equal(can(memberUser, "manage_playbook"), false);
  });

  it("grants confirm_payment to member if explicitly granted in capabilities array", () => {
    const privilegedMember: SafeUser = {
      id: 4,
      email: "accountant@example.com",
      name: "Accountant Member",
      role: "member",
      tenantId: 1,
      tenantRole: "member",
      capabilities: ["confirm_payment"],
    };

    assert.equal(
      can(privilegedMember, "confirm_payment"),
      true,
      "Member with explicit confirm_payment capability must be allowed"
    );
  });

  it("denies all capabilities to viewer role", () => {
    const viewerUser: SafeUser = {
      id: 5,
      email: "viewer@example.com",
      name: "Viewer User",
      role: "viewer",
      tenantId: 1,
      tenantRole: "viewer",
      capabilities: [],
    };

    assert.equal(can(viewerUser, "confirm_payment"), false);
    assert.equal(can(viewerUser, "approve_batch"), false);
  });
});
