/**
 * Internal Notification Architecture Engine for DAC Inspection Application
 * Role-aware event notification generator built dynamically from inspection records & audit logs.
 */

import { getSpotSignatureState } from "./workflow";
import { getInspectionStageAgeing } from "./slaConfig";

/**
 * Generates role-filtered notification records from live inspections dataset
 */
export function getNotificationsForRole(inspections = [], userRole = "Admin") {
  const notifications = [];

  inspections.forEach((i) => {
    const ws = i.workflowStatus || i.status || "DRAFT";
    const spotState = getSpotSignatureState(i);
    const ageing = getInspectionStageAgeing(i);
    const history = i.approvalHistory || [];

    // 1. New Inspection Assigned / Created
    if (ws === "DRAFT" || ws === "SPOT_SIGNATURE_PENDING") {
      if (["Customer", "Technical Executive", "Site Engineer", "Admin"].includes(userRole)) {
        notifications.push({
          id: `notif-new-${i.inspectionId}`,
          inspectionId: i.inspectionId,
          projectName: i.projectName,
          unitNumber: i.unitNumber,
          type: "NEW_INSPECTION",
          title: "New Inspection Created",
          description: `Joint inspection initialized for ${i.projectName} Unit ${i.unitNumber}.`,
          timestamp: i.createdAt || new Date().toISOString(),
          isRead: false,
          targetRole: userRole,
          severity: "info",
        });
      }
    }

    // 2. Spot Signatures Completed
    if (spotState.isSpotComplete) {
      if (["Site Engineer", "Technical Executive", "Admin"].includes(userRole)) {
        notifications.push({
          id: `notif-spot-${i.inspectionId}`,
          inspectionId: i.inspectionId,
          projectName: i.projectName,
          unitNumber: i.unitNumber,
          type: "SPOT_SIGNATURES_COMPLETED",
          title: "Spot Signatures Complete",
          description: `Customer & Technical Executive on-site signatures verified for Unit ${i.unitNumber}.`,
          timestamp: spotState.customerSignedAt || i.updatedAt || new Date().toISOString(),
          isRead: true,
          targetRole: userRole,
          severity: "success",
        });
      }
    }

    // 3. Approval Required (Role-Specific Target)
    let requiredRole = null;
    if (spotState.isSpotComplete) {
      if (["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws)) requiredRole = "Site Engineer";
      else if (ws === "QA_QC_PENDING") requiredRole = "QA/QC In-Charge";
      else if (ws === "PROJECT_MANAGER_PENDING") requiredRole = "Project Manager";
      else if (ws === "MANAGER_TECHNICAL_PENDING") requiredRole = "Manager Technical";
      else if (ws === "GM_HUG_PENDING") requiredRole = "GM – HUG";
      else if (ws === "VP_HUG_PENDING") requiredRole = "VP – HUG";
    }

    if (requiredRole && (userRole === requiredRole || userRole === "Admin")) {
      notifications.push({
        id: `notif-appr-req-${i.inspectionId}`,
        inspectionId: i.inspectionId,
        projectName: i.projectName,
        unitNumber: i.unitNumber,
        type: "APPROVAL_REQUIRED",
        title: "Action Required: Stage Sign-off",
        description: `Inspection ${i.inspectionId} requires your sign-off as ${requiredRole}.`,
        timestamp: i.updatedAt || new Date().toISOString(),
        isRead: false,
        targetRole: userRole,
        severity: "warning",
      });
    }

    // 4. Re-check Requested
    if (ws === "RECHECK_REQUIRED") {
      if (["Site Engineer", "Technical Executive", "Admin"].includes(userRole)) {
        notifications.push({
          id: `notif-recheck-${i.inspectionId}`,
          inspectionId: i.inspectionId,
          projectName: i.projectName,
          unitNumber: i.unitNumber,
          type: "RECHECK_REQUESTED",
          title: "Re-check / Correction Requested",
          description: `Re-inspection required for ${i.projectName} Unit ${i.unitNumber}.`,
          timestamp: i.updatedAt || new Date().toISOString(),
          isRead: false,
          targetRole: userRole,
          severity: "warning",
        });
      }
    }

    // 5. Inspection Rejected
    if (ws === "REJECTED") {
      notifications.push({
        id: `notif-rejected-${i.inspectionId}`,
        inspectionId: i.inspectionId,
        projectName: i.projectName,
        unitNumber: i.unitNumber,
        type: "INSPECTION_REJECTED",
        title: "Inspection Stage Rejected",
        description: `Stage rejected during review. Check remarks for required rectifications.`,
        timestamp: i.updatedAt || new Date().toISOString(),
        isRead: false,
        targetRole: userRole,
        severity: "danger",
      });
    }

    // 6. SLA Approaching & SLA Breached
    if (ws !== "COMPLETED") {
      if (ageing.status === "SLA Breached") {
        notifications.push({
          id: `notif-sla-breach-${i.inspectionId}`,
          inspectionId: i.inspectionId,
          projectName: i.projectName,
          unitNumber: i.unitNumber,
          type: "SLA_BREACHED",
          title: "SLA Turnaround Breached",
          description: `Stage ${ageing.stageLabel} elapsed ${ageing.elapsedHours}h (Exceeded ${ageing.slaLimitHours}h SLA).`,
          timestamp: i.updatedAt || new Date().toISOString(),
          isRead: false,
          targetRole: userRole,
          severity: "danger",
        });
      } else if (ageing.status === "Approaching SLA") {
        notifications.push({
          id: `notif-sla-approaching-${i.inspectionId}`,
          inspectionId: i.inspectionId,
          projectName: i.projectName,
          unitNumber: i.unitNumber,
          type: "SLA_APPROACHING",
          title: "Approaching SLA Limit",
          description: `Stage ${ageing.stageLabel} has elapsed ${ageing.elapsedHours}h of ${ageing.slaLimitHours}h SLA limit.`,
          timestamp: i.updatedAt || new Date().toISOString(),
          isRead: true,
          targetRole: userRole,
          severity: "warning",
        });
      }
    }

    // 7. Final VP Approval Completed
    if (ws === "COMPLETED") {
      notifications.push({
        id: `notif-completed-${i.inspectionId}`,
        inspectionId: i.inspectionId,
        projectName: i.projectName,
        unitNumber: i.unitNumber,
        type: "FINAL_VP_APPROVAL_COMPLETED",
        title: "Key Handover Fully Approved",
        description: `Final VP – HUG approval completed for ${i.projectName} Unit ${i.unitNumber}.`,
        timestamp: i.updatedAt || new Date().toISOString(),
        isRead: true,
        targetRole: userRole,
        severity: "success",
      });
    }
  });

  // Sort newest notifications first
  return notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
