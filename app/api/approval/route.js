import { NextResponse } from "next/server";
import { getInspection, getAllInspections, upsertInspection } from "../../../lib/store";

export const dynamic = "force-dynamic";

// Standard role identifiers
const ROLE_MAP = {
  "Site Engineer": "SITE_ENGINEER",
  "Customer": "CUSTOMER",
  "Technical Executive": "TECHNICAL_EXECUTIVE",
  "QA/QC In-Charge": "QA_QC",
  "Project Manager": "PROJECT_MANAGER",
  "GM – HUG": "GM_HUG",
  "VP – HUG": "VP_HUG",
};

// Role Authentication Passcodes (Customer & Technical Executive do NOT require passcode)
const ROLE_PASSCODES = {
  "SITE_ENGINEER": "1818",
  "QA_QC": "2020",
  "PROJECT_MANAGER": "3030",
  "GM_HUG": "4040",
  "VP_HUG": "5050",
};

// Sequential stage requirement mapping
const REQUIRED_PREVIOUS_STATUS = {
  "QA_QC": "QA_QC_PENDING",
  "PROJECT_MANAGER": "PROJECT_MANAGER_PENDING",
  "GM_HUG": "GM_HUG_PENDING",
  "VP_HUG": "VP_HUG_PENDING",
};

// Next status upon approval
const NEXT_STATUS = {
  "SITE_ENGINEER": "QA_QC_PENDING",
  "QA_QC": "PROJECT_MANAGER_PENDING",
  "PROJECT_MANAGER": "GM_HUG_PENDING",
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
    const normalizedRole = ROLE_MAP[roleParam] || roleParam;

    let filtered = all;

    // Special lookup for re-inspection feature: find all inspections for a specific project+unit
    if (roleParam === "all_for_unit") {
      const projectFilter = searchParams.get("project") || "";
      const unitFilter = searchParams.get("unit") || "";
      filtered = all.filter((i) =>
        (!projectFilter || i.projectName === projectFilter) &&
        (!unitFilter || i.unitNumber === unitFilter)
      );
    } else if (normalizedRole === "QA_QC") {
      filtered = all.filter((i) => i.workflowStatus === "QA_QC_PENDING");
    } else if (normalizedRole === "PROJECT_MANAGER") {
      filtered = all.filter((i) => i.workflowStatus === "PROJECT_MANAGER_PENDING");
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
    return NextResponse.json({ error: e.message || "Failed to fetch approvals queue" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { inspectionId, role, userName, action, comments = "", signature = "", passcode = "" } = body;

    if (!inspectionId || !role || !userName || !action) {
      return NextResponse.json(
        { error: "Missing required parameters: inspectionId, role, userName, and action are required." },
        { status: 400 }
      );
    }

    const inspection = await getInspection(inspectionId);
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const normalizedRole = ROLE_MAP[role] || role;
    const requiredPasscode = ROLE_PASSCODES[normalizedRole];

    // Enforce role passcode authentication for roles requiring passcodes
    if (requiredPasscode && passcode !== requiredPasscode) {
      return NextResponse.json(
        { error: `Invalid passcode for ${role}. Please enter the correct PIN.` },
        { status: 401 }
      );
    }

    const currentStatus = inspection.workflowStatus || "DRAFT";

    if (currentStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "This inspection has already been fully approved and completed." },
        { status: 400 }
      );
    }

    // Role-based state machine verification
    if (action === "approve" || action === "sign") {
      if (REQUIRED_PREVIOUS_STATUS[normalizedRole]) {
        const required = REQUIRED_PREVIOUS_STATUS[normalizedRole];
        if (currentStatus !== required) {
          return NextResponse.json(
            { error: `Unauthorized approval attempt: Inspection must be in ${required} stage before ${role} can approve.` },
            { status: 403 }
          );
        }
      }
    }

    // Enforce mandatory Customer AND Technical Executive signature gate before stage advancement past Site Engineer
    if (action === "approve") {
      if (["QA_QC", "PROJECT_MANAGER", "GM_HUG", "VP_HUG"].includes(normalizedRole)) {
        const hasCustomer = !!(inspection.signatures && inspection.signatures.customer);
        const hasTechExec = !!(inspection.signatures && inspection.signatures.technicalExecutive);
        if (!hasCustomer || !hasTechExec) {
          const missing = [];
          if (!hasCustomer) missing.push("Customer Sign");
          if (!hasTechExec) missing.push("Technical Executive Sign");
          return NextResponse.json(
            { error: `Cannot advance approval stage. Missing required signature(s): ${missing.join(" & ")}. Both Customer Sign and Technical Executive Sign are mandatory.` },
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
      inspection.rejectedRole = role;
    } else if (normalizedRole === "CUSTOMER" || normalizedRole === "TECHNICAL_EXECUTIVE") {
      // Parallel signature actions do not alter the sequential workflow stage
      newStatus = currentStatus;
    } else {
      newStatus = NEXT_STATUS[normalizedRole] || currentStatus;
    }

    // Key signatures storage
    const sigKeyMap = {
      "Customer": "customer",
      "Site Engineer": "siteEngineer",
      "QA/QC In-Charge": "qaqc",
      "Project Manager": "projectManager",
      "Technical Executive": "technicalExecutive",
      "Manager Technical": "managerTechnical",
      "GM – HUG": "gmHug",
      "VP – HUG": "vpHug",
      "CUSTOMER": "customer",
      "SITE_ENGINEER": "siteEngineer",
      "QA_QC": "qaqc",
      "PROJECT_MANAGER": "projectManager",
      "TECHNICAL_EXECUTIVE": "technicalExecutive",
      "GM_HUG": "gmHug",
      "VP_HUG": "vpHug",
    };

    const sigKey = sigKeyMap[role] || sigKeyMap[normalizedRole];
    if (sigKey && signature) {
      if (!inspection.signatures) inspection.signatures = {};
      inspection.signatures[sigKey] = signature;
    }

    const auditRecord = {
      id: Math.random().toString(36).substring(2, 9),
      inspectionId,
      project: inspection.projectName || "",
      unit: inspection.unitNumber || "",
      inspectionType: inspection.inspectionType || "IJI",
      role,
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
    return NextResponse.json({ error: e.message || "Failed to process approval" }, { status: 500 });
  }
}
