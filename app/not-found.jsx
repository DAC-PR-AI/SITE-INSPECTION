"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Compass,
  Building2,
  Home,
  ArrowLeft,
  HardHat,
  FileSpreadsheet,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Search
} from "lucide-react";

export default function NotFound() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20;
      const y = (clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-[#060c1a] text-slate-100 flex flex-col justify-between overflow-hidden relative selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Blueprint Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-25 pointer-events-none transition-transform duration-700 ease-out"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px),
            linear-gradient(rgba(245, 158, 11, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245, 158, 11, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
          backgroundPosition: "-1px -1px",
          transform: `translate3d(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px, 0)`
        }}
      />

      {/* Dynamic Glowing Ambient Spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/10 to-amber-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-all duration-300">
            <Building2 className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-lg text-white flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
              DAC DEVELOPERS
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
              Key Handover & Joint Inspection Portal
            </p>
          </div>
        </Link>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-400 font-mono backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          SYSTEM CODE: 404_OFF_GRID
        </div>
      </header>

      {/* Main 404 Interactive Hero Area */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">
        
        {/* Animated Blueprint Compass & 404 Visual Header */}
        <div 
          className="relative mb-8 group cursor-default"
          style={{
            transform: `perspective(1000px) rotateX(${-mousePos.y * 0.3}deg) rotateY(${mousePos.x * 0.3}deg)`
          }}
        >
          {/* Blueprint Circle Frame */}
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto rounded-full border border-blue-500/30 bg-slate-950/60 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-blue-500/10 transition-all duration-500">
            
            {/* Spinning Compass Ring */}
            <div className="absolute inset-2 rounded-full border border-dashed border-amber-500/30 animate-[spin_60s_linear_infinite]" />
            <div className="absolute inset-6 rounded-full border border-blue-400/20" />

            {/* Laser Scanning Line */}
            {isScanning && (
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] animate-[bounce_3s_infinite]" />
              </div>
            )}

            {/* 404 Large Numeric Badge */}
            <div className="relative z-10 flex flex-col items-center">
              <Compass className="w-10 h-10 text-amber-400 mb-1 animate-bounce" />
              <span className="text-6xl sm:text-7xl font-black tracking-tighter bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-['Space_Grotesk']">
                404
              </span>
              <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase">
                Zone Unmapped
              </span>
            </div>

            {/* Corner Blueprint Measurement Crosshairs */}
            <span className="absolute top-2 left-2 text-[9px] font-mono text-slate-600">+0.00</span>
            <span className="absolute top-2 right-2 text-[9px] font-mono text-slate-600">N-94</span>
            <span className="absolute bottom-2 left-2 text-[9px] font-mono text-slate-600">UNSET</span>
            <span className="absolute bottom-2 right-2 text-[9px] font-mono text-slate-600">REV:404</span>
          </div>

          {/* Floating Warning Badge */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/40 backdrop-blur-md px-4 py-1 rounded-full flex items-center gap-2 text-xs font-semibold text-amber-300 shadow-lg">
            <HardHat className="w-3.5 h-3.5 text-amber-400" />
            <span>Site Plan / Blueprint Not Found</span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 max-w-2xl font-['Plus_Jakarta_Sans']">
          This Unit Blueprint is <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">Off-Grid</span>
        </h1>
        
        <p className="text-base sm:text-lg text-slate-400 max-w-xl mb-10 leading-relaxed font-normal">
          The requested inspection checklist page or unit coordinate does not exist, has been relocated, or is currently under structural review.
        </p>

        {/* Structural Inspection Status Matrix Card */}
        <div className="w-full max-w-md bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 mb-10 backdrop-blur-xl text-left shadow-xl">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2.5 mb-3">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              SYSTEM DIAGNOSTIC REPORT
            </span>
            <button 
              onClick={() => setIsScanning(!isScanning)}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning" : "Rescan"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-500 mb-1 text-[10px]">INSPECTION STATUS</div>
              <div className="text-red-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                FAILED (404)
              </div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-500 mb-1 text-[10px]">BLUEPRINT VECTOR</div>
              <div className="text-slate-300 font-semibold truncate">
                /undefined-route
              </div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-500 mb-1 text-[10px]">KEY HANDOVER SEAL</div>
              <div className="text-amber-400 font-semibold">PENDING ROUTE</div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-500 mb-1 text-[10px]">RECOMMENDED ACTION</div>
              <div className="text-blue-400 font-semibold">RETURN HOME</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 flex items-center justify-center gap-2.5 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Home className="w-4 h-4" />
            <span>Return to Inspection Matrix</span>
          </Link>

          <Link
            href="/?tab=approval"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-medium border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-2 backdrop-blur-md transition-all duration-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>Approval Portal</span>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-950/50 hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-medium border border-slate-800/50 flex items-center justify-center gap-2 transition-all duration-200 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>

      </main>

      {/* Footer Info Bar */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>DAC DEVELOPERS DIGITAL HANDOVER PLATFORM</span>
        </div>
        <div>
          <span>© {new Date().getFullYear()} DAC Developers. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
