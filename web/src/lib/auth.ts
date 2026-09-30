import crypto from "crypto";
import { cookies } from "next/headers";
import { db, users, invitations, sessions } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE_NAME = "pm_session_token";
export const BOOTSTRAP_INVITE_CODE = process.env.BOOTSTRAP_INVITE_CODE || "PROCENT-START-2026";

export interface SafeUser {
  id: number;
  email: string;
  name: string;
  role: string;
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

  // Check master bootstrap code
  if (trimmed === BOOTSTRAP_INVITE_CODE) {
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
export async function validateSessionToken(token: string): Promise<SafeUser | null> {
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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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

/**
 * Get currently authenticated user in server components and route handlers
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await validateSessionToken(token);
  } catch {
    return null;
  }
}

/**
 * INVARIANT 4: Authentication guard for API routes and server actions.
 * Throws AuthenticationError if not logged in.
 */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthenticationError();
  }
  return user;
}

