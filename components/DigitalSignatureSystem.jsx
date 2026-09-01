"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  PenTool, Lock, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  RotateCcw, Undo2, Check, X, Clock, UserCheck, Calendar, KeyRound, Loader2
} from "lucide-react";

// Signature Canvas Component for touch/mouse drawing
function DrawingCanvas({ onReady }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drawingRef = useRef(false);
  const pathsRef = useRef([]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = canvas._dpr || 1;

    // Reset transform & clear full buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply DPR scale transform so drawing coordinates align 1:1 with CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    pathsRef.current.forEach((path) => {
      if (path.length === 0) return;
      if (path.length === 1) {
        ctx.beginPath();
        ctx.arc(path[0].x, path[0].y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas._dpr = dpr;
      redraw();
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (onReady) {
      onReady({
        clear: () => {
          pathsRef.current = [];
          redraw();
        },
        undo: () => {
          pathsRef.current.pop();
          redraw();
        },
        isEmpty: () => pathsRef.current.length === 0,
        exportPNG: () => {
          const canvas = canvasRef.current;
          if (!canvas) return "";
          return canvas.toDataURL("image/png");
        },
      });
    }
  }, [onReady]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined 
      ? e.clientX 
      : (e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0);
    const clientY = e.clientY !== undefined 
      ? e.clientY 
      : (e.touches?.[0]?.clientY ?? e.changedTouches?.[0]?.clientY ?? 0);
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    if (e.cancelable) e.preventDefault();
    if (e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch {}
    }
    drawingRef.current = true;
    const pt = getPos(e);
    pathsRef.current.push([pt]);
    redraw();
  };

  const handlePointerMove = (e) => {
    if (!drawingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const pt = getPos(e);
    const curr = pathsRef.current[pathsRef.current.length - 1];
    if (curr) {
      curr.push(pt);
      redraw();
    }
  };

  const handlePointerUp = (e) => {
    if (!drawingRef.current) return;
    if (e && e.cancelable) e.preventDefault();
    if (e?.target?.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId); } catch {}
    }
    drawingRef.current = false;
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-48 bg-slate-50 rounded-2xl border border-slate-300 overflow-hidden select-none"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair block touch-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="absolute bottom-3 left-4 right-4 border-b border-dashed border-slate-300 pointer-events-none" />
    </div>
  );
}

