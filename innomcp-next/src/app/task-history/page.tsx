"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { TaskRowSkeleton } from "@/app/components/common/LoadingSkeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  intent: string;
  status: "completed" | "running" | "failed";
  elapsed_ms: number | null;
  created_at: string;
  completed_at: string | null;
  rating?: number | null;
  tags?: string;
}

type FilterTab = "all" | "completed" | "running" | "failed";

// ─── Backend URL ──────────────────────────────────────────────────────────────

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3015"
    : "";

// ─── Status badge styles ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  running: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  failed: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "เสร็จ",
  running: "กำลังทำ",
  failed: "ล้มเหลว",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "เมื่อสักครู่";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} นาทีที่แล้ว`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 86_400_000)} วันที่แล้ว`;
}

function fmtElapsed(ms: number | null): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function TaskHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isAuthLoading } = useAuth();

  const initialStatus = (searchParams.get("status") as FilterTab) || "all";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterTab>(initialStatus);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // ── set page title ──────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = "Task History — INNOMCP";
  }, []);

  // ── auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  // ── fetch initial tasks ─────────────────────────────────────────────────────
  const fetchTasks = useCallback(async (offset: number, append: boolean) => {
    const isFetching = append ? setLoadingMore : setLoading;
    isFetching(true);
    try {
      // Try with offset param first; fall back to limit-only
      const url = offset > 0
        ? `${BACKEND}/api/tasks?limit=${PAGE_SIZE}&offset=${offset}`
        : `${BACKEND}/api/tasks?limit=${PAGE_SIZE}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const fetched: Task[] = data.tasks ?? [];

      setTasks((prev) => append ? [...prev, ...fetched] : fetched);
      setHasMore(fetched.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      fetchTasks(0, false);
    }
  }, [isAuthLoading, isLoggedIn, fetchTasks]);

  // ── handle load more ────────────────────────────────────────────────────────
  const handleLoadMore = () => {
    fetchTasks(tasks.length, true);
  };

  // ── auth loading state ──────────────────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-[12px]">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  // ── derived stats ───────────────────────────────────────────────────────────
  const completed = tasks.filter((t) => t.status === "completed").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const failed = tasks.filter((t) => t.status === "failed").length;

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(t => {
      try { JSON.parse(t.tags || "[]").forEach((tag: string) => tagSet.add(tag)); } catch {}
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    if (filter !== "all" && t.status !== filter) return false;
    if (activeTag) {
      try {
        const tags = JSON.parse(t.tags || "[]");
        return tags.includes(activeTag);
      } catch { return false; }
    }
    return true;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "completed", label: "เสร็จ" },
    { key: "running", label: "กำลังทำ" },
    { key: "failed", label: "ล้มเหลว" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← กลับ Dashboard
        </Link>
      </div>
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">
          📋 Task History
        </h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          ประวัติงานทั้งหมดในระบบ
        </p>
      </div>

      {/* Stats bar */}
      {!loading && tasks.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-background/60 px-4 py-2.5 flex items-center gap-4 text-[12px]">
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            {completed} เสร็จ
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-blue-700 dark:text-blue-400 font-medium">
            {running} กำลังทำ
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-rose-700 dark:text-rose-400 font-medium">
            {failed} ล้มเหลว
          </span>
          <span className="ml-auto text-muted-foreground/50">
            {tasks.length} งาน{hasMore ? "+" : ""}
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === tab.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && !loading && (
                <span className="ml-1 text-[10px] opacity-60">
                  (
                  {tab.key === "completed"
                    ? completed
                    : tab.key === "running"
                    ? running
                    : failed}
                  )
                </span>
              )}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`rounded-full px-2 py-0.5 text-[10.5px] transition-colors ${
                  activeTag === tag
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-1.5">
        {loading ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <TaskRowSkeleton key={i} />
            ))}
          </>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-[15px] font-semibold text-foreground mb-2">ยังไม่มีประวัติงาน</h2>
            <p className="text-[12.5px] text-muted-foreground mb-5 max-w-xs mx-auto">
              เริ่มสนทนากับ AI เพื่อสร้างงานแรกของคุณ
            </p>
            <a href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity">
              ➕ เริ่มงานใหม่
            </a>
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/60 px-3 py-2.5 hover:bg-muted/20 transition-colors"
            >
              {/* Status pill */}
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium ${
                  STATUS_STYLE[t.status] ?? "bg-muted/40 text-muted-foreground"
                }`}
              >
                {STATUS_LABEL[t.status] ?? t.status}
              </span>

              {/* Title */}
              <p className="flex-1 truncate text-[12px] text-foreground">
                {t.title || t.intent || "(ไม่มีชื่องาน)"}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-2 shrink-0">
                {t.elapsed_ms != null && (
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {fmtElapsed(t.elapsed_ms)}
                  </span>
                )}
                {/* Tag count badge */}
                {(() => {
                  try {
                    const tagCount = JSON.parse(t.tags || "[]").length;
                    return tagCount > 0 ? (
                      <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[9.5px] text-muted-foreground tabular-nums">
                        #{tagCount}
                      </span>
                    ) : null;
                  } catch { return null; }
                })()}
                {/* Rating column */}
                {t.rating ? (
                  <span className="text-amber-500 text-[11px] tabular-nums">
                    ★ {t.rating}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-[11px]">–</span>
                )}
                <span className="text-[10px] text-muted-foreground/50">
                  {relTime(t.created_at)}
                </span>
                <Link
                  href={`/tasks/${t.id}`}
                  className="text-[10.5px] text-primary/70 hover:text-primary transition-colors ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  ดู
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load more */}
      {!loading && hasMore && filteredTasks.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-lg border border-border/50 px-5 py-2 text-[12px] text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="animate-pulse">กำลังโหลด...</span>
            ) : (
              "โหลดเพิ่มเติม"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
