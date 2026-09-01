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

async function syncUsers() {
  const sheets = await getClient();
  const sheet1 = process.env.GOOGLE_SHEET_ID;
  const sheet2 = process.env.GOOGLE_PHOTO_SHEET_ID;

  console.log("Reading canonical Users from Sheet 1...");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheet1,
    range: `Users!A1:G20`,
  });

  const usersData = res.data.values || [];
  console.log(`Fetched ${usersData.length} user rows from Sheet 1.`);

  if (sheet2 && sheet2 !== sheet1) {
    console.log(`Syncing Users into Sheet 2 (${sheet2})...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheet2,
      range: `Users!A1:G${usersData.length}`,
      valueInputOption: "RAW",
      requestBody: { values: usersData },
    });
    console.log("✓ Successfully synchronized Users into Sheet 2!");
  }
}

syncUsers().catch(e => {
  console.error("Sync error:", e);
  process.exit(1);
});
