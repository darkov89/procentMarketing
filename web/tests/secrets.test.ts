import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  encryptSecret,
  decryptSecret,
  setSecret,
  getSecret,
  hasSecret,
} from "@/lib/secrets";
import { db, tenantSecrets } from "@/lib/db";
import { and, eq } from "drizzle-orm";

describe("Secret Encryption & Management (R9)", () => {
  it("encrypts and decrypts secret symmetrically with AES-256-GCM", () => {
    const plaintext = "SuperSecretPassword123!@#";
    const encrypted = encryptSecret(plaintext);

    assert.notEqual(encrypted.ciphertext, plaintext, "Ciphertext must not be plaintext");
    assert.ok(encrypted.iv, "IV must be generated");
    assert.ok(encrypted.tag, "Auth tag must be generated");
    assert.equal(encrypted.keyVersion, 1);

    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, plaintext, "Decrypted text must match original plaintext");
  });

  it("fails to decrypt if auth tag or ciphertext is tampered", () => {
    const plaintext = "ConfidentialData";
    const encrypted = encryptSecret(plaintext);

    // Tamper with tag
    const tamperedTag = Buffer.from(encrypted.tag, "base64");
    tamperedTag[0] ^= 1;

    assert.throws(
      () => {
        decryptSecret({
          ...encrypted,
          tag: tamperedTag.toString("base64"),
        });
      },
      /Unsupported state or unable to authenticate data/,
      "Tampered auth tag must fail authentication check in AES-GCM"
    );
  });

  it("stores encrypted secret in database without exposing plaintext", async () => {
    const tenantId = 1;
    const secretName = "test_smtp_pass";
    const secretValue = "mypassword_plain_text_never_leak";

    await setSecret(tenantId, secretName, secretValue);

    // Inspect database row directly
    const [row] = await db
      .select()
      .from(tenantSecrets)
      .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, secretName)))
      .limit(1);

    assert.ok(row, "Secret row should be found in database");
    assert.notEqual(row.ciphertext, secretValue, "Database must NOT contain plaintext password");
    assert.ok(!row.ciphertext.includes(secretValue), "Ciphertext must not contain secret");

    // hasSecret and getSecret verification
    const exists = await hasSecret(tenantId, secretName);
    assert.equal(exists, true);

    const retrieved = await getSecret(tenantId, secretName);
    assert.equal(retrieved, secretValue);

    // Cleanup test secret
    await db
      .delete(tenantSecrets)
      .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, secretName)));
  });

  it("supports key rotation by re-encrypting with new key", () => {
    const originalKey = crypto.randomBytes(32);
    const newKey = crypto.randomBytes(32);
    const plaintext = "RotatedSecretValue!";

    // Encrypt with originalKey
    const encryptedV1 = encryptSecret(plaintext, 1, originalKey);
    const decryptedV1 = decryptSecret(encryptedV1, originalKey);
    assert.equal(decryptedV1, plaintext);

    // Re-encrypt with newKey for version 2
    const encryptedV2 = encryptSecret(decryptedV1, 2, newKey);
    assert.equal(encryptedV2.keyVersion, 2);

    // Old key fails to decrypt V2
    assert.throws(() => {
      decryptSecret(encryptedV2, originalKey);
    });

    // New key succeeds
    const decryptedV2 = decryptSecret(encryptedV2, newKey);
    assert.equal(decryptedV2, plaintext);
  });
});
