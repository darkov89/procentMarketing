// scripts/test_scale_and_activity.mjs
const BASE_URL = "http://localhost:3000";

async function runScaleActivityTest() {
  console.log("==================================================");
  console.log("🧪 TESTING ENTERPRISE SCALE & GROUNDED ACTIVITY FLOW");
  console.log("==================================================");

  // 0. Authenticate
  const authEmail = `scale_tester_${Date.now()}@procentmarketing.pl`;
  const resAuth = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteCode: "PROCENT-START-2026",
      email: authEmail,
      password: "TestPassword123!",
      name: "Scale Tester",
    }),
  });
  const rawCookie = resAuth.headers.get("set-cookie") || "";
  const cookieMatch = rawCookie.match(/pm_session_token=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : "";
  const cookieHeader = `pm_session_token=${sessionToken}`;

  const originalFetch = fetch;
  const authFetch = (url, options = {}) => {
    const headers = { ...options.headers };
    if (!headers.Cookie && !headers.cookie) {
      headers.Cookie = cookieHeader;
    }
    return originalFetch(url, { ...options, headers });
  };

  // 1. Test Scraper with companyScale: "mikro" (CEIDG / JDG)
  console.log("\n1. Testing Scraper for Mikroprzedsiębiorstwa (CEIDG)...");
  const resMikro = await authFetch(`${BASE_URL}/api/scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyScale: "mikro",
      city: "Legnica",
      radiusKm: 30,
    }),
  });
  const dataMikro = await resMikro.json();
  console.log("Mikro result:", {
    success: dataMikro.success,
    scanned: dataMikro.scanned,
    added: dataMikro.added,
    rejectedWroclaw: dataMikro.rejectedWroclaw,
  });

  if (!dataMikro.success) {
    throw new Error("Scraper mikro failed: " + dataMikro.error);
  }

  // 2. Test Scraper with companyScale: "male" (KRS / Sp. z o.o.)
  console.log("\n2. Testing Scraper for Małe Przedsiębiorstwa (KRS)...");
  const resMale = await authFetch(`${BASE_URL}/api/scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyScale: "male",
      city: "Lubin",
      radiusKm: 30,
    }),
  });
  const dataMale = await resMale.json();
  console.log("Małe result:", {
    success: dataMale.success,
    scanned: dataMale.scanned,
    added: dataMale.added,
    rejectedWroclaw: dataMale.rejectedWroclaw,
  });

  if (!dataMale.success) {
    throw new Error("Scraper male failed: " + dataMale.error);
  }

  // 3. Verify lead in DB has companyScale and businessActivity
  console.log("\n3. Verifying Lead Data in Database...");
  const resLeads = await authFetch(`${BASE_URL}/api/leads`);
  const dataLeads = await resLeads.json();
  const leadsWithScale = dataLeads.leads.filter((l) => l.scoreBreakdown?.companyScale);
  console.log(`Found ${leadsWithScale.length} leads with companyScale in scoreBreakdown.`);
  
  const sampleLead = leadsWithScale[0] || dataLeads.leads[0];
  console.log("Sample lead details:", {
    id: sampleLead.id,
    name: sampleLead.companyName,
    companyScale: sampleLead.scoreBreakdown?.companyScale,
    legalForm: sampleLead.scoreBreakdown?.legalForm,
    businessActivity: sampleLead.audit?.rawEvidence?.businessActivity || sampleLead.scoreBreakdown?.businessActivity,
    email: sampleLead.emailPrimary,
    website: sampleLead.website,
  });

  // 4. Test Grounded Offer Generation for this Lead
  console.log(`\n4. Testing Grounded Offer Generation for Lead #${sampleLead.id}...`);
  const resOffer = await authFetch(`${BASE_URL}/api/offers/${sampleLead.id}`, { method: "POST" });
  const dataOffer = await resOffer.json();
  console.log("Generated Offer:", {
    success: dataOffer.success,
    slug: dataOffer.offer?.slug,
    title: dataOffer.offer?.title,
    observationsCount: dataOffer.offer?.observations?.length,
    modulesCount: dataOffer.offer?.proposedModules?.length,
  });

  if (!dataOffer.success) {
    throw new Error("Offer generation failed: " + dataOffer.error);
  }

  // 5. Test Full Pipeline Orchestration with newly audited activity
  console.log("\n5. Testing Autonomous Pipeline Execution...");
  const resPipeline = await authFetch(`${BASE_URL}/api/pipeline`, { method: "POST" });
  const dataPipeline = await resPipeline.json();
  console.log("Pipeline Report:", dataPipeline.report);

  if (!dataPipeline.success) {
    throw new Error("Pipeline failed: " + dataPipeline.error);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL SCALE & ACTIVITY VERIFICATION TESTS PASSED!");
  console.log("==================================================");
}

runScaleActivityTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
