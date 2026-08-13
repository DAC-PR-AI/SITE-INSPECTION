"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2, ShieldCheck, ArrowLeft, Search, CheckCircle2, XCircle,
  Clock, Lock, FileText, Check, X, PenTool, AlertTriangle, RotateCcw,
  Undo2, Eye, RefreshCw, UserCheck, ChevronRight, Filter, FileJson, FileDown, KeyRound
} from "lucide-react";
import WorkflowStepper from "./WorkflowStepper";

const ROLES = [
  "Site Engineer",
  "Customer",
  "Technical Executive",
  "QA/QC In-Charge",
  "Project Manager",
  "GM – HUG",
  "VP – HUG",
];

const ROLE_PASSCODES = {
  "Site Engineer": "1818",
  "QA/QC In-Charge": "2020",
  "Project Manager": "3030",
  "GM – HUG": "4040",
  "VP – HUG": "5050",
};

export default function ApprovalPortal({ onExit, initialInspectionId = null }) {
  const [selectedRole, setSelectedRole] = useState("QA/QC In-Charge");
  const [userName, setUserName] = useState("Officer");
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [filterMode, setFilterMode] = useState("assigned"); // assigned | all | completed | rejected
  const [searchQuery, setSearchQuery] = useState("");

  // Signature / Approval Modal states
  const [showSignModal, setShowSignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [passcode, setPasscode] = useState("");
  const [actionError, setActionError] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, [selectedRole]);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`/api/approval?role=${encodeURIComponent(selectedRole)}`);
      const body = await res.json();
      if (body.inspections) {
        setInspections(body.inspections);
      }
    } catch (e) {
      console.error("Failed to load queue:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmApprove() {
    if (!selectedInspection) return;
    const requiredPIN = ROLE_PASSCODES[selectedRole];
    if (requiredPIN && passcode !== requiredPIN) {
      setActionError(`Incorrect PIN for ${selectedRole}. Please try again.`);
      return;
    }

    setSubmittingAction(true);
    setActionError("");

    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: selectedInspection.inspectionId,
          role: selectedRole,
          userName: userName || selectedRole,
          action: "approve",
          comments: remarks,
          signature: signatureData,
          passcode,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Approval failed");

      setSelectedInspection(body.inspection);
      setShowSignModal(false);
      setRemarks("");
      setSignatureData("");
      setPasscode("");
      fetchQueue();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleConfirmReject() {
    if (!selectedInspection) return;
    if (!remarks.trim()) {
      setActionError("Rejection remarks are mandatory.");
      return;
    }
    const requiredPIN = ROLE_PASSCODES[selectedRole];
    if (requiredPIN && passcode !== requiredPIN) {
      setActionError(`Incorrect PIN for ${selectedRole}. Please try again.`);
      return;
    }

    setSubmittingAction(true);
    setActionError("");

    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: selectedInspection.inspectionId,
          role: selectedRole,
          userName: userName || selectedRole,
          action: "reject",
          comments: remarks,
          signature: signatureData,
          passcode,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rejection failed");

      setSelectedInspection(body.inspection);
      setShowRejectModal(false);
      setRemarks("");
      setPasscode("");
      fetchQueue();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSubmittingAction(false);
    }
  }

  const filteredInspections = inspections.filter((i) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        (i.inspectionId || "").toLowerCase().includes(q) ||
        (i.projectName || "").toLowerCase().includes(q) ||
        (i.unitNumber || "").toLowerCase().includes(q) ||
        (i.inspectionType || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (filterMode === "completed") return i.workflowStatus === "COMPLETED";
    if (filterMode === "rejected") return i.workflowStatus === "REJECTED";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 bg-white px-2.5 py-1 rounded-xl flex items-center justify-center shadow-md border border-slate-700">
              <img src="/dac-logo.png" alt="DAC Developers" className="h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base sm:text-lg tracking-tight">DAC Developers</h1>
              <p className="font-mono text-[10px] text-blue-400 uppercase tracking-widest">Inspection Approval Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="font-body text-xs text-slate-400 font-medium">Role:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-transparent font-body font-bold text-xs text-white focus:outline-none cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="bg-slate-900 text-white">
                    {r} {ROLE_PASSCODES[r] ? `🔒` : `(No Passcode)`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="font-body text-xs text-slate-400 font-medium">Name:</span>
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your Name"
                className="bg-transparent font-body font-bold text-xs text-white focus:outline-none w-28"
              />
            </div>

            <button
              onClick={onExit}
              className="text-xs font-body font-semibold px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Exit Portal
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {!selectedInspection ? (
          /* Inspection Queue View */
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <div>
                <h2 className="font-display font-bold text-xl text-slate-900 flex items-center gap-2.5">
                  <ShieldCheck size={24} className="text-blue-600" />
                  <span>{selectedRole} Portal Queue</span>
                </h2>
                <p className="font-body text-xs text-slate-500 mt-1">
                  Managing pending joint inspection reviews and sign-offs
                  {ROLE_PASSCODES[selectedRole] && (
                    <span className="ml-2 font-mono text-[11px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      Required PIN: {ROLE_PASSCODES[selectedRole]}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchQueue}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
                  title="Refresh Queue"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
                {[
                  { key: "assigned", label: "Assigned Queue" },
                  { key: "all", label: "All Inspections" },
                  { key: "completed", label: "Completed" },
                  { key: "rejected", label: "Rejected" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilterMode(key)}
                    className={`text-xs font-body font-semibold px-3.5 py-1.5 rounded-lg transition-all ${
                      filterMode === key
                        ? "bg-white shadow-xs text-blue-700 font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, Project, Unit, Type..."
                  className="w-full text-xs font-body rounded-xl border border-slate-200 pl-9 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50/50"
                />
              </div>
            </div>

            {/* Queue Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-slate-500 font-body text-sm">
                  Loading assigned approvals...
                </div>
              ) : filteredInspections.length === 0 ? (
                <div className="p-12 text-center bg-slate-50/50">
                  <p className="font-body text-sm font-semibold text-slate-600 mb-1">No inspections found in queue</p>
                  <p className="font-body text-xs text-slate-400">Inspections assigned to {selectedRole} will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-body border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <th className="p-4 font-bold">Inspection ID</th>
                        <th className="p-4 font-bold">Project</th>
                        <th className="p-4 font-bold">Unit</th>
                        <th className="p-4 font-bold">Type</th>
                        <th className="p-4 font-bold">Status</th>
                        <th className="p-4 font-bold">Last Updated</th>
                        <th className="p-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInspections.map((i) => (
                        <tr key={i.inspectionId} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-4 font-mono font-bold text-blue-700">{i.inspectionId}</td>
                          <td className="p-4 font-semibold text-slate-800">{i.projectName}</td>
                          <td className="p-4 font-bold text-slate-700">{i.unitNumber}</td>
                          <td className="p-4">
                            <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                              {i.inspectionType || "IJI"}
                            </span>
                          </td>
                          <td className="p-4">
                            <StatusBadge status={i.workflowStatus || i.status} />
                          </td>
                          <td className="p-4 text-slate-500 font-mono text-[11px]">
                            {new Date(i.updatedAt || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedInspection(i)}
                              className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center gap-1.5 ml-auto"
                            >
                              <Eye size={14} /> Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Inspection Review Screen */
          <div className="space-y-6 rise">
            {/* Review Header Bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
              <button
                onClick={() => setSelectedInspection(null)}
                className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Approval Queue
              </button>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
                  {selectedInspection.inspectionId}
                </span>
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200">
                  Type: {selectedInspection.inspectionType || "IJI"}
                </span>
              </div>
            </div>

            {/* Inspection Details summary card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="font-display font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" /> Inspection Summary
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <p className="font-body text-xs text-slate-500 mb-1">Project</p>
                  <p className="font-body font-bold text-sm text-slate-900">{selectedInspection.projectName}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <p className="font-body text-xs text-slate-500 mb-1">Unit Number</p>
                  <p className="font-body font-bold text-sm text-blue-700">{selectedInspection.unitNumber}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <p className="font-body text-xs text-slate-500 mb-1">Inspection Type</p>
                  <p className="font-mono font-bold text-sm text-slate-800">{selectedInspection.inspectionType || "IJI"}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <p className="font-body text-xs text-slate-500 mb-1">Workflow Status</p>
                  <StatusBadge status={selectedInspection.workflowStatus} />
                </div>
              </div>
            </div>

            {/* Workflow Stepper Visualization */}
            <WorkflowStepper inspection={selectedInspection} />

            {/* Read-Only Checklist Review */}
            <ReadOnlyChecklist inspection={selectedInspection} />

            {/* Signature & Action Section */}
            <ApprovalActionSection
              inspection={selectedInspection}
              role={selectedRole}
              onApproveClick={() => {
                setRemarks("");
                setSignatureData("");
                setPasscode("");
                setActionError("");
                setShowSignModal(true);
              }}
              onRejectClick={() => {
                setRemarks("");
                setPasscode("");
                setActionError("");
                setShowRejectModal(true);
              }}
            />

            {/* Approval Audit History Section */}
            <AuditHistorySection history={selectedInspection.approvalHistory || []} />
          </div>
        )}
      </main>

      {/* Signature & Approval Modal */}
      {showSignModal && (
        <SignatureApprovalModal
          role={selectedRole}
          userName={userName}
          remarks={remarks}
          setRemarks={setRemarks}
          passcode={passcode}
          setPasscode={setPasscode}
          onClose={() => setShowSignModal(false)}
          onConfirm={handleConfirmApprove}
          submitting={submittingAction}
          error={actionError}
          onSignatureCaptured={(sig) => setSignatureData(sig)}
        />
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <RejectionModal
          role={selectedRole}
          userName={userName}
          remarks={remarks}
          setRemarks={setRemarks}
          passcode={passcode}
          setPasscode={setPasscode}
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleConfirmReject}
          submitting={submittingAction}
          error={actionError}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = {
    "DRAFT": { label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200" },
    "SITE_ENGINEER_PENDING": { label: "Site Eng Pending", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    "QA_QC_PENDING": { label: "QA/QC Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    "PROJECT_MANAGER_PENDING": { label: "PM Pending", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    "GM_HUG_PENDING": { label: "GM Pending", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    "VP_HUG_PENDING": { label: "VP Pending", cls: "bg-pink-50 text-pink-700 border-pink-200" },
    "COMPLETED": { label: "Completed ✓", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    "REJECTED": { label: "Rejected ✕", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };

  const badge = meta[status] || { label: status || "Submitted", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded-full border ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function ReadOnlyChecklist({ inspection }) {
  const cells = inspection.cells || {};
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
        <CheckCircle2 size={20} className="text-blue-600" /> Submitted Checklist (Read-Only)
      </h3>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 max-h-96 overflow-y-auto space-y-2">
        {Object.keys(cells).length === 0 ? (
          <p className="font-body text-xs text-slate-500 italic">No checklist cells recorded.</p>
        ) : (
          Object.entries(cells).map(([key, cell]) => {
            if (!cell.status) return null;
            return (
              <div key={key} className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-mono text-slate-600 font-semibold">{key.replace("__", " @ ")}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold px-2 py-0.5 rounded-full capitalize ${
                    cell.status === "pass" ? "bg-emerald-100 text-emerald-800" : cell.status === "fail" ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-700"
                  }`}>
                    {cell.status}
                  </span>
                  {cell.remarks && <span className="text-slate-500 italic">"{cell.remarks}"</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ApprovalActionSection({ inspection, role, onApproveClick, onRejectClick }) {
  const currentStatus = inspection.workflowStatus || "DRAFT";
  const signatures = inspection.signatures || {};

  const isAssignedRole =
    (role === "QA/QC In-Charge" && currentStatus === "QA_QC_PENDING") ||
    (role === "Project Manager" && currentStatus === "PROJECT_MANAGER_PENDING") ||
    (role === "GM – HUG" && currentStatus === "GM_HUG_PENDING") ||
    (role === "VP – HUG" && currentStatus === "VP_HUG_PENDING") ||
    role === "Customer" ||
    role === "Technical Executive";

  const hasCustomer = !!signatures.customer;
  const hasTechExec = !!signatures.technicalExecutive;
  const isSequentialApproval = ["QA/QC In-Charge", "Project Manager", "GM – HUG", "VP – HUG"].includes(role);
  const parallelMissing = isSequentialApproval && (!hasCustomer || !hasTechExec);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
            <PenTool size={20} className="text-blue-600" /> Approval & Sign-off Action
          </h3>
          <p className="font-body text-xs text-slate-500">Authorize or reject inspection for stage <b>{role}</b></p>
        </div>

        {isAssignedRole && (
          <div className="flex items-center gap-3">
            <button
              onClick={onRejectClick}
              className="text-xs font-body font-bold px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1.5"
            >
              <XCircle size={16} /> Reject
            </button>
            <button
              onClick={onApproveClick}
              disabled={parallelMissing}
              className={`text-xs font-body font-bold px-6 py-2.5 rounded-xl text-white shadow-md flex items-center gap-2 transition-all ${
                parallelMissing
                  ? "bg-slate-300 cursor-not-allowed shadow-none"
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
              }`}
            >
              <CheckCircle2 size={16} /> {parallelMissing ? "Parallel Signatures Required" : "Approve & Sign"}
            </button>
          </div>
        )}
      </div>

      {isAssignedRole && parallelMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-body flex items-start gap-2.5">
          <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900 mb-0.5">Stage Advancement Gate Locked</p>
            <p>
              Both <b>Customer Sign</b> and <b>Technical Executive Sign</b> are mandatory before stage approval.
              {!hasCustomer && <span className="block font-semibold text-rose-700">• Missing Customer Signature</span>}
              {!hasTechExec && <span className="block font-semibold text-rose-700">• Missing Technical Executive Signature</span>}
            </p>
          </div>
        </div>
      )}

      {!isAssignedRole && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-body flex items-center gap-2">
          <Lock size={16} className="shrink-0 text-slate-400" />
          <span>This inspection is currently in stage <b>{currentStatus}</b>. Action for {role} is locked until previous stages complete.</span>
        </div>
      )}
    </div>
  );
}

function AuditHistorySection({ history }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
        <Clock size={20} className="text-blue-600" /> Approval Audit History
      </h3>

      {history.length === 0 ? (
        <p className="font-body text-xs text-slate-500 italic">No audit history recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {history.map((h, idx) => (
            <div key={h.id || idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                  h.action === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {h.action === "Rejected" ? "✕" : "✓"}
                </div>
                <div>
                  <p className="font-body font-bold text-sm text-slate-900">{h.role} · {h.userName}</p>
                  <p className="font-body text-xs text-slate-600 mt-0.5">{h.action} - Status: <span className="font-mono font-semibold">{h.status}</span></p>
                  {h.comments && <p className="font-body text-xs text-slate-500 mt-1 italic">"{h.comments}"</p>}
                </div>
              </div>

              <div className="font-mono text-[11px] text-slate-400">
                {h.timestamp}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SignatureApprovalModal({ role, userName, remarks, setRemarks, passcode, setPasscode, onClose, onConfirm, submitting, error, onSignatureCaptured }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const requiredPIN = ROLE_PASSCODES[role];

  function getPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onSignatureCaptured(canvasRef.current.toDataURL());
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureCaptured("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative rise">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Confirm Approval & Sign</h3>
        <p className="font-body text-xs text-slate-500 mb-4">Approving as <b>{role}</b> ({userName})</p>

        {error && (
          <div className="mb-4 text-xs font-body text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="space-y-4">
          {requiredPIN && (
            <div>
              <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1"><KeyRound size={13} className="text-blue-600" /> Role Authentication PIN <span className="text-rose-500">*</span></span>
                <span className="text-[11px] font-mono text-slate-400">PIN: {requiredPIN}</span>
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={`Enter PIN for ${role}`}
                className="w-full text-sm font-mono rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}

          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Approval Remarks (Optional)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add optional notes or comments..."
              rows={2}
              className="w-full text-xs font-body rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-body text-xs font-semibold text-slate-700">Digital Signature Pad</label>
              <button onClick={clearCanvas} className="text-[11px] font-body text-slate-500 hover:text-blue-600 flex items-center gap-1">
                <RotateCcw size={12} /> Clear
              </button>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 h-36 relative">
              <canvas
                ref={canvasRef}
                width={360}
                height={144}
                className="w-full h-full cursor-crosshair"
                onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="font-body text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting || (requiredPIN && !passcode)}
              className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 disabled:bg-slate-300"
            >
              {submitting ? "Processing..." : "Confirm Approval"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectionModal({ role, userName, remarks, setRemarks, passcode, setPasscode, onClose, onConfirm, submitting, error }) {
  const requiredPIN = ROLE_PASSCODES[role];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative rise">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <h3 className="font-display font-bold text-lg text-rose-700 mb-1 flex items-center gap-2">
          <XCircle size={20} /> Reject Inspection
        </h3>
        <p className="font-body text-xs text-slate-500 mb-4">Rejecting as <b>{role}</b> ({userName})</p>

        {error && (
          <div className="mb-4 text-xs font-body text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="space-y-4">
          {requiredPIN && (
            <div>
              <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1"><KeyRound size={13} className="text-rose-600" /> Role Authentication PIN <span className="text-rose-500">*</span></span>
                <span className="text-[11px] font-mono text-slate-400">PIN: {requiredPIN}</span>
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={`Enter PIN for ${role}`}
                className="w-full text-sm font-mono rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
          )}

          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Rejection Remarks (Mandatory)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="State clear reasons why the inspection is rejected..."
              rows={3}
              className="w-full text-xs font-body rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="font-body text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting || !remarks.trim() || (requiredPIN && !passcode)}
              className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:bg-slate-300"
            >
              {submitting ? "Processing..." : "Confirm Rejection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
