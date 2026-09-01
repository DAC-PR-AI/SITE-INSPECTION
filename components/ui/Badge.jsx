"use client";

import React from "react";

export default function Badge({
  children,
  variant = "blue", // blue | amber | emerald | rose | slate | cyan | gold
  size = "md", // sm | md | lg
  icon: Icon,
  className = "",
  ...props
}) {
  const baseStyles = "inline-flex items-center gap-1.5 font-body font-bold rounded-full border transition-colors select-none";

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3.5 py-1.5 text-sm",
  };

  const variantStyles = {
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
    gold: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.blue} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span>{children}</span>
    </span>
  );
}
