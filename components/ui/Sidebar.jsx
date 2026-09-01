"use client";

import React from "react";
import { Building2, ClipboardCheck, FileSpreadsheet, ShieldCheck, Settings, LogOut } from "lucide-react";

export default function Sidebar({
  activeItem = "inspection",
  onItemSelect,
  className = "",
}) {
  const menuItems = [
    { id: "inspection", label: "Joint Inspection Matrix", icon: ClipboardCheck },
    { id: "approval", label: "Approval Queue Portal", icon: FileSpreadsheet },
    { id: "audit", label: "Audit Timeline Log", icon: ShieldCheck },
  ];

  return (
    <aside className={`w-64 bg-slate-900 text-slate-100 flex flex-col justify-between p-4 min-h-screen font-body ${className}`}>
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
            <Building2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-sm tracking-tight text-white">
              DAC DEVELOPERS
            </h2>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
              HANDOVER PORTAL
            </p>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onItemSelect && onItemSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/80"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-800 px-3 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SYSTEM ACTIVE</span>
        </div>
        <p className="text-[10px]">DAC Key Handover v1.0</p>
      </div>
    </aside>
  );
}
