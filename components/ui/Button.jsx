"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export default function Button({
  children,
  variant = "primary", // primary | secondary | outline | ghost | danger | gradient
  size = "md", // sm | md | lg
  isLoading = false,
  isDisabled = false,
  icon: Icon,
  className = "",
  type = "button",
  onClick,
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center font-body font-bold rounded-xl transition-all duration-200 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3.5 text-base gap-2.5",
  };

  const variantStyles = {
    primary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-600/20 border border-blue-600",
    secondary: "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs",
    outline: "bg-transparent hover:bg-blue-50/50 text-blue-600 border border-blue-200 hover:border-blue-300",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600 active:bg-slate-200",
    danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/20 border border-rose-600",
    gradient: "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transform hover:-translate-y-0.5 active:translate-y-0",
  };

  return (
    <button
      type={type}
      disabled={isDisabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
