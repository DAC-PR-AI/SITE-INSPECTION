import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
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

async function getClient() {
  const auth = new google.auth.JWT({
    email: (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || "").trim(),
    key: formatPrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const CHUNK_COLUMNS = 12;
const SIG_CHUNK_COLUMNS = 20;

const CANONICAL_SCHEMAS = {
  Inspections: [
    "InspectionId",
    "Project",
    "Unit",
    "InspectionType",
    "CustomerName",
    "Date",
    "Time",
    "Status",
    "CompletionPct",
    "Passed",
    "Failed",
    "NA",
    "DeclarationChecked",
    "UpdatedAt",
    "SubmittedAt",
    ...Array.from({ length: CHUNK_COLUMNS }, (_, i) => `DataJSON_${i + 1}`),
  ],
  ApprovalHistory: [
    "InspectionID",
    "Project",
    "Unit",
    "InspectionType",
    "UserID",
    "UserNumber",
    "Role",
    "UserName",
    "Action",
    "Status",
    "Comments",
    "Timestamp",
    "SignatureCaptured",
  ],
  Signatures: [
    "InspectionId",
    "Role",
    "SignerName",
    "Timestamp",
    ...Array.from({ length: SIG_CHUNK_COLUMNS }, (_, i) => `SigData_${i + 1}`),
  ],
  Users: [
    "user_id",
    "name",
    "number",
    "email",
    "role",
    "status",
    "password",
  ],
  Projects: [
    "Project",
    "Unit",
  ],
  InspectionPhotos: [
    "InspectionID",
    "Project",
    "Unit",
    "PhotoType",
    "AreaKey",
    "ItemID",
    "PhotoURL",
    "Timestamp",
  ]
};

async function fixAndAlignSpreadsheet(sheets, spreadsheetId, label) {
  console.log(`\n============================================================`);
  console.log(`AUDITING & ALIGNING SPREADSHEET [${label}]: ${spreadsheetId}`);
  console.log(`============================================================`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets.map((s) => s.properties.title);
  console.log(`Sheets in [${label}]:`, sheetList);

  for (const [tabName, canonicalHeaders] of Object.entries(CANONICAL_SCHEMAS)) {
    if (!sheetList.includes(tabName)) {
      if (label === "PHOTO_SPREADSHEET" && tabName !== "InspectionPhotos") continue;
      if (label === "MAIN_SPREADSHEET" && tabName === "InspectionPhotos") {
        // Also ensure InspectionPhotos tab exists in main spreadsheet as fallback
      }
      console.log(`Creating missing tab [${tabName}] in ${label}...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });
    }

    // Get current headers
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:${colLetter(canonicalHeaders.length + 10)}1`,
    });

    const currentHeaders = res.data.values?.[0] || [];
    let needsUpdate = false;

    if (currentHeaders.length !== canonicalHeaders.length) {
      needsUpdate = true;
    } else {
      for (let i = 0; i < canonicalHeaders.length; i++) {
        if (currentHeaders[i] !== canonicalHeaders[i]) {
          needsUpdate = true;
          break;
        }
      }
    }

    if (needsUpdate) {
      console.log(`⚠️ Tab [${tabName}] header mismatch! Updating to canonical ${canonicalHeaders.length} columns...`);
      console.log(`  Old headers: ${JSON.stringify(currentHeaders)}`);
      console.log(`  New headers: ${JSON.stringify(canonicalHeaders)}`);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:${colLetter(canonicalHeaders.length)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [canonicalHeaders] },
      });
      console.log(`✓ Tab [${tabName}] headers successfully updated!`);
    } else {
      console.log(`✓ Tab [${tabName}] headers perfectly match canonical schema (${canonicalHeaders.length} cols).`);
    }
  }
}

async function verifyAllPhotoAndDataRows(sheets) {
  console.log(`\n============================================================`);
  console.log(`VERIFYING PHOTO AND DATA FLOW ACROSS ALL SPREADSHEETS`);
  console.log(`============================================================`);

  const mainSpreadsheetId = process.env.GOOGLE_SHEET_ID;
  const photoSpreadsheetId = process.env.GOOGLE_PHOTO_SHEET_ID || mainSpreadsheetId;

  // Check Photo Spreadsheet
  const photoRes = await sheets.spreadsheets.values.get({
    spreadsheetId: photoSpreadsheetId,
    range: `InspectionPhotos!A1:H10`,
  });

  const photoRows = photoRes.data.values || [];
  console.log(`InspectionPhotos Tab Rows found: ${photoRows.length}`);
  if (photoRows.length > 0) {
    console.log("Headers:", photoRows[0]);
    if (photoRows.length > 1) {
      console.log("Sample Photo Record Row 2:");
      console.log(`  Col A (InspectionID) : ${photoRows[1][0]}`);
      console.log(`  Col B (Project)      : ${photoRows[1][1]}`);
      console.log(`  Col C (Unit)         : ${photoRows[1][2]}`);
      console.log(`  Col D (PhotoType)    : ${photoRows[1][3]}`);
      console.log(`  Col E (AreaKey)      : ${photoRows[1][4]}`);
      console.log(`  Col F (ItemID)       : ${photoRows[1][5]}`);
      console.log(`  Col G (PhotoURL)     : ${String(photoRows[1][6] || "").slice(0, 40)}...`);
      console.log(`  Col H (Timestamp)    : ${photoRows[1][7]}`);
    }
  }

  // Check ApprovalHistory Tab
  const histRes = await sheets.spreadsheets.values.get({
    spreadsheetId: mainSpreadsheetId,
    range: `ApprovalHistory!A1:M10`,
  });
  const histRows = histRes.data.values || [];
  console.log(`\nApprovalHistory Tab Rows found: ${histRows.length}`);
  if (histRows.length > 1) {
    console.log("Sample ApprovalHistory Record Row 2:");
    const h = histRows[0];
    const r = histRows[1];
    h.forEach((header, i) => {
      console.log(`  Col ${colLetter(i + 1).padEnd(2)} (${header.padEnd(18)}): ${r[i] || "(empty)"}`);
    });
  }
}

async function main() {
  const sheets = await getClient();
  const mainSpreadsheetId = process.env.GOOGLE_SHEET_ID;
  const photoSpreadsheetId = process.env.GOOGLE_PHOTO_SHEET_ID;

  await fixAndAlignSpreadsheet(sheets, mainSpreadsheetId, "MAIN_SPREADSHEET");

  if (photoSpreadsheetId && photoSpreadsheetId !== mainSpreadsheetId) {
    await fixAndAlignSpreadsheet(sheets, photoSpreadsheetId, "PHOTO_SPREADSHEET");
  }

  await verifyAllPhotoAndDataRows(sheets);

  console.log("\n============================================================");
  console.log("  ✅ ALL GOOGLE SHEET COLUMNS AND DATA FLOW AUDITED & ALIGNED!");
  console.log("============================================================\n");
}

main().catch(e => {
  console.error("Error aligning sheets:", e);
  process.exit(1);
});
