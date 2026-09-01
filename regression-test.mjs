/**
 * DAC Inspection App — Full System Regression Test Suite
 * Validates the updated Auth, Permission Gating, Signature Sequence, and Multi-Level Approvals.
 *
 * Run: node regression-test.mjs
 */

const BASE = "http://localhost:3000";

let passed = 0, failed = 0, warned = 0;
const results = [];

function color(code, text) { return `\x1b[${code}m${text}\x1b[0m`; }
const green  = (t) => color(32, t);
const red    = (t) => color(31, t);
const yellow = (t) => color(33, t);
const cyan   = (t) => color(36, t);
const bold   = (t) => color(1,  t);
const dim    = (t) => color(2,  t);

function log(icon, label, detail = "") {
  console.log(`  ${icon} ${label}${detail ? dim("  ->  " + detail) : ""}`);
}

function assert(name, condition, detail = "", warn = false) {
  if (condition) {
    passed++;
    log(green("PASS"), green(name), detail);
    results.push({ name, ok: true, detail });
  } else if (warn) {
    warned++;
    log(yellow("WARN"), yellow(name), detail);
    results.push({ name, ok: "warn", detail });
  } else {
    failed++;
    log(red("FAIL"), red(name), detail);
    results.push({ name, ok: false, detail });
  }
}

function section(title) {
  console.log(`\n${bold(cyan("== " + title + " =="))}`);
}

async function req(method, path, body, cookie = "") {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, opts);
  const ms = Date.now() - t0;

  // Extract set-cookie header
  const setCookie = res.headers.get("set-cookie") || "";
  let sessionCookie = "";
  if (setCookie) {
    const match = setCookie.match(/dac_session=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, ms, sessionCookie };
}

// ── Test Users ─────────────────────────────────────────────────────────────
const USERS = {
  techExec:    { name: "Raj",               number: "1001", password: "TechExec@1001", role: "Technical Executive" },
  siteEng:     { name: "Arun",              number: "1002", password: "SiteEng@1002",  role: "Site Engineer" },
  qaqc:        { name: "Kumar",             number: "1003", password: "QAQC@1003",     role: "QA/QC In-Charge" },
  customer:    { name: "Priya",             number: "1004", password: "Customer@1004", role: "Customer" },
  pm:          { name: "Project Manager",   number: "1005", password: "PM@1005",       role: "Project Manager" },
  manTech:     { name: "Manager Technical", number: "1006", password: "ManTech@1006",  role: "Manager Technical" },
  gmHug:       { name: "GM HUG",            number: "1007", password: "GM@1007",       role: "GM – HUG" },
  vpHug:       { name: "VP HUG",            number: "1008", password: "VP@1008",       role: "VP – HUG" },
  admin:       { name: "Administrator",     number: "9990", password: "Admin@9990",    role: "Admin" },
  inactive:    { name: "Disabled User",     number: "0000", password: "Inactive@0000", role: "QA/QC In-Charge" },
};

function makeInspection(id) {
  const now = new Date();
  return {
    inspectionId: id,
    projectName: "DAC Test Square",
    unitNumber: "U-101",
    inspectionType: "INTERIOR JOINT INSPECTION",
    customerName: "Priya",
    inspectionDate: now.toISOString().slice(0, 10),
    inspectionTime: now.toTimeString().slice(0, 5),
    customerVerificationPhoto: "data:image/png;base64,iVBORw0KGgo=",
    cells: {},
    signatures: {},
    approvalHistory: [],
    generalRemarks: "Automated regression test inspection",
  };
}

