/**
 * DAC Inspection App — Section 1: Authentication Model
 * Run: node test-section1.mjs
 */
const BASE = process.env.TEST_URL || "http://localhost:3001";
let p = 0, f = 0;

const green  = (t) => `\x1b[32m${t}\x1b[0m`;
const red    = (t) => `\x1b[31m${t}\x1b[0m`;
const bold   = (t) => `\x1b[1m${t}\x1b[0m`;
const dim    = (t) => `\x1b[2m${t}\x1b[0m`;

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

async function main() {
  console.log(bold("\n" + "=".repeat(60)));
  console.log(bold("  SECTION 1: AUTHENTICATION MODEL"));
  console.log(bold("  Target: " + BASE));
  console.log(bold("=".repeat(60) + "\n"));

  let r;

  r = await req("POST", "/api/auth", {});
  assert("Missing credentials rejected -> 400", r.status === 400, "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Raj", password: "WrongPassword123" });
  assert("Wrong password rejected -> 401", r.status === 401, "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Raj", password: "TechExec@1001" });
  assert("Technical Executive login -> 200", r.status === 200 && r.json?.role === "Technical Executive", r.status + " role: " + r.json?.role);
  assert("Session cookie issued", !!r.sessionCookie, r.sessionCookie.slice(0, 35) + "...");
  const teCookie = r.sessionCookie;

  r = await req("POST", "/api/auth", { userName: "Arun", password: "SiteEng@1002" });
  assert("Site Engineer login -> 200", r.status === 200 && r.json?.role === "Site Engineer", "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Priya", password: "Customer@1004" });
  assert("Customer login -> 200", r.status === 200 && r.json?.role === "Customer", "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Kumar", password: "QAQC@1003" });
  assert("QA/QC In-Charge login -> 200", r.status === 200 && r.json?.role === "QA/QC In-Charge", "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Project Manager", password: "PM@1005" });
  assert("Project Manager login -> 200", r.status === 200 && r.json?.role === "Project Manager", "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Manager Technical", password: "ManTech@1006" });
  assert("Manager Technical login -> 200", r.status === 200 && r.json?.role === "Manager Technical", "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "GM HUG", password: "GM@1007" });
  assert("GM - HUG login -> 200", r.status === 200, "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "VP HUG", password: "VP@1008" });
  assert("VP - HUG login -> 200", r.status === 200, "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Administrator", password: "Admin@9990" });
  assert("Admin login (by name) -> 200", r.status === 200 && r.json?.role === "Admin", "status: " + r.status);

  r = await req("POST", "/api/auth", { email: "admin@dac.com", password: "Admin@9990" });
  assert("Admin login (by email) -> 200", r.status === 200 && r.json?.role === "Admin", "status: " + r.status);

  r = await req("POST", "/api/auth", { userName: "Disabled User", password: "Inactive@0000" });
  assert("Inactive user -> 401", r.status === 401, "status: " + r.status);

  r = await req("GET", "/api/auth", undefined, teCookie);
  assert("GET /api/auth with cookie -> 200 authenticated", r.status === 200 && r.json?.authenticated === true, "name: " + r.json?.user?.name);

  r = await req("GET", "/api/auth");
  assert("GET /api/auth without cookie -> 401", r.status === 401, "status: " + r.status);

  console.log("\n" + bold("=".repeat(60)));
  console.log(bold("  SECTION 1 RESULT: " + (f === 0 ? "ALL PASSED" : f + " FAILED")));
  console.log("  Passed: " + p + "  Failed: " + f);
  console.log(bold("=".repeat(60) + "\n"));
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
