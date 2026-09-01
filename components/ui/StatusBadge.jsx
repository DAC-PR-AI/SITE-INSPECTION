"use client";

import React from "react";
import { CheckCircle2, XCircle, Clock, MinusCircle, ShieldCheck } from "lucide-react";

export default function StatusBadge({ status, className = "" }) {
  if (!status) return null;
  const s = String(status).toLowerCase();

  if (s === "pass" || s === "passed" || s === "ok") {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Pass</span>
      </span>
    );
  }

  if (s === "fail" || s === "failed") {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 ${className}`}>
        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>Fail</span>
      </span>
    );
  }

  if (s === "na" || s === "n/a") {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}>
        <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>N/A</span>
      </span>
    );
  }

  if (s === "completed") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Completed</span>
      </span>
    );
  }

  if (s === "rejected") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 ${className}`}>
        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>Rejected</span>
      </span>
    );
  }

  // Pending / Waiting fallback
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 ${className}`}>
      <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse shrink-0" />
      <span className="capitalize">{status.replace(/_/g, " ")}</span>
    </span>
  );
}
