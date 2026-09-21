/**
 * DAC Inspection App — Section 4: Full Signature Sequence & Multi-Level Approval Chain
 */
const BASE = process.env.TEST_URL || "http://localhost:3001";
let p = 0, f = 0;

const green  = (t) => `\x1b[32m${t}\x1b[0m`;
const red    = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const bold   = (t) => `\x1b[1m${t}\x1b[0m`;
const dim    = (t) => `\x1b[2m${t}\x1b[0m`;
const cyan   = (t) => `\x1b[36m${t}\x1b[0m`;

function assert(name, cond, detail = "") {
  if (cond) { p++; console.log("  " + green("PASS") + " " + green(name) + (detail ? "  " + dim("-> " + detail) : "")); }
  else       { f++; console.log("  " + red("FAIL")  + " " + red(name)  + (detail ? "  " + dim("-> " + detail) : "")); }
}

function step(label) {
  console.log("\n  " + cyan(bold(">> " + label)));
}

async function req(method, path, body, cookie = "") {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const sc = res.headers.get("set-cookie") || "";
  const match = sc.match(/dac_session=[^;]+/);
  const sessionCookie = match ? match[0] : "";
  let json; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, sessionCookie };
}

const USERS = {
  techExec: { name: "Raj",               password: "TechExec@1001" },
  siteEng:  { name: "Arun",              password: "SiteEng@1002"  },
  qaqc:     { name: "Kumar",             password: "QAQC@1003"     },
  customer: { name: "Priya",             password: "Customer@1004" },
  pm:       { name: "Project Manager",   password: "PM@1005"       },
  manTech:  { name: "Manager Technical", password: "ManTech@1006"  },
  gmHug:    { name: "GM HUG",            password: "GM@1007"       },
  vpHug:    { name: "VP HUG",            password: "VP@1008"       },
  admin:    { name: "Administrator",     password: "Admin@9990"    },
};

const SIG = "data:image/png;base64,iVBORw0KGgo=";

