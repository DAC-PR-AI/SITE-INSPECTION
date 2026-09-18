import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// 1. Read environment variables from .env.local
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

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ─── DEFINITIONS ────────────────────────────────────────────────────────────

const SPREADSHEET_1_ID = envVars['GOOGLE_SHEET_ID'];
const SPREADSHEET_2_ID = envVars['GOOGLE_PHOTO_SHEET_ID'];

const SPREADSHEET_1_REQUIRED_TABS = [
  {
    name: 'Inspections',
    headers: [
      'InspectionId', 'Project', 'Unit', 'InspectionType', 'CustomerName', 'Date', 'Time',
      'Status', 'CompletionPct', 'Passed', 'Failed', 'NA', 'DeclarationChecked',
      'UpdatedAt', 'SubmittedAt',
      'DataJSON_1', 'DataJSON_2', 'DataJSON_3', 'DataJSON_4', 'DataJSON_5',
      'DataJSON_6', 'DataJSON_7', 'DataJSON_8', 'DataJSON_9', 'DataJSON_10',
      'DataJSON_11', 'DataJSON_12'
    ],
  },
  {
    name: 'Projects',
    headers: ['Project', 'Unit'],
  },
  {
    name: 'ApprovalHistory',
    headers: [
      'InspectionID', 'Project', 'Unit', 'InspectionType', 'UserID', 'UserNumber', 'Role',
      'UserName', 'Action', 'Status', 'Comments', 'Timestamp', 'SignatureCaptured'
    ],
  },
  {
    name: 'Signatures',
    headers: [
      'InspectionId', 'Role', 'SignerName', 'Timestamp',
      'SigData_1', 'SigData_2', 'SigData_3', 'SigData_4', 'SigData_5',
      'SigData_6', 'SigData_7', 'SigData_8', 'SigData_9', 'SigData_10',
      'SigData_11', 'SigData_12', 'SigData_13', 'SigData_14', 'SigData_15',
      'SigData_16', 'SigData_17', 'SigData_18', 'SigData_19', 'SigData_20'
    ],
  },
  {
    name: 'Users',
    headers: ['user_id', 'name', 'number', 'email', 'role', 'status', 'password'],
  },
];

const SPREADSHEET_2_REQUIRED_TABS = [
  {
    name: 'InspectionPhotos',
    headers: ['InspectionID', 'Project', 'Unit', 'PhotoType', 'AreaKey', 'ItemID', 'PhotoURL', 'Timestamp'],
  },
];

async function reconcileSpreadsheet(sheets, spreadsheetId, label, requiredTabs, allowedTabNames) {
  console.log(`\n================================================================================`);
  console.log(`  RECONCILING SPREADSHEET: [${label}]`);
  console.log(`  ID: ${spreadsheetId}`);
  console.log(`================================================================================\n`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = meta.data.sheets || [];
  const existingMap = new Map();
  existingSheets.forEach(s => existingMap.set(s.properties.title, s.properties.sheetId));

  console.log(`Existing tabs found: [${Array.from(existingMap.keys()).join(', ')}]`);

  // Step 1: Create missing required tabs
  const toCreate = requiredTabs.filter(tab => !existingMap.has(tab.name));
  if (toCreate.length > 0) {
    console.log(`Creating missing tabs: [${toCreate.map(t => t.name).join(', ')}]...`);
    const addRequests = toCreate.map(t => ({ addSheet: { properties: { title: t.name } } }));
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
    // Update existingMap
    (addRes.data.replies || []).forEach(r => {
      if (r.addSheet) {
        existingMap.set(r.addSheet.properties.title, r.addSheet.properties.sheetId);
      }
    });
    console.log(`✓ Missing tabs created successfully.`);
  } else {
    console.log(`✓ All required tabs already exist.`);
  }

  // Step 2: Set exact standard headers for each required tab
  for (const tab of requiredTabs) {
    console.log(`Updating/Verifying exact headers for [${tab.name}] (${tab.headers.length} cols)...`);
    const headerRange = `${tab.name}!A1:${colLetter(tab.headers.length)}1`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: { values: [tab.headers] },
    });
    console.log(`  ✓ Headers set for [${tab.name}]`);
  }

  // Step 3: Remove unwanted / obsolete tabs (if they are not in allowedTabNames)
  const tabsToRemove = [];
  for (const [title, sheetId] of existingMap.entries()) {
    if (!allowedTabNames.includes(title)) {
      // Check if tab has any meaningful user data
      const dataRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${title}!A2:B10`,
      }).catch(() => ({ data: { values: [] } }));

      const rows = dataRes.data.values || [];
      if (rows.length === 0) {
        tabsToRemove.push({ title, sheetId, reason: 'Empty unwanted tab' });
      } else {
        console.log(`⚠️ Tab [${title}] is not in standard list, but contains ${rows.length} rows of data. Keeping it safe.`);
      }
    }
  }

  // Google Sheets requires at least one sheet to remain in spreadsheet
  if (tabsToRemove.length > 0 && existingMap.size > tabsToRemove.length) {
    console.log(`Removing ${tabsToRemove.length} unwanted empty tab(s): [${tabsToRemove.map(t => t.title).join(', ')}]...`);
    const deleteRequests = tabsToRemove.map(t => ({ deleteSheet: { sheetId: t.sheetId } }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: deleteRequests },
    });
    console.log(`✓ Unwanted tabs removed.`);
  } else {
    console.log(`✓ No empty unwanted tabs need deletion.`);
  }
}

async function main() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Reconcile Spreadsheet 1 (Primary Business & Logic)
  const allowedSheet1 = SPREADSHEET_1_REQUIRED_TABS.map(t => t.name);
  await reconcileSpreadsheet(
    sheets,
    SPREADSHEET_1_ID,
    'SPREADSHEET 1 (PRIMARY BUSINESS & TRANSACTIONAL DB)',
    SPREADSHEET_1_REQUIRED_TABS,
    allowedSheet1
  );

  // 2. Reconcile Spreadsheet 2 (Photo & Media Store)
  const allowedSheet2 = SPREADSHEET_2_REQUIRED_TABS.map(t => t.name);
  await reconcileSpreadsheet(
    sheets,
    SPREADSHEET_2_ID,
    'SPREADSHEET 2 (PHOTO & MEDIA STORE)',
    SPREADSHEET_2_REQUIRED_TABS,
    allowedSheet2
  );

  console.log(`\n================================================================================`);
  console.log(`🎉 ALL SPREADSHEET TABS AND COLUMNS RECONCILED & CLEANED!`);
  console.log(`================================================================================\n`);
}

main().catch(err => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
