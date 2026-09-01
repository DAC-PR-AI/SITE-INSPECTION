"use client";

import React from "react";

export default function Table({
  headers = [],
  data = [],
  renderRow,
  emptyText = "No data records found.",
  className = "",
}) {
  return (
    <div className={`w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs ${className}`}>
      <table className="w-full text-left border-collapse font-body text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {headers.map((header, idx) => (
              <th key={idx} className="p-3.5 sm:p-4">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={headers.length || 1} className="p-8 text-center text-slate-400 font-medium text-xs">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((item, index) => renderRow(item, index))
          )}
        </tbody>
      </table>
    </div>
  );
}
