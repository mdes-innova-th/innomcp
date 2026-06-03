"use client";
import React, { useMemo, useState, useEffect } from "react";
import type { AgentEvent } from "./useAgentEventStream";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RaceEntry {
  providerId: string;
  label: string;
  color: string;
  model?: string;
  /** ms since dispatch started; set when agent_finished fires */
  latencyMs?: number;
  /** first ~100 chars of response from agent_finished event */
  previewText?: string;
  /** true = agent_finished received */
  done: boolean;
  /** true = fallback / circuit-open received */
  failed: boolean;
  /** true = agent_started received but not finished */
  running: boolean;
  /** true = never started (no agent_started event yet) */
  pending: boolean;
  /** provider finished first in this run */
  isFirst: boolean;
}

// ─── Provider identity map ────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { label: string; color: string; model: string }> = {
  "mdes-cloud":     { label: "MDES",     color: "text-orange-500 dark:text-orange-400",  model: "gemma4:26b" },
  "thai-llm":       { label: "ThaiLLM",  color: "text-orange-400 dark:text-orange-300",  model: "qwen3.5:9b" },
  "ollama-local":   { label: "Local",    color: "text-zinc-500 dark:text-zinc-400",       model: "llama3.2" },
  "openai-gpt":     { label: "GPT",      color: "text-emerald-600 dark:text-emerald-400", model: "gpt-4o-mini" },
  "claude-haiku":   { label: "Haiku",    color: "text-purple-500 dark:text-purple-400",   model: "claude-haiku-4-5-20251001" },
  "claude-sonnet":  { label: "Sonnet",   color: "text-purple-600 dark:text-purple-300",   model: "claude-sonnet-4-6" },
  "copilot":        { label: "Copilot",  color: "text-zinc-700 dark:text-zinc-300",        model: "gpt-4o" },
  "gemini-pro":     { label: "Gemini",   color: "text-blue-500 dark:text-blue-400",        model: "gemini-1.5-flash" },
  "mistral-large":  { label: "Mistral",  color: "text-red-700 dark:text-red-400",          model: "mistral-large-latest" },
  "deepseek-r1":    { label: "DeepSeek", color: "text-teal-600 dark:text-teal-400",        model: "deepseek-reasoner" },
  "groq-llama":     { label: "Groq",     color: "text-orange-600 dark:text-orange-400",    model: "llama-3.3-70b-versatile" },
  "together-llama": { label: "Together", color: "text-violet-500 dark:text-violet-400",    model: "Llama-3-70b" },
  "innova-bot":     { label: "Innova",   color: "text-emerald-500 dark:text-emerald-400",  model: "qwen2.5:0.5b" },
  "innova-oracle":  { label: "OracleRAG", color: "text-emerald-700 dark:text-emerald-300", model: "oracle-rag" },
};

// ─── Race state deriver ───────────────────────────────────────────────────────

/**
 * Pure function: derive race state from an ordered list of AgentEvents.
 * Exported for unit testing.
 *
 * Rules:
 * - Only events with ev.provider set and not "mother" are tracked.
 * - First agent_started per provider sets running=true.
 * - Subsequent agent_started for same provider = retry; reset running, keep latencyMs from first.
 * - agent_finished sets done=true, latencyMs from ev.latencyMs (or derived from timestamps).
 * - fallback sets failed=true.
 * - Provider with smallest latencyMs among done providers gets isFirst=true.
 */
