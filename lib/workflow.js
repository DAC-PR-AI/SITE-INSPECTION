/**
 * Centralized DAC Joint Inspection & Key Handover Workflow Engine
 *
 * Required 3-Level Signature Sequence:
 * LEVEL 1 — TECHNICAL EXECUTIVE + CUSTOMER (Spot Signatures on-site)
 *        ↓
 * LEVEL 1 COMPLETED (Both Tech Exec & Customer signatures captured)
 *        ↓
 * LEVEL 2 — SITE ENGINEER (Site Verification & Sign-off)
 *        ↓
 * LEVEL 3 — EXISTING APPROVAL FLOW (QA/QC ➔ PM ➔ Manager Tech ➔ GM HUG ➔ VP HUG)
 *        ↓
 * COMPLETED
 */

export const WORKFLOW_STATES = {
  DRAFT: "DRAFT",
  LEVEL1_PENDING: "SPOT_SIGNATURE_PENDING",
  SPOT_SIGNATURE_PENDING: "SPOT_SIGNATURE_PENDING",
  LEVEL1_COMPLETED: "SPOT_SIGNATURE_COMPLETED",
  SPOT_SIGNATURE_COMPLETED: "SPOT_SIGNATURE_COMPLETED",
  SITE_ENGINEER_PENDING: "SITE_ENGINEER_PENDING",
  SITE_ENGINEER_APPROVED: "SITE_ENGINEER_APPROVED",
  QA_QC_PENDING: "QA_QC_PENDING",
  QA_QC_APPROVED: "QA_QC_APPROVED",
  PROJECT_MANAGER_PENDING: "PROJECT_MANAGER_PENDING",
  PROJECT_MANAGER_APPROVED: "PROJECT_MANAGER_APPROVED",
  MANAGER_TECHNICAL_PENDING: "MANAGER_TECHNICAL_PENDING",
  MANAGER_TECHNICAL_APPROVED: "MANAGER_TECHNICAL_APPROVED",
  GM_HUG_PENDING: "GM_HUG_PENDING",
  GM_HUG_APPROVED: "GM_HUG_APPROVED",
  VP_HUG_PENDING: "VP_HUG_PENDING",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  RECHECK_REQUIRED: "RECHECK_REQUIRED",
};

export const WORKFLOW_STAGES = [
  { id: "technicalExecutive", label: "Technical Executive", type: "level1", roleName: "Technical Executive", subtitle: "Level 1 — Technical Inspection Sign-off" },
  { id: "customer", label: "Customer", type: "level1", roleName: "Customer", subtitle: "Level 1 — Customer Handover Sign-off" },
  { id: "siteEngineer", label: "Site Engineer", type: "level2", roleName: "Site Engineer", subtitle: "Level 2 — Site Verification & Sign-off" },
  { id: "qaqc", label: "QA / QC In-Charge", type: "level3", roleName: "QA/QC In-Charge", subtitle: "Level 3 — Quality Compliance & Defect Validation" },
  { id: "projectManager", label: "Project Manager", type: "level3", roleName: "Project Manager", subtitle: "Level 3 — Project Level Approval" },
  { id: "managerTechnical", label: "Manager – Technical", type: "level3", roleName: "Manager Technical", subtitle: "Level 3 — Technical Directorate Review" },
  { id: "gmHug", label: "GM – HUG", type: "level3", roleName: "GM – HUG", subtitle: "Level 3 — General Manager Approval" },
  { id: "vpHug", label: "VP – HUG", type: "level3", roleName: "VP – HUG", subtitle: "Level 3 — Vice President Final Approval" },
];

/**
 * Validate Level 1 Signatures (Technical Executive + Customer)
 */
