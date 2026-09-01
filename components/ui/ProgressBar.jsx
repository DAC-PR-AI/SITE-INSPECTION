"use client";

import React from "react";

export default function ProgressBar({
  value = 0,
  max = 100,
  showLabel = true,
  label = "Completion",
  height = "h-2.5",
  className = "",
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className={`w-full font-body ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
          <span>{label}</span>
          <span className="font-mono text-blue-600 font-bold">{percentage}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5 ${height}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-amber-400 to-emerald-400 transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
