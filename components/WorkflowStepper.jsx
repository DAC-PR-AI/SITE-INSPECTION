import React from "react";
import { CheckCircle2, Clock, Lock, XCircle, ChevronDown, Check, UserCheck, ShieldCheck, AlertCircle } from "lucide-react";

export default function WorkflowStepper({ inspection }) {
  const currentStatus = inspection?.workflowStatus || "DRAFT";
  const signatures = inspection?.signatures || {};
  const history = inspection?.approvalHistory || [];

  // Determine state of each sequential step
  const stages = [
    {
      key: "SITE_ENGINEER",
      label: "Site Engineer",
      subtitle: "Initial Inspection & Sign-off",
      isComplete: ["QA_QC_PENDING", "QA_QC_APPROVED", "PROJECT_MANAGER_PENDING", "PROJECT_MANAGER_APPROVED", "GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus),
      isPending: ["SITE_ENGINEER_PENDING", "DRAFT"].includes(currentStatus),
      isRejected: currentStatus === "REJECTED" && history[history.length - 1]?.role === "Site Engineer",
    },
    {
      key: "QA_QC",
      label: "QA/QC In-Charge",
      subtitle: "Quality & Compliance Review",
      isComplete: ["PROJECT_MANAGER_PENDING", "PROJECT_MANAGER_APPROVED", "GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus),
      isPending: currentStatus === "QA_QC_PENDING",
      isRejected: currentStatus === "REJECTED" && history[history.length - 1]?.role === "QA/QC In-Charge",
    },
    {
      key: "PROJECT_MANAGER",
      label: "Project Manager",
      subtitle: "Project Verification & Sign-off",
      isComplete: ["GM_HUG_PENDING", "GM_HUG_APPROVED", "VP_HUG_PENDING", "COMPLETED"].includes(currentStatus),
      isPending: currentStatus === "PROJECT_MANAGER_PENDING",
      isRejected: currentStatus === "REJECTED" && history[history.length - 1]?.role === "Project Manager",
    },
    {
      key: "GM_HUG",
      label: "GM – HUG",
      subtitle: "General Manager Approval",
      isComplete: ["VP_HUG_PENDING", "COMPLETED"].includes(currentStatus),
      isPending: currentStatus === "GM_HUG_PENDING",
      isRejected: currentStatus === "REJECTED" && history[history.length - 1]?.role === "GM – HUG",
    },
    {
      key: "VP_HUG",
      label: "VP – HUG",
      subtitle: "Vice President Final Sign-off",
      isComplete: currentStatus === "COMPLETED",
      isPending: currentStatus === "VP_HUG_PENDING",
      isRejected: currentStatus === "REJECTED" && history[history.length - 1]?.role === "VP – HUG",
    },
  ];

  const hasCustomerSigned = !!signatures.customer;
  const hasTechExecSigned = !!signatures.technicalExecutive;
  const bothParallelSigned = hasCustomerSigned && hasTechExecSigned;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900">Approval Workflow Progress</h3>
          <p className="font-body text-xs text-slate-500">Live multi-level approval status chain</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1: Site Engineer */}
        <StageCard stage={stages[0]} />

        <div className="flex justify-center my-1">
          <ChevronDown size={18} className="text-slate-300" />
        </div>

        {/* Parallel Mandatory Signatures Gate Box */}
        <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
          bothParallelSigned ? "bg-emerald-50/60 border-emerald-200" : "bg-amber-50/60 border-amber-200"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
              <UserCheck size={16} className={bothParallelSigned ? "text-emerald-600" : "text-amber-600"} />
              <span>Mandatory Parallel Signatures Gate</span>
            </div>
            <span className={`font-body text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              bothParallelSigned ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
            }`}>
              {bothParallelSigned ? "Gate Unlocked ✓" : "Required to Advance Stage"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border flex items-center justify-between ${hasCustomerSigned ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-amber-200 text-slate-700"}`}>
              <div>
                <p className="font-body font-bold text-xs">Customer Sign</p>
                <p className="font-body text-[11px] opacity-80">{hasCustomerSigned ? "Signed & Confirmed" : "Mandatory Signature Missing"}</p>
              </div>
              {hasCustomerSigned ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-500" />}
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${hasTechExecSigned ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-amber-200 text-slate-700"}`}>
              <div>
                <p className="font-body font-bold text-xs">Technical Executive</p>
                <p className="font-body text-[11px] opacity-80">{hasTechExecSigned ? "Signed & Confirmed" : "Mandatory Signature Missing"}</p>
              </div>
              {hasTechExecSigned ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-500" />}
            </div>
          </div>
        </div>

        {/* Sequential Steps: QA/QC -> PM -> GM -> VP */}
        {stages.slice(1).map((stage) => (
          <React.Fragment key={stage.key}>
            <div className="flex justify-center my-1">
              <ChevronDown size={18} className="text-slate-300" />
            </div>
            <StageCard stage={stage} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function StageCard({ stage }) {
  let badgeColor = "bg-slate-100 text-slate-500 border-slate-200";
  let icon = <Lock size={16} className="text-slate-400" />;
  let statusText = "Locked";

  if (stage.isComplete) {
    badgeColor = "bg-emerald-50 border-emerald-200 text-emerald-700";
    icon = <CheckCircle2 size={18} className="text-emerald-600" />;
    statusText = "Completed";
  } else if (stage.isPending) {
    badgeColor = "bg-blue-50 border-blue-200 text-blue-700 animate-pulse";
    icon = <Clock size={18} className="text-blue-600" />;
    statusText = "Pending Approval";
  } else if (stage.isRejected) {
    badgeColor = "bg-rose-50 border-rose-200 text-rose-700";
    icon = <XCircle size={18} className="text-rose-600" />;
    statusText = "Rejected";
  }

  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${badgeColor}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/80 flex items-center justify-center shadow-xs">
          {icon}
        </div>
        <div>
          <h4 className="font-display font-bold text-sm text-slate-900">{stage.label}</h4>
          <p className="font-body text-xs text-slate-500">{stage.subtitle}</p>
        </div>
      </div>

      <span className="font-body text-xs font-bold px-3 py-1 rounded-full bg-white/90 shadow-xs border border-current">
        {statusText}
      </span>
    </div>
  );
}
