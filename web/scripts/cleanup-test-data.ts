import {
  db,
  tenants,
  users,
  leads,
  campaigns,
  messages,
  suppression,
  blocks,
  leadEvents,
  tasks,
  leadTasks,
  sessions,
  tenantMembers,
} from "../src/lib/db";
import { eq, inArray, or, like, sql, and, ne } from "drizzle-orm";

const PROTECTED_TENANT_SLUGS = ["procent-marketing", "szumi-las"];
const PROTECTED_USER_EMAILS = [
  "dariusz.rink@gmail.com",
  "gornyjakub@gmail.com",
  "dawid@fundacjaszumilas.pl",
  "jakub@fundacjaszumilas.pl",
  "ania@fundacjaszumilas.pl",
];

export async function scanOrCleanTestData(execute = false) {
  console.log(`\n======================================================`);
  console.log(`🔍 LEAD MACHINE - TEST DATA CLEANUP (${execute ? "EXECUTE MODE" : "DRY-RUN / AUDIT MODE"})`);
  console.log(`======================================================\n`);

  // 1. Identify Test Tenants
  const allTenants = await db.select().from(tenants);
  const testTenants = allTenants.filter((t) => {
    if (PROTECTED_TENANT_SLUGS.includes(t.slug)) return false;
    return true; // Any tenant outside protected production tenants is considered a test tenant
  });

  const testTenantIds = testTenants.map((t) => t.id);
  console.log(`🏢 Znaleziono testowych tenantów: ${testTenants.length} (z ${allTenants.length} łącznie)`);
  if (testTenants.length > 0) {
    console.log(`   Przykłady: ${testTenants.slice(0, 5).map((t) => t.slug).join(", ")}...`);
  }

  // 2. Identify Test Leads in Tenant 1 (Procent Marketing)
  const tenant1Leads = await db.select().from(leads).where(eq(leads.tenantId, 1));
  const testLeadsInTenant1 = tenant1Leads.filter(
    (l) =>
      l.sourceName === "test_suite" ||
      l.sourceName === "mock_places" ||
      l.isFixture === true ||
      l.companyName.includes("1791") ||
      l.companyName.includes("Testowa") ||
      l.companyName.startsWith("Firma ")
  );
  const realLeadsInTenant1 = tenant1Leads.filter(
    (l) => !testLeadsInTenant1.some((tl) => tl.id === l.id)
  );

  console.log(`\n📋 Tenant 1 (Procent Marketing) Leady:`);
  console.log(`   - Prawdziwe leady (do ZACHOWANIA): ${realLeadsInTenant1.length} (np. ${realLeadsInTenant1.slice(0, 3).map((l) => l.companyName).join(", ")})`);
  console.log(`   - Testowe leady (do USUNIĘCIA): ${testLeadsInTenant1.length} (${testLeadsInTenant1.map((l) => `${l.id}: ${l.companyName}`).join(", ")})`);

  // 3. Identify Test Campaigns in Tenant 1
  const tenant1Campaigns = await db.select().from(campaigns).where(eq(campaigns.tenantId, 1));
  const testCampaignsInTenant1 = tenant1Campaigns.filter(
    (c) =>
      c.name.startsWith("Kampania z limitem skrzynki") ||
      c.name.startsWith("Kampania Fundacji") ||
      c.name.startsWith("Kampania Agencji") ||
      c.name.includes("1791")
  );
  const realCampaignsInTenant1 = tenant1Campaigns.filter(
    (c) => !testCampaignsInTenant1.some((tc) => tc.id === c.id)
  );
  console.log(`\n🎯 Tenant 1 Kampanie:`);
  console.log(`   - Główne kampanie (do ZACHOWANIA): ${realCampaignsInTenant1.length} (${realCampaignsInTenant1.map((c) => c.name).join(", ")})`);
  console.log(`   - Testowe kampanie z testów (do USUNIĘCIA): ${testCampaignsInTenant1.length}`);

  // 4. Identify Test Messages in Tenant 1
  const tenant1Messages = await db.select().from(messages).where(eq(messages.tenantId, 1));
  const testMessagesInTenant1 = tenant1Messages.filter(
    (m) =>
      testLeadsInTenant1.some((tl) => tl.id === m.leadId) ||
      m.subject === "Test limitu skrzynki" ||
      m.idempotencyKey?.includes("test")
  );
  console.log(`\n✉️ Tenant 1 Wiadomości:`);
  console.log(`   - Testowe wiadomości (do USUNIĘCIA): ${testMessagesInTenant1.length}`);

  // 5. Identify Test Suppression & Blocks
  const testSuppression = await db
    .select()
    .from(suppression)
    .where(
      or(
        inArray(suppression.tenantId, testTenantIds.length > 0 ? testTenantIds : [-1]),
        like(suppression.rawIdentifier, "%test%"),
        like(suppression.rawIdentifier, "%domena-testowa.pl%")
      )
    );
  console.log(`\n🚫 Suppression & Blocks:`);
  console.log(`   - Testowe wpisy suppression (do USUNIĘCIA): ${testSuppression.length}`);

  // 6. Identify Test Users
  const allUsers = await db.select().from(users);
  const testUsers = allUsers.filter(
    (u) =>
      !PROTECTED_USER_EMAILS.includes(u.email.toLowerCase()) &&
      (u.email.includes("test") || u.email.includes("curltest"))
  );
  console.log(`\n👤 Użytkownicy:`);
  console.log(`   - Prawdziwi użytkownicy (do ZACHOWANIA): ${allUsers.length - testUsers.length} (${PROTECTED_USER_EMAILS.join(", ")})`);
  console.log(`   - Testowi użytkownicy (do USUNIĘCIA): ${testUsers.length} (${testUsers.map((u) => u.email).join(", ")})`);

  if (!execute) {
    console.log(`\n------------------------------------------------------`);
    console.log(`⚠️ TRYB PODGLĄDU (DRY-RUN): Żadne dane nie zostały usunięte.`);
    console.log(`   Aby wykonać bezpieczne czyszczenie, uruchom skrypt z flagą --execute.`);
    console.log(`------------------------------------------------------\n`);
    return {
      testTenantsCount: testTenants.length,
      testLeadsCount: testLeadsInTenant1.length,
      testCampaignsCount: testCampaignsInTenant1.length,
      testMessagesCount: testMessagesInTenant1.length,
      testSuppressionCount: testSuppression.length,
      testUsersCount: testUsers.length,
      realLeadsKept: realLeadsInTenant1.length,
      realCampaignsKept: realCampaignsInTenant1.length,
    };
  }

  // EXECUTE CLEANUP
  console.log(`\n🚀 ROZPOCZYNAM CZYSZCZENIE BAZY DANYCH...`);

  // A. Delete test messages in Tenant 1
  if (testMessagesInTenant1.length > 0) {
    const ids = testMessagesInTenant1.map((m) => m.id);
    await db.delete(messages).where(inArray(messages.id, ids));
    console.log(`✓ Usunięto ${ids.length} testowych wiadomości w Tenant 1.`);
  }

  // B. Delete test leads in Tenant 1 (cascades to contacts, audits, events)
  if (testLeadsInTenant1.length > 0) {
    const ids = testLeadsInTenant1.map((l) => l.id);
    await db.delete(leads).where(inArray(leads.id, ids));
    console.log(`✓ Usunięto ${ids.length} testowych leadów w Tenant 1.`);
  }

  // C. Delete test campaigns in Tenant 1
  if (testCampaignsInTenant1.length > 0) {
    const ids = testCampaignsInTenant1.map((c) => c.id);
    await db.delete(campaigns).where(inArray(campaigns.id, ids));
    console.log(`✓ Usunięto ${ids.length} testowych kampanii w Tenant 1.`);
  }

  // D. Delete test suppression & test blocks
  if (testSuppression.length > 0) {
    const hashes = testSuppression.map((s) => s.hash).filter(Boolean);
    const ids = testSuppression.map((s) => s.id);
    await db.delete(suppression).where(inArray(suppression.id, ids));
    if (hashes.length > 0) {
      await db.delete(blocks).where(inArray(blocks.hash, hashes));
    }
    console.log(`✓ Usunięto ${ids.length} wpisów testowych z suppression i blocks.`);
  }

  // E. Delete test tenants (Postgres CASCADE deletes leads, campaigns, playbooks, members)
  if (testTenants.length > 0) {
    await db.delete(tenants).where(inArray(tenants.id, testTenantIds));
    console.log(`✓ Usunięto ${testTenants.length} testowych tenantów (wraz z powiązanymi danymi CASCADE).`);
  }

  // F. Delete test users
  if (testUsers.length > 0) {
    const userIds = testUsers.map((u) => u.id);
    await db.delete(sessions).where(inArray(sessions.userId, userIds));
    await db.delete(tenantMembers).where(inArray(tenantMembers.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
    console.log(`✓ Usunięto ${testUsers.length} testowych kont użytkowników.`);
  }

  console.log(`\n======================================================`);
  console.log(`✅ CZYSZCZENIE ZAKOŃCZONE SUKCESEM!`);
  console.log(`   Baza danych jest czysta i gotowa na produkcyjne dodawanie tenantów.`);
  console.log(`======================================================\n`);

  return {
    success: true,
  };
}

// Direct execution
if (process.argv[1]?.endsWith("cleanup-test-data.ts")) {
  const execute = process.argv.includes("--execute") || process.argv.includes("--force");
  scanOrCleanTestData(execute)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Cleanup error:", err);
      process.exit(1);
    });
}