// ── 1. Authentication Model Tests ──────────────────────────────────────────
async function testAuthentication() {
  section("1. AUTHENTICATION MODEL (Google Sheet Column G Password Verification)");

  // 1a. Missing password / parameters -> 400
  let r = await req("POST", "/api/auth", {});
  assert("Missing credentials rejected -> 400", r.status === 400, `status: ${r.status}`);

  // 1b. Fake/invalid password is rejected -> 401
  r = await req("POST", "/api/auth", { userName: "Raj", password: "WrongPassword123" });
  assert("Wrong password rejected -> 401", r.status === 401, `status: ${r.status}`);

  // 1c. Technical Executive password login (from column G of Users tab)
  r = await req("POST", "/api/auth", { userName: USERS.techExec.name, password: USERS.techExec.password });
  assert("Valid password login: Technical Executive (Raj + TechExec@1001)", r.status === 200 && r.json?.ok === true && r.json?.role === "Technical Executive", `${r.status} role: ${r.json?.role}`);
  assert("Technical Executive issued dac_session cookie", !!r.sessionCookie, r.sessionCookie?.slice(0, 35) + "...");
  const techExecCookie = r.sessionCookie;

  // 1d. Site Engineer password login
  r = await req("POST", "/api/auth", { userName: USERS.siteEng.name, password: USERS.siteEng.password });
  assert("Valid password login: Site Engineer (Arun + SiteEng@1002)", r.status === 200 && r.json?.role === "Site Engineer", `${r.status}`);

  // 1e. Customer password login
  r = await req("POST", "/api/auth", { userName: USERS.customer.name, password: USERS.customer.password });
  assert("Valid password login: Customer (Priya + Customer@1004)", r.status === 200 && r.json?.role === "Customer", `${r.status}`);

  // 1f. QA/QC In-Charge password login
  r = await req("POST", "/api/auth", { userName: USERS.qaqc.name, password: USERS.qaqc.password });
  assert("Valid password login: QA/QC In-Charge (Kumar + QAQC@1003)", r.status === 200 && r.json?.role === "QA/QC In-Charge", `${r.status}`);

  // 1g. Project Manager password login
  r = await req("POST", "/api/auth", { userName: USERS.pm.name, password: USERS.pm.password });
  assert("Valid password login: Project Manager (PM@1005)", r.status === 200 && r.json?.role === "Project Manager", `${r.status}`);

  // 1h. Manager Technical password login
  r = await req("POST", "/api/auth", { userName: USERS.manTech.name, password: USERS.manTech.password });
  assert("Valid password login: Manager Technical (ManTech@1006)", r.status === 200 && r.json?.role === "Manager Technical", `${r.status}`);

  // 1i. GM – HUG password login
  r = await req("POST", "/api/auth", { userName: USERS.gmHug.name, password: USERS.gmHug.password });
  assert("Valid password login: GM – HUG (GM@1007)", r.status === 200, `${r.status}`);

  // 1j. VP – HUG password login
  r = await req("POST", "/api/auth", { userName: USERS.vpHug.name, password: USERS.vpHug.password });
  assert("Valid password login: VP – HUG (VP@1008)", r.status === 200, `${r.status}`);

  // 1k. Admin password login (via name or email)
  r = await req("POST", "/api/auth", { userName: USERS.admin.name, password: USERS.admin.password });
  assert("Valid password login: Admin (Administrator + Admin@9990)", r.status === 200 && r.json?.role === "Admin", `${r.status}`);

  // 1l. Admin password login via Email
  r = await req("POST", "/api/auth", { email: "admin@dac.com", password: USERS.admin.password });
  assert("Valid password login: Admin via Email (admin@dac.com)", r.status === 200 && r.json?.role === "Admin", `${r.status}`);

  // 1m. Inactive user -> 401
  r = await req("POST", "/api/auth", { userName: USERS.inactive.name, password: USERS.inactive.password });
  assert("Inactive user password login -> 401", r.status === 401, `${r.status}`);

  // 1n. Session check endpoint GET /api/auth
  r = await req("GET", "/api/auth", undefined, techExecCookie);
  assert("GET /api/auth with session cookie -> 200 (authenticated)", r.status === 200 && r.json?.authenticated === true, `${r.status} name: ${r.json?.user?.name}`);

  // 1o. Session check without cookie -> 401
  r = await req("GET", "/api/auth");
  assert("GET /api/auth without cookie -> 401", r.status === 401, `${r.status}`);
}

