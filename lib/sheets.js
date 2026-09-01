import { google } from "googleapis";
import { GoogleSheetAdapter } from "./GoogleSheetAdapter.js";

const INSPECTIONS_SHEET = "Inspections";
const PROJECTS_SHEET = "Projects";
const APPROVAL_HISTORY_SHEET = "ApprovalHistory";
const SIGNATURES_SHEET = "Signatures";
const INSPECTION_PHOTOS_SHEET = "InspectionPhotos";

const CHUNK_SIZE = 45000;
const CHUNK_COLUMNS = 12; // ~540,000 chars of headroom for inspection JSON
const SIG_CHUNK_COLUMNS = 20;
const MAX_JSON_LENGTH = CHUNK_SIZE * CHUNK_COLUMNS;

const PHOTO_HEADERS = [
  "InspectionID",
  "Project",
  "Unit",
  "PhotoType",
  "AreaKey",
  "ItemID",
  "PhotoURL",
  "Timestamp",
];

// ─── HIGH-SPEED SERVER MEMORY CACHE ──────────────────────────────────────
const cache = {
  projects: { data: null, timestamp: 0 },
  inspections: { data: null, timestamp: 0 },
};

const verifiedSheets = new Set();

const PROJECTS_CACHE_TTL = 60000; // 60 seconds cache for project list
const INSPECTIONS_CACHE_TTL = 30000; // 30 seconds cache for inspections list

function invalidateInspectionsCache() {
  cache.inspections = { data: null, timestamp: 0 };
}

const BASE_HEADERS = [
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
];
const HEADERS = [
  ...BASE_HEADERS,
  ...Array.from({ length: CHUNK_COLUMNS }, (_, i) => `DataJSON_${i + 1}`),
];

const APPROVAL_HEADERS = [
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
];

const SIGNATURE_BASE_HEADERS = [
  "InspectionId",
  "Role",
  "SignerName",
  "Timestamp",
];
const SIGNATURE_HEADERS = [
  ...SIGNATURE_BASE_HEADERS,
  ...Array.from({ length: SIG_CHUNK_COLUMNS }, (_, i) => `SigData_${i + 1}`),
];

let cachedClient = null;

function assertEnv() {
  const required = [
    "GOOGLE_SHEETS_CLIENT_EMAIL",
    "GOOGLE_SHEETS_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing environment variable(s): ${missing.join(
        ", "
      )}. Copy .env.example to .env.local (or set them in Vercel) and fill them in.`
    );
  }
}

function formatPrivateKey(rawKey) {
  if (!rawKey) return "";
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

async function getClient() {
  if (cachedClient) return cachedClient;
  assertEnv();
  const privateKey = formatPrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  const auth = new google.auth.JWT({
    email: (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || "").trim(),
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

const SPREADSHEET_ID = () => process.env.GOOGLE_SHEET_ID;
const PHOTO_SPREADSHEET_ID = () => process.env.GOOGLE_PHOTO_SHEET_ID || process.env.GOOGLE_SHEET_ID;
// AUTH_SPREADSHEET_ID: always use the same existing spreadsheet — fall back to GOOGLE_SHEET_ID so
// user records live in the SECOND SHEET (tab) of the existing spreadsheet, not a separate file.
const AUTH_SPREADSHEET_ID = () =>
  process.env.GOOGLE_AUTH_SHEET_ID ||
  process.env.GOOGLE_SHEET_ID;
const USERS_SHEET = "Users";
// Columns: user_id | name | number | email | role | status | password
const USER_HEADERS = ["user_id", "name", "number", "email", "role", "status", "password"];

/**
 * Look up a user by their Google email in the Users tab (SECOND SHEET).
 * Schema: user_id | name | number | email | role | status | password (cols A-G)
 */
export async function getUserByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const targetEmail = email.trim().toLowerCase();
  try {
    const sheets = await getClient();
    const spreadsheetId = AUTH_SPREADSHEET_ID();
    await ensureSheetAndHeaders(sheets, USERS_SHEET, USER_HEADERS, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${USERS_SHEET}!A2:G2000`,
    });

    const rows = res.data.values || [];
    for (const r of rows) {
      // Columns: A=user_id, B=name, C=number, D=email, E=role, F=status, G=password
      const rowEmail = (r[3] || "").trim().toLowerCase();
      if (rowEmail === targetEmail) {
        return {
          user_id:  r[0] || "",
          name:     r[1] || "",
          number:   r[2] || "",
          email:    r[3] || "",
          role:     r[4] || "",
          status:   r[5] || "Inactive",
          password: r[6] || "",
        };
      }
    }
    return null;
  } catch (err) {
    console.error("[sheets] getUserByEmail error:", err.message);
    return null;
  }
}

