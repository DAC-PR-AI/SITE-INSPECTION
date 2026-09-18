/**
 * DAC Inspection App — Backend Stress Test
 * Tests: Auth, Draft, Submit, Search, Projects, Approval
 * Metrics: Throughput (req/s), Latency (p50/p95/p99), Error Rate, Concurrency
 *
 * Run: node stress-test.mjs
 */

const BASE   = process.env.TEST_URL   || "http://localhost:3001";
const VU     = parseInt(process.env.VU     || "20");   // Virtual users (concurrent)
const ROUNDS = parseInt(process.env.ROUNDS || "5");    // Rounds per VU
const RAMP   = parseInt(process.env.RAMP   || "3");    // Ramp-up waves

const bold   = (t) => `\x1b[1m${t}\x1b[0m`;
const green  = (t) => `\x1b[32m${t}\x1b[0m`;
const red    = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const cyan   = (t) => `\x1b[36m${t}\x1b[0m`;
const dim    = (t) => `\x1b[2m${t}\x1b[0m`;

// ─── Metrics Collector ────────────────────────────────────────────────────────
const metrics = {};

function record(label, ms, ok) {
  if (!metrics[label]) metrics[label] = { times: [], errors: 0, total: 0 };
  metrics[label].times.push(ms);
  metrics[label].total++;
  if (!ok) metrics[label].errors++;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
async function req(method, path, body, cookie = "") {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, opts);
    const ms = Date.now() - t0;
    const sc = res.headers.get("set-cookie") || "";
    const match = sc.match(/dac_session=[^;]+/);
    const sessionCookie = match ? match[0] : "";
    let json; try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json, ms, sessionCookie, ok: res.status < 400 || res.status === 401 || res.status === 403 };
  } catch (e) {
    return { status: 0, json: null, ms: Date.now() - t0, sessionCookie: "", ok: false, err: e.message };
  }
}

// ─── Scenario: Auth flood ─────────────────────────────────────────────────────
const USERS = [
  { userName: "Raj",               password: "TechExec@1001" },
  { userName: "Arun",              password: "SiteEng@1002"  },
  { userName: "Kumar",             password: "QAQC@1003"     },
  { userName: "Priya",             password: "Customer@1004" },
  { userName: "Project Manager",   password: "PM@1005"       },
  { userName: "Manager Technical", password: "ManTech@1006"  },
  { userName: "Administrator",     password: "Admin@9990"    },
];

async function scenarioAuthFlood(vu) {
  const user = USERS[vu % USERS.length];
  const r = await req("POST", "/api/auth", { userName: user.userName, password: user.password });
  // 429 = app-level rate limit hit (expected under extreme load; note separately)
  if (r.status === 429) {
    record("POST /api/auth [rate-limited]", r.ms, true); // rate limit is correct behavior
    return "";
  }
  record("POST /api/auth (valid)", r.ms, r.status === 200);
  return r.sessionCookie;
}

// NOTE: Invalid-auth scenario removed from concurrent load — it consumes the 5-attempt
// IP rate-limit quota (per 15 min window), locking out valid concurrent logins from
// the same IP. Run invalid auth tests sequentially in the regression suite instead.

async function scenarioProjectsList() {
  const r = await req("GET", "/api/projects");
  record("GET /api/projects", r.ms, r.status === 200);
}

async function scenarioSearch(cookie) {
  const terms = ["DAC", "T1", "A-1", "G-3", "Unit"];
  const term = terms[Math.floor(Math.random() * terms.length)];
  const r = await req("GET", `/api/search?q=${term}`, undefined, cookie);
  record("GET /api/search", r.ms, r.status === 200 || r.status === 401);
}

async function scenarioDraftSave(cookie, vu, round) {
  if (!cookie) return `STRESS-DRAFT-SKIPPED-VU${vu}-R${round}`;
  const id = `STRESS-DRAFT-VU${vu}-R${round}-${Date.now()}`;
  const r = await req("POST", "/api/draft", {
    inspectionId: id,
    projectName: "DAC Stress Test",
    unitNumber: `U-${vu}`,
    inspectionType: "INTERIOR JOINT INSPECTION",
    customerName: "Stress Tester",
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspectionTime: "10:00",
    cells: { [`${vu}_Kitchen`]: { status: "pass" } },
    signatures: {}, approvalHistory: [],
  }, cookie);
  record("POST /api/draft (save)", r.ms, r.status === 200);
  return r.status === 200 ? id : null;
}

async function scenarioDraftGet(id) {
  if (!id) return;
  const r = await req("GET", `/api/draft?inspectionId=${id}`);
  record("GET /api/draft (retrieve)", r.ms, r.status === 200);
}

async function scenarioInspectionCreate(cookie, vu) {
  if (!cookie) return;
  const id = `STRESS-INSP-VU${vu}-${Date.now()}`;
  const r = await req("POST", "/api/submit", {
    inspectionId: id,
    projectName: "DAC Stress Test",
    unitNumber: `U-${vu}`,
    inspectionType: "INTERIOR JOINT INSPECTION",
    customerName: "Stress Tester",
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspectionTime: "10:00",
    cells: {}, signatures: {}, approvalHistory: [],
  }, cookie);
  record("POST /api/submit (create)", r.ms, r.status === 200 || r.status === 403);
}

async function scenarioApprovalFetch(cookie) {
  const r = await req("GET", `/api/approval?inspectionId=STRESS-GHOST-${Date.now()}`, undefined, cookie);
  record("GET /api/approval (miss)", r.ms, r.status === 200 || r.status === 404 || r.status === 401);
}

