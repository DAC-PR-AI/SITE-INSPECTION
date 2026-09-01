"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3, TrendingUp, PieChart, Building2, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Filter, RefreshCw, FileText, SlidersHorizontal,
  Calendar, Layers, CheckSquare, Activity, UserCheck, ArrowUpRight, MinusCircle
} from "lucide-react";
import { getSpotSignatureState } from "../lib/workflow";

export default function QualityAnalyticsDashboard({ className = "" }) {
  const [inspections, setInspections] = useState([]);
  const [projectsMap, setProjectsMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProject, setFilterProject] = useState("ALL");
  const [filterUnit, setFilterUnit] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterStage, setFilterStage] = useState("ALL");

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  async function fetchAnalyticsData() {
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
    } catch (err) {
      console.error("[QualityAnalytics] Error fetching real analytics data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filtered Inspections set for dynamic updates
  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const matchProject = filterProject === "ALL" || i.projectName === filterProject;
      const matchUnit = filterUnit === "ALL" || i.unitNumber === filterUnit;
      const matchType = filterType === "ALL" || (i.inspectionType || "INTERIOR JOINT INSPECTION") === filterType;

      const ws = i.workflowStatus || i.status || "DRAFT";
      const matchStatus = filterStatus === "ALL" || ws === filterStatus;

      const { isSpotComplete } = getSpotSignatureState(i);
      let matchStage = true;
      if (filterStage === "SPOT") matchStage = !isSpotComplete;
      else if (filterStage === "SITE_ENGINEER") matchStage = isSpotComplete && ["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws);
      else if (filterStage === "QA_QC") matchStage = ws === "QA_QC_PENDING";
      else if (filterStage === "PROJECT_MANAGER") matchStage = ws === "PROJECT_MANAGER_PENDING";
      else if (filterStage === "MANAGER_TECHNICAL") matchStage = ws === "MANAGER_TECHNICAL_PENDING";
      else if (filterStage === "GM_HUG") matchStage = ws === "GM_HUG_PENDING";
      else if (filterStage === "VP_HUG") matchStage = ws === "VP_HUG_PENDING";

      return matchProject && matchUnit && matchType && matchStatus && matchStage;
    });
  }, [inspections, filterProject, filterUnit, filterType, filterStatus, filterStage]);

  // Unique Lists for Dropdown Filters
  const projectsList = useMemo(() => Array.from(new Set(inspections.map((i) => i.projectName).filter(Boolean))), [inspections]);
  const unitsList = useMemo(() => Array.from(new Set(inspections.map((i) => i.unitNumber).filter(Boolean))), [inspections]);
  const typesList = useMemo(() => Array.from(new Set(inspections.map((i) => i.inspectionType || "INTERIOR JOINT INSPECTION"))), [inspections]);

  // 1. QUALITY OVERVIEW COMPUTATION
  const qualityOverview = useMemo(() => {
    const total = filteredInspections.length;
    let completed = 0;
    let inProgress = 0;
    let pendingApproval = 0;
    let recheckRequired = 0;
    let rejected = 0;

    let totalCells = 0;
    let passedCells = 0;
    let failedCells = 0;
    let naCells = 0;

    filteredInspections.forEach((i) => {
      const ws = i.workflowStatus || i.status || "DRAFT";
      if (ws === "COMPLETED") completed++;
      else if (ws === "REJECTED") rejected++;
      else if (ws === "RECHECK_REQUIRED") recheckRequired++;
      else if (["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws)) inProgress++;
      else pendingApproval++;

      // Checklist cell analysis
      const cells = i.cells || {};
      Object.values(cells).forEach((c) => {
        totalCells++;
        if (c?.status === "pass") passedCells++;
        else if (c?.status === "fail") failedCells++;
        else if (c?.status === "na") naCells++;
      });
    });

    const passPct = totalCells > 0 ? Math.round((passedCells / totalCells) * 100) : 0;
    const failPct = totalCells > 0 ? Math.round((failedCells / totalCells) * 100) : 0;
    const naPct = totalCells > 0 ? Math.round((naCells / totalCells) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      pendingApproval,
      recheckRequired,
      rejected,
      totalDefects: failedCells,
      openDefects: failedCells, // Active failed cells
      resolvedDefects: 0,
      totalCells,
      passedCells,
      failedCells,
      naCells,
      passPct,
      failPct,
      naPct,
    };
  }, [filteredInspections]);

  // 2. PROJECT ANALYTICS COMPUTATION
  const projectAnalytics = useMemo(() => {
    const map = {};
    Object.entries(projectsMap).forEach(([projName, units]) => {
      const totalUnits = Array.isArray(units) ? units.length : 0;
      map[projName] = {
        project: projName,
        totalUnits,
        inspectionsCount: 0,
        completed: 0,
        pending: 0,
        defects: 0,
        rechecks: 0,
        pct: 0,
      };
    });

    filteredInspections.forEach((i) => {
      const name = i.projectName || "Default Project";
      if (!map[name]) {
        map[name] = {
          project: name,
          totalUnits: 0,
          inspectionsCount: 0,
          completed: 0,
          pending: 0,
          defects: 0,
          rechecks: 0,
          pct: 0,
        };
      }

      map[name].inspectionsCount++;
      const ws = i.workflowStatus || i.status || "DRAFT";
      if (ws === "COMPLETED") map[name].completed++;
      else map[name].pending++;

      if (ws === "RECHECK_REQUIRED") map[name].rechecks++;

      // Defects count
      const cells = i.cells || {};
      Object.values(cells).forEach((c) => {
        if (c?.status === "fail") map[name].defects++;
      });
    });

    Object.values(map).forEach((p) => {
      const denom = p.totalUnits > 0 ? p.totalUnits : p.inspectionsCount;
      p.pct = denom > 0 ? Math.round((p.completed / denom) * 100) : 0;
    });

    return Object.values(map);
  }, [projectsMap, filteredInspections]);

  // 3. DEFECT BREAKDOWN COMPUTATION
  const defectBreakdown = useMemo(() => {
    const areaMap = {};
    filteredInspections.forEach((i) => {
      const cells = i.cells || {};
      Object.entries(cells).forEach(([key, cell]) => {
        if (cell?.status === "fail") {
          const areaName = cell.area || key.split("-")[1] || "General";
          if (!areaMap[areaName]) areaMap[areaName] = 0;
          areaMap[areaName]++;
        }
      });
    });

    return Object.entries(areaMap).map(([area, count]) => ({ area, count }));
  }, [filteredInspections]);

  // 4. APPROVAL PIPELINE METRICS COMPUTATION
  const approvalPipeline = useMemo(() => {
    const stages = [
      { key: "siteEngineer", name: "Site Engineer" },
      { key: "qaqc", name: "QA / QC In-Charge" },
      { key: "projectManager", name: "Project Manager" },
      { key: "managerTechnical", name: "Manager – Technical" },
      { key: "gmHug", name: "GM – HUG" },
      { key: "vpHug", name: "VP – HUG" },
    ];

    return stages.map((stg) => {
      let pendingCount = 0;

      filteredInspections.forEach((i) => {
        const ws = i.workflowStatus || i.status || "DRAFT";
        const { isSpotComplete } = getSpotSignatureState(i);

        if (stg.key === "siteEngineer" && isSpotComplete && ["DRAFT", "SITE_ENGINEER_PENDING", "draft"].includes(ws)) pendingCount++;
        else if (stg.key === "qaqc" && ws === "QA_QC_PENDING") pendingCount++;
        else if (stg.key === "projectManager" && ws === "PROJECT_MANAGER_PENDING") pendingCount++;
        else if (stg.key === "managerTechnical" && ws === "MANAGER_TECHNICAL_PENDING") pendingCount++;
        else if (stg.key === "gmHug" && ws === "GM_HUG_PENDING") pendingCount++;
        else if (stg.key === "vpHug" && ws === "VP_HUG_PENDING") pendingCount++;
      });

      return {
        ...stg,
        pendingCount,
      };
    });
  }, [filteredInspections]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed rounded-3xl bg-white space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p>Loading real DAC quality analytics from database...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 font-body text-slate-900 ${className}`}>
      
      {/* ─── 1. HEADER ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold mb-1">
              <span>REAL-TIME INTELLIGENCE ENGINE</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Quality Analytics Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical quality metrics & approval pipeline analytics
            </p>
          </div>
        </div>

        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-blue-600" />
          <span>Sync Analytics</span>
        </button>
      </div>

      {/* ─── 2. DYNAMIC FILTERS BAR ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-display font-bold text-xs text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Dynamic Analytics Filters
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Analyzed {filteredInspections.length} Records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Project</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Projects</option>
              {projectsList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-600 block mb-1">Unit</label>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Units</option>
              {unitsList.map((u) => <option key={u} value={u}>Unit {u}</option>)}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-600 block mb-1">Inspection Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Types</option>
              {typesList.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-600 block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
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

          <div>
            <label className="font-semibold text-slate-600 block mb-1">Approval Stage</label>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-slate-50 focus:bg-white"
            >
              <option value="ALL">All Stages</option>
              <option value="SPOT">Spot Signatures Pending</option>
              <option value="SITE_ENGINEER">Site Engineer</option>
              <option value="QA_QC">QA/QC In-Charge</option>
              <option value="PROJECT_MANAGER">Project Manager</option>
              <option value="MANAGER_TECHNICAL">Manager Technical</option>
              <option value="GM_HUG">GM – HUG</option>
              <option value="VP_HUG">VP – HUG</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── 3. QUALITY OVERVIEW ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" /> Quality Overview
        </h2>

        {qualityOverview.total === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-2xl bg-white">
            Not enough data available for current filter selection.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">Total</p>
              <h3 className="font-display font-extrabold text-2xl text-slate-900">{qualityOverview.total}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 mb-1">Completed</p>
              <h3 className="font-display font-extrabold text-2xl text-emerald-600">{qualityOverview.completed}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 mb-1">In Progress</p>
              <h3 className="font-display font-extrabold text-2xl text-amber-600">{qualityOverview.inProgress}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 mb-1">Pending Appr</p>
              <h3 className="font-display font-extrabold text-2xl text-blue-600">{qualityOverview.pendingApproval}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 mb-1">Re-checks</p>
              <h3 className="font-display font-extrabold text-2xl text-amber-600">{qualityOverview.recheckRequired}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 mb-1">Rejected</p>
              <h3 className="font-display font-extrabold text-2xl text-rose-600">{qualityOverview.rejected}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">Total Defects</p>
              <h3 className="font-display font-extrabold text-2xl text-slate-900">{qualityOverview.totalDefects}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 mb-1">Open Defects</p>
              <h3 className="font-display font-extrabold text-2xl text-rose-600">{qualityOverview.openDefects}</h3>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 mb-1">Resolved</p>
              <h3 className="font-display font-extrabold text-2xl text-emerald-600">{qualityOverview.resolvedDefects}</h3>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. PROJECT ANALYTICS ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" /> Project Analytics Matrix
          </h3>
          <span className="text-xs font-mono text-slate-400">{projectAnalytics.length} Projects Tracked</span>
        </div>

        {projectAnalytics.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-xl">
            No project data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-body">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Project</th>
                  <th className="p-3">Total Units</th>
                  <th className="p-3">Inspections</th>
                  <th className="p-3">Completed</th>
                  <th className="p-3">Pending</th>
                  <th className="p-3">Defects</th>
                  <th className="p-3">Re-checks</th>
                  <th className="p-3">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectAnalytics.map((p) => (
                  <tr key={p.project} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{p.project}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{p.totalUnits}</td>
                    <td className="p-3 font-mono font-bold text-blue-600">{p.inspectionsCount}</td>
                    <td className="p-3 font-mono font-bold text-emerald-600">{p.completed}</td>
                    <td className="p-3 font-mono font-bold text-amber-600">{p.pending}</td>
                    <td className="p-3 font-mono font-bold text-rose-600">{p.defects}</td>
                    <td className="p-3 font-mono font-bold text-amber-600">{p.rechecks}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-500" style={{ width: `${p.pct}%` }} />
                        </div>
                        <span className="font-mono font-bold text-slate-800">{p.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 5. INSPECTION & DEFECT ANALYTICS (2 COLUMNS) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* INSPECTION CHECKLIST CELL DISTRIBUTION */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" /> Inspection Item Distribution
          </h3>

          <div className="space-y-3 font-body text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> PASS Rate
              </span>
              <span className="font-mono font-bold text-emerald-700 text-sm">{qualityOverview.passPct}% ({qualityOverview.passedCells} items)</span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
              <span className="font-bold text-rose-950 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> FAIL Rate
              </span>
              <span className="font-mono font-bold text-rose-700 text-sm">{qualityOverview.failPct}% ({qualityOverview.failedCells} items)</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-slate-500" /> N/A Rate
              </span>
              <span className="font-mono font-bold text-slate-700 text-sm">{qualityOverview.naPct}% ({qualityOverview.naCells} items)</span>
            </div>
          </div>
        </div>

        {/* DEFECT AREA BREAKDOWN */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" /> Defect Breakdown by Area
          </h3>

          {defectBreakdown.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-xl">
              No defect data available.
            </div>
          ) : (
            <div className="space-y-3 font-body text-xs">
              {defectBreakdown.map((item) => (
                <div key={item.area} className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{item.area}</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">{item.count} defects</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ─── 6. APPROVAL PIPELINE ANALYTICS ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" /> Approval Pipeline Queue Analytics
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 font-body text-xs">
          {approvalPipeline.map((stg) => (
            <div key={stg.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <p className="font-bold text-slate-900 truncate">{stg.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-mono text-[11px]">Pending:</span>
                <span className="font-mono font-bold text-blue-700 text-sm">{stg.pendingCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
