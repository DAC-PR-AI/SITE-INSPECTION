"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Building2, Search, Bell, Plus, CheckCircle2, XCircle, Clock,
  AlertTriangle, ShieldCheck, Layers, FileText, ChevronRight,
  LayoutDashboard, ClipboardCheck, FolderGit2, Home, Camera,
  TrendingUp, BarChart3, Settings, AlertCircle, Menu, X, ArrowUpRight,
  UserCheck, RefreshCw, Eye, CheckSquare
} from "lucide-react";
import DefectsAndPhotosManager from "./DefectsAndPhotosManager";
import AdminApprovalControlCenter from "./AdminApprovalControlCenter";
import QualityAnalyticsDashboard from "./QualityAnalyticsDashboard";
import InspectionIntelligence from "./InspectionIntelligence";
import ApprovalSlaAndAgeing from "./ApprovalSlaAndAgeing";
import NotificationCenter from "./NotificationCenter";
import GlobalSearchSystem from "./GlobalSearchSystem";
import InternalReportCenter from "./InternalReportCenter";
import SheetReconciliationCenter from "./SheetReconciliationCenter";
import SheetConnectionMonitor from "./SheetConnectionMonitor";

function computeStats(inspection) {
  const cells = inspection?.cells || {};
  let passed = 0;
  let failed = 0;
  let na = 0;

  Object.values(cells).forEach((c) => {
    if (c?.status === "pass") passed++;
    else if (c?.status === "fail") failed++;
    else if (c?.status === "na") na++;
  });

  return { passed, failed, na };
}

