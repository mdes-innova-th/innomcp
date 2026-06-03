"use client";
import React, { useState, useEffect } from "react";

interface ProviderRun {
  runId: string;
  timestamp: string;
  query: string;
  latencyMs: number;
  success: boolean;
  preview: string;
  isFastest: boolean;
}

interface Props {
  providerId: string;
  providerLabel: string;
  onClose?: () => void;
}

function resolveBackendUrl(path: string): string {
  const envUrl = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL
    ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, "") : "";
  if (envUrl) return `${envUrl}${path}`;
  if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3000")
    return `${window.location.protocol}//${window.location.hostname}:3011${path}`;
  return `http://localhost:3011${path}`;
}

export default function ProviderHistoryPanel({ providerId, providerLabel, onClose }: Props) {
  const [runs, setRuns] = useState<ProviderRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(resolveBackendUrl(`/api/mother/providers/${providerId}/history?limit=10`), { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.runs) setRuns(d.runs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [providerId]);

  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 space-y-2 min-w-[280px] max-w-[380px]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold">{providerLabel} — dispatch history</span>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[11px] ml-2">✕</button>
        )}
      </div>

      {loading ? (
        <p className="text-[10px] text-muted-foreground animate-pulse">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No dispatch runs yet for this provider.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {runs.map(r => (
            <div key={r.runId} className={`rounded p-2 border text-[10px] ${r.isFastest ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-border/30'}`}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={r.success ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-500 font-medium"}>
                  {r.success ? "✓" : "✗"} {r.latencyMs < 1000 ? `${r.latencyMs}ms` : `${(r.latencyMs/1000).toFixed(1)}s`}
                </span>
                {r.isFastest && <span className="text-yellow-500 text-[9px] font-medium">⚡ fastest</span>}
                <span className="text-muted-foreground/60 tabular-nums">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {r.query && (
                <p className="text-muted-foreground/60 truncate mb-0.5">Q: {r.query}</p>
              )}
              {r.preview && (
                <p className="text-foreground/70 line-clamp-2 leading-tight">{r.preview}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
