import crypto from "crypto";

// Role identifiers — PINs MUST be set via environment variables (see .env.local / Vercel dashboard)
// defaultPin values are intentionally omitted from source to prevent credential leakage.
export const ROLE_CONFIG = {
  "Customer": {
    id: "CUSTOMER",
    envKey: "AUTH_PIN_CUSTOMER",
    label: "Customer",
    sigKey: "customer",
    canSign: true,
  },
  "Site Engineer": {
    id: "SITE_ENGINEER",
    envKey: "AUTH_PIN_SITE_ENGINEER",
    label: "Site Engineer",
    sigKey: "siteEngineer",
    canSign: true,
  },
  "Start Inspection": {
    id: "START_INSPECTION",
    envKey: "AUTH_PIN_START_INSPECTION",
    label: "Start Inspection",
    sigKey: null,
    canSign: false,
  },
  "QA/QC In-Charge": {
    id: "QA_QC",
    envKey: "AUTH_PIN_QAQC",
    label: "QA/QC In-Charge",
    sigKey: "qaqc",
    canSign: true,
  },
  "Project Manager": {
    id: "PROJECT_MANAGER",
    envKey: "AUTH_PIN_PROJECT_MANAGER",
    label: "Project Manager",
    sigKey: "projectManager",
    canSign: true,
  },
  "Technical Executive": {
    id: "TECHNICAL_EXECUTIVE",
    envKey: "AUTH_PIN_TECHNICAL_EXECUTIVE",
    label: "Technical Executive",
    sigKey: "technicalExecutive",
    canSign: true,
  },
  "Manager Technical": {
    id: "MANAGER_TECHNICAL",
    envKey: "AUTH_PIN_MANAGER_TECHNICAL",
    label: "Manager Technical",
    sigKey: "managerTechnical",
    canSign: true,
  },
  "GM – HUG": {
    id: "GM_HUG",
    envKey: "AUTH_PIN_GM_HUG",
    label: "GM – HUG",
    sigKey: "gmHug",
    canSign: true,
  },
  "VP – HUG": {
    id: "VP_HUG",
    envKey: "AUTH_PIN_VP_HUG",
    label: "VP – HUG",
    sigKey: "vpHug",
    canSign: true,
  },
  "Admin": {
    id: "ADMIN",
    envKey: "AUTH_PIN_ADMIN",
    label: "Admin",
    sigKey: null,
    canSign: false,
  },
};

// Map alternate keys/names to standard role objects
export function getRoleConfig(roleNameOrId) {
  if (!roleNameOrId) return null;
  const normalized = String(roleNameOrId).trim().toLowerCase();

  for (const [name, config] of Object.entries(ROLE_CONFIG)) {
    if (
      name.toLowerCase() === normalized ||
      config.id.toLowerCase() === normalized ||
      (config.sigKey && config.sigKey.toLowerCase() === normalized) ||
      (name.replace(/–|-/g, "-").toLowerCase() === normalized.replace(/–|-/g, "-"))
    ) {
      return { name, ...config };
    }
  }
  return null;
}

export function getExpectedPin(roleNameOrId) {
  const config = getRoleConfig(roleNameOrId);
  if (!config) return null;
  const envVal = process.env[config.envKey];
  // Only use env var — no fallback to hardcoded default in production
  return envVal && envVal.trim() ? envVal.trim() : null;
}

/**
 * Timing-safe PIN verification using crypto.timingSafeEqual.
 * Prevents timing side-channel attacks where response time reveals correctness.
 */
export function verifyRolePassword(roleNameOrId, enteredPin) {
  if (!enteredPin || typeof enteredPin !== "string") return false;
  const expected = getExpectedPin(roleNameOrId);
  if (!expected) return false;

  const entered = enteredPin.trim();
  // Both must be same byte length for timingSafeEqual
  const a = Buffer.from(entered.padEnd(64, "\0"), "utf8");
  const b = Buffer.from(expected.padEnd(64, "\0"), "utf8");

  // Also check lengths match (don't rely on padding alone)
  if (entered.length !== expected.length) {
    // Still run timingSafeEqual to avoid timing leak on length check
    crypto.timingSafeEqual(a, b);
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}
