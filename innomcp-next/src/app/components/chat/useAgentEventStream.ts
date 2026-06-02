"use client";

/**
 * useAgentEventStream — Phase C SSE consumer hook
 *
 * Opens a fetch-based SSE connection to /api/chat/stream, parses events
 * defensively (the stream is JSON-per-event), and surfaces:
 *   - events:    full ordered list of public-safe AgentEvent payloads
 *   - draftText: accumulated draft_delta text (the user-visible answer)
 *   - finalText: present once final_answer arrives
 *   - status:    idle | streaming | done | error
 *
 * Hard rule: any event whose payload contains a forbidden field name
 * (privateThought / hiddenReasoning / chainOfThought / rawThought /
 * innerMonologue) is dropped silently and surfaced as a one-line warning
 * in `warnings`. The backend already gates these, but we re-check on
 * the client so a malicious or buggy upstream cannot leak them into the
 * DOM.
 */

import { useCallback, useRef, useState } from "react";

export type AgentEventType =
  | "agent_run_started"
  | "route_selected"
  | "agent_started"
  | "agent_delta"
  | "agent_finished"
  | "tool_call_started"
  | "tool_call_finished"
  | "fact_found"
  | "draft_delta"
  | "critique"
  | "fallback"
  | "final_answer"
  | "follow_up_suggestions"
  | "feedback_saved"
  | "timing"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  runId: string;
  messageId: string;
  agentId?: string;
  role?: string;
  publicSummary: string;
  isSafeForUser: true;
  timestamp: string;
  confidence?: number;
  sourceIds?: string[];
  toolName?: string;
  provider?: string;
  model?: string;
  deltaText?: string;
  finalText?: string;
  fallbackReason?: string;
  totalMs?: number;
  latencyMs?: number;
  previewText?: string;
}

export type StreamStatus = "idle" | "streaming" | "done" | "error";

const FORBIDDEN_KEY_NAMES = [
  "privateThought",
  "hiddenReasoning",
  "chainOfThought",
  "rawThought",
  "innerMonologue",
  "secret",
  "apiKey",
  "password",
];

function rawHasForbiddenKey(raw: string): string | null {
  const lower = raw.toLowerCase();
  for (const k of FORBIDDEN_KEY_NAMES) {
    if (lower.includes(`"${k.toLowerCase()}":`)) return k;
  }
  return null;
}

export interface SendOptions {
  message: string;
  sessionId?: string;
  projectId?: string;
  preferredMode?: "local" | "remote" | "hybrid";
  preferredProviderId?: string;
  toolHint?: string;
  clientMessageId?: string;
  reasoningMode?: "normal" | "thinking";
}

export interface AgentStreamState {
  events: AgentEvent[];
  draftText: string;
  finalText: string;
  status: StreamStatus;
  warnings: string[];
  activeMessageId?: string;
  suggestions: string[];
}

const initialState: AgentStreamState = {
  events: [],
  draftText: "",
  finalText: "",
  status: "idle",
  warnings: [],
  activeMessageId: undefined,
  suggestions: [],
};

function parseSseChunk(buffer: string): { complete: string[]; remainder: string } {
  // Splits on the SSE message delimiter "\n\n". Each complete message
  // becomes its own raw blob. The remainder is the partial trailing
  // message that hasn't terminated yet.
  const parts = buffer.split(/\n\n/);
  const remainder = parts.pop() ?? "";
  return { complete: parts, remainder };
}

function extractDataLine(blob: string): string | null {
  // We only care about `data:` lines. Other lines (event:, : comment)
  // are ignored — we already get type from the JSON payload.
  const lines = blob.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

/**
 * Resolve the backend endpoint at call time so the same component works
 * whether the Next.js dev server is on a different port from the
 * Express backend. Order of preference:
 *   1. explicit `endpoint` argument
 *   2. NEXT_PUBLIC_BACKEND_URL env var (compiled in)
 *   3. window.location origin if same-port deployment
 *   4. localhost:3011 fallback for dev
 */
function resolveStreamUrl(explicit: string): string {
  if (explicit && /^https?:\/\//.test(explicit)) return explicit;
  const envUrl =
    typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_BACKEND_URL
      ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, "")
      : "";
  if (envUrl) return `${envUrl}${explicit.startsWith("/") ? "" : "/"}${explicit}`;
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    // Dev convention: Next.js on 3000, Express on 3011.
    if (hostname === "localhost" && port === "3000") {
      return `${protocol}//${hostname}:3011${explicit}`;
    }
    return `${protocol}//${window.location.host}${explicit}`;
  }
  return `http://localhost:3011${explicit}`;
}