// ── 2. Inspection Creation & Submit Permissions ────────────────────────────
async function testCreationPermissions() {
  section("2. INSPECTION CREATION PERMISSIONS (Only Admin & Technical Executive)");

  // Login as Site Engineer
  let seAuth = await req("POST", "/api/auth", { userName: USERS.siteEng.name, password: USERS.siteEng.password });
  const seCookie = seAuth.sessionCookie;

  // Login as QA/QC
  let qaqcAuth = await req("POST", "/api/auth", { userName: USERS.qaqc.name, password: USERS.qaqc.password });
  const qaqcCookie = qaqcAuth.sessionCookie;

  // Login as Technical Executive
  let teAuth = await req("POST", "/api/auth", { userName: USERS.techExec.name, password: USERS.techExec.password });
  const teCookie = teAuth.sessionCookie;

  // Login as Admin
  let adminAuth = await req("POST", "/api/auth", { userName: USERS.admin.name, password: USERS.admin.password });
  const adminCookie = adminAuth.sessionCookie;

  // 2a. Unauthenticated submit attempt -> 401
  const testId1 = `REG-TEST-UNAUTH-${Date.now()}`;
  let r = await req("POST", "/api/submit", makeInspection(testId1));
  assert("Unauthenticated submit -> 401", r.status === 401, `${r.status}`);

  // 2b. Site Engineer creation attempt -> 403 FORBIDDEN
  const testId2 = `REG-TEST-SE-${Date.now()}`;
  r = await req("POST", "/api/submit", makeInspection(testId2), seCookie);
  assert("Site Engineer cannot create inspection -> 403 Forbidden", r.status === 403, `${r.status} msg: ${r.json?.error}`);

  // 2c. QA/QC creation attempt -> 403 FORBIDDEN
  const testId3 = `REG-TEST-QAQC-${Date.now()}`;
  r = await req("POST", "/api/submit", makeInspection(testId3), qaqcCookie);
  assert("QA/QC cannot create inspection -> 403 Forbidden", r.status === 403, `${r.status} msg: ${r.json?.error}`);

  // 2d. Technical Executive creation attempt -> 200 OK
  const testId4 = `REG-TEST-TE-${Date.now()}`;
  r = await req("POST", "/api/submit", makeInspection(testId4), teCookie);
  assert("Technical Executive can create inspection -> 200 OK", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);

  // 2e. Admin creation attempt -> 200 OK
  const testId5 = `REG-TEST-ADMIN-${Date.now()}`;
  r = await req("POST", "/api/submit", makeInspection(testId5), adminCookie);
  assert("Admin can create inspection -> 200 OK", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
}

// ── 3. Draft Autosave & Recovery ───────────────────────────────────────────
async function testDraftAutosave() {
  section("3. DRAFT SAVING & RETRIEVAL (Session-Protected)");

  let teAuth = await req("POST", "/api/auth", { userName: USERS.techExec.name, password: USERS.techExec.password });
  const teCookie = teAuth.sessionCookie;

  const draftId = `REG-DRAFT-${Date.now()}`;

  // 3a. Save draft without session -> 401
  let r = await req("POST", "/api/draft", makeInspection(draftId));
  assert("Draft save without session -> 401", r.status === 401, `${r.status}`);

  // 3b. Save draft with session -> 200
  r = await req("POST", "/api/draft", makeInspection(draftId), teCookie);
  assert("Draft save with valid session -> 200", r.status === 200, `${r.status}`);

  // 3c. Retrieve draft
  r = await req("GET", `/api/draft?inspectionId=${draftId}`);
  assert("GET /api/draft retrieves stored draft -> 200", r.status === 200 && r.json?.data?.inspectionId === draftId, `${r.status}`);
}

// ── 4. End-to-End Signature Sequence & Approval Flow ───────────────────────
async function testEndToEndWorkflow() {
  section("4. NEW SIGNATURE SEQUENCE & MULTI-LEVEL APPROVAL FLOW");

  // Authenticate all test roles using password matched against Google Sheets column G
  const cookies = {};
  for (const [key, user] of Object.entries(USERS)) {
    const auth = await req("POST", "/api/auth", { userName: user.name, password: user.password });
    cookies[key] = auth.sessionCookie;
  }

  const inspId = `REG-FLOW-${Date.now()}`;

  // Step 1: Technical Executive creates & submits the inspection
  let insp = makeInspection(inspId);
  let r = await req("POST", "/api/submit", insp, cookies.techExec);
  assert("1. Technical Executive submits inspection -> 200", r.status === 200, `workflowStatus: ${r.json?.workflowStatus}`);
  assert("Initial workflowStatus is SPOT_SIGNATURE_PENDING", r.json?.workflowStatus === "SPOT_SIGNATURE_PENDING", r.json?.workflowStatus);

  // Step 2: GATING TEST: Site Engineer tries to sign before Level 1 (Tech Exec + Customer) sign -> 400
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Site engineer attempting premature sign",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.siteEng);
  assert("Gate: Site Engineer cannot sign before Level 1 signatures -> 400", r.status === 400, `${r.status} msg: ${r.json?.error}`);

  // Step 3: GATING TEST: QA/QC tries to approve before Level 1 & Level 2 -> 400
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "QA attempting premature approval",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.qaqc);
  assert("Gate: QA/QC cannot approve before Level 1 signatures -> 400", r.status === 400, `${r.status} msg: ${r.json?.error}`);

  // Step 4: Technical Executive signs Level 1 spot signature
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "sign",
    comments: "Technical Executive on-site sign-off complete",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.techExec);
  assert("2. Technical Executive signs on-site -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);

  // Step 5: Customer signs Level 1 spot signature
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "sign",
    comments: "Customer on-site sign-off complete",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.customer);
  assert("3. Customer signs on-site -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Level 1 complete -> Status advances to SITE_ENGINEER_PENDING", r.json?.workflowStatus === "SITE_ENGINEER_PENDING", r.json?.workflowStatus);

  // Step 6: Site Engineer signs Level 2
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Site Engineer sign-off complete",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.siteEng);
  assert("4. Site Engineer signs Level 2 -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Status advances to QA_QC_PENDING", r.json?.workflowStatus === "QA_QC_PENDING", r.json?.workflowStatus);

  // Step 7: QA/QC In-Charge approves
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "QA/QC inspection verified and approved",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.qaqc);
  assert("5. QA/QC approves -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Status advances to PROJECT_MANAGER_PENDING", r.json?.workflowStatus === "PROJECT_MANAGER_PENDING", r.json?.workflowStatus);

  // Step 8: Out-of-turn check: VP tries to approve before PM & Manager Technical -> 403
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "VP attempting out-of-order approval",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.vpHug);
  assert("Gate: VP out-of-turn approval forbidden -> 403", r.status === 403, `${r.status} msg: ${r.json?.error}`);

  // Step 9: Project Manager approves
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Project Manager verified and approved",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.pm);
  assert("6. Project Manager approves -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Status advances to MANAGER_TECHNICAL_PENDING", r.json?.workflowStatus === "MANAGER_TECHNICAL_PENDING", r.json?.workflowStatus);

  // Step 10: Manager Technical approves
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Manager Technical verified and approved",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.manTech);
  assert("7. Manager Technical approves -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Status advances to GM_HUG_PENDING", r.json?.workflowStatus === "GM_HUG_PENDING", r.json?.workflowStatus);

  // Step 11: GM – HUG approves
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "GM – HUG verified and approved",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.gmHug);
  assert("8. GM – HUG approves -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Status advances to VP_HUG_PENDING", r.json?.workflowStatus === "VP_HUG_PENDING", r.json?.workflowStatus);

  // Step 12: VP – HUG final approval
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "VP – HUG final handover approval granted",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, cookies.vpHug);
  assert("9. VP – HUG final approves -> 200", r.status === 200, `${r.status} status: ${r.json?.workflowStatus}`);
  assert("Final status is COMPLETED", r.json?.workflowStatus === "COMPLETED", r.json?.workflowStatus);

  // Step 13: Attempt to approve already COMPLETED inspection -> 400
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Duplicate approval attempt",
  }, cookies.vpHug);
  assert("Already COMPLETED inspection cannot be re-approved -> 400", r.status === 400, `${r.status} msg: ${r.json?.error}`);

  // Step 14: Audit trail accountability check
  r = await req("GET", `/api/approval?inspectionId=${inspId}`);
  const history = r.json?.inspection?.approvalHistory || [];
  assert("Audit history recorded all steps", history.length >= 7, `Total steps: ${history.length}`);
  const hasUserIds = history.every((h) => h.userId !== undefined && h.userName !== undefined);
  assert("Audit records contain individual userId & userName", hasUserIds, `userIds present`);
}

