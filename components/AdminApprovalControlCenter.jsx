"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck, Search, Filter, RefreshCw, Eye, AlertTriangle, CheckCircle2,
  XCircle, Clock, Lock, FileText, Calendar, Building2, User, Layers, ArrowUpRight,
  ShieldAlert, ChevronRight, X, PenTool, Camera, CheckSquare, SlidersHorizontal, AlertCircle
} from "lucide-react";
import { getSpotSignatureState, WORKFLOW_STATES, createAuditRecord } from "../lib/workflow";
import WorkflowStepper from "./WorkflowStepper";
import JointInspectionPrintDoc from "./JointInspectionPrintDoc";

export default function AdminApprovalControlCenter({
  onOpenInspection,
  currentUserName = "Administrator",
  className = "",
}) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("details"); // details | checklist | defects | photos | signatures | history
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTargetStage, setOverrideTargetStage] = useState("COMPLETED");
  const [overrideReason, setOverrideReason] = useState("");
  const [overridePin, setOverridePin] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState("ALL");
  const [filterUnit, setFilterUnit] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStage, setFilterStage] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDateRange, setFilterDateRange] = useState("ALL");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/approval?role=Admin");
      const data = await res.json();
      if (data.inspections) {
        setInspections(data.inspections);
      }
    } catch (err) {
      console.error("[AdminControlCenter] Error fetching inspections:", err);
    } finally {
      setLoading(false);
    }
  }

  // 1. KPI COUNTERS (11 Categories)
  const kpis = useMemo(() => {
    let total = inspections.length;
    let spotPending = 0;
    let siteEngPending = 0;
    let qaqcPending = 0;
    let pmPending = 0;
    let mgrTechPending = 0;
    let gmPending = 0;
    let vpPending = 0;
    let completed = 0;
    let rejected = 0;
    let recheckRequired = 0;

    inspections.forEach((i) => {
      const ws = i.workflowStatus || i.status || "DRAFT";
      const { isSpotComplete } = getSpotSignatureState(i);

      if (ws === "COMPLETED") {
        completed++;
      } else if (ws === "REJECTED") {
        rejected++;
      } else if (ws === "RECHECK_REQUIRED") {
        recheckRequired++;
      } else if (!isSpotComplete) {
        spotPending++;
      } else if (ws === "SITE_ENGINEER_PENDING" || ws === "DRAFT" || ws === "draft") {
        siteEngPending++;
      } else if (ws === "QA_QC_PENDING") {
        qaqcPending++;
      } else if (ws === "PROJECT_MANAGER_PENDING") {
        pmPending++;
      } else if (ws === "MANAGER_TECHNICAL_PENDING") {
        mgrTechPending++;
      } else if (ws === "GM_HUG_PENDING") {
        gmPending++;
      } else if (ws === "VP_HUG_PENDING") {
        vpPending++;
      }
    });

    return {
      total,
      spotPending,
      siteEngPending,
      qaqcPending,
      pmPending,
      mgrTechPending,
      gmPending,
      vpPending,
      completed,
      rejected,
      recheckRequired,
    };
  }, [inspections]);

  // Unique Filter Dropdown Lists
  const projectsList = useMemo(() => Array.from(new Set(inspections.map((i) => i.projectName).filter(Boolean))), [inspections]);
  const unitsList = useMemo(() => Array.from(new Set(inspections.map((i) => i.unitNumber).filter(Boolean))), [inspections]);
  const typesList = useMemo(() => Array.from(new Set(inspections.map((i) => i.inspectionType || "INTERIOR JOINT INSPECTION"))), [inspections]);

  // Filtered Inspections List
  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (i.inspectionId && i.inspectionId.toLowerCase().includes(q)) ||
        (i.projectName && i.projectName.toLowerCase().includes(q)) ||
        (i.unitNumber && i.unitNumber.toLowerCase().includes(q)) ||
        (i.customerName && i.customerName.toLowerCase().includes(q));

      const matchProject = filterProject === "ALL" || i.projectName === filterProject;
      const matchUnit = filterUnit === "ALL" || i.unitNumber === filterUnit;
      const matchType = filterType === "ALL" || (i.inspectionType || "INTERIOR JOINT INSPECTION") === filterType;

      const ws = i.workflowStatus || i.status || "DRAFT";
      const matchStatus = filterStatus === "ALL" || ws === filterStatus;

      const { isSpotComplete } = getSpotSignatureState(i);
      let stageMatch = true;
      if (filterStage === "SPOT") stageMatch = !isSpotComplete;
      else if (filterStage === "SITE_ENGINEER") stageMatch = isSpotComplete && ["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws);
      else if (filterStage === "QA_QC") stageMatch = ws === "QA_QC_PENDING";
      else if (filterStage === "PROJECT_MANAGER") stageMatch = ws === "PROJECT_MANAGER_PENDING";
      else if (filterStage === "MANAGER_TECHNICAL") stageMatch = ws === "MANAGER_TECHNICAL_PENDING";
      else if (filterStage === "GM_HUG") stageMatch = ws === "GM_HUG_PENDING";
      else if (filterStage === "VP_HUG") stageMatch = ws === "VP_HUG_PENDING";

      return matchSearch && matchProject && matchUnit && matchType && matchStatus && stageMatch;
    });
  }, [inspections, searchQuery, filterProject, filterUnit, filterType, filterStage, filterStatus]);

  // Ageing Calculator Helper
  const getAgeingDays = (dateStr) => {
    if (!dateStr) return 0;
    try {
      const diffTime = Math.abs(new Date() - new Date(dateStr));
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  // Handle Admin Exceptional Override Action with mandatory Audit Record
  const handlePerformAdminOverride = async (e) => {
    if (e) e.preventDefault();
    if (!overrideReason.trim()) {
      setOverrideError("Mandatory Admin justification comment is required for workflow override.");
      return;
    }
    if (!overridePin || overridePin.trim().length !== 6) {
      setOverrideError("Please enter your 6-digit Admin authorization passcode.");
      return;
    }

    setSubmittingOverride(true);
    setOverrideError("");

    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: selectedInspection.inspectionId,
          role: "Admin",
          userName: currentUserName,
          action: "approve",
          comments: `[ADMIN OVERRIDE to ${overrideTargetStage}]: ${overrideReason.trim()}`,
          passcode: overridePin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Admin override action failed");

      setSelectedInspection(data.inspection);
      setShowOverrideModal(false);
      setOverrideReason("");
      setOverridePin("");
      fetchData();
    } catch (err) {
      setOverrideError(err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  return (
    <div className={`space-y-8 font-body text-slate-900 ${className}`}>

      {/* ─── 1. ADMIN HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold shrink-0 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-mono font-bold mb-1">
              <span>ADMIN CONTROL CENTER</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Approval Control Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live multi-tier inspection oversight & auditable admin control
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* ─── 2. 11-CATEGORY KPI METRIC CARDS ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">Total</p>
          <h3 className="font-display font-extrabold text-2xl text-slate-900">{kpis.total}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 mb-1">Spot Pending</p>
          <h3 className="font-display font-extrabold text-2xl text-amber-600">{kpis.spotPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">Site Eng</p>
          <h3 className="font-display font-extrabold text-2xl text-blue-600">{kpis.siteEngPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">QA/QC</p>
          <h3 className="font-display font-extrabold text-2xl text-blue-600">{kpis.qaqcPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">Project Mgr</p>
          <h3 className="font-display font-extrabold text-2xl text-blue-600">{kpis.pmPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">Mgr Tech</p>
          <h3 className="font-display font-extrabold text-2xl text-blue-600">{kpis.mgrTechPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">GM – HUG</p>
          <h3 className="font-display font-extrabold text-2xl text-blue-600">{kpis.gmPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">VP – HUG</p>
          <h3 className="font-display font-extrabold text-2xl text-blue-600">{kpis.vpPending}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 mb-1">Completed</p>
          <h3 className="font-display font-extrabold text-2xl text-emerald-600">{kpis.completed}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 mb-1">Rejected</p>
          <h3 className="font-display font-extrabold text-2xl text-rose-600">{kpis.rejected}</h3>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 mb-1">Re-check Req</p>
          <h3 className="font-display font-extrabold text-2xl text-amber-600">{kpis.recheckRequired}</h3>
        </div>
      </div>

      {/* ─── 3. MULTI-LEVEL FILTER CONTROL BAR ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b pb-3">
          <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-purple-600" /> Admin Filter Engine
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Showing {filteredInspections.length} of {inspections.length} Records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Query */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Search ID / Name</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full text-xs rounded-xl border border-slate-200 pl-8 pr-3 py-2 bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Project</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Projects</option>
              {projectsList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Unit Number</label>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Units</option>
              {unitsList.map((u) => <option key={u} value={u}>Unit {u}</option>)}
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Current Stage</label>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Stages</option>
              <option value="SPOT">Spot Signature Pending</option>
              <option value="SITE_ENGINEER">Site Engineer</option>
              <option value="QA_QC">QA/QC In-Charge</option>
              <option value="PROJECT_MANAGER">Project Manager</option>
              <option value="MANAGER_TECHNICAL">Manager Technical</option>
              <option value="GM_HUG">GM – HUG</option>
              <option value="VP_HUG">VP – HUG</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Overall Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SITE_ENGINEER_PENDING">SITE_ENGINEER_PENDING</option>
              <option value="QA_QC_PENDING">QA_QC_PENDING</option>
              <option value="PROJECT_MANAGER_PENDING">PROJECT_MANAGER_PENDING</option>
              <option value="MANAGER_TECHNICAL_PENDING">MANAGER_TECHNICAL_PENDING</option>
              <option value="GM_HUG_PENDING">GM_HUG_PENDING</option>
              <option value="VP_HUG_PENDING">VP_HUG_PENDING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="RECHECK_REQUIRED">RECHECK_REQUIRED</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── 4. INSPECTIONS RECORD DATA TABLE ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Master Inspection Register
        </h3>

        {filteredInspections.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed rounded-2xl">
            No inspection records match current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-body">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Inspection ID</th>
                  <th className="p-3">Project / Unit</th>
                  <th className="p-3">Inspection Type</th>
                  <th className="p-3">Spot Signature Status</th>
                  <th className="p-3">Current Approval Stage</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Updated</th>
                  <th className="p-3">Ageing</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInspections.map((item) => {
                  const ws = item.workflowStatus || item.status || "DRAFT";
                  const spotState = getSpotSignatureState(item);
                  const ageingDays = getAgeingDays(item.updatedAt || item.createdAt);

                  return (
                    <tr key={item.inspectionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-600">{item.inspectionId}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{item.projectName}</p>
                        <p className="font-mono text-amber-600 font-bold text-[11px]">Unit {item.unitNumber}</p>
                      </td>
                      <td className="p-3 text-slate-600">{item.inspectionType || "IJI"}</td>

                      {/* Spot Signature Status */}
                      <td className="p-3">
                        {spotState.isSpotComplete ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                            ✓ Complete
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                            {!spotState.hasCustomerSigned ? "Missing Customer" : "Missing Tech Exec"}
                          </span>
                        )}
                      </td>

                      {/* Current Approval Stage */}
                      <td className="p-3 font-semibold text-slate-800">
                        {ws === "COMPLETED"
                          ? "COMPLETED"
                          : ws === "REJECTED"
                          ? "REJECTED"
                          : !spotState.isSpotComplete
                          ? "Spot Signatures"
                          : ws.replaceAll("_", " ")}
                      </td>

                      {/* Overall Status */}
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
                          ws === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : ws === "REJECTED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : ws === "RECHECK_REQUIRED"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}>
                          {ws}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-slate-400 text-[11px]">
                        {new Date(item.updatedAt || Date.now()).toLocaleDateString("en-GB")}
                      </td>

                      <td className="p-3 font-mono text-slate-700 font-bold text-[11px]">
                        {ageingDays} d
                      </td>

                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedInspection(item);
                            setDetailModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold border border-slate-200 flex items-center gap-1 ml-auto transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. INSPECTION DETAIL DRAWER / MODAL ──────────────────────────── */}
      {detailModalOpen && selectedInspection && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDetailModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <span>ID: {selectedInspection.inspectionId}</span>
                  <span>•</span>
                  <span>{selectedInspection.projectName}</span>
                  <span>•</span>
                  <span className="text-amber-600 font-bold">Unit {selectedInspection.unitNumber}</span>
                </div>
                <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">
                  Inspection Control Matrix & Audit Log
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" /> PDF
                </button>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/50 px-4 text-xs font-bold font-body overflow-x-auto">
              {[
                { id: "details", label: "Details" },
                { id: "checklist", label: "Checklist" },
                { id: "signatures", label: "Signatures" },
                { id: "history", label: "Approval History" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id)}
                  className={`px-4 py-3 border-b-2 transition-all shrink-0 ${
                    activeDetailTab === tab.id
                      ? "border-purple-600 text-purple-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {activeDetailTab === "details" && (
                <div className="space-y-6">
                  {/* Timeline Stepper */}
                  <WorkflowStepper inspection={selectedInspection} currentUserRole="Admin" />

                  {/* Summary Properties */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-body">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 block mb-1 font-mono">Customer Name</span>
                      <span className="font-bold text-slate-900">{selectedInspection.customerName || "N/A"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 block mb-1 font-mono">Handover Date</span>
                      <span className="font-bold text-slate-900">{selectedInspection.handoverDate || "N/A"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 block mb-1 font-mono">Completion %</span>
                      <span className="font-bold font-mono text-blue-700">{selectedInspection.completionPct || "0%"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 block mb-1 font-mono">Workflow Status</span>
                      <span className="font-bold font-mono text-purple-700">{selectedInspection.workflowStatus || selectedInspection.status}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === "checklist" && (
                <div className="space-y-3 font-body text-xs">
                  <h4 className="font-bold text-slate-900 border-b pb-2">Checklist Summary Matrix</h4>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-slate-600">Total Cells Recorded: <b>{Object.keys(selectedInspection.cells || {}).length}</b></p>
                  </div>
                </div>
              )}

              {activeDetailTab === "signatures" && (
                <div className="space-y-4 font-body text-xs">
                  <h4 className="font-bold text-slate-900 border-b pb-2">Spot & Workflow Signatures</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="font-bold text-slate-800 mb-1">Customer Spot Signature</p>
                      {selectedInspection.signatures?.customer ? (
                        <div className="h-16 rounded-lg bg-white border border-emerald-300 p-1 flex items-center justify-center">
                          <img src={selectedInspection.signatures.customer.dataUrl || selectedInspection.signatures.customer} className="h-full object-contain" alt="Customer" />
                        </div>
                      ) : (
                        <span className="text-amber-700 font-mono font-bold">Not Signed</span>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="font-bold text-slate-800 mb-1">Technical Executive Spot Signature</p>
                      {selectedInspection.signatures?.technicalExecutive ? (
                        <div className="h-16 rounded-lg bg-white border border-emerald-300 p-1 flex items-center justify-center">
                          <img src={selectedInspection.signatures.technicalExecutive.dataUrl || selectedInspection.signatures.technicalExecutive} className="h-full object-contain" alt="Tech Exec" />
                        </div>
                      ) : (
                        <span className="text-amber-700 font-mono font-bold">Not Signed</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === "history" && (
                <div className="space-y-3 font-body text-xs">
                  <h4 className="font-bold text-slate-900 border-b pb-2">Chronological Approval Audit History</h4>
                  {(selectedInspection.approvalHistory || []).length === 0 ? (
                    <p className="text-slate-400 font-mono text-center p-4">No audit history records available.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedInspection.approvalHistory.map((item, idx) => (
                        <div key={item.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <span>{item.role}</span>
                              <span className="text-slate-400">•</span>
                              <span>{item.userName}</span>
                            </div>
                            <p className="text-slate-600 mt-1">Action: <b>{item.action}</b> (Status: <span className="font-mono">{item.status}</span>)</p>
                            {item.comments && <p className="text-slate-500 italic mt-1 font-body">"{item.comments}"</p>}
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">{item.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Bar with Explicit Admin Override Action Button */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setShowOverrideModal(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Audited Admin Override</span>
              </button>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. AUDITED ADMIN OVERRIDE MODAL ─────────────────────────────── */}
      {showOverrideModal && selectedInspection && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowOverrideModal(false)}
        >
          <form
            onSubmit={handlePerformAdminOverride}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowOverrideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">
                  Exceptional Admin Override
                </h3>
                <p className="text-xs text-slate-500">
                  Action will be explicitly logged in permanent audit trail.
                </p>
              </div>
            </div>

            {overrideError && (
              <div className="mb-4 text-xs font-body text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{overrideError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs font-body">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Stage Transition</label>
                <select
                  value={overrideTargetStage}
                  onChange={(e) => setOverrideTargetStage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                >
                  <option value="SITE_ENGINEER_PENDING">SITE_ENGINEER_PENDING</option>
                  <option value="QA_QC_PENDING">QA_QC_PENDING</option>
                  <option value="PROJECT_MANAGER_PENDING">PROJECT_MANAGER_PENDING</option>
                  <option value="MANAGER_TECHNICAL_PENDING">MANAGER_TECHNICAL_PENDING</option>
                  <option value="GM_HUG_PENDING">GM_HUG_PENDING</option>
                  <option value="VP_HUG_PENDING">VP_HUG_PENDING</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  6-Digit Admin Passcode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={overridePin}
                  onChange={(e) => setOverridePin(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                  className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Mandatory Override Reason / Audit Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="Detail explicit business reason for admin override..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingOverride}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20"
              >
                {submittingOverride ? "Recording..." : "Confirm Audited Override"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 7. PRINT PDF MODAL ───────────────────────────────────────────── */}
      {showPrintModal && selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-display font-bold text-base text-slate-900">Official Document Print Preview</h3>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
              <JointInspectionPrintDoc inspection={selectedInspection} />
            </div>
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                Close
              </button>
              <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md flex items-center gap-1.5">
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
