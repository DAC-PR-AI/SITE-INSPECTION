"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileText, ClipboardCheck, AlertTriangle, Camera, FileCheck2, PenTool,
  Eye, ShieldCheck, ArrowLeft, Save, ChevronRight, CheckCircle2, XCircle,
  MinusCircle, Check, Loader2, Trash2, CalendarDays, Clock, User,
  Building2, Hash, ArrowRight, Mic, Lock, FileDown, FileJson, AlertCircle,
  Layers, CheckSquare
} from "lucide-react";
import DefectsAndPhotosManager from "./DefectsAndPhotosManager";
import DigitalSignatureSystem from "./DigitalSignatureSystem";
import JointInspectionPrintDoc from "./JointInspectionPrintDoc";
import {
  AREAS, ITEMS, SIGNATORIES, getCell, cellKey, compressImage, uploadPhoto
} from "./InspectionApp";

export default function InspectionWorkspace({
  data,
  setData,
  onBack,
  onSubmitted,
  push,
  siteEngineerPasscode = "",
}) {
  const [activeSection, setActiveSection] = useState("checklist"); // details | checklist | defects | photos | declaration | signatures | review | approval
  const [activeArea, setActiveArea] = useState(AREAS[0].key);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activePasscode, setActivePasscode] = useState(siteEngineerPasscode || "");
  const [showSubmitPinModal, setShowSubmitPinModal] = useState(false);
  const [submitPin, setSubmitPin] = useState("");
  const [submitPinError, setSubmitPinError] = useState("");
  const [submittingWithPin, setSubmittingWithPin] = useState(false);

  const saveTimer = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const updateField = (patch) =>
    setData((d) => (d ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));

  const updateCell = (itemId, areaKey, patch) => {
    setData((d) => {
      if (!d) return d;
      const safeCells = d.cells || {};
      const key = cellKey(itemId, areaKey);
      const prev = safeCells[key] || { status: null };
      const next = { ...prev, ...patch };
      if (patch.status && patch.status !== "fail") {
        delete next.remarks;
        delete next.priority;
        delete next.assignedTo;
        delete next.targetDate;
        delete next.voiceNote;
      }
      if (patch.status && patch.status !== "pass" && patch.status !== "fail") {
        delete next.photos;
      }
      return {
        ...d,
        cells: { ...safeCells, [key]: next },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const stats = useMemo(() => {
    let passed = 0, failed = 0, na = 0;
    ITEMS.forEach((item) =>
      AREAS.forEach((a) => {
        const c = getCell(data, item.id, a.key);
        if (c.status === "pass") passed++;
        else if (c.status === "fail") failed++;
        else if (c.status === "na") na++;
      })
    );
    const total = ITEMS.length * AREAS.length;
    const completed = passed + failed + na;
    return {
      passed,
      failed,
      na,
      total,
      completed,
      pct: Math.round((completed / total) * 100),
    };
  }, [data]);

  // Existing Autosave behavior
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
  }, [data, activePasscode]);

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
      push("Draft saved.", "success");
    } catch (e) {
      setSaveState("error");
      push(e.message || "Couldn't save draft.", "error");
    }
  }

  async function handleSubmit(customPin) {
    if (submittingWithPin) return; // Prevent duplicate clicks
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
          setSubmitPinError(body.error || "Invalid 6-digit password.");
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

  // Left Navigation Sections List
  const navSections = [
    { id: "details", label: "1. Inspection Details", icon: FileText },
    { id: "checklist", label: "2. Checklist", icon: ClipboardCheck, badge: `${stats.completed}/${stats.total}` },
    { id: "defects", label: "3. Defects", icon: AlertTriangle, badge: stats.failed > 0 ? stats.failed : null, color: "text-rose-500" },
    { id: "photos", label: "4. Photos", icon: Camera },
    { id: "declaration", label: "5. Customer Declaration", icon: FileCheck2 },
    { id: "signatures", label: "6. Signatures", icon: PenTool },
    { id: "review", label: "7. Review", icon: Eye },
    { id: "approval", label: "8. Approval", icon: ShieldCheck },
  ];

  const sectionOrder = ["details", "checklist", "defects", "photos", "declaration", "signatures", "review", "approval"];

  const handleNextSection = () => {
    const idx = sectionOrder.indexOf(activeSection);
    if (idx >= 0 && idx < sectionOrder.length - 1) {
      setActiveSection(sectionOrder[idx + 1]);
    }
  };

  // Collect all defect/failed items for Section 3
  const defectItemsList = useMemo(() => {
    const list = [];
    ITEMS.forEach((item) => {
      AREAS.forEach((a) => {
        const c = getCell(data, item.id, a.key);
        if (c.status === "fail") {
          list.push({ item, area: a, cell: c });
        }
      });
    });
    return list;
  }, [data]);

  // Collect all photos for Section 4
  const allPhotosGallery = useMemo(() => {
    const photos = [];
    if (data?.customerVerificationPhoto) {
      photos.push({
        id: "cust-verif",
        title: "Customer Verification Photo",
        type: "Verification",
        url: data.customerVerificationPhoto,
      });
    }
    ITEMS.forEach((item) => {
      AREAS.forEach((a) => {
        const c = getCell(data, item.id, a.key);
        (c.photos || []).forEach((p, pIdx) => {
          photos.push({
            id: `${item.id}-${a.key}-${pIdx}`,
            title: `${item.label} (${a.label})`,
            type: c.status === "fail" ? "Defect" : "Pass",
            url: p.dataUrl || p.url,
          });
        });
      });
    });
    return photos;
  }, [data]);

  return (
    <>
      <div className="print-only">
        <JointInspectionPrintDoc data={data} />
      </div>

      <div className="no-print min-h-screen bg-[var(--paper)] font-body text-slate-900 flex flex-col">

        {/* ─── TOP BAR HEADER ──────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 glass-header px-4 sm:px-6 py-3 border-b border-slate-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display font-extrabold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
                <span>{data.projectName}</span>
                <span className="text-amber-600 font-mono">Unit {data.unitNumber}</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">
                ID: {data.inspectionId} • {data.inspectionType}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleManualSave()}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {saveState === "saving" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Save className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="hidden sm:inline">
                {saveState === "saving" ? "Saving..." : "Save Draft"}
              </span>
            </button>

            <button
              onClick={() => window.print()}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>
        </header>

        {/* ─── WORKSPACE LAYOUT (3 COLUMNS) ─────────────────────────────────── */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24">

          {/* ─── LEFT SIDEBAR (3 Columns): NAVIGATION ────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs sticky top-20">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-3 pt-2 mb-2">
                Inspection Workflow
              </p>
              <nav className="space-y-1">
                {navSections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;

                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveSection(sec.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{sec.label}</span>
                      </div>
                      {sec.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {sec.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* ─── MAIN AREA (6 Columns): ACTIVE SECTION CONTENT ───────────────── */}
          <div className="lg:col-span-6 space-y-6">

            {/* HEADER SUMMARY CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {data.inspectionType}
                </span>
                <span className="text-xs font-mono text-slate-400">{data.inspectionDate}</span>
              </div>
              <h2 className="font-display font-extrabold text-xl text-slate-900 mb-1">
                {data.projectName} • Unit {data.unitNumber}
              </h2>
              <p className="text-xs text-slate-500 font-body">
                Customer: <b className="text-slate-800">{data.customerName || "N/A"}</b> • ID: <span className="font-mono">{data.inspectionId}</span>
              </p>

              {/* PROGRESS BAR */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Completion</span>
                  <span className="font-mono text-blue-600 font-bold">{stats.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.passed / stats.total) * 100}%` }} />
                  <div className="bg-rose-500 transition-all" style={{ width: `${(stats.failed / stats.total) * 100}%` }} />
                  <div className="bg-slate-500 transition-all" style={{ width: `${(stats.na / stats.total) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* SECTION 1: INSPECTION DETAILS */}
            {activeSection === "details" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="font-display font-bold text-base text-slate-900 border-b pb-2">
                  1. Inspection Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-body">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Project Name</label>
                    <input
                      type="text"
                      value={data.projectName}
                      onChange={(e) => updateField({ projectName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Unit Number</label>
                    <input
                      type="text"
                      value={data.unitNumber}
                      onChange={(e) => updateField({ unitNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={data.customerName || ""}
                      onChange={(e) => updateField({ customerName: e.target.value })}
                      placeholder="Customer full name..."
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Customer Phone</label>
                    <input
                      type="text"
                      value={data.customerPhone || ""}
                      onChange={(e) => updateField({ customerPhone: e.target.value })}
                      placeholder="+91 Phone number..."
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Inspection Date</label>
                    <input
                      type="date"
                      value={data.inspectionDate || ""}
                      onChange={(e) => updateField({ inspectionDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Inspection ID</label>
                    <input
                      type="text"
                      disabled
                      value={data.inspectionId}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-slate-100 font-mono text-slate-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: CHECKLIST */}
            {activeSection === "checklist" && (
              <div className="space-y-4">
                {/* Area Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                  {AREAS.map((a) => {
                    const isActive = activeArea === a.key;
                    return (
                      <button
                        key={a.key}
                        onClick={() => setActiveArea(a.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
                          isActive
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {ITEMS.map((item) => {
                    const cell = getCell(data, item.id, activeArea);

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border bg-white transition-all shadow-xs ${
                          cell.status === "fail"
                            ? "border-rose-300 bg-rose-50/30"
                            : cell.status === "pass"
                            ? "border-emerald-200"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400">
                              #{String(item.id).padStart(2, "0")}
                            </span>
                            <span className="font-body font-bold text-sm text-slate-800">
                              {item.label}
                            </span>
                          </div>

                          {/* Status Controls: PASS | FAIL | N/A */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                              onClick={() => updateCell(item.id, activeArea, { status: "pass" })}
                              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                cell.status === "pass"
                                  ? "bg-emerald-500 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                            </button>
                            <button
                              onClick={() => updateCell(item.id, activeArea, { status: "fail" })}
                              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                cell.status === "fail"
                                  ? "bg-rose-500 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" /> FAIL
                            </button>
                            <button
                              onClick={() => updateCell(item.id, activeArea, { status: "na" })}
                              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                cell.status === "na"
                                  ? "bg-slate-700 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <MinusCircle className="w-3.5 h-3.5" /> N/A
                            </button>
                          </div>
                        </div>

                        {/* When FAIL is selected: Require Defect description, Remarks, Photo */}
                        {cell.status === "fail" && (
                          <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-3 text-xs font-body">
                            <div className="flex items-center gap-1.5 text-rose-700 font-bold uppercase tracking-wider text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Defect Details Required
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Remarks & Defect Description</label>
                              <textarea
                                value={cell.remarks || ""}
                                onChange={(e) => updateCell(item.id, activeArea, { remarks: e.target.value })}
                                placeholder="Describe the defect found in detail..."
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-xs focus:ring-2 focus:ring-rose-400 focus:outline-none"
                              />
                            </div>

                            {/* Photo Attachments for Defect */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-slate-700">Photo Evidence</span>
                                <span className="text-slate-400 font-mono">{(cell.photos || []).length}/4</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(cell.photos || []).map((p) => (
                                  <div key={p.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group">
                                    <img src={p.dataUrl || p.url} className="w-full h-full object-cover" alt="Defect" />
                                    <button
                                      onClick={() => updateCell(item.id, activeArea, { photos: cell.photos.filter((x) => x.id !== p.id) })}
                                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                {(cell.photos || []).length < 4 && (
                                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-rose-300 bg-white hover:bg-rose-50 flex flex-col items-center justify-center text-rose-600 cursor-pointer transition-colors">
                                    <Camera className="w-4 h-4 mb-0.5" />
                                    <span className="text-[9px] font-bold">Add</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={async (e) => {
                                        if (e.target.files?.[0]) {
                                          const compressed = await compressImage(e.target.files[0]);
                                          const url = await uploadPhoto(data.inspectionId, 'fail', compressed, item.id, activeArea, data.projectName, data.unitNumber);
                                          updateCell(item.id, activeArea, {
                                            photos: [...(cell.photos || []), { id: Math.random().toString(36).slice(2), dataUrl: url, url }],
                                          });
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: DEFECTS */}
            {activeSection === "defects" && (
              <DefectsAndPhotosManager
                mode="defects"
                currentInspection={data}
                onUpdateInspectionCell={updateCell}
              />
            )}

            {/* SECTION 4: PHOTOS */}
            {activeSection === "photos" && (
              <DefectsAndPhotosManager
                mode="photos"
                currentInspection={data}
                onUpdateInspectionCell={updateCell}
              />
            )}

            {/* SECTION 5: CUSTOMER DECLARATION */}
            {activeSection === "declaration" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 font-body">
                <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3">
                  5. Customer Declaration & Photo Verification
                </h3>

                {/* Customer Verification Photo */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600" /> Customer Verification Photo *
                  </h4>
                  {data.customerVerificationPhoto ? (
                    <div className="relative max-w-xs rounded-xl overflow-hidden border border-slate-200">
                      <img src={data.customerVerificationPhoto} alt="Verification" className="w-full h-40 object-cover" />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-xl bg-white cursor-pointer hover:bg-blue-50">
                      <Camera className="w-8 h-8 text-blue-600 mb-2" />
                      <span className="text-xs font-bold text-slate-800">Capture Customer Verification Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          if (e.target.files?.[0]) {
                            const compressed = await compressImage(e.target.files[0]);
                            const url = await uploadPhoto(data.inspectionId, 'customerVerification', compressed, null, null, data.projectName, data.unitNumber);
                            updateField({ customerVerificationPhoto: url });
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs text-slate-600">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!data.declarationChecked}
                      onChange={(e) => updateField({ declarationChecked: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      I hereby declare that the joint inspection for Unit <b>{data.unitNumber}</b> has been conducted on-site in my presence and all observed particulars are accurately recorded above.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* SECTION 6: SIGNATURES */}
            {activeSection === "signatures" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 font-body">
                <div className="border-b pb-3 flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-slate-900">
                    6. On-Site & Multi-Tier Digital Signatures
                  </h3>
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    8 Role-Based Requirements
                  </span>
                </div>

                <DigitalSignatureSystem
                  signatures={data.signatures || {}}
                  approvalHistory={data.approvalHistory || []}
                  onSaveSignature={(roleKey, signatureObj, auditEntry) => {
                    const updatedSignatures = { ...(data.signatures || {}), [roleKey]: signatureObj };
                    const updatedHistory = [...(data.approvalHistory || []), auditEntry];
                    setData((prev) => ({
                      ...prev,
                      signatures: updatedSignatures,
                      approvalHistory: updatedHistory,
                    }));
                  }}
                />
              </div>
            )}

            {/* SECTION 7: REVIEW */}
            {activeSection === "review" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 font-body">
                <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3">
                  7. Inspection Review Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Review room checklist summary before final submission.
                </p>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span>Total Checklist Items:</span>
                    <span className="font-mono">{stats.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>Passed:</span>
                    <span className="font-mono">{stats.passed}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-700 font-bold">
                    <span>Failed Defects:</span>
                    <span className="font-mono">{stats.failed}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 font-bold">
                    <span>N/A:</span>
                    <span className="font-mono">{stats.na}</span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 8: APPROVAL */}
            {activeSection === "approval" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 font-body">
                <h3 className="font-display font-bold text-base text-slate-900 border-b pb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" /> 8. Management Approval Status
                </h3>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
                  <p className="font-bold">Workflow Status: {data.workflowStatus || "DRAFT"}</p>
                  <p className="text-slate-600">
                    Once submitted by the Site Engineer, this inspection will progress through QA/QC, Project Manager, Manager Technical, GM – HUG, and VP – HUG approvals.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* ─── RIGHT SIDE (3 Columns): SUMMARY CARD ────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs sticky top-20 font-body space-y-4">
              <h3 className="font-display font-bold text-sm text-slate-900 border-b pb-2">
                Inspection Summary
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">Completion</span>
                  <span className="font-mono font-extrabold text-blue-600 text-sm">{stats.pct}%</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Passed
                  </span>
                  <span className="font-mono font-bold text-emerald-700">{stats.passed}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                  <span className="font-semibold text-rose-800 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" /> Failed
                  </span>
                  <span className="font-mono font-bold text-rose-700">{stats.failed}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <MinusCircle className="w-3.5 h-3.5 text-slate-500" /> N/A
                  </span>
                  <span className="font-mono font-bold text-slate-700">{stats.na}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Open Defects
                  </span>
                  <span className="font-mono font-bold text-amber-700">{stats.failed}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ─── BOTTOM FIXED ACTION BAR ────────────────────────────────────────── */}
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 font-body">
            
            {/* Save Draft */}
            <button
              onClick={() => handleManualSave()}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4 text-slate-600" />
              <span>Save Draft</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Continue to Next Section */}
              {activeSection !== "approval" && (
                <button
                  onClick={handleNextSection}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Submit Inspection */}
              <button
                onClick={() => handleSubmit()}
                disabled={submittingWithPin}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
              >
                {submittingWithPin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckSquare className="w-4 h-4" />
                )}
                <span>{submittingWithPin ? "Submitting..." : "Submit Inspection"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submitting Loading Modal Overlay */}
        {submittingWithPin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center max-w-sm border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Loader2 size={36} className="animate-spin text-blue-600" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Submitting Inspection</h3>
                <p className="font-body text-xs text-slate-500 mt-1">Writing data & syncing with Google Sheets. Please wait…</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
