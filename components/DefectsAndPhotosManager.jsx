"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle, Camera, Trash2, Eye, CheckCircle2, XCircle, Clock,
  Upload, Filter, RefreshCw, X, AlertCircle, Layers, Check, Loader2,
  ZoomIn, ExternalLink, Tag, Calendar
} from "lucide-react";
import { compressImage, uploadPhoto } from "./InspectionApp";

export default function DefectsAndPhotosManager({
  mode = "defects", // defects | photos
  inspections = [],
  currentInspection = null,
  onUpdateInspectionCell,
  onRefreshData,
}) {
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedDefectStatus, setSelectedDefectStatus] = useState("ALL");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);

  // Normalize defects list across inspections or current inspection
  const rawDefectsList = useMemo(() => {
    const list = [];
    const targetInspections = currentInspection ? [currentInspection] : inspections;

    targetInspections.forEach((inspec) => {
      const cells = inspec.cells || {};
      Object.entries(cells).forEach(([key, cell]) => {
        if (cell.status === "fail") {
          const [itemIdStr, areaKey] = key.split("__");
          const itemId = parseInt(itemIdStr, 10);

          list.push({
            defectId: cell.defectId || `DEF-${inspec.inspectionId}-${key}`,
            inspectionId: inspec.inspectionId,
            projectName: inspec.projectName,
            unitNumber: inspec.unitNumber,
            areaKey,
            areaLabel: cell.areaLabel || areaKey,
            itemId,
            itemLabel: cell.itemLabel || `Item #${itemId}`,
            description: cell.remarks || "Defect identified during inspection",
            severity: cell.priority || "Medium",
            status: cell.defectStatus || "Open", // Open | In Progress | Resolved | Re-check Required | Closed
            remarks: cell.resolutionRemarks || cell.remarks || "",
            createdAt: cell.createdAt || inspec.updatedAt || new Date().toISOString(),
            updatedAt: cell.updatedAt || inspec.updatedAt || new Date().toISOString(),
            photos: cell.photos || [],
            rawCell: cell,
            inspecRef: inspec,
          });
        }
      });
    });

    return list;
  }, [inspections, currentInspection]);

  // Filtered defects
  const filteredDefects = useMemo(() => {
    return rawDefectsList.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        d.defectId.toLowerCase().includes(q) ||
        d.inspectionId.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.areaLabel.toLowerCase().includes(q) ||
        d.itemLabel.toLowerCase().includes(q);

      const matchSev = selectedSeverity === "ALL" || d.severity.toUpperCase() === selectedSeverity;
      const matchStat = selectedDefectStatus === "ALL" || d.status.toUpperCase().replace(/\s+/g, "_") === selectedDefectStatus;

      return matchSearch && matchSev && matchStat;
    });
  }, [rawDefectsList, searchQuery, selectedSeverity, selectedDefectStatus]);

  // Normalized photos list across inspections
  const rawPhotosList = useMemo(() => {
    const list = [];
    const targetInspections = currentInspection ? [currentInspection] : inspections;

    targetInspections.forEach((inspec) => {
      if (inspec.customerVerificationPhoto) {
        list.push({
          photoId: `P-VERIF-${inspec.inspectionId}`,
          inspectionId: inspec.inspectionId,
          projectName: inspec.projectName,
          unitNumber: inspec.unitNumber,
          associatedType: "Verification",
          associatedLabel: "Customer Verification",
          url: inspec.customerVerificationPhoto,
          status: "Uploaded", // Uploading | Uploaded | Failed | Processing
          createdAt: inspec.updatedAt || new Date().toISOString(),
        });
      }

      const cells = inspec.cells || {};
      Object.entries(cells).forEach(([key, cell]) => {
        const [itemIdStr, areaKey] = key.split("__");
        (cell.photos || []).forEach((p, pIdx) => {
          list.push({
            photoId: p.id || `P-${inspec.inspectionId}-${key}-${pIdx}`,
            inspectionId: inspec.inspectionId,
            projectName: inspec.projectName,
            unitNumber: inspec.unitNumber,
            associatedType: cell.status === "fail" ? "Defect" : "Checklist",
            associatedLabel: `${areaKey} • Item #${itemIdStr}`,
            url: p.dataUrl || p.url,
            status: p.uploadStatus || "Uploaded",
            createdAt: inspec.updatedAt || new Date().toISOString(),
            rawPhotoObj: p,
            itemId: parseInt(itemIdStr, 10),
            areaKey,
          });
        });
      });
    });

    return list;
  }, [inspections, currentInspection]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return rawPhotosList.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        p.photoId.toLowerCase().includes(q) ||
        p.inspectionId.toLowerCase().includes(q) ||
        p.associatedLabel.toLowerCase().includes(q)
      );
    });
  }, [rawPhotosList, searchQuery]);

  // Counters
  const counts = useMemo(() => {
    const defectCount = rawDefectsList.length;
    const openDefectCount = rawDefectsList.filter((d) => d.status === "Open" || d.status === "In Progress" || d.status === "Re-check Required").length;
    const resolvedDefectCount = rawDefectsList.filter((d) => d.status === "Resolved" || d.status === "Closed").length;
    const photoCount = rawPhotosList.length;

    return { defectCount, openDefectCount, resolvedDefectCount, photoCount };
  }, [rawDefectsList, rawPhotosList]);

  // Update Defect Status handler
  const handleDefectStatusChange = (defect, newStatus) => {
    if (onUpdateInspectionCell) {
      onUpdateInspectionCell(defect.itemId, defect.areaKey, {
        defectStatus: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Photo Upload handler
  const handleDirectPhotoUpload = async (e, defect) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempPhotoId = `P-TEMP-${Date.now()}`;
    setUploadingPhotoId(tempPhotoId);

    try {
      const compressed = await compressImage(file);
      const url = await uploadPhoto(
        defect.inspectionId,
        "defect",
        compressed,
        defect.itemId,
        defect.areaKey,
        defect.projectName,
        defect.unitNumber
      );

      const updatedPhotos = [
        ...(defect.photos || []),
        { id: Math.random().toString(36).slice(2), dataUrl: url, url, uploadStatus: "Uploaded" },
      ];

      if (onUpdateInspectionCell) {
        onUpdateInspectionCell(defect.itemId, defect.areaKey, {
          photos: updatedPhotos,
        });
      }
    } catch (err) {
      console.error("Photo upload error:", err);
    } finally {
      setUploadingPhotoId(null);
    }
  };

  return (
    <div className="space-y-6 font-body text-slate-900">

      {/* ─── METRICS & COUNTERS HEADER BAR ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        {/* Total Defects */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Total Defects</p>
            <h4 className="font-display font-extrabold text-2xl text-slate-900">{counts.defectCount}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Open Defects */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Open Defects</p>
            <h4 className="font-display font-extrabold text-2xl text-rose-600">{counts.openDefectCount}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Resolved Defects */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Resolved Defects</p>
            <h4 className="font-display font-extrabold text-2xl text-emerald-600">{counts.resolvedDefectCount}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Photos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Total Photos</p>
            <h4 className="font-display font-extrabold text-2xl text-blue-600">{counts.photoCount}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={mode === "defects" ? "Search defect ID, description..." : "Search photo ID..."}
            className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {mode === "defects" && (
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-xs font-bold rounded-xl border border-slate-200 p-2 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="LOW">Low Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="HIGH">High Severity</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedDefectStatus}
              onChange={(e) => setSelectedDefectStatus(e.target.value)}
              className="text-xs font-bold rounded-xl border border-slate-200 p-2 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All States</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="RE_CHECK_REQUIRED">Re-check Required</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        )}
      </div>

      {/* ─── DEFECTS MANAGER VIEW ─────────────────────────────────────────── */}
      {mode === "defects" && (
        <div className="space-y-4">
          {filteredDefects.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-200 rounded-2xl bg-white">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No defects matching current filter parameters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDefects.map((defect) => (
                <div
                  key={defect.defectId}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        {defect.defectId}
                      </span>
                      
                      {/* DEFECT STATES dropdown: Open | In Progress | Resolved | Re-check Required | Closed */}
                      <select
                        value={defect.status}
                        onChange={(e) => handleDefectStatusChange(defect, e.target.value)}
                        className={`text-[11px] font-mono font-bold rounded-lg border px-2 py-1 focus:outline-none ${
                          defect.status === "Resolved" || defect.status === "Closed"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : defect.status === "Re-check Required"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        <option value="Open">● Open</option>
                        <option value="In Progress">● In Progress</option>
                        <option value="Resolved">✓ Resolved</option>
                        <option value="Re-check Required">⏳ Re-check Required</option>
                        <option value="Closed">✕ Closed</option>
                      </select>
                    </div>

                    <h4 className="font-display font-bold text-sm text-slate-900">
                      {defect.itemLabel} <span className="text-slate-500 font-normal">({defect.areaLabel})</span>
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                      {defect.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                      <span>Unit: <b>{defect.unitNumber}</b> ({defect.projectName})</span>
                      <span>Sev: <b>{defect.severity}</b></span>
                    </div>
                  </div>

                  {/* Defect Photo Attachments */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Attached Photos ({(defect.photos || []).length})</span>
                      <label className="text-blue-600 hover:underline cursor-pointer text-[11px]">
                        + Attach Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleDirectPhotoUpload(e, defect)}
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(defect.photos || []).map((p, idx) => (
                        <div
                          key={p.id || idx}
                          onClick={() => setLightboxPhoto(p.dataUrl || p.url)}
                          className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity relative group"
                        >
                          <img src={p.dataUrl || p.url} className="w-full h-full object-cover" alt="Defect capture" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── PHOTOS GALLERY VIEW ─────────────────────────────────────────── */}
      {mode === "photos" && (
        <div className="space-y-4">
          {filteredPhotos.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-200 rounded-2xl bg-white">
              <Camera className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No photos matching current query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.photoId}
                  className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-xs flex flex-col justify-between space-y-2 group"
                >
                  <div className="relative h-36 rounded-xl overflow-hidden bg-slate-100">
                    <img src={photo.url} className="w-full h-full object-cover" alt={photo.associatedLabel} />
                    
                    {/* View Full Size Overlay */}
                    <button
                      onClick={() => setLightboxPhoto(photo.url)}
                      className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white font-bold text-xs transition-opacity gap-1"
                    >
                      <ZoomIn className="w-5 h-5" />
                      <span>View Full Size</span>
                    </button>

                    {/* PHOTO STATES: Uploading | Uploaded | Failed | Processing */}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                      {photo.status}
                    </span>
                  </div>

                  <div className="text-xs font-body">
                    <p className="font-bold text-slate-900 truncate">{photo.associatedLabel}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {photo.projectName} • {photo.unitNumber}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── LIGHTBOX MODAL (Full Size Photo Preview) ────────────────────── */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 p-2 font-bold flex items-center gap-1 text-xs"
            >
              <X className="w-6 h-6" /> Close
            </button>
            <img src={lightboxPhoto} alt="Full Size Evidence" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20" />
          </div>
        </div>
      )}

    </div>
  );
}
