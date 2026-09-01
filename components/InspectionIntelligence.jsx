"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Brain, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, Building2, ArrowUpRight, ShieldCheck, Activity, Layers,
  FileText, CheckSquare, ChevronRight, UserCheck, AlertCircle
} from "lucide-react";
import { getSpotSignatureState } from "../lib/workflow";

/**
 * Calculates Empirical Quality Score (0-100%) for a set of inspection records
 * Formula documented in /docs/QUALITY_SCORE.md
 */
export function calculateQualityScore(inspectionList) {
  if (!inspectionList || inspectionList.length === 0) {
    return {
      score: 0,
      health: "Needs Attention",
      healthColor: "text-amber-700 bg-amber-50 border-amber-200",
      passRate: 0,
      completionRate: 0,
      defectPenalty: 0,
      recheckPenalty: 0,
    };
  }

  const totalInspections = inspectionList.length;
  let completedCount = 0;
  let recheckCount = 0;
  let rejectionCount = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  inspectionList.forEach((i) => {
    const ws = i.workflowStatus || i.status || "DRAFT";
    if (ws === "COMPLETED") completedCount++;
    if (ws === "RECHECK_REQUIRED") recheckCount++;
    if (ws === "REJECTED") rejectionCount++;

    const cells = i.cells || {};
    Object.values(cells).forEach((c) => {
      if (c?.status === "pass") totalPassed++;
      else if (c?.status === "fail") totalFailed++;
    });
  });

  const validItems = totalPassed + totalFailed;
  const passRatio = validItems > 0 ? totalPassed / validItems : 1;
  const W_pass = 45 * passRatio;

  const completionRatio = completedCount / totalInspections;
  const W_completion = 35 * completionRatio;

  const defectDensity = totalInspections > 0 ? totalFailed / totalInspections : 0;
  const P_defect = Math.min(12, defectDensity * 4);

  const recheckRatio = totalInspections > 0 ? recheckCount / totalInspections : 0;
  const P_recheck = Math.min(8, recheckRatio * 6);

  const rawScore = W_pass + W_completion - P_defect - P_recheck;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Health Classification
  let health = "Healthy";
  let healthColor = "text-emerald-700 bg-emerald-50 border-emerald-200";

  if (score < 60 || defectDensity > 4.0 || rejectionCount >= 2) {
    health = "Critical";
    healthColor = "text-rose-700 bg-rose-50 border-rose-200";
  } else if (score < 80 || defectDensity >= 2.0 || recheckCount >= 1) {
    health = "Needs Attention";
    healthColor = "text-amber-700 bg-amber-50 border-amber-200";
  }

  return {
    score,
    health,
    healthColor,
    passRate: Math.round(passRatio * 100),
    completionRate: Math.round(completionRatio * 100),
    defectPenalty: Math.round(P_defect),
    recheckPenalty: Math.round(P_recheck),
    totalPassed,
    totalFailed,
    defectDensity: defectDensity.toFixed(1),
  };
}

