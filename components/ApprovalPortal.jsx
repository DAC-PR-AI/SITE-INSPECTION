"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ShieldCheck, ArrowLeft, Search, CheckCircle2, XCircle,
  Clock, Lock, FileText, Check, X, PenTool, AlertTriangle, RotateCcw,
  Eye, RefreshCw, UserCheck, Filter, FileDown,
  KeyRound, Shield, Printer, CheckSquare, Layers, User, ChevronRight,
  Building2, Hash, Calendar, AlertCircle
} from "lucide-react";
import WorkflowStepper from "./WorkflowStepper";
import JointInspectionPrintDoc from "./JointInspectionPrintDoc";
import { getInspectionWorkflowInfo } from "../lib/workflow";

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

export default function ApprovalPortal({
  onExit,
  initialInspectionId = null,
  initialRole = "Admin",
  initialUserName = "Administrator",
  initialAuthenticated = true,
}) {
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [userName, setUserName] = useState(initialUserName || (initialRole === "Admin" ? "Administrator" : initialRole));
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);

  // Filters
  const [filterTab, setFilterTab] = useState("all"); // all | pending_on_you | waiting | completed | rejected
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState("ALL");
  const [filterStatusDropdown, setFilterStatusDropdown] = useState("ALL");
  const [filterPendingRole, setFilterPendingRole] = useState("ALL");

  // Role Login & Session Auth state
  const [authenticatedRoles, setAuthenticatedRoles] = useState(initialAuthenticated ? { [initialRole]: true } : {});
  const [showRoleAuthModal, setShowRoleAuthModal] = useState(!initialAuthenticated);
  const [roleAuthPin, setRoleAuthPin] = useState("");
  const [roleAuthError, setRoleAuthError] = useState("");
  const [roleAuthLoading, setRoleAuthLoading] = useState(false);

  // Two-Step Signing / Approval / Rejection Modal states
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
    if (!authenticatedRoles[selectedRole]) {
      setShowRoleAuthModal(true);
      setRoleAuthPin("");
      setRoleAuthError("");
    }
    fetchQueue();
  }, [selectedRole]);

  useEffect(() => {
    if (initialInspectionId) {
      handleOpenInspection({ inspectionId: initialInspectionId });
    }
  }, [initialInspectionId]);

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

  async function handleOpenInspection(i) {
    if (!i) {
      setSelectedInspection(null);
      return;
    }
    // Optimistically set the inspection summary immediately
    setSelectedInspection(i);

    // Fetch full inspection object including real base64 signature images from the Google Sheets Signatures tab
    try {
      const res = await fetch(`/api/approval?inspectionId=${encodeURIComponent(i.inspectionId)}`);
      const body = await res.json();
      if (body.inspection) {
        setSelectedInspection(body.inspection);
      }
    } catch (err) {
      console.warn("Failed to fetch full inspection signatures:", err);
    }
  }

  async function handleVerifyRoleLogin(e) {
    if (e) e.preventDefault();
    if (!userName || !userName.trim() || !roleAuthPin || !roleAuthPin.trim()) {
      setRoleAuthError(isAdmin ? "Please enter your User Name / Email and Password (or Google ID Token)." : "Please enter your User Name and Password.");
      return;
    }

    setRoleAuthLoading(true);
    setRoleAuthError("");

    try {
      let payload;
      if (isAdmin && roleAuthPin.trim().length > 30) {
        payload = { credential: roleAuthPin.trim() };
      } else {
        payload = { userName: userName.trim(), password: roleAuthPin.trim() };
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Authentication failed. Please verify your password in the SECOND SHEET.");
      }

      const assignedRole = data.role || selectedRole;
      setAuthenticatedRoles((prev) => ({ ...prev, [assignedRole]: true }));
      setSelectedRole(assignedRole);
      if (data.user?.name) setUserName(data.user.name);
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

    setSubmittingAction(true);
    setActionError("");

    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: selectedInspection.inspectionId,
          action: "approve",
          comments: remarks,
          signature: signatureData,
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

    setSubmittingAction(true);
    setActionError("");

    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: selectedInspection.inspectionId,
          action: "reject",
          comments: remarks,
          signature: signatureData,
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

  // Extract unique projects for Admin filter
  const uniqueProjects = useMemo(() => {
    const set = new Set();
    inspections.forEach((i) => {
      if (i.projectName) set.add(i.projectName);
    });
    return Array.from(set).sort();
  }, [inspections]);

  // Enhanced inspection mapping with calculated workflow info
  const enhancedInspections = useMemo(() => {
    return inspections.map((i) => ({
      ...i,
      _wf: getInspectionWorkflowInfo(i, selectedRole),
    }));
  }, [inspections, selectedRole]);

  // Count categories
  const pendingOnYouCount = useMemo(() => {
    return enhancedInspections.filter((i) => i._wf.isPendingOnYou).length;
  }, [enhancedInspections]);

  const waitingCount = useMemo(() => {
    return enhancedInspections.filter((i) => !i._wf.isPendingOnYou && !i._wf.isCompleted && !i._wf.isRejected).length;
  }, [enhancedInspections]);

  const completedCount = useMemo(() => {
    return enhancedInspections.filter((i) => i._wf.isCompleted).length;
  }, [enhancedInspections]);

  const rejectedCount = useMemo(() => {
    return enhancedInspections.filter((i) => i._wf.isRejected).length;
  }, [enhancedInspections]);

  // Filtered & Sorted Inspections
  const filteredInspections = useMemo(() => {
    const list = enhancedInspections.filter((i) => {
      // Search Query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          (i.inspectionId || "").toLowerCase().includes(q) ||
          (i.projectName || "").toLowerCase().includes(q) ||
          (i.unitNumber || "").toLowerCase().includes(q) ||
          (i.customerName || "").toLowerCase().includes(q) ||
          (i.inspectionType || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Quick Tab Filter
      if (filterTab === "pending_on_you" && !i._wf.isPendingOnYou) return false;
      if (filterTab === "waiting" && (i._wf.isPendingOnYou || i._wf.isCompleted || i._wf.isRejected)) return false;
      if (filterTab === "completed" && !i._wf.isCompleted) return false;
      if (filterTab === "rejected" && !i._wf.isRejected) return false;

      // Admin Dropdown Filters
      if (isAdmin) {
        if (filterProject !== "ALL" && i.projectName !== filterProject) return false;
        if (filterStatusDropdown === "COMPLETED" && !i._wf.isCompleted) return false;
        if (filterStatusDropdown === "REJECTED" && !i._wf.isRejected) return false;
        if (filterStatusDropdown === "IN_PROGRESS" && (i._wf.isCompleted || i._wf.isRejected)) return false;
        if (filterPendingRole !== "ALL" && !i._wf.currentPendingRole.toLowerCase().includes(filterPendingRole.toLowerCase())) return false;
      }

      return true;
    });

    // Smart Sorting:
    // 1. In 'All' tab, inspections that are 'Pending on You' are pinned to the TOP.
    // 2. Newest inspections (by updatedAt / createdAt / inspectionDate) are displayed first.
    return list.sort((a, b) => {
      if (filterTab === "all") {
        if (a._wf.isPendingOnYou && !b._wf.isPendingOnYou) return -1;
        if (!a._wf.isPendingOnYou && b._wf.isPendingOnYou) return 1;
      }
      const timeA = new Date(a.updatedAt || a.createdAt || a.inspectionDate || 0).getTime() || 0;
      const timeB = new Date(b.updatedAt || b.createdAt || b.inspectionDate || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [enhancedInspections, searchQuery, filterTab, filterProject, filterStatusDropdown, filterPendingRole, isAdmin]);

  // Inspection currently selected's calculated workflow state
  const selectedWf = selectedInspection ? getInspectionWorkflowInfo(selectedInspection, selectedRole) : null;

  return (
    <>
      {/* Standalone Printable Document rendered for @media print */}
      {selectedInspection && (
        <div className="print-only">
          <JointInspectionPrintDoc data={selectedInspection} />
        </div>
      )}

      <div className="no-print min-h-screen bg-slate-50/70 text-slate-900 pb-20">
        {/* Top Minimal Navigation Bar */}
        <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 bg-white px-2.5 py-1 rounded-xl flex items-center justify-center shadow-md border border-slate-700">
                <img src="/dac-logo.png" alt="DAC Developers" className="h-full object-contain" />
              </div>
              <div>
                <h1 className="font-display font-bold text-base sm:text-lg tracking-tight">DAC Developers</h1>
                <p className="font-mono text-[10px] text-blue-400 uppercase tracking-widest">
                  {isAdmin ? "Admin Oversight Portal" : "Inspection Approval Portal"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Role Selector */}
              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="font-body text-xs text-slate-400 font-medium">Role:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => {
                    const r = e.target.value;
                    setSelectedRole(r);
                    if (r === "Admin") setUserName("Administrator");
                    else setUserName(r);
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

              {/* User Name */}
              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
                <User size={13} className="text-slate-400" />
                <input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your Name"
                  className="bg-transparent font-body font-bold text-xs text-white focus:outline-none w-28"
                />
              </div>

              <button
                onClick={onExit}
                className="text-xs font-body font-semibold px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                Exit Portal
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-7">
          {!selectedInspection ? (
            /* ========================================================================= */
            /* VIEW 1: LINE-BY-LINE ROLE-AWARE INSPECTION LIST                          */
            /* ========================================================================= */
            <div className="space-y-5">
              {/* Page Title & Summary */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-900 flex items-center gap-2.5">
                    {isAdmin ? <Shield className="text-purple-600" size={24} /> : <ShieldCheck className="text-blue-600" size={24} />}
                    <span>{isAdmin ? "Admin Master Inspection View" : `${selectedRole} Approval Queue`}</span>
                  </h2>
                  <p className="font-body text-xs text-slate-500 mt-1">
                    {isAdmin
                      ? "Complete live tracking of all joint inspections across all units, roles, and approval stages."
                      : pendingOnYouCount > 0
                      ? `You have ${pendingOnYouCount} inspection${pendingOnYouCount > 1 ? "s" : ""} requiring your immediate action.`
                      : `All inspections assigned to ${selectedRole} are currently up to date.`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchQueue}
                    className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
                    title="Refresh Queue"
                  >
                    <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
                    {[
                      { key: "all", label: "All", badge: enhancedInspections.length, badgeColor: "bg-slate-200 text-slate-700" },
                      {
                        key: "pending_on_you",
                        label: "Pending on You",
                        badge: pendingOnYouCount,
                        badgeColor: "bg-blue-600 text-white animate-pulse",
                        highlight: true,
                      },
                      { key: "waiting", label: "Waiting", badge: waitingCount, badgeColor: "bg-amber-100 text-amber-800" },
                      { key: "completed", label: "Completed", badge: completedCount, badgeColor: "bg-emerald-100 text-emerald-800" },
                      { key: "rejected", label: "Rejected", badge: rejectedCount, badgeColor: "bg-rose-100 text-rose-800" },
                    ].map(({ key, label, badge, badgeColor, highlight }) => (
                      <button
                        key={key}
                        onClick={() => setFilterTab(key)}
                        className={`text-xs font-body font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          filterTab === key
                            ? "bg-white shadow-xs text-blue-700 font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>{label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterTab === key && highlight ? "bg-blue-600 text-white" : badgeColor}`}>
                          {badge}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ID, Unit, Project, Customer..."
                      className="w-full text-xs font-body rounded-xl border border-slate-200 pl-9 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Additional Admin Multi-Filters */}
                {isAdmin && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap text-xs font-body">
                    <span className="font-bold text-slate-500 flex items-center gap-1">
                      <Filter size={12} /> Admin Filters:
                    </span>

                    {/* Project Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Project:</span>
                      <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
                      >
                        <option value="ALL">All Projects</option>
                        {uniqueProjects.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Status:</span>
                      <select
                        value={filterStatusDropdown}
                        onChange={(e) => setFilterStatusDropdown(e.target.value)}
                        className="font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>

                    {/* Pending Role Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Pending Role:</span>
                      <select
                        value={filterPendingRole}
                        onChange={(e) => setFilterPendingRole(e.target.value)}
                        className="font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none"
                      >
                        <option value="ALL">All Pending Roles</option>
                        <option value="Customer">Customer Sign</option>
                        <option value="Technical Executive">Technical Executive</option>
                        <option value="Site Engineer">Site Engineer</option>
                        <option value="QA/QC">QA / QC In-Charge</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Manager Technical">Manager Technical</option>
                        <option value="GM – HUG">GM – HUG</option>
                        <option value="VP – HUG">VP – HUG</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Line-by-Line Inspection Listing Table */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 font-body text-sm flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-blue-600" />
                    <span>Loading inspections...</span>
                  </div>
                ) : filteredInspections.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50/50">
                    <p className="font-body text-sm font-semibold text-slate-700 mb-1">No inspections matching current filter</p>
                    <p className="font-body text-xs text-slate-400">Inspections will appear here as they are created and reviewed.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-body border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                          <th className="p-3.5 sm:p-4">Inspection ID</th>
                          <th className="p-3.5 sm:p-4">Project</th>
                          <th className="p-3.5 sm:p-4">Unit</th>
                          <th className="p-3.5 sm:p-4">Date</th>
                          <th className="p-3.5 sm:p-4">Workflow Status</th>
                          <th className="p-3.5 sm:p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredInspections.map((i) => {
                          const wf = i._wf;
                          return (
                            <tr
                              key={i.inspectionId}
                              onClick={() => handleOpenInspection(i)}
                              className={`transition-colors cursor-pointer ${
                                wf.isPendingOnYou
                                  ? "bg-blue-50/40 hover:bg-blue-100/50"
                                  : "hover:bg-slate-50/80"
                              }`}
                            >
                              {/* Inspection ID */}
                              <td className="p-3.5 sm:p-4">
                                <div className="font-mono font-bold text-blue-700 flex items-center gap-1.5">
                                  {wf.isPendingOnYou && (
                                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping inline-block" />
                                  )}
                                  <span>{i.inspectionId}</span>
                                </div>
                                <div className="font-body text-[10px] text-slate-400 mt-0.5">
                                  {i.inspectionType || "INTERIOR JOINT INSPECTION"}
                                </div>
                              </td>

                              {/* Project */}
                              <td className="p-3.5 sm:p-4 font-semibold text-slate-800">
                                {i.projectName}
                              </td>

                              {/* Unit */}
                              <td className="p-3.5 sm:p-4 font-bold text-blue-700">
                                {i.unitNumber}
                              </td>

                              {/* Date */}
                              <td className="p-3.5 sm:p-4 text-slate-500 font-mono text-[11px]">
                                {i.inspectionDate || new Date(i.updatedAt || Date.now()).toLocaleDateString("en-GB")}
                              </td>

                              {/* Workflow Status with "Pending on You" Priority */}
                              <td className="p-3.5 sm:p-4">
                                {wf.isPendingOnYou ? (
                                  <div>
                                    <span className="font-body font-bold text-xs px-3 py-1 rounded-full bg-blue-600 text-white shadow-xs inline-flex items-center gap-1.5 animate-pulse">
                                      <Clock size={12} className="animate-spin" /> Pending on You
                                    </span>
                                    <p className="font-body text-[10px] text-blue-800 font-semibold mt-1">
                                      {wf.actionLabel}
                                    </p>
                                  </div>
                                ) : wf.isCompleted ? (
                                  <span className="font-body font-bold text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                    <CheckCircle2 size={13} /> Completed
                                  </span>
                                ) : wf.isRejected ? (
                                  <span className="font-body font-bold text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                    <XCircle size={13} /> Rejected
                                  </span>
                                ) : (
                                  <div>
                                    <span className="font-body font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                                      Waiting
                                    </span>
                                    <p className="font-body text-[11px] text-slate-500 mt-0.5">
                                      Currently with: <b>{wf.currentPendingRole}</b>
                                    </p>
                                  </div>
                                )}
                              </td>

                              {/* Action Button */}
                              <td className="p-3.5 sm:p-4 text-right">
                                {wf.isPendingOnYou ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenInspection(i);
                                    }}
                                    className="font-body text-xs font-bold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 ml-auto transition-transform active:scale-95"
                                  >
                                    <PenTool size={13} /> {wf.actionButtonText}
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenInspection(i);
                                    }}
                                    className="font-body text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 ml-auto transition-colors"
                                  >
                                    <Eye size={13} /> View
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW 2: INSPECTION DETAIL & APPROVAL TIMELINE TRACKING SCREEN             */
            /* ========================================================================= */
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-150">
              {/* Review Header Bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs">
                <button
                  onClick={() => setSelectedInspection(null)}
                  className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 border border-slate-200 transition-colors"
                >
                  <ArrowLeft size={15} /> Back to Inspections
                </button>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* GENERATE PDF ACTION: Available to Admin or completed inspection review */}
                  {(isAdmin || selectedWf?.isCompleted) && (
                    <button
                      onClick={() => setShowPrintModal(true)}
                      className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-md shadow-purple-600/20 transition-all scale-[1.02]"
                    >
                      <Printer size={14} /> Generate PDF / Print Official Form
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

              {/* ACTION CALLOUT BANNER */}
              {selectedWf?.isPendingOnYou ? (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-blue-600/15 flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping inline-block" />
                      <span className="font-mono text-xs font-bold tracking-wider uppercase text-blue-100">
                        Pending on You
                      </span>
                    </div>
                    <h3 className="font-display font-extrabold text-lg sm:text-xl">
                      {selectedWf.actionLabel}
                    </h3>
                    <p className="font-body text-xs text-blue-100">
                      You are logged in as <b>{selectedRole}</b> ({userName}). Complete your review and sign-off below.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setRemarks("");
                        setPasscode("");
                        setActionError("");
                        setShowRejectModal(true);
                      }}
                      className="font-body text-xs font-bold px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5"
                    >
                      <XCircle size={15} /> Reject
                    </button>
                    <button
                      onClick={() => {
                        setRemarks("");
                        setSignatureData("");
                        setPasscode("");
                        setActionError("");
                        setShowSignModal(true);
                      }}
                      className="font-body text-xs font-bold px-6 py-2.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 shadow-md flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <PenTool size={15} className="text-blue-600" /> {selectedWf.actionButtonText}
                    </button>
                  </div>
                </div>
              ) : isAdmin ? (
                <div className="bg-purple-50/80 rounded-2xl sm:rounded-3xl p-5 border border-purple-200 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-purple-900">
                        Admin Oversight: Inspection is currently with <b>{selectedWf?.currentPendingRole}</b>
                      </h4>
                      <p className="font-body text-xs text-purple-700">
                        Admin can monitor live multi-level stage progress or generate official PDF reports anytime.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-xs transition-all"
                  >
                    <Printer size={14} /> Generate PDF
                  </button>
                </div>
              ) : (
                <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 text-slate-700 text-xs font-body flex items-center gap-3">
                  <Lock size={16} className="shrink-0 text-slate-400" />
                  <div>
                    <span className="font-bold">Currently Waiting for: {selectedWf?.currentPendingRole}</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      No action required from {selectedRole} at this stage. Action will unlock sequentially as preceding steps complete.
                    </p>
                  </div>
                </div>
              )}

              {/* Inspection Summary Card */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" /> Inspection Record Summary
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Updated: {new Date(selectedInspection.updatedAt || Date.now()).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="font-body text-xs text-slate-400 mb-1">Project</p>
                    <p className="font-body font-bold text-sm text-slate-900">{selectedInspection.projectName}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="font-body text-xs text-slate-400 mb-1">Unit Number</p>
                    <p className="font-body font-bold text-sm text-blue-700">{selectedInspection.unitNumber}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="font-body text-xs text-slate-400 mb-1">Customer Name</p>
                    <p className="font-body font-bold text-sm text-slate-900">{selectedInspection.customerName || "—"}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="font-body text-xs text-slate-400 mb-1">Stage Status</p>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {selectedInspection.workflowStatus || selectedInspection.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Approval Timeline */}
              <WorkflowStepper inspection={selectedInspection} currentUserRole={selectedRole} />

              {/* Full Checklist Detail */}
              <DetailedChecklist inspection={selectedInspection} />

              {/* Remarks & Declaration Details */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
                  <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 mb-2 flex items-center gap-2">
                    <PenTool size={16} className="text-blue-600" /> General Remarks & Notes
                  </h4>
                  <p className="font-body text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 min-h-[70px] whitespace-pre-wrap">
                    {selectedInspection.generalRemarks || "No general remarks recorded."}
                  </p>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
                  <h4 className="font-display font-bold text-sm sm:text-base text-slate-900 mb-2 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" /> Customer Declaration
                  </h4>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs font-body text-slate-700 space-y-1">
                    <p>Status: <b>{selectedInspection.declarationChecked ? "✓ Confirmed & Accepted" : "Pending Confirmation"}</b></p>
                    <p>Interior Works Allowed Duration: <b>{selectedInspection.interiorDays || "30"} days</b></p>
                  </div>
                </div>
              </div>

              {/* Digital Signatures Overview */}
              <SignaturesOverviewSection signatures={selectedInspection.signatures || {}} />

              {/* Approval Audit History Section */}
              <AuditHistorySection history={selectedInspection.approvalHistory || []} />
            </div>
          )}
        </main>

        {/* ========================================================================= */}
        {/* MODAL 1: Role Password Login Modal                                       */}
        {/* ========================================================================= */}
        {showRoleAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowRoleAuthModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">{selectedRole} Verification</h3>
                  <p className="font-body text-xs text-slate-500">
                    Sign in with password from SECOND SHEET
                  </p>
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
                    User Name / Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Raj or admin@dac.com"
                    className="w-full text-xs font-body rounded-xl border border-slate-200 p-2.5 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <div>
                  <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">
                    Password (from SECOND SHEET) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={roleAuthPin}
                    onChange={(e) => {
                      setRoleAuthPin(e.target.value);
                      setRoleAuthError("");
                    }}
                    placeholder={isAdmin ? "Google Token or Admin Password" : "e.g. TechExec@1001"}
                    autoFocus
                    className="w-full text-sm font-mono rounded-xl border border-slate-200 p-2.5 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Verified against Column G in the SECOND SHEET (Users tab)</p>
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

        {/* ========================================================================= */}
        {/* MODAL 2: Signature & Two-Step Approval Modal                             */}
        {/* ========================================================================= */}
        {showSignModal && (
          <SignatureApprovalModal
            role={selectedRole}
            userName={userName}
            inspection={selectedInspection}
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

        {/* ========================================================================= */}
        {/* MODAL 3: Rejection Modal                                                 */}
        {/* ========================================================================= */}
        {showRejectModal && (
          <RejectionModal
            role={selectedRole}
            userName={userName}
            inspection={selectedInspection}
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

        {/* ========================================================================= */}
        {/* MODAL 4: Official PDF / Print Document Modal                             */}
        {/* ========================================================================= */}
        {showPrintModal && selectedInspection && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm no-print overflow-y-auto"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowPrintModal(false);
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <Printer size={18} className="text-purple-600" />
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

/**
 * Detailed Checklist Viewer
 */
function DetailedChecklist({ inspection }) {
  const cells = inspection.cells || {};
  const entries = Object.entries(cells).filter(([_, c]) => c && c.status);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
      <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-4 flex items-center gap-2">
        <CheckSquare size={18} className="text-blue-600" /> Evaluated Checklist Particulars ({entries.length} recorded)
      </h3>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 max-h-96 overflow-y-auto space-y-2">
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
                  {cell.status === "fail" ? "SNAG" : cell.status}
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

/**
 * Visual Signatures Overview Section
 */
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
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
      <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-4 flex items-center gap-2">
        <PenTool size={18} className="text-blue-600" /> Digital Signatures Overview (8 Mandatory Stakeholders)
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {ROLES_LIST.map((r) => {
          const sig = signatures[r.key];
          const dataUrl = typeof sig === "string" ? (sig.startsWith("data:") ? sig : null) : (sig?.dataUrl || null);
          const isSigned = !!sig && (sig === "SIGNED" || sig.status === "signed" || !!dataUrl || !!sig.signer);
          return (
            <div
              key={r.key}
              className={`p-3.5 rounded-xl border flex flex-col justify-between items-center text-center min-h-[110px] ${
                isSigned ? "bg-emerald-50/70 border-emerald-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="w-full flex-1 flex items-center justify-center">
                {dataUrl ? (
                  <img src={dataUrl} alt={r.label} className="max-h-12 object-contain" />
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

/**
 * Audit History Timeline Section
 */
function AuditHistorySection({ history }) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
      <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-4 flex items-center gap-2">
        <Clock size={18} className="text-blue-600" /> Approval Audit Trail
      </h3>

      {history.length === 0 ? (
        <p className="font-body text-xs text-slate-500 italic">No audit history recorded yet.</p>
      ) : (
        <div className="space-y-2.5">
          {history.map((h, idx) => (
            <div key={h.id || idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  h.action === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {h.action === "Rejected" ? "✕" : "✓"}
                </div>
                <div>
                  <p className="font-body font-bold text-xs sm:text-sm text-slate-900">{h.role} · {h.userName}</p>
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

/**
 * Helper to export clean trimmed PNG without excessive empty whitespace,
 * preserving crisp quality and exact aspect ratio in PDF / documents.
 */
function exportTrimmedSignature(canvas) {
  if (!canvas) return "";
  try {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hasDrawn = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        // Detect drawn stroke pixels (transparent background)
        if (alpha > 15) {
          hasDrawn = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasDrawn) return "";

    const padding = 12;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(w - cropX, maxX - minX + padding * 2);
    const cropH = Math.min(h - cropY, maxY - minY + padding * 2);

    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = cropW;
    trimmedCanvas.height = cropH;
    const trimmedCtx = trimmedCanvas.getContext("2d");
    trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    return trimmedCanvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Trim signature fallback to standard export:", err);
    return canvas.toDataURL("image/png");
  }
}

/**
 * Two-Step Signature & Approval Modal with Precise Coordinate Tracking
 */
function SignatureApprovalModal({ role, userName, inspection, remarks, setRemarks, onClose, onConfirm, submitting, error, onSignatureCaptured }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drawingRef = useRef(false);
  const pathsRef = useRef([]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 2.8 * (canvas._dpr || 1);

    pathsRef.current.forEach((path) => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas._dpr = dpr;
      redraw();
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPoint(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
    const dpr = canvas._dpr || 1;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawingRef.current = true;
    const p = getPoint(e);
    pathsRef.current.push([p]);
    redraw();
  }

  function moveDraw(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPoint(e);
    pathsRef.current[pathsRef.current.length - 1].push(p);
    redraw();
  }

  function endDraw(e) {
    if (!drawingRef.current) return;
    if (e) e.preventDefault();
    drawingRef.current = false;
    const trimmed = exportTrimmedSignature(canvasRef.current);
    onSignatureCaptured(trimmed);
  }

  function clearCanvas() {
    pathsRef.current = [];
    redraw();
    onSignatureCaptured("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        {/* Step Header */}
        <div className="border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck size={16} /> Role Verification & Sign-off
          </div>
          <h3 className="font-display font-bold text-lg text-slate-900">
            {role} Approval & Sign
          </h3>
          <p className="font-body text-xs text-slate-500">
            Inspection: <b>{inspection?.inspectionId}</b> · Unit <b>{inspection?.unitNumber}</b>
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs font-body text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Verified Session Identity Badge */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs font-body text-blue-900">
            <ShieldCheck size={18} className="text-blue-600 shrink-0" />
            <div>
              <p className="font-bold">Signing as {role}</p>
              <p className="text-[11px] text-blue-700">Authenticated user: <b>{userName || role}</b></p>
            </div>
          </div>

          {/* Optional comments */}
          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">
              Sign-off Comments / Verification Remarks (Optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Add your stage verification comments…"
              className="w-full text-xs font-body rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Digital Signature Canvas with Relative Positioning */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-body text-xs font-semibold text-slate-700">
                Digital Signature <span className="text-rose-500">*</span>
              </label>
              <button onClick={clearCanvas} className="text-[11px] font-body text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <RotateCcw size={11} /> Clear
              </button>
            </div>
            <div ref={wrapRef} className="h-32 w-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl overflow-hidden relative" style={{ touchAction: "none" }}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
                className="w-full h-full cursor-crosshair block"
              />
              <span className="absolute bottom-2 left-3 font-mono text-[10px] text-slate-300 pointer-events-none select-none">
                Draw signature here with finger, stylus, or mouse
              </span>
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
            {submitting ? "Signing & Approving..." : "Confirm & Sign"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Rejection Modal
 */
function RejectionModal({ role, userName, inspection, remarks, setRemarks, passcode, setPasscode, onClose, onConfirm, submitting, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>

        <h3 className="font-display font-bold text-lg text-rose-600 mb-1 flex items-center gap-2">
          <XCircle size={20} /> Reject Inspection Stage
        </h3>
        <p className="font-body text-xs text-slate-500 mb-4">
          Rejecting stage as <b>{role}</b> ({userName})
        </p>

        {error && (
          <div className="mb-4 text-xs font-body text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">
              Reason for Rejection / Mandatory Rectifications <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Explain required rectification points..."
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
