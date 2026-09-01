"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock, AlertTriangle, ShieldCheck, RefreshCw, CheckCircle2,
  XCircle, Bell, ArrowUpRight, Hourglass, Layers, Eye, Calendar,
  Building2, SlidersHorizontal, ShieldAlert
} from "lucide-react";
import {
  DEFAULT_STAGE_SLAS,
  getInspectionStageAgeing,
  calculateSlaDashboardMetrics,
  generateSlaNotificationEvents
} from "../lib/slaConfig";

export default function ApprovalSlaAndAgeing({ onOpenInspection, className = "" }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slas, setSlas] = useState(DEFAULT_STAGE_SLAS);
  const [activeTab, setActiveTab] = useState("overview"); // overview | queue | notifications

  useEffect(() => {
    fetchSlaData();
  }, []);

  async function fetchSlaData() {
    setLoading(true);
    try {
      const res = await fetch("/api/approval?role=Admin");
      const data = await res.json();
      if (data.inspections) setInspections(data.inspections);
    } catch (err) {
      console.error("[SlaAndAgeing] Error fetching inspection SLA data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Dashboard SLA Metrics
  const metrics = useMemo(() => calculateSlaDashboardMetrics(inspections, slas), [inspections, slas]);

  // Modular Notification Events
  const notificationEvents = useMemo(() => generateSlaNotificationEvents(inspections, slas), [inspections, slas]);

  // Stage Breakdown Metrics
  const stageBreakdown = useMemo(() => {
    const map = {};
    Object.entries(slas).forEach(([stgKey, stgConf]) => {
      map[stgKey] = {
        label: stgConf.label,
        slaHours: stgConf.slaHours,
        pendingCount: 0,
        breachedCount: 0,
        totalHours: 0,
      };
    });

    inspections.forEach((i) => {
      const ws = i.workflowStatus || i.status || "DRAFT";
      if (ws !== "COMPLETED" && map[ws]) {
        map[ws].pendingCount++;
        const ageing = getInspectionStageAgeing(i, slas);
        map[ws].totalHours += ageing.elapsedHours;
        if (ageing.isBreached) map[ws].breachedCount++;
      }
    });

    return Object.values(map);
  }, [inspections, slas]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed rounded-3xl bg-white space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p>Calculating SLA turnaround times & ageing records...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 font-body text-slate-900 ${className}`}>

      {/* ─── 1. SLA HEADER ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold shrink-0">
            <Hourglass className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold mb-1">
              <span>SLA & AGEING MONITOR</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Approval SLA & Ageing Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live turnaround tracking, SLA breach detection, and event notification queue
            </p>
          </div>
        </div>

        <button
          onClick={fetchSlaData}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-amber-600" />
          <span>Refresh SLA Data</span>
        </button>
      </div>

      {/* ─── 2. DASHBOARD SLA SUMMARY CARDS ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Pending Count */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">Pending Approvals</p>
            <h3 className="font-display font-extrabold text-2xl text-slate-900">{metrics.pendingCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Approaching SLA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 mb-1">Approaching SLA</p>
            <h3 className="font-display font-extrabold text-2xl text-amber-600">{metrics.approachingCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* SLA Breached */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600 mb-1">SLA Breached</p>
            <h3 className="font-display font-extrabold text-2xl text-rose-600">{metrics.breachedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Avg Approval Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">Avg Turnaround</p>
            <h3 className="font-display font-extrabold text-2xl text-slate-900">{metrics.avgApprovalHours}<span className="text-xs font-normal text-slate-500"> hrs</span></h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 shrink-0">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>

        {/* Longest Pending Inspection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">Longest Pending</p>
            {metrics.longestInspection ? (
              <div>
                <span className="font-mono font-bold text-xs text-blue-600">{metrics.longestInspection.inspectionId}</span>
                <p className="text-[11px] font-mono text-rose-600 font-bold">{metrics.longestInspection.ageing.formattedElapsed}</p>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-mono">None</span>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── 3. STAGE SLA TURNAROUND TRACKER GRID ──────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" /> Stage SLA Turnaround Limits
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-body">
          {stageBreakdown.map((stg) => (
            <div key={stg.label} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 truncate">{stg.label}</h4>
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Limit: {stg.slaHours}h
                </span>
              </div>
              <div className="flex items-baseline justify-between text-slate-600">
                <span>Pending Count:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{stg.pendingCount}</span>
              </div>
              {stg.breachedCount > 0 && (
                <div className="text-[10px] font-mono text-rose-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" /> {stg.breachedCount} Breached SLA
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── 4. INSPECTION AGEING DETAIL REGISTER TABLE ───────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
          <Hourglass className="w-5 h-5 text-amber-600" /> Ageing Inspection Register
        </h3>

        {inspections.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-xl">
            No inspection records available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-body">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3">Inspection ID</th>
                  <th className="p-3">Project / Unit</th>
                  <th className="p-3">Current Stage</th>
                  <th className="p-3">Submitted Date</th>
                  <th className="p-3">Time Elapsed</th>
                  <th className="p-3">SLA Limit</th>
                  <th className="p-3">Remaining / Overdue</th>
                  <th className="p-3">Ageing Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map((item) => {
                  const ws = item.workflowStatus || item.status || "DRAFT";
                  const ageing = getInspectionStageAgeing(item, slas);

                  return (
                    <tr key={item.inspectionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-600">{item.inspectionId}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{item.projectName}</p>
                        <p className="font-mono text-amber-600 font-bold text-[11px]">Unit {item.unitNumber}</p>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{ageing.stageLabel}</td>
                      <td className="p-3 font-mono text-slate-400 text-[11px]">
                        {new Date(item.createdAt || Date.now()).toLocaleDateString("en-GB")}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">{ageing.formattedElapsed}</td>
                      <td className="p-3 font-mono text-slate-600">{ageing.slaLimitHours}h</td>
                      <td className="p-3 font-mono font-bold">
                        {ageing.remainingHours < 0 ? (
                          <span className="text-rose-600">+{Math.abs(ageing.remainingHours)}h Overdue</span>
                        ) : (
                          <span className="text-emerald-700">-{ageing.remainingHours}h Remaining</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${ageing.badgeColor}`}>
                          {ageing.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onOpenInspection && onOpenInspection(item.inspectionId)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-bold border border-slate-200 flex items-center gap-1 ml-auto transition-colors"
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

      {/* ─── 5. MODULAR NOTIFICATION PREPARATION QUEUE ─────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-600" /> Modular SLA Breach Notification Event Queue
          </h3>
          <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
            {notificationEvents.length} Queued Events
          </span>
        </div>

        <p className="text-xs text-slate-500 font-body">
          Modular event queue prepared for future webhook/email notifications. Does not invoke third-party services.
        </p>

        {notificationEvents.length === 0 ? (
          <div className="p-6 text-center text-slate-400 font-mono text-xs border border-dashed rounded-xl">
            No active SLA breach notification events queued.
          </div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {notificationEvents.map((evt) => (
              <div key={evt.eventId} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-bold text-rose-950">{evt.inspectionId}</span>
                  <span className="text-slate-500"> ({evt.projectName} - Unit {evt.unitNumber})</span>
                  <p className="text-[11px] text-slate-600 font-body mt-0.5">
                    Stage <b>{evt.role}</b> elapsed <b>{evt.elapsedHours}h</b> (Exceeded {evt.slaLimitHours}h SLA by +{evt.overdueHours}h)
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                  EVENT QUEUED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
