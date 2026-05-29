"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

interface ProviderHealth {
  id: string;
  displayName: string;
  healthStatus: HealthStatus;
  latencyMs: number;
}

interface HealthResponse {
  results: ProviderHealth[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;
const WARN_LATENCY_MS = 2_000;

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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  HealthStatus,
  { dot: string; dotClass: string; label: string; cardBorder: string }
> = {
  healthy: {
    dot: "●",
    dotClass: "text-emerald-500",
    label: "Healthy",
    cardBorder: "border-emerald-500/20",
  },
  degraded: {
    dot: "●",
    dotClass: "text-amber-400",
    label: "Degraded",
    cardBorder: "border-amber-400/30",
  },
  down: {
    dot: "●",
    dotClass: "text-rose-500",
    label: "Down",
    cardBorder: "border-rose-500/30",
  },
  unknown: {
    dot: "●",
    dotClass: "text-muted-foreground/40",
    label: "Unknown",
    cardBorder: "border-border/30",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveEffectiveStatus(p: ProviderHealth): HealthStatus {
  if (p.healthStatus === "down") return "down";
  if (p.healthStatus === "healthy" && p.latencyMs > WARN_LATENCY_MS) return "degraded";
  return p.healthStatus;
}

function formatLatency(ms: number): string {
  if (ms <= 0) return "–";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

// ─── ProviderCard ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  checkedAt,
}: {
  provider: ProviderHealth;
  checkedAt: Date | null;
}) {
  const effective = deriveEffectiveStatus(provider);
  const cfg = STATUS_CONFIG[effective];

  return (
    <div
      className={`rounded-xl border ${cfg.cardBorder} bg-background/60 p-3 flex flex-col gap-1.5`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[11.5px] font-medium text-foreground leading-tight truncate flex-1 min-w-0">
          {provider.displayName}
        </p>
        <span className={`${cfg.dotClass} text-[13px] leading-none shrink-0`}>
          {cfg.dot}
        </span>
      </div>

      {/* Status + latency row */}
      <div className="flex items-center gap-2">
        {effective === "down" ? (
          <span className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 uppercase tracking-wide">
            OFFLINE
          </span>
        ) : (
          <span
            className={`text-[10px] font-medium ${
              effective === "degraded"
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {cfg.label}
          </span>
        )}

        {effective !== "down" && (
          <span
            className={`text-[10px] tabular-nums font-medium ${
              provider.latencyMs > WARN_LATENCY_MS
                ? "text-amber-500 dark:text-amber-400"
                : "text-muted-foreground"
            }`}
          >
            {formatLatency(provider.latencyMs)}
          </span>
        )}
      </div>

      {/* Last checked */}
      {checkedAt && (
        <p className="text-[9.5px] text-muted-foreground/50">
          checked {formatTime(checkedAt)}
        </p>
      )}
    </div>
  );
}

// ─── ProviderHealthPanel ──────────────────────────────────────────────────────

export default function ProviderHealthPanel() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        resolveBackendUrl("/api/providers/health-check"),
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthResponse = await res.json();
      setProviders(data.results ?? []);
      setCheckedAt(new Date());
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

  // Polling every 15s
  useEffect(() => {
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  const allHealthy =
    !loading &&
    providers.length > 0 &&
    providers.every((p) => deriveEffectiveStatus(p) === "healthy");

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-foreground">
          🩺 Provider Health
        </p>
        <button
          onClick={() => { setLoading(true); poll(); }}
          title="Refresh provider health"
          className="rounded-lg border border-border/40 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* All healthy banner */}
      {allHealthy && (
        <div className="rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          ✓ All providers healthy
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/30 bg-background/60 p-3 h-[72px] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400">
          ⚠ {error}
        </div>
      )}

      {/* Provider cards grid */}
      {!loading && !error && providers.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60">
          No providers configured.
        </p>
      )}

      {!loading && providers.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} checkedAt={checkedAt} />
          ))}
        </div>
      )}

      {/* Footer timestamp */}
      {checkedAt && !loading && (
        <p className="text-[9.5px] text-muted-foreground/40 text-right">
          polls every 15s · last {formatTime(checkedAt)}
        </p>
      )}
    </div>
  );
}
