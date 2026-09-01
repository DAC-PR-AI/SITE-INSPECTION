"use client";

import React from "react";

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = "",
}) {
  return (
    <div className={`flex items-center gap-1.5 p-1 bg-slate-100/80 border border-slate-200/80 rounded-2xl font-body text-xs overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const id = typeof tab === "object" ? tab.id : tab;
        const label = typeof tab === "object" ? tab.label : tab;
        const count = typeof tab === "object" ? tab.count : null;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all duration-200 whitespace-nowrap select-none ${
              isActive
                ? "bg-white text-blue-600 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <span>{label}</span>
            {count !== null && count !== undefined && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
