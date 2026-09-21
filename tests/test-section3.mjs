/**
 * DAC Inspection App — Section 3: Draft Save & Retrieval
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

async function main() {
  console.log(bold("\n" + "=".repeat(60)));
  console.log(bold("  SECTION 3: DRAFT SAVE & RETRIEVAL (Session-Protected)"));
  console.log(bold("=".repeat(60) + "\n"));

  const teAuth = await req("POST", "/api/auth", { userName: "Raj", password: "TechExec@1001" });
  const teCookie = teAuth.sessionCookie;
  const draftId = `REG-DRAFT-${Date.now()}`;

  const draftPayload = {
    inspectionId: draftId,
    projectName: "DAC Test Square",
    unitNumber: "U-101",
    inspectionType: "INTERIOR JOINT INSPECTION",
    customerName: "Priya",
    cells: { "1_Kitchen": { status: "pass" } },
    signatures: {},
    approvalHistory: [],
    generalRemarks: "Draft test",
  };

  let r;

  // 3a. Save without session -> 401
  r = await req("POST", "/api/draft", draftPayload);
  assert("Draft save without session -> 401", r.status === 401, "status: " + r.status);

  // 3b. Save with session -> 200
  r = await req("POST", "/api/draft", draftPayload, teCookie);
  assert("Draft save with valid session -> 200", r.status === 200, "status: " + r.status);

  // 3c. Retrieve draft
  r = await req("GET", `/api/draft?inspectionId=${draftId}`);
  assert("GET draft retrieves saved draft -> 200", r.status === 200 && r.json?.data?.inspectionId === draftId, "status: " + r.status + " id: " + r.json?.data?.inspectionId);

  // 3d. Verify draft content matches
  assert("Draft content preserved correctly", r.json?.data?.projectName === "DAC Test Square", "projectName: " + r.json?.data?.projectName);

  console.log("\n" + bold("=".repeat(60)));
  console.log(bold("  SECTION 3 RESULT: " + (f === 0 ? "ALL PASSED" : f + " FAILED")));
  console.log("  Passed: " + p + "  Failed: " + f);
  console.log(bold("=".repeat(60) + "\n"));
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
