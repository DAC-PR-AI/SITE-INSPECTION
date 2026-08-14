import { NextResponse } from "next/server";
import { verifyRolePassword, getRoleConfig } from "../../../lib/auth";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
    }
    const { role, pin } = body || {};

    if (!role || !pin) {
      return NextResponse.json(
        { ok: false, error: "Role and PIN are required." },
        { status: 400 }
      );
    }

    const config = getRoleConfig(role);
    if (!config) {
      // Generic response — don't reveal which roles are valid
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // Rate limit check: 5 attempts per IP per role per 15 min
    const { limited, resetInMs } = checkRateLimit(ip, config.id);
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { ok: false, error: `Too many attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    const isValid = verifyRolePassword(role, pin);
    if (!isValid) {
      recordFailedAttempt(ip, config.id);
      // Generic error — do NOT confirm which part (role vs. PIN) was wrong
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    clearRateLimit(ip, config.id);
    return NextResponse.json({
      ok: true,
      role: config.name,
      roleId: config.id,
      canSign: config.canSign,
    });
  } catch (e) {
    console.error("[auth] POST error:", e);
    return NextResponse.json(
      { ok: false, error: "Authentication error." },
      { status: 500 }
    );
  }
}
