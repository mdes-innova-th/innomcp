"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardView from "@/app/components/chat/DashboardView";
import { useProtectedRoute } from "@/app/hooks/useProtectedRoute";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isAuthLoading } = useProtectedRoute();
  const projectId =
    searchParams.get("projectId") ||
    searchParams.get("project_id") ||
    undefined;

  useEffect(() => {
    document.title = "Dashboard — INNOMCP";
  }, []);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-[12px]">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="w-full">
      <DashboardView
        projectId={projectId}
        onOpenChat={() =>
          router.push(projectId ? `/?projectId=${encodeURIComponent(projectId)}` : "/")
        }
      />
    </div>
  );
}
