import http from 'http';
import { WORKFLOW_STATES } from '../lib/workflow.js';

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
      { method, headers, timeout: 15000 },
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

async function debug() {
  console.log('Logging in roles...');
  const teAuth = await req('POST', '/api/auth', { userName: 'Raj', password: 'TechExec@1001' });
  const custAuth = await req('POST', '/api/auth', { userName: 'Priya', password: 'Customer@1004' });
  const seAuth = await req('POST', '/api/auth', { userName: 'Arun', password: 'SiteEng@1002' });
  const qaqcAuth = await req('POST', '/api/auth', { userName: 'Kumar', password: 'QAQC@1003' });
  const pmAuth = await req('POST', '/api/auth', { userName: 'PM', password: 'PM@1005' });
  const mantechAuth = await req('POST', '/api/auth', { userName: 'ManTech', password: 'ManTech@1006' });
  const gmAuth = await req('POST', '/api/auth', { userName: 'GM', password: 'GM@1007' });
  const vpAuth = await req('POST', '/api/auth', { userName: 'VP', password: 'VP@1008' });

  const teCookie = teAuth.sessionCookie;
  const custCookie = custAuth.sessionCookie;
  const seCookie = seAuth.sessionCookie;
  const qaqcCookie = qaqcAuth.sessionCookie;
  const pmCookie = pmAuth.sessionCookie;
  const mantechCookie = mantechAuth.sessionCookie;
  const gmCookie = gmAuth.sessionCookie;
  const vpCookie = vpAuth.sessionCookie;

  console.log('\n--- 1. Submitting test inspection ---');
  const flowId = `DEBUG-FLOW-${Date.now()}`;
  let r = await req('POST', '/api/submit', {
    inspectionId: flowId,
    projectName: 'DAC Flora',
    unitNumber: 'F-301',
    customerName: 'Anand',
    customerVerificationPhoto: 'data:image/png;base64,iVBORw0KGgo=',
  }, teCookie);
  console.log('Submit result:', r.status, r.json);

  console.log('\n--- 2. Gate check: SE cannot sign before Level 1 ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,abc' }, seCookie);
  console.log('SE gate check:', r.status, r.json);

  console.log('\n--- 3. Tech Exec signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'sign', signature: 'data:image/png;base64,te' }, teCookie);
  console.log('TE sign:', r.status, r.json);

  console.log('\n--- 4. Customer signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'sign', signature: 'data:image/png;base64,cust' }, custCookie);
  console.log('Customer sign:', r.status, r.json);

  console.log('\n--- 5. Site Engineer signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,se' }, seCookie);
  console.log('SE sign:', r.status, r.json);

  console.log('\n--- 6. VP out of turn gate check ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,vp' }, vpCookie);
  console.log('VP out of turn:', r.status, r.json);

  console.log('\n--- 7. QA/QC signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,qaqc' }, qaqcCookie);
  console.log('QA/QC sign:', r.status, r.json);

  console.log('\n--- 8. PM signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,pm' }, pmCookie);
  console.log('PM sign:', r.status, r.json);

  console.log('\n--- 9. Tech Mgr signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,mantech' }, mantechCookie);
  console.log('Tech Mgr sign:', r.status, r.json);

  console.log('\n--- 10. GM signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,gm' }, gmCookie);
  console.log('GM sign:', r.status, r.json);

  console.log('\n--- 11. VP final signs ---');
  r = await req('POST', '/api/approval', { inspectionId: flowId, action: 'approve', signature: 'data:image/png;base64,vp' }, vpCookie);
  console.log('VP final sign:', r.status, r.json);
}

debug().catch(console.error);
