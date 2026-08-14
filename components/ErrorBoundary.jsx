"use client";

import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an unhandled error]:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Something unexpected happened</h2>
            <p className="text-sm text-slate-400 mb-6">
              The application recovered safely. Any data already saved remains secure.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-700/50 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw size={16} /> Try Again
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-colors"
              >
                <Home size={16} /> Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