// ── 5. Admin Constraints ───────────────────────────────────────────────────
async function testAdminConstraints() {
  section("5. ADMIN AUTHORIZATION CONSTRAINTS");

  let adminAuth = await req("POST", "/api/auth", { userName: USERS.admin.name, userNumber: USERS.admin.number });
  const adminCookie = adminAuth.sessionCookie;

  const testId = `REG-ADMIN-SIG-${Date.now()}`;
  await req("POST", "/api/submit", makeInspection(testId), adminCookie);

  // Admin cannot sign role signature boxes directly -> 403
  let r = await req("POST", "/api/approval", {
    inspectionId: testId,
    action: "approve",
    comments: "Admin trying to sign",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, adminCookie);
  assert("Admin role cannot sign individual role signature boxes -> 403", r.status === 403, `${r.status} msg: ${r.json?.error}`);
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold(`\n${"=".repeat(60)}`));
  console.log(bold(`  DAC INSPECTION APP — COMPLETE SYSTEM REGRESSION TEST`));
  console.log(bold(`  Target: ${BASE}`));
  console.log(bold(`${"=".repeat(60)}\n`));

  try {
    const ping = await req("GET", "/api/projects");
    if (ping.status !== 200) throw new Error(`Server returned ${ping.status}`);
    console.log(green(`  Server is UP at ${BASE}\n`));
  } catch (e) {
    console.log(red(`  Cannot reach ${BASE}: ${e.message}`));
    console.log(red(`  Ensure the server is running on ${BASE}\n`));
    process.exit(1);
  }

  const t0 = Date.now();
  await testAuthentication();
  await testCreationPermissions();
  await testDraftAutosave();
  await testEndToEndWorkflow();
  await testAdminConstraints();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`\n${bold("=".repeat(60))}`);
  console.log(bold("  REGRESSION TEST RESULTS SUMMARY"));
  console.log(bold("=".repeat(60)));
  console.log(`  ${green("PASSED:")}  ${passed}`);
  if (warned) console.log(`  ${yellow("WARNED:")}  ${warned}`);
  console.log(`  ${red("FAILED:")}  ${failed}`);
  console.log(`  Total Tests: ${passed + failed + warned} in ${elapsed}s`);

  if (failed > 0) {
    console.log(`\n${red(bold("  FAILED TESTS:"))}`);
    results.filter((r) => r.ok === false).forEach((r) => {
      console.log(`  FAIL  ${r.name}${r.detail ? "  ->  " + r.detail : ""}`);
    });
  }
  console.log(bold("=".repeat(60) + "\n"));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
