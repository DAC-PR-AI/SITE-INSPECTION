"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  position = "right", // right | left
  width = "w-full max-w-md",
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

  const positionStyles = {
    right: "right-0 top-0 bottom-0 animate-[slideInRight_0.25s_cubic-bezier(0.16,1,0.3,1)]",
    left: "left-0 top-0 bottom-0 animate-[slideInLeft_0.25s_cubic-bezier(0.16,1,0.3,1)]",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm no-print"
      onMouseDown={onClose}
    >
      <div
        className={`fixed bg-white h-full shadow-2xl flex flex-col font-body ${positionStyles[position] || positionStyles.right} ${width} ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            {title && (
              <h3 className="font-display font-bold text-lg text-slate-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
