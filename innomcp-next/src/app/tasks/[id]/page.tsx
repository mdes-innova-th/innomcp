"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TaskDetailPanel from "@/app/components/chat/TaskDetailPanel";
import { useAuth } from "@/app/context/AuthContext";

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3015"
    : "";

export default function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading } = useAuth();

  const [replaying, setReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = `Task ${params.id} — INNOMCP`;
  }, [params.id]);

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  // Fetch total step count once so we know when replay ends
  useEffect(() => {
    if (!params.id) return;
    fetch(`${BACKEND}/api/tasks/${params.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setTotalSteps((d.steps ?? []).length);
        setProjectId(d.task?.project_id ?? null);
      })
      .catch(() => {});
  }, [params.id]);

  // Advance replayStep on interval while replaying
  useEffect(() => {
    if (!replaying) return;
    intervalRef.current = setInterval(() => {
      setReplayStep((prev) => {
        if (prev >= totalSteps) {
          clearInterval(intervalRef.current!);
          setReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [replaying, totalSteps]);

  const startReplay = () => {
    setReplayStep(0);
    setReplaying(true);
  };

  const stopReplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setReplaying(false);
  };

  const archiveTask = async () => {
    if (archiving) return;
    if (!window.confirm("Archive this task? It will disappear from the dashboard but remain available by direct link.")) {
      return;
    }

    setArchiving(true);
    try {
      const res = await fetch(`${BACKEND}/api/tasks/${params.id}/archive`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("archive_failed");
      }

      router.push(projectId ? `/dashboard?projectId=${encodeURIComponent(projectId)}` : "/dashboard");
      router.refresh();
    } catch {
      window.alert("Could not archive this task right now.");
    } finally {
      setArchiving(false);
    }
  };

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

  const exportUrl = `${BACKEND}/api/tasks/${params.id}/export`;
  const dashboardHref = projectId
    ? `/dashboard?projectId=${encodeURIComponent(projectId)}`
    : "/dashboard";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Link
          href={dashboardHref}
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
        <button
          onClick={archiveTask}
          disabled={archiving}
          className="text-[11px] border border-rose-400/40 rounded-md px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {archiving ? "Archiving..." : "Archive"}
        </button>
        {!replaying ? (
          <button
            onClick={startReplay}
            disabled={totalSteps === 0}
            className="text-[11px] border border-border/40 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            ▶ Replay
          </button>
        ) : (
          <button
            onClick={stopReplay}
            className="text-[11px] border border-amber-400/60 rounded-md px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:text-foreground transition-colors"
          >
            ⏹ หยุด
          </button>
        )}
      </div>

      {/* Replay indicator banner */}
      {replaying && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5">
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            ▶ กำลังเล่นซ้ำ... {replayStep}/{totalSteps}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-border/40 bg-background/60 p-4">
        <TaskDetailPanel
          taskId={params.id}
          onClose={() => router.push(dashboardHref)}
          replayMode={replaying}
          replayUpToStep={replayStep}
        />
      </div>
    </div>
  );
}
