"use client";

import React from "react";

const CHECKLIST_ROWS = [
  { id: 1, label: "DOORS & WINDOWS" },
  { id: 2, label: "LOCKS AND LATCHES" },
  { id: 3, label: "WALL PAINTING" },
  { id: 4, label: "DOORS & WINDOWS PAINTING" },
  { id: 5, label: "TILES – HALL / TOILETS/ BEDROOMS / KITCHENS & BALCONY" },
  { id: 6, label: "ELECTRICAL FITTINGS" },
  { id: 7, label: "MAIN DOOR" },
  { id: 8, label: "TOILET FITTINGS" },
  { id: 9, label: "KITCHEN – GRANITE SLAB / SHELF" },
  { id: 10, label: "PLUMBING LINES ALL PLACES" },
  { id: 11, label: "CLEANING" },
];

const CHECKLIST_COLS = [
  { key: "living", label: "LIVING" },
  { key: "dining", label: "DINING" },
  { key: "kitchen", label: "KITCHEN" },
  { key: "utility", label: "UTILITY AREA /\nWASH AREA" },
  { key: "mbed", label: "M.BED\nROOM 1 &\nATT.\nTOILET" },
  { key: "bed2", label: "BED\nROOM 2" },
  { key: "bed3", label: "BED\nROOM 3" },
  { key: "toilets", label: "TOILETS" },
  { key: "balcony", label: "BLCNY" },
  { key: "addl", label: "ADDL.\n(IF ANY)" },
];

