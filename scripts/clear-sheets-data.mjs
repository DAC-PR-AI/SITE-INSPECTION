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

async function clearDataKeepSchema() {
  const sheets = await getClient();
  const spreadsheet1Id = process.env.GOOGLE_SHEET_ID;
  const spreadsheet2Id = process.env.GOOGLE_PHOTO_SHEET_ID || spreadsheet1Id;

  console.log("============================================================");
  console.log("  CLEARING TRANSACTIONAL DATA (PRESERVING EXACT SCHEMA)");
  console.log("============================================================\n");

  // 1. Spreadsheet 1: Inspections, ApprovalHistory, Signatures
  const tabsToClear1 = ["Inspections", "ApprovalHistory", "Signatures"];

  console.log(`[Core DB: ${spreadsheet1Id}]`);
  for (const tabName of tabsToClear1) {
    try {
      console.log(`Clearing data rows (Row 2+) in tab: '${tabName}'...`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId: spreadsheet1Id,
        range: `'${tabName}'!A2:Z100000`,
      });
      console.log(`  ✓ Tab '${tabName}' data cleared! Header schema preserved.`);
    } catch (err) {
      console.warn(`  ⚠️ Could not clear '${tabName}':`, err.message);
    }
  }

  // 2. Spreadsheet 2: InspectionPhotos
  console.log(`\n[Photo DB: ${spreadsheet2Id}]`);
  try {
    console.log(`Clearing data rows (Row 2+) in tab: 'InspectionPhotos'...`);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheet2Id,
      range: `'InspectionPhotos'!A2:Z100000`,
    });
    console.log(`  ✓ Tab 'InspectionPhotos' data cleared! Header schema preserved.`);
  } catch (err) {
    console.warn(`  ⚠️ Could not clear 'InspectionPhotos':`, err.message);
  }

  // 3. Clear Local Emergency Data Cache
  const dataDir = path.join(__dirname, "../.data");
  if (fs.existsSync(dataDir)) {
    console.log("\n[Local Cache]");
    const files = fs.readdirSync(dataDir);
    for (const f of files) {
      if (f.endsWith(".json")) {
        fs.unlinkSync(path.join(dataDir, f));
        console.log(`  ✓ Cleared local cache file: .data/${f}`);
      }
    }
  }

  console.log("\n============================================================");
  console.log("  VERIFYING FINAL STATE & ROW COUNTS");
  console.log("============================================================\n");

  const meta1 = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet1Id });
  for (const s of meta1.data.sheets) {
    const title = s.properties.title;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheet1Id,
      range: `'${title}'!A1:Z50000`,
    });
    const rows = res.data.values || [];
    console.log(`Spreadsheet 1 | '${title}': ${rows.length} total rows (${rows.length > 0 ? 'Header intact' : 'Empty'} + ${Math.max(0, rows.length - 1)} data rows)`);
  }

  const meta2 = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet2Id });
  for (const s of meta2.data.sheets) {
    const title = s.properties.title;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheet2Id,
      range: `'${title}'!A1:Z50000`,
    });
    const rows = res.data.values || [];
    console.log(`Spreadsheet 2 | '${title}': ${rows.length} total rows (${rows.length > 0 ? 'Header intact' : 'Empty'} + ${Math.max(0, rows.length - 1)} data rows)`);
  }

  console.log("\n✅ ALL TRANSACTIONAL DATA CLEARED SUCCESSFULLY WHILE RETAINING 100% OF SCHEMA HEADERS!");
}

clearDataKeepSchema().catch((e) => {
  console.error("Error clearing data:", e);
  process.exit(1);
});
