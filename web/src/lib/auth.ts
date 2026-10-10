import crypto from "crypto";
import { cookies } from "next/headers";
import { db, users, invitations, sessions, tenants, tenantMembers } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "pm_session_token";
export const ACTIVE_TENANT_COOKIE_NAME = "pm_active_tenant_id";
export const BOOTSTRAP_INVITE_CODE = process.env.BOOTSTRAP_INVITE_CODE || "";

export interface SafeUser {
  id: number;
  email: string;
  name: string;
  role: string;
  tenantId?: number;
  tenantSlug?: string;
  tenantName?: string;
  tenantRole?: string;
  capabilities?: string[];
  isSuperAdmin?: boolean;
  createdAt?: Date;
}

/**
 * Hash password using Node.js crypto.scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify password against combined salt:hash
 */
export function verifyPassword(password: string, combined: string): boolean {
  try {
    const parts = combined.split(":");
    if (parts.length !== 2) return false;
    const [salt, expectedHash] = parts;
    const attemptHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(attemptHash, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Generate a random invitation code
 */
export function generateInviteCode(prefix = "inv_"): string {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Validate an invitation code
 */
export async function validateInviteCode(
  code: string,
  userEmail?: string
): Promise<{
  valid: boolean;
  error?: string;
  invitation?: typeof invitations.$inferSelect;
  role: string;
}> {
  const trimmed = (code || "").trim();
  if (!trimmed) {
    return { valid: false, error: "Wymagany jest kod zaproszenia", role: "member" };
  }

  // Check master bootstrap code (only if explicitly set in environment)
  if (BOOTSTRAP_INVITE_CODE && trimmed === BOOTSTRAP_INVITE_CODE) {
    return { valid: true, role: "admin" };
  }

  // Check in invitations table
  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.code, trimmed));

  if (!invite) {
    return { valid: false, error: "Nieprawidłowy kod zaproszenia", role: "member" };
  }

  // Check expiration
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, error: "To zaproszenie wygasło", role: "member" };
  }

  // Check usage limit
  if (invite.usedCount >= invite.maxUses) {
    return { valid: false, error: "To zaproszenie zostało już w pełni wykorzystane", role: "member" };
  }

  // Check targeted email if set
  if (invite.email && userEmail && invite.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
    return {
      valid: false,
      error: `To zaproszenie zostało wystawione wyłącznie dla adresu ${invite.email}`,
      role: "member",
    };
  }

  return { valid: true, invitation: invite, role: invite.role || "member" };
}

/**
 * Create session token in database
 */
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validate session token and return user
 */
export async function validateSessionToken(
  token: string,
  requestedTenantId?: number
): Promise<SafeUser | null> {
  if (!token) return null;

  try {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));

    if (result.length === 0) return null;

    const user = result[0];
    const isSuperAdmin = user.role === "admin";

    // Resolve tenant membership strictly from database
    let tenantInfo: {
      tenantId?: number;
      tenantSlug?: string;
      tenantName?: string;
      tenantRole?: string;
      capabilities?: string[];
    } = {};

    try {
      // 1. Load all memberships of this user for active tenants
      const memberships = await db
        .select({
          tenantId: tenants.id,
          tenantSlug: tenants.slug,
          tenantName: tenants.name,
          tenantIsActive: tenants.isActive,
          tenantRole: tenantMembers.role,
          capabilities: tenantMembers.capabilities,
        })
        .from(tenantMembers)
        .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
        .where(eq(tenantMembers.userId, user.id));

      const activeMemberships = memberships.filter((m) => m.tenantIsActive);

      // 2. Resolve requested or primary tenant
      if (requestedTenantId && Number.isInteger(requestedTenantId)) {
        const matchingMember = activeMemberships.find((m) => m.tenantId === requestedTenantId);
        if (matchingMember) {
          tenantInfo = matchingMember;
        } else if (isSuperAdmin) {
          // Super Admin can switch to ANY active tenant in the database
          const [superTenant] = await db
            .select({
              tenantId: tenants.id,
              tenantSlug: tenants.slug,
              tenantName: tenants.name,
              tenantIsActive: tenants.isActive,
            })
            .from(tenants)
            .where(and(eq(tenants.id, requestedTenantId), eq(tenants.isActive, true)))
            .limit(1);

          if (superTenant) {
            tenantInfo = {
              tenantId: superTenant.tenantId,
              tenantSlug: superTenant.tenantSlug,
              tenantName: superTenant.tenantName,
              tenantRole: "superadmin",
              capabilities: ["*"],
            };
          } else if (activeMemberships.length > 0) {
            // Target tenant not found or inactive; fall back to primary active membership
            tenantInfo = activeMemberships[0];
          }
        } else if (activeMemberships.length > 0) {
          // FAIL-CLOSED: Regular user attempted unauthorized access. Strictly fall back to valid membership.
          tenantInfo = activeMemberships[0];
        }
      } else {
        // No explicit tenant requested: pick first active membership
        if (activeMemberships.length > 0) {
          tenantInfo = activeMemberships[0];
        } else if (isSuperAdmin) {
          // If Super Admin has no explicit memberships, find first active tenant
          const [firstActiveTenant] = await db
            .select({
              tenantId: tenants.id,
              tenantSlug: tenants.slug,
              tenantName: tenants.name,
            })
            .from(tenants)
            .where(eq(tenants.isActive, true))
            .limit(1);

          if (firstActiveTenant) {
            tenantInfo = {
              tenantId: firstActiveTenant.tenantId,
              tenantSlug: firstActiveTenant.tenantSlug,
              tenantName: firstActiveTenant.tenantName,
              tenantRole: "superadmin",
              capabilities: ["*"],
            };
          }
        }
      }
    } catch (err) {
      console.error("Error loading tenant membership:", err);
      // Fail closed on database error: do not grant access to fallback tenant
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin,
      tenantId: tenantInfo.tenantId,
      tenantSlug: tenantInfo.tenantSlug,
      tenantName: tenantInfo.tenantName,
      tenantRole: tenantInfo.tenantRole,
      capabilities: tenantInfo.capabilities || [],
      createdAt: user.createdAt,
    };
  } catch (err) {
    console.error("Error validating session token:", err);
    return null;
  }
}

