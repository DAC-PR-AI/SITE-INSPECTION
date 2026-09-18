import http from 'http';

const BASE_URL = 'http://localhost:3002';

function req(method, path, body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (cookie) headers['Cookie'] = cookie;

    const request = http.request(
      url,
      { method, headers, timeout: 20000 },
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

const PASSED = '✅ PASS';
const FAILED = '❌ FAIL';

async function runAllUseCases() {
  console.log('================================================================');
  console.log('   FULL END-TO-END SYSTEM-WIDE USE CASE VERIFICATION SUITE       ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(name, condition, extra = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`${PASSED}: ${name}`);
    } else {
      console.error(`${FAILED}: ${name} ${extra}`);
    }
  }

  // 1. Authenticate All 9 Roles
  console.log('--- Phase 1: Authentication & Role Verification for All 9 Roles ---');
  const roles = [
    { name: 'Admin', user: 'Administrator', pass: 'Admin@9990', expectedRole: 'Admin' },
    { name: 'Technical Executive', user: 'Raj', pass: 'TechExec@1001', expectedRole: 'Technical Executive' },
    { name: 'Site Engineer', user: 'Arun', pass: 'SiteEng@1002', expectedRole: 'Site Engineer' },
    { name: 'QA/QC In-Charge', user: 'Kumar', pass: 'QAQC@1003', expectedRole: 'QA/QC In-Charge' },
    { name: 'Customer', user: 'Priya', pass: 'Customer@1004', expectedRole: 'Customer' },
    { name: 'Project Manager', user: 'PM', pass: 'PM@1005', expectedRole: 'Project Manager' },
    { name: 'Manager Technical', user: 'ManTech', pass: 'ManTech@1006', expectedRole: 'Manager Technical' },
    { name: 'GM – HUG', user: 'GM', pass: 'GM@1007', expectedRole: 'GM – HUG' },
    { name: 'VP – HUG', user: 'VP', pass: 'VP@1008', expectedRole: 'VP – HUG' },
  ];

  const sessions = {};
  for (const r of roles) {
    const res = await req('POST', '/api/auth', { userName: r.user, password: r.pass });
    assert(
      `Authenticate Role [${r.name}]`,
      res.status === 200 && res.json?.ok === true && res.json?.role === r.expectedRole && !!res.sessionCookie,
      JSON.stringify(res.json)
    );
    sessions[r.name] = res.sessionCookie;
  }

  // 2. Fetch Projects & Units Master Data
  console.log('\n--- Phase 2: Master Projects & Units Data Fetch ---');
  const projRes = await req('GET', '/api/projects');
  assert(
    'GET /api/projects returns valid projects map with units',
    projRes.status === 200 && typeof projRes.json?.projects === 'object' && Object.keys(projRes.json.projects).length > 0,
    JSON.stringify(projRes.json)
  );

  // 3. Create a Full Inspection with Checked Cells, Snags, Priority, and Photos
  console.log('\n--- Phase 3: Create & Submit Inspection (Level 1) ---');
  const testId = `USECASE-E2E-${Date.now()}`;
  const inspectionPayload = {
    inspectionId: testId,
    projectName: 'DAC Flora',
    unitNumber: 'F-101',
    customerName: 'Test Customer Anand',
    customerVerificationPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    cells: {
      '1__hall': { status: 'pass', remarks: 'Good finish' },
      '2__kitchen': { status: 'fail', remarks: 'Plumbing leak under sink', priority: 'HIGH', photos: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80'] },
      '3__bedroom1': { status: 'fail', remarks: 'Paint touch-up required on north wall', priority: 'LOW' },
      '4__toilet1': { status: 'na' },
      '5__balcony': { status: 'pass' },
    },
    generalRemarks: 'Overall standard construction quality. Snags to be addressed before final key handover.',
    declarationChecked: true,
    interiorDays: '30',
  };

  const submitRes = await req('POST', '/api/submit', inspectionPayload, sessions['Technical Executive']);
  assert(
    'Submit Inspection with Checklist & Snags',
    submitRes.status === 200 && submitRes.json?.ok === true,
    JSON.stringify(submitRes.json)
  );

  // 4. Verify Workflow Queue & Spot Signatures Gate Enforcements
  console.log('\n--- Phase 4: Parallel Gate Enforcement ---');
  // Site Engineer should NOT be able to approve before Technical Executive & Customer sign
  const prematureSiteEng = await req('POST', '/api/approval', {
    inspectionId: testId,
    action: 'approve',
    signature: 'data:image/png;base64,sigSiteEng',
  }, sessions['Site Engineer']);
  assert(
    'Gate Enforcement: Site Engineer blocked before Level 1 spot signatures',
    prematureSiteEng.status === 400 && prematureSiteEng.json?.error?.includes('Level 1'),
    JSON.stringify(prematureSiteEng.json)
  );

  // 5. Level 1 Parallel Signatures
  console.log('\n--- Phase 5: Level 1 Parallel Signatures ---');
  const teSign = await req('POST', '/api/approval', {
    inspectionId: testId,
    action: 'sign',
    signature: 'data:image/png;base64,sigTechExec',
  }, sessions['Technical Executive']);
  assert(
    'Technical Executive signs Level 1',
    teSign.status === 200 && teSign.json?.ok === true,
    JSON.stringify(teSign.json)
  );

  const custSign = await req('POST', '/api/approval', {
    inspectionId: testId,
    action: 'sign',
    signature: 'data:image/png;base64,sigCustomer',
  }, sessions['Customer']);
  assert(
    'Customer signs Level 1',
    custSign.status === 200 && custSign.json?.ok === true,
    JSON.stringify(custSign.json)
  );

  // 6. Level 2: Site Engineer Approval
  console.log('\n--- Phase 6: Level 2 Site Engineer Approval ---');
  const seApprove = await req('POST', '/api/approval', {
    inspectionId: testId,
    action: 'approve',
    comments: 'Verified on-site. Defect rectification monitored.',
    signature: 'data:image/png;base64,sigSiteEng2',
  }, sessions['Site Engineer']);
  assert(
    'Site Engineer reviews and approves Level 2',
    seApprove.status === 200 && seApprove.json?.ok === true && seApprove.json?.inspection?.workflowStatus === 'QA_QC_PENDING',
    JSON.stringify(seApprove.json)
  );

  // 7. Level 3: QA/QC In-Charge Rejection & Stage Rollback Test
  console.log('\n--- Phase 7: QA/QC Stage Rejection & Workflow Rollback ---');
  const qaqcReject = await req('POST', '/api/approval', {
    inspectionId: testId,
    action: 'reject',
    comments: 'Re-inspection needed for sink plumbing joints.',
    signature: 'data:image/png;base64,sigQaqc',
  }, sessions['QA/QC In-Charge']);
  assert(
    'QA/QC In-Charge rejects inspection stage',
    qaqcReject.status === 200 && qaqcReject.json?.ok === true && qaqcReject.json?.inspection?.workflowStatus === 'REJECTED',
    JSON.stringify(qaqcReject.json)
  );

  // Site Engineer re-inspects / approves after rectification
  const seReApprove = await req('POST', '/api/approval', {
    inspectionId: testId,
    action: 'approve',
    comments: 'Plumbing leak rectified and re-tested.',
    signature: 'data:image/png;base64,sigSiteEngRectified',
  }, sessions['Site Engineer']);
  assert(
    'Site Engineer re-inspects and re-submits after rejection',
    seReApprove.status === 200 && seReApprove.json?.ok === true && seReApprove.json?.inspection?.workflowStatus === 'QA_QC_PENDING',
    JSON.stringify(seReApprove.json)
  );

  // 8. Sequential Progression through all remaining stakeholders
  console.log('\n--- Phase 8: Sequential Progression Through All Stages ---');
  const sequentialSteps = [
    { role: 'QA/QC In-Charge', nextStatus: 'PROJECT_MANAGER_PENDING', comment: 'Quality confirmed passed' },
    { role: 'Project Manager', nextStatus: 'MANAGER_TECHNICAL_PENDING', comment: 'Approved for tech directorate' },
    { role: 'Manager Technical', nextStatus: 'GM_HUG_PENDING', comment: 'Technical compliance validated' },
    { role: 'GM – HUG', nextStatus: 'VP_HUG_PENDING', comment: 'GM approval granted' },
    { role: 'VP – HUG', nextStatus: 'COMPLETED', comment: 'VP Final authorization & key handover authorized' },
  ];

  for (const step of sequentialSteps) {
    const res = await req('POST', '/api/approval', {
      inspectionId: testId,
      action: 'approve',
      comments: step.comment,
      signature: `data:image/png;base64,sig_${step.role.replace(/\s+/g, '_')}`,
    }, sessions[step.role]);
    assert(
      `Step [${step.role}] approve -> Expect status: ${step.nextStatus}`,
      res.status === 200 && res.json?.ok === true && res.json?.inspection?.workflowStatus === step.nextStatus,
      JSON.stringify(res.json)
    );
  }

  // 9. Verify Final Inspection Details & Signatures Retrieval
  console.log('\n--- Phase 9: Final Inspection Retrieval & Signatures Tab Verification ---');
  const finalGet = await req('GET', `/api/approval?inspectionId=${encodeURIComponent(testId)}`, null, sessions['Admin']);
  const insp = finalGet.json?.inspection;
  assert(
    'Inspection status is COMPLETED',
    finalGet.status === 200 && (insp?.status === 'COMPLETED' || insp?.status === 'APPROVED') && insp?.workflowStatus === 'COMPLETED',
    JSON.stringify(finalGet.json)
  );
  assert(
    'All 8 stakeholder signatures captured in record',
    !!insp?.signatures?.siteEngineer &&
    !!insp?.signatures?.customer &&
    !!insp?.signatures?.technicalExecutive &&
    !!insp?.signatures?.qaqc &&
    !!insp?.signatures?.projectManager &&
    !!insp?.signatures?.managerTechnical &&
    !!insp?.signatures?.gmHug &&
    !!insp?.signatures?.vpHug,
    JSON.stringify(insp?.signatures)
  );
  assert(
    'Approval history audit trail contains all review logs',
    Array.isArray(insp?.approvalHistory) && insp.approvalHistory.length >= 7,
    `History count: ${insp?.approvalHistory?.length}`
  );

  console.log('\n================================================================');
  console.log(`   TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL BACKEND WORKFLOW AND SECURITY USE CASES PASSED WITH 100% SUCCESS!');
  } else {
    process.exit(1);
  }
}

runAllUseCases().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
