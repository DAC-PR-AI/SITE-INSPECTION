import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let v = (match[2] || '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[match[1]] = v;
  }
});

import { getProjects, getInspection } from './lib/sheets.js';

async function test() {
  console.log('Testing getProjects()...');
  const projs = await getProjects();
  console.log('FETCHED PROJECTS FROM SHEETS:', JSON.stringify(projs, null, 2));

  console.log('Testing getInspection("DAC-JIC-260918-7872")...');
  const insp = await getInspection('DAC-JIC-260918-7872');
  console.log('FETCHED INSPECTION:', insp ? {
    id: insp.inspectionId,
    project: insp.projectName,
    unit: insp.unitNumber,
    status: insp.workflowStatus,
    customerName: insp.customerName,
    signatures: Object.keys(insp.signatures || {})
  } : 'NOT FOUND');
}

test().catch(console.error);
