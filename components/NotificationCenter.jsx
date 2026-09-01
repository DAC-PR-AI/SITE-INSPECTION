"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Bell, X, Check, CheckCircle2, AlertTriangle, XCircle, Info,
  ShieldCheck, ArrowUpRight, Clock, RefreshCw, Filter, ShieldAlert
} from "lucide-react";
import { getNotificationsForRole } from "../lib/notifications";

export default function NotificationCenter({
  isOpen,
  onClose,
  onOpenInspection,
  userRole = "Admin",
  inspections = [],
  className = ""
}) {
  const [activeTab, setActiveTab] = useState("unread"); // unread | read | all
  const [readIds, setReadIds] = useState(new Set());

  // Generate role-filtered notifications
  const rawNotifications = useMemo(() => getNotificationsForRole(inspections, userRole), [inspections, userRole]);

  // Dynamically apply read state overrides
  const notifications = useMemo(() => {
    return rawNotifications.map((n) => ({
      ...n,
      isRead: readIds.has(n.id) ? true : n.isRead,
    }));
  }, [rawNotifications, readIds]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const readCount = useMemo(() => notifications.filter((n) => n.isRead).length, [notifications]);

  // Tab Filtering
  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") return notifications.filter((n) => !n.isRead);
    if (activeTab === "read") return notifications.filter((n) => n.isRead);
    return notifications;
  }, [notifications, activeTab]);

  const handleMarkAsRead = (id, e) => {
    if (e) e.stopPropagation();
    setReadIds((prev) => new Set(prev).add(id));
  };

  const handleMarkAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
  };

  const handleNotificationClick = (item) => {
    handleMarkAsRead(item.id);
    if (onOpenInspection && item.inspectionId) {
      onOpenInspection(item.inspectionId);
      if (onClose) onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col justify-between font-body text-slate-900 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── 1. HEADER ──────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shrink-0 relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-bold text-base text-slate-900">Notifications</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                  {userRole}
                </span>
              </div>
              <p className="text-xs text-slate-500">Internal role-aware activity logs</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1"
                title="Mark all as read"
              >
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Read All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── 2. TABS BAR ────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200 bg-slate-100/50 px-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab("unread")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "unread"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("read")}
            className={`px-4 py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "read"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Read</span>
            <span className="font-mono text-slate-400 text-[10px]">({readCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-3 border-b-2 transition-all ${
              activeTab === "all"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>All ({notifications.length})</span>
          </button>
        </div>

        {/* ─── 3. NOTIFICATIONS LIST PANEL ────────────────────────────────── */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-50/50">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed rounded-2xl bg-white space-y-2">
              <Bell className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
              <p>No {activeTab} notifications available for {userRole}.</p>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                  !item.isRead
                    ? "bg-white border-blue-200 shadow-xs hover:border-blue-400"
                    : "bg-slate-50 border-slate-200 opacity-75 hover:opacity-100"
                }`}
              >
                {!item.isRead && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-600 shadow-xs" />
                )}

                <div className="flex items-start gap-3">
                  {/* Icon Indicator */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    item.severity === "danger"
                      ? "bg-rose-50 text-rose-600 border-rose-200"
                      : item.severity === "warning"
                      ? "bg-amber-50 text-amber-600 border-amber-200"
                      : item.severity === "success"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-blue-50 text-blue-600 border-blue-200"
                  }`}>
                    {item.severity === "danger" ? (
                      <XCircle className="w-4 h-4" />
                    ) : item.severity === "warning" ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : item.severity === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-xs text-blue-600">{item.inspectionId}</span>
                      <span className="text-slate-400 text-[10px]">•</span>
                      <span className="text-slate-600 font-semibold text-[11px] truncate">{item.projectName}</span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2 font-body">{item.description}</p>

                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                      <span>{new Date(item.timestamp).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                      <span className="text-blue-600 font-bold flex items-center gap-0.5 group-hover:underline">
                        <span>View</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── 4. FOOTER BAR ──────────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between font-mono text-[11px] text-slate-500">
          <span>Role Scope: <b>{userRole}</b></span>
          <span>{notifications.length} Total Events</span>
        </div>
      </div>
    </div>
  );
}
