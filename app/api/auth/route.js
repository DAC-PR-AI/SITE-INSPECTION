import { NextResponse } from "next/server";
import {
  verifyGoogleTokenAndLookupUser,
  verifyUserNumberAndLookupUser,
  verifyUserPasswordAndLookupUser,
  authenticateFieldStaff,
  isFieldStaffRole,
  getRoleConfig,
} from "../../../lib/auth";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import { createSessionCookie, clearSessionCookie, getSessionUser } from "../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth  — return current authenticated user identity from session cookie.
 */
export async function GET(req) {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, authenticated: true, user });
}

/**
 * DELETE /api/auth  — clear session cookie (logout).
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true, message: "Logged out." });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}

/**
 * POST /api/auth  — authenticate and issue a session cookie.
 *
 * Accepts:
 *
 * 1. Password-based authentication against Google Sheets (Primary Method):
 *    { userName: "Raj", password: "TechExec@1001" }  OR  { email: "admin@dac.com", password: "Admin@9990" }
 *
 * 2. Google OAuth Admin login:
 *    { credential: "<Google ID Token>" }
 *
 * 3. Number-based auth fallback:
 *    { userName: "Raj", userNumber: "1001" }
 *
 * 4. Free-text field staff fallback:
 *    { fieldName: "Raj", fieldRole: "Technical Executive" }
 */
export async function POST(req) {
  try {
    const ip = getClientIp(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
    }
    const { credential, userName, userNumber, password, email, fieldName, fieldRole } = body || {};

    // ── PATH 1: Password-based authentication (Sheet column G) ──────────────
    if (password && (userName || email || userNumber)) {
      const targetUser = String(userName || email || userNumber).trim();
      const { limited, resetInMs } = checkRateLimit(ip, "PASSWORD_AUTH");
      if (limited) {
        const minutes = Math.ceil(resetInMs / 60000);
        return NextResponse.json(
          { ok: false, error: `Too many login attempts. Try again in ${minutes} minute(s).` },
          { status: 429 }
        );
      }

      const result = await verifyUserPasswordAndLookupUser(targetUser, String(password).trim());
      if (!result.ok) {
        recordFailedAttempt(ip, "PASSWORD_AUTH");
        return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
      }

      clearRateLimit(ip, "PASSWORD_AUTH");

      const sessionCookie = createSessionCookie(result.user);
      const res = NextResponse.json({
        ok: true,
        user: result.user,
        role: result.role,
        roleId: result.roleId,
        canSign: result.canSign,
      });
      res.headers.set("Set-Cookie", sessionCookie);
      return res;
    }

    // ── PATH 2: Google OAuth Admin login ──────────────────────────────────
    if (credential) {
      const { limited, resetInMs } = checkRateLimit(ip, "GOOGLE_AUTH");
      if (limited) {
        const minutes = Math.ceil(resetInMs / 60000);
        return NextResponse.json(
          { ok: false, error: `Too many login attempts. Try again in ${minutes} minute(s).` },
          { status: 429 }
        );
      }

      const result = await verifyGoogleTokenAndLookupUser(credential);
      if (!result.ok) {
        recordFailedAttempt(ip, "GOOGLE_AUTH");
        return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
      }

      clearRateLimit(ip, "GOOGLE_AUTH");

      const sessionCookie = createSessionCookie(result.user);
      const res = NextResponse.json({
        ok: true,
        user: result.user,
        role: result.role,
        roleId: result.roleId,
        canSign: result.canSign,
      });
      res.headers.set("Set-Cookie", sessionCookie);
      return res;
    }

    // ── PATH 3: Field Staff free-text login ────────────────────────────────
    if (fieldName && fieldRole) {
      if (!isFieldStaffRole(fieldRole)) {
        return NextResponse.json(
          { ok: false, error: `"${fieldRole}" is not a field staff role. Use password login instead.` },
          { status: 400 }
        );
      }

      const result = authenticateFieldStaff(fieldName, fieldRole);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      const sessionCookie = createSessionCookie(result.user);
      const res = NextResponse.json({
        ok: true,
        user: result.user,
        role: result.role,
        roleId: result.roleId,
        canSign: result.canSign,
      });
      res.headers.set("Set-Cookie", sessionCookie);
      return res;
    }

    // ── PATH 4: Number-based login ────────────────────────────────────────
    if (userName && userNumber) {
      const { limited, resetInMs } = checkRateLimit(ip, "USER_NUMBER_AUTH");
      if (limited) {
        const minutes = Math.ceil(resetInMs / 60000);
        return NextResponse.json(
          { ok: false, error: `Too many login attempts. Try again in ${minutes} minute(s).` },
          { status: 429 }
        );
      }

      const result = await verifyUserNumberAndLookupUser(
        String(userName).trim(),
        String(userNumber).trim()
      );

      if (!result.ok) {
        recordFailedAttempt(ip, "USER_NUMBER_AUTH");
        return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
      }

      clearRateLimit(ip, "USER_NUMBER_AUTH");

      const sessionCookie = createSessionCookie(result.user);
      const res = NextResponse.json({
        ok: true,
        user: result.user,
        role: result.role,
        roleId: result.roleId,
        canSign: result.canSign,
      });
      res.headers.set("Set-Cookie", sessionCookie);
      return res;
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Please provide { userName, password } to authenticate.",
      },
      { status: 400 }
    );
  } catch (e) {
    console.error("[auth] POST error:", e);
    return NextResponse.json({ ok: false, error: "Authentication error." }, { status: 500 });
  }
}
