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

async function runCleanup() {
  console.log('🚀 Rozpoczynanie czyszczenia i normalizacji bazy Neon Postgres...\n');

  // 1. Usunięcie fikcyjnych leadów testowych
  console.log('1. Usuwanie dummy / test fixtures...');
  const deletedTestLeads = await sql`
    DELETE FROM leads 
    WHERE company_name ~* 'test' 
       OR email_primary ~* 'test' 
       OR is_fixture = true
    RETURNING id, company_name;
  `;
  console.log(`   -> Usunięto ${deletedTestLeads.length} fikcyjnych leadów testowych:`, deletedTestLeads.map(l => `#${l.id}: ${l.company_name}`));

  // 2. Usunięcie testowych kont użytkowników z testów E2E
  console.log('\n2. Usuwanie testowych kont użytkowników z testów automatycznych...');
  const deletedUsers = await sql`
    DELETE FROM users 
    WHERE email ~* 'test' 
       OR email ~* 'member_' 
       OR email ~* 'admin_17'
    RETURNING id, email, name;
  `;
  console.log(`   -> Usunięto ${deletedUsers.length} testowych kont. Aktywny właściciel: dariusz.rink@gmail.com`);

  // 3. Usunięcie testowych zaproszeń
  console.log('\n3. Usuwanie testowych zaproszeń...');
  const deletedInvs = await sql`
    DELETE FROM invitations 
    WHERE email ~* 'test' 
       OR email ~* 'member_' 
       OR email ~* 'admin_17'
    RETURNING id, code, email;
  `;
  console.log(`   -> Usunięto ${deletedInvs.length} testowych zaproszeń.`);

  // 4. Usunięcie sandboxowych wiadomości testowych (102 symulacje)
  console.log('\n4. Czyszczenie symulowanych wiadomości sandboxowych z tabeli messages...');
  const deletedMsgs = await sql`
    DELETE FROM messages 
    WHERE message_id LIKE 'sandbox-%' 
       OR direction = 'outbound'
    RETURNING id;
  `;
  console.log(`   -> Usunięto ${deletedMsgs.length} symulowanych wiadomości testowych. Licznik wysyłek zresetowany.`);

  // 5. Normalizacja statusów leadów:
  // A) Leady z wygenerowaną ofertą i prawidłowymi danymi kontaktowymi -> pending_approval
  console.log('\n5. Normalizacja statusów leadów...');
  const updatedToPending = await sql`
    UPDATE leads 
    SET status = 'pending_approval', 
        sequence_step = 0, 
        next_action_at = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id IN (SELECT lead_id FROM offers)
      AND email_primary IS NOT NULL 
      AND email_primary != ''
    RETURNING id;
  `;
  console.log(`   -> Zaktualizowano ${updatedToPending.length} leadów do statusu 'pending_approval' (oczekują na zatwierdzenie człowieka w panelu).`);

  // B) Leady z ofertą ale BEZ adresu e-mail -> needs_review
  const updatedToReview = await sql`
    UPDATE leads 
    SET status = 'needs_review', 
        sequence_step = 0, 
        next_action_at = NULL,
        rejection_reason = 'Brak adresu e-mail - uzupełnij e-mail przed wysyłką oferty',
        updated_at = NOW()
    WHERE id IN (SELECT lead_id FROM offers)
      AND (email_primary IS NULL OR email_primary = '')
    RETURNING id;
  `;
  console.log(`   -> Zaktualizowano ${updatedToReview.length} leadów z ofertą bez e-maila do statusu 'needs_review'.`);

  // C) Leady bez oferty z błędnymi statusami legacy ('sent', 'followup_sent', 'offer_published') -> needs_review lub new
  const updatedLegacy = await sql`
    UPDATE leads 
    SET status = 'new', 
        sequence_step = 0, 
        updated_at = NOW()
    WHERE status IN ('sent', 'followup_sent', 'offer_published')
      AND id NOT IN (SELECT lead_id FROM offers)
    RETURNING id;
  `;
  console.log(`   -> Zaktualizowano ${updatedLegacy.length} leadów bez oferty ze starych statusów do 'new'.`);

  // 6. Upewnienie się że oferty mają czyste metryki i status ready
  console.log('\n6. Weryfikacja ofert w bazie...');
  const updatedOffers = await sql`
    UPDATE offers 
    SET status = 'ready', 
        view_count = 0, 
        last_viewed_at = NULL
    WHERE status != 'ready' OR view_count != 0
    RETURNING id;
  `;
  console.log(`   -> Zsynchronizowano ${updatedOffers.length} ofert ze statusem 'ready'.`);

  // 7. Podsumowanie bazy po czyszczeniu
  console.log('\n=== STAN BAZY PO CZYSZCZENIU ===');
  const finalLeadStatuses = await sql`
    SELECT status, count(*)::int as count 
    FROM leads 
    GROUP BY status 
    ORDER BY count DESC;
  `;
  console.table(finalLeadStatuses);

  const finalCounts = await sql`
    SELECT 
      (SELECT count(*)::int FROM leads) as total_leads,
      (SELECT count(*)::int FROM offers) as total_offers,
      (SELECT count(*)::int FROM messages) as total_messages,
      (SELECT count(*)::int FROM users) as total_users,
      (SELECT count(*)::int FROM contacts) as total_contacts;
  `;
  console.table(finalCounts);

  console.log('\n✅ Czyszczenie i normalizacja zakończone sukcesem!');
}

runCleanup().catch(err => {
  console.error('❌ Błąd czyszczenia bazy:', err);
  process.exit(1);
});
