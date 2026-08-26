/**
 * check-and-patch-columns.js
 * Connects to Google Sheets, reads the actual headers in every tab,
 * and adds any missing columns (appended to the right) without touching
 * existing rows or data.
 *
 * Run: node check-and-patch-columns.js
 */

const fs = require('fs');

// ── Load .env.local ──────────────────────────────────────────────────────────
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

const auth = new google.auth.JWT({
  email: envVars['GOOGLE_SHEETS_CLIENT_EMAIL'],
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ── Expected columns per tab ──────────────────────────────────────────────────
// These are the COMPLETE expected header rows (order matters for new installs).
// For existing sheets, only MISSING columns are added (appended to the right).

const EXPECTED_SCHEMAS = [
  {
    tab: 'Inspections',
    headers: [
      'InspectionId', 'Project', 'Unit', 'InspectionType', 'CustomerName',
      'Date', 'Time', 'Status', 'CompletionPct', 'Passed', 'Failed', 'NA',
      'DeclarationChecked', 'UpdatedAt', 'SubmittedAt',
      // JSON data chunks
      'DataJSON_1',  'DataJSON_2',  'DataJSON_3',  'DataJSON_4',
      'DataJSON_5',  'DataJSON_6',  'DataJSON_7',  'DataJSON_8',
      'DataJSON_9',  'DataJSON_10', 'DataJSON_11', 'DataJSON_12'
    ]
  },
  {
    tab: 'ApprovalHistory',
    headers: [
      'InspectionID', 'Project', 'Unit', 'InspectionType', 'Role',
      'UserName', 'Action', 'Status', 'Comments', 'Timestamp', 'SignatureCaptured'
    ]
  },
  {
    tab: 'Signatures',
    headers: [
      'InspectionId', 'Role', 'SignerName', 'Timestamp',
      'SigData_1',  'SigData_2',  'SigData_3',  'SigData_4',  'SigData_5',
      'SigData_6',  'SigData_7',  'SigData_8',  'SigData_9',  'SigData_10',
      'SigData_11', 'SigData_12', 'SigData_13', 'SigData_14', 'SigData_15',
      'SigData_16', 'SigData_17', 'SigData_18', 'SigData_19', 'SigData_20'
    ]
  },
  {
    tab: 'Projects',
    headers: ['Project', 'Unit']
  }
];

// ── Column letter helper ──────────────────────────────────────────────────────
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function checkAndPatch() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // Fetch existing sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = meta.data.sheets.map(s => s.properties.title);

  console.log('\n📋 Google Sheet ID:', spreadsheetId);
  console.log('📂 Existing tabs:', existingTabs.join(', '), '\n');
  console.log('━'.repeat(60));

  for (const schema of EXPECTED_SCHEMAS) {
    const { tab, headers: expectedHeaders } = schema;
    console.log(`\n🔍 Tab: "${tab}"`);

    // ── 1. Create tab if missing ───────────────────────────────────────────
    if (!existingTabs.includes(tab)) {
      console.log(`   ⚠️  Tab not found. Creating "${tab}"...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] }
      });
      console.log(`   ✅ Tab "${tab}" created.`);

      // Write full header row fresh
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [expectedHeaders] }
      });
      console.log(`   ✅ All ${expectedHeaders.length} headers written to new tab.`);
      continue;
    }

    // ── 2. Read existing headers ───────────────────────────────────────────
    const rangeEnd = colLetter(expectedHeaders.length + 20); // read a bit extra
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!1:1`
    });

    const existingHeaders = (headerRes.data.values || [[]])[0] || [];
    console.log(`   📌 Existing columns (${existingHeaders.length}): ${existingHeaders.join(', ') || '(none)'}`);

    // ── 3. Find missing columns ────────────────────────────────────────────
    const missingColumns = expectedHeaders.filter(h => !existingHeaders.includes(h));

    if (missingColumns.length === 0) {
      console.log(`   ✅ All ${expectedHeaders.length} expected columns are present.`);
      continue;
    }

    console.log(`   ⚠️  Missing ${missingColumns.length} column(s): ${missingColumns.join(', ')}`);

    // ── 4. Check for unexpected extra columns (informational only) ─────────
    const extraColumns = existingHeaders.filter(h => h && !expectedHeaders.includes(h));
    if (extraColumns.length > 0) {
      console.log(`   ℹ️  Extra columns present (not in schema, kept): ${extraColumns.join(', ')}`);
    }

    // ── 5. Append missing columns to the RIGHT of existing headers ─────────
    // We write each missing header in the next available column position.
    const startColIndex = existingHeaders.length + 1; // 1-based

    const missingHeaderRow = missingColumns; // values to write in one row
    const startCol = colLetter(startColIndex);
    const endCol = colLetter(startColIndex + missingColumns.length - 1);
    const range = `${tab}!${startCol}1:${endCol}1`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [missingHeaderRow] }
    });

    console.log(`   ✅ Added ${missingColumns.length} missing column(s) in columns ${startCol}–${endCol}:`);
    missingColumns.forEach((col, i) => {
      console.log(`      • ${colLetter(startColIndex + i)}: ${col}`);
    });
  }

  console.log('\n' + '━'.repeat(60));
  console.log('\n✅ Column check & patch complete!\n');
  console.log('📌 NOTE: Existing data rows are NOT affected — only the header row was updated.');
  console.log('   If you want column values back-filled for old rows, those rows will');
  console.log('   be populated naturally the next time each inspection is saved/approved.\n');
}

checkAndPatch().catch(e => {
  console.error('\n❌ Error:', e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
