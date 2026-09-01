const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const { google } = require('googleapis');
const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const USER_HEADERS = ['user_id', 'name', 'number', 'email', 'role', 'status', 'password'];

const SEED_USERS = [
  ['U001', 'Raj',               '1001', 'techexec@dac.com',     'Technical Executive', 'Active', 'TechExec@1001'],
  ['U002', 'Arun',              '1002', 'siteengineer@dac.com', 'Site Engineer',       'Active', 'SiteEng@1002'],
  ['U003', 'Kumar',             '1003', 'qaqc@dac.com',         'QA/QC In-Charge',    'Active', 'QAQC@1003'],
  ['U004', 'Priya',             '1004', 'customer@dac.com',     'Customer',           'Active', 'Customer@1004'],
  ['U005', 'Project Manager',   '1005', 'pm@dac.com',           'Project Manager',    'Active', 'PM@1005'],
  ['U006', 'Manager Technical', '1006', 'mantech@dac.com',      'Manager Technical',  'Active', 'ManTech@1006'],
  ['U007', 'GM HUG',            '1007', 'gm@dac.com',           'GM – HUG',           'Active', 'GM@1007'],
  ['U008', 'VP HUG',            '1008', 'vp@dac.com',           'VP – HUG',           'Active', 'VP@1008'],
  ['U009', 'Administrator',     '9990', 'admin@dac.com',        'Admin',              'Active', 'Admin@9990'],
  ['U010', 'Disabled User',     '0000', 'inactive@dac.com',     'QA/QC In-Charge',    'Inactive', 'Inactive@0000'],
];

async function seed() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Seeding Users tab in Google Sheet ID:', spreadsheetId);

  // Clear existing Users range
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Users!A1:Z100',
  }).catch(() => {});

  // Write headers + user rows
  const allRows = [USER_HEADERS, ...SEED_USERS];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Users!A1',
    valueInputOption: 'RAW',
    requestBody: { values: allRows },
  });

  console.log('✅ Successfully seeded Users tab with 7-column header + 10 user records!');
  console.log('\nUser Roster & Passwords:');
  SEED_USERS.forEach(u => {
    console.log(`  - [${u[4].padEnd(20)}] Name: ${u[1].padEnd(18)} Number: ${u[2]}  Password: ${u[6]}`);
  });
}

seed().catch(e => {
  console.error('Seeding failed:', e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});
