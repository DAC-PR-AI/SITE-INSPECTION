"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle,
  XCircle, Copy, FileSpreadsheet, Lock, KeyRound, Loader2, ArrowRight,
  Database, Search, Filter, Layers
} from "lucide-react";

export default function SheetReconciliationCenter({
  onRefreshData,
  className = "",
}) {
  const [sheetRecords, setSheetRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciledList, setReconciledList] = useState([]);
  const [filterState, setFilterState] = useState("ALL"); // ALL | MATCH | DIFFERENCE | MISSING | DUPLICATE | ERROR
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecordForResync, setSelectedRecordForResync] = useState(null);
  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    runReconciliation();
  }, []);

  async function runReconciliation() {
    setLoading(true);
    try {
      // 1. Fetch live Google Sheet records
      const sheetRes = await fetch("/api/approval?role=Admin");
      const sheetData = await sheetRes.json();
      const liveSheetInspections = sheetData.inspections || [];
      setSheetRecords(liveSheetInspections);

      // 2. Fetch local application storage / draft records
      let localDrafts = [];
      try {
        const rawLocal = localStorage.getItem("dac_draft_inspections");
        if (rawLocal) localDrafts = JSON.parse(rawLocal);
      } catch (e) {}

      // 3. Perform Reconciliation Algorithm
      const inspectionIdCounts = {};
      liveSheetInspections.forEach((i) => {
        if (i?.inspectionId) {
          inspectionIdCounts[i.inspectionId] = (inspectionIdCounts[i.inspectionId] || 0) + 1;
        }
      });

      const reconciledMap = new Map();

      // Analyze Sheet Records
      liveSheetInspections.forEach((sRecord, idx) => {
        if (!sRecord || !sRecord.inspectionId) {
          reconciledMap.set(`ERR-ROW-${idx}`, {
            id: `ERR-ROW-${idx}`,
            inspectionId: "UNPARSEABLE",
            projectName: "Unknown",
            unitNumber: "000",
            sheetStatus: "INVALID_ROW",
            appStatus: "N/A",
            comparisonState: "ERROR", // MATCH | DIFFERENCE | MISSING | DUPLICATE | ERROR
            diffDetails: "Row contains unparseable spreadsheet data or missing InspectionID.",
            sheetObj: sRecord,
          });
          return;
        }

        const id = sRecord.inspectionId;

        // Check for duplicates
        if (inspectionIdCounts[id] > 1) {
          reconciledMap.set(id, {
            id,
            inspectionId: id,
            projectName: sRecord.projectName,
            unitNumber: sRecord.unitNumber,
            sheetStatus: sRecord.workflowStatus || sRecord.status || "DRAFT",
            appStatus: "DUPLICATED_IN_SHEET",
            comparisonState: "DUPLICATE",
            diffDetails: `Found ${inspectionIdCounts[id]} duplicate rows in Google Sheet for ID ${id}.`,
            sheetObj: sRecord,
          });
          return;
        }

        // Compare against local application record if present
        const localMatch = localDrafts.find((d) => d.inspectionId === id);

        if (!localMatch) {
          reconciledMap.set(id, {
            id,
            inspectionId: id,
            projectName: sRecord.projectName,
            unitNumber: sRecord.unitNumber,
            sheetStatus: sRecord.workflowStatus || sRecord.status || "DRAFT",
            appStatus: "NOT_IN_LOCAL",
            comparisonState: "MATCH", // Synced to Sheet
            diffDetails: "Record synchronized in Google Sheet.",
            sheetObj: sRecord,
          });
        } else {
          const sheetStat = sRecord.workflowStatus || sRecord.status || "DRAFT";
          const localStat = localMatch.workflowStatus || localMatch.status || "DRAFT";

          if (sheetStat !== localStat) {
            reconciledMap.set(id, {
              id,
              inspectionId: id,
              projectName: sRecord.projectName,
              unitNumber: sRecord.unitNumber,
              sheetStatus: sheetStat,
              appStatus: localStat,
              comparisonState: "DIFFERENCE",
              diffDetails: `Status mismatch: Sheet has "${sheetStat}", Local App has "${localStat}".`,
              sheetObj: sRecord,
              localObj: localMatch,
            });
          } else {
            reconciledMap.set(id, {
              id,
              inspectionId: id,
              projectName: sRecord.projectName,
              unitNumber: sRecord.unitNumber,
              sheetStatus: sheetStat,
              appStatus: localStat,
              comparisonState: "MATCH",
              diffDetails: "Exact match between Sheet and Application.",
              sheetObj: sRecord,
              localObj: localMatch,
            });
          }
        }
      });

      // Analyze local records missing in Sheet
      localDrafts.forEach((lRecord) => {
        if (lRecord?.inspectionId && !reconciledMap.has(lRecord.inspectionId)) {
          reconciledMap.set(lRecord.inspectionId, {
            id: lRecord.inspectionId,
            inspectionId: lRecord.inspectionId,
            projectName: lRecord.projectName,
            unitNumber: lRecord.unitNumber,
            sheetStatus: "NOT_IN_SHEET",
            appStatus: lRecord.workflowStatus || lRecord.status || "DRAFT",
            comparisonState: "MISSING",
            diffDetails: "Record exists in Application local memory but not written to Google Sheet yet.",
            localObj: lRecord,
          });
        }
      });

      setReconciledList(Array.from(reconciledMap.values()));
    } catch (e) {
      console.error("[Reconciliation] Error running audit:", e);
    } finally {
      setLoading(false);
    }
  }

  // Filtered List
  const filteredList = useMemo(() => {
    return reconciledList.filter((item) => {
      const matchState = filterState === "ALL" || item.comparisonState === filterState;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.inspectionId.toLowerCase().includes(q) ||
        (item.projectName || "").toLowerCase().includes(q) ||
        (item.unitNumber || "").toLowerCase().includes(q);
      return matchState && matchSearch;
    });
  }, [reconciledList, filterState, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    let match = 0, diff = 0, missing = 0, duplicate = 0, error = 0;
    reconciledList.forEach((r) => {
      if (r.comparisonState === "MATCH") match++;
      else if (r.comparisonState === "DIFFERENCE") diff++;
      else if (r.comparisonState === "MISSING") missing++;
      else if (r.comparisonState === "DUPLICATE") duplicate++;
      else if (r.comparisonState === "ERROR") error++;
    });
    return { total: reconciledList.length, match, diff, missing, duplicate, error };
  }, [reconciledList]);

  // Authorized Re-sync
  const handleAuthorizedResync = async (e) => {
    if (e) e.preventDefault();
    if (!authPin || authPin.trim().length !== 6) {
      setAuthError("Please enter your 6-digit authorized Admin password.");
      return;
    }

    setResyncing(true);
    setAuthError("");

    try {
      // 1. Verify PIN via /api/auth
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "Admin", pin: authPin.trim() }),
      });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.ok) {
        throw new Error(authData.error || "Invalid authorized password.");
      }

      // 2. Perform safe re-sync write
      const targetObj = selectedRecordForResync.localObj || selectedRecordForResync.sheetObj;
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: selectedRecordForResync.inspectionId,
          role: "Admin",
          userName: "Administrator (Reconciliation)",
          action: "approve",
          comments: `Manual Reconciliation Sync: Resolved ${selectedRecordForResync.comparisonState}`,
          passcode: authPin.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to execute reconciliation sync.");
      }

      setSelectedRecordForResync(null);
      setAuthPin("");
      runReconciliation();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div className={`space-y-6 font-body ${className}`}>
      
      {/* ─── HEADER & METRIC SUMMARY CARDS ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>SHEET / APPLICATION RECONCILIATION AUDIT</span>
            </div>
            <h2 className="font-display font-bold text-xl text-slate-900">
              Data Integrity & Reconciliation Control
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict audit comparing live Google Sheet rows against application state with zero automated sheet mutations.
            </p>
          </div>

          <button
            onClick={runReconciliation}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
            <span>Re-Run Audit</span>
          </button>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          {/* Total */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Audited</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{counts.total}</div>
          </div>

          {/* MATCH */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> MATCH
            </span>
            <div className="text-xl font-bold text-emerald-700 mt-1">{counts.match}</div>
          </div>

          {/* DIFFERENCE */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" /> DIFFERENCE
            </span>
            <div className="text-xl font-bold text-amber-700 mt-1">{counts.diff}</div>
          </div>

          {/* MISSING */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
            <span className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-600" /> MISSING
            </span>
            <div className="text-xl font-bold text-blue-700 mt-1">{counts.missing}</div>
          </div>

          {/* DUPLICATE */}
          <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200">
            <span className="text-[10px] font-bold text-orange-800 uppercase flex items-center gap-1">
              <Copy className="w-3 h-3 text-orange-600" /> DUPLICATE
            </span>
            <div className="text-xl font-bold text-orange-700 mt-1">{counts.duplicate}</div>
          </div>

          {/* ERROR */}
          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-600" /> ERROR
            </span>
            <div className="text-xl font-bold text-rose-700 mt-1">{counts.error}</div>
          </div>
        </div>
      </div>

      {/* ─── FILTERS BAR ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* State Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 font-mono text-xs">
          {["ALL", "MATCH", "DIFFERENCE", "MISSING", "DUPLICATE", "ERROR"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors shrink-0 ${
                filterState === st
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search record ID or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {/* ─── RECONCILIATION REGISTER TABLE ───────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Auditing live Google Sheet vs Application records...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-60" />
            <p className="font-semibold text-sm text-slate-700">No records found matching filter "{filterState}".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Inspection ID</th>
                  <th className="py-3 px-4">Project & Unit</th>
                  <th className="py-3 px-4">Sheet Status</th>
                  <th className="py-3 px-4">App Status</th>
                  <th className="py-3 px-4">Reconciliation State</th>
                  <th className="py-3 px-4">Audit Findings</th>
                  <th className="py-3 px-4 text-right">Authorized Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((rec) => {
                  let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
                  if (rec.comparisonState === "MATCH") badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-300";
                  else if (rec.comparisonState === "DIFFERENCE") badgeStyle = "bg-amber-50 text-amber-800 border-amber-300";
                  else if (rec.comparisonState === "MISSING") badgeStyle = "bg-blue-50 text-blue-800 border-blue-300";
                  else if (rec.comparisonState === "DUPLICATE") badgeStyle = "bg-orange-50 text-orange-800 border-orange-300";
                  else if (rec.comparisonState === "ERROR") badgeStyle = "bg-rose-50 text-rose-800 border-rose-300";

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {rec.inspectionId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{rec.projectName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Unit: {rec.unitNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {rec.sheetStatus}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {rec.appStatus}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border ${badgeStyle}`}>
                          {rec.comparisonState}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs leading-relaxed">
                        {rec.diffDetails}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {rec.comparisonState !== "MATCH" && (
                          <button
                            onClick={() => setSelectedRecordForResync(rec)}
                            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-colors"
                          >
                            Authorized Sync
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

      {/* ─── AUTHORIZED ACTION PIN DIALOG ────────────────────────────────── */}
      {selectedRecordForResync && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Authorized Reconciliation Override
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Record ID: {selectedRecordForResync.inspectionId}
                </p>
              </div>
            </div>

            <form onSubmit={handleAuthorizedResync} className="mt-4 space-y-4 font-body">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900">Action Rationale:</p>
                <p className="text-slate-600">{selectedRecordForResync.diffDetails}</p>
                <p className="text-[11px] text-amber-700 pt-1 font-semibold">
                  ⚠️ This action will log a permanent audit entry in the Google Sheet ApprovalHistory tab.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter 6-Digit Admin Passcode
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••••"
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-center tracking-widest font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                {authError && <p className="text-xs text-rose-600 mt-1 font-semibold">{authError}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordForResync(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resyncing || authPin.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-600/30 hover:opacity-95 disabled:opacity-50 transition-all"
                >
                  {resyncing ? "Verifying..." : "Confirm Authorized Sync"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
