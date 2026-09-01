import { NextResponse } from "next/server";
import { upsertInspection, getInspection, backendName } from "../../../lib/store";
import { getSessionUser } from "../../../lib/session";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import { sanitizeInspectionPayload } from "../../../lib/security";

/**
 * /api/draft — Save an in-progress inspection (autosave / partial).
 *
 * Security: Requires an active session cookie (dac_session).
 */

export async function POST(request) {
  try {
    const ip = getClientIp(request);

    // Rate limit check for draft saves (1000 requests per 15 min window)
    const { limited, resetInMs } = checkRateLimit(ip, "DRAFT_WRITE", 1000);
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { error: `Too many draft save attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    // Verify session
    const sessionUser = getSessionUser(request);
    if (!sessionUser) {
      recordFailedAttempt(ip, "DRAFT_WRITE");
      return NextResponse.json(
        { error: "Authentication required to save draft." },
        { status: 401 }
      );
    }

    let data;
    try {
      data = await request.json();
      data = sanitizeInspectionPayload(data);
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!data || !data.inspectionId) {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }

    clearRateLimit(ip, "DRAFT_WRITE");

    // Strip passcode from data before storing
    const { passcode: _p, ...cleanData } = data;
    const result = await upsertInspection(cleanData, { submitting: false });
    return NextResponse.json({ ...result, backend: backendName });
  } catch (err) {
    console.error("[draft] POST error:", err);
    const status = err.code === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return NextResponse.json({ error: "Failed to save draft." }, { status });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionId = searchParams.get("inspectionId");

    if (!inspectionId || typeof inspectionId !== "string") {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }

    const data = await getInspection(inspectionId.trim());
    if (!data) return NextResponse.json({ error: "Inspection draft not found" }, { status: 404 });
    return NextResponse.json({ data, backend: backendName });
  } catch (err) {
    console.error("[draft] GET error:", err);
    return NextResponse.json({ error: "Failed to retrieve draft." }, { status: 500 });
  }
}
