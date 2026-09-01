"use client";

import React from "react";

export default function Card({
  children,
  variant = "default", // default | glass | dark | blueprint | outline
  padding = "md", // none | sm | md | lg
  className = "",
  title,
  subtitle,
  headerAction,
  footer,
  ...props
}) {
  const baseStyles = "rounded-2xl transition-all duration-200";

  const paddingStyles = {
    none: "p-0",
    sm: "p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  const variantStyles = {
    default: "bg-white border border-slate-200 shadow-xs text-slate-900",
    glass: "glass-panel text-slate-900 shadow-sm",
    dark: "bg-slate-900/80 border border-slate-800 text-slate-100 shadow-2xl backdrop-blur-xl",
    blueprint: "blueprint-surface text-slate-100 border border-blue-500/30 shadow-2xl",
    outline: "bg-transparent border border-slate-200 text-slate-900",
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.default} ${paddingStyles[padding] || paddingStyles.md} ${className}`}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            {title && (
              <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-body text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {footer}
        </div>
      )}
    </div>
  );
}