export function getSpotSignatureState(inspection) {
  const signatures = inspection?.signatures || {};
  const hasCustomerSigned = !!signatures.customer;
  const hasTechExecSigned = !!signatures.technicalExecutive;
  const isSpotComplete = hasCustomerSigned && hasTechExecSigned;
  const isLevel1Complete = isSpotComplete;

  let spotStatusMessage = "Level 1 signatures incomplete";
  if (isLevel1Complete) {
    spotStatusMessage = "Level 1 signatures completed (Technical Executive + Customer)";
  } else if (!hasCustomerSigned && !hasTechExecSigned) {
    spotStatusMessage = "Missing Level 1 Signatures: Both Technical Executive & Customer must sign";
  } else if (!hasTechExecSigned) {
    spotStatusMessage = "Missing Level 1 Signature: Technical Executive must sign";
  } else if (!hasCustomerSigned) {
    spotStatusMessage = "Missing Level 1 Signature: Customer must sign";
  }

  return {
    hasCustomerSigned,
    hasTechExecSigned,
    isSpotComplete,
    isLevel1Complete,
    spotStatusMessage,
  };
}

/**
 * Check if a given role can perform an action (approve, reject, recheck, spot_sign)
 */
export function canUserPerformAction(roleLabel, action, inspection) {
  const { isLevel1Complete } = getSpotSignatureState(inspection);
  const currentStatus = inspection?.workflowStatus || WORKFLOW_STATES.DRAFT;
  const role = (roleLabel || "").trim();

  // 1. Level 1 Roles: Technical Executive & Customer
  if (role === "Customer" || role === "TECHNICAL_EXECUTIVE" || role === "Technical Executive" || role === "Technical") {
    if (action === "spot_sign" || action === "sign") return true;
    return false; // Level 1 roles cannot sign internal approval stages
  }

  // Internal actions: approve, reject, recheck
  if (!["approve", "reject", "recheck"].includes(action)) return false;

  // 🔴 STRICT GATE: Level 1 must be COMPLETE before any Level 2 or Level 3 action!
  if (!isLevel1Complete) return false;

  // 2. Level 2 Role: Site Engineer
  if (role === "Site Engineer" || role === "SITE_ENGINEER") {
    return [
      WORKFLOW_STATES.DRAFT,
      WORKFLOW_STATES.SPOT_SIGNATURE_COMPLETED,
      WORKFLOW_STATES.SITE_ENGINEER_PENDING,
      WORKFLOW_STATES.RECHECK_REQUIRED,
      WORKFLOW_STATES.REJECTED,
    ].includes(currentStatus);
  }

  // 🔴 STRICT GATE: Site Engineer MUST HAVE APPROVED before Level 3 roles can act!
  const hasSiteEngineerSigned = !!inspection?.signatures?.siteEngineer || [
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
    WORKFLOW_STATES.COMPLETED
  ].includes(currentStatus);

  if (!hasSiteEngineerSigned) return false;

  // 3. Level 3 Roles: QA / QC In-Charge
  if (role === "QA/QC In-Charge" || role === "QA_QC" || role === "QA/QC") {
    return currentStatus === WORKFLOW_STATES.QA_QC_PENDING || currentStatus === WORKFLOW_STATES.SITE_ENGINEER_APPROVED;
  }

  // 4. Level 3 Roles: Project Manager
  if (role === "Project Manager" || role === "PROJECT_MANAGER") {
    return currentStatus === WORKFLOW_STATES.PROJECT_MANAGER_PENDING || currentStatus === WORKFLOW_STATES.QA_QC_APPROVED;
  }

  // 5. Level 3 Roles: Manager Technical
  if (role === "Manager Technical" || role === "Manager – Technical" || role === "MANAGER_TECHNICAL") {
    return currentStatus === WORKFLOW_STATES.MANAGER_TECHNICAL_PENDING || currentStatus === WORKFLOW_STATES.PROJECT_MANAGER_APPROVED;
  }

  // 6. Level 3 Roles: GM – HUG
  if (role === "GM – HUG" || role === "GM - HUG" || role === "GM_HUG") {
    return currentStatus === WORKFLOW_STATES.GM_HUG_PENDING || currentStatus === WORKFLOW_STATES.MANAGER_TECHNICAL_APPROVED;
  }

  // 7. Level 3 Roles: VP – HUG
  if (role === "VP – HUG" || role === "VP - HUG" || role === "VP_HUG") {
    return currentStatus === WORKFLOW_STATES.VP_HUG_PENDING || currentStatus === WORKFLOW_STATES.GM_HUG_APPROVED;
  }

  // Admin Override
  if (role === "Admin" || role === "ADMIN") {
    return true;
  }

  return false;
}

