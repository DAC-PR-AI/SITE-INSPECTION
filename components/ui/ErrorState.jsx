"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Button from "./Button";

export default function ErrorState({
  title = "Failed to load data",
  description = "An unexpected error occurred while communicating with the server.",
  onRetry,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-2xl border border-rose-200 bg-rose-50/50 font-body ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="font-display font-bold text-base text-rose-950 mb-1">
        {title}
      </h3>
      <p className="text-xs text-rose-700 max-w-md mb-4 leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <Button variant="danger" size="sm" icon={RotateCcw} onClick={onRetry}>
          Retry Action
        </Button>
      )}
    </div>
  );
}
