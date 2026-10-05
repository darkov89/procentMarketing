import { neon } from '@neondatabase/serverless';
import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf8');
const databaseUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim();
const sql = neon(databaseUrl);

async function plan() {
  console.log('--- 1. JAWNE REKORDY TESTOWE / FIXTURES DO USUNIĘCIA LUB OZNACZENIA ---');
  const testLeads = await sql`
    SELECT id, company_name, email_primary, status, is_fixture
    FROM leads
    WHERE company_name ~* '(test|demo|fikcyjn|dummy)'
       OR email_primary ~* '(test|example)'
    ORDER BY id;
  `;
  console.table(testLeads);

  console.log('--- 2. SYNTETYCZNE LEADY Z NUMERAMI (MOCK GENERATOR) ---');
  const syntheticLeads = await sql`
    SELECT id, company_name, email_primary, status, source_name
    FROM leads
    WHERE company_name ~ 'Grupa [0-9]{4}'
       OR company_name ~ 'Fotowoltaika [0-9]{4}'
    ORDER BY id;
  `;
  console.table(syntheticLeads);

  console.log('--- 3. LEADY ZE STATUSEM SENT / FOLLOWUP_SENT KTÓRE NIE MAJĄ EMAILA ---');
  const sentWithoutEmail = await sql`
    SELECT id, company_name, status, email_primary, 
           (CASE WHEN (SELECT count(*) FROM offers WHERE lead_id = leads.id) > 0 THEN 'has_offer' ELSE 'no_offer' END) as offer_status
    FROM leads
    WHERE status IN ('sent', 'followup_sent') AND (email_primary IS NULL OR email_primary = '')
    ORDER BY id;
  `;
  console.table(sentWithoutEmail);

  console.log('--- 4. LEADY ZE STATUSEM SENT / FOLLOWUP_SENT KTÓRE MAJĄ EMAIL I OFERTĘ (OCZEKUJĄ NA PRAWDZIWĄ WYSYŁKĘ) ---');
  const sentWithOffer = await sql`
    SELECT id, company_name, status, email_primary, 
           (CASE WHEN (SELECT count(*) FROM offers WHERE lead_id = leads.id) > 0 THEN 'has_offer' ELSE 'no_offer' END) as offer_status
    FROM leads
    WHERE status IN ('sent', 'followup_sent') AND email_primary IS NOT NULL AND email_primary != ''
    ORDER BY id
    LIMIT 20;
  `;
  console.table(sentWithOffer);

  console.log('--- 5. LEADY ZE STATUSAMI NIEZGODNYMI Z MASZYNĄ STANÓW ---');
  const invalidStatuses = await sql`
    SELECT status, count(*)::int as count
    FROM leads
    WHERE status NOT IN (
      'new', 'enriching', 'audit_failed', 'needs_review', 'qualified', 'disqualified',
      'offer_ready', 'pending_approval', 'approved', 'in_sequence', 'paused_autoreply',
      'replied_interested', 'replied_question', 'replied_negative', 'needs_human',
      'unsubscribed', 'bounced', 'meeting_booked', 'won', 'lost'
    )
    GROUP BY status;
  `;
  console.table(invalidStatuses);

  console.log('--- 6. PODSUMOWANIE CAŁKOWITEJ LICZBY WIADOMOŚCI W BAZIE ---');
  const msgsTotal = await sql`
    SELECT status, direction, count(*)::int as count
    FROM messages
    GROUP BY status, direction;
  `;
  console.table(msgsTotal);
}

plan().catch(console.error);
