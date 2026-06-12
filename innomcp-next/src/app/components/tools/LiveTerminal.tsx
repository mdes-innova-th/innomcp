"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface ApprovalRequiredPayload {
  command: string;
  riskLevel: string;
  reason?: string;
  approvalId?: string;
}

export interface LiveTerminalProps {
  command: string;
  /** If true, start streaming immediately on mount (default: false) */
  autoRun?: boolean;
  onComplete?: (exitCode: number) => void;
  /** Called when the shell API returns 403 approval_required instead of marking failed */
  onApprovalRequired?: (payload: ApprovalRequiredPayload) => void;
  /** Called by parent after approve-and-exec succeeds — resets terminal from awaiting_approval.
   *  Receives the approvalId so parent can match the correct pending entry. */
  onApprovalConfirmed?: (approvalId: string) => void;
}

type Status = "idle" | "running" | "completed" | "failed" | "awaiting_approval";

/** Strip ANSI escape sequences (colors, cursor movement, etc.) */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Resolve the backend base URL. In dev (Next on :3000) the API runs on :3011. */
function backendBase(): string {
  if (typeof window !== "undefined" && window.location.port === "3000") {
    return "http://localhost:3015";
  }
  return "";
}

export default function LiveTerminal({
  command,
  autoRun = false,
  onComplete,
  onApprovalRequired,
  onApprovalConfirmed,
}: LiveTerminalProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | undefined>();
  const [durationMs, setDurationMs] = useState<number | undefined>();
  // Stored approvalId from the 403 response — passed back to parent on Confirm
  const pendingApprovalIdRef = useRef<string | undefined>(undefined);

  const outputEndRef = useRef<HTMLDivElement>(null);
  // Track the in-flight fetch so we can abort on unmount or re-run
  const abortRef = useRef<AbortController | null>(null);

  /** Auto-scroll to bottom when output grows */
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [stdout, stderr]);

  const run = useCallback(async () => {
    // Abort any in-progress stream
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("running");
    setStdout("");
    setStderr("");
    setExitCode(undefined);
    setDurationMs(undefined);

    try {
      const res = await fetch(`${backendBase()}/api/shell/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      });

      if (res.status === 403) {
        let body: Record<string, unknown> = {};
        try { body = await res.json(); } catch { /* ignore parse error */ }
        if (body.error === "approval_required" || body.approval_required === true) {
          const aid = typeof body.approvalId === "string" ? body.approvalId : undefined;
          pendingApprovalIdRef.current = aid;
          setStatus("awaiting_approval");
          onApprovalRequired?.({
            command,
            riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "high",
            reason: typeof body.reason === "string" ? body.reason : undefined,
            approvalId: aid,
          });
          return;
        }
        // Non-approval 403 — fall through to generic error handling
        setStderr(`403 Forbidden`);
        setStatus("failed");
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        setStderr(text);
        setStatus("failed");
        return;
      }

      if (!res.body) {
        setStderr("No response body");
        setStatus("failed");
        return;
      }

      // Parse the SSE stream manually (EventSource only supports GET)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by "\n\n"
        const parts = buffer.split("\n\n");
        // Keep the last (possibly incomplete) chunk in the buffer
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventName = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (eventName === "stdout") {
            const chunk = typeof parsed.chunk === "string" ? stripAnsi(parsed.chunk) : "";
            setStdout((prev) => prev + chunk);
          } else if (eventName === "stderr") {
            const chunk = typeof parsed.chunk === "string" ? stripAnsi(parsed.chunk) : "";
            setStderr((prev) => prev + chunk);
          } else if (eventName === "exit") {
            const code = typeof parsed.exitCode === "number" ? parsed.exitCode : -1;
            const dur = typeof parsed.durationMs === "number" ? parsed.durationMs : undefined;
            setExitCode(code);
            setDurationMs(dur);
            setStatus(code === 0 ? "completed" : "failed");
            onComplete?.(code);
          } else if (eventName === "error") {
            const msg = typeof parsed.error === "string" ? parsed.error : "Unknown error";
            const reason = typeof parsed.reason === "string" ? ` — ${parsed.reason}` : "";
            setStderr(`${msg}${reason}`);
            setStatus("failed");
          }
        }
      }

      // If stream ended without an exit event (e.g. network cut), mark completed
      setStatus((prev) => (prev === "running" ? "completed" : prev));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User navigated away or component unmounted — silently ignore
        return;
      }
      setStderr(String(err));
      setStatus("failed");
    }
  }, [command, onComplete, onApprovalRequired]);

  // Auto-run on mount if requested
  useEffect(() => {
    if (autoRun) run();
    return () => {
      abortRef.current?.abort();
    };
    // Only trigger on mount (eslint-disable-next-line react-hooks/exhaustive-deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exitCodeBadge =
    exitCode !== undefined ? (
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
          exitCode === 0
            ? "bg-green-900/60 text-green-400"
            : "bg-red-900/60 text-red-400"
        }`}
      >
        code {exitCode}
      </span>
    ) : null;

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden font-mono text-[12px]">
      {/* Command bar */}
      <div className="flex items-center gap-2 bg-[#111111] px-3 py-2 border-b border-white/10">
        {status === "running" && (
          <span className="animate-pulse text-yellow-400 text-[10px]">●</span>
        )}
        {status === "completed" && (
          <span className="text-green-400 text-[10px]">●</span>
        )}
        {status === "failed" && (
          <span className="text-red-400 text-[10px]">●</span>
        )}
        {status === "awaiting_approval" && (
          <span className="animate-pulse text-amber-400 text-[10px]">●</span>
        )}
        {status === "idle" && (
          <span className="text-[#4b5563] text-[10px]">●</span>
        )}
        <span className="text-[#6b7280] select-none">$</span>
        <span className="text-[#9ca3af] flex-1 truncate">{command}</span>
        <div className="flex items-center gap-2 shrink-0">
          {durationMs !== undefined && (
            <span className="text-[10px] text-[#4b5563]">{durationMs}ms</span>
          )}
          {status === "awaiting_approval" && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-900/60 text-amber-400">
              Awaiting approval...
            </span>
          )}
          {exitCodeBadge}
          {status === "idle" && (
            <button
              onClick={run}
              className="rounded px-2 py-0.5 text-[10px] bg-[#1f2937] text-[#9ca3af] hover:bg-[#374151] transition-colors"
            >
              Run
            </button>
          )}
          {(status === "completed" || status === "failed") ? (
            <button
              onClick={run}
              className="rounded px-2 py-0.5 text-[10px] bg-[#1f2937] text-[#9ca3af] hover:bg-[#374151] transition-colors"
            >
              Re-run
            </button>
          ) : null}
          {status === "awaiting_approval" && onApprovalConfirmed ? (
            <button
              onClick={() => {
                setStatus("running");
                const aid = pendingApprovalIdRef.current;
                pendingApprovalIdRef.current = undefined;
                if (aid) onApprovalConfirmed(aid);
              }}
              className="rounded px-2 py-0.5 text-[10px] bg-amber-900/60 text-amber-300 hover:bg-amber-800/60 transition-colors"
            >
              Confirm
            </button>
          ) : null}
        </div>
      </div>

      {/* Output area */}
      <div className="bg-[#1a1a1a] max-h-96 overflow-y-auto">
        {stdout ? (
          <pre className="px-3 py-2 text-[#d4d4d4] whitespace-pre-wrap break-words leading-relaxed">
            {stdout}
          </pre>
        ) : status === "running" ? (
          <div className="px-3 py-2 text-[#4b5563] italic">รอผลลัพธ์…</div>
        ) : status === "awaiting_approval" ? (
          <div className="px-3 py-2 text-amber-500/80 italic">รอการอนุมัติก่อนดำเนินการ…</div>
        ) : status === "idle" ? (
          <div className="px-3 py-2 text-[#4b5563] italic">กด Run เพื่อเริ่ม</div>
        ) : null}

        {stderr && (
          <pre className="px-3 py-2 text-[#f87171] whitespace-pre-wrap break-words leading-relaxed border-t border-white/5">
            {stderr}
          </pre>
        )}

        {/* Anchor for auto-scroll */}
        <div ref={outputEndRef} />
      </div>
    </div>
  );
}
