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

async function auditSheetHeaders() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  console.log(`Connecting to Google Spreadsheet: ${spreadsheetId}...`);

  const sheets = await getClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets.map(s => s.properties.title);
  console.log("Found Sheets/Tabs in Spreadsheet:", sheetList);

  for (const sheetName of sheetList) {
    console.log(`\n============================================================`);
    console.log(`TAB: [${sheetName}]`);
    console.log(`============================================================`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:AZ2`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      console.log(`Sheet [${sheetName}] is empty (no headers).`);
      continue;
    }

    const headers = rows[0] || [];
    const sampleRow = rows[1] || [];

    console.log(`Total Header Columns: ${headers.length}`);
    headers.forEach((h, idx) => {
      const col = colLetter(idx + 1);
      const val = sampleRow[idx] !== undefined ? String(sampleRow[idx]).slice(0, 35) : "(empty)";
      const isHeaderEmpty = !h || h.trim() === "";
      console.log(`  Col ${col.padEnd(3)} (Idx ${idx.toString().padStart(2)}): Header='${h}' ${isHeaderEmpty ? "⚠️ [EMPTY HEADER!]" : ""} | SampleData='${val}'`);
    });
  }
}

auditSheetHeaders().catch(e => {
  console.error("Sheet audit error:", e);
  process.exit(1);
});
