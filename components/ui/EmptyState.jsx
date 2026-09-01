"use client";

import React from "react";
import { Compass, Search } from "lucide-react";

export default function EmptyState({
  title = "No Inspections Found",
  description = "No matching records found for the selected filter or query.",
  icon: Icon = Compass,
  action,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-sm font-body ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-xs">
        <Icon className="w-7 h-7 stroke-[1.75]" />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-900 mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
