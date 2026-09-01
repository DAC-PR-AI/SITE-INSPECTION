/**
 * Configurable SLA Engine & Notification Preparation Layer
 * Documented in /docs/SLA_CONFIG.md
 */

export const DEFAULT_STAGE_SLAS = {
  SPOT_SIGNATURE_PENDING: { label: "Spot Signatures", slaHours: 24 },
  SITE_ENGINEER_PENDING: { label: "Site Engineer", slaHours: 24 },
  QA_QC_PENDING: { label: "QA / QC In-Charge", slaHours: 24 },
  PROJECT_MANAGER_PENDING: { label: "Project Manager", slaHours: 48 },
  MANAGER_TECHNICAL_PENDING: { label: "Manager – Technical", slaHours: 48 },
  GM_HUG_PENDING: { label: "GM – HUG", slaHours: 72 },
  VP_HUG_PENDING: { label: "VP – HUG", slaHours: 72 },
  DRAFT: { label: "Draft Initiation", slaHours: 24 },
};

/**
 * Computes exact ageing metrics for a given inspection
 */
export function getInspectionStageAgeing(inspection, customSlas = DEFAULT_STAGE_SLAS) {
  if (!inspection) {
    return {
      status: "New",
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
      elapsedHours: 0,
      slaLimitHours: 24,
      remainingHours: 24,
      isBreached: false,
      formattedElapsed: "0h",
    };
  }

  const currentStatus = inspection.workflowStatus || inspection.status || "DRAFT";
  const stageConfig = customSlas[currentStatus] || { label: currentStatus, slaHours: 24 };
  const slaLimitHours = stageConfig.slaHours;

  const now = new Date();
  const stageStartStr = inspection.updatedAt || inspection.createdAt || now.toISOString();
  const stageStart = new Date(stageStartStr);
  const elapsedMs = Math.max(0, now - stageStart);
  const elapsedHours = Number((elapsedMs / (1000 * 60 * 60)).toFixed(1));
  const remainingHours = Number((slaLimitHours - elapsedHours).toFixed(1));

  let status = "New";
  let badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
  let isBreached = false;

  if (currentStatus === "COMPLETED") {
    status = "Completed";
    badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
  } else if (elapsedHours > slaLimitHours) {
    status = "SLA Breached";
    badgeColor = "bg-rose-50 text-rose-800 border-rose-200 animate-pulse";
    isBreached = true;
  } else if (elapsedHours >= slaLimitHours * 0.5) {
    status = "Approaching SLA";
    badgeColor = "bg-amber-50 text-amber-800 border-amber-200";
  }

  const days = Math.floor(elapsedHours / 24);
  const hrs = Math.floor(elapsedHours % 24);
  const formattedElapsed = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;

  return {
    status,
    badgeColor,
    elapsedHours,
    slaLimitHours,
    remainingHours,
    isBreached,
    formattedElapsed,
    stageLabel: stageConfig.label,
    stageStartStr,
  };
}

/**
 * Calculates global SLA dashboard metrics across inspections list
 */
export function calculateSlaDashboardMetrics(inspections = [], customSlas = DEFAULT_STAGE_SLAS) {
  let pendingCount = 0;
  let approachingCount = 0;
  let breachedCount = 0;
  let totalElapsedHours = 0;
  let longestInspection = null;
  let maxElapsed = -1;

  inspections.forEach((i) => {
    const ws = i.workflowStatus || i.status || "DRAFT";
    if (ws !== "COMPLETED") {
      pendingCount++;
      const ageing = getInspectionStageAgeing(i, customSlas);
      totalElapsedHours += ageing.elapsedHours;

      if (ageing.status === "SLA Breached") breachedCount++;
      else if (ageing.status === "Approaching SLA") approachingCount++;

      if (ageing.elapsedHours > maxElapsed) {
        maxElapsed = ageing.elapsedHours;
        longestInspection = { ...i, ageing };
      }
    }
  });

  const avgApprovalHours = pendingCount > 0 ? Number((totalElapsedHours / pendingCount).toFixed(1)) : 0;

  return {
    pendingCount,
    approachingCount,
    breachedCount,
    avgApprovalHours,
    longestInspection,
  };
}

/**
 * Modular Notification Queue Builder for SLA Breaches
 * Prepared for future notification service triggers
 */
export function generateSlaNotificationEvents(inspections = [], customSlas = DEFAULT_STAGE_SLAS) {
  const events = [];

  inspections.forEach((i) => {
    const ws = i.workflowStatus || i.status || "DRAFT";
    if (ws !== "COMPLETED") {
      const ageing = getInspectionStageAgeing(i, customSlas);
      if (ageing.isBreached) {
        events.push({
          eventId: `SLA-EVT-${Date.now()}-${i.inspectionId}`,
          inspectionId: i.inspectionId,
          projectName: i.projectName,
          unitNumber: i.unitNumber,
          stage: ws,
          role: ageing.stageLabel,
          elapsedHours: ageing.elapsedHours,
          slaLimitHours: ageing.slaLimitHours,
          overdueHours: Math.abs(ageing.remainingHours),
          status: "SLA_BREACHED",
          triggeredAt: new Date().toISOString(),
        });
      }
    }
  });

  return events;
}
