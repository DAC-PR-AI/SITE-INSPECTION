"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2, ShieldCheck, ArrowLeft, Search, CheckCircle2, XCircle,
  Clock, Lock, FileText, Check, X, PenTool, AlertTriangle, RotateCcw,
  Undo2, Eye, RefreshCw, UserCheck, ChevronRight, Filter, FileJson, FileDown,
  KeyRound, Shield, Printer, CheckSquare, Layers, User
} from "lucide-react";
import WorkflowStepper from "./WorkflowStepper";
import JointInspectionPrintDoc from "./JointInspectionPrintDoc";

const ROLES = [
  "Admin",
  "Site Engineer",
  "Customer",
  "Technical Executive",
  "QA/QC In-Charge",
  "Project Manager",
  "Manager Technical",
  "GM – HUG",
  "VP – HUG",
];

export default function ApprovalPortal({ onExit, initialInspectionId = null, initialRole = "Admin", initialUserName = "Administrator", initialAuthenticated = true }) {
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [userName, setUserName] = useState(initialUserName || (initialRole === "Admin" ? "Administrator" : initialRole));
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // all | draft | in_progress | completed | rejected
  const [searchQuery, setSearchQuery] = useState("");

  // Role Login & Session Auth state
  const [authenticatedRoles, setAuthenticatedRoles] = useState(initialAuthenticated ? { [initialRole]: true } : {}); // { [role]: true }
  const [showRoleAuthModal, setShowRoleAuthModal] = useState(!initialAuthenticated);
  const [roleAuthPin, setRoleAuthPin] = useState("");
  const [roleAuthError, setRoleAuthError] = useState("");
  const [roleAuthLoading, setRoleAuthLoading] = useState(false);

  // Signature / Approval / Rejection Modal states
  const [showSignModal, setShowSignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [passcode, setPasscode] = useState("");
  const [actionError, setActionError] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const isAdmin = selectedRole === "Admin";

  useEffect(() => {
    // If switching to a new role, check if already authenticated
    if (!authenticatedRoles[selectedRole]) {
      setShowRoleAuthModal(true);
      setRoleAuthPin("");
      setRoleAuthError("");
    }
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

  async function handleVerifyRoleLogin(e) {
    if (e) e.preventDefault();
    if (!roleAuthPin || roleAuthPin.trim().length !== 6) {
      setRoleAuthError("Please enter your 6-digit password.");
      return;
    }
    setRoleAuthLoading(true);
    setRoleAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, pin: roleAuthPin.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Invalid 6-digit password for ${selectedRole}.`);
      }

      setAuthenticatedRoles((prev) => ({ ...prev, [selectedRole]: true }));
      setShowRoleAuthModal(false);
      setRoleAuthPin("");
      fetchQueue();
    } catch (err) {
      setRoleAuthError(err.message);
    } finally {
      setRoleAuthLoading(false);
    }
  }

  async function handleConfirmApprove() {
    if (!selectedInspection) return;
    if (isAdmin) {
      setActionError("Admin cannot sign role signature boxes directly.");
      return;
    }
    if (!passcode || passcode.trim().length !== 6) {
      setActionError("Please enter your 6-digit password.");
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
          passcode: passcode.trim(),
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
    if (!passcode || passcode.trim().length !== 6) {
      setActionError("Please enter your 6-digit password.");
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
          passcode: passcode.trim(),
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
        (i.inspectionType || "").toLowerCase().includes(q) ||
        (i.customerName || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    const st = i.workflowStatus || i.status || "DRAFT";
    if (filterMode === "completed") return st === "COMPLETED";
    if (filterMode === "rejected") return st === "REJECTED";
    if (filterMode === "draft") return st === "DRAFT" || st === "draft";
    if (filterMode === "in_progress") return !["COMPLETED", "REJECTED", "DRAFT", "draft"].includes(st);
    return true;
  });

  return (
    <>
      {selectedInspection && (
        <div className="print-only">
          <JointInspectionPrintDoc data={selectedInspection} />
        </div>
      )}

      <div className="no-print min-h-screen bg-slate-50 text-slate-900 pb-20">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 bg-white px-2.5 py-1 rounded-xl flex items-center justify-center shadow-md border border-slate-700">
                <img src="/dac-logo.png" alt="DAC Developers" className="h-full object-contain" />
              </div>
              <div>
                <h1 className="font-display font-bold text-base sm:text-lg tracking-tight">DAC Developers</h1>
                <p className="font-mono text-[10px] text-blue-400 uppercase tracking-widest">
                  {isAdmin ? "Admin Oversight & Reporting Portal" : "Inspection Approval Portal"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="font-body text-xs text-slate-400 font-medium">Role:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value);
                    if (e.target.value === "Admin") setUserName("Administrator");
                    else setUserName(e.target.value);
                  }}
                  className="bg-transparent font-body font-bold text-xs text-white focus:outline-none cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-slate-900 text-white">
                      {r} {r === "Admin" ? "★ (Full Oversight)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="font-body text-xs text-slate-400 font-medium">User:</span>
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
            /* Inspections Queue View */
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-900 flex items-center gap-2.5">
                    {isAdmin ? <Shield className="text-purple-600" size={26} /> : <ShieldCheck className="text-blue-600" size={26} />}
                    <span>{isAdmin ? "Admin Master Inspection View" : `${selectedRole} Queue`}</span>
                  </h2>
                  <p className="font-body text-xs text-slate-500 mt-1">
                    {isAdmin
                      ? "Complete oversight of all joint inspections across all stages, statuses, drafts, and submissions."
                      : `Reviewing pending tasks and role-restricted signatures for ${selectedRole}.`}
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

              {/* Filters & Search */}
              <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl flex-wrap">
                  {[
                    { key: "all", label: "All Records" },
                    { key: "draft", label: "Drafts" },
                    { key: "in_progress", label: "In Progress" },
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
                    Loading inspections data...
                  </div>
                ) : filteredInspections.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50/50">
                    <p className="font-body text-sm font-semibold text-slate-600 mb-1">No inspections matching current filter</p>
                    <p className="font-body text-xs text-slate-400">Inspections will appear here as they are created and reviewed.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-body border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                          <th className="p-4 font-bold">Inspection ID</th>
                          <th className="p-4 font-bold">Inspection Type</th>
                          <th className="p-4 font-bold">Project</th>
                          <th className="p-4 font-bold">Unit</th>
                          <th className="p-4 font-bold">Customer</th>
                          <th className="p-4 font-bold">Status</th>
                          <th className="p-4 font-bold">Last Updated</th>
                          <th className="p-4 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredInspections.map((i) => (
                          <tr key={i.inspectionId} className="hover:bg-blue-50/40 transition-colors">
                            <td className="p-4 font-mono font-bold text-blue-700">{i.inspectionId}</td>
                            <td className="p-4">
                              <span className="font-body font-bold text-[11px] bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200 whitespace-nowrap">
                                {i.inspectionType || "INTERIOR JOINT INSPECTION"}
                              </span>
                            </td>
                            <td className="p-4 font-semibold text-slate-800">{i.projectName}</td>
                            <td className="p-4 font-bold text-blue-700">{i.unitNumber}</td>
                            <td className="p-4 text-slate-600 font-medium">{i.customerName || "—"}</td>
                            <td className="p-4">
                              <StatusBadge status={i.workflowStatus || i.status} />
                            </td>
                            <td className="p-4 text-slate-500 font-mono text-[11px]">
                              {new Date(i.updatedAt || Date.now()).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setSelectedInspection(i)}
                                className={`font-body text-xs font-bold px-4 py-2 rounded-xl text-white shadow-xs transition-all flex items-center gap-1.5 ml-auto ${
                                  isAdmin ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                <Eye size={14} /> {isAdmin ? "Inspect & Print" : "Review"}
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
            /* Inspection Review & Detail Screen */
            <div className="space-y-6 rise">
              {/* Review Header Bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
                <button
                  onClick={() => setSelectedInspection(null)}
                  className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-colors"
                >
                  <ArrowLeft size={16} /> Back to Inspections
                </button>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* GENERATE PRINT ACTION: Exclusively available to Admin */}
                  {isAdmin && (
                    <button
                      onClick={() => setShowPrintModal(true)}
                      className="font-body text-xs font-bold px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-md shadow-purple-600/20 transition-all scale-[1.02]"
                    >
                      <Printer size={15} /> Generate Print / Official PDF
                    </button>
                  )}

                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
                    {selectedInspection.inspectionId}
                  </span>
                  <span className="font-body font-bold text-xs bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200">
                    Type: {selectedInspection.inspectionType || "INTERIOR JOINT INSPECTION"}
                  </span>
                </div>
              </div>

              {/* Inspection Details Summary Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" /> Inspection Record Overview
                  </h3>
                  {isAdmin && (
                    <span className="text-[11px] font-bold font-body px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Admin Oversight Mode (Full Access)
                    </span>
                  )}
                </div>

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
                    <p className="font-body text-xs text-slate-500 mb-1">Customer Name</p>
                    <p className="font-body font-bold text-sm text-slate-900">{selectedInspection.customerName || "—"}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                    <p className="font-body text-xs text-slate-500 mb-1">Workflow Status</p>
                    <StatusBadge status={selectedInspection.workflowStatus || selectedInspection.status} />
                  </div>
                </div>
              </div>

              {/* Workflow Stepper */}
              <WorkflowStepper inspection={selectedInspection} />

              {/* Full Checklist Detail */}
              <DetailedChecklist inspection={selectedInspection} />

              {/* Remarks & Declaration Details */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                  <h4 className="font-display font-bold text-base text-slate-900 mb-2 flex items-center gap-2">
                    <PenTool size={16} className="text-blue-600" /> General Remarks & Notes
                  </h4>
                  <p className="font-body text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 min-h-[70px] whitespace-pre-wrap">
                    {selectedInspection.generalRemarks || "No general remarks specified."}
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                  <h4 className="font-display font-bold text-base text-slate-900 mb-2 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" /> Customer Declaration
                  </h4>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 text-xs font-body text-slate-700 space-y-1">
                    <p>Status: <b>{selectedInspection.declarationChecked ? "✓ Confirmed & Accepted" : "Pending Confirmation"}</b></p>
                    <p>Interior Works Duration: <b>{selectedInspection.interiorDays || "30"} days</b></p>
                  </div>
                </div>
              </div>

              {/* All Signatures Collected So Far (Visual Signatures Grid) */}
              <SignaturesOverviewSection signatures={selectedInspection.signatures || {}} />

              {/* Action / Signing Section: Disabled for Admin, Role-restricted for others */}
              {!isAdmin ? (
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
              ) : (
                <div className="bg-purple-50/70 rounded-3xl border border-purple-200 p-6 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-purple-900">Admin Oversight & Reporting Privileges</h4>
                      <p className="font-body text-xs text-purple-700">
                        Admin acts as an independent auditor. To generate official printout or PDF, click Generate Print above.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-md transition-all"
                  >
                    <Printer size={15} /> Generate Print Document
                  </button>
                </div>
              )}

              {/* Approval Audit History Section */}
              <AuditHistorySection history={selectedInspection.approvalHistory || []} />
            </div>
          )}
        </main>

        {/* Role Password Login Modal */}
        {showRoleAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setShowRoleAuthModal(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">{selectedRole} Verification</h3>
                  <p className="font-body text-xs text-slate-500">Enter 6-digit role password to unlock</p>
                </div>
              </div>

              {roleAuthError && (
                <div className="mb-4 text-xs font-body text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" /> {roleAuthError}
                </div>
              )}

              <form onSubmit={handleVerifyRoleLogin} className="space-y-4">
                <div>
                  <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">
                    6-Digit Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={roleAuthPin}
                    onChange={(e) => { setRoleAuthPin(e.target.value); setRoleAuthError(""); }}
                    placeholder="••••••"
                    autoFocus
                    autoComplete="new-password"
                    className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRoleAuthModal(false)}
                    className="font-body text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={roleAuthLoading}
                    className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:bg-slate-300 flex items-center gap-1.5"
                  >
                    {roleAuthLoading ? "Verifying..." : "Unlock Access"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

        {/* Print / PDF Preview Modal */}
        {showPrintModal && selectedInspection && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm no-print overflow-y-auto"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPrintModal(false); }}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <Printer size={20} className="text-purple-600" />
                  <span className="font-display font-bold text-sm text-slate-800">
                    Official Joint Inspection Checklist (Print / PDF Preview)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <FileDown size={14} /> Print / Save as PDF
                  </button>
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
                <div className="bg-white shadow-md border border-slate-200 mx-auto rounded p-2">
                  <JointInspectionPrintDoc data={selectedInspection} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const meta = {
    "DRAFT": { label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200" },
    "draft": { label: "Draft", cls: "bg-slate-100 text-slate-700 border-slate-200" },
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

function DetailedChecklist({ inspection }) {
  const cells = inspection.cells || {};
  const entries = Object.entries(cells).filter(([_, c]) => c && c.status);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
        <CheckSquare size={20} className="text-blue-600" /> Checklist Items Evaluated ({entries.length} recorded)
      </h3>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 max-h-96 overflow-y-auto space-y-2">
        {entries.length === 0 ? (
          <p className="font-body text-xs text-slate-500 italic">No checklist items recorded yet.</p>
        ) : (
          entries.map(([key, cell]) => (
            <div key={key} className="p-3.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs flex-wrap gap-2">
              <div>
                <span className="font-mono text-slate-700 font-bold">{key.replace("__", " · Area: ")}</span>
                {cell.remarks && <p className="font-body text-slate-600 italic mt-0.5">Defect note: "{cell.remarks}"</p>}
                {cell.priority && <span className="font-mono text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1 inline-block">Priority: {cell.priority}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold px-2.5 py-1 rounded-full uppercase text-[10px] ${
                  cell.status === "pass" ? "bg-emerald-100 text-emerald-800" : cell.status === "fail" ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {cell.status}
                </span>
                {cell.photos && cell.photos.length > 0 && (
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    📷 {cell.photos.length} Photo{cell.photos.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SignaturesOverviewSection({ signatures }) {
  const ROLES_LIST = [
    { key: "customer", label: "Customer Sign" },
    { key: "siteEngineer", label: "Site Engineer" },
    { key: "qaqc", label: "QA/QC In-Charge" },
    { key: "projectManager", label: "Project Manager" },
    { key: "technicalExecutive", label: "Technical Executive" },
    { key: "managerTechnical", label: "Manager Technical" },
    { key: "gmHug", label: "GM – HUG" },
    { key: "vpHug", label: "VP – HUG" },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
        <PenTool size={20} className="text-blue-600" /> Digital Signatures Status (8 Mandatory Roles)
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ROLES_LIST.map((r) => {
          const sig = signatures[r.key];
          const isSigned = !!sig;
          return (
            <div
              key={r.key}
              className={`p-3.5 rounded-2xl border flex flex-col justify-between items-center text-center min-h-[110px] ${
                isSigned ? "bg-emerald-50/70 border-emerald-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="w-full flex-1 flex items-center justify-center">
                {sig && sig.startsWith("data:") ? (
                  <img src={sig} alt={r.label} className="max-h-10 object-contain" />
                ) : isSigned ? (
                  <span className="font-body text-xs font-bold text-emerald-800">✓ Signed</span>
                ) : (
                  <span className="font-body text-xs text-slate-400 italic">Pending</span>
                )}
              </div>
              <div className="w-full pt-2 border-t border-slate-200/60 mt-1">
                <p className="font-body text-xs font-bold text-slate-800">{r.label}</p>
                <p className="font-mono text-[10px] font-bold text-slate-500 mt-0.5">
                  {isSigned ? "✓ Captured" : "Awaiting Sign-off"}
                </p>
              </div>
            </div>
          );
        })}
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
    role === "Technical Executive" ||
    role === "Manager Technical" ||
    (role === "Site Engineer" && ["DRAFT", "SITE_ENGINEER_PENDING", "REJECTED"].includes(currentStatus));

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
          <span>This inspection is in stage <b>{currentStatus}</b>. Action for {role} is locked until previous sequential approvals complete.</span>
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
          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1"><KeyRound size={13} className="text-blue-600" /> 6-Digit Password <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="password"
              maxLength={6}
              inputMode="numeric"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
              className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Review Remarks / Sign-off Comments (Optional)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Add your stage verification comments…"
              className="w-full text-xs font-body rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-body text-xs font-semibold text-slate-700">Digital Signature</label>
              <button onClick={clearCanvas} className="text-[11px] font-body text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <RotateCcw size={11} /> Clear
              </button>
            </div>
            <div className="h-32 bg-slate-50 border border-dashed border-slate-300 rounded-2xl overflow-hidden relative" style={{ touchAction: "none" }}>
              <canvas
                ref={canvasRef}
                width={380}
                height={128}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
                className="w-full h-full cursor-crosshair"
              />
              <span className="absolute bottom-2 left-3 font-mono text-[10px] text-slate-300 pointer-events-none">Sign with finger/stylus</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
          <button onClick={onClose} className="font-body text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 disabled:bg-slate-300 flex items-center gap-1.5"
          >
            {submitting ? "Approving..." : "Confirm & Sign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectionModal({ role, userName, remarks, setRemarks, passcode, setPasscode, onClose, onConfirm, submitting, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative rise">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <h3 className="font-display font-bold text-lg text-rose-600 mb-1 flex items-center gap-2">
          <XCircle size={20} /> Reject Inspection
        </h3>
        <p className="font-body text-xs text-slate-500 mb-4">Rejecting stage as <b>{role}</b> ({userName})</p>

        {error && (
          <div className="mb-4 text-xs font-body text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1"><KeyRound size={13} className="text-rose-600" /> 6-Digit Password <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="password"
              maxLength={6}
              inputMode="numeric"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
              className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>

          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">
              Reason for Rejection / Rectifications Required <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Explain mandatory rectification points..."
              className="w-full text-xs font-body rounded-xl border border-rose-200 p-2.5 bg-rose-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
          <button onClick={onClose} className="font-body text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || !remarks.trim()}
            className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:bg-slate-300 flex items-center gap-1.5"
          >
            {submitting ? "Rejecting..." : "Confirm Rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}
