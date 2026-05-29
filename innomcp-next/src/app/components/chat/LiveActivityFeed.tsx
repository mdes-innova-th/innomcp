"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  type: string;
  description: string;
  userId?: string;
  projectId?: string;
  createdAt: string;
  agentId?: string;
}

interface ActivityResponse {
  activities: Activity[];
}

// ─── URL resolution — same pattern as AgentLeaderboard ───────────────────────

function resolveBackendUrl(path: string): string {
  const envUrl =
    typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_BACKEND_URL
      ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, "")
      : "";
  if (envUrl) return `${envUrl}${path}`;
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    if (hostname === "localhost" && port === "3000") {
      return `${protocol}//${hostname}:3011${path}`;
    }
    return `${protocol}//${window.location.host}${path}`;
  }
  return `http://localhost:3011${path}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  agent_action:    "🤖",
  task_completed:  "✅",
  task_created:    "📝",
  message_sent:    "💬",
  project_created: "📁",
};

function getIcon(type: string): string {
  return TYPE_ICON[type] ?? "🔔";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000)  return "just now";
  if (diff < 60_000)  return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const POLL_INTERVAL = 10_000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const fetchActivities = useCallback(() => {
    const url = resolveBackendUrl("/api/activity?limit=15");
    fetch(url, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ActivityResponse>;
      })
      .then((data) => {
        const incoming = data.activities ?? [];
        setActivities(incoming);
        setError(null);

        // Determine newly arrived IDs for fade-in animation
        const newIds = new Set<string>();
        incoming.forEach((a) => {
          if (!prevIdsRef.current.has(a.id)) {
            newIds.add(a.id);
          }
        });

        // On first load all items get the fade-in
        if (prevIdsRef.current.size === 0) {
          incoming.forEach((a) => newIds.add(a.id));
        }

        if (newIds.size > 0) {
          setVisibleIds((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.add(id));
            return next;
          });
          // Cascade fade-in: reveal each new item with a small stagger
          let delay = 0;
          newIds.forEach((id) => {
            setTimeout(() => {
              setVisibleIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
              });
            }, delay);
            delay += 60;
          });
        }

        prevIdsRef.current = new Set(incoming.map((a) => a.id));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch + 10s polling
  useEffect(() => {
    fetchActivities();
    const id = setInterval(fetchActivities, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchActivities]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-muted/40 shrink-0" />
            <div className="flex-1 flex flex-col gap-1">
              <div className="h-3 bg-muted/40 rounded w-3/4" />
              <div className="h-2.5 bg-muted/30 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-2">
        <span>⚠️</span>
        <span>Failed to load: {error}</span>
        <button
          onClick={fetchActivities}
          className="ml-auto underline opacity-70 hover:opacity-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/10 p-5 text-center text-[12px] text-muted-foreground">
        <span className="text-2xl block mb-1.5">📭</span>
        No recent activity
      </div>
    );
  }

  return (
    <div
      className="max-h-[300px] overflow-y-auto flex flex-col pr-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Vertical timeline list */}
      <ol className="relative flex flex-col gap-0">
        {activities.map((activity, idx) => {
          const isVisible = visibleIds.has(activity.id);
          const isLast = idx === activities.length - 1;

          return (
            <li
              key={activity.id}
              className={`relative flex items-start gap-3 pb-3 transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              }`}
            >
              {/* Timeline spine */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[11px] top-[22px] w-px bg-border/40 bottom-0"
                />
              )}

              {/* Icon bubble */}
              <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-muted/30 border border-border/40 flex items-center justify-center text-[11px] leading-none z-10">
                {getIcon(activity.type)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-[1px]">
                <p className="text-[12px] text-foreground leading-snug line-clamp-2">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {timeAgo(activity.createdAt)}
                  </span>
                  {activity.agentId && (
                    <span className="text-[9.5px] font-medium text-sky-600 dark:text-sky-400">
                      🤖 {activity.agentId}
                    </span>
                  )}
                  {!activity.agentId && activity.userId && (
                    <span className="text-[9.5px] font-medium text-violet-600 dark:text-violet-400">
                      👤 {activity.userId}
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground/40 font-mono">
                    {activity.type}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
