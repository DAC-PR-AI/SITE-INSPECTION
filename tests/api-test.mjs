/**
 * DAC Inspection App — Full API Test Suite
 * Normal tests + stress tests for all routes
 * Run: node api-test.mjs
 */

const BASE = "http://localhost:3000";

// ── PINs from .env.local ───────────────────────────────────────────────────
const PINS = {
  siteEngineer:       "112233",
  customer:           "100100",
  technicalExecutive: "200200",
  qaqc:               "300300",
  projectManager:     "400400",
  managerTechnical:   "500500",
  gmHug:              "600600",
  vpHug:              "700700",
  admin:              "999000",
  wrong:              "000000",
};

// ── Helpers ────────────────────────────────────────────────────────────────
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

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, opts);
  const ms = Date.now() - t0;
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, ms };
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

// ── Fake Inspection payload ────────────────────────────────────────────────
function makeInspection(id) {
  return {
    inspectionId: id,
    projectName: "DAC Test Project",
    unitNumber: "T-001",
    inspectionType: "INTERIOR JOINT INSPECTION",
    date: new Date().toISOString().slice(0, 10),
    siteEngineerName: "Test Engineer",
    customerName: "Test Customer",
    generalRemarks: "Automated test inspection",
    workflowStatus: "DRAFT",
    status: "draft",
    cells: {},
    signatures: {},
    approvalHistory: [],
    passcode: PINS.siteEngineer,
  };
}

