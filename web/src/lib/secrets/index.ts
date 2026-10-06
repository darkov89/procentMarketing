import crypto from "crypto";
import { db, tenantSecrets } from "@/lib/db";
import { and, eq } from "drizzle-orm";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_KEY_VERSION = 1;

/**
 * Returns encryption master key buffer (32 bytes) from environment variable SECRETS_ENCRYPTION_KEY.
 * Accepts base64 encoded string or raw 32-character string.
 */
function getMasterKey(): Buffer {
  const rawKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY environment variable is not defined. Required for secret encryption (R9)."
    );
  }

  // If base64 (typically 44 chars with padding), decode
  const buf = Buffer.from(rawKey, "base64");
  if (buf.length === 32) {
    return buf;
  }

  // If utf-8 string with exactly 32 bytes
  const utf8Buf = Buffer.from(rawKey, "utf-8");
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  // Derive 32 bytes via SHA-256 if arbitrary length string is provided
  return crypto.createHash("sha256").update(rawKey).digest();
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 */
export function encryptSecret(
  plaintext: string,
  keyVersion: number = DEFAULT_KEY_VERSION,
  keyOverride?: Buffer
): EncryptedPayload {
  const key = keyOverride || getMasterKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const tag = cipher.getAuthTag().toString("base64");

  return {
    ciphertext,
    iv: iv.toString("base64"),
    tag,
    keyVersion,
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 */
export function decryptSecret(
  payload: { ciphertext: string; iv: string; tag: string; keyVersion?: number },
  keyOverride?: Buffer
): string {
  const key = keyOverride || getMasterKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(payload.ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}

/**
 * Stores or updates an encrypted secret for a specific tenant in the database.
 */
export async function setSecret(
  tenantId: number,
  name: string,
  value: string
): Promise<void> {
  if (!tenantId || !name) {
    throw new Error("tenantId and name are required to set secret");
  }

  const { ciphertext, iv, tag, keyVersion } = encryptSecret(value);

  const existing = await db
    .select({ id: tenantSecrets.id })
    .from(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, name)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(tenantSecrets)
      .set({
        ciphertext,
        iv,
        tag,
        keyVersion,
        updatedAt: new Date(),
      })
      .where(eq(tenantSecrets.id, existing[0].id));
  } else {
    await db.insert(tenantSecrets).values({
      tenantId,
      name,
      ciphertext,
      iv,
      tag,
      keyVersion,
      updatedAt: new Date(),
    });
  }
}

/**
 * Retrieves and decrypts a tenant secret by name. Returns null if not found.
 * Never send returned secret to client / API response!
 */
export async function getSecret(
  tenantId: number,
  name: string
): Promise<string | null> {
  if (!tenantId || !name) return null;

  const rows = await db
    .select({
      ciphertext: tenantSecrets.ciphertext,
      iv: tenantSecrets.iv,
      tag: tenantSecrets.tag,
      keyVersion: tenantSecrets.keyVersion,
    })
    .from(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, name)))
    .limit(1);

  if (rows.length === 0) return null;

  try {
    return decryptSecret(rows[0]);
  } catch (err) {
    console.error(`Failed to decrypt secret ${name} for tenant ${tenantId}:`, err);
    return null;
  }
}

/**
 * Checks whether a tenant has configured a specific secret without decrypting it.
 */
export async function hasSecret(
  tenantId: number,
  name: string
): Promise<boolean> {
  if (!tenantId || !name) return false;

  const rows = await db
    .select({ id: tenantSecrets.id })
    .from(tenantSecrets)
    .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, name)))
    .limit(1);

  return rows.length > 0;
}
