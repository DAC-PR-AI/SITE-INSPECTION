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

async function setupNormalizedProjectsUnits() {
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`\n================================================================================`);
  console.log(`  SETTING UP NORMALIZED PROJECTS & UNITS TABS`);
  console.log(`  Spreadsheet ID: ${SPREADSHEET_1_ID}`);
  console.log(`================================================================================\n`);

  // 1. Check existing tabs in Spreadsheet 1
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_1_ID });
  const sheetList = meta.data.sheets || [];
  const existingMap = new Map();
  sheetList.forEach(s => existingMap.set(s.properties.title, s.properties.sheetId));

  console.log(`Existing tabs: [${Array.from(existingMap.keys()).join(', ')}]`);

  // 2. Read existing data from Projects tab before restructuring
  let existingRows = [];
  if (existingMap.has('Projects')) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_1_ID,
      range: 'Projects!A1:Z500',
    }).catch(() => ({ data: { values: [] } }));
    existingRows = res.data.values || [];
  }

  // Parse existing data into a map of ProjectName -> Set(Units)
  const projectToUnits = new Map();

  if (existingRows.length > 1) {
    const header = existingRows[0] || [];
    const isOldFlatFormat = (header[0] || '').toLowerCase().includes('project') &&
                            (header[1] || '').toLowerCase().includes('unit');

    for (let r = 1; r < existingRows.length; r++) {
      const row = existingRows[r];
      if (!row || row.length === 0) continue;
      const colA = (row[0] || '').trim();
      const colB = (row[1] || '').trim();
      if (!colA) continue;

      if (isOldFlatFormat) {
        // colA = ProjectName, colB = Unit
        if (!projectToUnits.has(colA)) projectToUnits.set(colA, new Set());
        if (colB) projectToUnits.get(colA).add(colB);
      }
    }
  }

  // If no existing rows, add default seed projects
  if (projectToUnits.size === 0) {
    projectToUnits.set('Manapark', new Set(['A-101']));
    projectToUnits.set('Silicon Valley - I', new Set(['A-102']));
    projectToUnits.set('Midtown', new Set(['A-203', 'B-209']));
    projectToUnits.set('DAC Aspire Heights', new Set(['A-101', 'A-102', 'A-203', 'B-201', 'B-202', 'B-305']));
    projectToUnits.set('DAC Serene County', new Set(['T1-01', 'T1-02', 'T2-01', 'T2-04']));
    projectToUnits.set('DAC Elan Grande', new Set(['G-301', 'G-302', 'G-401', 'G-402']));
  }

  // 3. Build Normalized Projects and Units Rows
  const projectsData = [['ProjectID', 'ProjectName']];
  const unitsData = [['ProjectID', 'UnitNo']];

  let pIndex = 1;
  for (const [projName, unitsSet] of projectToUnits.entries()) {
    const projId = `P${String(pIndex).padStart(3, '0')}`;
    projectsData.push([projId, projName]);

    const unitList = Array.from(unitsSet);
    if (unitList.length === 0) {
      unitsData.push([projId, '101']);
    } else {
      unitList.forEach(unit => {
        unitsData.push([projId, unit]);
      });
    }
    pIndex++;
  }

  // 4. Ensure 'Units' tab exists
  if (!existingMap.has('Units')) {
    console.log(`Creating 'Units' tab...`);
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_1_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'Units' } } }],
      },
    });
    const newSheetId = addRes.data.replies[0].addSheet.properties.sheetId;
    existingMap.set('Units', newSheetId);
    console.log(`✓ 'Units' tab created (ID: ${newSheetId})`);
  }

  // 5. Update Projects tab with [ProjectID, ProjectName]
  console.log(`Writing normalized data to 'Projects' tab (${projectsData.length - 1} projects)...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_1_ID,
    range: 'Projects!A1:Z500',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_1_ID,
    range: `Projects!A1:B${projectsData.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: projectsData },
  });

  // 6. Update Units tab with [ProjectID, UnitNo]
  console.log(`Writing normalized data to 'Units' tab (${unitsData.length - 1} units)...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_1_ID,
    range: 'Units!A1:Z500',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_1_ID,
    range: `Units!A1:B${unitsData.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: unitsData },
  });

  // 7. Trim physical columns to exactly 2 columns on both tabs
  for (const tabName of ['Projects', 'Units']) {
    const sheetId = existingMap.get(tabName);
    const metaTab = (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_1_ID })).data.sheets.find(s => s.properties.title === tabName);
    const totalCols = metaTab?.properties?.gridProperties?.columnCount || 26;
    if (totalCols > 2) {
      console.log(`Trimming extra physical columns on '${tabName}' (${2} to ${totalCols})...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_1_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 2,
                  endIndex: totalCols,
                },
              },
            },
          ],
        },
      }).catch(e => console.log(`  (Note: ${e.message})`));
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🎉 NORMALIZED TABS CONFIGURED SUCCESSFULLY!`);
  console.log(`   • 'Projects': [ProjectID, ProjectName] (2 cols)`);
  console.log(`   • 'Units':    [ProjectID, UnitNo]      (2 cols)`);
  console.log(`================================================================================\n`);
}

setupNormalizedProjectsUnits().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
