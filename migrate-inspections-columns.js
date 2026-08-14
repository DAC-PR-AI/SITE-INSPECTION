/**
 * migrate-inspections-columns.js
 *
 * PROBLEM:
 *   The Inspections tab in Google Sheets was originally created WITHOUT the
 *   InspectionType column. The app code (lib/sheets.js) expects:
 *     A=InspectionId, B=Project, C=Unit, D=InspectionType, E=CustomerName, ...
 *     DataJSON_1 starts at column P (index 15)
 *
 *   The actual sheet had InspectionType MISSING, so:
 *     A=InspectionId, B=Project, C=Unit, D=CustomerName, ...
 *     DataJSON_1 was at column O (index 14)
 *
 *   The check-and-patch script appended InspectionType to column AA (end),
 *   making the column order even more wrong.
 *
 * THIS SCRIPT:
 *   1. Reads the ACTUAL header row from the sheet to build a name→index map.
 *   2. Reads every existing data row using the ACTUAL column positions.
 *   3. Extracts the JSON from wherever DataJSON_* chunks actually are.
 *   4. Rewrites the ENTIRE Inspections tab with the CORRECT column order.
 *
 * Run: node migrate-inspections-columns.js
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

const auth = new google.auth.JWT(
  envVars['GOOGLE_SHEETS_CLIENT_EMAIL'],
  undefined,
  privateKey,
  ['https://www.googleapis.com/auth/spreadsheets']
);

// ── Target schema (what sheets.js expects) ────────────────────────────────────
const CHUNK_COLUMNS = 12;
const CHUNK_SIZE = 45000;

const BASE_HEADERS = [
  'InspectionId', 'Project', 'Unit', 'InspectionType', 'CustomerName',
  'Date', 'Time', 'Status', 'CompletionPct', 'Passed', 'Failed', 'NA',
  'DeclarationChecked', 'UpdatedAt', 'SubmittedAt',
];
const DATA_CHUNK_HEADERS = Array.from({ length: CHUNK_COLUMNS }, (_, i) => `DataJSON_${i + 1}`);
const TARGET_HEADERS = [...BASE_HEADERS, ...DATA_CHUNK_HEADERS];

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

// ── Main migration ────────────────────────────────────────────────────────────
async function migrate() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  const TAB = 'Inspections';
  console.log('\n🔄 Starting Inspections column migration...\n');
  console.log('Target schema (' + TARGET_HEADERS.length + ' cols):');
  console.log('  ' + TARGET_HEADERS.join(', '));
  console.log();

  // ── Step 1: Read the current full sheet (all columns, all rows) ───────────
  const fullRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB}!A1:ZZ200000`,  // wide enough to catch all columns
  });

  const allRows = fullRes.data.values || [];
  if (allRows.length === 0) {
    console.log('⚠️  Sheet is empty. Writing target headers only.');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TARGET_HEADERS] },
    });
    console.log('✅ Headers written. Migration complete.');
    return;
  }

  const actualHeaders = allRows[0] || [];
  const dataRows = allRows.slice(1);

  console.log(`📌 Current headers (${actualHeaders.length}):\n  ${actualHeaders.join(', ')}\n`);
  console.log(`📊 Data rows found: ${dataRows.length}\n`);

  // ── Step 2: Build name→index map from actual header row ───────────────────
  const colMap = {};
  actualHeaders.forEach((name, idx) => {
    if (name) colMap[name.trim()] = idx;
  });

  // Detect where DataJSON chunks actually start
  const dataJsonIndices = DATA_CHUNK_HEADERS.map(h => colMap[h]).filter(i => i !== undefined);
  console.log(`🔍 DataJSON_* found at columns: ${dataJsonIndices.map(i => colLetter(i + 1)).join(', ')}`);

  // ── Step 3: Rebuild each data row in the correct target schema ────────────
  console.log('\n🔧 Rebuilding rows in correct column order...');
  const newDataRows = dataRows.map((row, ri) => {
    // Helper: get value from actual column (by header name)
    const get = (name) => {
      const idx = colMap[name];
      return (idx !== undefined ? row[idx] : '') || '';
    };

    // Reassemble JSON from DataJSON chunks using ACTUAL positions
    const jsonChunks = DATA_CHUNK_HEADERS.map(h => {
      const idx = colMap[h];
      return (idx !== undefined ? row[idx] : '') || '';
    });
    const jsonString = jsonChunks.join('');

    // Parse JSON to extract InspectionType if it's not in the explicit column
    let parsedInspectionType = get('InspectionType');
    if (!parsedInspectionType && jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        parsedInspectionType = parsed.inspectionType || 'INTERIOR JOINT INSPECTION';
      } catch {
        parsedInspectionType = 'INTERIOR JOINT INSPECTION';
      }
    }

    // Re-chunk the JSON into the target number of chunks
    const reChunked = [];
    for (let i = 0; i < jsonString.length; i += CHUNK_SIZE) {
      reChunked.push(jsonString.slice(i, i + CHUNK_SIZE));
    }
    while (reChunked.length < CHUNK_COLUMNS) reChunked.push('');

    // Build the new row in the TARGET_HEADERS order
    return [
      get('InspectionId'),
      get('Project'),
      get('Unit'),
      parsedInspectionType,                   // InspectionType (fixed position)
      get('CustomerName'),
      get('Date'),
      get('Time'),
      get('Status'),
      get('CompletionPct'),
      get('Passed'),
      get('Failed'),
      get('NA'),
      get('DeclarationChecked'),
      get('UpdatedAt'),
      get('SubmittedAt'),
      ...reChunked,                           // DataJSON_1..12
    ];
  });

  console.log(`✅ ${newDataRows.length} rows rebuilt.`);

  // ── Step 4: Clear the entire Inspections tab ──────────────────────────────
  console.log('\n🗑️  Clearing Inspections tab...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${TAB}!A1:ZZ200000`,
  });
  console.log('✅ Tab cleared.');

  // ── Step 5: Write header row ──────────────────────────────────────────────
  console.log('\n📝 Writing correct header row...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [TARGET_HEADERS] },
  });
  console.log(`✅ Headers written (${TARGET_HEADERS.length} columns): ${TARGET_HEADERS.join(', ')}`);

  // ── Step 6: Write all data rows back ─────────────────────────────────────
  if (newDataRows.length > 0) {
    console.log(`\n📤 Writing ${newDataRows.length} data row(s) back...`);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${TAB}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newDataRows },
    });
    console.log('✅ All data rows written back successfully.');
  } else {
    console.log('\nℹ️  No data rows to migrate.');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(60));
  console.log('\n✅ Migration complete!\n');
  console.log(`   • ${newDataRows.length} inspection row(s) migrated`);
  console.log(`   • InspectionType is now correctly at column D`);
  console.log(`   • DataJSON_1 is now correctly at column P (index 15)`);
  console.log(`   • Schema matches lib/sheets.js BASE_HEADERS exactly\n`);
}

migrate().catch(e => {
  console.error('\n❌ Migration failed:', e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
