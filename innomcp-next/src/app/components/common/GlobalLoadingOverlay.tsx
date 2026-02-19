"use client";

import React from "react";
import { useAuth } from "@/app/context/AuthContext";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";

/**
 * GlobalLoadingOverlay - Shows loading state during auth check
 * Displayed in main content area, not in header navigation
 */
export default function GlobalLoadingOverlay() {
  const { isAuthLoading } = useAuth();

  if (!isAuthLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-lg shadow-2xl border border-border">
        <LoadingSpinner color="primary" size="lg" />
        <p className="text-lg font-medium text-foreground animate-pulse">
          กำลังตรวจสอบสิทธิ์...
        </p>
      </div>
    </div>
  );
}
