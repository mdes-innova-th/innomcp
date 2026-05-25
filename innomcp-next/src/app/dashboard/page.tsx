"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardView from "@/app/components/chat/DashboardView";
import { useAuth } from "@/app/context/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading } = useAuth();

  useEffect(() => {
    document.title = "Dashboard — INNOMCP";
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

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
      <DashboardView onOpenChat={() => router.push("/")} />
    </div>
  );
}
