"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TaskDetailPanel from "@/app/components/chat/TaskDetailPanel";
import { useAuth } from "@/app/context/AuthContext";

export default function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading } = useAuth();

  useEffect(() => {
    document.title = `Task ${params.id} — INNOMCP`;
  }, [params.id]);

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

  const backendUrl =
    typeof window !== "undefined" && window.location.port === "3000"
      ? "http://localhost:3011"
      : "";
  const exportUrl = `${backendUrl}/api/tasks/${params.id}/export`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Dashboard
        </Link>
        <a
          href={exportUrl}
          download
          className="text-[11px] border border-border/40 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          📦 Export ZIP
        </a>
      </div>
      <div className="rounded-xl border border-border/40 bg-background/60 p-4">
        <TaskDetailPanel
          taskId={params.id}
          onClose={() => router.push("/dashboard")}
        />
      </div>
    </div>
  );
}