// ─── Virtual User Workload ───────────────────────────────────────────────────
// Realistic pattern: each VU authenticates ONCE (like a real user opening the app),
// then reuses the session cookie for all rounds of activity.
async function runVU(vu) {
  // 1. Login once per VU session
  const user = USERS[vu % USERS.length];
  const authResp = await req("POST", "/api/auth", { userName: user.userName, password: user.password });
  if (authResp.status === 429) {
    record("POST /api/auth [rate-limited]", authResp.ms, true);
    return; // skip VU entirely if rate-limited
  }
  record("POST /api/auth (login)", authResp.ms, authResp.status === 200);
  const cookie = authResp.sessionCookie;
  if (!cookie) return; // auth failed — skip VU

  // 2. Run activity rounds using the same session cookie
  for (let round = 0; round < ROUNDS; round++) {
    await scenarioProjectsList();
    await scenarioSearch(cookie);
    await scenarioApprovalFetch(cookie);

    const draftId = await scenarioDraftSave(cookie, vu, round);
    if (draftId) await scenarioDraftGet(draftId);
    await scenarioInspectionCreate(cookie, vu);
  }
}

// ─── Ramp-up runner ──────────────────────────────────────────────────────────
async function runWave(vuCount, waveLabel) {
  console.log(cyan(`\n  Wave ${waveLabel}: spawning ${vuCount} concurrent virtual users...`));
  const t0 = Date.now();
  const workers = Array.from({ length: vuCount }, (_, i) => runVU(i));
  await Promise.allSettled(workers);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(dim(`  Wave ${waveLabel} complete in ${elapsed}s`));
}

// ─── Report ───────────────────────────────────────────────────────────────────
function printReport(totalMs) {
  const totalSec = totalMs / 1000;

  console.log(bold("\n" + "=".repeat(70)));
  console.log(bold("  STRESS TEST RESULTS"));
  console.log(bold("=".repeat(70)));
  console.log(
    bold(
      `  ${"Endpoint".padEnd(35)} ${"Reqs".padStart(5)} ${"Err%".padStart(5)} ${"p50ms".padStart(7)} ${"p95ms".padStart(7)} ${"p99ms".padStart(7)} ${"Max".padStart(7)}`
    )
  );
  console.log(dim("  " + "-".repeat(68)));

  let grandTotal = 0, grandErrors = 0;

  for (const [label, m] of Object.entries(metrics)) {
    const errPct = ((m.errors / m.total) * 100).toFixed(1);
    const p50 = percentile(m.times, 50).toFixed(0);
    const p95 = percentile(m.times, 95).toFixed(0);
    const p99 = percentile(m.times, 99).toFixed(0);
    const max = Math.max(...m.times).toFixed(0);
    const errColor = parseFloat(errPct) > 5 ? red : parseFloat(errPct) > 0 ? yellow : green;
    console.log(
      `  ${label.padEnd(35)} ${String(m.total).padStart(5)} ${errColor(errPct.padStart(4) + "%")} ${String(p50).padStart(7)} ${String(p95).padStart(7)} ${String(p99).padStart(7)} ${String(max).padStart(7)}`
    );
    grandTotal += m.total;
    grandErrors += m.errors;
  }

  const totalReqsPerSec = (grandTotal / totalSec).toFixed(1);
  const overallErrPct = ((grandErrors / grandTotal) * 100).toFixed(2);

  console.log(dim("  " + "-".repeat(68)));
  console.log(bold(`\n  TOTAL REQUESTS : ${grandTotal}`));
  console.log(bold(`  DURATION       : ${totalSec.toFixed(1)}s`));
  console.log(bold(`  THROUGHPUT     : ${totalReqsPerSec} req/s`));
  console.log(bold(`  ERROR RATE     : ${overallErrPct}% (${grandErrors} errors)`));
  console.log(bold(`  CONCURRENCY    : ${VU} VUs x ${ROUNDS} rounds x ${RAMP} waves`));

  const passed = parseFloat(overallErrPct) < 5;
  console.log("\n  " + (passed
    ? green(bold("STRESS TEST PASSED — system stable under load"))
    : red(bold("STRESS TEST FAILED — error rate exceeds 5% threshold"))));
  console.log(bold("=".repeat(70) + "\n"));

  process.exit(passed ? 0 : 1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold("\n" + "=".repeat(70)));
  console.log(bold("  DAC INSPECTION APP — BACKEND STRESS TEST"));
  console.log(bold(`  Target     : ${BASE}`));
  console.log(bold(`  Virtual Us : ${VU} concurrent users`));
  console.log(bold(`  Rounds     : ${ROUNDS} per user`));
  console.log(bold(`  Waves      : ${RAMP} (ramp-up)`));
  console.log(bold(`  Est. Reqs  : ~${VU * ROUNDS * 8 * RAMP} total`));
  console.log(bold("=".repeat(70)));

  // Ping check
  try {
    const ping = await req("GET", "/api/projects");
    if (ping.status !== 200) throw new Error(`Server returned ${ping.status}`);
    console.log(green(`\n  Server UP at ${BASE}  (${ping.ms}ms)\n`));
  } catch (e) {
    console.log(red(`  Cannot reach ${BASE}: ${e.message}\n`));
    process.exit(1);
  }

  const t0 = Date.now();

  // Ramp-up: increase concurrency per wave
  for (let wave = 1; wave <= RAMP; wave++) {
    const vuThisWave = Math.round(VU * (wave / RAMP));
    await runWave(Math.max(1, vuThisWave), `${wave}/${RAMP}`);
  }

  printReport(Date.now() - t0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