/**
 * Determine Next Workflow State based on signature sequence
 */
export function getNextWorkflowState(currentStatus, action, roleLabel, inspection) {
  if (action === "reject") {
    return WORKFLOW_STATES.REJECTED;
  }

  if (action === "recheck") {
    return WORKFLOW_STATES.RECHECK_REQUIRED;
  }

  const { isLevel1Complete } = getSpotSignatureState(inspection);

  if (action === "spot_sign" || action === "sign") {
    if (isLevel1Complete) {
      return WORKFLOW_STATES.SITE_ENGINEER_PENDING;
    }
    return WORKFLOW_STATES.SPOT_SIGNATURE_PENDING;
  }

  if (action === "approve") {
    if (!isLevel1Complete) {
      return WORKFLOW_STATES.SPOT_SIGNATURE_PENDING;
    }

    const role = (roleLabel || "").trim();

    if (role === "Site Engineer" || role === "SITE_ENGINEER") {
      return WORKFLOW_STATES.QA_QC_PENDING;
    }
    if (role === "QA/QC In-Charge" || role === "QA_QC" || role === "QA/QC") {
      return WORKFLOW_STATES.PROJECT_MANAGER_PENDING;
    }
    if (role === "Project Manager" || role === "PROJECT_MANAGER") {
      return WORKFLOW_STATES.MANAGER_TECHNICAL_PENDING;
    }
    if (role === "Manager Technical" || role === "Manager – Technical" || role === "MANAGER_TECHNICAL") {
      return WORKFLOW_STATES.GM_HUG_PENDING;
    }
    if (role === "GM – HUG" || role === "GM - HUG" || role === "GM_HUG") {
      return WORKFLOW_STATES.VP_HUG_PENDING;
    }
    if (role === "VP – HUG" || role === "VP - HUG" || role === "VP_HUG") {
      return WORKFLOW_STATES.COMPLETED;
    }
  }

  return currentStatus;
}

/**
 * Format Audit Entry
 */
export function createAuditRecord({
  inspectionId,
  projectName = "",
  unitNumber = "",
  inspectionType = "INTERIOR JOINT INSPECTION",
  userId = "",
  userNumber = "",
  role = "",
  userName = "",
  action = "Signed",
  status = "",
  comments = "",
  signature = null,
}) {
  const now = new Date();
  const timestampStr = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    inspectionId,
    project: projectName,
    unit: unitNumber,
    inspectionType,
    userId: userId || "",
    userNumber: userNumber || "",
    role,
    userName,
    action,
    status,
    comments: comments || "",
    timestamp: timestampStr,
    signatureCaptured: !!signature,
    createdAt: now.toISOString(),
  };
}

/**
 * Calculates workflow progression, responsible role, and pending action for any inspection
 */
