"use client";
import React, { useState, useEffect, useCallback } from "react";

interface MotherRunProvider {
  providerId: string;
  providerName: string;
  latencyMs: number;
  success: boolean;
  preview: string;
  errorMsg?: string;
}

interface MotherRun {
  runId: string;
  timestamp: string;
  query: string;
  iteration: number;
  successCount: number;
  fastestProvider: string;
  synthesis: string;
  providers: MotherRunProvider[];
}

const PROVIDER_LABEL: Record<string, string> = {
  "mdes-cloud": "MDES", "thai-llm": "ThaiLLM", "ollama-local": "Local",
  "openai-gpt": "GPT", "claude-haiku": "Haiku", "claude-sonnet": "Sonnet",
  "copilot": "Copilot", "gemini-pro": "Gemini", "mistral-large": "Mistral",
  "deepseek-r1": "DeepSeek", "groq-llama": "Groq", "together-llama": "Together",
  "innova-bot": "Innova", "innova-oracle": "Oracle",
};

const PROVIDER_COLOR: Record<string, string> = {
  "mdes-cloud": "border-orange-300/50 dark:border-orange-700/40",
  "thai-llm":   "border-orange-200/50 dark:border-orange-800/40",
  "groq-llama": "border-emerald-300/50 dark:border-emerald-700/40",
  "claude-haiku": "border-purple-300/50 dark:border-purple-700/40",
  "claude-sonnet":"border-purple-400/50 dark:border-purple-600/40",
  "innova-bot": "border-teal-300/50 dark:border-teal-700/40",
  "innova-oracle":"border-teal-400/50 dark:border-teal-600/40",
};

function resolveBackendUrl(path: string): string {
  const envUrl = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL
    ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, "") : "";
  if (envUrl) return `${envUrl}${path}`;
  if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3000")
    return `${window.location.protocol}//${window.location.hostname}:3011${path}`;
  return `http://localhost:3011${path}`;
}

interface Props {
  /** Only render if mother dispatch has fired at least once */
  className?: string;
}

export default function MotherResponsesPanel({ className = "" }: Props) {
  const [run, setRun] = useState<MotherRun | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLatest = useCallback(() => {
    setLoading(true);
    fetch(resolveBackendUrl("/api/mother/history?limit=1"), { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const latest = d?.runs?.[0] ?? null;
        if (latest) setRun(latest);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLatest();
    const id = setInterval(fetchLatest, 10_000);
    return () => clearInterval(id);
  }, [fetchLatest]);

  if (!run) return null;

  const successful = run.providers
    .filter(p => p.success && p.preview.length > 0)
    .sort((a, b) => a.latencyMs - b.latencyMs)
    .slice(0, 6);

  if (successful.length === 0) return null;

  return (
    <div className={`rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Multi-Agent Responses
          </span>
          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">
            {run.successCount}/{run.providers.length} responded
          </span>
          <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">
            iter #{run.iteration}
          </span>
        </div>
        <button
          onClick={fetchLatest}
          disabled={loading}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/40"
        >
          {loading ? "…" : "↺"}
        </button>
      </div>

      {/* Query */}
      <p className="text-[11px] text-muted-foreground/70 line-clamp-1 italic">
        Q: {run.query}
      </p>

      {/* Provider response cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {successful.map((p, i) => {
          const isFastest = p.providerId === run.fastestProvider;
          const borderCls = PROVIDER_COLOR[p.providerId] ?? "border-border/40";
          return (
            <div
              key={p.providerId}
              className={`rounded-lg border ${borderCls} bg-card p-2.5 space-y-1 ${isFastest ? "ring-1 ring-yellow-400/30" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold truncate">
                  {isFastest && <span className="mr-1">⚡</span>}
                  {PROVIDER_LABEL[p.providerId] ?? p.providerId}
                </span>
                <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                  {p.latencyMs < 1000 ? `${p.latencyMs}ms` : `${(p.latencyMs/1000).toFixed(1)}s`}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/80 line-clamp-3">
                {p.preview}
              </p>
              {i === 0 && run.synthesis && (
                <div className="mt-1 pt-1 border-t border-border/30">
                  <span className="text-[9px] text-muted-foreground">🧬 Synthesis:</span>
                  <p className="text-[10px] text-muted-foreground/70 line-clamp-2 mt-0.5">{run.synthesis}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
