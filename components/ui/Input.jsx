"use client";

import React, { forwardRef } from "react";

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon,
    className = "",
    type = "text",
    required = false,
    ...props
  },
  ref
) {
  return (
    <div className="w-full font-body">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`w-full text-sm rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 ${
            Icon ? "pl-10" : "pl-3.5"
          } pr-3.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
            error ? "border-rose-300 bg-rose-50/30 focus:ring-rose-400" : ""
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

export default Input;
