"use client";

import { useState } from "react";
import { useAgentEventStream, type AgentEvent } from "./useAgentEventStream";
import ThinkingPanel from "./ThinkingPanel";

const SEMINAR_SEED = "ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง";

type ChatMode = "local" | "remote" | "hybrid";

export default function ThinkingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [input, setInput] = useState(SEMINAR_SEED);
  const [mode, setMode] = useState<ChatMode>("local");
  const [history, setHistory] = useState<Array<{
    user: string;
    assistant: string;
    events: AgentEvent[];
    status: "streaming" | "done" | "error";
  }>>([]);
  const { state, send } = useAgentEventStream("/api/chat/stream");

  const sendQuery = async (text: string) => {
    if (!text.trim()) return;
    setHistory((prev) => [
      ...prev,
      {
        user: text,
        assistant: "",
        events: [],
        status: "streaming" as const,
      },
    ]);
    await send({ message: text, preferredMode: mode });
  };

  // Sync streaming state to latest turn
  const liveTurnIdx = history.length - 1;
  const liveTurn = history[liveTurnIdx];
  const isStreaming = liveTurn && liveTurn.status === "streaming";
  const liveText = isStreaming ? state.finalText || state.draftText : liveTurn?.assistant || "";
  const liveEvents = isStreaming ? state.events : liveTurn?.events || [];
  const liveStatus = isStreaming ? state.status : liveTurn?.status || "idle";

  // Update history when stream completes
  if (isStreaming && (state.status === "done" || state.status === "error")) {
    const updated = [...history];
    updated[liveTurnIdx] = {
      ...liveTurn,
      assistant: state.finalText || state.draftText,
      events: state.events,
      status: state.status === "error" ? "error" : "done",
    };
    setHistory(updated);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thinking-modal-title"
        className="flex h-full w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="thinking-modal-title" className="text-sm font-semibold text-foreground">
            🧠 Thinking Mode — Agent Planning
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ✕ Close
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <label className="text-xs text-muted-foreground">Mode:</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ChatMode)}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="local">Local</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto space-y-2 p-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <p>เริ่มต้นการสนทนา — ระบบจะแสดงขั้นตอนคิดของตัวแทน AI</p>
            </div>
          ) : (
            history.map((turn, idx) => (
              <div key={idx} className="space-y-1">
                <div className="rounded bg-muted/50 px-2 py-1 text-xs">
                  <span className="font-medium text-foreground">You:</span>{" "}
                  <span className="text-muted-foreground">{turn.user}</span>
                </div>
                <div className="rounded bg-card px-2 py-1 text-xs text-foreground">
                  <span className="font-medium">AI:</span> {liveText.slice(0, 200) || "..."}
                </div>
                {(liveEvents.length > 0 || turn.events.length > 0) && (
                  <ThinkingPanel
                    events={idx === liveTurnIdx ? liveEvents : turn.events}
                    status={idx === liveTurnIdx ? liveStatus : turn.status}
                    warnings={[]}
                    compact
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  sendQuery(input);
                  setInput("");
                }
              }}
            />
            <button
              onClick={() => {
                if (input.trim()) {
                  sendQuery(input);
                  setInput("");
                }
              }}
              disabled={state.status === "streaming"}
              className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
