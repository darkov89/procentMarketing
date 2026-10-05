// web/scripts/migrate_v2_offer_editor.mjs
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
  console.log("🚀 Starting Offer Editor & Sender Profile Migration...");

  // 1. Add sender profile & signature columns to 'offers' table
  console.log("1. Adding signature and sender columns to 'offers' table...");
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255)`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS sender_role VARCHAR(255)`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255)`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(50)`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS sender_company VARCHAR(255)`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS sender_website VARCHAR(255)`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS custom_note TEXT`;
  await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100) DEFAULT 'Umów bezpłatną konsultację'`;

  // 2. Initialize default sender profile in 'app_settings' if not present
  console.log("2. Ensuring default sender_profile exists in 'app_settings'...");
  const defaultProfile = {
    senderName: "Dariusz",
    senderRole: "Założyciel & Strateg B2B",
    senderEmail: "kontakt@procentmarketing.pl",
    senderPhone: "+48 700 000 000",
    senderCompany: "Procent Marketing",
    senderWebsite: "https://procentmarketing.pl",
    bookingUrl: "https://cal.com/procentmarketing/15min",
    customNote: "W razie pytań technicznych dotyczących wstępnej analizy, zapraszam do bezpośredniego kontaktu.",
  };

  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('sender_profile', ${JSON.stringify(defaultProfile)}, NOW())
    ON CONFLICT (key) DO NOTHING
  `;

  // 3. Backfill existing offers with default sender details if null
  console.log("3. Backfilling existing offers with default sender details...");
  await sql`
    UPDATE offers
    SET
      sender_name = COALESCE(sender_name, 'Dariusz'),
      sender_role = COALESCE(sender_role, 'Założyciel & Strateg B2B'),
      sender_email = COALESCE(sender_email, 'kontakt@procentmarketing.pl'),
      sender_company = COALESCE(sender_company, 'Procent Marketing'),
      sender_website = COALESCE(sender_website, 'https://procentmarketing.pl'),
      cta_text = COALESCE(cta_text, 'Umów bezpłatną konsultację')
    WHERE sender_name IS NULL
  `;

  console.log("✅ Offer Editor & Sender Profile Migration finished successfully!");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
