"use client";

import { useEffect, useId, useRef, useCallback, type FC } from "react";

interface MDESConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string; // default "ยืนยัน"
  cancelLabel?: string; // default "ยกเลิก"
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

type Variant = NonNullable<MDESConfirmDialogProps["variant"]>;

const variantConfirmClasses: Record<Variant, string> = {
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  warning: "bg-yellow-500 text-black hover:bg-yellow-600 focus:ring-yellow-500",
  info: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
};

const MDESConfirmDialog: FC<MDESConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  variant = "info",
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === "Enter") {
        // Trigger confirm unless a non‑submit element with Enter behaviour is focused
        onConfirm();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLButtonElement>("button")
        ).filter((btn) => !btn.disabled && btn.tabIndex !== -1);

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [isOpen, onCancel, onConfirm]
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus confirm button after a tick (ensure dialog is visible)
      requestAnimationFrame(() => {
        confirmBtnRef.current?.focus();
      });
    } else if (previousActiveElement.current) {
      // Restore focus when dialog closes
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent background scrolling
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const confirmClass = variantConfirmClasses[variant] ?? variantConfirmClasses.info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity"
      onClick={onCancel}
      aria-hidden={!isOpen}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-2 text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <p id={descId} className="mb-6 text-sm text-gray-600">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MDESConfirmDialog;