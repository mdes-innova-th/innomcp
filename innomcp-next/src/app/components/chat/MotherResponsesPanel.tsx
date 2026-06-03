"use client";
import React, { useState, useEffect, useCallback } from "react";

interface MotherRunProvider {
  providerId: string;
  providerName: string;
  latencyMs: number;
  success: boolean;
  preview: string;
  errorMsg?: string;
  quality?: number;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTalk, setShowTalk] = useState(false);
  const [talkMsg, setTalkMsg] = useState("");
  const [talkSending, setTalkSending] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<Array<{subject?: string; preview: string; isNew: boolean}>>([]);
  const [showInbox, setShowInbox] = useState(false);

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

  const sendToInnovaBot = useCallback(async () => {
    if (!talkMsg.trim()) return;
    setTalkSending(true);
    try {
      await fetch(resolveBackendUrl("/api/mother/talk-to-innova-bot"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: talkMsg.trim(), from: "innomcp-chat" }),
      });
      setTalkMsg("");
      setShowTalk(false);
    } catch { /* ignore */ }
    finally { setTalkSending(false); }
  }, [talkMsg]);

  const checkInbox = useCallback(() => {
    fetch(resolveBackendUrl("/api/mother/inbox?limit=5"), { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.messages) setInboxMessages(d.messages); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    checkInbox();
  }, [checkInbox]);

  const handleDownload = useCallback(() => {
    if (!run) return;
    const url = resolveBackendUrl(`/api/mother/export/${run.runId}/csv`);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mother-run-${run.runId}.csv`;
    a.click();
  }, [run]);

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
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            disabled={!run}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/40"
            title="Download as CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => setShowTalk(s => !s)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/40"
            title="Talk to innova-bot"
          >
            💬
          </button>
          <button
            onClick={() => { setShowInbox(s => !s); checkInbox(); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/40 relative"
            title="Check innova-bot replies"
          >
            📬{inboxMessages.filter(m => m.isNew).length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={fetchLatest}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/40"
          >
            {loading ? "…" : "↺"}
          </button>
        </div>
      </div>

      {showTalk && (
        <div className="flex gap-1.5 mt-1">
          <input
            type="text"
            value={talkMsg}
            onChange={e => setTalkMsg(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendToInnovaBot()}
            placeholder="Message to innova-bot…"
            className="flex-1 text-[11px] px-2 py-1 rounded border border-border/50 bg-muted/30 outline-none focus:border-primary/40"
          />
          <button
            onClick={sendToInnovaBot}
            disabled={talkSending || !talkMsg.trim()}
            className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 disabled:opacity-40"
          >
            {talkSending ? "…" : "Send"}
          </button>
        </div>
      )}

      {showInbox && (
        <div className="mt-2 rounded border border-border/40 bg-muted/20 p-2 space-y-1.5 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-semibold text-muted-foreground">Replies from innova-bot</p>
          {inboxMessages.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/60">No replies yet.</p>
          ) : inboxMessages.map((m, i) => (
            <div key={i} className={`text-[10px] p-1.5 rounded border ${m.isNew ? 'border-blue-400/30 bg-blue-400/5' : 'border-border/30'}`}>
              {m.subject && <p className="font-medium mb-0.5">{m.subject}</p>}
              <p className="text-muted-foreground/80 line-clamp-2">{m.preview}</p>
            </div>
          ))}
        </div>
      )}

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
                {(() => {
                  const len = p.preview.length;
                  const q = len === 0 ? 0 : len < 50 ? 20 : len < 200 ? 50 : len < 500 ? 75 : 90;
                  if (q === 0) return null;
                  return (
                    <span className={`text-[9px] px-1 rounded ml-1 ${
                      q >= 75 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      q >= 50 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                      Q{q}
                    </span>
                  );
                })()}
              </div>
              <p
                className={`text-[11px] leading-relaxed text-foreground/80 ${expandedId === p.providerId ? "" : "line-clamp-3"} cursor-pointer`}
                onClick={() => setExpandedId(prev => prev === p.providerId ? null : p.providerId)}
              >
                {p.preview}
              </p>
              {p.preview.length > 100 && (
                <button
                  onClick={() => setExpandedId(prev => prev === p.providerId ? null : p.providerId)}
                  className="text-[9px] text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
                >
                  {expandedId === p.providerId ? "▲ less" : "▼ more"}
                </button>
              )}
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
