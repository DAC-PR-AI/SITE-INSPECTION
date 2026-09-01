"use client";

import React from "react";
import { CheckCircle2, Clock, Lock, XCircle, UserCheck, ShieldCheck, AlertCircle, ArrowDown } from "lucide-react";

/**
 * Visual Approval Workflow Timeline with Parallel Signatures Branch
 * 
 * Visualizes:
 * 1. Inspection Created (Initiation)
 * 2. Parallel Step: Customer & Technical Executive signatures
 * 3. Sequential Steps: Site Engineer -> QA/QC -> Project Manager -> Manager Technical -> GM - HUG -> VP - HUG
 */
export default function WorkflowStepper({ inspection, currentUserRole = "Admin" }) {
  const currentStatus = inspection?.workflowStatus || "DRAFT";
  const signatures = inspection?.signatures || {};
  const history = inspection?.approvalHistory || [];
  const lastHistory = history.length > 0 ? history[history.length - 1] : null;

  const hasCustomerSigned = !!signatures.customer;
  const hasTechExecSigned = !!signatures.technicalExecutive;
  const bothParallelSigned = hasCustomerSigned && hasTechExecSigned;

  // Helper to determine sequential stage states
  // Note: Sequential stages proceed in order after Site Engineer
  const isSiteEngComplete = ["QA_QC_PENDING", "QA_QC_APPROVED", "PROJECT_MANAGER_PENDING", "PROJECT_MANAGER_APPROVED", "MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus);
  const isSiteEngPending = ["SITE_ENGINEER_PENDING", "DRAFT", "draft"].includes(currentStatus);
  const isSiteEngRejected = currentStatus === "REJECTED" && (lastHistory?.role === "Site Engineer" || !lastHistory);

  const isQaqcComplete = ["PROJECT_MANAGER_PENDING", "PROJECT_MANAGER_APPROVED", "MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus);
  const isQaqcPending = currentStatus === "QA_QC_PENDING";
  const isQaqcRejected = currentStatus === "REJECTED" && lastHistory?.role === "QA/QC In-Charge";

  const isPmComplete = ["MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus);
  const isPmPending = currentStatus === "PROJECT_MANAGER_PENDING";
  const isPmRejected = currentStatus === "REJECTED" && lastHistory?.role === "Project Manager";

  const isMgrTechComplete = ["GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus);
  const isMgrTechPending = currentStatus === "MANAGER_TECHNICAL_PENDING";
  const isMgrTechRejected = currentStatus === "REJECTED" && (lastHistory?.role === "Manager Technical" || lastHistory?.role === "Manager – Technical");

  const isGmComplete = ["VP_HUG_PENDING", "COMPLETED"].includes(currentStatus);
  const isGmPending = currentStatus === "GM_HUG_PENDING";
  const isGmRejected = currentStatus === "REJECTED" && (lastHistory?.role === "GM – HUG" || lastHistory?.role === "GM - HUG");

  const isVpComplete = currentStatus === "COMPLETED";
  const isVpPending = currentStatus === "VP_HUG_PENDING";
  const isVpRejected = currentStatus === "REJECTED" && (lastHistory?.role === "VP – HUG" || lastHistory?.role === "VP - HUG");

  // Determine who currently needs to act
  const isCustomerPendingOnYou = currentUserRole === "Customer" && !hasCustomerSigned;
  const isTechExecPendingOnYou = (currentUserRole === "Technical Executive" || currentUserRole === "Technical") && !hasTechExecSigned;
  const isSiteEngPendingOnYou = currentUserRole === "Site Engineer" && isSiteEngPending;
  const isQaqcPendingOnYou = (currentUserRole === "QA/QC In-Charge" || currentUserRole === "QA/QC") && isQaqcPending;
  const isPmPendingOnYou = currentUserRole === "Project Manager" && isPmPending;
  const isMgrTechPendingOnYou = (currentUserRole === "Manager Technical" || currentUserRole === "Manager – Technical") && isMgrTechPending;
  const isGmPendingOnYou = (currentUserRole === "GM – HUG" || currentUserRole === "GM - HUG") && isGmPending;
  const isVpPendingOnYou = (currentUserRole === "VP – HUG" || currentUserRole === "VP - HUG") && isVpPending;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-display font-bold text-base sm:text-lg text-slate-900">Visual Approval Timeline</h3>
            <p className="font-body text-xs text-slate-500">Live multi-stage status & parallel verification track</p>
          </div>
        </div>

        {/* Global overall status indicator */}
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-slate-400 font-medium hidden sm:inline">Overall Status:</span>
          {currentStatus === "COMPLETED" ? (
            <span className="font-body text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" /> Fully Completed
            </span>
          ) : currentStatus === "REJECTED" ? (
            <span className="font-body text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
              <XCircle size={14} className="text-rose-600" /> Rejected
            </span>
          ) : (
            <span className="font-body text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600 animate-pulse" /> In Progress
            </span>
          )}
        </div>
      </div>

      {/* Vertical Timeline Tree */}
      <div className="relative pl-3 sm:pl-6 space-y-5">

        {/* STEP 1: Inspection Created */}
        <TimelineNode
          title="Inspection Created"
          subtitle="Form initiated & preliminary checklist recorded"
          status="completed"
          statusText="✓ Completed"
          isPendingOnYou={false}
        />

        {/* LEVEL 1: Technical Executive + Customer Signatures */}
        <div className="relative border-l-2 border-slate-200 pl-4 sm:pl-6 ml-2.5 pb-2">
          {/* Section banner */}
          <div className="mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold uppercase tracking-wider">
              <UserCheck size={14} className={bothParallelSigned ? "text-emerald-600" : "text-amber-600"} />
              <span>Level 1 — Technical Executive + Customer Signatures</span>
            </div>
            <p className="font-body text-[11px] text-slate-500 mt-1">
              Both Technical Executive and Customer signatures must be completed before Level 2 (Site Engineer) unlocks.
            </p>
          </div>

          {/* Level 1 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {/* Level 1 Node 1: Technical Executive */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              hasTechExecSigned
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : isTechExecPendingOnYou
                ? "bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 text-blue-900"
                : "bg-amber-50/60 border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    hasTechExecSigned ? "bg-emerald-500" : isTechExecPendingOnYou ? "bg-blue-600 animate-ping" : "bg-amber-500"
                  }`} />
                  <div>
                    <h4 className="font-body font-bold text-xs sm:text-sm">Technical Executive</h4>
                    <p className="font-body text-[11px] text-slate-500">Level 1 — Technical Inspection Sign-off</p>
                  </div>
                </div>

                {hasTechExecSigned ? (
                  <span className="font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                    ✓ Level 1 Signed
                  </span>
                ) : isTechExecPendingOnYou ? (
                  <span className="font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-xs shrink-0 animate-pulse">
                    ● PENDING ON YOU
                  </span>
                ) : (
                  <span className="font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Pending
                  </span>
                )}
              </div>
            </div>

            {/* Level 1 Node 2: Customer */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              hasCustomerSigned
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : isCustomerPendingOnYou
                ? "bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 text-blue-900"
                : "bg-amber-50/60 border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    hasCustomerSigned ? "bg-emerald-500" : isCustomerPendingOnYou ? "bg-blue-600 animate-ping" : "bg-amber-500"
                  }`} />
                  <div>
                    <h4 className="font-body font-bold text-xs sm:text-sm">Customer Signature</h4>
                    <p className="font-body text-[11px] text-slate-500">Level 1 — Handover Confirmation</p>
                  </div>
                </div>

                {hasCustomerSigned ? (
                  <span className="font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                    ✓ Level 1 Signed
                  </span>
                ) : isCustomerPendingOnYou ? (
                  <span className="font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-xs shrink-0 animate-pulse">
                    ● PENDING ON YOU
                  </span>
                ) : (
                  <span className="font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LEVEL 2: Site Engineer */}
        <TimelineNode
          title="Level 2 — Site Engineer"
          subtitle="On-site Inspection Verification & Sign-off"
          status={isSiteEngRejected ? "rejected" : isSiteEngComplete ? "completed" : (isSiteEngPending && bothParallelSigned) ? "pending" : "locked"}
          statusText={
            isSiteEngRejected
              ? "✕ Rejected"
              : isSiteEngComplete
              ? "✓ Completed"
              : isSiteEngPendingOnYou
              ? "● PENDING ON YOU"
              : (isSiteEngPending && bothParallelSigned)
              ? "Pending"
              : "🔒 Waiting on Level 1"
          }
          isPendingOnYou={isSiteEngPendingOnYou}
          note={isSiteEngPending && !bothParallelSigned ? "Requires both Technical Executive & Customer signatures to advance" : null}
        />

        {/* STEP 3: QA / QC In-Charge */}
        <TimelineNode
          title="QA / QC In-Charge"
          subtitle="Quality Compliance & Defect Validation"
          status={isQaqcRejected ? "rejected" : isQaqcComplete ? "completed" : isQaqcPending ? "pending" : "locked"}
          statusText={
            isQaqcRejected
              ? "✕ Rejected"
              : isQaqcComplete
              ? "✓ Completed"
              : isQaqcPendingOnYou
              ? "● PENDING ON YOU"
              : isQaqcPending
              ? "Pending"
              : "🔒 Waiting"
          }
          isPendingOnYou={isQaqcPendingOnYou}
        />

        {/* STEP 4: Project Manager */}
        <TimelineNode
          title="Project Manager"
          subtitle="Project Level Verification & Sign-off"
          status={isPmRejected ? "rejected" : isPmComplete ? "completed" : isPmPending ? "pending" : "locked"}
          statusText={
            isPmRejected
              ? "✕ Rejected"
              : isPmComplete
              ? "✓ Completed"
              : isPmPendingOnYou
              ? "● PENDING ON YOU"
              : isPmPending
              ? "Pending"
              : "🔒 Waiting"
          }
          isPendingOnYou={isPmPendingOnYou}
        />

        {/* STEP 5: Manager – Technical */}
        <TimelineNode
          title="Manager – Technical"
          subtitle="Technical Directorate Review"
          status={isMgrTechRejected ? "rejected" : isMgrTechComplete ? "completed" : isMgrTechPending ? "pending" : "locked"}
          statusText={
            isMgrTechRejected
              ? "✕ Rejected"
              : isMgrTechComplete
              ? "✓ Completed"
              : isMgrTechPendingOnYou
              ? "● PENDING ON YOU"
              : isMgrTechPending
              ? "Pending"
              : "🔒 Waiting"
          }
          isPendingOnYou={isMgrTechPendingOnYou}
        />

        {/* STEP 6: GM – HUG */}
        <TimelineNode
          title="GM – HUG"
          subtitle="General Manager Approval (Mr. Vijayachandar)"
          status={isGmRejected ? "rejected" : isGmComplete ? "completed" : isGmPending ? "pending" : "locked"}
          statusText={
            isGmRejected
              ? "✕ Rejected"
              : isGmComplete
              ? "✓ Completed"
              : isGmPendingOnYou
              ? "● PENDING ON YOU"
              : isGmPending
              ? "Pending"
              : "🔒 Waiting"
          }
          isPendingOnYou={isGmPendingOnYou}
        />

        {/* STEP 7: VP – HUG */}
        <TimelineNode
          title="VP – HUG"
          subtitle="Vice President Final Approval & Key Release (Mrs. Sony Dhiraj)"
          status={isVpRejected ? "rejected" : isVpComplete ? "completed" : isVpPending ? "pending" : "locked"}
          statusText={
            isVpRejected
              ? "✕ Rejected"
              : isVpComplete
              ? "✓ Completed"
              : isVpPendingOnYou
              ? "● PENDING ON YOU"
              : isVpPending
              ? "Pending"
              : "🔒 Waiting"
          }
          isPendingOnYou={isVpPendingOnYou}
          isLastNode={true}
        />
      </div>
    </div>
  );
}

/**
 * Individual Node Component along the vertical timeline connector
 */
function TimelineNode({ title, subtitle, status, statusText, isPendingOnYou = false, note = null, isLastNode = false }) {
  // Styles based on status
  let dotBg = "bg-slate-300 border-slate-400 text-slate-600";
  let cardBg = "bg-slate-50/60 border-slate-200 text-slate-600";
  let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
  let icon = <Lock size={13} className="text-slate-400" />;

  if (status === "completed") {
    dotBg = "bg-emerald-500 border-emerald-600 text-white";
    cardBg = "bg-emerald-50/40 border-emerald-200 text-slate-800";
    badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-300";
    icon = <CheckCircle2 size={14} className="text-white" />;
  } else if (isPendingOnYou) {
    dotBg = "bg-blue-600 border-blue-700 text-white ring-4 ring-blue-500/20 animate-pulse";
    cardBg = "bg-blue-50/70 border-blue-300 shadow-xs text-slate-900";
    badgeStyle = "bg-blue-600 text-white shadow-xs font-bold animate-pulse";
    icon = <Clock size={14} className="text-white" />;
  } else if (status === "pending") {
    dotBg = "bg-blue-500 border-blue-600 text-white";
    cardBg = "bg-blue-50/30 border-blue-200 text-slate-800";
    badgeStyle = "bg-blue-100 text-blue-800 border-blue-200";
    icon = <Clock size={13} className="text-white" />;
  } else if (status === "rejected") {
    dotBg = "bg-rose-500 border-rose-600 text-white";
    cardBg = "bg-rose-50/60 border-rose-200 text-rose-950";
    badgeStyle = "bg-rose-100 text-rose-800 border-rose-300";
    icon = <XCircle size={14} className="text-white" />;
  }

  return (
    <div className="relative flex items-start gap-3 sm:gap-4">
      {/* Vertical connecting line */}
      {!isLastNode && (
        <div className="absolute left-[13px] top-[26px] bottom-[-20px] w-0.5 bg-slate-200 pointer-events-none" />
      )}

      {/* Status Dot */}
      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10 shadow-xs ${dotBg}`}>
        {icon}
      </div>

      {/* Content Container */}
      <div className={`flex-1 p-3.5 rounded-xl border flex items-center justify-between gap-3 flex-wrap transition-all ${cardBg}`}>
        <div>
          <h4 className={`font-body font-bold text-xs sm:text-sm ${status === "completed" ? "text-slate-900" : isPendingOnYou ? "text-blue-900 font-extrabold" : "text-slate-800"}`}>
            {title}
          </h4>
          <p className="font-body text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          {note && (
            <p className="font-body text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
              <AlertCircle size={11} className="shrink-0" /> {note}
            </p>
          )}
        </div>

        <span className={`font-body text-[11px] font-bold px-3 py-1 rounded-full border shrink-0 ${badgeStyle}`}>
          {statusText}
        </span>
      </div>
    </div>
  );
}
