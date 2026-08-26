"use client";

import React, { useState, useEffect } from "react";
import { Building2, CheckCircle2, ShieldCheck, Cpu, Sparkles, Layers, HardHat } from "lucide-react";
import ConstructionCraneBuilding from "./ConstructionCraneBuilding";

export default function InspectionLoadingOverlay({
  project = "",
  unit = "",
  inspectionType = "",
  title = "Initializing Joint Inspection",
  subtitle = "Preparing room-by-room checklist & connecting cloud database...",
}) {
  const [progress, setProgress] = useState(12);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0.0);

  const steps = [
    { label: "Verifying Site Engineer Credentials", icon: ShieldCheck },
    { label: "Connecting Cloud Database & Sheets", icon: Cpu },
    { label: `Loading Blueprint & Unit Records (${unit || "Unit"})`, icon: Layers },
    { label: "Building Interactive Checklist Matrix", icon: CheckCircle2 },
  ];

  useEffect(() => {
    // Smooth progress simulation up to 94%
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return 94;
        const diff = Math.max(1, Math.floor((95 - prev) * 0.1));
        return prev + diff;
      });
    }, 180);

    // Step state progression
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1100);

    // Elapsed timer
    const startTime = Date.now();
    const elapsedTimer = setInterval(() => {
      setElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#060c1a]/90 backdrop-blur-2xl text-slate-100 select-none animate-[fadein_0.25s_ease-out]">
      {/* Ambient glowing backdrop Orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-amber-500/20 rounded-full blur-[130px] pointer-events-none animate-pulse" />
      
      {/* Blueprint Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Central Floating Card */}
      <div className="relative w-full max-w-xl bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-950/50 backdrop-blur-xl overflow-hidden text-center transform transition-all animate-[popin_0.3s_cubic-bezier(0.16,1,0.3,1)]">
        
        {/* Top Decorative Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-amber-400 to-emerald-400 animate-pulse" />

        {/* Graphic & Icon Header */}
        <div className="relative w-28 h-28 mx-auto mb-4 flex items-center justify-center">
          <ConstructionCraneBuilding className="w-full h-full text-blue-400" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-400/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
              <HardHat className="w-7 h-7 text-amber-400 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 font-['Plus_Jakarta_Sans']">
          {title}
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
          {subtitle}
        </p>

        {/* Project & Unit Info Pill Card */}
        {(project || unit) && (
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 mb-6 shadow-inner">
            {project && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-white">{project}</span>
              </div>
            )}
            {project && unit && <span className="text-slate-600">•</span>}
            {unit && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Unit:</span>
                <span className="font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {unit}
                </span>
              </div>
            )}
            {inspectionType && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 capitalize">{inspectionType}</span>
              </>
            )}
          </div>
        )}

        {/* Progress Bar Container */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              SYSTEM LOAD: {progress}%
            </span>
            <span className="text-slate-500">{elapsed}s</span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 p-0.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-amber-400 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps Progress Checklist */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-left font-mono text-xs space-y-2.5">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between transition-all duration-300 ${
                  isCurrent
                    ? "text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20"
                    : isDone
                    ? "text-slate-400 p-1"
                    : "text-slate-600 p-1 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isDone
                        ? "text-emerald-400"
                        : isCurrent
                        ? "text-amber-400 animate-pulse"
                        : "text-slate-600"
                    }`}
                  />
                  <span>{step.label}</span>
                </div>

                <div>
                  {isDone ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      READY
                    </span>
                  ) : isCurrent ? (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                      PROCESSING...
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600">WAITING</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Security Note */}
        <p className="mt-4 text-[11px] text-slate-500 font-mono">
          🔒 Encrypted Joint Inspection Protocol • DAC Developers Key Handover
        </p>

      </div>
    </div>
  );
}
