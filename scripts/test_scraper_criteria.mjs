async function run() {
  console.log("🧪 Testing Scraper API with various criteria (Authenticated)...");

  // 1. Authenticate with master bootstrap code
  const email = `test_scraper_${Date.now()}@procentmarketing.pl`;
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteCode: "PROCENT-START-2026",
      email,
      password: "TestPassword123!",
      name: "Scraper Tester",
    }),
  });

  const rawCookie = regRes.headers.get("set-cookie") || "";
  const tokenMatch = rawCookie.match(/pm_session_token=([^;]+)/);
  const cookieHeader = tokenMatch ? `pm_session_token=${tokenMatch[1]}` : "";

  if (!cookieHeader) {
    console.error("❌ Failed to obtain auth cookie:", await regRes.text());
    return;
  }
  console.log("✅ Authenticated successfully as:", email);

  const testCases = [
    { companyScale: "mikro", city: "Lubin", keyword: "transport", radiusKm: 30 },
    { companyScale: "male", city: "Legnica", keyword: "hydraulik", radiusKm: 30 },
    { companyScale: "msp", city: "Jawor", keyword: "fryzjer", radiusKm: 30 },
    { companyScale: "mikro", city: "Polkowice", keyword: "warsztat samochodowy", radiusKm: 30 },
    { companyScale: "male", city: "Chojnów", keyword: "stomatologia", radiusKm: 30 },
  ];

  for (const tc of testCases) {
    console.log(`\n▶ Skanowanie kryteriów: ${tc.companyScale.toUpperCase()} | ${tc.city} | '${tc.keyword}'...`);
    const startTime = Date.now();
    const res = await fetch("http://localhost:3000/api/scraper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(tc),
    });

    const elapsed = Date.now() - startTime;
    if (!res.ok) {
      console.error(`❌ HTTP ${res.status}:`, await res.text());
      continue;
    }

    const data = await res.json();
    console.log(`✅ Zwrócono w ${elapsed}ms:`, {
      success: data.success,
      scanned: data.scanned,
      added: data.added,
      rejectedDuplicates: data.rejectedDuplicates,
      rejectedWroclaw: data.rejectedWroclaw,
      rejectedRadius: data.rejectedRadius,
      sourceEngine: data.sourceEngine,
      emailsScrapedTotal: data.emailsScrapedTotal,
    });

    if (data.addedLeads && data.addedLeads.length > 0) {
      console.log(`   Przykładowy dodany lead (${data.addedLeads.length} dodanych):`);
      const l = data.addedLeads[0];
      console.log(`   - ID: ${l.id} | ${l.companyName}`);
      console.log(`   - Adres: ${l.address} (${l.city})`);
      console.log(`   - WWW: ${l.website} | E-mail: ${l.emailPrimary}`);
      console.log(`   - Skala: ${l.scoreBreakdown?.companyScale} | Forma: ${l.scoreBreakdown?.legalForm}`);
      console.log(`   - Ocena Google: ${l.scoreBreakdown?.googleRating} (${l.scoreBreakdown?.googleReviewsCount} opinii)`);
    } else {
      console.log("   ⚠️ Brak dodanych leadów!");
    }
  }
}

run().catch(console.error);
