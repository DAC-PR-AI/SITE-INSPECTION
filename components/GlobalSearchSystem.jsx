"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search, X, RefreshCw, AlertTriangle, Building2, FileText,
  AlertCircle, ArrowUpRight, Eye, Layers, CheckCircle2, SlidersHorizontal
} from "lucide-react";

export default function GlobalSearchSystem({
  isOpen,
  onClose,
  onOpenInspection,
  onNavigateNav,
  className = ""
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced Search Engine (300ms)
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setResults(data.results || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen && onClose) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-body text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── 1. SEARCH INPUT BAR ────────────────────────────────────────── */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3 relative">
          <Search className="w-5 h-5 text-blue-600 shrink-0 ml-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Inspection ID, Project, Unit, Customer, Defect..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-body"
          />
          {loading && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
          {query && !loading && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── 2. SEARCH RESULTS AREA ─────────────────────────────────────── */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto bg-slate-50/50">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!query || query.trim().length < 2 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-2xl bg-white space-y-1">
              <p>Type at least 2 characters to search across DAC database.</p>
              <p className="text-[11px] text-slate-300">Shortcut: Press <b>Ctrl+K</b> to toggle search</p>
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-2xl bg-white space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600" />
              <p>Searching database records for "{query}"...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed rounded-2xl bg-white space-y-1">
              <p>No matching records found for "{query}".</p>
              <p className="text-[11px] text-slate-300">Try searching by Unit Number, Project Name, or Customer Name.</p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-blue-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                      item.type === "Inspection"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : item.type === "Defect"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {item.type}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                  </div>

                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(item.updatedAt).toLocaleDateString("en-GB")}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-body">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-mono">Project</span>
                    <span className="font-bold text-slate-900 truncate block">{item.projectName}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-mono">Unit</span>
                    <span className="font-bold text-amber-700 font-mono block">{item.unitNumber}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-mono">Customer</span>
                    <span className="font-bold text-slate-800 truncate block">{item.customerName}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-mono">Stage / Status</span>
                    <span className="font-bold text-purple-700 font-mono text-[11px] truncate block">{item.currentStage}</span>
                  </div>
                </div>

                {/* ─── QUICK ACTIONS BAR ────────────────────────────────────── */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs font-bold">
                  {item.inspectionId && (
                    <button
                      onClick={() => {
                        if (onOpenInspection) onOpenInspection(item.inspectionId);
                        if (onClose) onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Inspection</span>
                    </button>
                  )}

                  {item.type === "Project" && (
                    <button
                      onClick={() => {
                        if (onNavigateNav) onNavigateNav("projects");
                        if (onClose) onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 flex items-center gap-1 transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>View Project</span>
                    </button>
                  )}

                  {item.type === "Defect" && (
                    <button
                      onClick={() => {
                        if (onNavigateNav) onNavigateNav("defects");
                        if (onClose) onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>View Defects</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── 3. FOOTER ─────────────────────────────────────────────────── */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-slate-400 font-mono text-[11px]">
          <span>{results.length} Matches Found</span>
          <span>Press <b>ESC</b> to close</span>
        </div>
      </div>
    </div>
  );
}
