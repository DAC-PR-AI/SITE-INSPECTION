"use client";

import React from "react";

export default function PageHeader({
  title,
  subtitle,
  badgeText,
  action,
  backButton,
  className = "",
}) {
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80 font-body ${className}`}>
      <div className="flex items-center gap-3">
        {backButton && <div>{backButton}</div>}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
              {title}
            </h1>
            {badgeText && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
