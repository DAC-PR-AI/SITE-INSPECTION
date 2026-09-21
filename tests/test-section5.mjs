/**
 * DAC Inspection App — Section 5: Admin Authorization Constraints
 */
const BASE = process.env.TEST_URL || "http://localhost:3001";
let p = 0, f = 0;

const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red   = (t) => `\x1b[31m${t}\x1b[0m`;
const cyan  = (t) => `\x1b[36m${t}\x1b[0m`;
const bold  = (t) => `\x1b[1m${t}\x1b[0m`;
const dim   = (t) => `\x1b[2m${t}\x1b[0m`;

function assert(name, cond, detail = "") {
  if (cond) { p++; console.log("  " + green("PASS") + " " + green(name) + (detail ? "  " + dim("-> " + detail) : "")); }
  else       { f++; console.log("  " + red("FAIL")  + " " + red(name)  + (detail ? "  " + dim("-> " + detail) : "")); }
}

function step(label) { console.log("\n  " + cyan(bold(">> " + label))); }

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

async function main() {
  console.log(bold("\n" + "=".repeat(60)));
  console.log(bold("  SECTION 5: ADMIN AUTHORIZATION CONSTRAINTS"));
  console.log(bold("=".repeat(60) + "\n"));

  step("Admin login");
  const adminAuth = await req("POST", "/api/auth", { userName: "Administrator", password: "Admin@9990" });
  assert("Admin login -> 200", adminAuth.status === 200 && adminAuth.json?.role === "Admin", "role: " + adminAuth.json?.role);
  const adminCookie = adminAuth.sessionCookie;

  step("Admin creates inspection (allowed)");
  const now = new Date();
  const testId = `REG-ADMIN-${Date.now()}`;
  let r = await req("POST", "/api/submit", {
    inspectionId: testId,
    projectName: "DAC Test Square",
    unitNumber: "U-101",
    inspectionType: "INTERIOR JOINT INSPECTION",
    customerName: "Admin Test",
    inspectionDate: now.toISOString().slice(0, 10),
    inspectionTime: now.toTimeString().slice(0, 5),
    cells: {}, signatures: {}, approvalHistory: [],
  }, adminCookie);
  assert("Admin can create inspection -> 200", r.status === 200, "workflowStatus: " + r.json?.workflowStatus);

  step("Admin CANNOT sign individual role signature boxes (403)");
  r = await req("POST", "/api/approval", {
    inspectionId: testId,
    action: "approve",
    comments: "Admin trying to sign",
    signature: "data:image/png;base64,iVBORw0KGgo=",
  }, adminCookie);
  assert("Admin cannot sign role signature boxes -> 403", r.status === 403, "msg: " + r.json?.error);

  step("Search API accessible");
  r = await req("GET", "/api/search?q=DAC", undefined, adminCookie);
  assert("Search API returns results -> 200", r.status === 200, "status: " + r.status);

  step("Projects API accessible (public)");
  r = await req("GET", "/api/projects");
  assert("Projects API returns project list -> 200", r.status === 200 && !!r.json?.projects, "backend: " + r.json?.backend);

  console.log("\n" + bold("=".repeat(60)));
  console.log(bold("  SECTION 5 RESULT: " + (f === 0 ? "ALL PASSED" : f + " FAILED")));
  console.log("  Passed: " + p + "  Failed: " + f);
  console.log(bold("=".repeat(60) + "\n"));
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
