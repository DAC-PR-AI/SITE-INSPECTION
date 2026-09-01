"use client";

import React, { useState, useMemo } from "react";
import {
  FileText, Filter, Printer, Download, Eye, CheckCircle2,
  XCircle, Clock, AlertTriangle, Layers, Building2, Calendar,
  ShieldCheck, RefreshCw, ChevronRight, FileSpreadsheet, Search
} from "lucide-react";
import JointInspectionPrintDoc from "./JointInspectionPrintDoc";

const REPORT_TYPES = [
  { id: "inspection", title: "Inspection Report", desc: "Detailed breakdown of cell-by-cell inspection results" },
  { id: "project_summary", title: "Project Summary", desc: "Aggregated unit completion and defect counts by project" },
  { id: "pending_approval", title: "Pending Approval", desc: "Inspections currently awaiting management sign-offs" },
  { id: "defect", title: "Defect Report", desc: "Master list of failed checklist items and severity levels" },
  { id: "recheck", title: "Re-check Report", desc: "Inspections marked for corrections and re-inspection" },
  { id: "completion", title: "Completion Report", desc: "Fully approved inspections ready for key handover" },
  { id: "approval", title: "Approval Report", desc: "Chronological audit log of all approval and rejection actions" },
];

export default function InternalReportCenter({
  inspections = [],
  projectsMap = {},
  onOpenInspection,
  className = "",
}) {
  const [selectedReportType, setSelectedReportType] = useState("inspection");
  const [selectedProject, setSelectedProject] = useState("ALL");
  const [selectedUnit, setSelectedUnit] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedStage, setSelectedStage] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInspectionForPrint, setSelectedInspectionForPrint] = useState(null);

  // Available units based on selected project
  const availableUnits = useMemo(() => {
    if (selectedProject === "ALL") {
      const set = new Set();
      Object.values(projectsMap).forEach((units) => units.forEach((u) => set.add(u)));
      return Array.from(set).sort();
    }
    return (projectsMap[selectedProject] || []).sort();
  }, [projectsMap, selectedProject]);

  // Filtered Inspections based on active filters
  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      if (!i) return false;
      const matchProj = selectedProject === "ALL" || i.projectName === selectedProject;
      const matchUnit = selectedUnit === "ALL" || i.unitNumber === selectedUnit;
      const matchType = selectedType === "ALL" || i.inspectionType === selectedType;

      const currentStatus = i.workflowStatus || i.status || "DRAFT";
      const matchStatus = selectedStatus === "ALL" || currentStatus === selectedStatus;

      // Filter by report type specifics
      let matchReportType = true;
      if (selectedReportType === "pending_approval") {
        matchReportType = !["COMPLETED", "DRAFT", "REJECTED"].includes(currentStatus);
      } else if (selectedReportType === "recheck") {
        matchReportType = currentStatus === "RECHECK_REQUIRED";
      } else if (selectedReportType === "completion") {
        matchReportType = currentStatus === "COMPLETED";
      }

      // Date range filter
      let matchDate = true;
      const inspecDate = i.date || i.createdAt || "";
      if (dateFrom && inspecDate < dateFrom) matchDate = false;
      if (dateTo && inspecDate > dateTo) matchDate = false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        i.inspectionId.toLowerCase().includes(q) ||
        i.projectName.toLowerCase().includes(q) ||
        i.unitNumber.toLowerCase().includes(q) ||
        (i.customerName || "").toLowerCase().includes(q);

      return matchProj && matchUnit && matchType && matchStatus && matchReportType && matchDate && matchSearch;
    });
  }, [inspections, selectedProject, selectedUnit, selectedType, selectedStatus, selectedReportType, dateFrom, dateTo, searchQuery]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (filteredInspections.length === 0) return;

    let headers = ["Inspection ID", "Project", "Unit", "Type", "Customer", "Date", "Status", "Completion %", "Passed", "Failed", "N/A"];
    let rows = filteredInspections.map((i) => [
      i.inspectionId,
      `"${i.projectName || ""}"`,
      `"${i.unitNumber || ""}"`,
      `"${i.inspectionType || ""}"`,
      `"${i.customerName || ""}"`,
      i.date || "",
      i.workflowStatus || i.status || "DRAFT",
      i.completionPct || "0%",
      i.passedCount || 0,
      i.failedCount || 0,
      i.naCount || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DAC_${selectedReportType.toUpperCase()}_REPORT_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Print
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 font-body ${className}`}>
      
      {/* ─── REPORT SELECTION TABS ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="font-display font-bold text-lg text-slate-900">
            Internal Inspection Report Center
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REPORT_TYPES.map((rep) => {
            const isSelected = selectedReportType === rep.id;
            return (
              <button
                key={rep.id}
                onClick={() => setSelectedReportType(rep.id)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs"
                    : "bg-slate-50/50 border-slate-200 hover:bg-slate-100/60"
                }`}
              >
                <div>
                  <h3 className={`font-display font-bold text-sm ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                    {rep.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {rep.desc}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-mono font-bold text-slate-400">
                  <span>SELECT REPORT</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : ""}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── MULTI-DIMENSIONAL FILTERS & ACTION BAR ─────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="font-display font-bold text-sm text-slate-900">
              Report Filter Matrix
            </h3>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleTriggerPrint}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="ID, Unit, Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Project */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedUnit("ALL");
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="ALL">All Projects</option>
              {Object.keys(projectsMap).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Unit</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="ALL">All Units</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Inspection Type */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Inspection Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="ALL">All Types</option>
              <option value="INTERIOR JOINT INSPECTION">INTERIOR JOINT INSPECTION</option>
              <option value="KEY HANDOVER INSPECTION">KEY HANDOVER INSPECTION</option>
              <option value="SNAG LIST CHECK">SNAG LIST CHECK</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-600">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

      {/* ─── REPORT OUTPUT REGISTER TABLE ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-display font-bold text-xs text-slate-800 uppercase tracking-wider">
            {REPORT_TYPES.find((r) => r.id === selectedReportType)?.title} Records ({filteredInspections.length})
          </span>
          <span className="font-mono text-xs text-slate-500">
            Real Data Source: Google Sheet
          </span>
        </div>

        {filteredInspections.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-sm text-slate-600">No matching records found for active report filters.</p>
            <p className="text-xs mt-1">Try resetting filter parameters or changing report type.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Inspection ID</th>
                  <th className="py-3 px-4">Project & Unit</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Passed / Failed</th>
                  <th className="py-3 px-4">Completion %</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInspections.map((inspec) => {
                  const currentStatus = inspec.workflowStatus || inspec.status || "DRAFT";
                  return (
                    <tr key={inspec.inspectionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {inspec.inspectionId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>{inspec.projectName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Unit: {inspec.unitNumber}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {inspec.customerName || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {currentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="text-emerald-700 font-bold">{inspec.passedCount || 0} Pass</span> /{" "}
                        <span className="text-rose-700 font-bold">{inspec.failedCount || 0} Fail</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {inspec.completionPct || "0%"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedInspectionForPrint(inspec)}
                          className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Document</span>
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

      {/* ─── PRINT / PDF MODAL PREVIEW ───────────────────────────────────── */}
      {selectedInspectionForPrint && (
        <JointInspectionPrintDoc
          inspection={selectedInspectionForPrint}
          onClose={() => setSelectedInspectionForPrint(null)}
        />
      )}
    </div>
  );
}
