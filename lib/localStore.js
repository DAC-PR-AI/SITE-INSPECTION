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
    inspectionType: data.inspectionType || existing.inspectionType || "INTERIOR JOINT INSPECTION",
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

export async function getUserByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const targetEmail = email.trim().toLowerCase();

  // Seed users with individual numbers for dev/local mode
  // Columns order matches SECOND SHEET: user_id | name | number | email | role | status
  const seedUsers = [
    { user_id: "U001", name: "Raj",               number: "1001", email: "techexec@dac.com",     role: "Technical Executive", status: "Active",   password: "TechExec@1001" },
    { user_id: "U002", name: "Arun",              number: "1002", email: "siteengineer@dac.com", role: "Site Engineer",       status: "Active",   password: "SiteEng@1002"  },
    { user_id: "U003", name: "Kumar",             number: "1003", email: "qaqc@dac.com",         role: "QA/QC In-Charge",    status: "Active",   password: "QAQC@1003"     },
    { user_id: "U004", name: "Priya",             number: "1004", email: "customer@dac.com",     role: "Customer",           status: "Active",   password: "Customer@1004" },
    { user_id: "U005", name: "Project Manager",   number: "1005", email: "pm@dac.com",           role: "Project Manager",    status: "Active",   password: "PM@1005"       },
    { user_id: "U006", name: "Manager Technical", number: "1006", email: "mantech@dac.com",      role: "Manager Technical",  status: "Active",   password: "ManTech@1006"  },
    { user_id: "U007", name: "GM HUG",            number: "1007", email: "gm@dac.com",           role: "GM \u2013 HUG",         status: "Active",   password: "GM@1007"       },
    { user_id: "U008", name: "VP HUG",            number: "1008", email: "vp@dac.com",           role: "VP \u2013 HUG",         status: "Active",   password: "VP@1008"       },
    { user_id: "U009", name: "Administrator",     number: "9990", email: "admin@dac.com",        role: "Admin",              status: "Active",   password: "Admin@9990"    },
    { user_id: "U010", name: "Disabled User",     number: "0000", email: "inactive@dac.com",     role: "QA/QC In-Charge",    status: "Inactive", password: "Inactive@0000" },
  ];

  return seedUsers.find(u => u.email.toLowerCase() === targetEmail) || null;
}

const LOCAL_SEED_USERS = [
  { user_id: "U001", name: "Raj",               number: "1001", email: "techexec@dac.com",     role: "Technical Executive", status: "Active",   password: "TechExec@1001" },
  { user_id: "U002", name: "Arun",              number: "1002", email: "siteengineer@dac.com", role: "Site Engineer",       status: "Active",   password: "SiteEng@1002"  },
  { user_id: "U003", name: "Kumar",             number: "1003", email: "qaqc@dac.com",         role: "QA/QC In-Charge",    status: "Active",   password: "QAQC@1003"     },
  { user_id: "U004", name: "Priya",             number: "1004", email: "customer@dac.com",     role: "Customer",           status: "Active",   password: "Customer@1004" },
  { user_id: "U005", name: "Project Manager",   number: "1005", email: "pm@dac.com",           role: "Project Manager",    status: "Active",   password: "PM@1005"       },
  { user_id: "U006", name: "Manager Technical", number: "1006", email: "mantech@dac.com",      role: "Manager Technical",  status: "Active",   password: "ManTech@1006"  },
  { user_id: "U007", name: "GM HUG",            number: "1007", email: "gm@dac.com",           role: "GM \u2013 HUG",         status: "Active",   password: "GM@1007"       },
  { user_id: "U008", name: "VP HUG",            number: "1008", email: "vp@dac.com",           role: "VP \u2013 HUG",         status: "Active",   password: "VP@1008"       },
  { user_id: "U009", name: "Administrator",     number: "9990", email: "admin@dac.com",        role: "Admin",              status: "Active",   password: "Admin@9990"    },
  { user_id: "U010", name: "Disabled User",     number: "0000", email: "inactive@dac.com",     role: "QA/QC In-Charge",    status: "Inactive", password: "Inactive@0000" },
];

export async function getUserByNameAndNumber(name, number) {
  if (!name || !number) return null;
  const targetName   = String(name).trim().toLowerCase();
  const targetNumber = String(number).trim();

  return LOCAL_SEED_USERS.find(u =>
    (u.name.toLowerCase() === targetName || u.number === targetName) && u.number === targetNumber
  ) || null;
}

export async function getUserByPassword(password) {
  if (!password) return null;
  const targetPassword = String(password).trim();
  return LOCAL_SEED_USERS.find(u => u.password === targetPassword) || null;
}

export async function getAllInspections() {
  const db = readDb();
  // For list views we do NOT merge back full base64 signatures (too expensive for bulk loads).
  // The "SIGNED" markers in inspection.signatures are sufficient for queue filtering.
  return Object.values(db.inspections || {});
}
