import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "inspections.json");
// Signatures are stored in a separate file to keep the main DB lean
const SIG_FILE = path.join(DATA_DIR, "signatures.json");

const SEED_PROJECTS = {
  "DAC Aspire Heights": ["A-101", "A-102", "A-203", "B-201", "B-202", "B-305"],
  "DAC Serene County": ["T1-01", "T1-02", "T2-01", "T2-04"],
  "DAC Elan Grande": ["G-301", "G-302", "G-401", "G-402"],
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ projects: SEED_PROJECTS, inspections: {} }, null, 2)
    );
  }
  if (!fs.existsSync(SIG_FILE)) {
    fs.writeFileSync(SIG_FILE, JSON.stringify({}, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return { projects: SEED_PROJECTS, inspections: {} };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function readSigDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(SIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeSigDb(db) {
  ensureDb();
  fs.writeFileSync(SIG_FILE, JSON.stringify(db, null, 2));
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

export async function getProjects() {
  const db = readDb();
  return db.projects && Object.keys(db.projects).length ? db.projects : SEED_PROJECTS;
}

export async function upsertInspection(data, { submitting = false } = {}) {
  const db = readDb();
  const sigDb = readSigDb();
  const now = new Date().toISOString();
  const existing = db.inspections[data.inspectionId] || {};

  const status = submitting
    ? (data.workflowStatus || "QA_QC_PENDING")
    : (data.status || existing.status || "draft");

  // ─── SIGNATURE EXTRACTION ─────────────────────────────────────────────────
  // Separate base64 signature images from the main inspection JSON.
  // Store them in signatures.json; keep only "SIGNED" markers in inspections.json.
  const signaturesRaw = data.signatures || {};
  const signaturesMetadata = {};

  if (!sigDb[data.inspectionId]) sigDb[data.inspectionId] = {};

  for (const [role, value] of Object.entries(signaturesRaw)) {
    if (value && typeof value === "string" && value.startsWith("data:")) {
      // Full base64 → save in signatures.json
      sigDb[data.inspectionId][role] = value;
      signaturesMetadata[role] = "SIGNED";
    } else if (value) {
      // Already a marker like "SIGNED" — preserve
      signaturesMetadata[role] = value;
    }
  }

  writeSigDb(sigDb);

  const updatedInspection = {
    ...existing,
    ...data,
    signatures: signaturesMetadata, // lightweight markers only
    status: submitting ? "submitted" : status,
    workflowStatus: data.workflowStatus || existing.workflowStatus || (submitting ? "QA_QC_PENDING" : "DRAFT"),
    inspectionType: data.inspectionType || existing.inspectionType || "IJI",
    approvalHistory: data.approvalHistory || existing.approvalHistory || [],
    updatedAt: now,
    submittedAt: submitting ? now : existing.submittedAt || data.submittedAt || "",
  };

  db.inspections[data.inspectionId] = updatedInspection;
  writeDb(db);
  return { ok: true, updatedAt: now };
}

export async function getInspection(inspectionId) {
  const db = readDb();
  const inspection = db.inspections[inspectionId] || null;
  if (!inspection) return null;

  // Merge back the full base64 signatures from signatures.json
  const sigDb = readSigDb();
  const fullSignatures = sigDb[inspectionId] || {};
  if (Object.keys(fullSignatures).length > 0) {
    inspection.signatures = { ...(inspection.signatures || {}), ...fullSignatures };
  }

  return inspection;
}

export async function getAllInspections() {
  const db = readDb();
  // For list views we do NOT merge back full base64 signatures (too expensive for bulk loads).
  // The "SIGNED" markers in inspection.signatures are sufficient for queue filtering.
  return Object.values(db.inspections || {});
}
