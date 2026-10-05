// web/scripts/migrate_v3_multitenant.mjs
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local or process.env
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const fallbackEnvPath = path.resolve(process.cwd(), "web/.env.local");
  const targetPath = fs.existsSync(envPath) ? envPath : fallbackEnvPath;
  if (fs.existsSync(targetPath)) {
    const content = fs.readFileSync(targetPath, "utf-8");
    const match = content.match(/DATABASE_URL\s*=\s*(.*)/);
    if (match) dbUrl = match[1].trim();
  }
}

if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(dbUrl);

async function migrate() {
  console.log("🚀 Starting Multi-Tenant & Outreach History Migration (v3)...");

  // 1. Create 'tenants' table
  console.log("1. Creating 'tenants' table...");
  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      plan VARCHAR(50) DEFAULT 'pro' NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 2. Create 'tenant_members' table
  console.log("2. Creating 'tenant_members' table...");
  await sql`
    CREATE TABLE IF NOT EXISTS tenant_members (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      role VARCHAR(50) DEFAULT 'owner' NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(tenant_id, user_id)
    )
  `;

  // 3. Insert default tenant (Procent Marketing) if not exists
  console.log("3. Ensuring default tenant 'procent-marketing' exists...");
  await sql`
    INSERT INTO tenants (id, slug, name, plan, is_active)
    VALUES (1, 'procent-marketing', 'Procent Marketing', 'enterprise', true)
    ON CONFLICT (id) DO NOTHING
  `;

  // Also ensure sequence is in sync
  await sql`SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1))`;

  // 4. Add tenant_id column to tables
  console.log("4. Adding tenant_id to leads, contacts, offers, messages, app_settings, suppression, lead_events...");
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE suppression ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE lead_events ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE`;

  // 5. Add offer interaction tracking columns to offers table
  console.log("5. Adding view_count and last_viewed_at to offers table...");
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP`;

  // 6. Associate all existing users with tenant 1 as 'owner' / 'admin'
  console.log("6. Linking existing users to tenant 1 in tenant_members...");
  await sql`
    INSERT INTO tenant_members (tenant_id, user_id, role)
    SELECT 1, id, CASE WHEN role = 'admin' THEN 'owner' ELSE 'member' END
    FROM users
    ON CONFLICT (tenant_id, user_id) DO NOTHING
  `;

  // 7. Backfill all existing leads, contacts, offers, messages with tenant_id = 1
  console.log("7. Backfilling existing data with tenant_id = 1...");
  const updatedLeads = await sql`UPDATE leads SET tenant_id = 1 WHERE tenant_id IS NULL RETURNING id`;
  const updatedContacts = await sql`UPDATE contacts SET tenant_id = 1 WHERE tenant_id IS NULL RETURNING id`;
  const updatedOffers = await sql`UPDATE offers SET tenant_id = 1 WHERE tenant_id IS NULL RETURNING id`;
  const updatedMessages = await sql`UPDATE messages SET tenant_id = 1 WHERE tenant_id IS NULL RETURNING id`;
  await sql`UPDATE app_settings SET tenant_id = 1 WHERE tenant_id IS NULL`;
  await sql`UPDATE lead_events SET tenant_id = 1 WHERE tenant_id IS NULL`;

  console.log(`✅ Backfilled: ${updatedLeads.length} leads, ${updatedContacts.length} contacts, ${updatedOffers.length} offers, ${updatedMessages.length} messages.`);
  console.log("🎉 Multi-tenant Migration v3 completed successfully!");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
