import { db, tenants, tenantMembers, leads, users, appSettings } from "../src/lib/db";
import { eq } from "drizzle-orm";

async function seedSzumiLas() {
  console.log("Seeding Fundacja Szumi Las tenant...");

  // 1. Check or Create Tenant
  let [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, "szumi-las"));

  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({
        slug: "szumi-las",
        name: "Fundacja Szumi Las",
        plan: "ngo",
        isActive: true,
        enabledModules: {
          sourcingPlaces: true,
          sourcingCsv: true,
          compliancePke: true,
          outreachMode: "plain",
          callTasksQueue: true,
          dealFinanceTracking: true,
          excludedIndustries: ["alkohol", "hazard", "tytoń", "dorosli"],
          maxDailySends: 5,
        },
      })
      .returning();
    console.log(`✓ Created tenant: ${tenant.name} (ID: ${tenant.id})`);
  } else {
    console.log(`✓ Tenant already exists: ${tenant.name} (ID: ${tenant.id})`);
  }

  // 2. Link Admin User (Darek) to Tenant
  const adminUser = await db.query.users.findFirst({
    where: eq(users.email, "kontakt@procentmarketing.pl"),
  });

  if (adminUser) {
    const existingMember = await db.query.tenantMembers.findFirst({
      where: eq(tenantMembers.userId, adminUser.id),
    });
    if (!existingMember) {
      await db.insert(tenantMembers).values({
        tenantId: tenant.id,
        userId: adminUser.id,
        role: "owner",
      });
      console.log(`✓ Linked admin user to ${tenant.name}`);
    }
  }

  // 3. Sender Profile Configuration
  const senderKey = `sender_profile_${tenant.id}`;
  await db
    .insert(appSettings)
    .values({
      tenantId: tenant.id,
      key: senderKey,
      value: {
        senderName: "Dawid",
        senderCompany: "Fundacja Szumi Las",
        senderRole: "Koordynator Programu Firmy Dzieciom",
        senderEmail: "kontakt@fundacjaszumilas.pl",
        senderPhone: "+48 22 123 45 67",
        senderWebsite: "https://fundacjaszumilas.pl",
        customNote: "Program wakacyjny Firmy Dzieciom (Lato 2027)",
      },
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: {
          senderName: "Dawid",
          senderCompany: "Fundacja Szumi Las",
          senderRole: "Koordynator Programu Firmy Dzieciom",
          senderEmail: "kontakt@fundacjaszumilas.pl",
          senderPhone: "+48 22 123 45 67",
          senderWebsite: "https://fundacjaszumilas.pl",
          customNote: "Program wakacyjny Firmy Dzieciom (Lato 2027)",
        },
      },
    });
  console.log(`✓ Configured sender profile for Dawid / ${tenant.name}`);

  // 4. Outreach Template (Brief Text)
  const templateKey = `initial_template_${tenant.id}`;
  await db
    .insert(appSettings)
    .values({
      tenantId: tenant.id,
      key: templateKey,
      value: {
        subject: "Czy Państwa firma pomoże dzieciom wyjechać na wakacje?",
        bodyText: `Dzień dobry,

piszę w imieniu Fundacji Szumi Las. W programie „Firmy Dzieciom” szukamy firm, które pomogą sfinansować wakacyjny wyjazd dzieciom z rodzin w trudnej sytuacji oraz dzieciom z pieczy zastępczej.

Przygotowujemy się do lata 2027. Chcemy dać dzieciom czas blisko natury, nowe znajomości i wypoczynek, na który bez dodatkowego wsparcia mogłyby nie wyjechać. Firma może pomóc sfinansować jedno lub więcej miejsc albo dołożyć część potrzebnej kwoty.

Czy możemy umówić 10–15 minut rozmowy o tym, czy taka forma wsparcia pasuje do Państwa działań? Jeśli tak, proszę o dogodny termin i numer telefonu lub wskazanie osoby, z którą najlepiej porozmawiać.

Pozdrawiam
Dawid
Fundacja Szumi Las

Jeśli nie chcą Państwo kolejnego kontaktu w tej sprawie, proszę o krótką odpowiedź — odnotujemy to.`,
      },
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: {
          subject: "Czy Państwa firma pomoże dzieciom wyjechać na wakacje?",
          bodyText: `Dzień dobry,

piszę w imieniu Fundacji Szumi Las. W programie „Firmy Dzieciom” szukamy firm, które pomogą sfinansować wakacyjny wyjazd dzieciom z rodzin w trudnej sytuacji oraz dzieciom z pieczy zastępczej.

Przygotowujemy się do lata 2027. Chcemy dać dzieciom czas blisko natury, nowe znajomości i wypoczynek, na który bez dodatkowego wsparcia mogłyby nie wyjechać. Firma może pomóc sfinansować jedno lub więcej miejsc albo dołożyć część potrzebnej kwoty.

Czy możemy umówić 10–15 minut rozmowy o tym, czy taka forma wsparcia pasuje do Państwa działań? Jeśli tak, proszę o dogodny termin i numer telefonu lub wskazanie osoby, z którą najlepiej porozmawiać.

Pozdrawiam
Dawid
Fundacja Szumi Las

Jeśli nie chcą Państwo kolejnego kontaktu w tej sprawie, proszę o krótką odpowiedź — odnotujemy to.`,
        },
      },
    });
  console.log(`✓ Configured initial email template for ${tenant.name}`);

  // 5. Seed 3 Initial Representative CSR Sponsor Leads
  const sampleLeads = [
    {
      companyName: "Grupa CCC S.A.",
      city: "Polkowice",
      nip: "6920000013",
      krs: "0000211692",
      website: "https://corporate.ccc.eu",
      emailPrimary: "csr@ccc.eu",
      phoneNormalized: "+48 76 845 84 00",
      industry: "Handel i Produkcja Obuwia",
      status: "new",
      sourceName: "katalog_csr_polska",
      csrPriority: 1,
      evidenceUrl: "https://corporate.ccc.eu/zrownowazony-rozwoj-spolecznosc",
      evidenceDate: "2026-05-12",
      pkeEmailStatus: "allowed",
      pkePhoneStatus: "needs_review", // Sam mail nie daje uprawnienia do telefonu!
      score: 85,
      scoreBreakdown: {
        rationale: "Firma prowadzi wieloletni program wsparcia domów dziecka i obuwia dla dzieci.",
        priority: 1,
      },
    },
    {
      companyName: "Rabena Logistics Sp. z o.o.",
      city: "Gądki",
      nip: "7770000014",
      website: "https://polska.raben-group.com",
      emailPrimary: "spolecznosc@raben-group.com",
      phoneNormalized: "+48 61 898 80 00",
      industry: "Logistyka i Transport B2B",
      status: "new",
      sourceName: "katalog_csr_polska",
      csrPriority: 2,
      evidenceUrl: "https://polska.raben-group.com/odpowiedzialnosc-spoleczna",
      evidenceDate: "2026-04-20",
      pkeEmailStatus: "allowed",
      pkePhoneStatus: "needs_review",
      score: 70,
      scoreBreakdown: {
        rationale: "Firma posiada dedykowany dział zaangażowania społecznego i przyjmuje wnioski organizacji pożytku publicznego.",
        priority: 2,
      },
    },
    {
      companyName: "Decathlon Outdoor Polska Sp. z o.o.",
      city: "Warszawa",
      nip: "5252255441",
      website: "https://decathlon.pl",
      emailPrimary: "kontakt@decathlon.pl",
      phoneNormalized: "+48 22 500 00 00",
      industry: "Sport i Outdoor",
      status: "new",
      sourceName: "analiza_tematyczna",
      csrPriority: 3,
      evidenceUrl: "https://decathlon.pl/fundacja",
      evidenceDate: "2026-03-10",
      pkeEmailStatus: "needs_review", // Wymaga ręcznej oceny przed wysyłką!
      pkePhoneStatus: "needs_review",
      score: 55,
      scoreBreakdown: {
        rationale: "Dopasowanie branżowe (wypoczynek, sport dla dzieci), wymaga weryfikacji warunków naboru wniosków.",
        priority: 3,
      },
    },
  ];

  for (const sl of sampleLeads) {
    const existing = await db.query.leads.findFirst({
      where: eq(leads.companyName, sl.companyName),
    });
    if (!existing) {
      await db.insert(leads).values({
        tenantId: tenant.id,
        ...sl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✓ Inserted sample CSR lead: ${sl.companyName} (Priorytet ${sl.csrPriority})`);
    }
  }

  console.log("Tenant Fundacja Szumi Las successfully provisioned!");
}

seedSzumiLas().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
