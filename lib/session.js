/**
 * DAC Inspection App — Secure Session Cookie Utility
 *
 * Sessions are stored as HTTP-only, SameSite=Strict cookies containing
 * a HMAC-SHA256 signed JSON payload. This prevents tampering without
 * a server-side session store.
 *
 * Cookie name: dac_session
 * Payload: { user_id, name, number, email, role, status, iat }
 */

import crypto from "crypto";

const SESSION_COOKIE = "dac_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds

/**
 * Get the session signing secret from environment, or fall back to a
 * deterministic (but non-trivial) default for local dev.
 */
function getSecret() {
  const s = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (s && s.trim().length >= 32) return s.trim();
  // Derive a stable dev secret from the Google credentials so it isn't
  // completely random on every cold boot (still not safe for production).
  const base = (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || "dac-dev-secret") +
               (process.env.GOOGLE_SHEET_ID || "local");
  return crypto.createHash("sha256").update(base).digest("hex");
}

/**
 * Sign a JSON-serialisable payload and return the cookie value string.
 * Format: base64url(json).base64url(hmac)
 */
function signPayload(payload) {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig  = crypto
    .createHmac("sha256", getSecret())
    .update(json)
    .digest("base64url");
  return `${json}.${sig}`;
}

/**
 * Verify and decode a cookie value. Returns null on any failure.
 */
function verifyPayload(cookieValue) {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return null;
  const json = cookieValue.slice(0, dot);
  const sig  = cookieValue.slice(dot + 1);

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(json)
    .digest("base64url");

  // Timing-safe comparison
  try {
    const a = Buffer.from(sig,      "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
    // Verify expiry (iat + SESSION_MAX_AGE)
    if (!payload.iat || Date.now() / 1000 - payload.iat > SESSION_MAX_AGE) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Build a Set-Cookie header string for the session cookie.
 *
 * @param {object} user  { user_id, name, number, email, role, status }
 * @returns {string}     Full Set-Cookie header value
 */
export function createSessionCookie(user) {
  const payload = {
    user_id: user.user_id  || "",
    name:    user.name     || "",
    number:  user.number   || "",
    email:   user.email    || "",
    role:    user.role     || "",
    status:  user.status   || "Active",
    iat:     Math.floor(Date.now() / 1000),
  };
  const value = signPayload(payload);
  const flags = [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    // Omit Secure in dev (Next.js dev server on http://localhost)
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ];
  return flags.join("; ");
}

/**
 * Build a Set-Cookie header value that immediately expires the session cookie.
 * @returns {string}
 */
export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

/**
 * Read and verify the session cookie from an incoming Next.js Request.
 * Returns the decoded user payload or null if missing / invalid / expired.
 *
 * @param {Request} req  Next.js route handler Request object
 * @returns {{ user_id, name, number, email, role, status } | null}
 */
export function getSessionUser(req) {
  try {
    // Next.js 13+ app router: req.cookies is a ReadonlyRequestCookies
    const cookieHeader = req.headers?.get?.("cookie") || "";
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    if (!match) return null;
    const value = match.slice(SESSION_COOKIE.length + 1);
    return verifyPayload(value);
  } catch {
    return null;
  }
}

/**
 * Convenience: check if the authenticated user's role is in an allowed list.
 * @param {object|null} sessionUser
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function hasRole(sessionUser, allowedRoles) {
  if (!sessionUser || !sessionUser.role) return false;
  const r = sessionUser.role.trim().toLowerCase();
  return allowedRoles.some((a) => a.trim().toLowerCase() === r);
}
