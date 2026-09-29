// scripts/migrate_auth.mjs
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_lTEkwg2CF5oR@ep-round-resonance-b28ccax8.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(connectionString);

async function migrateAuth() {
  console.log("Creating auth tables (users, invitations, sessions)...");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin' NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      email VARCHAR(255),
      role VARCHAR(50) DEFAULT 'member' NOT NULL,
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      max_uses INTEGER DEFAULT 1 NOT NULL,
      used_count INTEGER DEFAULT 0 NOT NULL,
      expires_at TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(128) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    );
  `;

  console.log("Auth tables successfully verified/created.");

  // Check if any invitations exist
  const existingInvites = await sql`SELECT count(*) as count FROM invitations`;
  console.log("Current invitation count:", existingInvites[0].count);

  // If no invitations exist, create a master bootstrap invitation code
  const bootstrapCode = "PROCENT-START-2026";
  const existingMaster = await sql`SELECT * FROM invitations WHERE code = ${bootstrapCode}`;
  if (existingMaster.length === 0) {
    await sql`
      INSERT INTO invitations (code, email, role, max_uses, used_count)
      VALUES (${bootstrapCode}, NULL, 'admin', 999, 0)
    `;
    console.log(`Created bootstrap master invitation code: ${bootstrapCode} (role: admin, reusable)`);
  }

  // Check existing users count
  const existingUsers = await sql`SELECT count(*) as count FROM users`;
  console.log("Current users count:", existingUsers[0].count);

  console.log("Auth migration finished successfully.");
}

migrateAuth().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
