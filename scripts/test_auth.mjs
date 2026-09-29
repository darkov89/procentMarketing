// scripts/test_auth.mjs
const BASE_URL = "http://localhost:3000";

async function runAuthTests() {
  console.log("==================================================");
  console.log("🔒 TESTING INVITE-ONLY AUTHENTICATION SYSTEM");
  console.log("==================================================");

  let passed = 0;
  let total = 0;
  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
    }
  }

  // 1. Unauthenticated API access check
  console.log("\n1. Testing Unauthenticated API Protection...");
  const resUnauth = await fetch(`${BASE_URL}/api/leads`);
  assert(resUnauth.status === 401, `Unauthenticated /api/leads returned 401 Unauthorized (got ${resUnauth.status})`);

  // 2. Unauthenticated Page Access (Should redirect or load login)
  console.log("\n2. Testing /login and /invite Page Availability...");
  const resLogin = await fetch(`${BASE_URL}/login`);
  assert(resLogin.status === 200, `/login returned HTTP 200`);

  const resInvite = await fetch(`${BASE_URL}/invite?code=TEST-CODE`);
  assert(resInvite.status === 200, `/invite returned HTTP 200`);

  // 3. Public offer access without login
  console.log("\n3. Testing Public Offer Page Accessibility (For leads)...");
  const resOffer = await fetch(`${BASE_URL}/offers/biuro-rachunkowe-bilans-lubin-lubin`);
  assert(resOffer.status === 200, `Public offer page accessible without auth (got ${resOffer.status})`);

  // 4. Register with invalid invite code
  console.log("\n4. Testing Registration with Invalid Invite Code...");
  const resInvalid = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteCode: "INVALID-CODE-XYZ",
      email: "hacker@nieautoryzowany.pl",
      password: "password123",
      name: "Hacker",
    }),
  });
  const dataInvalid = await resInvalid.json();
  assert(dataInvalid.success === false, "Registration with fake invite code was REJECTED");
  assert(dataInvalid.error.includes("Nieprawidłowy"), `Proper error message: '${dataInvalid.error}'`);

  // 5. Register with Master Bootstrap Code
  console.log("\n5. Testing Admin Registration with Bootstrap Code (PROCENT-START-2026)...");
  const adminEmail = `admin_${Date.now()}@procentmarketing.pl`;
  const resAdminReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteCode: "PROCENT-START-2026",
      email: adminEmail,
      password: "SecureAdminPassword2026!",
      name: "Darek Admin",
    }),
  });
  const dataAdminReg = await resAdminReg.json();
  assert(dataAdminReg.success === true, `Admin user registered: ${adminEmail}`);
  assert(dataAdminReg.user?.role === "admin", `User received role: ${dataAdminReg.user?.role}`);

  // Extract session cookie from response
  const rawCookie = resAdminReg.headers.get("set-cookie");
  assert(!!rawCookie && rawCookie.includes("pm_session_token"), "Received pm_session_token cookie");
  const cookieMatch = rawCookie.match(/pm_session_token=([^;]+)/);
  const sessionToken = cookieMatch ? cookieMatch[1] : "";
  const cookieHeader = `pm_session_token=${sessionToken}`;

  // 6. Test /api/auth/me with session cookie
  console.log("\n6. Testing /api/auth/me with Session Cookie...");
  const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  const dataMe = await resMe.json();
  assert(dataMe.success === true, "/api/auth/me authenticated successfully");
  assert(dataMe.user?.email === adminEmail, `Identity matches: ${dataMe.user?.email}`);

  // 7. Test /api/leads with session cookie
  console.log("\n7. Testing Protected /api/leads with Session Cookie...");
  const resLeadsAuth = await fetch(`${BASE_URL}/api/leads`, {
    headers: { Cookie: cookieHeader },
  });
  const dataLeadsAuth = await resLeadsAuth.json();
  assert(resLeadsAuth.status === 200, "Authenticated request to /api/leads returned HTTP 200");
  assert(dataLeadsAuth.success === true, `Loaded ${dataLeadsAuth.leads?.length} leads`);

  // 8. Generate New Single-Use Invitation Link
  console.log("\n8. Generating New Invitation Link as Admin...");
  const inviteTargetEmail = `member_${Date.now()}@procentmarketing.pl`;
  const resCreateInvite = await fetch(`${BASE_URL}/api/auth/invitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      email: inviteTargetEmail,
      role: "member",
      maxUses: 1,
      expiresInDays: 7,
    }),
  });
  const dataCreateInvite = await resCreateInvite.json();
  assert(dataCreateInvite.success === true, "Invitation created successfully");
  assert(!!dataCreateInvite.invitation?.code, `Invite code generated: ${dataCreateInvite.invitation?.code}`);
  assert(!!dataCreateInvite.inviteUrl, `Invite URL generated: ${dataCreateInvite.inviteUrl}`);

  const newInviteCode = dataCreateInvite.invitation.code;

  // 9. Register Member using Generated Invite
  console.log("\n9. Registering Member via Generated Invitation...");
  const resMemberReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteCode: newInviteCode,
      email: inviteTargetEmail,
      password: "MemberPassword2026!",
      name: "Nowy Współpracownik",
    }),
  });
  const dataMemberReg = await resMemberReg.json();
  assert(dataMemberReg.success === true, `Member registered: ${inviteTargetEmail}`);
  assert(dataMemberReg.user?.role === "member", `Member role confirmed: ${dataMemberReg.user?.role}`);

  // 10. Attempt to Reuse 1-Use Invitation (Must Be Rejected)
  console.log("\n10. Testing Anti-Reuse Protection for 1-Use Invitation...");
  const resReuse = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteCode: newInviteCode,
      email: `another_${Date.now()}@procentmarketing.pl`,
      password: "Password123!",
      name: "Intruder",
    }),
  });
  const dataReuse = await resReuse.json();
  assert(dataReuse.success === false, "Reusing single-use invite code was STRICTLY REJECTED");
  assert(dataReuse.error.includes("wykorzystane"), `Rejection reason: '${dataReuse.error}'`);

  // 11. Test Login with Registered Admin Credentials
  console.log("\n11. Testing Login API with Registered Admin Credentials...");
  const resLoginApi = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminEmail,
      password: "SecureAdminPassword2026!",
    }),
  });
  const dataLoginApi = await resLoginApi.json();
  assert(dataLoginApi.success === true, "Login succeeded with valid email and password");
  assert(dataLoginApi.user?.email === adminEmail, "Login returned correct user payload");

  // 12. Test Logout
  console.log("\n12. Testing Logout API...");
  const resLogout = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });
  const dataLogout = await resLogout.json();
  assert(dataLogout.success === true, "Logout returned success");

  // Verify session invalidated
  const resMeAfterLogout = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  assert(resMeAfterLogout.status === 401, "After logout, /api/auth/me returns 401 Unauthorized");

  console.log("\n==================================================");
  console.log(`🏁 AUTH TEST RESULTS: ${passed} / ${total} TESTS PASSED!`);
  console.log("==================================================");
}

runAuthTests().catch((err) => {
  console.error("Auth test error:", err);
  process.exit(1);
});
