import crypto from "crypto";

// Role identifiers and their default 6-digit PINs (can be overridden via environment variables)
export const ROLE_CONFIG = {
  "Customer": {
    id: "CUSTOMER",
    envKey: "AUTH_PIN_CUSTOMER",
    defaultPin: "111111",
    label: "Customer",
    sigKey: "customer",
    canSign: true,
  },
  "Site Engineer": {
    id: "SITE_ENGINEER",
    envKey: "AUTH_PIN_SITE_ENGINEER",
    defaultPin: "272727",
    label: "Site Engineer",
    sigKey: "siteEngineer",
    canSign: true,
  },
  "Start Inspection": {
    id: "START_INSPECTION",
    envKey: "AUTH_PIN_START_INSPECTION",
    defaultPin: "272727",
    label: "Start Inspection",
    sigKey: null,
    canSign: false,
  },
  "QA/QC In-Charge": {
    id: "QA_QC",
    envKey: "AUTH_PIN_QAQC",
    defaultPin: "202020",
    label: "QA/QC In-Charge",
    sigKey: "qaqc",
    canSign: true,
  },
  "Project Manager": {
    id: "PROJECT_MANAGER",
    envKey: "AUTH_PIN_PROJECT_MANAGER",
    defaultPin: "303030",
    label: "Project Manager",
    sigKey: "projectManager",
    canSign: true,
  },
  "Technical Executive": {
    id: "TECHNICAL_EXECUTIVE",
    envKey: "AUTH_PIN_TECHNICAL_EXECUTIVE",
    defaultPin: "444444",
    label: "Technical Executive",
    sigKey: "technicalExecutive",
    canSign: true,
  },
  "Manager Technical": {
    id: "MANAGER_TECHNICAL",
    envKey: "AUTH_PIN_MANAGER_TECHNICAL",
    defaultPin: "454545",
    label: "Manager Technical",
    sigKey: "managerTechnical",
    canSign: true,
  },
  "GM – HUG": {
    id: "GM_HUG",
    envKey: "AUTH_PIN_GM_HUG",
    defaultPin: "404040",
    label: "GM – HUG",
    sigKey: "gmHug",
    canSign: true,
  },
  "VP – HUG": {
    id: "VP_HUG",
    envKey: "AUTH_PIN_VP_HUG",
    defaultPin: "505050",
    label: "VP – HUG",
    sigKey: "vpHug",
    canSign: true,
  },
  "Admin": {
    id: "ADMIN",
    envKey: "AUTH_PIN_ADMIN",
    defaultPin: "999999",
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
  // Priority: 1) Environment Variable if set -> 2) Default PIN fallback
  return envVal && envVal.trim() ? envVal.trim() : config.defaultPin;
}

/**
 * Timing-safe PIN verification using crypto.timingSafeEqual.
 * Prevents timing side-channel attacks where response time reveals correctness.
 * Immune to Buffer length mismatch crashes.
 */
export function verifyRolePassword(roleNameOrId, enteredPin) {
  if (!enteredPin || typeof enteredPin !== "string") return false;
  const expected = getExpectedPin(roleNameOrId);
  if (!expected || typeof expected !== "string") return false;

  const entered = enteredPin.trim();
  if (entered.length === 0) return false;

  try {
    // Fixed 64-byte buffers guarantees same byte length for crypto.timingSafeEqual
    const a = Buffer.alloc(64);
    const b = Buffer.alloc(64);
    a.write(entered, "utf8");
    b.write(expected, "utf8");

    const match = crypto.timingSafeEqual(a, b);
    return match && entered.length === expected.length;
  } catch (err) {
    console.error("[auth] Error during PIN verification:", err);
    return false;
  }
}
