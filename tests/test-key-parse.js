const fs = require('fs');
const { google } = require('googleapis');

// Simulate Next.js env loading or test process.env
const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY || fs.readFileSync('.env.local', 'utf-8').match(/GOOGLE_SHEETS_PRIVATE_KEY=(.*)/)?.[1];

console.log('Raw key starts with:', JSON.stringify(rawKey?.slice(0, 30)));

function cleanKey(k) {
  if (!k) return '';
  let key = k.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

const key = cleanKey(rawKey);
console.log('Cleaned key first line:', JSON.stringify(key.split('\n')[0]));
console.log('Cleaned key lines count:', key.split('\n').length);

const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL || fs.readFileSync('.env.local', 'utf-8').match(/GOOGLE_SHEETS_CLIENT_EMAIL=(.*)/)?.[1]?.trim();

const auth = new google.auth.JWT({
  email: email,
  key: key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

auth.authorize().then(() => {
  console.log('AUTHORIZATION SUCCESSFUL WITH CLEANED KEY!');
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets.spreadsheets.values.get({
    spreadsheetId: '1d5IsJnZXrowt8BXreqtQp_o4y6hSV2K8suFGv-kqy2I',
    range: 'Projects!A1:B10',
  });
}).then(res => {
  console.log('PROJECTS FROM GOOGLE SHEETS:', res.data.values);
}).catch(err => {
  console.error('AUTH FAILED:', err.message);
});
