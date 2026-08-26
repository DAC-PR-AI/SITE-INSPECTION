"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  CheckCircle2, XCircle, MinusCircle, Camera, Trash2, X,
  ChevronRight, Search, FileDown, FileJson,
  PenTool, RotateCcw, Save, Building2, ClipboardCheck, AlertTriangle,
  Clock, ArrowLeft, Undo2, Check, Mic, CalendarDays, Hash,
  LayoutGrid, ListChecks, Loader2, ShieldCheck, WifiOff,
  Compass, Ruler, HardDrive, Cloud, Gauge, Lock
} from "lucide-react";
import ApprovalPortal from "./ApprovalPortal";
import JointInspectionPrintDoc from "./JointInspectionPrintDoc";
import InspectionLoadingOverlay from "./InspectionLoadingOverlay";


/* ---------------------------------------------------------------------- */
/* Static checklist data (mirrors the paper form)                          */
/* ---------------------------------------------------------------------- */
const DEFAULT_PROJECT_UNITS = {
  "DAC Aspire Heights": ["A-101", "A-102", "A-203", "B-201", "B-202", "B-305"],
  "DAC Serene County": ["T1-01", "T1-02", "T2-01", "T2-04"],
  "DAC Elan Grande": ["G-301", "G-302", "G-401", "G-402"],
};

const AREAS = [
  { key: "living", label: "Living" },
  { key: "dining", label: "Dining" },
  { key: "kitchen", label: "Kitchen" },
  { key: "utility", label: "Utility / Wash Area" },
  { key: "mbed", label: "M.Bed Rm 1 & Att. Toilet" },
  { key: "bed2", label: "Bed Room 2" },
  { key: "bed3", label: "Bed Room 3" },
  { key: "toilets", label: "Toilets" },
  { key: "balcony", label: "Balcony" },
  { key: "addl", label: "Additional (if any)" },
];

const ITEMS = [
  { id: 1, label: "Doors & Windows" },
  { id: 2, label: "Locks and Latches" },
  { id: 3, label: "Wall Painting" },
  { id: 4, label: "Doors & Windows Painting" },
  { id: 5, label: "Tiles – Hall / Toilets / Bedrooms / Kitchens & Balcony" },
  { id: 6, label: "Electrical Fittings" },
  { id: 7, label: "Main Door" },
  { id: 8, label: "Toilet Fittings" },
  { id: 9, label: "Kitchen – Granite Slab / Shelf" },
  { id: 10, label: "Plumbing Lines – All Places" },
  { id: 11, label: "Cleaning" },
];

const SIGNATORIES = [
  { key: "customer", label: "Customer Sign", directSign: true },
  { key: "siteEngineer", label: "Site Engineer", directSign: true },
  { key: "qaqc", label: "QA/QC In-Charge", directSign: false },
  { key: "projectManager", label: "Project Manager", directSign: false },
  { key: "technicalExecutive", label: "Technical Executive", directSign: false },
  { key: "managerTechnical", label: "Manager Technical", directSign: false },
  { key: "gmHug", label: "GM – HUG", subtitle: "Mr. Vijayachandar", directSign: false },
  { key: "vpHug", label: "VP – HUG", subtitle: "Mrs. Sony Dhiraj", directSign: false },
];