export default function DigitalSignatureSystem({
  signatures = {},
  approvalHistory = [],
  onSaveSignature,
  canSign = true,
  className = "",
}) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [credentialsPin, setCredentialsPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState("credentials"); // credentials | drawing
  const canvasApiRef = useRef(null);

  // Configuration of Signature Roles (Level 1 ➔ Level 2 ➔ Level 3)
  const rolesList = [
    { key: "technicalExecutive", roleName: "Technical Executive", subtitle: "Level 1 — Technical Inspection Lead", directSign: true },
    { key: "customer", roleName: "Customer", subtitle: "Level 1 — On-site Unit Purchaser", directSign: true },
    { key: "siteEngineer", roleName: "Site Engineer", subtitle: "Level 2 — On-site DAC Representative", directSign: false },
    { key: "qaqc", roleName: "QA/QC In-Charge", subtitle: "Level 3 — Quality Assurance Lead", directSign: false },
    { key: "projectManager", roleName: "Project Manager", subtitle: "Level 3 — Project Execution Manager", directSign: false },
    { key: "managerTechnical", roleName: "Manager Technical", subtitle: "Level 3 — Technical Operations Manager", directSign: false },
    { key: "gmHug", roleName: "GM – HUG", subtitle: "Level 3 — General Manager – HUG", directSign: false },
    { key: "vpHug", roleName: "VP – HUG", subtitle: "Level 3 — Vice President – HUG", directSign: false },
  ];

  const getSignatureState = (roleKey) => {
    const sig = signatures[roleKey];
    if (!sig) return { state: "Not Signed", color: "text-slate-400 bg-slate-100 border-slate-200" };
    if (sig.status === "rejected") return { state: "Rejected", color: "text-rose-700 bg-rose-50 border-rose-200" };
    if (sig.status === "signed" || sig.dataUrl || sig.signer) return { state: "Signed", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    return { state: "Ready", color: "text-blue-700 bg-blue-50 border-blue-200" };
  };

  const handleOpenRoleModal = (role) => {
    const state = getSignatureState(role.key);
    if (state.state === "Signed") return; // Locked

    if (!role.directSign) {
      alert(`${role.roleName} signs and approves via the Approval Portal after on-site inspection submission.`);
      return;
    }

    setSelectedRole(role);
    setSignerName(role.roleName);
    setCredentialsPin("");
    setAuthError("");
    setStep("drawing");
  };

  const handleVerifyCredentials = async (e) => {
    if (e) e.preventDefault();
    if (!credentialsPin || credentialsPin.trim().length !== 6) {
      setAuthError("Please enter your 6-digit authorized role passcode.");
      return;
    }

    setVerifying(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole.roleName, pin: credentialsPin.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStep("drawing");
        setAuthError("");
      } else {
        setAuthError(data.error || "Incorrect 6-digit passcode.");
      }
    } catch {
      setAuthError("Authentication server error. Check connection.");
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmSignature = () => {
    if (canvasApiRef.current?.isEmpty()) {
      setAuthError("Please draw your signature before confirming.");
      return;
    }

    const dataUrl = canvasApiRef.current.exportPNG();
    const now = new Date();

    const newSignatureObj = {
      role: selectedRole.roleName,
      signer: signerName.trim() || selectedRole.roleName,
      status: "signed",
      dataUrl,
      date: now.toLocaleDateString("en-GB"),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      timestamp: now.toISOString(),
    };

    const auditEntry = {
      approvalId: `APP-${Date.now()}`,
      role: selectedRole.roleName,
      signer: signerName.trim() || selectedRole.roleName,
      action: "SIGNED",
      timestamp: now.toISOString(),
    };

    if (onSaveSignature) {
      onSaveSignature(selectedRole.key, newSignatureObj, auditEntry);
    }

    setSelectedRole(null);
  };

  const customerSig = signatures.customer;
  const techExecSig = signatures.technicalExecutive;
  const isCustomerSigned = customerSig?.status === "signed" || customerSig?.dataUrl || customerSig?.signer;
  const isTechExecSigned = techExecSig?.status === "signed" || techExecSig?.dataUrl || techExecSig?.signer;
  const isBothSpotSigned = isCustomerSigned && isTechExecSigned;

  return (
    <div className={`space-y-6 font-body ${className}`}>
      
      {/* ─── SPOT SIGNATURES COMPLIANCE BANNER ───────────────────────────── */}
      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
        isBothSpotSigned
          ? "bg-emerald-50/80 border-emerald-200"
          : "bg-amber-50/80 border-amber-200"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border font-bold shrink-0 ${
            isBothSpotSigned
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-amber-100 text-amber-700 border-amber-200"
          }`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm text-slate-900">
                On-Site Spot Signatures Compliance
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                isBothSpotSigned
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-amber-100 text-amber-800 border-amber-300"
              }`}>
                {isBothSpotSigned ? "✓ Gate Complete" : "Spot Signatures Pending"}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Captured on-site during physical joint inspection by DAC staff member.
            </p>
          </div>
        </div>

        {/* Spot Signature Status Tags */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono shrink-0">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
            isCustomerSigned
              ? "bg-emerald-100/70 text-emerald-900 border-emerald-300"
              : "bg-white text-slate-600 border-slate-200"
          }`}>
            <span>Customer:</span>
            <span className="font-bold">
              {isCustomerSigned ? "✓ Signed" : "Not Signed"}
            </span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
            isTechExecSigned
              ? "bg-emerald-100/70 text-emerald-900 border-emerald-300"
              : "bg-white text-slate-600 border-slate-200"
          }`}>
            <span>Tech Exec:</span>
            <span className="font-bold">
              {isTechExecSigned ? "✓ Signed" : "Not Signed"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── SIGNATURE PANELS GRID ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rolesList.map((role) => {
          const sig = signatures[role.key];
          const { state, color } = getSignatureState(role.key);
          const isSigned = state === "Signed";

          return (
            <div
              key={role.key}
              onClick={() => handleOpenRoleModal(role)}
              className={`rounded-2xl border p-4 transition-all relative flex flex-col justify-between ${
                isSigned
                  ? "bg-emerald-50/40 border-emerald-200 shadow-xs cursor-default"
                  : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer group"
              }`}
            >
              <div>
                {/* Header Tag */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-bold text-xs text-slate-900 truncate">{role.roleName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${color}`}>
                    {state}
                  </span>
                </div>

                {/* Signature Display Box */}
                <div className="h-20 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-2 mb-3">
                  {isSigned ? (
                    sig?.dataUrl ? (
                      <img src={sig.dataUrl} className="h-full object-contain" alt={`${role.roleName} signature`} />
                    ) : (
                      <span className="font-mono text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Digital Sign-Off
                      </span>
                    )
                  ) : role.directSign ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                      <PenTool className="w-5 h-5 mb-1" />
                      <span className="text-[11px] font-bold">Click to Sign</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Lock className="w-4 h-4 mb-1 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400">Portal Approval</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signer Info & Timestamp */}
              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="truncate font-semibold text-slate-700">
                  {sig?.signer || role.subtitle}
                </span>
                {isSigned && (
                  <span className="font-mono text-[10px] text-slate-400">
                    {sig?.date} {sig?.time}
                  </span>
                )}
              </div>

              {/* Lock Badge */}
              {isSigned && (
                <div className="absolute top-3 right-3 text-emerald-600 opacity-60">
                  <Lock className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── AUDIT HISTORY TRAIL ─────────────────────────────────────────── */}
      {approvalHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Signature Audit Trail
          </h4>
          <div className="space-y-2">
            {approvalHistory.map((item, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-800">{item.role}</span>
                  <span className="text-slate-500">signed by <b>{item.signer}</b></span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SIGNATURE PROCESS MODAL (9-STEP WORKFLOW) ───────────────────── */}
      {selectedRole && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedRole(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedRole(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Step 1: Role Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">
                  Sign as {selectedRole.roleName}
                </h3>
                <p className="text-xs text-slate-500">{selectedRole.subtitle}</p>
              </div>
            </div>

            {authError && (
              <div className="mb-4 text-xs font-body text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Step 2 & 3: Credentials Input & Verification */}
            {step === "credentials" && (
              <form onSubmit={handleVerifyCredentials} className="space-y-4">
                <div>
                  <label className="font-semibold text-xs text-slate-700 block mb-1">
                    Signer Full Name
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="font-semibold text-xs text-slate-700 block mb-1">
                    6-Digit Role Passcode <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={credentialsPin}
                    onChange={(e) => {
                      setCredentialsPin(e.target.value);
                      setAuthError("");
                    }}
                    placeholder="••••••"
                    autoFocus
                    className="w-full text-sm font-mono tracking-widest rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter authorized credentials to verify identity without exposing passwords.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                  >
                    {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{verifying ? "Verifying..." : "Verify & Continue"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 4 - 8: Open Signature Pad, Capture, Confirm, Lock */}
            {step === "drawing" && (
              <div className="space-y-4">
                <div>
                  <label className="font-semibold text-xs text-slate-700 block mb-1">
                    Signer Name
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-semibold text-xs text-slate-700 block mb-1.5">
                    Draw Signature Below <span className="text-rose-500">*</span>
                  </label>
                  <DrawingCanvas onReady={(api) => (canvasApiRef.current = api)} />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => canvasApiRef.current?.undo()}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => canvasApiRef.current?.clear()}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRole(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSignature}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm & Lock</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
