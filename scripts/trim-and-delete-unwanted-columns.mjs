import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[match[1]] = val;
    process.env[match[1]] = val;
  }
});

function formatPrivateKey(rawKey) {
  if (!rawKey) return "";
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

const auth = new google.auth.JWT({
  email: envVars['GOOGLE_SHEETS_CLIENT_EMAIL'],
  key: formatPrivateKey(envVars['GOOGLE_SHEETS_PRIVATE_KEY']),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_1_ID = envVars['GOOGLE_SHEET_ID'];
const SPREADSHEET_2_ID = envVars['GOOGLE_PHOTO_SHEET_ID'];

// Exact schemas required:
const SCHEMAS = {
  // Primary Spreadsheet
  [SPREADSHEET_1_ID]: {
    'Inspections': [
      'InspectionId', 'Project', 'Unit', 'InspectionType', 'CustomerName', 'Date', 'Time',
      'Status', 'CompletionPct', 'Passed', 'Failed', 'NA', 'DeclarationChecked',
      'UpdatedAt', 'SubmittedAt',
      'DataJSON_1', 'DataJSON_2', 'DataJSON_3', 'DataJSON_4', 'DataJSON_5',
      'DataJSON_6', 'DataJSON_7', 'DataJSON_8', 'DataJSON_9', 'DataJSON_10',
      'DataJSON_11', 'DataJSON_12'
    ], // 27 columns (A to AA)
    'Projects': [
      'Project', 'Unit'
    ], // 2 columns (A to B)
    'ApprovalHistory': [
      'InspectionID', 'Project', 'Unit', 'InspectionType', 'UserID', 'UserNumber', 'Role',
      'UserName', 'Action', 'Status', 'Comments', 'Timestamp', 'SignatureCaptured'
    ], // 13 columns (A to M)
    'Signatures': [
      'InspectionId', 'Role', 'SignerName', 'Timestamp',
      'SigData_1', 'SigData_2', 'SigData_3', 'SigData_4', 'SigData_5',
      'SigData_6', 'SigData_7', 'SigData_8', 'SigData_9', 'SigData_10',
      'SigData_11', 'SigData_12', 'SigData_13', 'SigData_14', 'SigData_15',
      'SigData_16', 'SigData_17', 'SigData_18', 'SigData_19', 'SigData_20'
    ], // 24 columns (A to X)
    'Users': [
      'user_id', 'name', 'number', 'email', 'role', 'status', 'password'
    ], // 7 columns (A to G)
  },
  // Secondary Spreadsheet
  [SPREADSHEET_2_ID]: {
    'InspectionPhotos': [
      'InspectionID', 'Project', 'Unit', 'PhotoType', 'AreaKey', 'ItemID', 'PhotoURL', 'Timestamp'
    ], // 8 columns (A to H)
  }
};

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function trimColumnsForSpreadsheet(sheets, spreadsheetId, nameLabel) {
  console.log(`\n================================================================================`);
  console.log(`  TRIMMING EXTRA COLUMNS: [${nameLabel}]`);
  console.log(`  ID: ${spreadsheetId}`);
  console.log(`================================================================================\n`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];
  const expectedTabs = SCHEMAS[spreadsheetId] || {};

  for (const sheetObj of sheetList) {
    const title = sheetObj.properties.title;
    const sheetId = sheetObj.properties.sheetId;
    const gridProps = sheetObj.properties.gridProperties || {};
    const totalCols = gridProps.columnCount || 26;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`📄 TAB: [${title}] (Current Grid: ${totalCols} columns)`);

    const expectedHeaders = expectedTabs[title];
    if (!expectedHeaders) {
      console.log(`  (Not a primary managed tab, skipping column deletion)`);
      continue;
    }

    const neededCols = expectedHeaders.length;
    console.log(`  Required Schema: ${neededCols} columns (A to ${colLetter(neededCols)})`);

    // 1. Set the exact header row
    console.log(`  Updating Row 1 headers to exact ${neededCols} columns...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1:${colLetter(neededCols)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [expectedHeaders] },
    });

    // 2. Clear any lingering values in columns beyond neededCols (e.g. from neededCols+1 to totalCols)
    if (totalCols > neededCols) {
      const clearRange = `${title}!${colLetter(neededCols + 1)}1:${colLetter(totalCols)}50000`;
      console.log(`  Clearing lingering cell data in range: ${clearRange}...`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: clearRange,
      }).catch(e => console.log(`  (Clear note: ${e.message})`));

      // 3. Delete physical extra columns so the sheet UI strictly ends at neededCols!
      console.log(`  Deleting extra physical columns (${neededCols} to ${totalCols})...`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'COLUMNS',
                    startIndex: neededCols,
                    endIndex: totalCols,
                  },
                },
              },
            ],
          },
        });
        console.log(`  ✓ Extra columns deleted! Tab [${title}] now has EXACTLY ${neededCols} columns.`);
      } catch (err) {
        console.warn(`  Could not delete physical columns (may already be minimal): ${err.message}`);
      }
    } else {
      console.log(`  ✓ Grid already matches needed columns (${totalCols} cols).`);
    }
  }
}

async function main() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Trim Spreadsheet 1
  await trimColumnsForSpreadsheet(
    sheets,
    SPREADSHEET_1_ID,
    'SPREADSHEET 1 (PRIMARY BUSINESS DB)'
  );

  // 2. Trim Spreadsheet 2
  await trimColumnsForSpreadsheet(
    sheets,
    SPREADSHEET_2_ID,
    'SPREADSHEET 2 (PHOTO & MEDIA STORE)'
  );

  console.log(`\n================================================================================`);
  console.log(`🎉 ALL UNWANTED COLUMNS CLEARED & PHYSICAL GRIDS TRIMMED TO EXACT SCHEMAS!`);
  console.log(`================================================================================\n`);
}

main().catch(err => {
  console.error('Error during column trimming:', err);
  process.exit(1);
});
