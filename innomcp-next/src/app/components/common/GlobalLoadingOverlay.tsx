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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/78 backdrop-blur-md">
      <div className="chat-elevated-panel flex max-w-sm flex-col items-center gap-4 rounded-[30px] border border-border/70 px-8 py-7 text-center shadow-2xl">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Secure session
        </div>
        <LoadingSpinner color="primary" size="lg" />
        <p className="font-display text-2xl text-foreground">กำลังเตรียมพื้นที่ทำงาน</p>
        <p className="text-sm leading-6 text-muted-foreground">
          ตรวจสอบสิทธิ์ผู้ใช้และโหลดบริบทล่าสุดก่อนเปิด workspace ให้พร้อมใช้งาน
        </p>
      </div>
    </div>
  );
}