export function getInspectionWorkflowInfo(inspection, selectedRole) {
  if (!inspection) return { isPendingOnYou: false, displayStatus: "DRAFT", currentPendingRole: "Site Engineer", actionType: "view" };

  const currentStatus = (inspection.workflowStatus || inspection.status || "DRAFT").toUpperCase();
  const signatures = inspection.signatures || {};

  const hasCustomer = !!signatures.customer && (signatures.customer === "SIGNED" || signatures.customer.status === "signed" || !!signatures.customer.dataUrl || (typeof signatures.customer === "string" && signatures.customer.startsWith("data:")));
  const hasTechExec = !!signatures.technicalExecutive && (signatures.technicalExecutive === "SIGNED" || signatures.technicalExecutive.status === "signed" || !!signatures.technicalExecutive.dataUrl || (typeof signatures.technicalExecutive === "string" && signatures.technicalExecutive.startsWith("data:")));
  const hasSiteEng = !!signatures.siteEngineer && (signatures.siteEngineer === "SIGNED" || signatures.siteEngineer.status === "signed" || !!signatures.siteEngineer.dataUrl || (typeof signatures.siteEngineer === "string" && signatures.siteEngineer.startsWith("data:")));
  const hasQaqc = !!signatures.qaqc && (signatures.qaqc === "SIGNED" || signatures.qaqc.status === "signed" || !!signatures.qaqc.dataUrl || (typeof signatures.qaqc === "string" && signatures.qaqc.startsWith("data:")));
  const hasPm = !!signatures.projectManager && (signatures.projectManager === "SIGNED" || signatures.projectManager.status === "signed" || !!signatures.projectManager.dataUrl || (typeof signatures.projectManager === "string" && signatures.projectManager.startsWith("data:")));
  const hasManTech = !!signatures.managerTechnical && (signatures.managerTechnical === "SIGNED" || signatures.managerTechnical.status === "signed" || !!signatures.managerTechnical.dataUrl || (typeof signatures.managerTechnical === "string" && signatures.managerTechnical.startsWith("data:")));
  const hasGm = !!signatures.gmHug && (signatures.gmHug === "SIGNED" || signatures.gmHug.status === "signed" || !!signatures.gmHug.dataUrl || (typeof signatures.gmHug === "string" && signatures.gmHug.startsWith("data:")));
  const hasVp = !!signatures.vpHug && (signatures.vpHug === "SIGNED" || signatures.vpHug.status === "signed" || !!signatures.vpHug.dataUrl || (typeof signatures.vpHug === "string" && signatures.vpHug.startsWith("data:")));

  const bothParallelSigned = hasCustomer && hasTechExec;

  let isCompleted = currentStatus === "COMPLETED" || (bothParallelSigned && hasSiteEng && hasQaqc && hasPm && hasManTech && hasGm && hasVp);
  let isRejected = currentStatus === "REJECTED";

  // Determine current pending stage / role
  let currentPendingRole = "Site Engineer";
  let displayStatus = "Waiting";

  if (isCompleted) {
    displayStatus = "Completed";
    currentPendingRole = "None (Completed)";
  } else if (isRejected) {
    displayStatus = "Rejected";
    currentPendingRole = "Site Engineer (Rectification Required)";
  } else if (!hasTechExec && !hasCustomer) {
    currentPendingRole = "Technical Executive & Customer";
    displayStatus = "Level 1 Signatures Pending";
  } else if (!hasTechExec) {
    currentPendingRole = "Technical Executive";
    displayStatus = "Technical Executive Sign Pending (Level 1)";
  } else if (!hasCustomer) {
    currentPendingRole = "Customer";
    displayStatus = "Customer Sign Pending (Level 1)";
  } else if (!hasSiteEng || ["DRAFT", "SITE_ENGINEER_PENDING", "SPOT_SIGNATURE_COMPLETED", "SPOT_SIGNATURE_PENDING"].includes(currentStatus)) {
    currentPendingRole = "Site Engineer";
    displayStatus = "Site Engineer Review (Level 2)";
  } else if (!hasQaqc || currentStatus === "QA_QC_PENDING" || currentStatus === "SITE_ENGINEER_APPROVED") {
    currentPendingRole = "QA/QC In-Charge";
    displayStatus = "QA/QC Approval (Level 3)";
  } else if (!hasPm || currentStatus === "PROJECT_MANAGER_PENDING" || currentStatus === "QA_QC_APPROVED") {
    currentPendingRole = "Project Manager";
    displayStatus = "Project Manager Approval (Level 3)";
  } else if (!hasManTech || currentStatus === "MANAGER_TECHNICAL_PENDING" || currentStatus === "PROJECT_MANAGER_APPROVED") {
    currentPendingRole = "Manager Technical";
    displayStatus = "Manager Technical Approval (Level 3)";
  } else if (!hasGm || currentStatus === "GM_HUG_PENDING" || currentStatus === "MANAGER_TECHNICAL_APPROVED") {
    currentPendingRole = "GM – HUG";
    displayStatus = "GM – HUG Approval (Level 3)";
  } else if (!hasVp || currentStatus === "VP_HUG_PENDING" || currentStatus === "GM_HUG_APPROVED") {
    currentPendingRole = "VP – HUG";
    displayStatus = "VP – HUG Final Approval (Level 3)";
  }

  // Determine if action is pending on the currently selected role
  let isPendingOnYou = false;
  let actionLabel = "Review & Approve";
  let actionButtonText = "REVIEW & APPROVE";
  let actionRoleName = selectedRole;

  if ((selectedRole === "Technical Executive" || selectedRole === "Technical") && !hasTechExec && !isCompleted && !isRejected) {
    isPendingOnYou = true;
    actionLabel = "Level 1 — Technical Executive Signature Required";
    actionButtonText = "SIGN (LEVEL 1)";
  } else if (selectedRole === "Customer" && !hasCustomer && !isCompleted && !isRejected) {
    isPendingOnYou = true;
    actionLabel = "Level 1 — Customer Signature Required";
    actionButtonText = "SIGN (LEVEL 1)";
  } else if (selectedRole === "Site Engineer" && !isCompleted) {
    if (isRejected) {
      isPendingOnYou = true;
      actionLabel = "Rectification Required — Site Engineer Re-Inspection";
      actionButtonText = "RECTIFY & REVIEW";
    } else if (bothParallelSigned && !hasSiteEng) {
      isPendingOnYou = true;
      actionLabel = "Level 2 — Site Engineer Approval Required";
      actionButtonText = "REVIEW & SIGN";
    }
  } else if ((selectedRole === "QA/QC In-Charge" || selectedRole === "QA/QC") && !isCompleted && !isRejected) {
    if (hasSiteEng && !hasQaqc) {
      isPendingOnYou = true;
      actionLabel = "QA/QC Compliance Approval Required";
      actionButtonText = "REVIEW & SIGN";
    }
  } else if (selectedRole === "Project Manager" && !isCompleted && !isRejected) {
    if (hasQaqc && !hasPm) {
      isPendingOnYou = true;
      actionLabel = "Project Manager Approval Required";
      actionButtonText = "REVIEW & APPROVE";
    }
  } else if ((selectedRole === "Manager Technical" || selectedRole === "Manager – Technical") && !isCompleted && !isRejected) {
    if (hasPm && !hasManTech) {
      isPendingOnYou = true;
      actionLabel = "Manager Technical Approval Required";
      actionButtonText = "REVIEW & APPROVE";
    }
  } else if ((selectedRole === "GM – HUG" || selectedRole === "GM - HUG") && !isCompleted && !isRejected) {
    if (hasManTech && !hasGm) {
      isPendingOnYou = true;
      actionLabel = "GM – HUG Approval Required";
      actionButtonText = "REVIEW & APPROVE";
    }
  } else if ((selectedRole === "VP – HUG" || selectedRole === "VP - HUG") && !isCompleted && !isRejected) {
    if (hasGm && !hasVp) {
      isPendingOnYou = true;
      actionLabel = "VP – HUG Final Authorization Required";
      actionButtonText = "REVIEW & APPROVE";
    }
  }

  return {
    isPendingOnYou,
    actionLabel,
    actionButtonText,
    actionRoleName,
    currentPendingRole,
    displayStatus,
    isCompleted,
    isRejected,
    bothParallelSigned,
    hasCustomer,
    hasTechExec,
    hasSiteEng,
    hasQaqc,
    hasPm,
    hasManTech,
    hasGm,
    hasVp,
  };
}
