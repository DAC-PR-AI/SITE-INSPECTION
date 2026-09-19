/**
 * DAC Inspection App — Complete Full End-to-End Test Suite
 * Covers the entire API and page surface in isolated local mode.
 *
 * Usage:
 *   TEST_URL=http://localhost:3010 node tests/full-e2e.mjs
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3010";

// Configurable test credentials (with safe defaults)
const CREDS = {
  customer: {
    role: "Customer",
    pin: process.env.TEST_PIN_CUSTOMER || "111111",
    user: "Priya",
    pass: process.env.TEST_PASSWORD_CUSTOMER || "Customer@1004",
  },
  techExec: {
    role: "Technical Executive",
    pin: process.env.TEST_PIN_TECH_EXEC || "444444",
    user: "Raj",
    pass: process.env.TEST_PASSWORD_TECH_EXEC || "TechExec@1001",
  },
  siteEngineer: {
    role: "Site Engineer",
    pin: process.env.TEST_PIN_SITE_ENGINEER || "272727",
    user: "Arun",
    pass: process.env.TEST_PASSWORD_SITE_ENG || "SiteEng@1002",
  },
  qaqc: {
    role: "QA/QC In-Charge",
    pin: process.env.TEST_PIN_QAQC || "202020",
    user: "Kumar",
    pass: process.env.TEST_PASSWORD_QAQC || "QAQC@1003",
  },
  projectManager: {
    role: "Project Manager",
    pin: process.env.TEST_PIN_PM || "303030",
    user: "PM",
    pass: process.env.TEST_PASSWORD_PM || "PM@1005",
  },
  managerTechnical: {
    role: "Manager Technical",
    pin: process.env.TEST_PIN_MAN_TECH || "454545",
    user: "ManTech",
    pass: process.env.TEST_PASSWORD_MAN_TECH || "ManTech@1006",
  },
  gmHug: {
    role: "GM – HUG",
    pin: process.env.TEST_PIN_GM || "404040",
    user: "GM",
    pass: process.env.TEST_PASSWORD_GM || "GM@1007",
  },
  vpHug: {
    role: "VP – HUG",
    pin: process.env.TEST_PIN_VP || "505050",
    user: "VP",
    pass: process.env.TEST_PASSWORD_VP || "VP@1008",
  },
  admin: {
    role: "Admin",
    pin: process.env.TEST_PIN_ADMIN || "999999",
    user: "Administrator",
    pass: process.env.TEST_PASSWORD_ADMIN || "Admin@9990",
  },
};

let ipSequence = 500;
function uniqueIp() {
  ipSequence++;
  return `10.254.${Math.floor(ipSequence / 250)}.${ipSequence % 250}`;
}

async function api(path, options = {}) {
  const {
    method = "GET",
    body = null,
    cookie = null,
    ip = null,
    headers = {},
  } = options;

  const reqHeaders = {
    "x-forwarded-for": ip || uniqueIp(),
    ...headers,
  };

  if (body && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  if (cookie) {
    reqHeaders["Cookie"] = cookie;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  const setCookieHeader = res.headers.get("set-cookie") || "";
  const sessionCookieMatch = setCookieHeader.match(/dac_session=[^;]+/);
  const sessionCookie = sessionCookieMatch ? sessionCookieMatch[0] : null;

  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
    sessionCookie,
  };
}

const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function runFullE2ETestSuite() {
  console.log("================================================================");
  console.log("   DAC INSPECTION APP — COMPREHENSIVE LOCAL FULL E2E SUITE      ");
  console.log(`   Target Server: ${BASE_URL}                                   `);
  console.log("================================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition, testTitle) {
    if (condition) {
      console.log(`  ✅ PASS: ${testTitle}`);
      totalPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testTitle}`);
      totalFailed++;
    }
  }

  // ── 1. PAGES AND STATIC ASSETS ─────────────────────────────────────────────
  console.log("1. Testing Pages and Static Assets...");
  const homePage = await api("/");
  assert(homePage.status === 200 && homePage.text.includes("<!DOCTYPE html"), "GET / returns 200 with HTML document");

  const notFoundPage = await api("/non-existent-route-for-404-test");
  assert(notFoundPage.status === 404, "GET non-existent route returns 404");

  const iconAsset = await api("/icon.png");
  assert(iconAsset.status === 200 || iconAsset.status === 304, "GET /icon.png returns valid asset");

  // ── 2. PROJECTS API ────────────────────────────────────────────────────────
  console.log("\n2. Testing /api/projects...");
  const projectsRes = await api("/api/projects");
  assert(projectsRes.status === 200 && projectsRes.json?.projects, "GET /api/projects returns 200 and project list");
  assert(Array.isArray(projectsRes.json?.projects?.["DAC Aspire Heights"]), "Projects map contains unit array");

  // ── 3. AUTHENTICATION, ROLES, SESSIONS & SECURITY ──────────────────────────
  console.log("\n3. Testing /api/auth (PINs, Passwords, Sessions, Rate Limiting)...");
  const sessions = {};

  for (const [key, cred] of Object.entries(CREDS)) {
    const pinRes = await api("/api/auth", {
      method: "POST",
      body: { role: cred.role, pin: cred.pin, userName: cred.user },
    });
    assert(pinRes.status === 200 && pinRes.sessionCookie, `Login as ${cred.role} via PIN`);
    if (pinRes.sessionCookie) sessions[key] = pinRes.sessionCookie;
  }

  // Password authentication
  const passRes = await api("/api/auth", {
    method: "POST",
    body: { userName: CREDS.techExec.user, password: CREDS.techExec.pass },
  });
  assert(passRes.status === 200 && passRes.json?.role === "Technical Executive", "Login as Technical Executive via Password");

  // Wrong PIN authentication -> 401
  const wrongPinRes = await api("/api/auth", {
    method: "POST",
    body: { role: "Site Engineer", pin: "000000" },
  });
  assert(wrongPinRes.status === 401, "Login with wrong PIN returns 401");

  // Invalid JSON request body -> 400
  const badJsonRes = await api("/api/auth", {
    method: "POST",
    body: "{ invalid json string",
    headers: { "Content-Type": "application/json" },
  });
  assert(badJsonRes.status === 400, "Invalid JSON payload returns 400");

  // Brute-force lockout (5 attempts on single IP -> 429)
  const attackerIp = "192.0.2.111";
  let lockoutTriggered = false;
  for (let i = 1; i <= 6; i++) {
    const fRes = await api("/api/auth", {
      method: "POST",
      body: { role: "Site Engineer", pin: "999999" },
      ip: attackerIp,
    });
    if (fRes.status === 429) {
      lockoutTriggered = true;
      break;
    }
  }
  assert(lockoutTriggered, "Brute-force lockout triggers 429 after 5 failed attempts");

  // Correct PIN blocked during active lockout
  const blockedCorrectRes = await api("/api/auth", {
    method: "POST",
    body: { role: "Site Engineer", pin: CREDS.siteEngineer.pin },
    ip: attackerIp,
  });
  assert(blockedCorrectRes.status === 429, "Correct PIN is blocked during active lockout window (429)");

  // Session verification & tampering check
  const sessionCheckRes = await api("/api/auth", {
    cookie: sessions.admin,
  });
  assert(sessionCheckRes.status === 200 && sessionCheckRes.json?.authenticated === true, "GET /api/auth returns authenticated user identity");

  const tamperedSessionRes = await api("/api/auth", {
    cookie: "dac_session=tampered.secret.signature.value",
  });
  assert(tamperedSessionRes.status === 401, "Tampered session cookie rejected with 401");

  // ── 4. DRAFT API & DATA REDACTION ──────────────────────────────────────────
  console.log("\n4. Testing /api/draft (Draft Save, Redaction, Unguessable IDs)...");
  const testDraftId = `DAC-JIC-260919-e2e${Date.now().toString(36)}`;

  const saveDraftRes = await api("/api/draft", {
    method: "POST",
    body: {
      inspectionId: testDraftId,
      projectName: "DAC Aspire Heights",
      unitNumber: "A-101",
      customerName: "Draft Customer",
      signatures: {
        customer: { dataUrl: TINY_PNG, signer: "Priya", status: "signed" },
        technicalExecutive: { dataUrl: TINY_PNG, signer: "Raj", status: "signed" },
      },
      approvalHistory: [
        {
          userId: "U001",
          userNumber: "1001",
          userName: "Raj",
          role: "Technical Executive",
          action: "Draft Saved",
          timestamp: "19/09/2026 10:00",
        },
      ],
    },
    cookie: sessions.techExec,
  });
  assert(saveDraftRes.status === 200, "POST /api/draft saves draft with session");

  // Anonymous draft read (Redaction check)
  const anonDraftRes = await api(`/api/draft?inspectionId=${encodeURIComponent(testDraftId)}`);
  assert(anonDraftRes.status === 200, "Anonymous GET /api/draft returns 200");
  const anonDraftData = anonDraftRes.json?.data;
  assert(anonDraftData?.signatures?.customer?.status === "signed", "Anonymous draft preserves signature status marker");
  assert(!anonDraftData?.signatures?.customer?.dataUrl, "Anonymous draft REDACTS base64 customer signature image dataUrl");
  assert(!anonDraftData?.signatures?.technicalExecutive?.dataUrl, "Anonymous draft REDACTS base64 technicalExecutive signature dataUrl");
  assert(anonDraftData?.approvalHistory?.[0]?.userName === "", "Anonymous draft DROPS approvalHistory userName");
  assert(anonDraftData?.approvalHistory?.[0]?.userId === "", "Anonymous draft DROPS approvalHistory userId");

  // Authenticated draft read (Full data check)
  const authDraftRes = await api(`/api/draft?inspectionId=${encodeURIComponent(testDraftId)}`, {
    cookie: sessions.admin,
  });
  assert(authDraftRes.status === 200, "Authenticated GET /api/draft returns 200");
  const authDraftData = authDraftRes.json?.data;
  const custSig = authDraftData?.signatures?.customer;
  const custSigUrl = typeof custSig === "string" ? custSig : custSig?.dataUrl;
  assert(custSigUrl === TINY_PNG, "Authenticated GET /api/draft returns full signature image data");
  assert(authDraftData?.approvalHistory?.[0]?.userName === "Raj", "Authenticated GET /api/draft returns full audit user details");

  // ── 5. PHOTOS UPLOAD API ───────────────────────────────────────────────────
  console.log("\n5. Testing /api/photos/upload (Validation, MIME Types, Oversize)...");
  const validPhotoRes = await api("/api/photos/upload", {
    method: "POST",
    body: {
      inspectionId: testDraftId,
      photoType: "pass",
      itemId: 1,
      areaKey: "living",
      dataUrl: TINY_PNG,
    },
  });
  assert(validPhotoRes.status === 200 && validPhotoRes.json?.ok, "POST /api/photos/upload with valid payload returns 200");

  const missingPhotoRes = await api("/api/photos/upload", {
    method: "POST",
    body: { inspectionId: testDraftId },
  });
  assert(missingPhotoRes.status === 400, "POST /api/photos/upload with missing dataUrl returns 400");

  const invalidMimeRes = await api("/api/photos/upload", {
    method: "POST",
    body: {
      inspectionId: testDraftId,
      dataUrl: "data:text/plain;base64,SGVsbG8gV29ybGQ=",
    },
  });
  assert(invalidMimeRes.status === 400, "POST /api/photos/upload with invalid MIME type returns 400");

  // ── 6. SUBMISSION, ROLE RESTRICTIONS & AUDIT TAMPER RESISTANCE ─────────────
  console.log("\n6. Testing /api/submit (Role Authorization, Audit Forgery Prevention)...");
  const submitId = `DAC-JIC-260919-submit${Date.now().toString(36)}`;

  // Non-creator role submit attempt (Customer) -> 403 Forbidden
  const custSubmitRes = await api("/api/submit", {
    method: "POST",
    body: {
      inspectionId: submitId,
      projectName: "DAC Aspire Heights",
      unitNumber: "A-102",
    },
    cookie: sessions.customer,
  });
  assert(custSubmitRes.status === 403, "POST /api/submit by non-creator role returns 403 Forbidden");

  // Submit by Technical Executive with forged client approvalHistory
  const teSubmitRes = await api("/api/submit", {
    method: "POST",
    body: {
      inspectionId: submitId,
      projectName: "DAC Aspire Heights",
      unitNumber: "A-102",
      customerName: "K. Senthil Nathan",
      signatures: {
        technicalExecutive: TINY_PNG,
        customer: TINY_PNG,
        siteEngineer: TINY_PNG, // Should be ignored on submit
      },
      approvalHistory: [
        {
          id: "FORGED-CLIENT-AUDIT-ENTRY",
          role: "Admin",
          userName: "Impersonator",
          action: "Forged Approval Action",
        },
      ],
    },
    cookie: sessions.techExec,
  });
  assert(teSubmitRes.status === 200, "POST /api/submit by Technical Executive returns 200");

  // Verify submitted record
  const checkSubmitted = await api(`/api/approval?inspectionId=${encodeURIComponent(submitId)}`, {
    cookie: sessions.admin,
  });
  const hist = checkSubmitted.json?.inspection?.approvalHistory || [];
  const hasForgedEntry = hist.some((h) => h.id === "FORGED-CLIENT-AUDIT-ENTRY" || h.userName === "Impersonator");
  assert(!hasForgedEntry, "Client-forged approvalHistory is completely ignored on submit");
  assert(hist.some((h) => h.action === "Inspection Created"), "Official 'Inspection Created' audit record appended");

  // ── 7. SEARCH & APPROVAL ACCESS CONTROLS ───────────────────────────────────
  console.log("\n7. Testing /api/search & /api/approval Access Controls...");
  const anonSearch = await api("/api/search?q=Aspire");
  assert(anonSearch.status === 401, "GET /api/search without session returns 401");

  const authSearch = await api("/api/search?q=Aspire", { cookie: sessions.admin });
  assert(authSearch.status === 200 && Array.isArray(authSearch.json?.results), "GET /api/search with session returns 200 results array");

  const anonApproval = await api("/api/approval");
  assert(anonApproval.status === 401, "GET /api/approval without session returns 401");

  // ── 8. FULL 8-ROLE SIGNATURE PIPELINE & OUT-OF-ORDER ENFORCEMENT ───────────
  console.log("\n8. Testing Full 8-Role Sequential Signature Workflow...");
  const flowId = `DAC-JIC-260919-flow${Date.now().toString(36)}`;

  // Step 1: TE Submit with on-site spot signatures
  await api("/api/submit", {
    method: "POST",
    body: {
      inspectionId: flowId,
      projectName: "DAC Aspire Heights",
      unitNumber: "B-201",
      customerName: "Workflow Customer",
      signatures: {
        technicalExecutive: TINY_PNG,
        customer: TINY_PNG,
      },
    },
    cookie: sessions.techExec,
  });

  // Out-of-order check: QA/QC attempting to approve before Site Engineer signs -> 403
  const outOfOrderQA = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "QA/QC In-Charge",
    },
    cookie: sessions.qaqc,
  });
  assert(outOfOrderQA.status === 403, "Out-of-order signature attempt (QA/QC before Site Engineer) blocked with 403");

  // Step 2: Site Engineer approves & signs
  const seSign = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "Site Engineer",
      userName: "Arun",
    },
    cookie: sessions.siteEngineer,
  });
  assert(seSign.status === 200, "Level 2: Site Engineer approved & signed");

  // Step 3: QA/QC In-Charge approves & signs
  const qaqcSign = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "QA/QC In-Charge",
      userName: "Kumar",
    },
    cookie: sessions.qaqc,
  });
  assert(qaqcSign.status === 200, "Level 3.1: QA/QC In-Charge approved & signed");

  // Step 4: Project Manager approves & signs
  const pmSign = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "Project Manager",
      userName: "PM",
    },
    cookie: sessions.projectManager,
  });
  assert(pmSign.status === 200, "Level 3.2: Project Manager approved & signed");

  // Step 5: Manager Technical approves & signs
  const mtSign = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "Manager Technical",
      userName: "ManTech",
    },
    cookie: sessions.managerTechnical,
  });
  assert(mtSign.status === 200, "Level 3.3: Manager Technical approved & signed");

  // Step 6: GM – HUG approves & signs
  const gmSign = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "GM – HUG",
      userName: "GM",
    },
    cookie: sessions.gmHug,
  });
  assert(gmSign.status === 200, "Level 3.4: GM – HUG approved & signed");

  // Step 7: VP – HUG approves & signs (Final Approval)
  const vpSign = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: flowId,
      action: "APPROVED",
      signature: TINY_PNG,
      role: "VP – HUG",
      userName: "VP",
    },
    cookie: sessions.vpHug,
  });
  assert(vpSign.status === 200, "Level 3.5: VP – HUG approved & signed");

  // Verify final document status & all 8 signatures
  const finalDocRes = await api(`/api/approval?inspectionId=${encodeURIComponent(flowId)}`, {
    cookie: sessions.admin,
  });
  const finalDoc = finalDocRes.json?.inspection;
  assert(finalDoc?.workflowStatus === "COMPLETED", "Workflow status reached COMPLETED");

  const sigs = finalDoc?.signatures || {};
  const REQUIRED_ROLES = ["customer", "technicalExecutive", "siteEngineer", "qaqc", "projectManager", "managerTechnical", "gmHug", "vpHug"];
  const capturedCount = REQUIRED_ROLES.filter((r) => Boolean(sigs[r])).length;
  assert(capturedCount === 8, `All 8 digital signatures stored and verified in cloud record (${capturedCount}/8)`);

  // ── 9. REJECTION, RECHECK & ADMIN OVERRIDE ─────────────────────────────────
  console.log("\n9. Testing Rejection, Recheck Loops & Admin Override...");
  const rejId = `DAC-JIC-260919-rej${Date.now().toString(36)}`;

  await api("/api/submit", {
    method: "POST",
    body: {
      inspectionId: rejId,
      projectName: "DAC Serene County",
      unitNumber: "T2-01",
      customerName: "Rejection Test",
      signatures: { technicalExecutive: TINY_PNG, customer: TINY_PNG },
    },
    cookie: sessions.techExec,
  });

  await api("/api/approval", {
    method: "POST",
    body: { inspectionId: rejId, action: "APPROVED", signature: TINY_PNG, role: "Site Engineer" },
    cookie: sessions.siteEngineer,
  });

  // QA/QC Rejection
  const rejRes = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: rejId,
      action: "REJECTED",
      comments: "Electrical fixtures need rework",
      role: "QA/QC In-Charge",
    },
    cookie: sessions.qaqc,
  });
  assert(rejRes.status === 200, "QA/QC stage rejection processed");

  const afterRejRes = await api(`/api/approval?inspectionId=${encodeURIComponent(rejId)}`, {
    cookie: sessions.admin,
  });
  assert(afterRejRes.json?.inspection?.workflowStatus === "REJECTED", "Inspection status transitioned to REJECTED");

  // Admin Override
  const adminOverrideRes = await api("/api/approval", {
    method: "POST",
    body: {
      inspectionId: rejId,
      action: "OVERRIDE_STATUS",
      targetStatus: "COMPLETED",
      comments: "Administrative reconciliation approved",
      role: "Admin",
    },
    cookie: sessions.admin,
  });
  assert(adminOverrideRes.status === 200, "Admin status override processed successfully");

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────
  console.log("\n================================================================");
  console.log(`   FULL E2E SUITE RESULTS: ${totalPassed} PASSED | ${totalFailed} FAILED `);
  console.log("================================================================");

  if (totalFailed === 0) {
    console.log("\n🎉 ALL E2E TESTS PASSED 100%!");
  } else {
    console.error(`\n❌ ${totalFailed} test(s) failed.`);
    process.exit(1);
  }
}

runFullE2ETestSuite().catch((err) => {
  console.error("Fatal E2E test suite error:", err);
  process.exit(1);
});
