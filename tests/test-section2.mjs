/**
 * DAC Inspection App — Section 2: Inspection Creation Permissions
 */
const BASE = process.env.TEST_URL || "http://localhost:3001";
let p = 0, f = 0;

const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red   = (t) => `\x1b[31m${t}\x1b[0m`;
const bold  = (t) => `\x1b[1m${t}\x1b[0m`;
const dim   = (t) => `\x1b[2m${t}\x1b[0m`;

function assert(name, cond, detail = "") {
  if (cond) { p++; console.log("  " + green("PASS") + " " + green(name) + (detail ? "  " + dim("-> " + detail) : "")); }
  else       { f++; console.log("  " + red("FAIL")  + " " + red(name)  + (detail ? "  " + dim("-> " + detail) : "")); }
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
    cells: {},
    signatures: {},
    approvalHistory: [],
  };
}

async function main() {
  console.log(bold("\n" + "=".repeat(60)));
  console.log(bold("  SECTION 2: INSPECTION CREATION PERMISSIONS"));
  console.log(bold("  (Only Technical Executive & Admin may create)"));
  console.log(bold("=".repeat(60) + "\n"));

  // Login each role
  const seAuth    = await req("POST", "/api/auth", { userName: "Arun",             password: "SiteEng@1002"  });
  const qaqcAuth  = await req("POST", "/api/auth", { userName: "Kumar",            password: "QAQC@1003"     });
  const teAuth    = await req("POST", "/api/auth", { userName: "Raj",              password: "TechExec@1001" });
  const adminAuth = await req("POST", "/api/auth", { userName: "Administrator",    password: "Admin@9990"    });

  const seCookie    = seAuth.sessionCookie;
  const qaqcCookie  = qaqcAuth.sessionCookie;
  const teCookie    = teAuth.sessionCookie;
  const adminCookie = adminAuth.sessionCookie;

  let r;

  // 2a. Unauthenticated
  r = await req("POST", "/api/submit", makeInspection(`REG-UNAUTH-${Date.now()}`));
  assert("Unauthenticated submit -> 401", r.status === 401, "status: " + r.status);

  // 2b. Site Engineer forbidden
  r = await req("POST", "/api/submit", makeInspection(`REG-SE-${Date.now()}`), seCookie);
  assert("Site Engineer cannot create -> 403", r.status === 403, "status: " + r.status + " msg: " + r.json?.error);

  // 2c. QA/QC forbidden
  r = await req("POST", "/api/submit", makeInspection(`REG-QAQC-${Date.now()}`), qaqcCookie);
  assert("QA/QC cannot create -> 403", r.status === 403, "status: " + r.status + " msg: " + r.json?.error);

  // 2d. Technical Executive allowed
  r = await req("POST", "/api/submit", makeInspection(`REG-TE-${Date.now()}`), teCookie);
  assert("Technical Executive can create -> 200", r.status === 200, "status: " + r.status + " workflowStatus: " + r.json?.workflowStatus);

  // 2e. Admin allowed
  r = await req("POST", "/api/submit", makeInspection(`REG-ADMIN-${Date.now()}`), adminCookie);
  assert("Admin can create -> 200", r.status === 200, "status: " + r.status + " workflowStatus: " + r.json?.workflowStatus);

  console.log("\n" + bold("=".repeat(60)));
  console.log(bold("  SECTION 2 RESULT: " + (f === 0 ? "ALL PASSED" : f + " FAILED")));
  console.log("  Passed: " + p + "  Failed: " + f);
  console.log(bold("=".repeat(60) + "\n"));
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
