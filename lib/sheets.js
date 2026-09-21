import { google } from "googleapis";
import { GoogleSheetAdapter } from "./GoogleSheetAdapter.js";

const INSPECTIONS_SHEET = "Inspections";
const PROJECTS_SHEET = "Projects";  // Master: ProjectID | ProjectName
const UNITS_SHEET    = "Units";      // Detail:  ProjectID | UnitID
const APPROVAL_HISTORY_SHEET = "ApprovalHistory";
const SIGNATURES_SHEET = "Signatures";
const INSPECTION_PHOTOS_SHEET = "InspectionPhotos";
const USERS_SHEET = "Users";

// Headers for the project-config and user sheets
const PROJECTS_HEADERS = ["ProjectID", "ProjectName"];
const UNITS_HEADERS    = ["ProjectID", "UnitNo"];
const USER_HEADERS     = ["user_id", "name", "number", "email", "role", "status", "password"];

const CHUNK_SIZE = 45000;
const CHUNK_COLUMNS = 12; // ~540,000 chars of headroom for inspection JSON
const SIG_CHUNK_COLUMNS = 20;

import { SIGNATURE_ROLE_ALIASES, getPersistableSignatures } from "./signatureUtils.js";
export { SIGNATURE_ROLE_ALIASES, getPersistableSignatures };
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
  projects:   { data: null, timestamp: 0 },
  inspections:{ data: null, timestamp: 0 },
  users:      { data: null, timestamp: 0 },  // All users cached to avoid per-request Sheets reads
};

const USERS_CACHE_TTL = 120000; // 2 minutes — balances freshness vs. API quota under load

// In-flight promise lock — prevents thundering herd / cache stampede.
// When 20 VUs simultaneously miss the empty cache, only ONE Sheets read is made;
// all other callers wait on the same promise instead of firing duplicate requests.
let _usersCacheInFlight = null;

/**
 * Load ALL users from the Users sheet once and cache them.
 * All three lookup helpers (byEmail, byNameAndNumber, byPassword) draw from this cache,
 * preventing the N×concurrent-users Sheets API hits that cause 429s under load.
 *
 * Stampede-safe: concurrent callers that miss the cache all share one in-flight promise.
 */
