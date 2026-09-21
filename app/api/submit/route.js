import { NextResponse } from "next/server";
import { upsertInspection, backendName } from "../../../lib/store";
import { getSessionUser } from "../../../lib/session";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import { WORKFLOW_STATES, getSpotSignatureState } from "../../../lib/workflow";
import { sanitizeInspectionPayload } from "../../../lib/security";
import { getInspection } from "../../../lib/store";
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
    const { limited, resetInMs } = await checkRateLimit(ip, "SUBMIT", 100);
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
      await recordFailedAttempt(ip, "SUBMIT");
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

    await clearRateLimit(ip, "SUBMIT");

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

    const projectName = (data.projectName || data.project || "").trim();
    const unitNumber = (data.unitNumber || data.unit || "").trim();
    const inspectionType = (data.inspectionType || "").trim() || "INTERIOR JOINT INSPECTION";

    if (!projectName || !unitNumber) {
      return NextResponse.json(
        { error: "Project Name and Unit Number are mandatory to create or submit an inspection." },
        { status: 400 }
      );
    }

    data.projectName = projectName;
    data.unitNumber = unitNumber;
    data.inspectionType = inspectionType;

    // Only the on-site spot signatures (Technical Executive + Customer) may come from the
    // submit payload. Site Engineer and Level 3 signatures are applied via /api/approval,
    // so keep whatever is already stored and ignore any client-supplied ones.
    const SPOT_SIGNATURE_KEYS = ["technicalExecutive", "customer"];
    const existingRecord = await getInspection(data.inspectionId).catch(() => null);
    const trustedSignatures = {};
    for (const [key, value] of Object.entries(existingRecord?.signatures || {})) {
      if (!SPOT_SIGNATURE_KEYS.includes(key)) trustedSignatures[key] = value;
    }
    for (const key of SPOT_SIGNATURE_KEYS) {
      if (data.signatures?.[key]) trustedSignatures[key] = data.signatures[key];
    }
    data.signatures = trustedSignatures;

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
      project: projectName,
      unit: unitNumber,
      inspectionType: inspectionType,
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

    const approvalHistory = Array.isArray(existingRecord?.approvalHistory)
      ? [...existingRecord.approvalHistory]
      : [];
    if (!approvalHistory.some((a) => a.role === sessionUser.role && a.action.includes("Created"))) {
      approvalHistory.push(initialAuditRecord);
    }

    // Strip any client-supplied passcode / sensitive fields before storing
    const { passcode: _p, ...cleanData } = data;

    const updatedData = {
      ...cleanData,
      projectName,
      unitNumber,
      inspectionType,
      workflowStatus: targetStatus,
      status: "submitted",
      submittedAt: existingRecord?.submittedAt || now.toISOString(),
      updatedAt: now.toISOString(),
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