export function useAgentEventStream(endpoint: string = "/api/chat/stream") {
  const [state, setState] = useState<AgentStreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState);
  }, []);

  const send = useCallback(
    async (opts: SendOptions) => {
      reset();
      const controller = new AbortController();
      abortRef.current = controller;
      const isCurrent = () => abortRef.current === controller;

      setState({
        events: [],
        draftText: "",
        finalText: "",
        status: "streaming",
        warnings: [],
        suggestions: [],
        activeMessageId: opts.clientMessageId,
      });

      const fullUrl = resolveStreamUrl(endpoint);
      let response: Response;
      try {
        response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: opts.message,
            sessionId: opts.sessionId,
            projectId: opts.projectId,
            preferredMode: opts.preferredMode,
            preferredProviderId: opts.preferredProviderId,
            toolHint: opts.toolHint,
            clientMessageId: opts.clientMessageId,
            reasoningMode: opts.reasoningMode,
          }),
          credentials: "include",
          signal: controller.signal,
        });
      } catch (err: any) {
        if (!isCurrent()) return;
        setState((s) => ({
          ...s,
          status: "error",
          warnings: [...s.warnings, `network: ${String(err?.message || err)}`],
        }));
        return;
      }

      if (!response.ok || !response.body) {
        if (!isCurrent()) return;
        setState((s) => ({
          ...s,
          status: "error",
          warnings: [...s.warnings, `http ${response.status}`],
        }));
        return;
      }

      if (!response.body) {
        setState((s) => ({ ...s, status: "error", warnings: [...s.warnings, "no response body"] }));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (!isCurrent()) return;
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const { complete, remainder } = parseSseChunk(buffer);
          buffer = remainder;

          for (const blob of complete) {
            const dataStr = extractDataLine(blob);
            if (!dataStr) continue;

            const forbidden = rawHasForbiddenKey(dataStr);
            if (forbidden) {
              setState((s) => ({
                ...s,
                warnings: [
                  ...s.warnings,
                  `dropped event with forbidden key: ${forbidden}`,
                ],
              }));
              continue;
            }

            let ev: AgentEvent | null = null;
            try {
              ev = JSON.parse(dataStr) as AgentEvent;
            } catch {
              continue;
            }
            if (!ev || ev.isSafeForUser !== true) continue;
            if (opts.clientMessageId && ev.messageId !== opts.clientMessageId) {
              setState((s) => ({
                ...s,
                warnings: [
                  ...s.warnings,
                  `dropped stale event for messageId: ${ev?.messageId || "unknown"}`,
                ],
              }));
              continue;
            }

            setState((s) => {
              const next: AgentStreamState = { ...s, events: [...s.events, ev!] };
              if (ev!.type === "draft_delta" && typeof ev!.deltaText === "string") {
                next.draftText = s.draftText + ev!.deltaText;
              }
              if (ev!.type === "final_answer" && typeof ev!.finalText === "string") {
                next.finalText = ev!.finalText;
                next.status = "done";
              }
              if (ev!.type === "follow_up_suggestions" && Array.isArray((ev as any).suggestions)) {
                next.suggestions = (ev as any).suggestions as string[];
              }
              if (ev!.type === "error") {
                next.status = "error";
              }
              return next;
            });
          }
        }
      } catch (err: any) {
        if (!isCurrent()) return;
        setState((s) => ({
          ...s,
          status: "error",
          warnings: [...s.warnings, `read: ${String(err?.message || err)}`],
        }));
      } finally {
        if (isCurrent()) {
          setState((s) => (s.status === "streaming" ? { ...s, status: "done" } : s));
          abortRef.current = null;
        }
      }
    },
    [endpoint, reset]
  );

  return { state, send, reset };
}
