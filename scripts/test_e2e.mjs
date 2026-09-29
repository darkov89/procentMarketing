// scripts/test_e2e.mjs
const BASE_URL = "http://localhost:3000";

async function runTest() {
  console.log("==================================================");
  console.log("🚀 STARTING LEAD MACHINE 2.0 FULL END-TO-END TEST");
  console.log("==================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
    }
  }

  // TEST 1: Preset Scraper (Fotowoltaika)
  console.log("\n--- TEST 1: Testing Preset Scraper (Fotowoltaika) ---");
  const resScraper = await fetch(`${BASE_URL}/api/scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword: "Fotowoltaika", city: "Chojnów", radiusKm: 30 }),
  });
  const dataScraper = await resScraper.json();
  console.log("Scraper result:", dataScraper);
  assert(dataScraper.success === true, "Scraper returned success: true");
  assert(dataScraper.scanned > 0, "Scraper scanned regional items");

  // TEST 2: Strict Wrocław Zero Tolerance Check via CSV import
  console.log("\n--- TEST 2: Testing Strict Wrocław Zero Tolerance via CSV import ---");
  const resWroclaw = await fetch(`${BASE_URL}/api/scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      csvItems: [
        {
          companyName: "Barber Shop Wrocław Zero Tolerance Test",
          city: "Wrocław",
          address: "ul. Świdnicka 10, Wrocław",
          phone: "+48 71 333 44 55",
          website: "https://barber-wroclaw-test.pl",
          industry: "Barber",
        },
        {
          companyName: "Legnica Dent Test Sp. z o.o.",
          city: "Legnica",
          address: "ul. Złotoryjska 55, Legnica",
          phone: "+48 76 852 99 99",
          website: "https://dent-legnica-test.pl",
          industry: "Stomatologia",
          nip: "6919998877",
        },
      ],
    }),
  });
  const dataWroclaw = await resWroclaw.json();
  console.log("Wrocław test result:", dataWroclaw);
  assert(dataWroclaw.rejectedWroclaw >= 1, "Wrocław business was STRICTLY REJECTED");

  // TEST 3: Fetch Leads
  console.log("\n--- TEST 3: Fetching Leads from Neon Database ---");
  const resLeads = await fetch(`${BASE_URL}/api/leads`);
  const dataLeads = await resLeads.json();
  assert(dataLeads.success === true, "Leads API returned success");
  assert(Array.isArray(dataLeads.leads) && dataLeads.leads.length > 0, `Neon DB has ${dataLeads.leads?.length} leads`);

  const targetLead =
    dataLeads.leads.find((l) => l.website && l.website.startsWith("http") && l.status === "new") ||
    dataLeads.leads.find((l) => l.website && l.website.startsWith("http")) ||
    dataLeads.leads[0];
  console.log(`Selected Lead for E2E Pipeline: ID #${targetLead.id} - ${targetLead.companyName} (${targetLead.website}) [status=${targetLead.status}]`);

  // TEST 4: Run Web Audit
  console.log(`\n--- TEST 4: Running Web Audit on Lead #${targetLead.id} ---`);
  const resAudit = await fetch(`${BASE_URL}/api/audit/${targetLead.id}`, { method: "POST" });
  const dataAudit = await resAudit.json();
  console.log("Audit result:", dataAudit);
  assert(dataAudit.success === true, "Web audit completed successfully with evidence");

  // TEST 5: Run Qualification
  console.log(`\n--- TEST 5: Running Qualification Matrix on Lead #${targetLead.id} ---`);
  const resQualify = await fetch(`${BASE_URL}/api/qualify/${targetLead.id}`, { method: "POST" });
  const dataQualify = await resQualify.json();
  console.log("Qualify result:", dataQualify);
  assert(dataQualify.success === true, "Qualification matrix calculated score and status");
  assert(typeof dataQualify.lead.score === "number", `Lead received score: ${dataQualify.lead.score} pkt`);

  // TEST 6: Generate Offer
  console.log(`\n--- TEST 6: Generating Offer on Lead #${targetLead.id} ---`);
  const resOffer = await fetch(`${BASE_URL}/api/offers/${targetLead.id}`, { method: "POST" });
  const dataOffer = await resOffer.json();
  console.log("Offer result:", dataOffer);
  assert(dataOffer.success === true, "Offer generated and published");
  assert(!!dataOffer.offer?.slug, `Offer received unique slug: ${dataOffer.offer?.slug}`);

  // TEST 7: View Public Offer Page
  console.log(`\n--- TEST 7: Verifying Public Offer Page /offers/${dataOffer.offer.slug} ---`);
  const resOfferPage = await fetch(`${BASE_URL}/offers/${dataOffer.offer.slug}`);
  const htmlOfferPage = await resOfferPage.text();
  assert(resOfferPage.status === 200, "Offer page returned HTTP 200");
  assert(htmlOfferPage.includes("PROCENT MARKETING"), "Offer page includes Procent Marketing branding");
  assert(htmlOfferPage.includes(targetLead.companyName), "Offer page includes target company name");

  // TEST 8: Send Outreach Email
  console.log(`\n--- TEST 8: Sending Compliant Outreach Email for Lead #${targetLead.id} ---`);
  const resOutreach = await fetch(`${BASE_URL}/api/outreach/${targetLead.id}`, { method: "POST" });
  const dataOutreach = await resOutreach.json();
  console.log("Outreach result:", dataOutreach);
  assert(dataOutreach.success === true, "Outreach dispatch completed");
  assert(dataOutreach.result?.wasTestMode === true, "Sandbox safety confirmed: wasTestMode=true");

  // TEST 8B: Strict Anti-Duplicate Prevention (Cannot send initial email twice)
  console.log(`\n--- TEST 8B: Testing Anti-Duplicate Protection on Lead #${targetLead.id} ---`);
  const resDup = await fetch(`${BASE_URL}/api/outreach/${targetLead.id}`, { method: "POST" });
  const dataDup = await resDup.json();
  console.log("Duplicate check response:", dataDup);
  assert(resDup.status === 400 && dataDup.success === false, "Duplicate initial email unconditionally blocked");
  assert(dataDup.alreadySent === true, "alreadySent flag correctly returned");

  // TEST 8C: Sending AI Follow-up (in the same email thread)
  console.log(`\n--- TEST 8C: Sending AI Follow-up for Lead #${targetLead.id} ---`);
  const resFollowup = await fetch(`${BASE_URL}/api/outreach/${targetLead.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isFollowup: true }),
  });
  const dataFollowup = await resFollowup.json();
  console.log("Follow-up response:", dataFollowup);
  assert(dataFollowup.success === true, "AI Follow-up dispatched successfully in the same thread");
  assert(dataFollowup.isFollowup === true, "Response confirmed as follow-up");

  // TEST 8D: Blocking Second Follow-up (Maximum 1 follow-up permitted)
  console.log(`\n--- TEST 8D: Testing Second Follow-up Block on Lead #${targetLead.id} ---`);
  const resFollowup2 = await fetch(`${BASE_URL}/api/outreach/${targetLead.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isFollowup: true }),
  });
  const dataFollowup2 = await resFollowup2.json();
  console.log("Second follow-up block response:", dataFollowup2);
  assert(resFollowup2.status === 400 && dataFollowup2.success === false, "Second follow-up strictly blocked");

  // TEST 9: Mail Settings API
  console.log("\n--- TEST 9: Getting Mail and API Settings ---");
  const resSettings = await fetch(`${BASE_URL}/api/settings/mail`);
  const dataSettings = await resSettings.json();
  console.log("Settings config:", dataSettings.config);
  assert(dataSettings.success === true, "Mail settings retrieved");
  assert(typeof dataSettings.config?.smtpPort === "number", "SMTP port configured");
  assert(typeof dataSettings.config?.imapPort === "number", "IMAP port configured");

  // TEST 10: Test SMTP endpoint
  console.log("\n--- TEST 10: Testing SMTP Server Check Endpoint ---");
  const resTestSmtp = await fetch(`${BASE_URL}/api/settings/test-smtp`, { method: "POST" });
  const dataTestSmtp = await resTestSmtp.json();
  console.log("SMTP Test result:", dataTestSmtp);
  assert(typeof dataTestSmtp.success === "boolean", "SMTP test endpoint responded with status");

  // TEST 11: Test IMAP endpoint
  console.log("\n--- TEST 11: Testing IMAP Server Check Endpoint ---");
  const resTestImap = await fetch(`${BASE_URL}/api/settings/test-imap`, { method: "POST" });
  const dataTestImap = await resTestImap.json();
  console.log("IMAP Test result:", dataTestImap);
  assert(typeof dataTestImap.success === "boolean", "IMAP test endpoint responded with status");

  // TEST 12: Poll Inbox endpoint
  console.log("\n--- TEST 12: Testing IMAP Poll Inbox Endpoint ---");
  const resPoll = await fetch(`${BASE_URL}/api/inbox/poll`, { method: "POST" });
  const dataPoll = await resPoll.json();
  console.log("Inbox Poll result:", dataPoll);
  assert(typeof dataPoll.success === "boolean", "Inbox poll endpoint responded with status");

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED!`);
  console.log("==================================================");
}

runTest().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
