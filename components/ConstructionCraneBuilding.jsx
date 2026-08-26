"use client";

import React from "react";

/**
 * Clean Animated Quality / Inspection Shield & Blueprint Accent
 * Simple, elegant, technical graphic for the login hero banner.
 */
export default function ConstructionCraneBuilding({ className = "" }) {
  return (
    <div className={`relative pointer-events-none select-none ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Blueprint Grid Pattern */}
          <pattern id="qcSmallGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0L0 0 0 16" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.12" />
          </pattern>
          <pattern id="qcLargeGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect width="64" height="64" fill="url(#qcSmallGrid)" />
            <path d="M64 0L0 0 0 64" fill="none" stroke="#60a5fa" strokeWidth="0.8" strokeOpacity="0.22" />
          </pattern>

          {/* Gradients */}
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#1e3a8a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0c1e45" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="shieldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          <linearGradient id="glowLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="accentCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Filters */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="highGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ─── BACKGROUND TECHNICAL GRID ───────────────────────────────────── */}
        <g opacity="0.8">
          <rect x="20" y="20" width="360" height="320" rx="16" fill="url(#qcLargeGrid)" />
          {/* Outer Border Frame */}
          <rect
            x="20"
            y="20"
            width="360"
            height="320"
            rx="16"
            stroke="#60a5fa"
            strokeWidth="0.8"
            strokeDasharray="8 6"
            opacity="0.3"
          />
          {/* Corner CAD Registration Marks */}
          <g stroke="#38bdf8" strokeWidth="1.2" opacity="0.6">
            <path d="M 12 28 L 28 28 M 28 12 L 28 28" />
            <path d="M 388 28 L 372 28 M 372 12 L 372 28" />
            <path d="M 12 332 L 28 332 M 28 348 L 28 332" />
            <path d="M 388 332 L 372 332 M 372 348 L 372 332" />
          </g>
        </g>

        {/* ─── RADAR / COMPASS TECHNICAL CIRCLES ───────────────────────────── */}
        <g transform="translate(200, 170)">
          {/* Outer Rotating Measurement Ring */}
          <circle
            cx="0"
            cy="0"
            r="115"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="4 8"
            opacity="0.35"
            className="animate-spin-slow"
            style={{ transformOrigin: "center" }}
          />

          {/* Calibrated Compass Ring */}
          <circle cx="0" cy="0" r="95" stroke="#60a5fa" strokeWidth="1.2" opacity="0.4" />
          {/* Compass Ticks */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-95"
              x2="0"
              y2={deg % 90 === 0 ? "-85" : "-90"}
              stroke="#38bdf8"
              strokeWidth={deg % 90 === 0 ? "1.5" : "0.8"}
              opacity="0.5"
              transform={`rotate(${deg})`}
            />
          ))}

          {/* Crosshair Centerlines */}
          <line x1="-125" y1="0" x2="125" y2="0" stroke="#38bdf8" strokeWidth="0.6" strokeDasharray="6 4" opacity="0.35" />
          <line x1="0" y1="-125" x2="0" y2="125" stroke="#38bdf8" strokeWidth="0.6" strokeDasharray="6 4" opacity="0.35" />

          {/* ─── QUALITY SHIELD ICON ────────────────────────────────────────── */}
          <g filter="url(#softGlow)">
            {/* Main Shield Body */}
            <path
              d="M 0 -68
                 C 38 -68 64 -54 64 -54
                 C 64 8 36 56 0 74
                 C -36 56 -64 8 -64 -54
                 C -64 -54 -38 -68 0 -68 Z"
              fill="url(#shieldGrad)"
              stroke="url(#shieldStroke)"
              strokeWidth="2.5"
            />

            {/* Inner Shield Accent Line */}
            <path
              d="M 0 -58
                 C 30 -58 52 -46 52 -46
                 C 52 4 28 44 0 60
                 C -28 44 -52 4 -52 -46
                 C -52 -46 -30 -58 0 -58 Z"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.65"
            />

            {/* Big Verification Checkmark */}
            <path
              d="M -24 -2 L -6 18 L 26 -16"
              fill="none"
              stroke="url(#accentCyan)"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#highGlow)"
            />
            <path
              d="M -24 -2 L -6 18 L 26 -16"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Subtle Pulse Center Dot */}
            <circle cx="0" cy="40" r="2.5" fill="#38bdf8" opacity="0.8">
              <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Angle Measurement Arc Accent */}
          <path
            d="M 68 -30 A 75 75 0 0 1 75 0"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.6"
          />
          <text x="82" y="-12" fill="#67e8f9" fontSize="7.5" fontFamily="monospace" opacity="0.8">45.0°</text>
        </g>

        {/* ─── TECHNICAL ANNOTATIONS & LABELS ──────────────────────────────── */}
        <g fontFamily="monospace" fontSize="8" fill="#93c5fd" opacity="0.75">
          {/* Top-Left Tag */}
          <rect x="36" y="34" width="96" height="18" rx="4" fill="#0f172a" fillOpacity="0.8" stroke="#38bdf8" strokeWidth="0.8" />
          <text x="44" y="46" fill="#38bdf8" fontWeight="bold">DAC · QA / QC</text>

          {/* Top-Right Status */}
          <rect x="268" y="34" width="96" height="18" rx="4" fill="#064e3b" fillOpacity="0.7" stroke="#34d399" strokeWidth="0.8" />
          <text x="276" y="46" fill="#6ee7b7" fontWeight="bold">STATUS: VERIFIED</text>

          {/* Bottom Coordinate & Precision Metrics */}
          <text x="36" y="322" fill="#60a5fa" fontSize="7.5">TOLERANCE: ±0.00 mm</text>
          <text x="262" y="322" fill="#60a5fa" fontSize="7.5">GRID: 16×16 CAD ISO</text>
        </g>

        {/* Dimension Line across bottom */}
        <g opacity="0.45">
          <line x1="36" y1="330" x2="364" y2="330" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4 2" />
          <line x1="36" y1="326" x2="36" y2="334" stroke="#38bdf8" strokeWidth="1" />
          <line x1="364" y1="326" x2="364" y2="334" stroke="#38bdf8" strokeWidth="1" />
        </g>

        {/* CSS Animation */}
        <style>{`
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin-slow {
            animation: spinSlow 36s linear infinite;
          }
        `}</style>
      </svg>
    </div>
  );
}