/* ---------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ---------------------------------------------------------------------- */
function genInspectionId() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DAC-JIC-${y}${m}${day}-${rand}`;
}

function freshInspection(projectName, unitNumber, inspectionType = "INTERIOR JOINT INSPECTION") {
  const now = new Date();
  return {
    projectName,
    unitNumber,
    inspectionType,
    workflowStatus: "DRAFT",
    customerName: "",
    inspectionDate: now.toISOString().slice(0, 10),
    inspectionTime: now.toTimeString().slice(0, 5),
    inspectionId: genInspectionId(),
    cells: {},
    generalRemarks: "",
    interiorDays: "",
    declarationChecked: false,
    signatures: {},
    approvalHistory: [],
    status: "draft",
    updatedAt: now.toISOString(),
  };
}

function cellKey(itemId, areaKey) {
  return `${itemId}__${areaKey}`;
}
function getCell(data, itemId, areaKey) {
  return data.cells[cellKey(itemId, areaKey)] || { status: null };
}

// Photos are compressed hard because the final JSON has to fit inside
// Google Sheets cells (see lib/sheets.js chunking).
function compressImage(file, maxWidth = 700, quality = 0.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(inspectionId, photoType, dataUrl, itemId, areaKey, project = "", unit = "") {
  try {
    const res = await fetch("/api/photos/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionId, photoType, dataUrl, itemId, areaKey, project, unit }),
    });
    if (!res.ok) throw new Error("Upload failed");
    const json = await res.json();
    return json.url;
  } catch (err) {
    console.error("Photo upload failed, falling back to local base64:", err);
    return dataUrl;
  }
}

/* ---------------------------------------------------------------------- */
/* Toasts                                                                   */
/* ---------------------------------------------------------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = "default") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`font-body text-sm px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2
          ${t.tone === "error" ? "bg-[var(--fail-bg)] border-red-200 text-[var(--fail)]" :
            t.tone === "success" ? "bg-[var(--pass-bg)] border-green-200 text-[var(--pass)]" :
            "bg-white border-[var(--line)] text-[var(--ink)]"}`}
          style={{ minWidth: 220, animation: "fadein .2s ease" }}
        >
          {t.tone === "success" && <Check size={16} />}
          {t.tone === "error" && <AlertTriangle size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Signature canvas + modal                                                */
/* ---------------------------------------------------------------------- */
function SignatureCanvas({ onReady }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const pathsRef = useRef([]);
  const drawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F1B2D";
    ctx.lineWidth = 2.4 * (canvas._dpr || 1);
    pathsRef.current.forEach((path) => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas._dpr = dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      redraw();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [redraw]);

  useEffect(() => {
    onReady({
      clear: () => { pathsRef.current = []; redraw(); },
      undo: () => { pathsRef.current.pop(); redraw(); },
      isEmpty: () => pathsRef.current.length === 0,
      exportPNG: () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        try {
          const ctx = canvas.getContext("2d");
          const w = canvas.width;
          const h = canvas.height;
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          let minX = w, minY = h, maxX = 0, maxY = 0;
          let hasDrawn = false;

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const alpha = data[idx + 3];
              if (alpha > 15) {
                hasDrawn = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (!hasDrawn) return "";

          const padding = 12;
          const cropX = Math.max(0, minX - padding);
          const cropY = Math.max(0, minY - padding);
          const cropW = Math.min(w - cropX, maxX - minX + padding * 2);
          const cropH = Math.min(h - cropY, maxY - minY + padding * 2);

          const trimmedCanvas = document.createElement("canvas");
          trimmedCanvas.width = cropW;
          trimmedCanvas.height = cropH;
          const trimmedCtx = trimmedCanvas.getContext("2d");
          trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          return trimmedCanvas.toDataURL("image/png");
        } catch (err) {
          console.warn("Trim signature fallback:", err);
          return canvas.toDataURL("image/png");
        }
      },
    });
  }, [onReady, redraw]);

  function getPoint(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }
  function start(e) { e.preventDefault(); drawingRef.current = true; pathsRef.current.push([getPoint(e)]); redraw(); }
  function move(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    pathsRef.current[pathsRef.current.length - 1].push(getPoint(e));
    redraw();
  }
  function end(e) { if (e) e.preventDefault(); drawingRef.current = false; }

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-56 sm:h-64 bg-[var(--paper)] rounded-xl border border-[var(--line)] overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair block"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div className="absolute bottom-3 left-4 right-4 border-b border-dashed border-[var(--line)] pointer-events-none" />
    </div>
  );
}

function SignatureModal({ signatory, onClose, onSave }) {
  const apiRef = useRef(null);
  const [signerName, setSignerName] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    if (apiRef.current?.isEmpty()) {
      setError("Please draw your signature before saving.");
      return;
    }

    const png = apiRef.current.exportPNG();
    onSave(png, signerName.trim() || signatory.label);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" onMouseDown={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 duration-150" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20} /></button>
        <div className="flex items-center gap-2 mb-1">
          <PenTool size={18} className="text-blue-600" />
          <h3 className="font-display font-bold text-lg text-slate-900">Sign as {signatory.label}</h3>
        </div>
        {signatory.subtitle ? (
          <p className="font-body text-xs text-slate-500 mb-4">{signatory.subtitle}</p>
        ) : (
          <p className="font-body text-xs text-emerald-600 mb-4">Direct On-Site Signature</p>
        )}

        {error && (
          <div className="mb-4 text-xs font-body text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </div>
        )}

        <div className="mb-4">
          <label className="font-body text-xs font-semibold text-slate-700 mb-1 block">
            Signer Name (Optional)
          </label>
          <input
            value={signerName}
            onChange={(e) => { setSignerName(e.target.value); setError(""); }}
            placeholder={signatory.label}
            className="w-full text-sm font-body rounded-xl border border-slate-200 p-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div>
          <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">
            Digital Signature <span className="text-rose-500">*</span>
          </label>
          <SignatureCanvas onReady={(api) => (apiRef.current = api)} />
          <p className="font-body text-[11px] text-slate-400 mt-1.5">Sign above using finger, stylus, or mouse pointer.</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-5 items-center">
          <button onClick={() => apiRef.current?.undo()} className="font-body text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><Undo2 size={14} /> Undo</button>
          <button onClick={() => apiRef.current?.clear()} className="font-body text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 flex items-center gap-1.5 hover:bg-slate-50"><RotateCcw size={14} /> Clear</button>
          <div className="flex-1" />
          <button onClick={onClose} className="font-body text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700">Cancel</button>
          <button
            onClick={handleSave}
            className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Check size={14} /> Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Customer Verification Photo                                             */
/* ---------------------------------------------------------------------- */
function CustomerVerificationPhoto({ data, updateField, push }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const photo = data?.customerVerificationPhoto;

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const url = await uploadPhoto(data?.inspectionId, 'customerVerification', compressed, null, null, data?.projectName, data?.unitNumber);
      updateField({ customerVerificationPhoto: url });
      if (push) push("Customer verification photo captured.", "success");
    } catch {
      if (push) push("Failed to process photo.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 relative tick shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
            <Camera size={20} className="text-blue-600" /> Customer Verification Photo <span className="text-rose-500">*</span>
          </h2>
          <p className="font-body text-xs text-slate-600 mt-1">
            Take a photo with the customer as proof of verification.
          </p>
        </div>
        {photo ? (
          <span className="font-body text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" /> Photo Attached
          </span>
        ) : (
          <span className="font-body text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-rose-500" /> Required
          </span>
        )}
      </div>

      <div className="mt-4">
        {photo ? (
          <div className="relative max-w-sm rounded-2xl overflow-hidden border border-slate-200 shadow-sm group bg-slate-50">
            <img src={photo} alt="Customer Verification Photo" className="w-full h-56 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="font-body text-xs font-semibold px-3.5 py-2 rounded-xl bg-white text-slate-800 hover:bg-slate-100 shadow-md flex items-center gap-1.5"
              >
                <Camera size={14} /> Retake Photo
              </button>
              <button
                type="button"
                onClick={() => updateField({ customerVerificationPhoto: null })}
                className="font-body text-xs font-semibold px-3.5 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-md flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="w-full max-w-md h-40 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50 cursor-pointer flex flex-col items-center justify-center text-blue-600 transition-all gap-2 p-4 text-center group"
          >
            {busy ? (
              <Loader2 size={24} className="animate-spin text-blue-600" />
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera size={24} />
                </div>
                <div>
                  <p className="font-body text-xs font-bold text-slate-800">Click to Capture / Upload Verification Photo</p>
                  <p className="font-body text-[11px] text-slate-500 mt-0.5">Photo showing executive and customer together</p>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {!photo && (
        <p className="font-body text-xs text-rose-600 mt-3 font-semibold flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-3 rounded-xl">
          <AlertTriangle size={15} className="shrink-0 text-rose-500" />
          Customer verification photo is required before completing the inspection.
        </p>
      )}
    </div>
  );
}

function SignatureBox({ signatory, value, onSign, hasVerificationPhoto = true, push }) {
  const [open, setOpen] = useState(false);
  const isSigned = !!value;
  const isClickable = signatory.directSign === true;

  const handleClick = () => {
    if (!isClickable || isSigned) return;
    if (!hasVerificationPhoto) {
      if (push) push("Customer verification photo is required before completing the inspection.", "error");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="relative">
        <div
          onClick={handleClick}
          className={`w-full rounded-2xl p-3.5 text-left transition-all duration-150 relative ${
            isSigned
              ? "border border-emerald-300 bg-emerald-50/60 shadow-xs cursor-default"
              : isClickable
              ? hasVerificationPhoto
                ? "border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 cursor-pointer group shadow-xs hover:border-blue-400"
                : "border-2 border-dashed border-amber-300 bg-amber-50/40 cursor-pointer group shadow-xs hover:border-amber-400"
              : "border border-slate-200 bg-slate-100/80 cursor-not-allowed opacity-80"
          }`}
        >
          {isSigned ? (
            <div className="space-y-1.5">
              <div className="h-14 flex items-center justify-center bg-white/70 rounded-xl border border-emerald-100 p-1">
                {value.startsWith("data:") ? (
                  <img src={value} alt={`${signatory.label} signature`} className="h-full max-h-12 object-contain" />
                ) : (
                  <span className="font-body text-xs font-bold text-emerald-800">✓ Digitally Signed</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 text-[11px] font-body text-emerald-700 font-bold">
                <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-600" /> Signed & Locked</span>
                <Lock size={12} className="text-emerald-600" />
              </div>
            </div>
          ) : isClickable ? (
            <div className="flex flex-col items-center justify-center h-20 text-blue-600">
              <PenTool size={20} className="mb-1.5 group-hover:scale-110 transition-transform" />
              <span className="font-body text-xs font-bold">Click to Sign</span>
              <span className="font-body text-[10px] text-blue-500 font-medium">
                {hasVerificationPhoto ? "Direct Signature" : "Photo Required First"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 text-slate-500">
              <Lock size={18} className="mb-1.5 text-slate-400" />
              <span className="font-body text-xs font-bold text-slate-700">Locked · Portal Sign-off</span>
              <span className="font-body text-[10px] text-slate-500">Authorized via Portal Only</span>
            </div>
          )}
        </div>
        <div className="mt-2">
          <p className="font-body text-xs font-bold text-slate-800">{signatory.label}</p>
          {signatory.subtitle ? (
            <p className="font-body text-[11px] text-slate-500 font-medium">{signatory.subtitle}</p>
          ) : (
            <p className="font-body text-[11px] text-slate-400">
              {isClickable ? "On-site sign-off" : "Multi-level approval role"}
            </p>
          )}
        </div>
      </div>
      {open && isClickable && (
        <SignatureModal
          signatory={signatory}
          onClose={() => setOpen(false)}
          onSave={(dataUrl, name) => {
            onSign(signatory.key, dataUrl, name);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Status segmented control                                                */
/* ---------------------------------------------------------------------- */
const STATUS_META = {
  pass: { label: "Pass", icon: CheckCircle2, color: "var(--pass)", bg: "var(--pass-bg)" },
  fail: { label: "Fail", icon: XCircle, color: "var(--fail)", bg: "var(--fail-bg)" },
  na: { label: "N/A", icon: MinusCircle, color: "var(--na)", bg: "var(--na-bg)" },
};

function StatusSegmented({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shadow-inner">
      {[
        { key: "pass", label: "Pass", icon: CheckCircle2, activeBg: "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 border-emerald-400" },
        { key: "fail", label: "Fail", icon: XCircle, activeBg: "bg-rose-500 text-white shadow-md shadow-rose-500/25 border-rose-400" },
        { key: "na", label: "N/A", icon: MinusCircle, activeBg: "bg-slate-700 text-white shadow-md shadow-slate-700/20 border-slate-600" },
      ].map(({ key, label, icon: Icon, activeBg }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`font-body text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200 font-semibold border ${
              active
                ? `${activeBg} scale-[1.03]`
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/80"
            }`}
          >
            <Icon size={14} className={active ? "text-white" : "text-slate-400"} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Fail detail expansion                                                   */
/* ---------------------------------------------------------------------- */
function FailDetails({ cell, onUpdate, inspectionId, itemId, areaKey }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files) {
    setBusy(true);
    try {
      const existing = cell.photos || [];
      const room = Math.max(0, 4 - existing.length);
      const arr = Array.from(files).slice(0, room);
      const compressed = await Promise.all(arr.map((f) => compressImage(f)));
      const uploadedUrls = await Promise.all(compressed.map((dataUrl) => uploadPhoto(inspectionId, 'fail', dataUrl, itemId, areaKey, data?.projectName, data?.unitNumber)));
      onUpdate({ photos: [...existing, ...uploadedUrls.map((url) => ({ id: Math.random().toString(36).slice(2), dataUrl: url, url }))] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-4 shadow-sm" style={{ animation: "fadein .2s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <div className="flex items-center gap-2 text-rose-700 font-semibold text-xs uppercase tracking-wider">
        <AlertTriangle size={14} /> Defect Details & Photo Evidence
      </div>
      
      <div>
        <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Issue description</label>
        <textarea
          value={cell.remarks || ""}
          onChange={(e) => onUpdate({ remarks: e.target.value })}
          placeholder="Describe the defect found during inspection…"
          rows={2}
          className="w-full text-sm font-body rounded-xl border border-slate-200 p-3 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-xs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Priority</label>
          <div className="flex gap-1.5">
            {[
              { level: "Low", cls: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200", activeCls: "bg-slate-700 text-white border-slate-700 shadow-sm" },
              { level: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", activeCls: "bg-amber-500 text-white border-amber-500 shadow-sm" },
              { level: "High", cls: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100", activeCls: "bg-rose-600 text-white border-rose-600 shadow-sm" },
            ].map(({ level, cls, activeCls }) => (
              <button key={level} onClick={() => onUpdate({ priority: level })}
                className={`font-body text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${cell.priority === level ? activeCls : cls}`}>
                {level}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Assigned to</label>
          <input value={cell.assignedTo || ""} onChange={(e) => onUpdate({ assignedTo: e.target.value })} placeholder="Engineer / Worker"
            className="w-full text-xs font-body rounded-xl border border-slate-200 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>
        <div>
          <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Target completion</label>
          <input type="date" value={cell.targetDate || ""} onChange={(e) => onUpdate({ targetDate: e.target.value })}
            className="w-full text-xs font-body rounded-xl border border-slate-200 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>
      </div>

      <div>
        <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
          <span>Defect Photos</span>
          <span className="text-slate-400 font-normal">{(cell.photos || []).length}/4 captured</span>
        </label>
        <div className="flex flex-wrap gap-2.5">
          {(cell.photos || []).map((p) => (
            <div key={p.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
              <img src={p.dataUrl} className="w-full h-full object-cover" alt="Defect capture" />
              <button onClick={() => onUpdate({ photos: cell.photos.filter((x) => x.id !== p.id) })}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Trash2 size={16} className="text-white" />
              </button>
            </div>
          ))}
          {(cell.photos || []).length < 4 && (
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-rose-200 bg-white/80 hover:bg-rose-50 flex flex-col items-center justify-center text-rose-500 transition-colors gap-1 shadow-xs">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <><Camera size={18} /><span className="text-[10px] font-semibold">Add Photo</span></>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={(e) => e.target.files.length && handleFiles(e.target.files)} />
        </div>
      </div>

      <div>
        <label className="font-body text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"><Mic size={13} className="text-slate-500" /> Voice note link / description</label>
        <input value={cell.voiceNote || ""} onChange={(e) => onUpdate({ voiceNote: e.target.value })} placeholder="Paste link or note details..."
          className="w-full text-xs font-body rounded-xl border border-slate-200 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Pass photos (reuses same compressImage + storage pattern as FailDetails) */
/* ---------------------------------------------------------------------- */
function PassPhotos({ cell, onUpdate, inspectionId, itemId, areaKey }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files) {
    setBusy(true);
    try {
      const existing = cell.photos || [];
      const room = Math.max(0, 4 - existing.length);
      const arr = Array.from(files).slice(0, room);
      const compressed = await Promise.all(arr.map((f) => compressImage(f)));
      const uploadedUrls = await Promise.all(compressed.map((dataUrl) => uploadPhoto(inspectionId, 'pass', dataUrl, itemId, areaKey, data?.projectName, data?.unitNumber)));
      onUpdate({ photos: [...existing, ...uploadedUrls.map((url) => ({ id: Math.random().toString(36).slice(2), dataUrl: url, url }))] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2 shadow-sm" style={{ animation: "fadein .2s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs uppercase tracking-wider">
        <Camera size={14} /> Pass Photos (Optional)
      </div>
      <div className="flex flex-wrap gap-2.5">
        {(cell.photos || []).map((p) => (
          <div key={p.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
            <img src={p.dataUrl} className="w-full h-full object-cover" alt="Pass capture" />
            <button onClick={() => onUpdate({ photos: cell.photos.filter((x) => x.id !== p.id) })}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Trash2 size={16} className="text-white" />
            </button>
          </div>
        ))}
        {(cell.photos || []).length < 4 && (
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-emerald-200 bg-white/80 hover:bg-emerald-50 flex flex-col items-center justify-center text-emerald-500 transition-colors gap-1 shadow-xs">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <><Camera size={18} /><span className="text-[10px] font-semibold">Add Photo</span></>}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
          onChange={(e) => e.target.files.length && handleFiles(e.target.files)} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Item row                                                                */
/* ---------------------------------------------------------------------- */
function ItemRow({ item, areaKey, data, updateCell }) {
  const cell = getCell(data, item.id, areaKey);
  return (
    <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-200 hover:shadow-md transition-all duration-200 mb-3 group">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-mono text-xs flex items-center justify-center font-bold shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
            {String(item.id).padStart(2, "00")}
          </span>
          <span className="font-body font-semibold text-slate-800 text-sm sm:text-base">{item.label}</span>
        </div>
        <StatusSegmented value={cell.status} onChange={(s) => updateCell(item.id, areaKey, { status: s })} />
      </div>
      {cell.status === "fail" && <FailDetails cell={cell} inspectionId={data.inspectionId} itemId={item.id} areaKey={areaKey} onUpdate={(patch) => updateCell(item.id, areaKey, patch)} />}
      {cell.status === "pass" && <PassPhotos cell={cell} inspectionId={data.inspectionId} itemId={item.id} areaKey={areaKey} onUpdate={(patch) => updateCell(item.id, areaKey, patch)} />}
      {cell.status && cell.status !== "fail" && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <input value={cell.notes || ""} onChange={(e) => updateCell(item.id, areaKey, { notes: e.target.value })} placeholder="Add a note for this item (optional)…"
            className="w-full text-xs font-body text-slate-600 bg-slate-50/60 rounded-lg px-3 py-1.5 border border-slate-200/60 focus:bg-white focus:border-blue-300 focus:outline-none" />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Progress bar                                                            */
/* ---------------------------------------------------------------------- */
function ProgressBar({ stats }) {
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 no-print shadow-xs">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Gauge size={16} />
            </div>
            Inspection Completion
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">{stats.pct}%</span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
          <div className="h-full flex rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-[width] duration-500 ease-out shadow-xs" style={{ width: `${(stats.passed / stats.total) * 100}%` }} />
            <div className="h-full bg-rose-500 transition-[width] duration-500 ease-out shadow-xs" style={{ width: `${(stats.failed / stats.total) * 100}%` }} />
            <div className="h-full bg-slate-500 transition-[width] duration-500 ease-out shadow-xs" style={{ width: `${(stats.na / stats.total) * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-4 mt-2 font-body text-xs text-slate-600 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><b className="text-emerald-700">{stats.passed}</b> Passed</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><b className="text-rose-700">{stats.failed}</b> Failed</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /><b className="text-slate-700">{stats.na}</b> N/A</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /><b className="text-blue-700">{stats.total - stats.completed}</b> Remaining</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Matrix overview (read-only)                                             */
/* ---------------------------------------------------------------------- */
function MatrixOverview({ data, updateCell, onJump }) {
  const handleToggle = (itemId, areaKey, currentStatus) => {
    const nextMap = {
      null: "pass",
      pass: "fail",
      fail: "na",
      na: null,
    };
    const nextStatus = nextMap[currentStatus || null];
    updateCell(itemId, areaKey, { status: nextStatus });
  };

  const handleMarkAllPass = () => {
    ITEMS.forEach((item) => {
      AREAS.forEach((a) => {
        const c = getCell(data, item.id, a.key);
        if (!c.status) {
          updateCell(item.id, a.key, { status: "pass" });
        }
      });
    });
  };

  return (
    <div className="space-y-3">
      {/* Legend & Quick Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 no-print">
        <div className="flex items-center gap-4 text-xs font-body text-slate-600 flex-wrap">
          <span className="font-semibold text-slate-800">Checkbox Legend:</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold"><Check size={12} /></span> Pass (Tick)</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold"><X size={12} /></span> Fail</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-slate-600 text-white flex items-center justify-center text-[10px] font-bold"><MinusCircle size={12} /></span> N/A</span>
          <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" /> Pending</span>
        </div>

        {updateCell && (
          <button
            onClick={handleMarkAllPass}
            className="text-xs font-body font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <CheckCircle2 size={14} /> Quick Tick All Pending as Pass
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="min-w-full text-xs font-body border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 bg-slate-50 text-left p-3.5 font-display font-bold text-slate-800 min-w-[200px] z-10 border-r border-slate-200/80">Particulars</th>
              {AREAS.map((a) => (
                <th key={a.key} className="p-3.5 font-semibold text-slate-700 whitespace-nowrap text-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => onJump(a.key)}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{a.label}</span>
                    <span className="text-[10px] text-blue-600 font-normal hover:underline">View Room →</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="sticky left-0 bg-white p-3 font-semibold text-slate-800 z-10 border-r border-slate-200/80 shadow-xs">{item.label}</td>
                {AREAS.map((a) => {
                  const cell = getCell(data, item.id, a.key);
                  const status = cell.status;
                  return (
                    <td key={a.key} className="p-2 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => updateCell ? handleToggle(item.id, a.key, status) : onJump(a.key)}
                          title={`${item.label} (${a.label}): ${status || "Pending"}. Click to toggle state.`}
                          className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${
                            status === "pass"
                              ? "bg-emerald-500 border border-emerald-600 text-white shadow-xs shadow-emerald-500/30 scale-105"
                              : status === "fail"
                              ? "bg-rose-500 border border-rose-600 text-white shadow-xs shadow-rose-500/30 scale-105"
                              : status === "na"
                              ? "bg-slate-600 border border-slate-700 text-white shadow-xs scale-105"
                              : "border-2 border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/60 hover:scale-110 shadow-xs"
                          }`}
                        >
                          {status === "pass" && <Check size={14} className="stroke-[3]" />}
                          {status === "fail" && <X size={14} className="stroke-[3]" />}
                          {status === "na" && <MinusCircle size={13} />}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const INSPECTION_TYPES = [
  "INTERIOR JOINT INSPECTION",
  "INTERIOR JOINT INSPECTION RE-CHECK",
  "FINAL JOINT INSPECTION",
  "FINAL JOINT INSPECTION RE-CHECK",
];

/* ---------------------------------------------------------------------- */
/* Landing screen                                                          */
/* ---------------------------------------------------------------------- */
function LandingScreen({ onStart, onResume, onOpenPortal, projects, projectsError, backend, resuming }) {
  const [inspectionType, setInspectionType] = useState("");
  const [project, setProject] = useState("");
  const [unit, setUnit] = useState("");
  const [query, setQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [resumeId, setResumeId] = useState("");
  const [id, setId] = useState(() => genInspectionId());
  const [nowDate, setNowDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [nowTime, setNowTime] = useState(() => {
    const d = new Date();
    return d.toTimeString().slice(0, 5);
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  // Portal Gateway modal states
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalRole, setPortalRole] = useState("Admin");
  const [portalName, setPortalName] = useState("Administrator");
  const [portalPin, setPortalPin] = useState("");
  const [portalError, setPortalError] = useState("");
  const [verifyingPortalPin, setVerifyingPortalPin] = useState(false);

  useEffect(() => {
    const d = new Date();
    setNowDate(d.toISOString().slice(0, 10));
    setNowTime(d.toTimeString().slice(0, 5));
  }, []);

  const handleStartClick = () => {
    if (!inspectionType || !project || !unit) return;
    setPassword("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!password || password.trim().length !== 6) {
      setPasswordError("Please enter the 6-digit password.");
      return;
    }

    setVerifyingPin(true);
    setPasswordError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "Start Inspection", pin: password.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const verifiedPin = password.trim();
        setShowPasswordModal(false);
        setPassword("");
        setPasswordError("");
        await onStart(project, unit, inspectionType, id, verifiedPin);
      } else {
        setPasswordError(data.error || "Incorrect password. Please try again.");
      }
    } catch {
      setPasswordError("Authentication failed. Please check your connection.");
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleOpenPortalSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!portalPin || portalPin.trim().length !== 6) {
      setPortalError("Please enter the 6-digit password.");
      return;
    }

    setVerifyingPortalPin(true);
    setPortalError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: portalRole, pin: portalPin.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowPortalModal(false);
        setPortalPin("");
        setPortalError("");
        onOpenPortal({ role: portalRole, userName: portalName.trim() || portalRole });
      } else {
        setPortalError(data.error || `Incorrect 6-digit password for ${portalRole}.`);
      }
    } catch (err) {
      setPortalError(err.message || `Authentication failed for ${portalRole}.`);
    } finally {
      setVerifyingPortalPin(false);
    }
  };

  const filteredProjects = Object.keys(projects).filter((p) => p.toLowerCase().includes(query.toLowerCase()));
  const unitCount = Object.values(projects).reduce((n, us) => n + us.length, 0);

  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-stretch">
      <div className="w-full grid lg:grid-cols-[1.05fr_1fr]">
        {/* Blueprint brand panel */}
        <div className="relative hidden lg:flex blueprint-surface text-white flex-col justify-between p-10 xl:p-14 overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-14">
              <div className="h-12 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl border border-white/20 flex items-center justify-center shadow-sm">
                <img src="/dac-logo.png" alt="DAC Developers" className="h-full object-contain" />
              </div>
              <div>
                <p className="font-display font-bold text-base tracking-wide text-white">DAC Developers</p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-white/60 uppercase">Dream · Ascend · Conquer</p>
              </div>
            </div>

            <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--blue-300)] uppercase mb-4">Form JIC-01 · Key Handover</p>
            <h1 className="font-display font-bold text-4xl xl:text-[2.75rem] leading-[1.08] mb-5 max-w-md">
              Joint Inspection,<br />done on-site,<br />signed on the spot.
            </h1>
            <p className="font-body text-white/60 text-sm leading-relaxed max-w-sm">
              Walk the unit room by room, flag defects with a photo and a
              priority, and collect every signature before the keys change
              hands — the paper checklist, digitised.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3 max-w-md">
            {[
              { label: "Areas covered", value: AREAS.length, icon: LayoutGrid },
              { label: "Checklist items", value: ITEMS.length, icon: Ruler },
              { label: "Sign-offs", value: SIGNATORIES.length, icon: PenTool },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <s.icon size={14} className="text-[var(--blue-300)] mb-2" />
                <div className="font-display font-bold text-xl leading-none">{s.value}</div>
                <div className="font-body text-[11px] text-white/50 mt-1 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Watermark compass decoration — slow rotating */}
          <div
            className="absolute -bottom-8 -right-8 w-56 h-56 xl:w-64 xl:h-64 opacity-15 pointer-events-none"
            style={{ animation: "compassSpin 40s linear infinite", transformOrigin: "center" }}
          >
            <Compass className="w-full h-full text-white" strokeWidth={1} />
          </div>
          <style>{`
            @keyframes compassSpin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <div className="w-full max-w-md rise">
            <div className="text-center lg:text-left mb-6 lg:hidden">
              <div className="h-16 mx-auto mb-4 bg-white p-2.5 rounded-2xl border border-[var(--line)] flex items-center justify-center shadow-lg shadow-blue-900/10">
                <img src="/dac-logo.png" alt="DAC Developers" className="h-full object-contain" />
              </div>
              <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--blue-600)] uppercase mb-1">Dream · Ascend · Conquer</p>
              <h1 className="font-display font-bold text-2xl text-[var(--ink)]">DAC Developers</h1>
              <p className="font-body text-[var(--ink-soft)] text-sm mt-1">Joint Inspection & Key Handover</p>
            </div>
            <div className="hidden lg:block mb-6">
              <h2 className="font-display font-semibold text-xl text-[var(--ink)]">Start an inspection</h2>
              <p className="font-body text-[var(--ink-soft)] text-sm mt-1">
                {Object.keys(projects).length} projects · {unitCount} units on file
              </p>
            </div>

            {projectsError && (
              <div className="mb-4 flex items-start gap-2 text-xs font-body text-[var(--fail)] bg-[var(--fail-bg)] border border-red-200 rounded-xl p-3">
                <WifiOff size={14} className="mt-0.5 shrink-0" />
                <span>Couldn't reach the server ({projectsError}). Showing sample projects.</span>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-[var(--line)] shadow-[var(--shadow-md)] p-6 space-y-4 relative tick">
              {/* Field 1: Inspection Type (Required and Placed Before Project/Unit) */}
              <div>
                <label className="font-body text-xs font-bold text-slate-800 mb-1.5 block">
                  Inspection Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={inspectionType}
                  onChange={(e) => setInspectionType(e.target.value)}
                  className="w-full text-xs sm:text-sm font-body font-bold rounded-xl border border-slate-200 p-3 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-slate-800"
                >
                  <option value="">-- Choose Inspection Type --</option>
                  {INSPECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Project Selection */}
              <div>
                <label className="font-body text-xs font-bold text-slate-800 mb-1.5 block">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    value={project || query}
                    onChange={(e) => { setQuery(e.target.value); setProject(""); setUnit(""); setShowDrop(true); }}
                    onFocus={() => setShowDrop(true)}
                    placeholder="Search or choose project…"
                    className="w-full text-sm font-body rounded-xl border border-slate-200 p-2.5 pl-9 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                  {showDrop && !project && filteredProjects.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                      {filteredProjects.map((p) => (
                        <button key={p} onClick={() => { setProject(p); setQuery(p); setShowDrop(false); }} className="w-full text-left px-3.5 py-2.5 text-xs sm:text-sm font-body hover:bg-blue-50 transition-colors">{p}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Field 3: Unit Selection */}
              <div>
                <label className="font-body text-xs font-bold text-slate-800 mb-1.5 block">
                  Unit Number <span className="text-rose-500">*</span>
                </label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!project}
                  className="w-full text-sm font-body rounded-xl border border-slate-200 p-2.5 bg-slate-50/60 disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">{project ? "Select unit number" : "Choose a project first"}</option>
                  {(projects[project] || []).map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-body text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><CalendarDays size={12} /> Date</label>
                  <div suppressHydrationWarning className="font-mono text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 text-slate-600">{nowDate || "Loading…"}</div>
                </div>
                <div>
                  <label className="font-body text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Clock size={12} /> Time</label>
                  <div suppressHydrationWarning className="font-mono text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 text-slate-600">{nowTime || "Loading…"}</div>
                </div>
              </div>

              <div>
                <label className="font-body text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1"><Hash size={12} /> Generated Inspection ID</label>
                <div suppressHydrationWarning className="font-mono text-xs rounded-xl border border-blue-200 p-2.5 bg-blue-50/60 text-blue-700 font-bold">{id || "Generating…"}</div>
              </div>

              <button disabled={!inspectionType || !project || !unit} onClick={handleStartClick}
                className="w-full mt-2 bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-body font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 hover:shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-all">
                Start Inspection <ChevronRight size={16} />
              </button>

              <button
                onClick={() => {
                  setPortalPin("");
                  setPortalError("");
                  setShowPortalModal(true);
                }}
                className="w-full mt-2 text-sm font-body font-bold py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-2 shadow-sm transition-colors border border-slate-800"
              >
                <ShieldCheck size={16} className="text-blue-400" /> Open Approval & Admin Portal
              </button>

              <div className="pt-1">
                {!showResume ? (
                  <button onClick={() => setShowResume(true)} className="w-full text-xs font-body font-semibold py-2.5 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors">
                    <ClipboardCheck size={14} /> Resume an Existing Draft
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input value={resumeId} onChange={(e) => setResumeId(e.target.value)} placeholder="Enter Inspection ID"
                      className="flex-1 text-xs font-mono rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <button onClick={() => onResume(resumeId.trim())} disabled={!resumeId.trim() || resuming}
                      className="text-xs font-body font-bold px-4 rounded-xl bg-blue-600 text-white disabled:bg-slate-200 hover:bg-blue-700 flex items-center gap-1">
                      {resuming ? <Loader2 size={13} className="animate-spin" /> : "Load"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {backend && (
              <div className="mt-4 flex justify-center lg:justify-start">
                <div className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wide uppercase px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 bg-white/70">
                  {backend === "local" ? <HardDrive size={11} /> : <Cloud size={11} />}
                  {backend === "local" ? "Demo mode · saving locally" : "Connected · Google Sheets"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" onMouseDown={() => setShowPasswordModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Start Inspection</h3>
                <p className="font-body text-xs text-slate-500">Enter 6-digit password to begin</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1 block">6-Digit Password <span className="text-rose-500">*</span></label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                  placeholder="••••••"
                  autoFocus
                  autoComplete="new-password"
                  className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {passwordError && (
                  <p className="font-body text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} className="shrink-0" /> {passwordError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="font-body text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPin}
                  className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:bg-slate-300 flex items-center gap-1.5"
                >
                  {verifyingPin ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                  {verifyingPin ? "Verifying..." : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPortalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print" onMouseDown={() => setShowPortalModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in-95 duration-150" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPortalModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Portal Role Login</h3>
                <p className="font-body text-xs text-slate-500">Select role & enter 6-digit password</p>
              </div>
            </div>

            <form onSubmit={handleOpenPortalSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1 block">
                  Select Your Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={portalRole}
                  onChange={(e) => {
                    const r = e.target.value;
                    setPortalRole(r);
                    setPortalName(r === "Admin" ? "Administrator" : r);
                    setPortalError("");
                  }}
                  className="w-full text-xs font-body font-bold rounded-xl border border-slate-200 p-2.5 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="Admin">Admin (Full Oversight & Print)</option>
                  <option value="QA/QC In-Charge">QA/QC In-Charge</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Technical Executive">Technical Executive</option>
                  <option value="Manager Technical">Manager Technical</option>
                  <option value="GM – HUG">GM – HUG</option>
                  <option value="VP – HUG">VP – HUG</option>
                  <option value="Site Engineer">Site Engineer</option>
                  <option value="Customer">Customer</option>
                </select>
              </div>

              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1 block">
                  User / Signer Name
                </label>
                <input
                  value={portalName}
                  onChange={(e) => setPortalName(e.target.value)}
                  placeholder="Your name"
                  className="w-full text-xs font-body rounded-xl border border-slate-200 p-2.5 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1 block">
                  6-Digit Role Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={portalPin}
                  onChange={(e) => { setPortalPin(e.target.value); setPortalError(""); }}
                  placeholder="••••••"
                  autoFocus
                  autoComplete="new-password"
                  className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                {portalError && (
                  <p className="font-body text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} className="shrink-0" /> {portalError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPortalModal(false)}
                  className="font-body text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPortalPin}
                  className="font-body text-xs font-bold px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:bg-slate-300 flex items-center gap-1.5"
                >
                  {verifyingPortalPin ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                  {verifyingPortalPin ? "Verifying..." : "Unlock & Enter Portal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Dashboard cards                                                         */
/* ---------------------------------------------------------------------- */
function DashboardCards({ stats }) {
  const cards = [
    { label: "Passed Items", value: stats.passed, color: "#10b981", bg: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: CheckCircle2, ring: "ring-emerald-500/20" },
    { label: "Failed Defects", value: stats.failed, color: "#ef4444", bg: "bg-rose-50 text-rose-600 border-rose-100", icon: XCircle, ring: "ring-rose-500/20" },
    { label: "Pending Review", value: stats.total - stats.completed, color: "#64748b", bg: "bg-slate-50 text-slate-600 border-slate-100", icon: Clock, ring: "ring-slate-500/20" },
    { label: "Overall Progress", value: `${stats.pct}%`, color: "#2563eb", bg: "bg-blue-50 text-blue-600 border-blue-100", icon: ShieldCheck, ring: "ring-blue-500/20" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="relative rounded-2xl border border-slate-200/80 bg-white p-4 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg shadow-sm group"
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${c.bg} ${c.ring} ring-2 group-hover:scale-110 transition-transform`}>
                <Icon size={20} />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl tracking-tight" style={{ color: c.color }}>{c.value}</div>
            <div className="font-body text-xs font-semibold text-slate-500 mt-1">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main inspection form                                                    */
/* ---------------------------------------------------------------------- */
function InspectionForm({ data, setData, onBack, onSubmitted, push, siteEngineerPasscode = "" }) {
  const [activeArea, setActiveArea] = useState(AREAS[0].key);
  const [view, setView] = useState("byArea");
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [showPrintModal, setShowPrintModal] = useState(false);
  const saveTimer = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const updateField = (patch) => setData((d) => (d ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));

  const updateCell = (itemId, areaKey, patch) => {
    setData((d) => {
      if (!d) return d;
      const safeCells = d.cells || {};
      const key = cellKey(itemId, areaKey);
      const prev = safeCells[key] || { status: null };
      const next = { ...prev, ...patch };
      if (patch.status && patch.status !== "fail") {
        // Clear fail-specific fields but preserve photos (pass also uses photos)
        delete next.remarks; delete next.priority; delete next.assignedTo; delete next.targetDate; delete next.voiceNote;
      }
      if (patch.status && patch.status !== "pass" && patch.status !== "fail") {
        // For N/A and null, also clear photos
        delete next.photos;
      }
      return { ...d, cells: { ...safeCells, [key]: next }, updatedAt: new Date().toISOString() };
    });
  };

  const stats = useMemo(() => {
    let passed = 0, failed = 0, na = 0;
    ITEMS.forEach((item) => AREAS.forEach((a) => {
      const c = getCell(data, item.id, a.key);
      if (c.status === "pass") passed++;
      else if (c.status === "fail") failed++;
      else if (c.status === "na") na++;
    }));
    const total = ITEMS.length * AREAS.length;
    const completed = passed + failed + na;
    return { passed, failed, na, total, completed, pct: Math.round((completed / total) * 100) };
  }, [data]);

  const [activePasscode, setActivePasscode] = useState(siteEngineerPasscode || "");
  const [showSubmitPinModal, setShowSubmitPinModal] = useState(false);
  const [submitPin, setSubmitPin] = useState("");
  const [submitPinError, setSubmitPinError] = useState("");
  const [submittingWithPin, setSubmittingWithPin] = useState(false);

  useEffect(() => {
    if (siteEngineerPasscode) {
      setActivePasscode(siteEngineerPasscode);
    }
  }, [siteEngineerPasscode]);

  // Autosave: debounce writes to the /api/draft route (backed by the Google Sheet).
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const pin = activePasscode || siteEngineerPasscode;
    if (!pin || !dataRef.current || !dataRef.current.inspectionId) return;

    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const payload = { ...dataRef.current, passcode: pin };
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Save failed");
        }
        setSaveState("saved");
      } catch (e) {
        console.warn("[autosave] Background draft save warning:", e.message);
        setSaveState("error");
      }
    }, 1000);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activePasscode]);

  const visibleItems = ITEMS.filter((item) => {
    if (query && !item.label.toLowerCase().includes(query.toLowerCase())) return false;
    if (filterStatus !== "all") {
      const c = getCell(data, item.id, activeArea);
      if (filterStatus === "pending") return !c.status;
      return c.status === filterStatus;
    }
    return true;
  });

  const canSubmit = !!(data.customerVerificationPhoto);

  async function handleManualSave(customPin) {
    const pin = customPin || activePasscode || siteEngineerPasscode;
    if (!pin) {
      setShowSubmitPinModal(true);
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, passcode: pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      setSaveState("saved");
      push("Draft saved to Google Sheets.", "success");
    } catch (e) {
      setSaveState("error");
      push(e.message || "Couldn't save draft.", "error");
    }
  }

  async function handleSubmit(customPin) {
    const pin = customPin || activePasscode || siteEngineerPasscode;
    if (!pin || pin.length !== 6) {
      setSubmitPinError("");
      setShowSubmitPinModal(true);
      return;
    }

    setSubmittingWithPin(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, passcode: pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setShowSubmitPinModal(true);
          setSubmitPinError(body.error || "Invalid 6-digit password. Please re-enter.");
          return;
        }
        throw new Error(body.error || "Submit failed");
      }
      setActivePasscode(pin);
      setShowSubmitPinModal(false);
      setSubmitPin("");
      updateField({ status: "submitted" });
      push("Inspection submitted successfully.", "success");
      onSubmitted();
    } catch (e) {
      push(e.message || "Couldn't submit inspection.", "error");
    } finally {
      setSubmittingWithPin(false);
    }
  }

  function exportJSON() {
    const payload = {
      project: data.projectName,
      unit: data.unitNumber,
      customerName: data.customerName,
      inspectionId: data.inspectionId,
      date: data.inspectionDate,
      inspection: ITEMS.flatMap((item) =>
        AREAS.map((a) => {
          const c = getCell(data, item.id, a.key);
          return {
            item: item.label, area: a.label, status: c.status,
            remarks: c.remarks || "", priority: c.priority || "",
            images: (c.photos || []).map((p) => p.dataUrl),
          };
        })
      ),
      generalRemarks: data.generalRemarks,
      declarationChecked: data.declarationChecked,
      signatures: data.signatures,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.inspectionId}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Standalone Printable Document rendered for @media print */}
      <div className="print-only">
        <JointInspectionPrintDoc data={data} />
      </div>

      <div className="no-print min-h-screen bg-slate-50/70 pb-28">
        <ProgressBar stats={stats} />

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
          {/* Top Header & Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap no-print bg-white/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <button onClick={onBack} className="font-body text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-blue-600 bg-slate-100/80 hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-slate-200/60 transition-colors">
              <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <div className="flex items-center gap-2.5">
              <button onClick={handleManualSave} className="text-xs font-body font-semibold px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 shadow-xs transition-all">
                {saveState === "saving" ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <Save size={14} className="text-slate-500" />}
                <span>{saveState === "saving" ? "Saving..." : "Save Draft"}</span>
              </button>
              <button onClick={exportJSON} className="text-xs font-body font-semibold px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 shadow-xs transition-all">
                <FileJson size={14} className="text-blue-600" /> Export JSON
              </button>
              <button onClick={() => setShowPrintModal(true)} className="text-xs font-body font-semibold px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 shadow-xs transition-all">
                <FileDown size={14} className="text-indigo-600" /> Print / PDF
              </button>
            </div>
          </div>

        {/* Customer Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 relative tick shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Inspection & Customer Details</h2>
                <p className="font-body text-xs text-slate-500">Record unit owner information and date</p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl shadow-xs">
              {data.inspectionId}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Customer Name</label>
              <input
                value={data.customerName}
                onChange={(e) => updateField({ customerName: e.target.value })}
                placeholder="Full name of owner"
                className="w-full text-sm font-body font-medium rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50/40 focus:bg-white shadow-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Project</label>
                <div className="text-sm font-body font-semibold rounded-xl border border-slate-200/80 p-3 bg-slate-100/70 text-slate-800 truncate">
                  {data.projectName}
                </div>
              </div>
              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Unit No.</label>
                <div className="text-sm font-body font-bold rounded-xl border border-slate-200/80 p-3 bg-slate-100/70 text-blue-700">
                  {data.unitNumber}
                </div>
              </div>
              <div>
                <label className="font-body text-xs font-semibold text-slate-700 mb-1.5 block">Inspection Type</label>
                <div className="text-sm font-mono font-bold rounded-xl border border-slate-200/80 p-3 bg-slate-100/70 text-slate-800 truncate">
                  {data.inspectionType || "IJI"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {saveState === "saving" && <span className="flex items-center gap-1.5 text-blue-600 font-semibold"><Loader2 size={13} className="animate-spin" /> Saving changes to local draft…</span>}
              {saveState === "saved" && <span className="flex items-center gap-1.5 text-emerald-600 font-semibold"><CheckCircle2 size={13} /> Saved automatically · {new Date(data.updatedAt).toLocaleTimeString()}</span>}
              {saveState === "error" && <span className="flex items-center gap-1.5 text-rose-600 font-semibold"><AlertTriangle size={13} /> Auto-save issue detected</span>}
              {saveState === "idle" && <span className="flex items-center gap-1.5 text-slate-500"><Save size={13} /> Autosave enabled</span>}
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Date: {data.inspectionDate} | Time: {data.inspectionTime}
            </div>
          </div>
        </div>

        {/* Dashboard Cards */}
        <DashboardCards stats={stats} />

        {/* Inspection Matrix Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 relative tick shadow-sm">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Inspection Checklist Matrix</h2>
                <p className="font-body text-xs text-slate-500">Evaluate each room and mark particulars</p>
              </div>
            </div>

            <div className="flex gap-1 bg-slate-100/80 rounded-xl p-1 no-print border border-slate-200/60">
              <button
                onClick={() => setView("byArea")}
                className={`text-xs font-body font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  view === "byArea" ? "bg-white shadow-xs text-blue-700 font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ListChecks size={14} /> By Area
              </button>
              <button
                onClick={() => setView("matrix")}
                className={`text-xs font-body font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  view === "matrix" ? "bg-white shadow-xs text-blue-700 font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={14} /> Full Grid
              </button>
            </div>
          </div>

          {view === "matrix" ? (
            <MatrixOverview data={data} updateCell={updateCell} onJump={(key) => { setActiveArea(key); setView("byArea"); }} />
          ) : (
            <>
              {/* Room / Area Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-print scrollbar-thin">
                {AREAS.map((a) => {
                  const active = activeArea === a.key;
                  // Count completed for this area
                  let count = 0;
                  ITEMS.forEach((item) => {
                    if (getCell(data, item.id, a.key).status) count++;
                  });

                  return (
                    <button
                      key={a.key}
                      onClick={() => setActiveArea(a.key)}
                      className={`shrink-0 text-xs font-body font-semibold px-4 py-2 rounded-xl border flex items-center gap-2 transition-all duration-200 ${
                        active
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 scale-[1.02]"
                          : "border-slate-200/80 bg-slate-50/70 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <span>{a.label}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          active
                            ? "bg-white/20 text-white"
                            : count === ITEMS.length
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200/70 text-slate-600"
                        }`}
                      >
                        {count}/{ITEMS.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Filter Controls */}
              <div className="flex gap-3 mb-5 no-print flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search checklist items…"
                    className="w-full text-xs sm:text-sm font-body rounded-xl border border-slate-200 pl-9 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-xs bg-slate-50/50 focus:bg-white"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100/90 rounded-xl p-1 border border-slate-200/60">
                  {["all", "pass", "fail", "na", "pending"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      className={`text-xs font-body font-semibold px-3 py-1.5 rounded-lg capitalize transition-all ${
                        filterStatus === f ? "bg-white shadow-xs text-blue-700 font-bold" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {visibleItems.length === 0 && (
                  <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                    <p className="font-body text-sm font-medium text-slate-500">No checklist items match your current filter.</p>
                  </div>
                )}
                {visibleItems.map((item) => (
                  <ItemRow key={item.id} item={item} areaKey={activeArea} data={data} updateCell={updateCell} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* General Remarks */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 relative tick shadow-sm">
          <h2 className="font-display font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
            <PenTool size={18} className="text-blue-600" /> General Remarks & Notes
          </h2>
          <textarea
            value={data.generalRemarks}
            onChange={(e) => updateField({ generalRemarks: e.target.value })}
            rows={4}
            placeholder="Write any overarching comments, special requests, or site conditions…"
            className="w-full text-sm font-body rounded-2xl border border-slate-200 p-4 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50/40 focus:bg-white shadow-xs"
          />
        </div>

        {/* Declaration Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 relative tick shadow-sm">
          <h2 className="font-display font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" /> Customer Declaration
          </h2>
          <div className="font-body text-sm text-slate-600 leading-relaxed space-y-3 bg-slate-50/80 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
            <p>I/We hereby confirm joint inspection carried out on this date for the specified flat/villa and state that I/We are fully satisfied with the condition. Key handover is subject to Finance NOC clearance from the CRM team.</p>
            <div className="pt-2 border-t border-slate-200/60">
              <p className="font-bold text-slate-800 mb-1">Terms & Conditions:</p>
              <p className="mb-1">
                1. Interior works must be completed within{" "}
                <input
                  value={data.interiorDays}
                  onChange={(e) => updateField({ interiorDays: e.target.value })}
                  placeholder="30"
                  className="inline-block w-14 text-center font-mono font-bold text-sm border-b-2 border-blue-600 bg-white rounded-md px-1 py-0.5 text-blue-700 focus:outline-none"
                />{" "}
                days. Interior works allowed only between 9:00 AM and 5:00 PM.
              </p>
              <p>2. Overnight stays are strictly prohibited during the interior work period.</p>
            </div>
          </div>

          <label className="flex items-center gap-3 mt-4 cursor-pointer p-3 rounded-xl bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors">
            <input
              type="checkbox"
              checked={data.declarationChecked}
              onChange={(e) => updateField({ declarationChecked: e.target.checked })}
              className="w-5 h-5 accent-blue-600 rounded-md cursor-pointer"
            />
            <span className="font-body text-sm text-slate-900 font-semibold">I/We confirm and accept the above declaration terms.</span>
          </label>
        </div>

        {/* Customer Verification Photo Card */}
        <CustomerVerificationPhoto data={data} updateField={updateField} push={push} />

        {/* Signatures Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 relative tick print-break shadow-sm">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                <PenTool size={20} className="text-blue-600" /> Digital Sign-offs
              </h2>
              <p className="font-body text-xs text-slate-500">Collect required customer and site engineer signatures</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SIGNATORIES.map((s) => (
              <SignatureBox
                key={s.key}
                signatory={s}
                value={data.signatures[s.key]}
                hasVerificationPhoto={!!data.customerVerificationPhoto}
                push={push}
                onSign={(key, dataUrl) => updateField({ signatures: { ...data.signatures, [key]: dataUrl } })}
              />
            ))}
          </div>
        </div>

        {/* Floating/Fixed Bottom Submission Bar */}
        <div className="no-print sticky bottom-4 z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-4 shadow-xl flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display font-bold text-sm text-slate-900">Ready to Submit</div>
            <div className="font-body text-xs text-slate-500">
              {!canSubmit
                ? "Customer verification photo is required before completing the inspection."
                : "All requirements met — ready to submit."}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleManualSave}
              className="text-xs font-body font-semibold px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="text-sm font-body font-bold px-6 py-2.5 rounded-xl bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:shadow-none flex items-center gap-2 transition-all scale-[1.01] active:scale-[0.99]"
            >
              <ShieldCheck size={18} /> Submit Inspection
            </button>
          </div>
        </div>
      </div>

      {/* Print / PDF Preview Modal */}
      {showPrintModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[var(--ink)]/60 backdrop-blur-sm no-print overflow-y-auto"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPrintModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <FileDown size={18} className="text-blue-600" />
                <span className="font-display font-bold text-sm text-slate-800">
                  Official Joint Inspection Checklist (Print / PDF Preview)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <FileDown size={14} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
              <div className="bg-white shadow-md border border-slate-200 mx-auto rounded p-2">
                <JointInspectionPrintDoc data={data} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit PIN Confirmation Modal */}
      {showSubmitPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative" style={{ animation: "popin .18s ease" }}>
            <button
              onClick={() => setShowSubmitPinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X size={20} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
              <Lock size={22} />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 mb-1">Site Engineer Verification</h3>
            <p className="font-body text-xs text-slate-500 mb-4">
              Enter the 6-digit Site Engineer password to submit this inspection.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(submitPin.trim());
              }}
              className="space-y-4"
            >
              <div>
                <label className="font-body text-xs font-bold text-slate-700 mb-1.5 block">
                  6-Digit Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={submitPin}
                  onChange={(e) => { setSubmitPin(e.target.value); setSubmitPinError(""); }}
                  placeholder="••••••"
                  className="w-full text-center tracking-[0.5em] text-lg font-mono rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {submitPinError && (
                  <p className="font-body text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={13} className="shrink-0" /> {submitPinError}
                  </p>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSubmitPinModal(false)}
                  className="flex-1 font-body text-xs font-bold py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWithPin || submitPin.trim().length !== 6}
                  className="flex-1 font-body text-xs font-bold py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {submittingWithPin ? <Loader2 size={14} className="animate-spin" /> : "Verify & Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Submitted screen                                                        */
/* ---------------------------------------------------------------------- */
function SubmittedScreen({ data, onNew }) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  return (
    <>
      <div className="print-only">
        <JointInspectionPrintDoc data={data} />
      </div>

      <div className="no-print min-h-screen bg-[var(--paper)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm bg-white rounded-2xl border border-[var(--line)] shadow-[var(--shadow-lg)] p-8 relative tick rise">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[var(--pass-bg)] flex items-center justify-center ring-4 ring-[var(--pass-bg)]/50" style={{ animation: "popin .3s cubic-bezier(.2,.9,.3,1.2)" }}>
            <CheckCircle2 size={32} className="text-[var(--pass)]" />
          </div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--blue-600)] uppercase mb-2">Form JIC-01 · Complete</p>
          <h1 className="font-display font-bold text-xl text-[var(--ink)] mb-1">Inspection Submitted</h1>
          <p className="font-body text-sm text-[var(--ink-soft)] mb-1">{data.projectName} · Unit {data.unitNumber}</p>
          <p className="font-mono text-xs text-[var(--blue-700)] bg-[var(--blue-50)] inline-block px-2 py-1 rounded-md mb-5">{data.inspectionId}</p>

          <div className="space-y-2 mb-4">
            <button
              onClick={() => setShowPrintModal(true)}
              className="w-full font-body text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs flex items-center justify-center gap-2 transition-all"
            >
              <FileDown size={15} className="text-blue-600" /> Print Official Form / PDF
            </button>
          </div>

          <button onClick={onNew} className="w-full font-body text-sm font-semibold px-5 py-2.5 rounded-xl bg-[var(--blue-600)] text-white hover:bg-[var(--blue-700)] shadow-sm transition-all hover:shadow-[var(--shadow-md)]">Start New Inspection</button>
        </div>
      </div>

      {showPrintModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[var(--ink)]/60 backdrop-blur-sm no-print overflow-y-auto"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPrintModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <FileDown size={18} className="text-blue-600" />
                <span className="font-display font-bold text-sm text-slate-800">
                  Official Joint Inspection Checklist (Print / PDF Preview)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="font-body text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <FileDown size={14} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
              <div className="bg-white shadow-md border border-slate-200 mx-auto rounded p-2">
                <JointInspectionPrintDoc data={data} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Root app                                                                 */
/* ---------------------------------------------------------------------- */
export default function InspectionApp() {
  const [screen, setScreen] = useState("landing");
  const [data, setData] = useState(null);
  const [siteEngineerPasscode, setSiteEngineerPasscode] = useState("");
  const [projects, setProjects] = useState(DEFAULT_PROJECT_UNITS);
  const [projectsError, setProjectsError] = useState(null);
  const [backend, setBackend] = useState(null);
  const [resuming, setResuming] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(null);
  const { toasts, push } = useToasts();

  // Re-inspection state — holds pending start params & the found previous inspection
  const [pendingStart, setPendingStart] = useState(null); // { project, unit, type, id, verifiedPin }
  const [previousInspection, setPreviousInspection] = useState(null);
  const [showReInspectModal, setShowReInspectModal] = useState(false);
  const [checkingPrevious, setCheckingPrevious] = useState(false);

  useEffect(() => {
    // Purge any legacy PINs stored in sessionStorage so they never show in DevTools Application tab
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("dac_site_pin");
        sessionStorage.removeItem("dac_pin");
      }
    } catch {}

    (async () => {
      try {
        const res = await fetch("/api/projects");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load projects");
        if (body.projects && Object.keys(body.projects).length > 0) {
          setProjects(body.projects);
        }
        setBackend(body.backend || null);
      } catch (e) {
        setProjectsError(e.message);
      }
    })();
  }, []);

  async function handleStart(project, unit, type, id, verifiedPin = "") {
    if (verifiedPin) {
      setSiteEngineerPasscode(verifiedPin);
    }

    setLoadingInfo({
      project,
      unit,
      type,
      title: "Initializing Joint Inspection",
      subtitle: "Checking unit history & preparing room checklist matrix...",
    });

    // Check if there's a previous inspection for this project+unit
    setCheckingPrevious(true);
    try {
      const res = await fetch(`/api/approval?role=all_for_unit&project=${encodeURIComponent(project)}&unit=${encodeURIComponent(unit)}`);
      const body = await res.json();
      // Find the most recent inspection for this unit
      const allInspections = body.inspections || [];
      const forUnit = allInspections
        .filter((i) => i.projectName === project && i.unitNumber === unit)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

      if (forUnit.length > 0) {
        // Found a previous inspection — ask user if they want to carry forward the checklist
        setPreviousInspection(forUnit[0]);
        setPendingStart({ project, unit, type, id, verifiedPin });
        setShowReInspectModal(true);
        setLoadingInfo(null);
        return;
      }
    } catch (e) {
      // If lookup fails, just start fresh
      console.warn("Previous inspection lookup failed:", e.message);
    } finally {
      setCheckingPrevious(false);
    }
    // No previous inspection found — start blank
    _doStart(project, unit, type, id, null, verifiedPin);
    setLoadingInfo(null);
  }

  function _doStart(project, unit, type, id, previousCells, verifiedPin = "") {
    const pin = verifiedPin || siteEngineerPasscode;
    if (pin) {
      setSiteEngineerPasscode(pin);
    }
    const fresh = freshInspection(project, unit, type);
    fresh.inspectionId = id;
    // If carrying forward checklist data, copy cells but strip signatures/approval state
    if (previousCells) {
      fresh.cells = { ...previousCells };
      fresh.previousInspectionRef = previousInspection?.inspectionId || null;
    }
    setData(fresh);
    setScreen("form");
    setShowReInspectModal(false);
    setPreviousInspection(null);
    setPendingStart(null);
  }

  async function handleResume(inspectionId) {
    setLoadingInfo({
      project: "",
      unit: "",
      type: "Resume Draft",
      title: "Loading Saved Inspection Draft",
      subtitle: "Fetching inspection records & photos from cloud database...",
    });
    setResuming(true);
    try {
      const url = `/api/draft?inspectionId=${encodeURIComponent(inspectionId)}&passcode=${encodeURIComponent(siteEngineerPasscode)}`;
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Draft not found");
      setData(body.data);
      setScreen(body.data.status === "submitted" ? "submitted" : "form");
      push("Draft loaded.", "success");
    } catch (e) {
      push(e.message || "Couldn't find that draft.", "error");
    } finally {
      setResuming(false);
      setLoadingInfo(null);
    }
  }

  const [portalSession, setPortalSession] = useState({ role: "Admin", userName: "Administrator" });

  return (
    <div className="font-body">
      {screen === "landing" && (
        <LandingScreen
          onStart={handleStart}
          onResume={handleResume}
          onOpenPortal={(session) => {
            if (session) setPortalSession(session);
            setScreen("portal");
          }}
          projects={projects}
          projectsError={projectsError}
          backend={backend}
          resuming={resuming || checkingPrevious}
        />
      )}
      {screen === "portal" && (
        <ApprovalPortal
          initialRole={portalSession.role}
          initialUserName={portalSession.userName}
          initialAuthenticated={true}
          onExit={() => setScreen("landing")}
        />
      )}
      {screen === "form" && data && (
        <InspectionForm data={data} setData={setData} onBack={() => setScreen("landing")} onSubmitted={() => setScreen("submitted")} push={push} siteEngineerPasscode={siteEngineerPasscode} />
      )}
      {screen === "submitted" && data && (
        <SubmittedScreen data={data} onNew={() => { setData(null); setScreen("landing"); }} />
      )}
      {(loadingInfo || checkingPrevious || resuming) && (
        <InspectionLoadingOverlay
          project={loadingInfo?.project || ""}
          unit={loadingInfo?.unit || ""}
          inspectionType={loadingInfo?.type || ""}
          title={loadingInfo?.title || "Initializing Inspection"}
          subtitle={loadingInfo?.subtitle || "Connecting cloud database & loading checklist matrix..."}
        />
      )}
      <ToastStack toasts={toasts} />

      {/* Re-Inspection Choice Modal */}
      {showReInspectModal && previousInspection && pendingStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 relative" style={{ animation: "popin .18s ease" }}>
            <button
              onClick={() => { setShowReInspectModal(false); setPreviousInspection(null); setPendingStart(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                <ClipboardCheck size={22} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Previous Inspection Found</h3>
                <p className="font-body text-xs text-slate-500">
                  Unit <b>{pendingStart.unit}</b> — {pendingStart.project}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 mb-5 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">
                  {previousInspection.inspectionId}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {previousInspection.inspectionType || "IJI"} · {previousInspection.workflowStatus || previousInspection.status}
                </span>
              </div>
              <p className="font-body text-xs text-slate-600">
                Last updated: <b>{new Date(previousInspection.updatedAt || Date.now()).toLocaleString()}</b>
              </p>
              {/* Quick checklist summary */}
              {(() => {
                const cells = previousInspection.cells || {};
                const statuses = Object.values(cells).filter(c => c.status);
                const passed = statuses.filter(c => c.status === "pass").length;
                const failed = statuses.filter(c => c.status === "fail").length;
                const na = statuses.filter(c => c.status === "na").length;
                return statuses.length > 0 ? (
                  <div className="flex gap-3 mt-1 font-body text-xs">
                    <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><b>{passed}</b> Pass</span>
                    <span className="flex items-center gap-1 text-rose-700"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><b>{failed}</b> Fail</span>
                    <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /><b>{na}</b> N/A</span>
                    <span className="text-slate-400">({statuses.length} items recorded)</span>
                  </div>
                ) : <p className="text-slate-400 italic text-[11px]">No checklist items recorded in previous inspection.</p>;
              })()}
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-body mb-5 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
              <span>
                <b>This will start a NEW inspection</b> with a new Inspection ID (<b>{pendingStart.id}</b>).
                The previous record is preserved and will NOT be overwritten.
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => _doStart(pendingStart.project, pendingStart.unit, pendingStart.type, pendingStart.id, null, pendingStart.verifiedPin)}
                className="flex-1 font-body text-sm font-bold py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              >
                Start Blank
              </button>
              <button
                onClick={() => _doStart(pendingStart.project, pendingStart.unit, pendingStart.type, pendingStart.id, previousInspection.cells, pendingStart.verifiedPin)}
                className="flex-1 font-body text-sm font-bold py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
              >
                <ClipboardCheck size={16} /> Load Previous Checklist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
