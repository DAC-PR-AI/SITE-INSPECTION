import { NextResponse } from "next/server";
import { getInspection, getAllInspections, upsertInspection } from "../../../lib/store";
import { verifyRolePassword, getRoleConfig } from "../../../lib/auth";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from "../../../lib/rateLimit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Max allowed signature payload size in bytes (~500 KB as base64)
const MAX_SIGNATURE_BYTES = 512 * 1024;

// Sequential stage requirement mapping
const REQUIRED_PREVIOUS_STATUS = {
  "QA_QC": "QA_QC_PENDING",
  "PROJECT_MANAGER": "PROJECT_MANAGER_PENDING",
  "MANAGER_TECHNICAL": "MANAGER_TECHNICAL_PENDING",
  "GM_HUG": "GM_HUG_PENDING",
  "VP_HUG": "VP_HUG_PENDING",
};

// Next status upon approval
const NEXT_STATUS = {
  "SITE_ENGINEER": "QA_QC_PENDING",
  "QA_QC": "PROJECT_MANAGER_PENDING",
  "PROJECT_MANAGER": "MANAGER_TECHNICAL_PENDING",
  "MANAGER_TECHNICAL": "GM_HUG_PENDING",
  "GM_HUG": "VP_HUG_PENDING",
  "VP_HUG": "COMPLETED",
};

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

    const all = await getAllInspections();
    const roleConfig = getRoleConfig(roleParam);
    const normalizedRole = roleConfig ? roleConfig.id : roleParam;

    let filtered = all;

    // Special lookup for re-inspection feature: find all inspections for a specific project+unit
    if (roleParam === "all_for_unit") {
      const projectFilter = searchParams.get("project") || "";
      const unitFilter = searchParams.get("unit") || "";
      filtered = all.filter((i) =>
        (!projectFilter || i.projectName === projectFilter) &&
        (!unitFilter || i.unitNumber === unitFilter)
      );
    } else if (normalizedRole === "ADMIN" || roleParam === "all" || roleParam === "Admin") {
      // Admin sees ALL inspections across all statuses
      filtered = all;
    } else if (normalizedRole === "QA_QC") {
      filtered = all.filter((i) => i.workflowStatus === "QA_QC_PENDING");
    } else if (normalizedRole === "PROJECT_MANAGER") {
      filtered = all.filter((i) => i.workflowStatus === "PROJECT_MANAGER_PENDING");
    } else if (normalizedRole === "MANAGER_TECHNICAL") {
      filtered = all.filter((i) => i.workflowStatus === "MANAGER_TECHNICAL_PENDING" || (!i.signatures?.managerTechnical && ["MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING"].includes(i.workflowStatus)));
    } else if (normalizedRole === "GM_HUG") {
      filtered = all.filter((i) => i.workflowStatus === "GM_HUG_PENDING");
    } else if (normalizedRole === "VP_HUG") {
      filtered = all.filter((i) => i.workflowStatus === "VP_HUG_PENDING");
    } else if (normalizedRole === "CUSTOMER") {
      filtered = all.filter((i) => !i.signatures?.customer);
    } else if (normalizedRole === "TECHNICAL_EXECUTIVE") {
      filtered = all.filter((i) => !i.signatures?.technicalExecutive);
    } else if (normalizedRole === "SITE_ENGINEER") {
      filtered = all.filter((i) => ["DRAFT", "SITE_ENGINEER_PENDING", "REJECTED"].includes(i.workflowStatus || i.status));
    }

    return NextResponse.json({ inspections: filtered });
  } catch (e) {
    console.error("[approval] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch approvals queue" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { inspectionId, role, userName, action, comments = "", signature = "", passcode = "" } = body;

    if (!inspectionId || !role || !userName || !action) {
      return NextResponse.json(
        { error: "Missing required parameters: inspectionId, role, userName, and action are required." },
        { status: 400 }
      );
    }

    // Validate signature payload size
    if (signature && signature.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json(
        { error: "Signature payload exceeds maximum allowed size." },
        { status: 413 }
      );
    }

    // Validate signature is a data URI if provided
    if (signature && !signature.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid signature format." },
        { status: 400 }
      );
    }

    const roleConfig = getRoleConfig(role);
    if (!roleConfig) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // Admin cannot sign role signature boxes
    if (roleConfig.id === "ADMIN") {
      return NextResponse.json(
        { error: "Admin role cannot sign individual inspection boxes." },
        { status: 403 }
      );
    }

    // Rate limit check
    const { limited, resetInMs } = checkRateLimit(ip, roleConfig.id);
    if (limited) {
      const minutes = Math.ceil(resetInMs / 60000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    // Verify 6-digit role password
    const isPinValid = verifyRolePassword(role, passcode);
    if (!isPinValid) {
      recordFailedAttempt(ip, roleConfig.id);
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    clearRateLimit(ip, roleConfig.id);

    const inspection = await getInspection(inspectionId);
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const currentStatus = inspection.workflowStatus || "DRAFT";

    if (currentStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "This inspection has already been fully approved and completed." },
        { status: 400 }
      );
    }

    const normalizedRole = roleConfig.id;

    // Role-based state machine verification for sequential stages
    if (action === "approve" || action === "sign") {
      if (REQUIRED_PREVIOUS_STATUS[normalizedRole]) {
        const required = REQUIRED_PREVIOUS_STATUS[normalizedRole];
        if (currentStatus !== required) {
          return NextResponse.json(
            { error: `Inspection is not at the correct stage for this approval.` },
            { status: 403 }
          );
        }
      }
    }

    // Enforce mandatory Customer AND Technical Executive signature gate before stage advancement past Site Engineer
    if (action === "approve") {
      if (["QA_QC", "PROJECT_MANAGER", "MANAGER_TECHNICAL", "GM_HUG", "VP_HUG"].includes(normalizedRole)) {
        const hasCustomer = !!(inspection.signatures && inspection.signatures.customer);
        const hasTechExec = !!(inspection.signatures && inspection.signatures.technicalExecutive);
        if (!hasCustomer || !hasTechExec) {
          const missing = [];
          if (!hasCustomer) missing.push("Customer Sign");
          if (!hasTechExec) missing.push("Technical Executive Sign");
          return NextResponse.json(
            { error: `Cannot advance approval stage. Missing required signature(s): ${missing.join(" & ")}.` },
            { status: 400 }
          );
        }
      }
    }

    if (action === "reject" && !comments.trim()) {
      return NextResponse.json({ error: "Rejection remarks are mandatory." }, { status: 400 });
    }

    const now = new Date();
    const timestampStr = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let newStatus = currentStatus;
    let auditAction = action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Signed";

    if (action === "reject") {
      newStatus = "REJECTED";
      inspection.rejectionReason = comments;
      inspection.rejectedBy = userName;
      inspection.rejectedRole = roleConfig.label;
    } else if (normalizedRole === "CUSTOMER" || normalizedRole === "TECHNICAL_EXECUTIVE") {
      // Parallel signature actions do not alter the sequential workflow stage directly
      newStatus = currentStatus;
    } else {
      newStatus = NEXT_STATUS[normalizedRole] || currentStatus;
    }

    // Role-restricted signature capture: assign ONLY to this role's specific signature key
    const sigKey = roleConfig.sigKey;
    if (sigKey && signature) {
      if (!inspection.signatures) inspection.signatures = {};
      inspection.signatures[sigKey] = signature;
    }

    const auditRecord = {
      id: crypto.randomUUID(),
      inspectionId,
      project: inspection.projectName || "",
      unit: inspection.unitNumber || "",
      inspectionType: inspection.inspectionType || "INTERIOR JOINT INSPECTION",
      role: roleConfig.label,
      userName,
      action: auditAction,
      status: newStatus,
      comments,
      timestamp: timestampStr,
      signature: signature ? "Captured" : "None",
    };

    if (!inspection.approvalHistory) inspection.approvalHistory = [];
    inspection.approvalHistory.push(auditRecord);

    inspection.workflowStatus = newStatus;
    inspection.latestAuditRecord = auditRecord;

    await upsertInspection(inspection, { submitting: newStatus !== "DRAFT" && newStatus !== "REJECTED" });

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
