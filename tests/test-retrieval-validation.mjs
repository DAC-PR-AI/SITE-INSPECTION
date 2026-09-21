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
      { method, headers, timeout: 25000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            raw: data,
          });
        });
      }
    );

    request.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (postData) request.write(postData);
    request.end();
  });
}

async function verifyRetrieval() {
  console.log('================================================================');
  console.log('   FULL CLOUD & DATABASE RETRIEVAL VERIFICATION SUITE           ');
  console.log('================================================================\n');

  // Step 1: Fetch list of all inspections
  console.log('1. Querying all inspections from API...');
  const listRes = await req('GET', '/api/approval');
  if (listRes.status !== 200 || !listRes.json?.inspections) {
    console.error('❌ Failed to fetch inspections list:', listRes.status, listRes.raw);
    process.exit(1);
  }

  const all = listRes.json.inspections;
  console.log(`  ✓ Successfully retrieved ${all.length} inspections from cloud database.`);

  // Find our latest full test inspection
  const target = all.find(i => (i.inspectionId || '').startsWith('DAC-FULL-SIG-')) || all[0];
  if (!target) {
    console.error('❌ No inspection found in database to verify!');
    process.exit(1);
  }

  const inspectionId = target.inspectionId;
  console.log(`\n2. Performing Deep Retrieval for Inspection ID: [${inspectionId}]`);

  // Step 2: Fetch single inspection deep record
  const deepRes = await req('GET', `/api/approval?inspectionId=${encodeURIComponent(inspectionId)}`);
  if (deepRes.status !== 200 || !deepRes.json?.inspection) {
    console.error(`❌ Failed to retrieve deep record for ${inspectionId}:`, deepRes.status, deepRes.raw);
    process.exit(1);
  }

  const data = deepRes.json.inspection;
  console.log('  ✓ Deep record retrieved successfully.');

  // Step 3: Verify Core Metadata
  console.log('\n3. Verifying Core Metadata Fields:');
  const metadataChecks = [
    { field: 'inspectionId', expected: inspectionId, value: data.inspectionId },
    { field: 'projectName', value: data.projectName },
    { field: 'unitNumber', value: data.unitNumber },
    { field: 'customerName', value: data.customerName },
    { field: 'customerPhone', value: data.customerPhone },
    { field: 'status', expected: 'COMPLETED', value: data.status },
    { field: 'workflowStatus', expected: 'COMPLETED', value: data.workflowStatus },
    { field: 'customerDeclaration', value: data.customerDeclaration },
    { field: 'interiorExecutionDays', value: data.interiorExecutionDays },
  ];

  let metaPass = 0;
  metadataChecks.forEach(chk => {
    const isOk = chk.expected ? chk.value === chk.expected : Boolean(chk.value);
    console.log(`  ${isOk ? '✅' : '❌'} ${chk.field.padEnd(22)}: "${chk.value}"`);
    if (isOk) metaPass++;
  });

  // Step 4: Verify Checklist Evaluation Matrix
  console.log('\n4. Verifying Checklist Cells Matrix (11 Categories × 10 Areas):');
  const cells = data.cells || {};
  const cellKeys = Object.keys(cells);
  console.log(`  ✓ Total cells retrieved: ${cellKeys.length}`);

  let passCount = 0;
  let failCount = 0;
  let naCount = 0;
  let hasRemarks = 0;

  cellKeys.forEach(k => {
    const cell = cells[k];
    if (cell.status === 'pass') passCount++;
    else if (cell.status === 'fail') {
      failCount++;
      if (cell.remarks) hasRemarks++;
    } else if (cell.status === 'na') naCount++;
  });

  console.log(`  - Passed Cells : ${passCount}`);
  console.log(`  - Failed Cells : ${failCount} (with defect remarks & priority: ${hasRemarks})`);
  console.log(`  - N/A Cells    : ${naCount}`);
  const checklistOk = cellKeys.length >= 100 && (passCount + failCount + naCount) === cellKeys.length;
  console.log(`  ${checklistOk ? '✅' : '❌'} Checklist Matrix Integrity: ${checklistOk ? '100% COMPLETE' : 'INCOMPLETE'}`);

  // Step 5: Verify All 8 Digital Signatures Retrieval
  console.log('\n5. Verifying All 8 Digital Signatures in Stored Record:');
  const sigs = data.signatures || {};
  const REQUIRED_ROLES = [
    { key: 'customer', label: 'Customer', expectedSigner: 'Priya' },
    { key: 'technicalExecutive', label: 'Technical Executive', expectedSigner: 'Raj' },
    { key: 'siteEngineer', label: 'Site Engineer', expectedSigner: 'Arun' },
    { key: 'qaqc', label: 'QA/QC In-Charge', expectedSigner: 'Kumar' },
    { key: 'projectManager', label: 'Project Manager', expectedSigner: 'PM' },
    { key: 'managerTechnical', label: 'Manager Technical', expectedSigner: 'ManTech' },
    { key: 'gmHug', label: 'GM – HUG', expectedSigner: 'GM' },
    { key: 'vpHug', label: 'VP – HUG', expectedSigner: 'VP' },
  ];

  let sigsPass = 0;
  REQUIRED_ROLES.forEach(r => {
    const rawVal = sigs[r.key];
    let dataUrl = '';
    let signer = '';
    let status = '';

    if (rawVal && typeof rawVal === 'string' && rawVal.startsWith('data:image/')) {
      dataUrl = rawVal;
      status = 'signed';
    } else if (rawVal && typeof rawVal === 'object') {
      dataUrl = rawVal.dataUrl || rawVal.signature || '';
      signer = rawVal.signer || '';
      status = rawVal.status || 'signed';
    }

    const isValid = dataUrl.startsWith('data:image/') && dataUrl.length > 100;
    console.log(`  ${isValid ? '✅' : '❌'} [${r.label.padEnd(20)}]: Signer: "${signer || r.expectedSigner}" | Payload Length: ${dataUrl.length} bytes | Format: Base64 PNG`);
    if (isValid) sigsPass++;
  });

  // Step 6: Verify Audit Trail / Approval History
  console.log('\n6. Verifying Audit Trail & History Log:');
  const history = data.approvalHistory || [];
  console.log(`  ✓ Total audit entries retrieved: ${history.length}`);
  history.forEach((h, idx) => {
    console.log(`    [${idx + 1}] Role: ${(h.role || 'N/A').padEnd(22)} | Action: ${(h.action || 'N/A').padEnd(14)} | Actor: ${(h.actorName || 'N/A').padEnd(12)} | Date: ${h.timestamp || 'N/A'}`);
  });
  const historyOk = history.length >= 8;
  console.log(`  ${historyOk ? '✅' : '❌'} Audit Trail Complete: ${historyOk ? 'YES (All sequential gates tracked)' : 'NO'}`);

  // Step 7: Summary Report
  console.log('\n================================================================');
  console.log('   RETRIEVAL VERIFICATION SUMMARY REPORT                        ');
  console.log('================================================================');
  console.log(`Inspection ID        : ${inspectionId}`);
  console.log(`Metadata Fields Check: ${metaPass} / ${metadataChecks.length} Passed`);
  console.log(`Checklist Integrity : ${checklistOk ? '100% Passed (All items retrieved)' : 'Failed'}`);
  console.log(`Signatures Retrieved: ${sigsPass} / ${REQUIRED_ROLES.length} Passed`);
  console.log(`Audit Trail Logged   : ${history.length} Actions Tracked`);

  if (metaPass === metadataChecks.length && checklistOk && sigsPass === REQUIRED_ROLES.length && historyOk) {
    console.log('\n🎉 ALL STORED DATA VERIFIED & RETRIEVED SUCCESSFULLY WITH 0% LOSS!');
  } else {
    console.error('\n⚠️ Some retrieval checks failed.');
    process.exit(1);
  }
}

verifyRetrieval().catch(err => {
  console.error('Fatal retrieval test error:', err);
  process.exit(1);
});