export default function InspectionIntelligence({ onOpenInspection, className = "" }) {
  const [inspections, setInspections] = useState([]);
  const [projectsMap, setProjectsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  async function fetchIntelligenceData() {
    setLoading(true);
    try {
      const [inspecRes, projRes] = await Promise.all([
        fetch("/api/approval?role=Admin"),
        fetch("/api/projects"),
      ]);

      const inspecData = await inspecRes.json();
      const projData = await projRes.json();

      if (inspecData.inspections) setInspections(inspecData.inspections);
      if (projData.projects) setProjectsMap(projData.projects);
    } catch (err) {
      console.error("[Intelligence] Error fetching intelligence data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Global Quality Score & Health
  const globalScore = useMemo(() => calculateQualityScore(inspections), [inspections]);

  // Per Project Health & Score breakdown
  const projectHealthList = useMemo(() => {
    const list = [];
    Object.entries(projectsMap).forEach(([projName]) => {
      const projInspections = inspections.filter((i) => i.projectName === projName);
      const metrics = calculateQualityScore(projInspections);
      list.push({
        project: projName,
        inspectionsCount: projInspections.length,
        ...metrics,
      });
    });
    return list;
  }, [projectsMap, inspections]);

  // Empirical Risk Indicators & Actionable Insights
  const intelligenceInsights = useMemo(() => {
    const insights = [];

    // Insight 1: QA/QC Pending Queue
    const qaqcPending = inspections.filter((i) => (i.workflowStatus || i.status) === "QA_QC_PENDING");
    if (qaqcPending.length > 0) {
      insights.push({
        id: "qaqc-pending",
        type: "queue",
        title: `${qaqcPending.length} inspection(s) are awaiting QA/QC approval`,
        description: `Quality compliance review pending for items in active workflow chain.`,
        records: qaqcPending.map((i) => i.inspectionId),
        severity: "medium",
      });
    }

    // Insight 2: SLA Breach (> 3 Days in system)
    const slaBreached = inspections.filter((i) => {
      const ws = i.workflowStatus || i.status || "DRAFT";
      if (ws === "COMPLETED") return false;
      const updatedAt = new Date(i.updatedAt || i.createdAt || Date.now());
      const ageDays = (new Date() - updatedAt) / (1000 * 60 * 60 * 24);
      return ageDays > 3;
    });

    if (slaBreached.length > 0) {
      insights.push({
        id: "sla-breach",
        type: "sla",
        title: `${slaBreached.length} inspection(s) pending for > 3 days SLA threshold`,
        description: `Ageing evaluations requiring management escalation.`,
        records: slaBreached.map((i) => i.inspectionId),
        severity: "high",
      });
    }

    // Insight 3: Highest Defect Project
    let highestDefectProject = null;
    let maxDefects = -1;
    projectHealthList.forEach((p) => {
      if (p.totalFailed > maxDefects) {
        maxDefects = p.totalFailed;
        highestDefectProject = p;
      }
    });

    if (highestDefectProject && maxDefects > 0) {
      insights.push({
        id: "highest-defect-proj",
        type: "defect",
        title: `Project ${highestDefectProject.project} has the highest open defect count (${maxDefects} defects)`,
        description: `Requires focused contractor defect rectification.`,
        records: inspections.filter((i) => i.projectName === highestDefectProject.project).map((i) => i.inspectionId),
        severity: "high",
      });
    }

    // Insight 4: Re-check Required
    const rechecks = inspections.filter((i) => (i.workflowStatus || i.status) === "RECHECK_REQUIRED");
    if (rechecks.length > 0) {
      insights.push({
        id: "recheck-queue",
        type: "recheck",
        title: `${rechecks.length} inspection(s) marked for RE-CHECK / Correction`,
        description: `Corrections requested by approvers awaiting site re-inspection.`,
        records: rechecks.map((i) => i.inspectionId),
        severity: "medium",
      });
    }

    return insights;
  }, [inspections, projectHealthList]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed rounded-3xl bg-white space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p>Computing empirical inspection intelligence from database...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 font-body text-slate-900 ${className}`}>

      {/* ─── 1. INTELLIGENCE HEADER ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold mb-1">
              <span>EMPIRICAL DATA ENGINE</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Inspection Intelligence Center
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical quality scores, project health classification, and risk indicators
            </p>
          </div>
        </div>

        <button
          onClick={fetchIntelligenceData}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-indigo-600" />
          <span>Recalculate Intelligence</span>
        </button>
      </div>

      {/* ─── 2. GLOBAL QUALITY SCORE & HEALTH STATUS ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* QUALITY SCORE CARD */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-wider">
                Overall Quality Score
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${globalScore.healthColor}`}>
                {globalScore.health}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="font-display font-extrabold text-5xl text-slate-900 tracking-tight">
                {globalScore.score}<span className="text-2xl font-normal text-slate-400">%</span>
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Formula: Pass (45%) + Comp (35%) - Def (12%) - Recheck (8%)
              </span>
            </div>

            {/* Score Component Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex mb-4">
              <div className="h-full bg-emerald-500" style={{ width: `${globalScore.passRate * 0.45}%` }} title="Pass Rate" />
              <div className="h-full bg-blue-500" style={{ width: `${globalScore.completionRate * 0.35}%` }} title="Completion Rate" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Pass Rate Weight</span>
                <span className="font-bold text-emerald-700">{globalScore.passRate}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Completion Weight</span>
                <span className="font-bold text-blue-700">{globalScore.completionRate}%</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-mono mt-4 pt-3 border-t border-slate-100">
            Documented in <b className="text-slate-700">/docs/QUALITY_SCORE.md</b>
          </p>
        </div>

        {/* DATA / CALCULATION / INSIGHT EXPLICIT BREAKDOWN */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" /> Data, Calculation & Insight Triad
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-body">
              {/* Data Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                  DATA
                </span>
                <h4 className="font-bold text-slate-900 text-sm">Empirical Records</h4>
                <ul className="space-y-1 text-slate-600 text-[11px]">
                  <li>• Total Inspections: <b>{inspections.length}</b></li>
                  <li>• Passed Checklist: <b>{globalScore.totalPassed}</b></li>
                  <li>• Failed Checklist: <b>{globalScore.totalFailed}</b></li>
                </ul>
              </div>

              {/* Calculation Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md uppercase">
                  CALCULATION
                </span>
                <h4 className="font-bold text-slate-900 text-sm">Quality Metric</h4>
                <ul className="space-y-1 text-slate-600 text-[11px]">
                  <li>• Pass Rate: <b>{globalScore.passRate}%</b></li>
                  <li>• Defect Density: <b>{globalScore.defectDensity} / inspection</b></li>
                  <li>• Calculated Score: <b>{globalScore.score}%</b></li>
                </ul>
              </div>

              {/* Insight Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md uppercase">
                  INSIGHT
                </span>
                <h4 className="font-bold text-slate-900 text-sm">Actionable Intelligence</h4>
                <p className="text-slate-600 text-[11px]">
                  Project quality status is <b>{globalScore.health}</b> based on verified checklist data.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── 3. PROJECT HEALTH CLASSIFICATION MATRIX ──────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" /> Project Health Matrix
        </h3>

        {projectHealthList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-xl">
            No project health records available.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-body">
            {projectHealthList.map((p) => (
              <div key={p.project} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{p.project}</h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${p.healthColor}`}>
                    {p.health}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-slate-500 font-mono">Quality Score:</span>
                  <span className="font-display font-extrabold text-xl text-slate-900">{p.score}%</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">Defect Density</span>
                    <span className="font-bold text-slate-700">{p.defectDensity}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">Pass Rate</span>
                    <span className="font-bold text-emerald-700">{p.passRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 4. ACTIONABLE INSIGHT CARDS (LINKED TO RECORDS) ────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-600" /> Actionable Intelligence Cards
        </h3>

        {intelligenceInsights.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-xl">
            No active risk indicators detected. All operational parameters within threshold.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-body">
            {intelligenceInsights.map((card) => (
              <div
                key={card.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                  card.severity === "high"
                    ? "bg-rose-50/50 border-rose-200"
                    : "bg-amber-50/50 border-amber-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                      card.severity === "high" ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}>
                      {card.severity.toUpperCase()} RISK
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {card.records.length} Record(s) Linked
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm mb-1">{card.title}</h4>
                  <p className="text-slate-600 text-xs">{card.description}</p>
                </div>

                {/* Direct Record Links */}
                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {card.records.slice(0, 3).map((recId) => (
                      <button
                        key={recId}
                        onClick={() => onOpenInspection && onOpenInspection(recId)}
                        className="px-2 py-1 rounded-md bg-white border border-slate-200 text-blue-600 font-mono text-[10px] font-bold hover:bg-blue-50 flex items-center gap-1 transition-colors"
                      >
                        <span>{recId}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    ))}
                    {card.records.length > 3 && (
                      <span className="text-[10px] font-mono text-slate-400 self-center">
                        +{card.records.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
