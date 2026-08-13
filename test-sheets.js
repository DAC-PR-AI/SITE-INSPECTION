const fs = require('fs');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
let currentKey = null;
let currentVal = '';

for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const rawVal = trimmed.slice(eqIdx + 1).trim();
  // Strip surrounding quotes
  const val = rawVal.startsWith('"') && rawVal.endsWith('"') ? rawVal.slice(1, -1) : rawVal;
  envVars[key] = val;
}

console.log('Email:', envVars['GOOGLE_SHEETS_CLIENT_EMAIL']);
console.log('Sheet ID:', envVars['GOOGLE_SHEET_ID']);
console.log('Key starts with:', envVars['GOOGLE_SHEETS_PRIVATE_KEY']?.slice(0, 30));

const { google } = require('googleapis');

// Replace literal \n with real newlines
const privateKey = envVars['GOOGLE_SHEETS_PRIVATE_KEY'].replace(/\\n/g, '\n');
console.log('Key line 1:', privateKey.split('\n')[0]);

const auth = new google.auth.JWT(
  envVars['GOOGLE_SHEETS_CLIENT_EMAIL'],
  undefined,
  privateKey,
  ['https://www.googleapis.com/auth/spreadsheets']
);

auth.authorize()
  .then(() => {
    console.log('Auth OK!');
    const sheets = google.sheets({ version: 'v4', auth });
    return sheets.spreadsheets.get({ spreadsheetId: envVars['GOOGLE_SHEET_ID'] });
  })
  .then(r => {
    console.log('SUCCESS! Sheet name:', r.data.properties.title);
    console.log('Existing tabs:', r.data.sheets.map(s => s.properties.title).join(', '));
  })
  .catch(e => {
    console.error('FAILED:', e.message || JSON.stringify(e));
    if (e.response) {
      console.error('HTTP status:', e.response.status);
      console.error('Error details:', JSON.stringify(e.response.data, null, 2));
    }
  });