/**
 * Look up a user by their display name AND their individual authentication number.
 * Schema: user_id | name | number | email | role | status | password (cols A-G)
 */
export async function getUserByNameAndNumber(name, number) {
  if (!name || !number) return null;
  const targetName   = String(name).trim().toLowerCase();
  const targetNumber = String(number).trim();
  try {
    const sheets = await getClient();
    const spreadsheetId = AUTH_SPREADSHEET_ID();
    await ensureSheetAndHeaders(sheets, USERS_SHEET, USER_HEADERS, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${USERS_SHEET}!A2:G2000`,
    });

    const rows = res.data.values || [];
    for (const r of rows) {
      // Columns: A=user_id, B=name, C=number, D=email, E=role, F=status, G=password
      const rowName   = (r[1] || "").trim().toLowerCase();
      const rowNumber = (r[2] || "").trim();
      if (rowName === targetName && rowNumber === targetNumber) {
        return {
          user_id:  r[0] || "",
          name:     r[1] || "",
          number:   r[2] || "",
          email:    r[3] || "",
          role:     r[4] || "",
          status:   r[5] || "Inactive",
          password: r[6] || "",
        };
      }
    }
    return null;
  } catch (err) {
    console.error("[sheets] getUserByNameAndNumber error:", err.message);
    return null;
  }
}

/**
 * Look up a user by ONLY their password from column G in the Users tab.
 * The password uniquely identifies the role. Name is free-text and NOT used for authentication.
 * Schema: user_id | name | number | email | role | status | password (cols A-G)
 */
export async function getUserByPassword(password) {
  if (!password) return null;
  const targetPassword = String(password).trim();
  try {
    const sheets = await getClient();
    const spreadsheetId = AUTH_SPREADSHEET_ID();
    await ensureSheetAndHeaders(sheets, USERS_SHEET, USER_HEADERS, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${USERS_SHEET}!A2:G2000`,
    });

    const rows = res.data.values || [];
    for (const r of rows) {
      // Columns: A=user_id, B=name, C=number, D=email, E=role, F=status, G=password
      const rowPassword = (r[6] || "").trim();
      if (rowPassword === targetPassword) {
        return {
          user_id:  r[0] || "",
          name:     r[1] || "",
          number:   r[2] || "",
          email:    r[3] || "",
          role:     r[4] || "",
          status:   r[5] || "Inactive",
          password: r[6] || "",
        };
      }
    }
    return null;
  } catch (err) {
    console.error("[sheets] getUserByPassword error:", err.message);
    return null;
  }
}

/**
 * Look up a user by their email AND password from column G in the Users tab.
 * Schema: user_id | name | number | email | role | status | password (cols A-G)
 */
