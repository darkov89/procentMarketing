import {
  db,
  tenants,
  tenantMembers,
  users,
  appSettings,
  playbooks,
  playbookVersions,
  campaigns,
  batches,
  leads,
  contacts,
  campaignLeads,
  channelPermissions,
  evidence,
} from "../src/lib/db";
import { eq, and } from "drizzle-orm";
import { SPONSORSHIP_FUNDRAISING_PRESET } from "../src/modules/campaigns/playbook.schema";
import crypto from "crypto";

export async function seedSzumiLas() {
  console.log("Seeding Fundacja Szumi Las tenant and preset sponsorship_fundraising...");

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

  // 2. Playbook & Playbook Version from Preset (Invariant: built from preset, not hardcoded)
  let [playbook] = await db
    .select()
    .from(playbooks)
    .where(and(eq(playbooks.tenantId, tenant.id), eq(playbooks.presetKey, "sponsorship_fundraising")));

  if (!playbook) {
    [playbook] = await db
      .insert(playbooks)
      .values({
        tenantId: tenant.id,
        name: "Program Sponsoringowy - Firmy Dzieciom",
        presetKey: "sponsorship_fundraising",
      })
      .returning();
    console.log(`✓ Created playbook for Szumi Las (ID: ${playbook.id})`);
  }

  let [pbVersion] = await db
    .select()
    .from(playbookVersions)
    .where(eq(playbookVersions.playbookId, playbook.id))
    .limit(1);

  if (!pbVersion) {
    [pbVersion] = await db
      .insert(playbookVersions)
      .values({
        playbookId: playbook.id,
        version: 1,
        definition: SPONSORSHIP_FUNDRAISING_PRESET,
      })
      .returning();
    console.log(`✓ Created playbook version 1 with SPONSORSHIP_FUNDRAISING_PRESET`);
  }

  // 3. Team Users according to Brief & PLAN.md
  // Dawid: campaign owner, approve_batch, verify_channel
  // Jakub: manage_playbook
  // Ania: confirm_payment
  const teamSpecs = [
    {
      name: "Dawid Koordynator",
      email: "dawid@fundacjaszumilas.pl",
      role: "admin",
      capabilities: ["approve_batch", "verify_channel", "campaign_owner"],
    },
    {
      name: "Jakub Doradca",
      email: "jakub@fundacjaszumilas.pl",
      role: "member",
      capabilities: ["manage_playbook"],
    },
    {
      name: "Ania Księgowość",
      email: "ania@fundacjaszumilas.pl",
      role: "member",
      capabilities: ["confirm_payment"],
    },
  ];

  const dummyPasswordHash = crypto.createHash("sha256").update("szumilas2026!demo").digest("hex");
  const createdUsers: Record<string, number> = {};

  for (const spec of teamSpecs) {
    let [user] = await db.select().from(users).where(eq(users.email, spec.email));
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: spec.email,
          name: spec.name,
          role: spec.role,
          passwordHash: dummyPasswordHash,
        })
        .returning();
      console.log(`✓ Created user: ${spec.name} (${spec.email})`);
    }
    createdUsers[spec.email] = user.id;

    // Link membership
    const [membership] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, user.id)));

    if (!membership) {
      await db.insert(tenantMembers).values({
        tenantId: tenant.id,
        userId: user.id,
        role: spec.role,
        capabilities: spec.capabilities,
      });
      console.log(`✓ Linked ${spec.name} to tenant with capabilities: ${spec.capabilities.join(", ")}`);
    }
  }

  // Also link primary admin if exists
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "kontakt@procentmarketing.pl"));

  if (adminUser) {
    const [existingMember] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, adminUser.id)));
    if (!existingMember) {
      await db.insert(tenantMembers).values({
        tenantId: tenant.id,
        userId: adminUser.id,
        role: "owner",
        capabilities: ["*"],
      });
      console.log(`✓ Linked primary admin to ${tenant.name}`);
    }
  }

  // 4. Create Campaign "Firmy Dzieciom 2027"
  let [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, tenant.id), eq(campaigns.name, "Firmy Dzieciom 2027")));

  if (!campaign) {
    [campaign] = await db
      .insert(campaigns)
      .values({
        tenantId: tenant.id,
        name: "Firmy Dzieciom 2027",
        status: "active",
        playbookVersionId: pbVersion.id,
        ownerUserId: createdUsers["dawid@fundacjaszumilas.pl"] || null,
        testMode: true, // R1 / LIVE_MODE safety
        killSwitch: false,
      })
      .returning();
    console.log(`✓ Created Campaign "Firmy Dzieciom 2027" (ID: ${campaign.id})`);
  }

  // 5. Initial Batch of 20 (Brief: firstBatchSize = 20)
  let [batch] = await db
    .select()
    .from(batches)
    .where(eq(batches.campaignId, campaign.id))
    .limit(1);

  if (!batch) {
    [batch] = await db
      .insert(batches)
      .values({
        tenantId: tenant.id,
        campaignId: campaign.id,
        size: 20,
        status: "approved",
        approvedById: createdUsers["dawid@fundacjaszumilas.pl"] || null,
        approvedAt: new Date(),
      })
      .returning();
    console.log(`✓ Created approved batch #${batch.id} for campaign`);
  }

  // 6. Sender Profile in appSettings
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
      target: [appSettings.tenantId, appSettings.key],
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

  // 7. Seed Sample Representative CSR Sponsor Leads
  // INVARIANT 1: isFixture = true (Fixture Isolation, strictly blocks SMTP send)
  const sampleLeads = [
    {
      companyName: "Grupa CCC S.A. [FIXTURE]",
      city: "Polkowice",
      nip: "6920000013",
      krs: "0000211692",
      website: "https://corporate.ccc.eu",
      emailPrimary: "csr@ccc.eu",
      phoneNormalized: "+48 76 845 84 00",
      industry: "Handel i Produkcja Obuwia",
      status: "qualified",
      priority: 1,
      fitReason: "Wspiera dzieci/edukację (wieloletni program wsparcia domów dziecka)",
      evidenceUrl: "https://corporate.ccc.eu/zrownowazony-rozwoj-spolecznosc",
      evidenceDate: "2026-05-12",
      evidenceSnippet: "Wspieramy dzieci i placówki opiekuńczo-wychowawcze w programie Dobre Koki.",
      pkeEmail: "yes" as const,
      pkePhone: "to_check" as const,
      requiresManualReview: false,
    },
    {
      companyName: "Raben Logistics Polska Sp. z o.o. [FIXTURE]",
      city: "Gądki",
      nip: "7770000014",
      website: "https://polska.raben-group.com",
      emailPrimary: "spolecznosc@raben-group.com",
      phoneNormalized: "+48 61 898 80 00",
      industry: "Logistyka i Transport B2B",
      status: "qualified",
      priority: 2,
      fitReason: "Wspiera lokalną społeczność (dział CSR przyjmuje wnioski organizacji pożytku publicznego)",
      evidenceUrl: "https://polska.raben-group.com/odpowiedzialnosc-spoleczna",
      evidenceDate: "2026-04-20",
      evidenceSnippet: "Działamy na rzecz lokalnych społeczności i wspieramy inicjatywy prospołeczne.",
      pkeEmail: "yes" as const,
      pkePhone: "to_check" as const,
      requiresManualReview: false,
    },
    {
      companyName: "Decathlon Outdoor Polska Sp. z o.o. [FIXTURE]",
      city: "Warszawa",
      nip: "5252255441",
      website: "https://decathlon.pl",
      emailPrimary: "kontakt@decathlon.pl",
      phoneNormalized: "+48 22 500 00 00",
      industry: "Sport i Outdoor",
      status: "new",
      priority: 3,
      fitReason: "Dopasowanie tematyczne ogólne (sport i wypoczynek dzieci) - wymaga weryfikacji naboru",
      evidenceUrl: "https://decathlon.pl/fundacja",
      evidenceDate: "2026-03-10",
      evidenceSnippet: "Fundacja Decathlon realizuje projekty aktywizujące sportowo młodzież.",
      pkeEmail: "to_check" as const,
      pkePhone: "to_check" as const,
      requiresManualReview: true, // Priority 3 always requires manual review!
    },
  ];

  for (const sl of sampleLeads) {
    let [lead] = await db
      .select()
      .from(leads)
      .where(
        sl.nip
          ? eq(leads.nip, sl.nip)
          : and(eq(leads.tenantId, tenant.id), eq(leads.companyName, sl.companyName))
      );

    if (lead) {
      await db
        .update(leads)
        .set({ isFixture: true, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
    } else {
      [lead] = await db
        .insert(leads)
        .values({
          tenantId: tenant.id,
          companyName: sl.companyName,
          city: sl.city,
          nip: sl.nip,
          krs: sl.krs || null,
          website: sl.website,
          emailPrimary: sl.emailPrimary,
          phoneNormalized: sl.phoneNormalized,
          industry: sl.industry,
          status: sl.status,
          sourceName: "seed_csr_catalog",
          score: sl.priority === 1 ? 85 : sl.priority === 2 ? 70 : 50,
          csrPriority: sl.priority,
          evidenceUrl: sl.evidenceUrl,
          evidenceDate: sl.evidenceDate,
          pkeEmailStatus: sl.pkeEmail,
          pkePhoneStatus: sl.pkePhone,
          isFixture: true, // Invariant 1
        })
        .returning();
    }

    // Contact
    let [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.leadId, lead.id))
      .limit(1);

    if (!contact) {
      [contact] = await db
        .insert(contacts)
        .values({
          tenantId: tenant.id,
          leadId: lead.id,
          email: sl.emailPrimary,
          phone: sl.phoneNormalized,
          role: "Dział CSR / Zaangażowanie Społeczne",
          source: "seed_csr_catalog",
          confidence: 1.0,
          kind: "email",
          verificationStatus: "verified",
          isPrimary: true,
        })
        .returning();
    }

    // Evidence record
    const [existingEvidence] = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.leadId, lead.id), eq(evidence.tenantId, tenant.id)))
      .limit(1);

    if (!existingEvidence) {
      await db.insert(evidence).values({
        tenantId: tenant.id,
        leadId: lead.id,
        claimType: sl.priority === 1 ? "child_support" : "community_support",
        claimValue: sl.fitReason,
        source: "seed_csr_catalog",
        sourceUrl: sl.evidenceUrl,
        snippet: sl.evidenceSnippet,
        confidence: 1.0,
      });
    }

    // Campaign Lead link
    let [campLead] = await db
      .select()
      .from(campaignLeads)
      .where(and(eq(campaignLeads.campaignId, campaign.id), eq(campaignLeads.leadId, lead.id)))
      .limit(1);

    if (!campLead) {
      [campLead] = await db
        .insert(campaignLeads)
        .values({
          tenantId: tenant.id,
          campaignId: campaign.id,
          leadId: lead.id,
          state: sl.status,
          priority: sl.priority,
          batchId: sl.requiresManualReview ? null : batch.id,
          chosenContactId: contact.id,
          fitReason: sl.fitReason,
          requiresManualReview: sl.requiresManualReview,
        })
        .returning();

      // Channel Permissions per contact
      await db.insert(channelPermissions).values([
        {
          tenantId: tenant.id,
          campaignLeadId: campLead.id,
          contactId: contact.id,
          channel: "email",
          status: sl.pkeEmail,
          rationale: "Publiczny adres dedykowany CSR i wnioskom sponsorskim",
          evidenceUrl: sl.evidenceUrl,
          approvedById: sl.pkeEmail === "yes" ? createdUsers["dawid@fundacjaszumilas.pl"] : null,
          approvedAt: sl.pkeEmail === "yes" ? new Date() : null,
        },
        {
          tenantId: tenant.id,
          campaignLeadId: campLead.id,
          contactId: contact.id,
          channel: "phone",
          status: sl.pkePhone,
          rationale: "Numer centralny - wymaga potwierdzenia zgody przed kontaktem telefonicznym",
          evidenceUrl: sl.evidenceUrl,
        },
      ]);
    }

    console.log(`✓ Seeded CSR sponsor lead: ${sl.companyName} (Priorytet ${sl.priority}, isFixture=true)`);
  }

  console.log("✓ Fundacja Szumi Las tenant successfully seeded!");
  return { tenantId: tenant.id, campaignId: campaign.id };
}

// Allow CLI execution
if (process.argv[1]?.endsWith("seed-szumi-las.ts")) {
  seedSzumiLas()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
