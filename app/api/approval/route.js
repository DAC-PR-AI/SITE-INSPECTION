import { NextResponse } from "next/server";
import { getInspection, getAllInspections, upsertInspection } from "../../../lib/store";
import { getRoleConfig } from "../../../lib/auth";
import { getSessionUser } from "../../../lib/session";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import {
  WORKFLOW_STATES,
  getSpotSignatureState,
  getNextWorkflowState,
  canUserPerformAction,
  createAuditRecord,
} from "../../../lib/workflow";

export const dynamic = "force-dynamic";

// Max allowed signature payload size (~500 KB as base64)
const MAX_SIGNATURE_BYTES = 512 * 1024;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role") || "";
    const inspectionId = searchParams.get("inspectionId");

    if (inspectionId) {
      const item = await getInspection(inspectionId);
      if (!item) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
      return NextResponse.json({ inspection: item });
    }

    const all = (await getAllInspections()) || [];
    const roleConfig = getRoleConfig(roleParam);
    const normalizedRole = roleConfig ? roleConfig.id : roleParam;

    let filtered = Array.isArray(all) ? all.filter(Boolean) : [];

    if (roleParam === "all_for_unit") {
      const projectFilter = searchParams.get("project") || "";
      const unitFilter = searchParams.get("unit") || "";
      filtered = filtered.filter((i) =>
        Boolean(i) &&
        (!projectFilter || i.projectName === projectFilter) &&
        (!unitFilter || i.unitNumber === unitFilter)
      );
    }

    return NextResponse.json({ inspections: filtered });
  } catch (e) {
    console.error("[approval] GET error:", e);
    return NextResponse.json({ inspections: [] });
  }
}

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    const { inspectionId, action, comments = "", signature = "" } = body || {};

    if (!inspectionId || !action) {
      return NextResponse.json(
        { error: "Missing required parameters: inspectionId and action are required." },
        { status: 400 }
      );
    }

    if (signature && signature.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json({ error: "Signature payload exceeds maximum allowed size." }, { status: 413 });
    }

    if (signature && typeof signature === "string" && signature.startsWith("data:") && !signature.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid signature format." }, { status: 400 });
    }

    // ── Server-side session authentication ───────────────────────────────
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Authentication required. Please log in to the portal." },
        { status: 401 }
      );
    }

    const role = sessionUser.role;
    const userName = sessionUser.name || role;
    const roleConfig = getRoleConfig(role);

    if (!roleConfig) {
      return NextResponse.json({ error: "Your role is not recognised. Please contact the administrator." }, { status: 403 });
    }

    if (roleConfig.id === "ADMIN") {
      return NextResponse.json({ error: "Admin role cannot sign individual inspection boxes." }, { status: 403 });
    }

    // Rate limit check (keyed to IP + role)
    const { limited, resetInMs } = checkRateLimit(ip, roleConfig.id);
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json({ error: `Too many attempts. Try again in ${minutes} minute(s).` }, { status: 429 });
    }

    clearRateLimit(ip, roleConfig.id);

    const inspection = await getInspection(inspectionId);
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const currentStatus = inspection.workflowStatus || WORKFLOW_STATES.DRAFT;

    if (currentStatus === WORKFLOW_STATES.COMPLETED) {
      return NextResponse.json({ error: "This inspection has already been fully approved and completed." }, { status: 400 });
    }

    // Validate Level 1 signature gate (Technical Executive + Customer)
    const { isLevel1Complete } = getSpotSignatureState(inspection);
    const normalizedRole = roleConfig.id;

    if (normalizedRole === "SITE_ENGINEER") {
      if (!isLevel1Complete) {
        return NextResponse.json(
          { error: "Level 1 signatures incomplete. Both Technical Executive and Customer must sign before Site Engineer can sign." },
          { status: 400 }
        );
      }
    }

    if (["QA_QC", "PROJECT_MANAGER", "MANAGER_TECHNICAL", "GM_HUG", "VP_HUG"].includes(normalizedRole)) {
      if (!isLevel1Complete) {
        return NextResponse.json(
          { error: "Level 1 signatures incomplete. Both Technical Executive and Customer must sign before approval." },
          { status: 400 }
        );
      }

      const hasSiteEngineerSigned =
        !!inspection?.signatures?.siteEngineer ||
        [
          WORKFLOW_STATES.SITE_ENGINEER_APPROVED,
          WORKFLOW_STATES.QA_QC_PENDING,
          WORKFLOW_STATES.QA_QC_APPROVED,
          WORKFLOW_STATES.PROJECT_MANAGER_PENDING,
          WORKFLOW_STATES.PROJECT_MANAGER_APPROVED,
          WORKFLOW_STATES.MANAGER_TECHNICAL_PENDING,
          WORKFLOW_STATES.MANAGER_TECHNICAL_APPROVED,
          WORKFLOW_STATES.GM_HUG_PENDING,
          WORKFLOW_STATES.GM_HUG_APPROVED,
          WORKFLOW_STATES.VP_HUG_PENDING,
          WORKFLOW_STATES.COMPLETED,
        ].includes(currentStatus);

      if (!hasSiteEngineerSigned) {
        return NextResponse.json(
          { error: `Level 2 signature incomplete. Site Engineer must sign off before ${roleConfig.label} can approve.` },
          { status: 403 }
        );
      }
    }

    const effectiveAction =
      normalizedRole === "CUSTOMER" || normalizedRole === "TECHNICAL_EXECUTIVE" ? "spot_sign" : action;

    if (!canUserPerformAction(roleConfig.label, effectiveAction, inspection)) {
      return NextResponse.json(
        { error: `Out-of-order action forbidden. Role ${roleConfig.label} cannot process inspection at status ${currentStatus}.` },
        { status: 403 }
      );
    }

    // Rejection reason check
    if (action === "reject" && !comments.trim()) {
      return NextResponse.json({ error: "Rejection reason is mandatory." }, { status: 400 });
    }

    // Assign signature to signatures map if provided
    const sigKey = roleConfig.sigKey;
    if (sigKey && signature) {
      if (!inspection.signatures) inspection.signatures = {};
      inspection.signatures[sigKey] = {
        role: roleConfig.label,
        signer: userName,
        // Include individual identity in signature record
        userId:   sessionUser.user_id || "",
        userNumber: sessionUser.number || "",
        status: "signed",
        dataUrl: signature,
        date: new Date().toLocaleDateString("en-GB"),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        timestamp: new Date().toISOString(),
      };
    }

    const newStatus = getNextWorkflowState(currentStatus, effectiveAction, roleConfig.label, inspection);

    // Create Audit Entry — including individual identity from session
    const auditRecord = createAuditRecord({
      inspectionId,
      projectName: inspection.projectName || "",
      unitNumber: inspection.unitNumber || "",
      inspectionType: inspection.inspectionType || "INTERIOR JOINT INSPECTION",
      userId: sessionUser.user_id || "",
      userNumber: sessionUser.number || "",
      role: roleConfig.label,
      userName,
      action: action.toUpperCase(),
      status: newStatus,
      comments,
      signature: signature || null,
    });

    if (!inspection.approvalHistory) inspection.approvalHistory = [];
    inspection.approvalHistory.push(auditRecord);

    inspection.workflowStatus = newStatus;
    inspection.latestAuditRecord = auditRecord;

    await upsertInspection(inspection, { submitting: newStatus !== WORKFLOW_STATES.DRAFT });

    return NextResponse.json({
      ok: true,
      workflowStatus: newStatus,
      inspection,
    });
  } catch (e) {
    console.error("[approval] POST error:", e);
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
  }
}
