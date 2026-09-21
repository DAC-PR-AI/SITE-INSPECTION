import http from 'http';

const BASE_URL = 'http://localhost:3002';

// 8 distinct base64 PNG signatures (120x50 transparent PNG with dark blue strokes)
// Generated minimal valid PNGs
const SIGNATURE_IMAGES = {
  customer: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABmSURBVFhH7dexDQAwCAOh+8+8gWqXo4j56jV3wYc4v+737wQWAgQCBAIECISAgQCBAIECBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIHw761pCqH7iA+PAAAAAElFTkSuQmCC",
  technicalExecutive: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABoSURBVFhH7dchDgAwCANB97+5J45pU+gZqG9zX/Bqzp+/e1/AYYFAgUCBAIECIWAgQCBAIEAgQCBAIEAIFAgQCBAIECgQCBACBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIEAgfDvrakK4fsDdf8Agd56+eQAAAAASUVORK5CYII=",
  siteEngineer: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABqSURBVFhH7dexDYAwEADBz8M11EBR9qAQ5SrqdMEnu34+vxd4MhAoECAQIBAgBAwECAQIBAgECAQIBAgECAQIBAgECAQIBAiBAgECAQIBAgECAQIBAgECAQIBAgFCwECAQIBAgECAQIBAgECAn24d6Qr1+8gPrqkB0Xk2yXUAAAAASUVORK5CYII=",
  qaqc: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABnSURBVFhH7dexDQAwCAOh+8+8gaqtioj56jV3wYc4v+737wQWAgQCBAIECISAgQCBAIECBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIHw761pCqH7iA+PAAAAAElFTkSuQmCC",
  projectManager: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABoSURBVFhH7dchDgAwCANB97+5J45pU+gZqG9zX/Bqzp+/e1/AYYFAgUCBAIECIWAgQCBAIEAgQCBAIEAIFAgQCBAIECgQCBACBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIEAgfDvrakK4fsDdf8Agd56+eQAAAAASUVORK5CYII=",
  managerTechnical: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABqSURBVFhH7dexDYAwEADBz8M11EBR9qAQ5SrqdMEnu34+vxd4MhAoECAQIBAgBAwECAQIBAgECAQIBAgECAQIBAgECAQIBAiBAgECAQIBAgECAQIBAgECAQIBAgFCwECAQIBAgECAQIBAgECAn24d6Qr1+8gPrqkB0Xk2yXUAAAAASUVORK5CYII=",
  gmHug: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABnSURBVFhH7dexDQAwCAOh+8+8gaqtioj56jV3wYc4v+737wQWAgQCBAIECISAgQCBAIECBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIHw761pCqH7iA+PAAAAAElFTkSuQmCC",
  vpHug: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAeCAYAAAC5cvvyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABoSURBVFhH7dchDgAwCANB97+5J45pU+gZqG9zX/Bqzp+/e1/AYYFAgUCBAIECIWAgQCBAIEAgQCBAIEAIFAgQCBAIECgQCBACBAIEAgQChICBAIEAgQCBAIECBAIEAgQChICBAIEAgfDvrakK4fsDdf8Agd56+eQAAAAASUVORK5CYII=",
};

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (cookie) headers['Cookie'] = cookie;

    const request = http.request(
      url,
      { method, headers, timeout: 25000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          const setCookie = res.headers['set-cookie'];
          const sessionCookie = setCookie ? setCookie.find(c => c.startsWith('dac_session=')) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            sessionCookie,
          });
        });
      }
    );

    request.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (postData) request.write(postData);
    request.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runFullSignoffFlow() {
  console.log('================================================================');
  console.log('   CREATE FULL INSPECTION & PROCESS ALL 8 DIGITAL SIGNATURES    ');
  console.log('================================================================\n');

  // 1. Authenticate All Roles
  console.log('1. Logging in all 8 roles...');
  const users = {
    te: { user: 'Raj', pass: 'TechExec@1001', role: 'Technical Executive' },
    cust: { user: 'Priya', pass: 'Customer@1004', role: 'Customer' },
    se: { user: 'Arun', pass: 'SiteEng@1002', role: 'Site Engineer' },
    qaqc: { user: 'Kumar', pass: 'QAQC@1003', role: 'QA/QC In-Charge' },
    pm: { user: 'PM', pass: 'PM@1005', role: 'Project Manager' },
    mantech: { user: 'ManTech', pass: 'ManTech@1006', role: 'Manager Technical' },
    gm: { user: 'GM', pass: 'GM@1007', role: 'GM – HUG' },
    vp: { user: 'VP', pass: 'VP@1008', role: 'VP – HUG' },
    admin: { user: 'Administrator', pass: 'Admin@9990', role: 'Admin' },
  };

  const sessions = {};
  for (const [key, u] of Object.entries(users)) {
    const res = await req('POST', '/api/auth', { userName: u.user, password: u.pass });
    if (!res.sessionCookie) {
      console.error(`Failed to login ${u.role}:`, res.json);
      process.exit(1);
    }
    sessions[key] = res.sessionCookie;
    console.log(`  ✓ Logged in ${u.role} (${u.user})`);
  }

  // 2. Build full 11 items x 10 areas checklist where ALL items are evaluated (100% evaluated points)
  console.log('\n2. Constructing full 11-category × 10-area inspection checklist matrix...');
  const CHECKLIST_COLS = ['living', 'dining', 'kitchen', 'utility', 'mbed', 'bed2', 'bed3', 'toilets', 'balcony', 'addl'];
  const cells = {};

  for (let rowId = 1; rowId <= 11; rowId++) {
    CHECKLIST_COLS.forEach((colKey, colIdx) => {
      // Set majority to pass, a couple to fail with notes, and addl to na
      if (colKey === 'addl') {
        cells[`${rowId}__${colKey}`] = { status: 'na' };
      } else if (rowId === 3 && colKey === 'bedroom1') {
        cells[`${rowId}__${colKey}`] = { status: 'fail', remarks: 'Paint touch-up verified on north wall', priority: 'LOW' };
      } else if (rowId === 10 && colKey === 'utility') {
        cells[`${rowId}__${colKey}`] = { status: 'fail', remarks: 'Plumbing washer replaced and pressure tested', priority: 'NORMAL' };
      } else {
        cells[`${rowId}__${colKey}`] = { status: 'pass' };
      }
    });
  }

  const inspectionId = `DAC-FULL-SIG-${Date.now()}`;
  console.log(`  Generated Inspection ID: ${inspectionId}`);

  const inspectionPayload = {
    inspectionId,
    projectName: 'DAC Flora',
    unitNumber: 'F-302',
    customerName: 'K. Senthil Nathan',
    inspectionDate: '2026-09-18',
    inspectionTime: '10:30 AM',
    inspectionType: 'INTERIOR JOINT INSPECTION',
    customerVerificationPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    cells,
    generalRemarks: 'Joint Inspection completed thoroughly across all 11 categories. All defects rectified to client satisfaction. Key handover approved.',
    declarationChecked: true,
    interiorDays: '30',
  };

  // 3. Submit Initial Inspection
  console.log('\n3. Submitting inspection form to cloud...');
  const submitRes = await req('POST', '/api/submit', inspectionPayload, sessions.te);
  console.log('  Submit status:', submitRes.status, submitRes.json?.ok ? '✓ OK' : submitRes.json);
  await sleep(1000);

  // 4. Level 1: Technical Executive & Customer Spot Signatures
  console.log('\n4. Capturing Level 1 Spot Signatures (Technical Executive & Customer)...');
  const teSignRes = await req('POST', '/api/approval', {
    inspectionId,
    action: 'sign',
    comments: 'Level 1 Technical Inspection completed on-site.',
    signature: SIGNATURE_IMAGES.technicalExecutive,
  }, sessions.te);
  console.log('  ✓ Tech Exec Signed:', teSignRes.status, teSignRes.json?.workflowStatus);

  const custSignRes = await req('POST', '/api/approval', {
    inspectionId,
    action: 'sign',
    comments: 'I have inspected the unit and accepted the condition.',
    signature: SIGNATURE_IMAGES.customer,
  }, sessions.cust);
  console.log('  ✓ Customer Signed:', custSignRes.status, custSignRes.json?.workflowStatus);
  await sleep(1000);

  // 5. Level 2: Site Engineer Approval & Signature
  console.log('\n5. Capturing Level 2 Site Engineer Approval & Signature...');
  const seSignRes = await req('POST', '/api/approval', {
    inspectionId,
    action: 'approve',
    comments: 'Site Engineer verified all checklist points and defect rectification.',
    signature: SIGNATURE_IMAGES.siteEngineer,
  }, sessions.se);
  console.log('  ✓ Site Engineer Approved:', seSignRes.status, 'New Workflow Status:', seSignRes.json?.workflowStatus);
  await sleep(1000);

  // 6. Level 3 Sequential Approvals (QA/QC -> PM -> Manager Technical -> GM -> VP)
  const sequentialRoles = [
    { key: 'qaqc', label: 'QA/QC In-Charge', roleName: 'QA/QC In-Charge', sig: SIGNATURE_IMAGES.qaqc, comment: 'Quality compliance approved with zero critical snags.' },
    { key: 'pm', label: 'Project Manager', roleName: 'Project Manager', sig: SIGNATURE_IMAGES.projectManager, comment: 'Project delivery verified and approved.' },
    { key: 'mantech', label: 'Manager Technical', roleName: 'Manager Technical', sig: SIGNATURE_IMAGES.managerTechnical, comment: 'Technical directorate sign-off granted.' },
    { key: 'gm', label: 'GM – HUG', roleName: 'GM – HUG', sig: SIGNATURE_IMAGES.gmHug, comment: 'General Manager clearance granted for handover.' },
    { key: 'vp', label: 'VP – HUG', roleName: 'VP – HUG', sig: SIGNATURE_IMAGES.vpHug, comment: 'VP Final authorization granted. Key release approved.' },
  ];

  for (const step of sequentialRoles) {
    console.log(`\n6. Capturing ${step.label} Approval & Digital Signature...`);
    const res = await req('POST', '/api/approval', {
      inspectionId,
      action: 'approve',
      comments: step.comment,
      signature: step.sig,
    }, sessions[step.key]);
    console.log(`  ✓ ${step.label} Approved:`, res.status, 'New Workflow Status:', res.json?.workflowStatus);
    await sleep(800);
  }

  // 7. Verify Final Inspection Record & Stored Signatures
  console.log('\n7. Verifying final record from database / Google Sheets...');
  const verifyRes = await req('GET', `/api/approval?inspectionId=${encodeURIComponent(inspectionId)}`, null, sessions.admin);
  const finalDoc = verifyRes.json?.inspection;

  console.log('\n================================================================');
  console.log('   FINAL INSPECTION RECORD SUMMARY                              ');
  console.log('================================================================');
  console.log(`Inspection ID    : ${finalDoc?.inspectionId}`);
  console.log(`Project & Unit   : ${finalDoc?.projectName} - Unit ${finalDoc?.unitNumber}`);
  console.log(`Customer Name    : ${finalDoc?.customerName}`);
  console.log(`Overall Status   : ${finalDoc?.status} / Workflow: ${finalDoc?.workflowStatus}`);
  console.log(`Evaluated Points : Passed: ${finalDoc?.passedCount} | Failed: ${finalDoc?.failedCount} | NA: ${finalDoc?.naCount}`);
  console.log(`Declaration Check: ${finalDoc?.declarationChecked ? 'Yes (Confirmed)' : 'No'}`);
  console.log(`Interior Duration: ${finalDoc?.interiorDays || 30} days`);

  console.log('\n--- 8 Signatures Verification ---');
  const sigs = finalDoc?.signatures || {};
  const rolesExpected = [
    'customer',
    'siteEngineer',
    'qaqc',
    'projectManager',
    'technicalExecutive',
    'managerTechnical',
    'gmHug',
    'vpHug',
  ];

  let allSigned = true;
  for (const r of rolesExpected) {
    const val = sigs[r];
    const hasData = !!val && (typeof val === 'string' || !!val.dataUrl || !!val.signer || val.status === 'signed');
    console.log(`  ${hasData ? '✅' : '❌'} [${r}]: ${val ? (typeof val === 'string' ? val.substring(0, 30) + '...' : JSON.stringify(val).substring(0, 45) + '...') : 'MISSING'}`);
    if (!hasData) allSigned = false;
  }

  console.log(`\nAudit Trail Logs : ${finalDoc?.approvalHistory?.length || 0} entries`);

  if (allSigned && finalDoc?.workflowStatus === 'COMPLETED') {
    console.log('\n🎉 ALL 8 DIGITAL SIGNATURES CAPTURED AND RECORD COMPLETED SUCCESSFULLY!');
    return inspectionId;
  } else {
    console.error('\n⚠️ Some signatures missing or status not completed.');
    process.exit(1);
  }
}

runFullSignoffFlow().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
