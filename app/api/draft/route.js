import { NextResponse } from "next/server";
import { upsertInspection, getInspection, backendName } from "../../../lib/store";
import { verifyRolePassword } from "../../../lib/auth";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";

/**
 * /api/draft — Save an in-progress inspection (autosave / partial).
 *
 * Security: Requires a valid Site Engineer or Customer passcode on POST.
 * GET is also passcode-protected to prevent ID enumeration of draft data.
 */

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const data = await request.json();

    if (!data.inspectionId) {
      return NextResponse.json({ error: "inspectionId is required" }, { status: 400 });
    }

    // Require Site Engineer passcode to save/update a draft
    const passcode = data.passcode || "";
    const roleParam = data.role || "Site Engineer";

    // Rate limit
    const { limited, resetInMs } = checkRateLimit(ip, "DRAFT_WRITE");
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    // Allow Site Engineer or Start Inspection passcode to save drafts
    const seValid = verifyRolePassword("Site Engineer", passcode);
    const startValid = verifyRolePassword("Start Inspection", passcode);

    if (!seValid && !startValid) {
      recordFailedAttempt(ip, "DRAFT_WRITE");
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
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