async function getCachedUsers(sheets, spreadsheetId) {
  const now = Date.now();
  // 1. Hot-path: serve from valid cache immediately
  if (cache.users.data && now - cache.users.timestamp < USERS_CACHE_TTL) {
    return cache.users.data;
  }
  // 2. Stampede guard: if a fetch is already in flight, wait for it (no duplicate Sheets read)
  if (_usersCacheInFlight) {
    return _usersCacheInFlight;
  }
  // 3. Cold-path: we are the first caller — own the fetch and let others wait
  _usersCacheInFlight = (async () => {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${USERS_SHEET}!A2:G2000`,
      });
      const rows = (res.data.values || []).map((r) => ({
        user_id:  r[0] || "",
        name:     r[1] || "",
        number:   r[2] || "",
        email:    r[3] || "",
        role:     r[4] || "",
        status:   r[5] || "Inactive",
        password: r[6] || "",
      }));
      cache.users = { data: rows, timestamp: Date.now() };
      return rows;
    } finally {
      _usersCacheInFlight = null; // Release lock regardless of success/failure
    }
  })();

  return _usersCacheInFlight;
}

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
    const users = await getCachedUsers(sheets, spreadsheetId);
    return users.find(u => u.email.trim().toLowerCase() === targetEmail) || null;
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
    const users = await getCachedUsers(sheets, spreadsheetId);
    return users.find(u =>
      u.name.trim().toLowerCase() === targetName && u.number.trim() === targetNumber
    ) || null;
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
    const users = await getCachedUsers(sheets, spreadsheetId);
    const found = users.find(u => u.password.trim() === targetPassword);
    if (!found) return null;
    // Don't expose password hash in the returned object
    const { password: _pw, ...safeUser } = found;
    return safeUser;
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
    const users = await getCachedUsers(sheets, spreadsheetId);
    const found = users.find(u =>
      u.email.trim().toLowerCase() === targetEmail && u.password.trim() === targetPassword
    );
    if (!found) return null;
    const { password: _pw, ...safeUser } = found;
    return safeUser;
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
      const [id, role, signerName, ts, ...sigChunks] = row;
      if (id === inspectionId && role) {
        const base64Data = sigChunks.slice(0, SIG_CHUNK_COLUMNS).join("");
        if (base64Data) {
          const sigObj = {
            role,
            signer: signerName || "",
            status: "signed",
            dataUrl: base64Data,
            timestamp: ts || "",
          };
          signatures[role] = sigObj;
          
          // Also set direct base64 string for direct access
          signatures[`${role}_data`] = base64Data;

          // Also set camelCase alias (e.g. "Site Engineer" -> "siteEngineer")
          if (SIGNATURE_ROLE_ALIASES[role]) {
            signatures[SIGNATURE_ROLE_ALIASES[role]] = sigObj;
          }
        }
      }
    }
    return signatures;
  } catch (e) {
    console.error("Failed to load signatures from Google Sheets:", e?.message || "Unknown error");
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
    console.error("Failed to append audit record to Google Sheet:", e?.message || "Unknown error");
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
  for (const [role, value] of getPersistableSignatures(signaturesRaw)) {
    let base64String = null;
    let specificSigner = signerName;

    if (typeof value === "string") {
      if (value.startsWith("data:") || value.length > 50) {
        base64String = value;
      }
    } else if (typeof value === "object" && value !== null) {
      if (value.dataUrl && typeof value.dataUrl === "string") {
        base64String = value.dataUrl;
      } else if (value.signature && typeof value.signature === "string") {
        base64String = value.signature;
      } else if (value.sigData && typeof value.sigData === "string") {
        base64String = value.sigData;
      }
      if (value.signer) {
        specificSigner = value.signer;
      }
    }

    if (base64String) {
      signaturePromises.push(
        upsertSignatureRow(sheets, data.inspectionId, role, specificSigner, base64String)
      );
      if (typeof value === "object" && value !== null) {
        signaturesMetadata[role] = { ...value, dataUrl: base64String, status: "signed" };
      } else {
        signaturesMetadata[role] = base64String;
      }
    } else if (value) {
      signaturesMetadata[role] = value;
    }
  }

  if (signaturePromises.length > 0) {
    try {
      await Promise.all(signaturePromises);
    } catch (sigErr) {
      console.warn("[sheets] Note on saving signatures to Signatures tab:", sigErr.message);
    }
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
    data.inspectionDate || data.date || "",
    data.inspectionTime || data.time || "",
    data.workflowStatus || (submitting ? "QA_QC_PENDING" : (data.status || "draft")),
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
  if (!inspectionId) return null;
  const targetId = String(inspectionId).trim();

  // Check memory cache first
  if (cache.inspections.data) {
    const cachedItem = cache.inspections.data.find(i => (i.inspectionId || "").trim() === targetId);
    if (cachedItem) {
      const fullSignatures = await getSignaturesForInspection(targetId);
      return {
        ...cachedItem,
        signatures: { ...(cachedItem.signatures || {}), ...fullSignatures }
      };
    }
  }

  const sheets = await getClient();
  await ensureSheetAndHeaders(sheets, INSPECTIONS_SHEET, HEADERS);
  const rowIndex = await findRow(sheets, targetId);
  if (!rowIndex) return null;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${INSPECTIONS_SHEET}!A${rowIndex}:${colLetter(HEADERS.length)}${rowIndex}`,
  });
  const row = (res.data.values || [[]])[0];
  if (!row || row.length === 0) return null;

  // Reassemble robustly using GoogleSheetAdapter (handles both DataJSON chunks and flat row columns)
  const inspectionObj = GoogleSheetAdapter.sheetRowToInspection(row);
  if (!inspectionObj) return null;

  const fullSignatures = await getSignaturesForInspection(targetId);
  if (Object.keys(fullSignatures).length > 0) {
    inspectionObj.signatures = { ...(inspectionObj.signatures || {}), ...fullSignatures };
  }
  return inspectionObj;
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

/**
 * getProjects() — reads normalized Projects and Units tabs from Google Sheets:
 *
 *   Projects sheet (master):  | ProjectID | ProjectName |
 *   Units sheet (detail):     | ProjectID | UnitNo      |
 *
 * Returns catalog map for dropdowns:
 *   { "Manapark": ["A-101", ...], ... }
 */
export async function getProjects() {
  const now = Date.now();
  if (cache.projects.data && now - cache.projects.timestamp < PROJECTS_CACHE_TTL) {
    return cache.projects.data;
  }

  const sheets = await getClient();
  await ensureSheetAndHeaders(sheets, PROJECTS_SHEET, PROJECTS_HEADERS);
  await ensureSheetAndHeaders(sheets, UNITS_SHEET,    UNITS_HEADERS);

  // ── 1. Load Projects master: ProjectID → ProjectName ─────────────────────
  const projectsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID(),
    range: `${PROJECTS_SHEET}!A2:B200000`,
  });
  const projectRows = projectsRes.data.values || [];

  const map = {};
  const projectIdToName = {};

  projectRows.forEach(([idOrName, nameOrUnit]) => {
    const colA = String(idOrName || "").trim();
    const colB = String(nameOrUnit || "").trim();
    if (!colA) return;

    if (colB) {
      // Standard format: colA = ProjectID (e.g. P001), colB = ProjectName (e.g. Manapark)
      projectIdToName[colA] = colB;
      if (!map[colB]) map[colB] = [];
    } else {
      // Single column fallback
      projectIdToName[colA] = colA;
      if (!map[colA]) map[colA] = [];
    }
  });

  // ── 2. Load Units detail: ProjectID → UnitNo ─────────────────────────────
  try {
    const unitsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${UNITS_SHEET}!A2:B200000`,
    });
    const unitRows = unitsRes.data.values || [];

    unitRows.forEach(([projectId, unitNo]) => {
      const pid = String(projectId || "").trim();
      const unit = String(unitNo || "").trim();
      if (!pid || !unit) return;

      const projectName = projectIdToName[pid] || pid;
      if (!map[projectName]) map[projectName] = [];
      if (!map[projectName].includes(unit)) {
        map[projectName].push(unit);
      }
    });
  } catch (err) {
    console.warn("[sheets] Note on reading Units tab:", err.message);
  }

  if (Object.keys(map).length > 0) {
    cache.projects = { data: map, timestamp: now };
  }

  return map;
}
