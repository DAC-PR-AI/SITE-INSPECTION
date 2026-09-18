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

// STRICT ALLOWED TABS:
const SPREADSHEET_1_STRICT_TABS = ['Inspections', 'Projects', 'ApprovalHistory', 'Signatures', 'Users'];
const SPREADSHEET_2_STRICT_TABS = ['InspectionPhotos'];

async function cleanUnwantedTabs(sheets, spreadsheetId, label, strictAllowedTabs) {
  console.log(`\n================================================================================`);
  console.log(`  CLEANING UNWANTED PAGES / TABS: [${label}]`);
  console.log(`  ID: ${spreadsheetId}`);
  console.log(`  STRICT ALLOWED TABS: [${strictAllowedTabs.join(', ')}]`);
  console.log(`================================================================================\n`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];
  console.log(`Current tabs: [${sheetList.map(s => s.properties.title).join(', ')}]`);

  const deleteRequests = [];
  const keptTabs = [];

  for (const sheetObj of sheetList) {
    const title = sheetObj.properties.title;
    const sheetId = sheetObj.properties.sheetId;

    if (!strictAllowedTabs.includes(title)) {
      console.log(`  ❌ UNWANTED TAB IDENTIFIED: "${title}" (ID: ${sheetId}) -> Queued for DELETION`);
      deleteRequests.push({ deleteSheet: { sheetId } });
    } else {
      console.log(`  ✅ STRICT TAB PRESERVED: "${title}"`);
      keptTabs.push(title);
    }
  }

  // Ensure at least one sheet remains in spreadsheet
  if (deleteRequests.length > 0 && keptTabs.length > 0) {
    console.log(`\nExecuting deletion of ${deleteRequests.length} unwanted tab(s)...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: deleteRequests },
    });
    console.log(`✓ All unwanted tabs successfully deleted!`);
  } else if (deleteRequests.length === 0) {
    console.log(`✓ No unwanted tabs found — spreadsheet is 100% clean.`);
  }

  // Verify resulting tabs
  const updatedMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const finalTabs = updatedMeta.data.sheets.map(s => s.properties.title);
  console.log(`\nFinal tabs in [${label}]: [${finalTabs.join(', ')}]\n`);
}

async function main() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Clean Spreadsheet 1 (Delete any tab not in ['Inspections', 'Projects', 'ApprovalHistory', 'Signatures', 'Users'])
  await cleanUnwantedTabs(
    sheets,
    SPREADSHEET_1_ID,
    'SPREADSHEET 1 (PRIMARY BUSINESS & TRANSACTIONAL DB)',
    SPREADSHEET_1_STRICT_TABS
  );

  // 2. Clean Spreadsheet 2 (Delete any tab not in ['InspectionPhotos'])
  await cleanUnwantedTabs(
    sheets,
    SPREADSHEET_2_ID,
    'SPREADSHEET 2 (PHOTO & MEDIA STORE)',
    SPREADSHEET_2_STRICT_TABS
  );

  console.log(`\n================================================================================`);
  console.log(`🎉 ALL UNWANTED PAGES / TABS HAVE BEEN PERMANENTLY REMOVED!`);
  console.log(`================================================================================\n`);
}

main().catch(err => {
  console.error('Error during tab deletion:', err);
  process.exit(1);
});
