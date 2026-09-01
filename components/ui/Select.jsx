"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

const Select = forwardRef(function Select(
  {
    label,
    options = [],
    error,
    helperText,
    icon: Icon,
    className = "",
    required = false,
    placeholder = "Select an option...",
    children,
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
          <div className="absolute left-3.5 text-slate-400 pointer-events-none z-10">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <select
          ref={ref}
          className={`w-full appearance-none text-sm rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 ${
            Icon ? "pl-10" : "pl-3.5"
          } pr-9 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-pointer ${
            error ? "border-rose-300 bg-rose-50/30 focus:ring-rose-400" : ""
          } ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children
            ? children
            : options.map((opt) => {
                const value = typeof opt === "object" ? opt.value : opt;
                const label = typeof opt === "object" ? opt.label : opt;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
        </select>
        <div className="absolute right-3 text-slate-400 pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

export default Select;
