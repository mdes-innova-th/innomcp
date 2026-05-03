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
  | "tool_call_started"
  | "tool_call_finished"
  | "fact_found"
  | "draft_delta"
  | "critique"
  | "fallback"
  | "final_answer"
  | "feedback_saved"
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
  preferredMode?: "local" | "remote" | "hybrid";
  preferredProviderId?: string;
}

export interface AgentStreamState {
  events: AgentEvent[];
  draftText: string;
  finalText: string;
  status: StreamStatus;
  warnings: string[];
}

const initialState: AgentStreamState = {
  events: [],
  draftText: "",
  finalText: "",
  status: "idle",
  warnings: [],
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

      setState({
        events: [],
        draftText: "",
        finalText: "",
        status: "streaming",
        warnings: [],
      });

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: opts.message,
            preferredMode: opts.preferredMode,
            preferredProviderId: opts.preferredProviderId,
          }),
          signal: controller.signal,
        });
      } catch (err: any) {
        setState((s) => ({
          ...s,
          status: "error",
          warnings: [...s.warnings, `network: ${String(err?.message || err)}`],
        }));
        return;
      }

      if (!response.ok || !response.body) {
        setState((s) => ({
          ...s,
          status: "error",
          warnings: [...s.warnings, `http ${response.status}`],
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
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

            setState((s) => {
              const next: AgentStreamState = { ...s, events: [...s.events, ev!] };
              if (ev!.type === "draft_delta" && typeof ev!.deltaText === "string") {
                next.draftText = s.draftText + ev!.deltaText;
              }
              if (ev!.type === "final_answer" && typeof ev!.finalText === "string") {
                next.finalText = ev!.finalText;
                next.status = "done";
              }
              if (ev!.type === "error") {
                next.status = "error";
              }
              return next;
            });
          }
        }
      } catch (err: any) {
        setState((s) => ({
          ...s,
          status: "error",
          warnings: [...s.warnings, `read: ${String(err?.message || err)}`],
        }));
      } finally {
        setState((s) => (s.status === "streaming" ? { ...s, status: "done" } : s));
        abortRef.current = null;
      }
    },
    [endpoint, reset]
  );

  return { state, send, reset };
}
