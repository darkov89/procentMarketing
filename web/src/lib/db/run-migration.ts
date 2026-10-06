import { neon } from "@neondatabase/serverless";

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = neon(connectionString);

  console.log("Starting Neon database schema migration...");

  // 1. Add enabled_modules to tenants
  await sql`
    ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS enabled_modules jsonb NOT NULL 
    DEFAULT '{"sourcingPlaces":true,"sourcingCsv":true,"compliancePke":false,"outreachMode":"offer_page","callTasksQueue":false,"dealFinanceTracking":false,"excludedIndustries":[],"maxDailySends":15}'::jsonb;
  `;
  console.log("✓ Added enabled_modules to tenants");

  // 2. Add PKE and CSR fields to leads
  await sql`
    ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS pke_email_status varchar(50) DEFAULT 'needs_review',
    ADD COLUMN IF NOT EXISTS pke_phone_status varchar(50) DEFAULT 'needs_review',
    ADD COLUMN IF NOT EXISTS csr_priority integer,
    ADD COLUMN IF NOT EXISTS evidence_url text,
    ADD COLUMN IF NOT EXISTS evidence_date varchar(50);
  `;
  console.log("✓ Added PKE and CSR columns to leads");

  // 3. Create lead_tasks table
  await sql`
    CREATE TABLE IF NOT EXISTS lead_tasks (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      assigned_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      task_type varchar(50) NOT NULL DEFAULT 'call',
      title varchar(255) NOT NULL,
      due_at timestamp NOT NULL,
      status varchar(50) NOT NULL DEFAULT 'pending',
      outcome varchar(100),
      notes text,
      created_at timestamp NOT NULL DEFAULT NOW(),
      completed_at timestamp
    );
  `;
  console.log("✓ Created lead_tasks table");

  // 4. Create lead_deals table
  await sql`
    CREATE TABLE IF NOT EXISTS lead_deals (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      declared_amount double precision DEFAULT 0,
      expected_payment_at timestamp,
      paid_amount double precision DEFAULT 0,
      paid_confirmed_at timestamp,
      confirmed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
      status varchar(50) NOT NULL DEFAULT 'declared',
      notes text,
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✓ Created lead_deals table");

  console.log("Migration completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
