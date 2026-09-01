"use client";

import React, { useState, useEffect } from "react";
import {
  Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle,
  Database, Clock, ArrowDown, ArrowUp, Activity, Server
} from "lucide-react";

export default function SheetConnectionMonitor({ className = "" }) {
  const [status, setStatus] = useState("Connected"); // Connected | Syncing | Failed | Unavailable
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState(new Date().toLocaleString("en-GB"));
  const [lastRead, setLastRead] = useState(new Date().toLocaleString("en-GB"));
  const [lastWrite, setLastWrite] = useState(new Date().toLocaleString("en-GB"));
  const [rowsRetrieved, setRowsRetrieved] = useState(0);
  const [rowsUpdated, setRowsUpdated] = useState(0);
  const [errorsCount, setErrorsCount] = useState(0);
  const [lastErrorMessage, setLastErrorMessage] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    setTesting(true);
    setStatus("Syncing");
    const startTime = Date.now();

    try {
      const res = await fetch("/api/approval?role=Admin");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const rows = Array.isArray(data.inspections) ? data.inspections.length : 0;
      const nowStr = new Date().toLocaleString("en-GB");

      setStatus("Connected");
      setLastSuccessfulSync(nowStr);
      setLastRead(nowStr);
      setRowsRetrieved(rows);
      setLastErrorMessage("");
    } catch (err) {
      console.error("[SheetConnectionMonitor] Connection failed:", err.message);
      setStatus("Unavailable");
      setErrorsCount((prev) => prev + 1);
      setLastErrorMessage(err.message || "Google Sheet connection unavailable");
    } finally {
      setTesting(false);
    }
  }

  let statusBadgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-300";
  let statusDotStyle = "bg-emerald-500 animate-pulse";
  let statusIcon = <Wifi className="w-4 h-4 text-emerald-600" />;

  if (status === "Syncing") {
    statusBadgeStyle = "bg-blue-50 text-blue-800 border-blue-300";
    statusDotStyle = "bg-blue-500 animate-ping";
    statusIcon = <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
  } else if (status === "Unavailable" || status === "Failed") {
    statusBadgeStyle = "bg-rose-50 text-rose-800 border-rose-300";
    statusDotStyle = "bg-rose-500";
    statusIcon = <WifiOff className="w-4 h-4 text-rose-600" />;
  }

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 font-body ${className}`}>
      
      {/* ─── HEADER & STATUS BADGE ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
            <Server className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-slate-900">
              Google Sheet Connection Monitor
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Target Spreadsheet ID: Live Production Integration
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-3">
          <div className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold border flex items-center gap-2 ${statusBadgeStyle}`}>
            <span className={`w-2 h-2 rounded-full ${statusDotStyle}`} />
            {statusIcon}
            <span>{status === "Unavailable" ? "Google Sheet connection unavailable" : status}</span>
          </div>

          <button
            onClick={checkConnection}
            disabled={testing}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${testing ? "animate-spin" : ""}`} />
            <span>Test Connection</span>
          </button>
        </div>
      </div>

      {/* ─── UNAVAILABLE ERROR BANNER ─────────────────────────────────────── */}
      {status === "Unavailable" && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-xs font-mono">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Google Sheet connection unavailable</h4>
            <p className="text-rose-700 mt-0.5">
              Failed to connect to Google Sheets API endpoint. Systems will not silently switch to fake data sources.
            </p>
            <p className="text-slate-600 mt-1 font-semibold">
              Last Successful Sync: <b>{lastSuccessfulSync || "N/A"}</b>
            </p>
          </div>
        </div>
      )}

      {/* ─── CONNECTION METRICS GRID ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
        {/* Last Read */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-emerald-600" /> Last Read
          </span>
          <div className="font-bold text-slate-900 mt-1.5 text-[11px] truncate">
            {lastRead}
          </div>
        </div>

        {/* Last Write */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-blue-600" /> Last Write
          </span>
          <div className="font-bold text-slate-900 mt-1.5 text-[11px] truncate">
            {lastWrite}
          </div>
        </div>

        {/* Rows Retrieved */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Rows Retrieved</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {rowsRetrieved}
          </div>
        </div>

        {/* Rows Updated */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Rows Updated</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {rowsUpdated}
          </div>
        </div>

        {/* Errors Count */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase">API Errors</span>
          <div className={`text-xl font-bold mt-1 ${errorsCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {errorsCount}
          </div>
        </div>
      </div>
    </div>
  );
}