async function main() {
  console.log(bold("\n" + "=".repeat(60)));
  console.log(bold("  SECTION 4: SIGNATURE SEQUENCE & APPROVAL CHAIN"));
  console.log(bold("  TE -> Customer -> SE -> QA/QC -> PM -> ManTech -> GM -> VP"));
  console.log(bold("=".repeat(60)));

  // Authenticate all roles
  step("Authenticating all roles...");
  const cookies = {};
  for (const [key, user] of Object.entries(USERS)) {
    const auth = await req("POST", "/api/auth", { userName: user.name, password: user.password });
    cookies[key] = auth.sessionCookie;
    console.log("    " + dim("Logged in: " + user.name + " -> " + (auth.sessionCookie ? "OK" : "FAIL")));
  }

  const inspId = `REG-FLOW-${Date.now()}`;
  let r;

  // --- INSPECTION CREATION ---
  step("Technical Executive creates inspection");
  const now = new Date();
  r = await req("POST", "/api/submit", {
    inspectionId: inspId, projectName: "DAC Test Square", unitNumber: "U-101",
    inspectionType: "INTERIOR JOINT INSPECTION", customerName: "Priya",
    inspectionDate: now.toISOString().slice(0, 10), inspectionTime: now.toTimeString().slice(0, 5),
    cells: {}, signatures: {}, approvalHistory: [],
  }, cookies.techExec);
  assert("Technical Executive submits inspection -> 200", r.status === 200, "workflowStatus: " + r.json?.workflowStatus);
  assert("Initial status: SPOT_SIGNATURE_PENDING", r.json?.workflowStatus === "SPOT_SIGNATURE_PENDING", r.json?.workflowStatus);

  // --- GATE TESTS (Before Level 1) ---
  step("GATE TEST: Pre-Level-1 blocking checks");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "SE premature sign", signature: SIG }, cookies.siteEng);
  assert("Gate: SE cannot sign before Level 1 -> 400", r.status === 400, r.json?.error?.slice(0, 60));

  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "QA premature", signature: SIG }, cookies.qaqc);
  assert("Gate: QA/QC cannot approve before Level 1 -> 400", r.status === 400, r.json?.error?.slice(0, 60));

  // --- LEVEL 1: Spot Signatures ---
  step("LEVEL 1: On-site spot signatures (TE + Customer)");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "sign", comments: "TE on-site sign-off", signature: SIG }, cookies.techExec);
  assert("Technical Executive signs on-site -> 200", r.status === 200, "status: " + r.json?.workflowStatus);

  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "sign", comments: "Customer on-site sign-off", signature: SIG }, cookies.customer);
  assert("Customer signs on-site -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("Level 1 complete -> SITE_ENGINEER_PENDING", r.json?.workflowStatus === "SITE_ENGINEER_PENDING", r.json?.workflowStatus);

  // --- LEVEL 2: Site Engineer ---
  step("LEVEL 2: Site Engineer sign-off");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "SE sign-off", signature: SIG }, cookies.siteEng);
  assert("Site Engineer signs Level 2 -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("Status -> QA_QC_PENDING", r.json?.workflowStatus === "QA_QC_PENDING", r.json?.workflowStatus);

  // --- LEVEL 3: QA/QC ---
  step("LEVEL 3: QA/QC In-Charge approval");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "QA/QC verified", signature: SIG }, cookies.qaqc);
  assert("QA/QC approves -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("Status -> PROJECT_MANAGER_PENDING", r.json?.workflowStatus === "PROJECT_MANAGER_PENDING", r.json?.workflowStatus);

  // --- OUT-OF-TURN GATE ---
  step("GATE TEST: VP out-of-turn approval blocked");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "VP out-of-turn", signature: SIG }, cookies.vpHug);
  assert("Gate: VP cannot approve out-of-turn -> 403", r.status === 403, r.json?.error?.slice(0, 60));

  // --- LEVEL 4: Project Manager ---
  step("LEVEL 4: Project Manager approval");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "PM verified", signature: SIG }, cookies.pm);
  assert("Project Manager approves -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("Status -> MANAGER_TECHNICAL_PENDING", r.json?.workflowStatus === "MANAGER_TECHNICAL_PENDING", r.json?.workflowStatus);

  // --- LEVEL 5: Manager Technical ---
  step("LEVEL 5: Manager Technical approval");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "ManTech verified", signature: SIG }, cookies.manTech);
  assert("Manager Technical approves -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("Status -> GM_HUG_PENDING", r.json?.workflowStatus === "GM_HUG_PENDING", r.json?.workflowStatus);

  // --- LEVEL 6: GM HUG ---
  step("LEVEL 6: GM - HUG approval");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "GM verified", signature: SIG }, cookies.gmHug);
  assert("GM - HUG approves -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("Status -> VP_HUG_PENDING", r.json?.workflowStatus === "VP_HUG_PENDING", r.json?.workflowStatus);

  // --- LEVEL 7: VP HUG (Final) ---
  step("LEVEL 7: VP - HUG FINAL approval");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "VP final approval", signature: SIG }, cookies.vpHug);
  assert("VP - HUG final approves -> 200", r.status === 200, "status: " + r.json?.workflowStatus);
  assert("FINAL STATUS: COMPLETED", r.json?.workflowStatus === "COMPLETED", r.json?.workflowStatus);

  // --- COMPLETED GATE ---
  step("GATE TEST: Re-approval of COMPLETED inspection blocked");
  r = await req("POST", "/api/approval", { inspectionId: inspId, action: "approve", comments: "duplicate" }, cookies.vpHug);
  assert("Completed inspection cannot be re-approved -> 400", r.status === 400, r.json?.error?.slice(0, 60));

  // --- AUDIT TRAIL ---
  step("Audit trail check");
  r = await req("GET", `/api/approval?inspectionId=${inspId}`);
  const history = r.json?.inspection?.approvalHistory || [];
  assert("Audit history has all steps (>= 7)", history.length >= 7, "steps recorded: " + history.length);
  const hasUserIds = history.every(h => h.userId !== undefined && h.userName !== undefined);
  assert("All audit records have userId & userName", hasUserIds, "verified");

  console.log("\n" + bold("=".repeat(60)));
  console.log(bold("  SECTION 4 RESULT: " + (f === 0 ? "ALL PASSED" : f + " FAILED")));
  console.log("  Passed: " + p + "  Failed: " + f);
  console.log(bold("=".repeat(60) + "\n"));
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
