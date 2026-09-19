const fs = require('fs');
const { google } = require('googleapis');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const rawVal = trimmed.slice(eqIdx + 1).trim();
  envVars[key] = rawVal.startsWith('"') && rawVal.endsWith('"') ? rawVal.slice(1, -1) : rawVal;
}

const privateKey = envVars['GOOGLE_SHEETS_PRIVATE_KEY'].replace(/\\n/g, '\n');
const auth = new google.auth.JWT({
  email: envVars['GOOGLE_SHEETS_CLIENT_EMAIL'],
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function main() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: envVars['GOOGLE_SHEET_ID'],
    range: 'Projects!A1:B100',
  });
  console.log('--- PROJECTS SHEET DATA ---');
  console.log(JSON.stringify(res.data.values, null, 2));
}

main().catch(console.error);
