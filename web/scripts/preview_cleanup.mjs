import { neon } from '@neondatabase/serverless';
import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf8');
const databaseUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim();
const sql = neon(databaseUrl);

async function preview() {
  console.log('=== KROK 1: IDENTYFIKACJA DUMMY / TEST FIXTURES DO USUNIĘCIA ===');
  const dummyLeads = await sql`
    SELECT id, company_name, email_primary, status, source_name
    FROM leads
    WHERE company_name ~* 'test' OR email_primary ~* 'test'
    ORDER BY id;
  `;
  console.table(dummyLeads);

  console.log('=== KROK 2: IDENTYFIKACJA TESTOWYCH UŻYTKOWNIKÓW DO USUNIĘCIA ===');
  const dummyUsers = await sql`
    SELECT id, email, name, role
    FROM users
    WHERE email ~* 'test' OR email ~* 'member_' OR email ~* 'admin_17'
    ORDER BY id;
  `;
  console.table(dummyUsers);

  console.log('=== KROK 3: LEADY, KTÓRE PRZEJDĄ DO PENDING_APPROVAL (MAJĄ OFERTĘ I EMAIL) ===');
  const toPendingApproval = await sql`
    SELECT count(*)::int as count
    FROM leads l
    JOIN offers o ON o.lead_id = l.id
    WHERE l.email_primary IS NOT NULL 
      AND l.email_primary != ''
      AND l.company_name !~* 'test'
      AND (l.email_primary !~* 'test' OR l.email_primary IS NULL);
  `;
  console.log('Liczba leadów gotowych do zatwierdzenia (pending_approval):', toPendingApproval[0].count);

  console.log('=== KROK 4: LEADY, KTÓRE PRZEJDĄ DO NEEDS_REVIEW (MAJĄ OFERTĘ, ALE BRAK EMAILA) ===');
  const toNeedsReview = await sql`
    SELECT count(*)::int as count
    FROM leads l
    JOIN offers o ON o.lead_id = l.id
    WHERE (l.email_primary IS NULL OR l.email_primary = '')
      AND l.company_name !~* 'test';
  `;
  console.log('Liczba leadów z ofertą bez e-maila (needs_review):', toNeedsReview[0].count);

  console.log('=== KROK 5: PODSUMOWANIE STATUSÓW PO CZYSZCZENIU ===');
  console.log('- pending_approval: oferty wygenerowane, czekają na akceptację człowieka w panelu');
  console.log('- needs_review: leady wymagające weryfikacji / wpisania e-maila');
  console.log('- new: świeżo pobrane leady');
  console.log('- qualified: leady zakwalifikowane przed wygenerowaniem oferty');
  console.log('- disqualified: leady niespełniające kryteriów B2B');
  console.log('- messages: usunięcie 102 wiadomości testowych z sandbox-id, reset licznika do 0');
}

preview().catch(console.error);
