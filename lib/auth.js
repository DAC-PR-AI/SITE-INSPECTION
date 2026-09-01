import crypto from "crypto";

/**
 * Roles that are "field staff" — they authenticate with free-text name entry only.
 * No pre-registration in the SECOND SHEET required.
 * These roles rotate frequently (different person each time).
 */
export const FIELD_STAFF_ROLES = ["Technical Executive", "Site Engineer", "Customer"];

/**
 * Check if a role is a field staff role (Tier 2 — free-text name, no auth number).
 */
export function isFieldStaffRole(role) {
  if (!role) return false;
  const normalized = String(role).trim().toLowerCase();
  return FIELD_STAFF_ROLES.some(r => r.toLowerCase() === normalized);
}

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
  return envVal && envVal.trim() ? envVal.trim() : config.defaultPin;
}

export function hashPinServer(pin) {
  if (!pin || typeof pin !== "string") return "";
  const trimmed = pin.trim();
  return crypto.createHash("sha256").update(`dac_pin_${trimmed}`).digest("hex");
}

/**
 * Timing-safe PIN verification using crypto.timingSafeEqual.
 */
export function verifyRolePassword(roleNameOrId, enteredPinOrHash) {
  if (!enteredPinOrHash || typeof enteredPinOrHash !== "string") return false;
  const expected = getExpectedPin(roleNameOrId);
  if (!expected || typeof expected !== "string") return false;

  const entered = enteredPinOrHash.trim();
  if (entered.length === 0) return false;

  try {
    const expectedPlain = expected.trim();
    const expectedSaltedHash = hashPinServer(expectedPlain);
    const expectedDirectHash = crypto.createHash("sha256").update(expectedPlain).digest("hex");

    if (entered.length === expectedSaltedHash.length) {
      const a = Buffer.from(entered, "utf8");
      const b = Buffer.from(expectedSaltedHash, "utf8");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }
    if (entered.length === expectedDirectHash.length) {
      const a = Buffer.from(entered, "utf8");
      const b = Buffer.from(expectedDirectHash, "utf8");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }
    if (entered.length === expectedPlain.length) {
      const a = Buffer.alloc(64);
      const b = Buffer.alloc(64);
      a.write(entered, "utf8");
      b.write(expectedPlain, "utf8");
      if (crypto.timingSafeEqual(a, b)) return true;
    }
    return false;
  } catch (err) {
    console.error("[auth] Error during PIN verification:", err);
    return false;
  }
}

import { getUserByEmail, getUserByNameAndNumber, getUserByPassword } from "./store.js";

/**
 * Verifies a user by ONLY their password against column G in the Users tab.
 * The password uniquely identifies the ROLE. The userName is free-text (can be anything)
 * and is used only for record-keeping (e.g. who signed the inspection).
 *
 * SECURITY: Role is read strictly from the sheet record (cannot be spoofed by client).
 */
export async function verifyUserPasswordAndLookupUser(userName, password) {
  if (!userName || typeof userName !== "string" || !userName.trim()) {
    return { ok: false, error: "Your name is required." };
  }
  if (!password || typeof password !== "string" || !password.trim()) {
    return { ok: false, error: "Password is required." };
  }

  const sheetUser = await getUserByPassword(password.trim());

  if (!sheetUser) {
    return {
      ok: false,
      error: "Invalid password. Please check the password assigned to your role.",
    };
  }

  if (String(sheetUser.status || "").trim().toLowerCase() !== "active") {
    return { ok: false, error: "This role is currently inactive. Please contact the administrator." };
  }

  const roleConfig = getRoleConfig(sheetUser.role);

  return {
    ok: true,
    user: {
      user_id: sheetUser.user_id,
      name:    userName.trim(),           // ← free-text name entered by user
      number:  sheetUser.number || "",
      email:   sheetUser.email || "",
      role:    sheetUser.role,            // ← role comes from sheet, not user
      status:  sheetUser.status,
    },
    role:    sheetUser.role,
    roleId:  roleConfig ? roleConfig.id : "USER",
    canSign: roleConfig ? roleConfig.canSign : true,
  };
}

/**
 * Verifies a Google ID Token via Google's tokeninfo endpoint, then looks up
 * the verified email in the SECOND SHEET ('Users' tab) to confirm the user
 * is an active Admin.
 */