export async function getUserByEmailAndPassword(email, password) {
  if (!email || !password) return null;
  const targetEmail    = String(email).trim().toLowerCase();
  const targetPassword = String(password).trim();
  try {
    const sheets = await getClient();
    const spreadsheetId = AUTH_SPREADSHEET_ID();
    await ensureSheetAndHeaders(sheets, USERS_SHEET, USER_HEADERS, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${USERS_SHEET}!A2:G2000`,
    });

    const rows = res.data.values || [];
    for (const r of rows) {
      const rowEmail    = (r[3] || "").trim().toLowerCase();
      const rowPassword = (r[6] || "").trim();
      if (rowEmail === targetEmail && rowPassword === targetPassword) {
        return {
          user_id:  r[0] || "",
          name:     r[1] || "",
          number:   r[2] || "",
          email:    r[3] || "",
          role:     r[4] || "",
          status:   r[5] || "Inactive",
          password: r[6] || "",
        };
      }
    }
    return null;
  } catch (err) {
    console.error("[sheets] getUserByEmailAndPassword error:", err.message);
    return null;
  }
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

async function ensureSheetAndHeaders(sheets, sheetName, headers, targetSpreadsheetId = SPREADSHEET_ID()) {
  const cacheKey = `${targetSpreadsheetId}_${sheetName}`;
  if (verifiedSheets.has(cacheKey)) return;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: targetSpreadsheetId });
    const exists = meta.data.sheets.some((s) => s.properties.title === sheetName);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    }
    const headerRow = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A1:${colLetter(headers.length)}1`,
    });
    if (!headerRow.data.values || headerRow.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSpreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
    verifiedSheets.add(cacheKey);
  } catch (err) {
    if (err.message?.includes("Quota exceeded") || err.code === 429) {
      console.warn(`[sheets] Rate limited in ensureSheetAndHeaders for ${sheetName}, assuming verified.`);
      verifiedSheets.add(cacheKey);
      return;
    }
    throw err;
  }
}

function chunkString(str, chunkSize = CHUNK_SIZE, numChunks = CHUNK_COLUMNS) {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  while (chunks.length < numChunks) chunks.push("");
  return chunks;
}

async function findRow(sheets, inspectionId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${INSPECTIONS_SHEET}!A2:A200000`,
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => r[0] === inspectionId);
  return idx === -1 ? null : idx + 2;
}

async function findSignatureRow(sheets, inspectionId, role) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${SIGNATURES_SHEET}!A2:B200000`,
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => r[0] === inspectionId && r[1] === role);
  return idx === -1 ? null : idx + 2;
}

async function upsertSignatureRow(sheets, inspectionId, role, signerName, base64Data) {
  await ensureSheetAndHeaders(sheets, SIGNATURES_SHEET, SIGNATURE_HEADERS);
  const now = new Date().toISOString();
  const sigChunks = chunkString(base64Data || "", CHUNK_SIZE, SIG_CHUNK_COLUMNS);
  const row = [
    inspectionId,
    role,
    signerName || "",
    now,
    ...sigChunks,
  ];

  const existingRow = await findSignatureRow(sheets, inspectionId, role);
  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SIGNATURES_SHEET}!A${existingRow}:${colLetter(SIGNATURE_HEADERS.length)}${existingRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SIGNATURES_SHEET}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

