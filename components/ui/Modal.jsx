"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg", // max-w-sm | max-w-md | max-w-lg | max-w-xl | max-w-2xl | max-w-4xl
  className = "",
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadein_0.15s_ease-out] no-print"
      onMouseDown={onClose}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} p-6 relative animate-[popin_0.2s_cubic-bezier(0.16,1,0.3,1)] font-body ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {(title || subtitle) && (
          <div className="mb-4 pr-8">
            {title && (
              <h3 className="font-display font-bold text-lg text-slate-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        )}

        <div>{children}</div>
      </div>
    </div>
  );
}