// ==========================================================================
// 1. /api/auth  --  Normal Tests
// ==========================================================================
async function testAuth() {
  section("1. /api/auth -- Auth Endpoint");

  let r = await req("POST", "/api/auth", { role: "Start Inspection", pin: PINS.siteEngineer });
  assert("Valid PIN: Start Inspection (112233)",   r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Site Engineer", pin: PINS.siteEngineer });
  assert("Valid PIN: Site Engineer (112233)",       r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Customer", pin: PINS.customer });
  assert("Valid PIN: Customer (100100)",            r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Technical Executive", pin: PINS.technicalExecutive });
  assert("Valid PIN: Technical Executive (200200)", r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "QA/QC In-Charge", pin: PINS.qaqc });
  assert("Valid PIN: QA/QC In-Charge (300300)",    r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Project Manager", pin: PINS.projectManager });
  assert("Valid PIN: Project Manager (400400)",    r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Manager Technical", pin: PINS.managerTechnical });
  assert("Valid PIN: Manager Technical (500500)",  r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "GM - HUG", pin: PINS.gmHug });
  assert("Valid PIN: GM-HUG (600600)",             r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "VP - HUG", pin: PINS.vpHug });
  assert("Valid PIN: VP-HUG (700700)",             r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Admin", pin: PINS.admin });
  assert("Valid PIN: Admin (999000)",              r.status === 200 && r.json?.ok === true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Start Inspection", pin: PINS.wrong });
  assert("Wrong PIN -> 401",                       r.status === 401 && r.json?.ok !== true, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { pin: PINS.siteEngineer });
  assert("Missing role -> 400",                    r.status === 400, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", { role: "Start Inspection" });
  assert("Missing pin -> 400",                     r.status === 400, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/auth", {});
  assert("Empty body -> 400",                      r.status === 400, `${r.status} ${r.ms}ms`);

  try {
    const res2 = await fetch(`${BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all!!",
    });
    assert("Malformed JSON -> 400", res2.status === 400, `${res2.status}`);
  } catch { assert("Malformed JSON -> handled", false, "network error"); }
}

// ==========================================================================
// 2. /api/projects  --  Normal Tests
// ==========================================================================
async function testProjects() {
  section("2. /api/projects -- Projects Endpoint");

  let r = await req("GET", "/api/projects");
  assert("GET /api/projects -> 200",        r.status === 200, `${r.status} ${r.ms}ms`);
  assert("Response is not null",            r.json !== null,  typeof r.json);
  const hasData = r.json && (Array.isArray(r.json) || typeof r.json === "object");
  assert("Returns project data structure",  hasData,          JSON.stringify(r.json)?.slice(0, 80));
}

// ==========================================================================
// 3. /api/draft  --  Normal Tests
// ==========================================================================
const DRAFT_ID = `TEST-DRAFT-${Date.now()}`;

async function testDraft() {
  section("3. /api/draft -- Draft Save / Load");

  let r = await req("POST", "/api/draft", makeInspection(DRAFT_ID));
  assert("POST /api/draft valid passcode -> 200",  r.status === 200, `${r.status} ${r.ms}ms`);

  r = await req("GET", `/api/draft?inspectionId=${DRAFT_ID}&passcode=${PINS.siteEngineer}`);
  assert("GET /api/draft -> 200",                   r.status === 200, `${r.status} ${r.ms}ms`);
  assert("Draft has correct inspectionId",          r.json?.data?.inspectionId === DRAFT_ID, r.json?.data?.inspectionId);

  const bad = { ...makeInspection(`${DRAFT_ID}-wrongpin`), passcode: PINS.wrong };
  r = await req("POST", "/api/draft", bad);
  assert("POST /api/draft wrong passcode -> 401",   r.status === 401, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/draft", { passcode: PINS.siteEngineer });
  assert("POST /api/draft missing ID -> 400",       r.status === 400, `${r.status} ${r.ms}ms`);

  r = await req("GET", "/api/draft?inspectionId=NONEXISTENT-9999999");
  assert("GET /api/draft unknown ID -> 404",        r.status === 404, `${r.status} ${r.ms}ms`);

  r = await req("GET", "/api/draft");
  assert("GET /api/draft no param -> 400",          r.status === 400, `${r.status} ${r.ms}ms`);

  const updated = { ...makeInspection(DRAFT_ID), generalRemarks: "UPDATED-REMARK-XYZ", passcode: PINS.siteEngineer };
  r = await req("POST", "/api/draft", updated);
  assert("POST /api/draft overwrite -> 200",        r.status === 200, `${r.status} ${r.ms}ms`);
  r = await req("GET", `/api/draft?inspectionId=${DRAFT_ID}`);
  assert("Updated draft has new remark",            r.json?.data?.generalRemarks === "UPDATED-REMARK-XYZ", r.json?.data?.generalRemarks);
}

// ==========================================================================
// 4. /api/submit  --  Normal Tests
// ==========================================================================
const SUBMIT_ID = `TEST-SUBMIT-${Date.now()}`;

async function testSubmit() {
  section("4. /api/submit -- Final Submission");

  let r = await req("POST", "/api/submit", { ...makeInspection(SUBMIT_ID), passcode: PINS.siteEngineer });
  assert("POST /api/submit valid -> 200",        r.status === 200, `${r.status} ${r.ms}ms`);
  assert("workflowStatus = QA_QC_PENDING",       r.json?.workflowStatus === "QA_QC_PENDING", r.json?.workflowStatus);

  r = await req("POST", "/api/submit", { ...makeInspection(`${SUBMIT_ID}-B`), passcode: PINS.wrong });
  assert("POST /api/submit wrong PIN -> 401",    r.status === 401, `${r.status} ${r.ms}ms`);

  r = await req("POST", "/api/submit", { passcode: PINS.siteEngineer });
  assert("POST /api/submit no ID -> 400",        r.status === 400, `${r.status} ${r.ms}ms`);
}

// ==========================================================================
// 5. /api/approval  --  Normal Tests + Full Workflow
// ==========================================================================
async function testApproval() {
  section("5. /api/approval -- Approval Workflow");

  let r = await req("GET", "/api/approval?role=Admin");
  assert("GET /api/approval?role=Admin -> 200",       r.status === 200, `${r.status} ${r.ms}ms`);
  assert("Returns inspections array",                 Array.isArray(r.json?.inspections), typeof r.json?.inspections);

  r = await req("GET", "/api/approval?role=QA/QC In-Charge");
  assert("GET queue for QA/QC -> 200",               r.status === 200, `${r.status} ${r.ms}ms`);

  r = await req("GET", `/api/approval?inspectionId=${SUBMIT_ID}`);
  assert("GET by inspectionId -> 200",                r.status === 200, `${r.status} ${r.ms}ms`);
  assert("Inspection found",                          r.json?.inspection?.inspectionId === SUBMIT_ID, r.json?.inspection?.inspectionId || "not found");
  assert("Status is QA_QC_PENDING after submit",      r.json?.inspection?.workflowStatus === "QA_QC_PENDING", r.json?.inspection?.workflowStatus);

  // Customer parallel sign
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "Customer", userName: "Mr. Customer",
    action: "sign", comments: "Looks good",
    signature: "data:image/png;base64,iVBORw0KGgo=",
    passcode: PINS.customer,
  });
  assert("Customer sign -> 200",     r.status === 200, `${r.status} msg: ${r.json?.error || "ok"}`);

  // Technical Executive parallel sign
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "Technical Executive", userName: "Tech Exec",
    action: "sign", comments: "Technical OK",
    signature: "data:image/png;base64,iVBORw0KGgo=",
    passcode: PINS.technicalExecutive,
  });
  assert("Technical Executive sign -> 200", r.status === 200, `${r.status} msg: ${r.json?.error || "ok"}`);

  // Wrong passcode on approval
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "QA/QC In-Charge", userName: "QA",
    action: "approve", comments: "OK", passcode: PINS.wrong,
  });
  assert("Wrong passcode on approve -> 401", r.status === 401, `${r.status} ${r.ms}ms`);

  // Missing required fields
  r = await req("POST", "/api/approval", { inspectionId: SUBMIT_ID, role: "QA/QC In-Charge" });
  assert("Missing userName+action -> 400",   r.status === 400, `${r.status} ${r.ms}ms`);

  // Admin cannot sign
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "Admin", userName: "Admin",
    action: "approve", passcode: PINS.admin,
  });
  assert("Admin sign -> 403",       r.status === 403, `${r.status} ${r.ms}ms`);

  // Non-existent ID
  r = await req("GET", "/api/approval?inspectionId=NO-SUCH-ID-ZZZ");
  assert("Unknown inspectionId -> 404", r.status === 404, `${r.status} ${r.ms}ms`);

  // QA/QC approve (after both parallel sigs done)
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "QA/QC In-Charge", userName: "QA Manager",
    action: "approve", comments: "QA complete",
    signature: "data:image/png;base64,iVBORw0KGgo=",
    passcode: PINS.qaqc,
  });
  assert("QA/QC approve -> 200",              r.status === 200, `${r.status} msg: ${r.json?.error || r.json?.workflowStatus}`);
  assert("Status advances to PM_PENDING",     r.json?.workflowStatus === "PROJECT_MANAGER_PENDING", r.json?.workflowStatus);

  // Project Manager approve
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "Project Manager", userName: "PM",
    action: "approve", comments: "PM approved",
    signature: "data:image/png;base64,iVBORw0KGgo=",
    passcode: PINS.projectManager,
  });
  assert("Project Manager approve -> 200",    r.status === 200, `${r.status} msg: ${r.json?.error || r.json?.workflowStatus}`);
  assert("Status advances to MGR_TECHNICAL",  r.json?.workflowStatus === "MANAGER_TECHNICAL_PENDING", r.json?.workflowStatus);

  // Out-of-turn approval (wrong stage)
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "VP - HUG", userName: "VP",
    action: "approve", comments: "VP jump",
    passcode: PINS.vpHug,
  });
  assert("Out-of-turn VP approve -> 403",     r.status === 403, `${r.status} ${r.ms}ms`);

  // Oversized signature payload
  r = await req("POST", "/api/approval", {
    inspectionId: SUBMIT_ID, role: "Manager Technical", userName: "Mgr",
    action: "approve", comments: "Mgr OK",
    signature: "data:image/png;base64," + "A".repeat(600 * 1024),
    passcode: PINS.managerTechnical,
  });
  assert("Oversized signature -> 413",        r.status === 413, `${r.status} ${r.ms}ms`);
}

// ==========================================================================
// 6. STRESS TESTS
// ==========================================================================
async function testStress() {
  section("6. STRESS TESTS -- Concurrency & Rate Limiting");

  // 6a. 20 concurrent valid auth
  console.log(dim("  -> Firing 20 concurrent valid auth requests..."));
  const authBatch = Array.from({ length: 20 }, () =>
    req("POST", "/api/auth", { role: "Start Inspection", pin: PINS.siteEngineer })
  );
  const authRes = await Promise.all(authBatch);
  const authOk = authRes.filter(r => r.status === 200).length;
  const authAvg = Math.round(authRes.reduce((s, r) => s + r.ms, 0) / authRes.length);
  assert(`20 concurrent auth: ${authOk}/20 succeeded`, authOk >= 18, `avg ${authAvg}ms`);

  // 6b. 15 concurrent project fetches
  console.log(dim("  -> Firing 15 concurrent /api/projects requests..."));
  const projBatch = Array.from({ length: 15 }, () => req("GET", "/api/projects"));
  const projRes = await Promise.all(projBatch);
  const projOk = projRes.filter(r => r.status === 200).length;
  const projAvg = Math.round(projRes.reduce((s, r) => s + r.ms, 0) / projRes.length);
  assert(`15 concurrent projects: ${projOk}/15 succeeded`, projOk >= 13, `avg ${projAvg}ms`);

  // 6c. 10 concurrent draft saves (unique IDs)
  console.log(dim("  -> Firing 10 concurrent /api/draft saves..."));
  const draftBatch = Array.from({ length: 10 }, (_, i) =>
    req("POST", "/api/draft", makeInspection(`STRESS-${Date.now()}-${i}`))
  );
  const draftRes = await Promise.all(draftBatch);
  const draftOk = draftRes.filter(r => r.status === 200).length;
  assert(`10 concurrent drafts: ${draftOk}/10 succeeded`, draftOk >= 8, `${draftOk}/10 ok`);

  // 6d. Rate limit test -- sequential wrong PINs
  console.log(dim("  -> Rapid-fire 7x wrong PINs to trigger rate limiter..."));
  const rlStatuses = [];
  for (let i = 0; i < 7; i++) {
    const r = await req("POST", "/api/auth", { role: "VP - HUG", pin: "XXXXXX" });
    rlStatuses.push(r.status);
    if (r.status === 429) break; // already hit limit
  }
  const got429 = rlStatuses.includes(429);
  const got401Count = rlStatuses.filter(s => s === 401).length;
  assert("Rate limiter triggers 429",       got429,        `Statuses: [${rlStatuses.join(", ")}]`);
  assert("First 5 bad attempts = 401",      got401Count >= 5, `401 count: ${got401Count}`);

  // 6e. 5 concurrent submits
  console.log(dim("  -> Firing 5 concurrent /api/submit requests..."));
  const submitBatch = Array.from({ length: 5 }, (_, i) =>
    req("POST", "/api/submit", {
      ...makeInspection(`STRESS-SUB-${Date.now()}-${i}`),
      passcode: PINS.siteEngineer,
    })
  );
  const submitRes = await Promise.all(submitBatch);
  const submitOk = submitRes.filter(r => r.status === 200).length;
  assert(`5 concurrent submits: ${submitOk}/5 succeeded`, submitOk >= 4, `${submitOk}/5 ok`);

  // 6f. p95 response time
  const allTimes = [...authRes, ...projRes, ...draftRes, ...submitRes].map(r => r.ms).sort((a, b) => a - b);
  const avg = Math.round(allTimes.reduce((s, t) => s + t, 0) / allTimes.length);
  const p95 = allTimes[Math.floor(allTimes.length * 0.95)];
  const maxT = allTimes[allTimes.length - 1];
  assert(`p95 latency < 5000ms`, p95 < 5000, `avg=${avg}ms  p95=${p95}ms  max=${maxT}ms`);
  assert(`Avg latency < 3000ms`,  avg < 3000, `avg=${avg}ms`);
}

// ==========================================================================
// MAIN
// ==========================================================================
async function main() {
  console.log(bold(`\n${"=".repeat(55)}`));
  console.log(bold(`  DAC INSPECTION APP -- Full API Test Suite`));
  console.log(bold(`  Target: ${BASE}`));
  console.log(bold(`${"=".repeat(55)}\n`));

  try {
    const ping = await req("GET", "/api/projects");
    if (ping.status !== 200) throw new Error(`Server returned ${ping.status}`);
    console.log(green(`  Server is UP at ${BASE}\n`));
  } catch (e) {
    console.log(red(`  Cannot reach ${BASE}: ${e.message}`));
    console.log(red(`  Make sure the dev server is running: npm run dev\n`));
    process.exit(1);
  }

  const t0 = Date.now();
  await testAuth();
  await testProjects();
  await testDraft();
  await testSubmit();
  await testApproval();
  await testStress();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${bold("=".repeat(55))}`);
  console.log(bold("  RESULTS SUMMARY"));
  console.log(bold("=".repeat(55)));
  console.log(`  ${green("PASSED:")}  ${passed}`);
  if (warned) console.log(`  ${yellow("WARNED:")}  ${warned}`);
  console.log(`  ${red("FAILED:")}  ${failed}`);
  console.log(`  Total:  ${passed + failed + warned} tests in ${elapsed}s`);

  if (failed > 0) {
    console.log(`\n${red(bold("  FAILED TESTS:"))}`);
    results.filter(r => r.ok === false).forEach(r => {
      console.log(`  FAIL  ${r.name}${r.detail ? "  ->  " + r.detail : ""}`);
    });
  }
  console.log(bold("=".repeat(55) + "\n"));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("Unhandled error:", e); process.exit(1); });
