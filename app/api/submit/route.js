import { NextResponse } from "next/server";
import { upsertInspection, backendName } from "../../../lib/store";
import { getSessionUser } from "../../../lib/session";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import { WORKFLOW_STATES, getSpotSignatureState } from "../../../lib/workflow";
import { sanitizeInspectionPayload } from "../../../lib/security";
import crypto from "crypto";

/**
 * Roles that are permitted to CREATE / SUBMIT an inspection.
 * ONLY Admin and Technical Executive may start an inspection.
 */
const INSPECTION_CREATOR_ROLES = ["admin", "technical executive"];

function isCreatorRole(role) {
  if (!role) return false;
  return INSPECTION_CREATOR_ROLES.includes(String(role).trim().toLowerCase());
}

/**
 * /api/submit — Final submission of a completed inspection.
 * Requires an authenticated server-side session with Admin or Technical Executive role.
 */
export async function POST(request) {
  try {
    const ip = getClientIp(request);

    // Rate limit check (100 submissions per 15 min window)
    const { limited, resetInMs } = checkRateLimit(ip, "SUBMIT", 100);
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    // ── Server-side session authentication ───────────────────────────────
    const sessionUser = getSessionUser(request);
    if (!sessionUser) {
      recordFailedAttempt(ip, "SUBMIT");
      return NextResponse.json(
        { error: "Authentication required. Please log in to start an inspection." },
        { status: 401 }
      );
    }

    // ── Role authorisation: ONLY Admin and Technical Executive ────────────
    if (!isCreatorRole(sessionUser.role)) {
      return NextResponse.json(
        {
          error: `Access denied. Only Admin and Technical Executive may create inspections. Your role: ${sessionUser.role}.`,
        },
        { status: 403 }
      );
    }

    clearRateLimit(ip, "SUBMIT");

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

    const now = new Date();
    const timestampStr = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    const { isLevel1Complete } = getSpotSignatureState(data);
    const hasSiteEngineerSigned = !!data.signatures?.siteEngineer;
    let targetStatus = WORKFLOW_STATES.SPOT_SIGNATURE_PENDING;
    if (isLevel1Complete && hasSiteEngineerSigned) {
      targetStatus = WORKFLOW_STATES.QA_QC_PENDING;
    } else if (isLevel1Complete) {
      targetStatus = WORKFLOW_STATES.SITE_ENGINEER_PENDING;
    }

    const initialAuditRecord = {
      id: crypto.randomUUID(),
      inspectionId: data.inspectionId,
      project: data.projectName || "",
      unit: data.unitNumber || "",
      inspectionType: data.inspectionType || "IJI",
      // Individual identity from authenticated session
      userId:   sessionUser.user_id || "",
      userNumber: sessionUser.number || "",
      role: sessionUser.role,
      userName: sessionUser.name || sessionUser.role,
      action: "Inspection Created",
      status: targetStatus,
      comments: data.generalRemarks || "Initial inspection form submitted.",
      timestamp: timestampStr,
      signature: "None",
    };

    const approvalHistory = data.approvalHistory || [];
    if (!approvalHistory.some((a) => a.role === sessionUser.role && a.action.includes("Created"))) {
      approvalHistory.push(initialAuditRecord);
    }

    // Strip any client-supplied passcode / sensitive fields before storing
    const { passcode: _p, ...cleanData } = data;

    const updatedData = {
      ...cleanData,
      inspectionType: cleanData.inspectionType || "IJI",
      workflowStatus: targetStatus,
      status: "submitted",
      approvalHistory,
      latestAuditRecord: initialAuditRecord,
    };

    const result = await upsertInspection(updatedData, { submitting: true });
    return NextResponse.json({ ...result, backend: backendName, workflowStatus: targetStatus });
  } catch (err) {
    console.error("[submit] POST error:", err);
    const status = err.code === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return NextResponse.json({ error: "Failed to submit inspection." }, { status });
  }
}
