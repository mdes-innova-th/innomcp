"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MotherStats {
  totalRuns: number;
  totalProviderCalls: number;
  avgSuccessRate: number;
  avgProvidersPerRun: number;
  fastestProvider: { id: string; avgLatencyMs: number } | null;
  mostReliableProvider: { id: string; successRate: number } | null;
  topProviderByRequests: { id: string; requests: number } | null;
  recentIterations: number;
  lastRunAt: string | null;
  providerBreakdown: Array<{
    providerId: string;
    totalCalls: number;
    successes: number;
    avgLatencyMs: number;
    successRate: number;
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;

// ─── URL resolution — same pattern as MotherDispatchPanel ────────────────────

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

function successRateClass(rate: number): string {
  if (rate >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1 text-[9.5px] text-muted-foreground/70 font-medium uppercase tracking-wide truncate">
        <span>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className={`text-[18px] font-semibold tabular-nums leading-tight truncate ${
          valueClass ?? "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9.5px] text-muted-foreground/60 truncate">{sub}</p>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/30 bg-background/50 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="h-3 w-36 rounded bg-muted/50" />
        <div className="h-5 w-5 rounded bg-muted/40" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/20">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-3 py-2.5 flex flex-col gap-1.5">
            <div className="h-2.5 w-16 rounded bg-muted/40" />
            <div className="h-5 w-10 rounded bg-muted/50" />
            <div className="h-2 w-14 rounded bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MotherStatsCard ──────────────────────────────────────────────────────────

export default function MotherStatsCard() {
  const [stats, setStats] = useState<MotherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [topProvider, setTopProvider] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(resolveBackendUrl("/api/mother/stats"), {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MotherStats = await res.json();
      setStats(data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    poll();
  }, [poll]);

  // Poll every 15s
  useEffect(() => {
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  // Fetch top provider from summary once on mount
  useEffect(() => {
    fetch(resolveBackendUrl("/api/mother/summary"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.topProvider?.id) setTopProvider(data.topProvider.id);
      })
      .catch(() => {/* summary is optional — ignore errors */});
  }, []);

  // Loading skeleton
  if (loading) return <SkeletonCard />;

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400">
        ⚠ Mother Stats: {error}
      </div>
    );
  }

  // Empty state
  if (!stats || stats.totalRuns === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-background/50 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[12px] font-semibold text-foreground">
            🧠 Mother Dispatch Stats
          </p>
          <button
            onClick={() => { setLoading(true); poll(); }}
            title="Refresh stats"
            className="rounded-lg border border-border/40 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            ↻
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/60 leading-snug">
          No dispatches yet. Enable thinking mode (🧠) to start.
        </p>
      </div>
    );
  }

  const isActive = stats.recentIterations > 0;

  const successRateDisplay = `${Math.round(stats.avgSuccessRate)}%`;
  const fastestDisplay = stats.fastestProvider
    ? stats.fastestProvider.id
    : "–";
  const fastestSub = stats.fastestProvider
    ? `${stats.fastestProvider.avgLatencyMs}ms avg`
    : undefined;
  const reliableDisplay = stats.mostReliableProvider
    ? stats.mostReliableProvider.id
    : "–";
  const reliableSub = stats.mostReliableProvider
    ? `${Math.round(stats.mostReliableProvider.successRate)}% success`
    : undefined;

  return (
    <div className="rounded-xl border border-border/30 bg-background/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-semibold text-foreground">
            🧠 Mother Dispatch Stats
          </p>
          {isActive && (
            <span className="flex items-center gap-1 text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="animate-pulse">●</span>
              Active
            </span>
          )}
          {topProvider && (
            <span className="text-[9.5px] font-medium text-muted-foreground/70 border border-border/30 rounded px-1.5 py-0.5">
              Top: {topProvider}
            </span>
          )}
        </div>
        <button
          onClick={() => { setLoading(true); poll(); }}
          title="Refresh stats"
          className="rounded-lg border border-border/40 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          ↻
        </button>
      </div>

      {/* Stats grid — 2×2 on mobile, 1×4 on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/20">
        <StatBox
          icon="🔢"
          label="Total Runs"
          value={stats.totalRuns}
          sub={`${stats.totalProviderCalls} provider calls`}
        />
        <StatBox
          icon="✅"
          label="Avg Success"
          value={successRateDisplay}
          sub={`${stats.avgProvidersPerRun.toFixed(1)} providers/run`}
          valueClass={successRateClass(stats.avgSuccessRate)}
        />
        <StatBox
          icon="⚡"
          label="Fastest"
          value={fastestDisplay}
          sub={fastestSub}
          valueClass="text-emerald-600 dark:text-emerald-400 text-[14px]"
        />
        <StatBox
          icon="🏆"
          label="Most Reliable"
          value={reliableDisplay}
          sub={reliableSub}
          valueClass="text-amber-600 dark:text-amber-400 text-[14px]"
        />
      </div>

      {/* Footer */}
      {updatedAt && (
        <p className="text-[9px] text-muted-foreground/40 text-right px-3 py-1 border-t border-border/10">
          polls every 15s · last {updatedAt.toTimeString().slice(0, 8)}
        </p>
      )}
    </div>
  );
}
