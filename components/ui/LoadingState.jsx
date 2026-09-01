"use client";

import React from "react";
import { Loader2, HardHat } from "lucide-react";

export default function LoadingState({
  title = "Loading Data...",
  subtitle = "Please wait while we fetch the latest records...",
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center font-body ${className}`}>
      <div className="relative w-12 h-12 mb-4 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <HardHat className="w-5 h-5 text-amber-500 absolute" />
      </div>
      <h3 className="font-display font-bold text-base text-slate-900 mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-500 font-mono">
        {subtitle}
      </p>
    </div>
  );
}