async function saveInspectionPhotos(sheets, data) {
  try {
    const photoSpreadsheetId = PHOTO_SPREADSHEET_ID();
    await ensureSheetAndHeaders(sheets, INSPECTION_PHOTOS_SHEET, PHOTO_HEADERS, photoSpreadsheetId);
    const now = new Date().toISOString();
    const rows = [];

    if (data.customerVerificationPhoto) {
      rows.push([
        data.inspectionId,
        data.projectName || "",
        data.unitNumber || "",
        "customerVerification",
        "Handover",
        "Customer",
        data.customerVerificationPhoto,
        now,
      ]);
    }

    Object.entries(data.cells || {}).forEach(([cellKey, cell]) => {
      const [itemId, areaKey] = cellKey.split("_");
      (cell.photos || []).forEach((photo) => {
        const photoUrl = typeof photo === "string" ? photo : photo.url || photo.dataUrl;
        if (photoUrl) {
          rows.push([
            data.inspectionId,
            data.projectName || "",
            data.unitNumber || "",
            cell.status || "photo",
            areaKey || "",
            itemId || "",
            photoUrl,
            now,
          ]);
        }
      });
    });

    if (rows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: photoSpreadsheetId,
        range: `${INSPECTION_PHOTOS_SHEET}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
    }
  } catch (err) {
    console.warn("[sheets] Failed to save photos to InspectionPhotos spreadsheet:", err.message);
  }
}

export async function getSignaturesForInspection(inspectionId) {
  try {
    const sheets = await getClient();
    await ensureSheetAndHeaders(sheets, SIGNATURES_SHEET, SIGNATURE_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SIGNATURES_SHEET}!A2:${colLetter(SIGNATURE_HEADERS.length)}200000`,
    });
    const rows = res.data.values || [];
    const signatures = {};
    for (const row of rows) {
      const [id, role, _signerName, _ts, ...sigChunks] = row;
      if (id === inspectionId && role) {
        const base64Data = sigChunks.slice(0, SIG_CHUNK_COLUMNS).join("");
        if (base64Data) signatures[role] = base64Data;
      }
    }
    return signatures;
  } catch (e) {
    console.error("Failed to load signatures from Google Sheets:", e);
    return {};
  }
}

export function computeStats(data) {
  let passed = 0,
    failed = 0,
    na = 0,
    total = 0;
  Object.values(data.cells || {}).forEach((c) => {
    total++;
    if (c.status === "pass") passed++;
    else if (c.status === "fail") failed++;
    else if (c.status === "na") na++;
  });
  return {
    passed,
    failed,
    na,
    pct: total ? Math.round(((passed + failed + na) / total) * 100) : 0,
  };
}

