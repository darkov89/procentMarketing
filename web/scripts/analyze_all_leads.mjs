import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let databaseUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    databaseUrl = line.substring('DATABASE_URL='.length).trim();
    if (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) {
      databaseUrl = databaseUrl.slice(1, -1);
    }
    break;
  }
}

const sql = neon(databaseUrl);

async function analyze() {
  console.log('=== SOURCE NAMES IN LEADS ===');
  const sources = await sql`
    SELECT source_name, count(*)::int as count 
    FROM leads 
    GROUP BY source_name 
    ORDER BY count DESC;
  `;
  console.table(sources);

  console.log('\n=== SAMPLE LEADS PER SOURCE ===');
  const sampleBySource = await sql`
    SELECT DISTINCT ON (source_name) 
      id, company_name, city, email_primary, status, source_name, created_at
    FROM leads
    ORDER BY source_name, id;
  `;
  console.table(sampleBySource);

  console.log('\n=== DUMMY / TEST NAMES DETECTION ===');
  const dummyPatterns = await sql`
    SELECT id, company_name, city, email_primary, status, is_fixture
    FROM leads
    WHERE company_name ~* '(test|demo|fikcyjn|dummy|przykład|sample)'
       OR email_primary ~* '(test|example|fikcyjn|dummy|sample)'
       OR company_name ~ '[0-9]{4,}'
    ORDER BY id;
  `;
  console.table(dummyPatterns);

  console.log('\n=== REAL VS FAKE EMAILS CHECK ===');
  const emailSamples = await sql`
    SELECT id, company_name, email_primary, website, status
    FROM leads
    WHERE email_primary IS NOT NULL
    ORDER BY id DESC
    LIMIT 25;
  `;
  console.table(emailSamples);

  console.log('\n=== LEADS WITH NO EMAIL BUT MARKED SENT ===');
  const sentNoEmail = await sql`
    SELECT id, company_name, city, status, email_primary, sequence_step
    FROM leads
    WHERE status IN ('sent', 'followup_sent') AND (email_primary IS NULL OR email_primary = '')
    ORDER BY id;
  `;
  console.table(sentNoEmail);

  console.log('\n=== MESSAGES IN DB: RECIPIENTS ===');
  const msgRecipients = await sql`
    SELECT DISTINCT ON (lead_id)
      m.id, m.lead_id, l.company_name, m.status as msg_status, m.subject, m.sent_at, m.created_at
    FROM messages m
    JOIN leads l ON l.id = m.lead_id
    ORDER BY lead_id, m.id DESC
    LIMIT 20;
  `;
  console.table(msgRecipients);
}

analyze().catch(console.error);