export async function verifyGoogleTokenAndLookupUser(idToken) {
  if (!idToken || typeof idToken !== "string" || idToken.trim().length < 20) {
    return { ok: false, error: "A valid Google authentication credential is required." };
  }

  let verifiedEmail = "";
  let name = "";

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`
    );
    if (!res.ok) {
      return { ok: false, error: "Google authentication failed. Please sign in again." };
    }
    const body = await res.json();
    if (!body.email || (body.email_verified !== true && body.email_verified !== "true")) {
      return { ok: false, error: "Google token verification failed: email not verified." };
    }
    verifiedEmail = body.email.trim().toLowerCase();
    name = body.name || body.email.split("@")[0];
  } catch (e) {
    console.warn("[auth] Google tokeninfo call failed:", e.message);
    return { ok: false, error: "Google authentication service unavailable. Please try again." };
  }

  const user = await getUserByEmail(verifiedEmail);

  if (!user) {
    return {
      ok: false,
      error: "Your Google account is not authorized to access this application. Please contact the administrator.",
    };
  }

  if (String(user.status || "").trim().toLowerCase() !== "active") {
    return { ok: false, error: "Your account is currently inactive. Please contact the administrator." };
  }

  const roleConfig = getRoleConfig(user.role);

  return {
    ok: true,
    user: {
      user_id: user.user_id,
      name:    user.name || name || verifiedEmail,
      number:  user.number || "",
      email:   user.email || verifiedEmail,
      role:    user.role,
      status:  user.status,
    },
    role:    user.role,
    roleId:  roleConfig ? roleConfig.id : "USER",
    canSign: roleConfig ? roleConfig.canSign : true,
  };
}

/**
 * Authenticate a non-admin user by matching their displayed name AND entered number
 * against the SECOND SHEET. Both must match the SAME individual user record.
 *
 * Used for Tier 3 (Approval Chain) roles: QA/QC, PM, Manager Technical, GM–HUG, VP–HUG.
 * SECURITY: Does NOT accept role from client. Role is always read from the sheet.
 */
export async function verifyUserNumberAndLookupUser(userName, number) {
  if (!userName || typeof userName !== "string" || !userName.trim()) {
    return { ok: false, error: "User name is required." };
  }
  if (!number || typeof number !== "string" || !number.trim()) {
    return { ok: false, error: "Authentication number is required." };
  }

  const user = await getUserByNameAndNumber(userName.trim(), number.trim());

  if (!user) {
    return {
      ok: false,
      error: "Invalid name or authentication number. Please check your credentials.",
    };
  }

  if (String(user.status || "").trim().toLowerCase() !== "active") {
    return { ok: false, error: "Your account is currently inactive. Please contact the administrator." };
  }

  const roleConfig = getRoleConfig(user.role);

  return {
    ok: true,
    user: {
      user_id: user.user_id,
      name:    user.name,
      number:  user.number,
      email:   user.email || "",
      role:    user.role,
      status:  user.status,
    },
    role:    user.role,
    roleId:  roleConfig ? roleConfig.id : "USER",
    canSign: roleConfig ? roleConfig.canSign : true,
  };
}

/**
 * Authenticate a field staff member (Tier 2) by free-text name entry.
 * No pre-registration in the SECOND SHEET required.
 * Used for: Technical Executive, Site Engineer, Customer.
 *
 * These roles rotate frequently — we capture the name for accountability
 * but do NOT verify against a pre-existing user record.
 */
export function authenticateFieldStaff(name, role) {
  if (!name || typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Your name is required." };
  }
  if (!role || typeof role !== "string" || !role.trim()) {
    return { ok: false, error: "Role is required." };
  }

  // Validate that the declared role IS a field staff role
  if (!isFieldStaffRole(role)) {
    return {
      ok: false,
      error: `Role "${role}" is not a field staff role. Please use individual authentication number login.`,
    };
  }

  const roleConfig = getRoleConfig(role);
  if (!roleConfig) {
    return { ok: false, error: `Unknown role: ${role}` };
  }

  // Generate a transient field-staff user ID (not stored in sheet)
  const ts = Date.now().toString(36).toUpperCase();
  const fieldUserId = `FIELD-${roleConfig.id}-${ts}`;

  return {
    ok: true,
    user: {
      user_id: fieldUserId,
      name:    name.trim(),
      number:  "",
      email:   "",
      role:    roleConfig.label,
      status:  "Active",
    },
    role:    roleConfig.label,
    roleId:  roleConfig.id,
    canSign: roleConfig.canSign,
  };
}