export async function appendAuditRecord(auditRecord) {
  try {
    const sheets = await getClient();
    await ensureSheetAndHeaders(sheets, APPROVAL_HISTORY_SHEET, APPROVAL_HEADERS);
    const row = [
      auditRecord.inspectionId  || "",
      auditRecord.project       || "",
      auditRecord.unit          || "",
      auditRecord.inspectionType || "",
      auditRecord.userId        || "",   // NEW: individual user_id
      auditRecord.userNumber    || "",   // NEW: individual user number
      auditRecord.role          || "",
      auditRecord.userName      || "",
      auditRecord.action        || "",
      auditRecord.status        || "",
      auditRecord.comments      || "",
      auditRecord.timestamp     || new Date().toISOString(),
      auditRecord.signature && auditRecord.signature !== "None" ? "Captured" : "None",
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${APPROVAL_HISTORY_SHEET}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (e) {
    console.error("Failed to append audit record to Google Sheet:", e);
  }
}

export async function upsertInspection(data, { submitting = false } = {}) {
  // Invalidate memory cache on save
  invalidateInspectionsCache();

  const sheets = await getClient();
  await ensureSheetAndHeaders(sheets, INSPECTIONS_SHEET, HEADERS);

  const signaturesRaw = data.signatures || {};
  const signerName = data.customerName || "Unknown";

  const signaturePromises = [];
  const signaturesMetadata = {};
  for (const [role, value] of Object.entries(signaturesRaw)) {
    if (value && typeof value === "string" && value.startsWith("data:")) {
      signaturePromises.push(
        upsertSignatureRow(sheets, data.inspectionId, role, signerName, value)
      );
      signaturesMetadata[role] = "SIGNED";
    } else if (value) {
      signaturesMetadata[role] = value;
    }
  }

  if (signaturePromises.length > 0) {
    await Promise.all(signaturePromises);
  }

  const dataToStore = {
    ...data,
    signatures: signaturesMetadata,
  };

  const json = JSON.stringify(dataToStore);
  if (json.length > MAX_JSON_LENGTH) {
    const err = new Error(
      "This inspection is too large to save (usually too many/too-large photos). Remove a few images and try again."
    );
    err.code = "PAYLOAD_TOO_LARGE";
    throw err;
  }

  const stats = computeStats(data);
  const now = new Date().toISOString();
  const row = [
    data.inspectionId,
    data.projectName || "",
    data.unitNumber || "",
    data.inspectionType || "INTERIOR JOINT INSPECTION",
    data.customerName || "",
    data.inspectionDate || "",
    data.inspectionTime || "",
    submitting ? "submitted" : data.status || "draft",
    `${stats.pct}%`,
    stats.passed,
    stats.failed,
    stats.na,
    data.declarationChecked ? "Yes" : "No",
    now,
    submitting ? now : data.submittedAt || "",
    ...chunkString(json),
  ];

  const existingRow = await findRow(sheets, data.inspectionId);
  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${INSPECTIONS_SHEET}!A${existingRow}:${colLetter(HEADERS.length)}${existingRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${INSPECTIONS_SHEET}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }

  // Log photos separately to InspectionPhotos tab for fast printing & lightweight queries
  await saveInspectionPhotos(sheets, data);

  if (data.latestAuditRecord) {
    await appendAuditRecord(data.latestAuditRecord);
  }

  return { ok: true, updatedAt: now };
}

export async function getInspection(inspectionId) {
  // Check memory cache first
  if (cache.inspections.data) {
    const cachedItem = cache.inspections.data.find(i => i.inspectionId === inspectionId);
    if (cachedItem) {
      const fullSignatures = await getSignaturesForInspection(inspectionId);
      return {
        ...cachedItem,
        signatures: { ...(cachedItem.signatures || {}), ...fullSignatures }
      };
    }
  }

  const sheets = await getClient();
  await ensureSheetAndHeaders(sheets, INSPECTIONS_SHEET, HEADERS);
  const rowIndex = await findRow(sheets, inspectionId);
  if (!rowIndex) return null;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${INSPECTIONS_SHEET}!A${rowIndex}:${colLetter(HEADERS.length)}${rowIndex}`,
  });
  const row = (res.data.values || [[]])[0];
  const jsonChunks = row.slice(BASE_HEADERS.length, BASE_HEADERS.length + CHUNK_COLUMNS);
  const json = jsonChunks.join("");
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    const fullSignatures = await getSignaturesForInspection(inspectionId);
    if (Object.keys(fullSignatures).length > 0) {
      parsed.signatures = { ...(parsed.signatures || {}), ...fullSignatures };
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export async function getAllInspections() {
  const now = Date.now();
  if (cache.inspections.data && now - cache.inspections.timestamp < INSPECTIONS_CACHE_TTL) {
    return cache.inspections.data;
  }

  const sheets = await getClient();
  await ensureSheetAndHeaders(sheets, INSPECTIONS_SHEET, HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${INSPECTIONS_SHEET}!A2:${colLetter(HEADERS.length)}200000`,
  });
  const rows = res.data.values || [];
  const list = [];
  for (const row of rows) {
    const parsedItem = GoogleSheetAdapter.sheetRowToInspection(row);
    if (parsedItem) {
      list.push(parsedItem);
    }
  }

  cache.inspections = { data: list, timestamp: now };
  return list;
}

export async function getProjects() {
  const now = Date.now();
  if (cache.projects.data && now - cache.projects.timestamp < PROJECTS_CACHE_TTL) {
    return cache.projects.data;
  }

  const sheets = await getClient();
  await ensureSheetAndHeaders(sheets, PROJECTS_SHEET, ["Project", "Unit"]);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${PROJECTS_SHEET}!A2:B200000`,
  });
  const rows = res.data.values || [];
  const map = {};
  rows.forEach(([project, unit]) => {
    if (!project || !unit) return;
    const p = String(project).trim();
    const u = String(unit).trim();
    if (!p || !u) return;
    if (!map[p]) map[p] = [];
    if (!map[p].includes(u)) map[p].push(u);
  });

  cache.projects = { data: map, timestamp: now };
  return map;
}