/**
 * Invalidate session token
 */
export async function deleteSessionToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await db.delete(sessions).where(eq(sessions.token, token));
  } catch (err) {
    console.error("Error deleting session token:", err);
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Wymagane uwierzytelnienie. Zaloguj się.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Brak dostępu do zasobów wybranej organizacji (tenanta).") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function parseCookieHeader(cookieHeader?: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const map: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k && v) map[k] = decodeURIComponent(v);
  }
  return map;
}

/**
 * Get currently authenticated user in server components and route handlers
 */
export async function getCurrentUser(req?: Request): Promise<SafeUser | null> {
  try {
    let token: string | undefined;
    let activeTenantCookie: string | undefined;

    if (req) {
      const cookieHeader = req.headers.get("cookie");
      const parsed = parseCookieHeader(cookieHeader);
      token = parsed[SESSION_COOKIE_NAME];
      activeTenantCookie = parsed[ACTIVE_TENANT_COOKIE_NAME];
    }

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
        activeTenantCookie = activeTenantCookie || cookieStore.get(ACTIVE_TENANT_COOKIE_NAME)?.value;
      } catch {
        // Ignored if outside request context
      }
    }

    if (!token) return null;
    const parsedTenantId = activeTenantCookie ? parseInt(activeTenantCookie, 10) : undefined;
    const requestedTenantId =
      parsedTenantId && !isNaN(parsedTenantId) && parsedTenantId > 0
        ? parsedTenantId
        : undefined;
    return await validateSessionToken(token, requestedTenantId);
  } catch {
    return null;
  }
}

/**
 * INVARIANT 4: Authentication guard for API routes and server actions.
 * Throws AuthenticationError if not logged in.
 */
export async function requireUser(req?: Request): Promise<SafeUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new AuthenticationError();
  }
  return user;
}

/**
 * INVARIANT 4 & R4: Multi-tenant context guard.
 * Returns authenticated user and validated tenantId.
 * Strictly throws AuthorizationError (403) if user is not a member of any tenant.
 */
export async function requireTenant(): Promise<{ user: SafeUser; tenantId: number }> {
  const user = await requireUser();
  if (!user.tenantId) {
    throw new AuthorizationError("Użytkownik nie jest przypisany do żadnej organizacji.");
  }
  return { user, tenantId: user.tenantId };
}

export const ROLE_DEFAULT_CAPABILITIES: Record<string, string[]> = {
  superadmin: ["*"],
  owner: ["*"],
  admin: [
    "approve_batch",
    "manage_playbook",
    "manage_mailbox",
    "manage_team",
    "confirm_payment",
  ],
  member: ["approve_batch"],
  viewer: [],
};

/**
 * Checks whether user possesses a specific capability either directly or through tenantRole.
 */
export function can(user: SafeUser, capability: string): boolean {
  if (!user) return false;

  const userCaps = new Set<string>(user.capabilities || []);
  if (userCaps.has("*") || userCaps.has(capability) || user.isSuperAdmin) {
    return true;
  }

  const role = user.tenantRole || user.role || "viewer";
  const defaultCaps = ROLE_DEFAULT_CAPABILITIES[role] || [];

  return defaultCaps.includes("*") || defaultCaps.includes(capability);
}

/**
 * Guard that verifies both tenant membership and specific capability.
 * Throws AuthorizationError if user does not possess required capability.
 */
export async function requireCapability(
  capability: string
): Promise<{ user: SafeUser; tenantId: number }> {
  const { user, tenantId } = await requireTenant();
  if (!can(user, capability)) {
    throw new AuthorizationError(
      `Brak wymaganego uprawnienia: ${capability}. Skontaktuj się z administratorem.`
    );
  }
  return { user, tenantId };
}