export default function QualityControlDashboard({
  onNewInspection,
  onOpenInspection,
  onOpenApprovalPortal,
  currentUserRole = "Admin",
  currentUserName = "Administrator",
}) {
  const [inspections, setInspections] = useState([]);
  const [projectsMap, setProjectsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard"); // dashboard | inspections | projects | units | defects | photos | approvals | analytics | reports | settings
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeFilterStatus, setActiveFilterStatus] = useState("ALL");
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(new Date().toLocaleString("en-GB"));

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [inspecRes, projRes] = await Promise.all([
        fetch("/api/approval?role=Admin"),
        fetch("/api/projects"),
      ]);

      const inspecData = await inspecRes.json();
      const projData = await projRes.json();

      if (inspecData.inspections) {
        setInspections(inspecData.inspections);
      }
      if (projData.projects) {
        setProjectsMap(projData.projects);
      }
      setLastSyncTimestamp(new Date().toLocaleString("en-GB"));
    } catch (err) {
      console.error("[Dashboard] Error fetching real data:", err);
    } finally {
      setLoading(false);
    }
  }

  // 1. KPI Cards Metrics
  const metrics = useMemo(() => {
    const total = inspections.length;
    let inProgress = 0;
    let pendingApproval = 0;
    let completed = 0;

    inspections.forEach((item) => {
      const ws = item.workflowStatus || item.status || "DRAFT";
      if (ws === "COMPLETED") {
        completed++;
      } else if (["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws)) {
        inProgress++;
      } else if (ws === "REJECTED") {
        inProgress++;
      } else {
        pendingApproval++;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, inProgress, pendingApproval, completed, completionRate };
  }, [inspections]);

  // 2. Project Progress Data
  const projectProgress = useMemo(() => {
    const list = [];
    Object.entries(projectsMap).forEach(([projName, units]) => {
      const totalUnits = Array.isArray(units) ? units.length : 0;
      const projInspections = inspections.filter((i) => i.projectName === projName);
      const completed = projInspections.filter((i) => (i.workflowStatus || i.status) === "COMPLETED").length;
      const pending = projInspections.filter((i) => (i.workflowStatus || i.status) !== "COMPLETED").length;
      const pct = totalUnits > 0 ? Math.round((completed / totalUnits) * 100) : 0;

      list.push({
        project: projName,
        totalUnits,
        completed,
        pending,
        pct,
      });
    });
    return list;
  }, [projectsMap, inspections]);

  // 3. Approval Pipeline Metrics
  const pipelineMetrics = useMemo(() => {
    const stages = [
      { id: "Site Engineer", label: "Site Engineer" },
      { id: "Customer", label: "Customer" },
      { id: "QA/QC", label: "QA/QC" },
      { id: "Project Manager", label: "Project Manager" },
      { id: "Technical Executive", label: "Technical Executive" },
      { id: "Manager Technical", label: "Manager Technical" },
      { id: "GM – HUG", label: "GM – HUG" },
      { id: "VP – HUG", label: "VP – HUG" },
    ];

    return stages.map((stg) => {
      let completedCount = 0;
      let currentCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;

      inspections.forEach((i) => {
        const ws = i.workflowStatus || i.status || "DRAFT";
        const sigs = i.signatures || {};

        if (stg.id === "Customer") {
          if (sigs.customer) completedCount++;
          else pendingCount++;
        } else if (stg.id === "Technical Executive") {
          if (sigs.technicalExecutive) completedCount++;
          else pendingCount++;
        } else if (stg.id === "Site Engineer") {
          if (["QA_QC_PENDING", "PROJECT_MANAGER_PENDING", "MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING", "VP_HUG_PENDING", "COMPLETED"].includes(ws)) completedCount++;
          else if (["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws)) currentCount++;
          else if (ws === "REJECTED") rejectedCount++;
        } else if (stg.id === "QA/QC") {
          if (["PROJECT_MANAGER_PENDING", "MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING", "VP_HUG_PENDING", "COMPLETED"].includes(ws)) completedCount++;
          else if (ws === "QA_QC_PENDING") currentCount++;
          else if (ws === "REJECTED") rejectedCount++;
          else pendingCount++;
        } else if (stg.id === "Project Manager") {
          if (["MANAGER_TECHNICAL_PENDING", "GM_HUG_PENDING", "VP_HUG_PENDING", "COMPLETED"].includes(ws)) completedCount++;
          else if (ws === "PROJECT_MANAGER_PENDING") currentCount++;
          else if (ws === "REJECTED") rejectedCount++;
          else pendingCount++;
        } else if (stg.id === "Manager Technical") {
          if (["GM_HUG_PENDING", "VP_HUG_PENDING", "COMPLETED"].includes(ws)) completedCount++;
          else if (ws === "MANAGER_TECHNICAL_PENDING") currentCount++;
          else if (ws === "REJECTED") rejectedCount++;
          else pendingCount++;
        } else if (stg.id === "GM – HUG") {
          if (["VP_HUG_PENDING", "COMPLETED"].includes(ws)) completedCount++;
          else if (ws === "GM_HUG_PENDING") currentCount++;
          else if (ws === "REJECTED") rejectedCount++;
          else pendingCount++;
        } else if (stg.id === "VP – HUG") {
          if (ws === "COMPLETED") completedCount++;
          else if (ws === "VP_HUG_PENDING") currentCount++;
          else if (ws === "REJECTED") rejectedCount++;
          else pendingCount++;
        }
      });

      return {
        ...stg,
        completed: completedCount,
        current: currentCount,
        pending: pendingCount,
        rejected: rejectedCount,
      };
    });
  }, [inspections]);

  // 4. Quality Summary Metrics
  const qualitySummary = useMemo(() => {
    let passedItems = 0;
    let failedItems = 0;
    let naItems = 0;
    let recheckRequired = 0;

    inspections.forEach((i) => {
      const stats = computeStats(i);
      passedItems += stats.passed;
      failedItems += stats.failed;
      naItems += stats.na;

      if (i.workflowStatus === "REJECTED" || stats.failed > 0) {
        recheckRequired++;
      }
    });

    return {
      passedItems,
      failedItems,
      naItems,
      openDefects: failedItems,
      recheckRequired,
    };
  }, [inspections]);

  // Filtered Inspections List for Table
  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (i.inspectionId && i.inspectionId.toLowerCase().includes(q)) ||
        (i.projectName && i.projectName.toLowerCase().includes(q)) ||
        (i.unitNumber && i.unitNumber.toLowerCase().includes(q)) ||
        (i.customerName && i.customerName.toLowerCase().includes(q));

      const ws = i.workflowStatus || i.status || "DRAFT";
      const matchStatus =
        activeFilterStatus === "ALL" ||
        (activeFilterStatus === "COMPLETED" && ws === "COMPLETED") ||
        (activeFilterStatus === "PENDING" && ws !== "COMPLETED" && ws !== "REJECTED") ||
        (activeFilterStatus === "REJECTED" && ws === "REJECTED");

      return matchSearch && matchStatus;
    });
  }, [inspections, searchQuery, activeFilterStatus]);

  // Sidebar Menu Structure
  const sidebarSections = [
    {
      title: "MAIN",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "inspections", label: "Inspections", icon: ClipboardCheck },
        { id: "projects", label: "Projects", icon: Building2 },
        { id: "units", label: "Units", icon: Home },
      ],
    },
    {
      title: "QUALITY",
      items: [
        { id: "defects", label: "Defects", icon: AlertTriangle },
        { id: "photos", label: "Photos", icon: Camera },
        { id: "approvals", label: "Approvals", icon: ShieldCheck },
      ],
    },
    {
      title: "MANAGEMENT",
      items: [
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "reports", label: "Reports", icon: FileText },
        { id: "settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const renderDashboardOverview = () => {
    return (
      <React.Fragment>
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 font-mono">Total Inspections</p>
              <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900">{metrics.total}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-body">Recorded in system</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 font-mono">In Progress</p>
              <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-amber-600">{metrics.inProgress}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-body">Active site evaluations</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 font-mono">Pending Approval</p>
              <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-blue-600">{metrics.pendingApproval}</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-body">In management queue</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 font-mono">Completion Rate</p>
              <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-emerald-600">{metrics.completionRate}%</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-body">{metrics.completed} fully approved</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* PROJECT PROGRESS & QUALITY SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h2 className="font-display font-bold text-base sm:text-lg text-slate-900">
                    Project Progress Overview
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">{projectProgress.length} Active Projects</span>
              </div>

              {projectProgress.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  No project progress data recorded yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {projectProgress.map((proj) => (
                    <div key={proj.project} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div>
                          <h3 className="font-body font-bold text-xs sm:text-sm text-slate-900">{proj.project}</h3>
                          <p className="text-[11px] text-slate-500">
                            Total Units: <b className="text-slate-700">{proj.totalUnits}</b> • Completed: <b className="text-emerald-700">{proj.completed}</b> • Pending: <b className="text-amber-700">{proj.pending}</b>
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {proj.pct}% Complete
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 via-amber-400 to-emerald-400 transition-all duration-500"
                          style={{ width: `${proj.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                <h2 className="font-display font-bold text-base sm:text-lg text-slate-900">
                  Quality Summary
                </h2>
              </div>

              <div className="space-y-3 font-body">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Passed Items
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-700">{qualitySummary.passedItems}</span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-900 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" /> Failed Items
                  </span>
                  <span className="font-mono text-sm font-bold text-rose-700">{qualitySummary.failedItems}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" /> N/A Items
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-700">{qualitySummary.naItems}</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Open Defects
                  </span>
                  <span className="font-mono text-sm font-bold text-amber-700">{qualitySummary.openDefects}</span>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" /> Re-check Required
                  </span>
                  <span className="font-mono text-sm font-bold text-blue-700">{qualitySummary.recheckRequired}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* APPROVAL PIPELINE BREAKDOWN */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h2 className="font-display font-bold text-base sm:text-lg text-slate-900">
                Multi-Tier Approval Pipeline Tracker
              </h2>
            </div>
            <button
              onClick={onOpenApprovalPortal}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Open Portal Queue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pipelineMetrics.map((stg) => (
              <div key={stg.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors font-body">
                <h3 className="font-bold text-xs text-slate-900 mb-2 truncate">{stg.label}</h3>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    ✓ Completed: <b>{stg.completed}</b>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                    ● Current: <b>{stg.current}</b>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    ⏳ Pending: <b>{stg.pending}</b>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
                    ✕ Rejected: <b>{stg.rejected}</b>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT INSPECTIONS TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-slate-900">
                Recent Joint Inspections
              </h2>
              <p className="text-xs text-slate-500 font-body">
                Real-time record table from database
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-body">
              {["ALL", "PENDING", "COMPLETED", "REJECTED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setActiveFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    activeFilterStatus === st
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredInspections.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No inspection records matching current query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Inspection ID</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Inspection Type</th>
                    <th className="p-3">Completion</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Updated At</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInspections.map((item) => {
                    const ws = item.workflowStatus || item.status || "DRAFT";
                    const isCompleted = ws === "COMPLETED";
                    const isRejected = ws === "REJECTED";

                    return (
                      <tr key={item.inspectionId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-600">{item.inspectionId}</td>
                        <td className="p-3 font-semibold text-slate-800">{item.projectName || "N/A"}</td>
                        <td className="p-3 font-bold text-amber-600">{item.unitNumber || "N/A"}</td>
                        <td className="p-3 text-slate-600">{item.inspectionType || "IJI"}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {item.completionPct || "0%"}
                        </td>
                        <td className="p-3">
                          {isCompleted ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ✓ Completed
                            </span>
                          ) : isRejected ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              ✕ Rejected
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              ● {ws.replaceAll("_", " ")}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-400">{formatDate(item.updatedAt)}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              if (onOpenInspection) {
                                onOpenInspection(item.inspectionId);
                              } else if (onOpenApprovalPortal) {
                                onOpenApprovalPortal(item.inspectionId);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold border border-slate-200 flex items-center gap-1 ml-auto transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
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
      </React.Fragment>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] font-body flex text-slate-900">

      {/* SIDEBAR NAVIGATION */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
                <Building2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-sm tracking-tight text-white flex items-center gap-1">
                  DAC DEVELOPERS
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                </h1>
                <p className="text-[9.5px] text-slate-400 font-mono tracking-widest uppercase">
                  Quality Control Center
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-6 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
            {sidebarSections.map((sec) => (
              <div key={sec.title}>
                <p className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-2 px-3">
                  {sec.title}
                </p>
                <div className="space-y-1">
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveNav(item.id);
                          if (item.id === "approvals" && onOpenApprovalPortal) {
                            onOpenApprovalPortal();
                          }
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.id === "approvals" && metrics.pendingApproval > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                            {metrics.pendingApproval}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 px-2 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white truncate text-xs">{currentUserName}</p>
              <p className="text-[10px] font-mono text-slate-400 truncate">{currentUserRole}</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* TOP BAR */}
        <header className="sticky top-0 z-20 glass-header px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900 p-2 rounded-xl border border-slate-200 bg-white shadow-xs"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              className="relative w-48 sm:w-72 cursor-pointer"
              onClick={() => setSearchModalOpen(true)}
            >
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-blue-600" />
              <input
                type="text"
                readOnly
                placeholder="Global Search (Ctrl+K)..."
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              title="Refresh Data"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifCenterOpen(true)}
                title="Notifications"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs relative"
              >
                <Bell className="w-4 h-4 text-blue-600" />
                {metrics.pendingApproval > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-600 absolute top-1.5 right-1.5 animate-pulse" />
                )}
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                {currentUserName.charAt(0)}
              </div>
              <div className="text-left text-xs font-body">
                <p className="font-bold text-slate-900 leading-tight">{currentUserName}</p>
                <p className="text-[10px] text-slate-500 font-mono">{currentUserRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* DASHBOARD BODY */}
        <main className="p-4 sm:p-8 space-y-8 flex-1 max-w-7xl w-full mx-auto">
          {/* DASHBOARD HEADER */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>DAC QUALITY CONTROL CENTER</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Quality Control Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-3">
                Joint Inspection & Key Handover Intelligence Platform
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Data Source: <b>Google Sheet</b>
                </span>
                <span className="text-slate-500">
                  Last Sync: <b>{lastSyncTimestamp}</b>
                </span>
              </div>
            </div>

            <button
              onClick={onNewInspection}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ New Inspection</span>
            </button>
          </div>

          {activeNav === "defects" || activeNav === "photos" ? (
            <DefectsAndPhotosManager
              mode={activeNav}
              inspections={inspections}
              onRefreshData={fetchDashboardData}
            />
          ) : activeNav === "approvals" ? (
            <AdminApprovalControlCenter
              onOpenInspection={onOpenInspection}
              currentUserName={currentUserName}
            />
          ) : activeNav === "analytics" ? (
            <div className="space-y-8">
              <ApprovalSlaAndAgeing onOpenInspection={onOpenInspection} />
              <InspectionIntelligence onOpenInspection={onOpenInspection} />
              <QualityAnalyticsDashboard />
            </div>
          ) : activeNav === "reports" ? (
            <InternalReportCenter
              inspections={inspections}
              projectsMap={projectsMap}
              onOpenInspection={onOpenInspection}
            />
          ) : activeNav === "reconciliation" ? (
            <div className="space-y-8">
              <SheetConnectionMonitor />
              <SheetReconciliationCenter onRefreshData={fetchDashboardData} />
            </div>
          ) : activeNav === "settings" ? (
            <div className="space-y-8">
              <SheetConnectionMonitor />
            </div>
          ) : (
            renderDashboardOverview()
          )}
        </main>
      </div>

      <NotificationCenter
        isOpen={notifCenterOpen}
        onClose={() => setNotifCenterOpen(false)}
        onOpenInspection={onOpenInspection}
        userRole={currentUserRole}
        inspections={inspections}
      />

      <GlobalSearchSystem
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onOpenInspection={onOpenInspection}
        onNavigateNav={(nav) => setActiveNav(nav)}
      />
    </div>
  );
}
