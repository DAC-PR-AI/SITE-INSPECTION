"use client";

import React from "react";
import { Building2, ShieldCheck, UserCheck } from "lucide-react";

export default function TopNavigation({
  activeTab = "inspection",
  onTabChange,
  currentUserRole = "Site Engineer",
  className = "",
}) {
  return (
    <header className={`sticky top-0 z-30 glass-header w-full px-4 sm:px-6 py-3 font-body ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
            <Building2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-1.5">
              DAC DEVELOPERS
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
              Key Handover & Joint Inspection
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-xs">
          <button
            onClick={() => onTabChange("inspection")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              activeTab === "inspection"
                ? "bg-white text-blue-600 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Checklist Form
          </button>
          <button
            onClick={() => onTabChange("approval")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              activeTab === "approval"
                ? "bg-white text-blue-600 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Approval Portal
          </button>
        </div>

        {/* Right Role Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 text-slate-100 text-xs font-mono shadow-xs">
          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>{currentUserRole}</span>
        </div>
      </div>
    </header>
  );
}