const SIGNATURE_ROWS = [
  [
    { key: "customer", label: "CUSTOMER SIGN" },
    { key: "siteEngineer", label: "SITE ENGINEER" },
    { key: "qaqc", label: "QA/QC IN-CHARGE" },
    { key: "projectManager", label: "PROJECT MANAGER" },
  ],
  [
    { key: "technicalExecutive", label: "TECHNICAL EXECUTIVE" },
    { key: "managerTechnical", label: "MANAGER TECHNICAL" },
    { key: "gmHug", label: "GM -HUG", subtitle: "(Mr.VIJAYACHANDAR)" },
    { key: "vpHug", label: "VP-HUG", subtitle: "(Mrs.SONY DHIRAJ)" },
  ],
];

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export default function JointInspectionPrintDoc({ data }) {
  if (!data) return null;

  const cells = data.cells || {};
  const signatures = data.signatures || {};

  const getCellMark = (itemId, colKey) => {
    const cell = cells[`${itemId}__${colKey}`];
    if (!cell || !cell.status) return "";
    const status = cell.status.toLowerCase();
    if (status === "pass" || status === "passed" || status === "ok") return "✓";
    if (status === "fail" || status === "failed") return "✗";
    if (status === "na" || status === "n/a") return "—";
    return "";
  };

  const formattedProjectName = data.projectName
    ? data.projectName.replace(/^DAC\s+/i, "").toUpperCase()
    : "";

  const inspectionTypeStr = data.inspectionType
    ? data.inspectionType.toUpperCase()
    : ".............................";

  const dateStr = formatDate(data.inspectionDate) || "..................";
  const customerNameStr = data.customerName
    ? data.customerName.toUpperCase()
    : "....................................................................";
  const unitNoStr = data.unitNumber
    ? data.unitNumber.toUpperCase()
    : "......................";
  const interiorDaysStr = data.interiorDays || "............";

  return (
    <div className="dac-paper-form bg-white text-black font-sans box-border w-full max-w-[820px] mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
      {/* Top Header Section with Logo */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1" />
        <div className="text-right">
          <div className="flex flex-col items-end">
            <img
              src="/dac-logo.png"
              alt="DAC Developers Logo"
              className="h-10 sm:h-12 object-contain"
            />
          </div>
        </div>
      </div>

      {/* Main Title Box */}
      <div className="border-2 border-black py-1 px-3 mb-2 text-center">
        <h1 className="text-[13px] sm:text-[15px] font-bold tracking-tight uppercase">
          JOINT INSPECTION CHECKLIST FOR KEY HANDOVER ( {inspectionTypeStr} )
        </h1>
      </div>

      {/* Date & Project info */}
      <div className="flex justify-end mb-1 text-[11px] sm:text-[12px] font-semibold">
        <span>Date: {dateStr}</span>
      </div>

      <div className="mb-2 text-[11px] sm:text-[12px] font-bold">
        <span>DAC {formattedProjectName || "…………………………………………………………………….."}</span>
      </div>

      <div className="flex justify-between items-center mb-2 text-[11px] sm:text-[12px] font-bold">
        <div>
          <span>CUSTOMER NAME: </span>
          <span className="font-semibold">{customerNameStr}</span>
        </div>
        <div className="text-right">
          <span>UNIT NO: </span>
          <span className="font-semibold">{unitNoStr}</span>
        </div>
      </div>

      {/* Checklist Table with Background Watermark */}
      <div className="relative border-2 border-black mb-2">
        {/* Faint Watermark behind table */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-15 overflow-hidden">
          <span className="font-black text-[100px] sm:text-[140px] tracking-widest text-[#2563eb]">
            DAC
          </span>
        </div>

        <table className="w-full border-collapse text-[9.5px] sm:text-[10.5px] relative z-10">
          <thead>
            <tr className="border-b-2 border-black bg-white/70">
              <th className="border-r border-black p-1 text-center font-bold w-[32px] sm:w-[36px]">
                S.NO
              </th>
              <th className="border-r border-black p-1 text-center font-bold min-w-[150px] sm:min-w-[170px]">
                PARTICULARS
              </th>
              {CHECKLIST_COLS.map((col) => (
                <th
                  key={col.key}
                  className="border-r border-black last:border-r-0 p-0.5 sm:p-1 text-center font-bold text-[8.5px] sm:text-[9.5px] leading-tight whitespace-pre-line"
                  style={{ width: "6.5%" }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHECKLIST_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-black">
                <td className="border-r border-black p-1 text-center font-bold">
                  {row.id}
                </td>
                <td className="border-r border-black p-1 font-bold text-[9px] sm:text-[10px] leading-tight">
                  {row.label}
                </td>
                {CHECKLIST_COLS.map((col) => {
                  const mark = getCellMark(row.id, col.key);
                  const isPass = mark === "✓";
                  const isFail = mark === "✗";
                  return (
                    <td
                      key={col.key}
                      className={`border-r border-black last:border-r-0 p-0.5 text-center font-bold text-[12px] sm:text-[13px] leading-none ${
                        isPass
                          ? "text-black"
                          : isFail
                          ? "text-black"
                          : "text-black"
                      }`}
                    >
                      {mark}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Row 12: Remarks (Spanning across row) */}
            <tr className="border-b-0">
              <td className="border-r border-black p-1 text-center font-bold">
                12
              </td>
              <td className="border-r border-black p-1 font-bold text-[9px] sm:text-[10px] leading-tight">
                REMARKS IF ANY
              </td>
              <td
                colSpan={CHECKLIST_COLS.length}
                className="p-1 text-left font-medium text-[9px] sm:text-[10px] leading-tight"
              >
                {data.generalRemarks ? (
                  <span className="text-black font-semibold">{data.generalRemarks}</span>
                ) : (
                  <span className="text-gray-400 italic">Nil</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Declaration Paragraph */}
      <div className="border-2 border-black p-2 mb-2 text-[9px] sm:text-[10px] leading-tight">
        <p className="font-bold mb-1 uppercase">
          I/WE HEREBY DONE{" "}
          <span className="underline font-black px-1">
            {data.inspectionType ? data.inspectionType.toUpperCase() : "__________"}
          </span>{" "}
          JOINT INSPECTION ON THIS DAY IN MY FLAT/VILLA AND I/WE ARE FULLY
          SATISFIED. TO TAKE OVER THE FLAT/VILLA AND THE HANDOVER IS SUBJECT TO
          OBTAINMENT OF FINANCE NOC FROM CRM TEAM.
        </p>
        <div className="text-[8.5px] sm:text-[9.5px] font-bold">
          <p className="mb-0.5">Note:</p>
          <p className="mb-0.5">
            1. I/We know that we need to completed the interior works in{" "}
            <span className="underline font-black px-1">{interiorDaysStr}</span>
            days and interior works to be carried out during 9 AM to 5 PM on any
            day.
          </p>
          <p>
            2. I/We know the I/We will not stay at nights during this interior
            work completion time which we adhere strictly.
          </p>
        </div>
      </div>

      {/* Signature Grid (2 rows x 4 columns) */}
      <div className="border-2 border-black">
        {SIGNATURE_ROWS.map((row, rIdx) => (
          <div
            key={rIdx}
            className={`grid grid-cols-4 ${
              rIdx === 0 ? "border-b border-black" : ""
            }`}
          >
            {row.map((col, cIdx) => {
              const sigDataUrl = signatures[col.key];
              return (
                <div
                  key={col.key}
                  className={`p-1.5 flex flex-col justify-between items-center text-center min-h-[60px] sm:min-h-[72px] ${
                    cIdx < 3 ? "border-r border-black" : ""
                  }`}
                >
                  {/* Signature graphic or blank space */}
                  <div className="flex-1 w-full flex items-center justify-center min-h-[34px] sm:min-h-[42px]">
                    {sigDataUrl && sigDataUrl !== "SIGNED" ? (
                      <img
                        src={sigDataUrl}
                        alt={`${col.label} Signature`}
                        className="max-h-[32px] sm:max-h-[40px] max-w-[92%] object-contain"
                      />
                    ) : sigDataUrl === "SIGNED" ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                        ✓ Digitally Signed
                      </span>
                    ) : (
                      <div className="h-6" />
                    )}
                  </div>

                  {/* Signatory Label */}
                  <div className="mt-1 pt-0.5 border-t border-dotted border-gray-400 w-full">
                    <p className="text-[8.5px] sm:text-[9.5px] font-bold uppercase leading-tight">
                      {col.label}
                    </p>
                    {col.subtitle && (
                      <p className="text-[7.5px] sm:text-[8.5px] font-bold text-gray-800 leading-none mt-0.5">
                        {col.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
