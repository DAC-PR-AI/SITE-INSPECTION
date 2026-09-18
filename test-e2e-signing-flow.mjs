import http from "http";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (postData) headers["Content-Length"] = Buffer.byteLength(postData);
    if (cookie) headers["Cookie"] = cookie;

    const request = http.request(
      url,
      { method, headers, timeout: 15000 },
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

// Generate realistic mock canvas signatures
function makeSignature(roleName) {
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK8AAAA8CAYAAADgQ1F1AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAFFJREFUeJztwTEBAAAAwqD1T20ND6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC+Bo3OAAEtqX5yAAAAAElFTkSuQmCC`;
}

async function runEndToEndSigningFlow() {
  console.log("============================================================");
  console.log("  DAC INSPECTION APP — COMPLETE END-TO-END SIGNING FLOW TEST");
  console.log("  Testing all 8 Stakeholder Signatures in Exact Sequence");
  console.log("============================================================\n");

  const inspId = `DAC-FLOW-${Date.now()}`;
  console.log(`📋 Starting Inspection ID: ${inspId}\n`);

  // 1. Authenticate Technical Executive
  console.log("▶ STEP 1: Technical Executive Authentication");
  let r = await req("POST", "/api/auth", { userName: "Raj", password: "TechExec@1001" });
  if (r.status !== 200) throw new Error(`Tech Exec Auth Failed: ${r.status}`);
  const teCookie = r.sessionCookie;
  console.log(`  ✓ Logged in as: ${r.json?.user?.name} (${r.json?.role})`);

  // 2. Submit initial inspection
  console.log("\n▶ STEP 2: Creating & Submitting On-Site Inspection");
  const initialInspection = {
    inspectionId: inspId,
    projectName: "DAC Aspire Heights",
    unitNumber: "A-101",
    inspectionType: "IJI",
    customerName: "Priya Raman",
    generalRemarks: "On-site physical inspection conducted. Verification photo captured.",
    customerVerificationPhoto: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  };
  r = await req("POST", "/api/submit", initialInspection, teCookie);
  if (r.status !== 200) throw new Error(`Inspection Submit Failed: ${r.status}`);
  console.log(`  ✓ Inspection Created. Workflow Status: ${r.json?.workflowStatus}`);

  // 3. Technical Executive Signs Level 1
  console.log("\n▶ STEP 3: Level 1 — Technical Executive Sign-Off");
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "sign",
    comments: "Technical Executive on-site verification confirmed.",
    signature: makeSignature("Technical Executive"),
  }, teCookie);
  console.log(`  ✓ Tech Exec Signed. Status: ${r.json?.workflowStatus}`);

  // 4. Customer Signs Level 1
  console.log("\n▶ STEP 4: Level 1 — Customer Handover Sign-Off");
  r = await req("POST", "/api/auth", { userName: "Priya", password: "Customer@1004" });
  const customerCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "sign",
    comments: "Customer on-site unit inspection acknowledged and agreed.",
    signature: makeSignature("Customer"),
  }, customerCookie);
  console.log(`  ✓ Customer Signed. Level 1 Complete! Workflow Status: ${r.json?.workflowStatus}`);

  // 5. Site Engineer Signs Level 2
  console.log("\n▶ STEP 5: Level 2 — Site Engineer Review & Sign-Off");
  r = await req("POST", "/api/auth", { userName: "Arun", password: "SiteEng@1002" });
  const seCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Site Engineer verified all checklist points and Level 1 spot signatures.",
    signature: makeSignature("Site Engineer"),
  }, seCookie);
  console.log(`  ✓ Site Engineer Signed! Workflow Status: ${r.json?.workflowStatus}`);

  // 6. QA/QC In-Charge Signs Level 3
  console.log("\n▶ STEP 6: Level 3 — QA/QC In-Charge Approval");
  r = await req("POST", "/api/auth", { userName: "Kumar", password: "QAQC@1003" });
  const qaqcCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Quality assurance compliance and defect review passed.",
    signature: makeSignature("QA/QC In-Charge"),
  }, qaqcCookie);
  console.log(`  ✓ QA/QC Approved & Signed! Workflow Status: ${r.json?.workflowStatus}`);

  // 7. Project Manager Signs Level 3
  console.log("\n▶ STEP 7: Level 3 — Project Manager Approval");
  r = await req("POST", "/api/auth", { userName: "Project Manager", password: "PM@1005" });
  const pmCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Project progress and snag rectification timeline approved.",
    signature: makeSignature("Project Manager"),
  }, pmCookie);
  console.log(`  ✓ Project Manager Approved & Signed! Workflow Status: ${r.json?.workflowStatus}`);

  // 8. Manager Technical Signs Level 3
  console.log("\n▶ STEP 8: Level 3 — Manager Technical Review");
  r = await req("POST", "/api/auth", { userName: "Manager Technical", password: "ManTech@1006" });
  const mantechCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Technical standards compliance verified.",
    signature: makeSignature("Manager Technical"),
  }, mantechCookie);
  console.log(`  ✓ Manager Technical Approved & Signed! Workflow Status: ${r.json?.workflowStatus}`);

  // 9. GM – HUG Signs Level 3
  console.log("\n▶ STEP 9: Level 3 — GM – HUG Approval");
  r = await req("POST", "/api/auth", { userName: "GM HUG", password: "GM@1007" });
  const gmCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "General Manager approval granted.",
    signature: makeSignature("GM – HUG"),
  }, gmCookie);
  console.log(`  ✓ GM – HUG Approved & Signed! Workflow Status: ${r.json?.workflowStatus}`);

  // 10. VP – HUG Final Sign-Off
  console.log("\n▶ STEP 10: Level 3 — VP – HUG Final Authorization");
  r = await req("POST", "/api/auth", { userName: "VP HUG", password: "VP@1008" });
  const vpCookie = r.sessionCookie;
  r = await req("POST", "/api/approval", {
    inspectionId: inspId,
    action: "approve",
    comments: "Final Vice President handover authorization complete.",
    signature: makeSignature("VP – HUG"),
  }, vpCookie);
  console.log(`  ✓ VP – HUG Final Sign-Off! Workflow Status: ${r.json?.workflowStatus}`);

  // 11. Final State & Audit Verification
  console.log("\n▶ STEP 11: Final State & Signature Matrix Verification");
  r = await req("GET", `/api/approval?inspectionId=${inspId}`, null, seCookie);
  const finalDoc = r.json?.inspection;

  console.log(`  • Final Status: ${finalDoc?.workflowStatus}`);
  console.log(`  • Total Signatures Captured: ${Object.keys(finalDoc?.signatures || {}).length} / 8`);
  console.log(`  • Total Audit History Entries: ${finalDoc?.approvalHistory?.length} / 9`);

  const sigs = finalDoc?.signatures || {};
  console.log("\n  ─── CAPTURED SIGNATURES ROSTER ───");
  console.log(`  1. Technical Executive : ${sigs.technicalExecutive ? "✓ Captured (" + sigs.technicalExecutive.signer + ")" : "✗ Missing"}`);
  console.log(`  2. Customer            : ${sigs.customer ? "✓ Captured (" + sigs.customer.signer + ")" : "✗ Missing"}`);
  console.log(`  3. Site Engineer       : ${sigs.siteEngineer ? "✓ Captured (" + sigs.siteEngineer.signer + ")" : "✗ Missing"}`);
  console.log(`  4. QA/QC In-Charge     : ${sigs.qaqc ? "✓ Captured (" + sigs.qaqc.signer + ")" : "✗ Missing"}`);
  console.log(`  5. Project Manager     : ${sigs.projectManager ? "✓ Captured (" + sigs.projectManager.signer + ")" : "✗ Missing"}`);
  console.log(`  6. Manager Technical   : ${sigs.managerTechnical ? "✓ Captured (" + sigs.managerTechnical.signer + ")" : "✗ Missing"}`);
  console.log(`  7. GM – HUG            : ${sigs.gmHug ? "✓ Captured (" + sigs.gmHug.signer + ")" : "✗ Missing"}`);
  console.log(`  8. VP – HUG            : ${sigs.vpHug ? "✓ Captured (" + sigs.vpHug.signer + ")" : "✗ Missing"}`);

  console.log("\n============================================================");
  if (finalDoc?.workflowStatus === "COMPLETED" && Object.keys(sigs).length === 8) {
    console.log("  ✅ ENTIRE SIGNING FLOW TEST PASSED PERFECTLY!");
    console.log("============================================================");
    process.exit(0);
  } else {
    console.error("  ❌ TEST FAILED: INCOMPLETE SIGNATURE MATRIX");
    console.log("============================================================");
    process.exit(1);
  }
}

runEndToEndSigningFlow().catch(e => {
  console.error("Test execution aborted:", e.message);
  process.exit(1);
});
