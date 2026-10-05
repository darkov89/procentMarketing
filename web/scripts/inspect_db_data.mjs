import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env.local
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

async function inspect() {
  console.log('=== LEAD STATUS COUNTS ===');
  const leadStatuses = await sql`
    SELECT status, count(*)::int as count 
    FROM leads 
    GROUP BY status 
    ORDER BY count DESC;
  `;
  console.table(leadStatuses);

  console.log('\n=== MESSAGE STATUS & DIRECTION COUNTS ===');
  const messageStatuses = await sql`
    SELECT status, direction, channel, sequence_step, count(*)::int as count 
    FROM messages 
    GROUP BY status, direction, channel, sequence_step 
    ORDER BY sequence_step, status;
  `;
  console.table(messageStatuses);

  console.log('\n=== FIXTURE / DUMMY / TEST LEADS ===');
  const testLeads = await sql`
    SELECT id, company_name, city, email_primary, status, is_fixture 
    FROM leads 
    WHERE is_fixture = true 
       OR company_name ILIKE '%test%' 
       OR company_name ILIKE '%fikcyjn%'
       OR company_name ILIKE '%demo%'
       OR email_primary ILIKE '%test%' 
       OR email_primary ILIKE '%example%'
    LIMIT 20;
  `;
  console.table(testLeads);

  console.log('\n=== LEADS WITH MESSAGES VS LEAD STATUS ===');
  const mismatchLeads = await sql`
    SELECT l.id, l.company_name, l.status as lead_status, l.sequence_step,
           count(m.id)::int as total_msgs,
           count(CASE WHEN m.status = 'sent' THEN 1 END)::int as sent_msgs,
           count(CASE WHEN m.status = 'scheduled' THEN 1 END)::int as scheduled_msgs,
           count(CASE WHEN m.status = 'failed' THEN 1 END)::int as failed_msgs
    FROM leads l
    LEFT JOIN messages m ON m.lead_id = l.id
    GROUP BY l.id, l.company_name, l.status, l.sequence_step
    HAVING count(m.id) > 0
    ORDER BY l.id DESC
    LIMIT 30;
  `;
  console.table(mismatchLeads);

  console.log('\n=== OFFERS COUNT & VIEW STATS ===');
  const offerStats = await sql`
    SELECT count(*)::int as total_offers,
           count(CASE WHEN view_count > 0 THEN 1 END)::int as viewed_offers,
           sum(view_count)::int as total_views,
           max(view_count)::int as max_views
    FROM offers;
  `;
  console.table(offerStats);

  console.log('\n=== RECENT MESSAGES (SAMPLE) ===');
  const recentMsgs = await sql`
    SELECT id, lead_id, direction, status, sequence_step, subject, sent_at, created_at
    FROM messages
    ORDER BY id DESC
    LIMIT 15;
  `;
  console.table(recentMsgs);
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
