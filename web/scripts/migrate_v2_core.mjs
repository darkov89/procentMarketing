// scripts/migrate_v2_core.mjs
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local or process.env
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  const envPath = path.resolve(process.cwd(), "web/.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
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
  console.log("🚀 Starting G1 Core Database Migration (Non-destructive, additive)...");

  // 1. Extend leads table
  console.log("1. Adding control fields to 'leads' table...");
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMP WITHOUT TIME ZONE`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(100)`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITHOUT TIME ZONE`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_basis VARCHAR(50) DEFAULT 'inquiry'`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_fixture BOOLEAN DEFAULT FALSE NOT NULL`;

  // 2. Extend offers table
  console.log("2. Adding security & token fields to 'offers' table...");
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS token VARCHAR(64) UNIQUE`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS noindex BOOLEAN DEFAULT TRUE NOT NULL`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS evidence_ids JSON`;

  // 3. Extend messages table
  console.log("3. Adding retry, locked, and step fields to 'messages' table...");
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_message TEXT`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITHOUT TIME ZONE`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 0`;

  // 4. Create lead_events table
  console.log("4. Creating 'lead_events' table for immutable state-machine audit trails...");
  await sql`
    CREATE TABLE IF NOT EXISTS lead_events (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      from_status VARCHAR(50) NOT NULL,
      to_status VARCHAR(50) NOT NULL,
      reason TEXT,
      actor VARCHAR(100) DEFAULT 'system' NOT NULL,
      metadata JSON,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;

  // 5. Create jobs table
  console.log("5. Creating 'jobs' table for background worker engine...");
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      payload JSON,
      status VARCHAR(50) DEFAULT 'pending' NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      max_attempts INTEGER DEFAULT 3 NOT NULL,
      last_error TEXT,
      locked_at TIMESTAMP WITHOUT TIME ZONE,
      locked_by VARCHAR(100),
      run_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;

  // 6. Create evidence table
  console.log("6. Creating 'evidence' table for grounding & anti-hallucination...");
  await sql`
    CREATE TABLE IF NOT EXISTS evidence (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      claim_type VARCHAR(100) NOT NULL,
      claim_value TEXT NOT NULL,
      source VARCHAR(100) NOT NULL,
      source_url VARCHAR(512),
      snippet TEXT,
      confidence DOUBLE PRECISION DEFAULT 1.0,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;

  // 7. Create service_catalog table
  console.log("7. Creating 'service_catalog' table for factual agency pricing...");
  await sql`
    CREATE TABLE IF NOT EXISTS service_catalog (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      service_name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      price_unit VARCHAR(50) DEFAULT 'PLN' NOT NULL,
      active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;

  // 8. Populate default Service Catalog (if empty)
  const catCount = await sql`SELECT count(*) FROM service_catalog`;
  if (parseInt(catCount[0].count, 10) === 0) {
    console.log("8. Populating verified service catalog entries...");
    await sql`
      INSERT INTO service_catalog (category, service_name, description, base_price, price_unit) VALUES
      ('Audyt i Analityka', 'Wdrożenie GA4 i Śledzenie Konwersji', 'Konfiguracja Google Analytics 4, śledzenie formularzy kontaktowych, połączeń telefonicznych oraz Google Tag Manager', 1200, 'PLN'),
      ('Automatyzacja Zapytań', 'Kalkulator Zapytań i Rezerwacji Online', 'Interaktywny kalkulator kosztów lub terminarz rezerwacji spotkań zintegrowany ze stroną klienta', 2400, 'PLN'),
      ('Optymalizacja i Mobile', 'Modernizacja Responsywności i Szybkości', 'Optymalizacja Core Web Vitals, dostosowanie do smartfonów i wdrożenie certyfikatu SSL', 1800, 'PLN'),
      ('Lead Nurturing', 'Automatyczny System Obsługi Leadów B2B', 'Automatyczne potwierdzenia zapytań, powiadomienia SMS i integracja z CRM', 2900, 'PLN')
    `;
  }

  // 9. Backfill token for existing offers that don't have one
  console.log("9. Ensuring all existing offers have a 32-char secure token...");
  const crypto = await import("crypto");
  const offersWithoutToken = await sql`SELECT id FROM offers WHERE token IS NULL`;
  for (const off of offersWithoutToken) {
    const token = crypto.randomBytes(16).toString("hex"); // 32 hex chars
    await sql`UPDATE offers SET token = ${token} WHERE id = ${off.id}`;
  }

  console.log("✅ G1 Core Database Migration completed successfully!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
