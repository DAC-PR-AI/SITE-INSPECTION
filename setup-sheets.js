const fs = require('fs');

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const rawVal = trimmed.slice(eqIdx + 1).trim();
  const val = rawVal.startsWith('"') && rawVal.endsWith('"') ? rawVal.slice(1, -1) : rawVal;
  envVars[key] = val;
}

const { google } = require('googleapis');
const privateKey = envVars['GOOGLE_SHEETS_PRIVATE_KEY'].replace(/\\n/g, '\n');
const spreadsheetId = envVars['GOOGLE_SHEET_ID'];

const auth = new google.auth.JWT(
  envVars['GOOGLE_SHEETS_CLIENT_EMAIL'],
  undefined,
  privateKey,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const SHEETS_TO_CREATE = [
  {
    name: 'Inspections',
    headers: [
      'InspectionId', 'Project', 'Unit', 'CustomerName', 'Date', 'Time',
      'Status', 'CompletionPct', 'Passed', 'Failed', 'NA', 'DeclarationChecked',
      'UpdatedAt', 'SubmittedAt',
      'DataJSON_1', 'DataJSON_2', 'DataJSON_3', 'DataJSON_4', 'DataJSON_5',
      'DataJSON_6', 'DataJSON_7', 'DataJSON_8', 'DataJSON_9', 'DataJSON_10',
      'DataJSON_11', 'DataJSON_12'
    ]
  },
  {
    name: 'Projects',
    headers: ['Project', 'Unit']
  },
  {
    name: 'ApprovalHistory',
    headers: [
      'InspectionID', 'Project', 'Unit', 'InspectionType', 'Role',
      'UserName', 'Action', 'Status', 'Comments', 'Timestamp', 'SignatureCaptured'
    ]
  },
  {
    name: 'Signatures',
    headers: [
      'InspectionId', 'Role', 'SignerName', 'Timestamp',
      'SigData_1', 'SigData_2', 'SigData_3', 'SigData_4', 'SigData_5',
      'SigData_6', 'SigData_7', 'SigData_8', 'SigData_9', 'SigData_10',
      'SigData_11', 'SigData_12', 'SigData_13', 'SigData_14', 'SigData_15',
      'SigData_16', 'SigData_17', 'SigData_18', 'SigData_19', 'SigData_20'
    ]
  }
];

// Seed projects data (to add to Projects tab)
const SEED_PROJECTS = [
  ['DAC Aspire Heights', 'A-101'],
  ['DAC Aspire Heights', 'A-102'],
  ['DAC Aspire Heights', 'A-203'],
  ['DAC Aspire Heights', 'B-201'],
  ['DAC Aspire Heights', 'B-202'],
  ['DAC Aspire Heights', 'B-305'],
  ['DAC Serene County', 'T1-01'],
  ['DAC Serene County', 'T1-02'],
  ['DAC Serene County', 'T2-01'],
  ['DAC Serene County', 'T2-04'],
  ['DAC Elan Grande', 'G-301'],
  ['DAC Elan Grande', 'G-302'],
  ['DAC Elan Grande', 'G-401'],
  ['DAC Elan Grande', 'G-402'],
];

async function setup() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // Get existing sheet names
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingNames = meta.data.sheets.map(s => s.properties.title);
  console.log('Existing tabs:', existingNames.join(', '));

  // Create missing tabs
  const addRequests = SHEETS_TO_CREATE
    .filter(s => !existingNames.includes(s.name))
    .map(s => ({ addSheet: { properties: { title: s.name } } }));

  if (addRequests.length > 0) {
    console.log('Creating tabs:', addRequests.map(r => r.addSheet.properties.title).join(', '));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests }
    });
    console.log('Tabs created!');
  } else {
    console.log('All tabs already exist.');
  }

  // Write headers to each tab
  for (const sheet of SHEETS_TO_CREATE) {
    const range = `${sheet.name}!A1:1`;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheet.name}!A1`
    }).catch(() => ({ data: { values: null } }));

    if (!existing.data.values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheet.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [sheet.headers] }
      });
      console.log(`  ✓ Headers written to ${sheet.name} (${sheet.headers.length} columns)`);
    } else {
      console.log(`  ⟳ ${sheet.name} already has data in A1 — skipping header write`);
    }
  }

  // Add seed projects to Projects tab
  const projExisting = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Projects!A2:B2'
  }).catch(() => ({ data: { values: null } }));

  if (!projExisting.data.values) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Projects!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: SEED_PROJECTS }
    });
    console.log(`  ✓ ${SEED_PROJECTS.length} seed projects added to Projects tab`);
  } else {
    console.log('  ⟳ Projects tab already has data — skipping seed');
  }

  console.log('\n✅ Google Sheets setup complete! All tabs and headers ready.');
}

setup().catch(e => {
  console.error('Setup failed:', e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});