export function deriveRaceState(events: AgentEvent[]): RaceEntry[] {
  const seen = new Map<string, {
    started: boolean;
    done: boolean;
    failed: boolean;
    latencyMs?: number;
    startedAt?: number;
    previewText?: string;
  }>();

  for (const ev of events) {
    const pid = ev.provider;
    if (!pid || pid === "mother") continue;

    if (!seen.has(pid)) {
      seen.set(pid, { started: false, done: false, failed: false });
    }
    const s = seen.get(pid)!;

    if (ev.type === "agent_started") {
      if (!s.started) {
        s.started = true;
        s.startedAt = ev.timestamp ? Date.parse(ev.timestamp) : undefined;
      }
      // Subsequent agent_started = retry — don't overwrite startedAt
    } else if (ev.type === "agent_finished") {
      s.done = true;
      if (ev.latencyMs != null) {
        s.latencyMs = ev.latencyMs;
      } else if (s.startedAt && ev.timestamp) {
        s.latencyMs = Date.parse(ev.timestamp) - s.startedAt;
      }
      if (ev.previewText) s.previewText = ev.previewText;
    } else if (ev.type === "fallback") {
      s.failed = true;
    }
  }

  // Find first responder (smallest latencyMs among done)
  let firstMs = Infinity;
  let firstId = "";
  for (const [pid, s] of seen.entries()) {
    if (s.done && s.latencyMs != null && s.latencyMs < firstMs) {
      firstMs = s.latencyMs;
      firstId = pid;
    }
  }

  return Array.from(seen.entries()).map(([pid, s]) => {
    const meta = PROVIDER_META[pid] ?? { label: pid, color: "text-zinc-500", model: undefined };
    return {
      providerId: pid,
      label: meta.label,
      color: meta.color,
      model: (PROVIDER_META[pid] ?? { model: undefined }).model,
      latencyMs: s.latencyMs,
      previewText: s.previewText,
      done: s.done,
      failed: s.failed,
      running: s.started && !s.done && !s.failed,
      pending: !s.started,
      isFirst: pid === firstId,
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ entry }: { entry: RaceEntry }) {
  if (entry.isFirst && entry.done) {
    return <span className="text-yellow-400 text-xs font-bold">🥇</span>;
  }
  if (entry.done) {
    return <span className="text-emerald-500 dark:text-emerald-400 text-xs">✓</span>;
  }
  if (entry.failed) {
    return <span className="text-rose-500 dark:text-rose-400 text-xs">✗</span>;
  }
  if (entry.running) {
    return (
      <span className="inline-flex h-3 w-3 rounded-full bg-blue-400 dark:bg-blue-500 animate-pulse" />
    );
  }
  return <span className="inline-flex h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  events: AgentEvent[];
  /** Collapse the view when no providers have started */
  hideWhenEmpty?: boolean;
}

export default function MotherRaceView({ events, hideWhenEmpty = true }: Props) {
  const entries = useMemo(() => deriveRaceState(events), [events]);

  // Filter to only providers seen in this run
  const visible = entries.filter((e) => !e.pending);

  if (hideWhenEmpty && visible.length === 0) return null;

  // Sort: done first (by latency asc), then running, then failed
  const sorted = [...visible].sort((a, b) => {
    if (a.done && b.done) return (a.latencyMs ?? 0) - (b.latencyMs ?? 0);
    if (a.done) return -1;
    if (b.done) return 1;
    if (a.running && !b.running) return -1;
    if (!a.running && b.running) return 1;
    return 0;
  });

  const doneCount = sorted.filter((e) => e.done).length;
  const totalCount = sorted.length;

  // Flash the winner for 3 seconds when a new first-place is detected
  const [flashWinner, setFlashWinner] = useState<string | null>(null);
  const currentWinner = sorted.find(e => e.isFirst)?.providerId ?? null;
  const prevWinnerRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (currentWinner && currentWinner !== prevWinnerRef.current) {
      prevWinnerRef.current = currentWinner;
      setFlashWinner(currentWinner);
      const t = setTimeout(() => setFlashWinner(null), 3000);
      return () => clearTimeout(t);
    }
  }, [currentWinner]);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-2 mb-2">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mother Race
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {doneCount}/{totalCount}
        </span>
        {sorted.filter(e => e.done).length >= 1 && (
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 tabular-nums">
            ⚡ {sorted.find(e => e.isFirst)?.label ?? ""}
          </span>
        )}
      </div>
      {flashWinner && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/30 animate-pulse mb-1">
          <span className="text-sm">🏆</span>
          <span className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400">
            {(entries.find(e => e.providerId === flashWinner)?.label) ?? flashWinner} responded first!
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {sorted.map((entry) => (
          <div key={entry.providerId}>
            <div
              className="flex items-center gap-1.5 px-1 py-0.5 rounded"
              title={entry.model ?? entry.providerId}
            >
              <StatusIcon entry={entry} />
              <span className={`text-[11px] font-medium truncate flex-1 ${entry.color}`}>
                {entry.label}
              </span>
              {entry.done && entry.latencyMs != null && (
                <span className="text-[10px] tabular-nums text-muted-foreground ml-auto shrink-0">
                  {entry.latencyMs < 1000
                    ? `${entry.latencyMs}ms`
                    : `${(entry.latencyMs / 1000).toFixed(1)}s`}
                </span>
              )}
              {entry.isFirst && entry.done && (
                <span className="text-[8px] text-yellow-500 font-bold ml-1">WIN</span>
              )}
              {entry.running && (
                <span className="text-[10px] text-blue-400 dark:text-blue-300 ml-auto shrink-0 animate-pulse">
                  …
                </span>
              )}
              {entry.failed && (
                <span className="text-[10px] text-rose-400 dark:text-rose-300 ml-auto shrink-0">
                  skip
                </span>
              )}
            </div>
            {entry.done && entry.previewText && (
              <p className="text-[9px] text-muted-foreground/60 line-clamp-1 px-1 leading-tight">
                {entry.previewText}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
