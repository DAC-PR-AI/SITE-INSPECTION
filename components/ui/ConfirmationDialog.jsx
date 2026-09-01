"use client";

import React from "react";
import Modal from "./Modal";
import Button from "./Button";
import { AlertTriangle, HelpCircle } from "lucide-react";

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  description = "Are you sure you want to proceed with this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // danger | primary
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center p-2 font-body">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border ${
          variant === "danger"
            ? "bg-rose-50 text-rose-600 border-rose-200"
            : "bg-blue-50 text-blue-600 border-blue-200"
        }`}>
          {variant === "danger" ? (
            <AlertTriangle className="w-7 h-7" />
          ) : (
            <HelpCircle className="w-7 h-7" />
          )}
        </div>

        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
          {description}
        </p>

        <div className="flex items-center gap-3 w-full">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            isDisabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            className="flex-1"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
