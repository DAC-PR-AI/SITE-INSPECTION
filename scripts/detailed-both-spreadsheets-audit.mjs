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

async function auditSpreadsheet(sheets, spreadsheetId, nameLabel) {
  console.log(`\n################################################################################`);
  console.log(`  SPREADSHEET: [${nameLabel}]`);
  console.log(`  ID: ${spreadsheetId}`);
  console.log(`################################################################################`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  console.log(`Spreadsheet Title: "${meta.data.properties.title}"`);
  const tabs = meta.data.sheets.map(s => s.properties.title);
  console.log(`Total Tabs/Sheets: ${tabs.length} -> [${tabs.join(", ")}]\n`);

  for (const tab of tabs) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`📄 TAB / SHEET: [${tab}]`);
    console.log(`--------------------------------------------------------------------------------`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:AZ5`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      console.log(`  (Empty Tab - No rows)`);
      continue;
    }

    const headers = rows[0] || [];
    console.log(`  Header Columns Count: ${headers.length}`);
    headers.forEach((h, i) => {
      const col = colLetter(i + 1);
      const isBlank = !h || h.trim() === "";
      console.log(`    Col ${col.padEnd(3)} (Idx ${i.toString().padStart(2)}): ${isBlank ? "⚠️ [EMPTY HEADER!]" : `"${h}"`}`);
    });

    if (rows.length > 1) {
      console.log(`\n  Sample Data (Row 2):`);
      const sample = rows[1];
      headers.forEach((h, i) => {
        const col = colLetter(i + 1);
        const val = sample[i] !== undefined ? String(sample[i]) : "(empty)";
        const displayVal = val.length > 50 ? val.slice(0, 50) + "..." : val;
        console.log(`    ${col.padEnd(3)} | ${h.padEnd(20)} : ${displayVal}`);
      });
    } else {
      console.log(`  (No data rows yet - only header row present)`);
    }
    console.log("");
  }
}

async function run() {
  const sheets = await getClient();
  
  const sheet1 = process.env.GOOGLE_SHEET_ID;
  const sheet2 = process.env.GOOGLE_PHOTO_SHEET_ID;
  const authSheet = process.env.GOOGLE_AUTH_SHEET_ID;

  console.log("================================================================================");
  console.log("  FULL COMPREHENSIVE AUDIT OF BOTH GOOGLE SPREADSHEETS");
  console.log("================================================================================");

  // Spreadsheet 1: Main Inspections & Approvals & Users
  await auditSpreadsheet(sheets, sheet1, "SHEET 1 — MAIN INSPECTION WORKSPACE & USERS SPREADSHEET");

  // Spreadsheet 2: Photos / Media storage
  if (sheet2 && sheet2 !== sheet1) {
    await auditSpreadsheet(sheets, sheet2, "SHEET 2 — DEDICATED PHOTO & MEDIA SPREADSHEET");
  } else {
    console.log(`Note: GOOGLE_PHOTO_SHEET_ID is identical to GOOGLE_SHEET_ID.`);
  }

  // Check if there is a separate auth sheet configured
  if (authSheet && authSheet !== sheet1 && authSheet !== sheet2) {
    await auditSpreadsheet(sheets, authSheet, "SHEET 3 — DEDICATED AUTH SPREADSHEET");
  }
}

run().catch(e => {
  console.error("Audit error:", e);
  process.exit(1);
});
