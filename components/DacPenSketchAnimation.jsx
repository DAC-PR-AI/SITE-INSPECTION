"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * Animated Architectural Pen Sketch: DAC Logo & "Dream · Ascend · Conquer"
 *
 * Sequence:
 * 1. Pen draws the "D" letter with precision drafting strokes
 * 2. Pen draws the "A" triangular peak and the glowing orange inner pyramid
 * 3. Pen draws the "C" arc curve
 * 4. Pen sweeps across drawing the golden architectural ruler line
 * 5. Pen writes out "DREAM  ·  ASCEND  ·  CONQUER"
 * 6. Completed logo shimmers with blueprint grid glow & verification stamp
 */
export default function DacPenSketchAnimation({ className = "" }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const DURATION_MS = 14000; // 14s smooth loop

  useEffect(() => {
    const tick = (now) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      setProgress((prev) => {
        const next = prev + (delta / DURATION_MS) * 100;
        return next >= 100 ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const p = progress;

  // Phase breakdown
  // 0% - 25% : Letter D
  // 25% - 50% : Letter A + orange inner triangle
  // 50% - 70% : Letter C
  // 70% - 82% : Golden underline
  // 82% - 94% : Motto "DREAM · ASCEND · CONQUER"
  // 94% - 100%: Completed glow reveal & pause

  // Pen position computation based on current stroke
  let penX = 70;
  let penY = 100;
  let penAngle = -35; // degrees
  let penActive = true;
  let currentAction = "Drafting 'D' contour...";

  if (p < 25) {
    // Drawing "D" (Bounding box roughly x: 60..130, y: 70..160)
    const t = p / 25;
    if (t < 0.35) {
      // Down stroke
      penX = 65;
      penY = 70 + (t / 0.35) * 90;
    } else if (t < 0.65) {
      // Curve out
      const ct = (t - 0.35) / 0.3;
      penX = 65 + Math.sin(ct * Math.PI) * 65;
      penY = 160 - ct * 45;
    } else {
      // Curve back
      const ct = (t - 0.65) / 0.35;
      penX = 130 - ct * 65;
      penY = 115 - ct * 45;
    }
    currentAction = "Precision Drafting · Letter 'D'";
  } else if (p < 50) {
    // Drawing "A" and inner orange triangle (x: 140..250, y: 35..160)
    const t = (p - 25) / 25;
    if (t < 0.4) {
      // Left slope up to apex
      const st = t / 0.4;
      penX = 145 + st * 50;
      penY = 160 - st * 125;
    } else if (t < 0.75) {
      // Right slope down
      const st = (t - 0.4) / 0.35;
      penX = 195 + st * 50;
      penY = 35 + st * 125;
    } else {
      // Inner orange triangle
      const st = (t - 0.75) / 0.25;
      penX = 195 + Math.sin(st * Math.PI * 2) * 16;
      penY = 115 + Math.cos(st * Math.PI * 2) * 14;
    }
    currentAction = "Architectural Peak · Letter 'A'";
  } else if (p < 70) {
    // Drawing "C" (x: 260..345, y: 70..160)
    const t = (p - 50) / 20;
    const rad = (Math.PI * 0.2) + t * (Math.PI * 1.6);
    penX = 300 + Math.cos(rad) * 44;
    penY = 115 - Math.sin(rad) * 45;
    currentAction = "Geometric Sweep · Letter 'C'";
  } else if (p < 82) {
    // Golden baseline rule (x: 50 -> 350, y: 178)
    const t = (p - 70) / 12;
    penX = 50 + t * 300;
    penY = 178;
    currentAction = "Ruling Datum Baseline";
  } else if (p < 94) {
    // Writing motto (x: 60 -> 340, y: 204)
    const t = (p - 82) / 12;
    penX = 60 + t * 280;
    penY = 204 + Math.sin(t * Math.PI * 14) * 2;
    currentAction = "Inscribing: DREAM · ASCEND · CONQUER";
  } else {
    // Finale showcase
    penX = 360;
    penY = 220;
    penActive = false;
    currentAction = "DAC Identity Verified · Complete";
  }

  // Smooth stroke progress calculations
  const strokeD = Math.min(1, Math.max(0, p / 25));
  const strokeA = Math.min(1, Math.max(0, (p - 25) / 25));
  const strokeC = Math.min(1, Math.max(0, (p - 50) / 20));
  const strokeLine = Math.min(1, Math.max(0, (p - 70) / 12));
  const strokeText = Math.min(1, Math.max(0, (p - 82) / 12));

  return (
    <div className={`relative select-none pointer-events-none ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-2xl"
      >
        <defs>
          {/* Blueprint CAD Grid */}
          <pattern id="penGridSm" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#38bdf8" strokeWidth="0.4" strokeOpacity="0.12" />
          </pattern>
          <pattern id="penGridLg" width="56" height="56" patternUnits="userSpaceOnUse">
            <rect width="56" height="56" fill="url(#penGridSm)" />
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#60a5fa" strokeWidth="0.75" strokeOpacity="0.2" />
          </pattern>

          {/* Gradients */}
          <linearGradient id="dacBlueInk" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          <linearGradient id="dacOrangeGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>

          <linearGradient id="goldRule" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          <linearGradient id="penBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="30%" stopColor="#94a3b8" />
            <stop offset="70%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="penGoldNib" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Filters */}
          <filter id="inkGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="nibSparkGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ─── BACKGROUND BLUEPRINT CANVAS ───────────────────────────────── */}
        <rect x="8" y="8" width="384" height="264" rx="14" fill="#050e20" />
        <rect x="8" y="8" width="384" height="264" rx="14" fill="url(#penGridLg)" />
        <rect x="8" y="8" width="384" height="264" rx="14" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.3" />

        {/* Technical drafting angle guidelines */}
        <g stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3">
          <line x1="20" y1="70" x2="380" y2="70" />
          <line x1="20" y1="160" x2="380" y2="160" />
          <line x1="195" y1="20" x2="195" y2="240" />
          {/* Compass 45 deg guide */}
          <line x1="145" y1="160" x2="195" y2="35" />
          <line x1="245" y1="160" x2="195" y2="35" />
        </g>

        {/* ─── SKETCHED DAC LOGO PATHS ───────────────────────────────────── */}
        <g filter="url(#inkGlow)">
          {/* --- LETTER 'D' --- */}
          <g>
            {/* Filled letter with progressive opacity */}
            <path
              d="M 58 70 L 102 70 C 122 70 134 82 134 115 C 134 148 122 160 102 160 L 58 160 Z
                 M 82 92 L 82 138 L 98 138 C 108 138 114 132 114 115 C 114 98 108 92 98 92 Z"
              fill="url(#dacBlueInk)"
              fillOpacity={strokeD >= 0.95 ? 0.95 : strokeD * 0.5}
            />
            {/* Outline drafting stroke */}
            <path
              d="M 58 160 L 58 70 L 102 70 C 122 70 134 82 134 115 C 134 148 122 160 102 160 Z"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="420"
              strokeDashoffset={420 * (1 - strokeD)}
            />
          </g>

          {/* --- LETTER 'A' (Peak & Orange Core) --- */}
          <g>
            {/* Main 'A' body */}
            <path
              d="M 195 35 L 246 160 L 218 160 L 206 130 L 184 130 L 172 160 L 144 160 Z
                 M 195 72 L 189 112 L 201 112 Z"
              fill="url(#dacBlueInk)"
              fillOpacity={strokeA >= 0.95 ? 0.95 : strokeA * 0.5}
            />
            {/* 'A' Outline stroke */}
            <path
              d="M 144 160 L 195 35 L 246 160"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.4"
              strokeDasharray="320"
              strokeDashoffset={320 * (1 - strokeA)}
            />

            {/* Glowing Orange Inner Ascending Pyramid */}
            {p > 38 && (
              <polygon
                points="195,84 179,122 211,122"
                fill="url(#dacOrangeGlow)"
                stroke="#f97316"
                strokeWidth="1.5"
                fillOpacity={Math.min(1, (p - 38) / 10)}
                style={{
                  filter: "drop-shadow(0 0 6px rgba(249, 115, 22, 0.8))"
                }}
              />
            )}
          </g>

          {/* --- LETTER 'C' --- */}
          <g>
            <path
              d="M 338 90 C 330 76 316 70 298 70 C 274 70 258 84 258 115 C 258 146 274 160 298 160 C 316 160 330 154 338 140 L 316 130 C 312 138 306 141 298 141 C 286 141 278 132 278 115 C 278 98 286 89 298 89 C 306 89 312 92 316 100 Z"
              fill="url(#dacBlueInk)"
              fillOpacity={strokeC >= 0.95 ? 0.95 : strokeC * 0.5}
            />
            <path
              d="M 338 90 C 330 76 316 70 298 70 C 274 70 258 84 258 115 C 258 146 274 160 298 160 C 316 160 330 154 338 140"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.2"
              strokeDasharray="300"
              strokeDashoffset={300 * (1 - strokeC)}
            />
          </g>

          {/* --- TM REGISTERED SUPERSCRIPT --- */}
          {p > 65 && (
            <text x="345" y="66" fill="#93c5fd" fontSize="9" fontFamily="monospace" fontWeight="bold">
              TM
            </text>
          )}

          {/* --- GOLDEN HORIZONTAL BASELINE RULE --- */}
          <line
            x1="52"
            y1="178"
            x2="52 + 296 * strokeLine"
            y2="178"
            stroke="url(#goldRule)"
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 5px rgba(245, 158, 11, 0.7))"
            }}
          />

          {/* --- MOTTO: "DREAM  ·  ASCEND  ·  CONQUER" --- */}
          {p > 80 && (
            <g opacity={strokeText}>
              <text
                x="200"
                y="204"
                fill="#f8fafc"
                fontSize="12"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="700"
                letterSpacing="4.5"
                textAnchor="middle"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))"
                }}
              >
                DREAM · ASCEND · CONQUER
              </text>
            </g>
          )}
        </g>

        {/* ─── DRAFTING SEAL STAMP (REVEAL AT 92%+) ───────────────────────── */}
        {p > 92 && (
          <g
            transform="translate(306, 218) rotate(-8)"
            opacity={Math.min(1, (p - 92) / 6)}
            style={{ filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.6))" }}
          >
            <rect x="0" y="0" width="76" height="22" rx="4" fill="#064e3b" fillOpacity="0.9" stroke="#34d399" strokeWidth="1.2" />
            <text x="38" y="14.5" fill="#a7f3d0" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              ✓ DAC CERTIFIED
            </text>
          </g>
        )}

        {/* ─── REAL-TIME ANIMATED DRAFTING PEN ────────────────────────────── */}
        {penActive && (
          <g transform={`translate(${penX}, ${penY}) rotate(${penAngle})`}>
            {/* Glowing ink particle / spark at nib tip */}
            <circle cx="0" cy="0" r="4.5" fill="#38bdf8" filter="url(#nibSparkGlow)">
              <animate attributeName="r" values="3.5;6;3.5" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.6;1" dur="0.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="1.8" fill="#ffffff" />

            {/* Fountain Pen Fine Golden Nib */}
            <polygon points="0,0 -3.5,-16 3.5,-16" fill="url(#penGoldNib)" stroke="#78350f" strokeWidth="0.4" />
            <line x1="0" y1="0" x2="0" y2="-12" stroke="#451a03" strokeWidth="0.5" />
            <circle cx="0" cy="-10" r="0.8" fill="#451a03" />

            {/* Pen Grip Section */}
            <rect x="-4.5" y="-30" width="9" height="14" rx="1.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="0.6" />
            {/* Pen Metallic Barrel */}
            <rect x="-5" y="-85" width="10" height="55" rx="2" fill="url(#penBody)" stroke="#475569" strokeWidth="0.6" />
            {/* Gold Ring Accents */}
            <rect x="-5.2" y="-32" width="10.4" height="2" fill="#fbbf24" />
            <rect x="-5.2" y="-60" width="10.4" height="2.5" fill="#fbbf24" />
            {/* Pen Clip */}
            <rect x="-1" y="-82" width="2" height="30" rx="1" fill="#fbbf24" />
          </g>
        )}
      </svg>

      {/* ─── HUD PROGRESS & STATUS CAPTION ───────────────────────────────── */}
      <div className="absolute bottom-1 inset-x-2 bg-slate-950/85 backdrop-blur-md rounded-lg border border-blue-500/25 px-2.5 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span className="font-mono text-[9.5px] text-cyan-300 font-semibold tracking-wide truncate">
            {currentAction}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[9px] text-slate-400">{Math.round(p)}%</span>
          <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400 transition-all duration-75"
              style={{ width: `${p}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
