"use client";

/**
 * /living-chat — Phase C vertical-slice test page
 *
 * Standalone surface that exercises the full streaming agent pipeline:
 *   - POST /api/chat/stream (SSE)
 *   - ThinkingPanel rendering public-safe AgentEvents
 *   - ProviderModal "+ Add AI Provider"
 *   - Mode switcher (local / remote / hybrid)
 *   - Feedback controls (thumbs up/down/regenerate/more-natural/remember)
 *
 * Kept separate from the main ChatPage so the existing 61/61 browser
 * signoff suite continues to exercise the legacy chat path while this
 * page proves the new pipeline. E2E tests target this URL.
 */

import { useEffect, useState } from "react";
import { useAgentEventStream, type AgentEvent } from "../components/chat/useAgentEventStream";
import ThinkingPanel from "../components/chat/ThinkingPanel";
import ProviderModal from "../components/settings/ProviderModal";

type ChatMode = "local" | "remote" | "hybrid";

type Feedback = {
  signal: "up" | "down" | "regenerate" | "more_natural" | "remember_style";
  reason?: string;
};

const FEEDBACK_REASONS: Array<{ value: string; label: string }> = [
  { value: "robotic", label: "หุ่นยนต์เกินไป" },
  { value: "wrong_route", label: "เลือกเส้นทางผิด" },
  { value: "too_short", label: "สั้นเกินไป" },
  { value: "too_long", label: "ยาวเกินไป" },
  { value: "missing_tools", label: "ขาดเครื่องมือ" },
  { value: "not_grounded", label: "ไม่มีข้อมูลรองรับ" },
  { value: "confusing_language", label: "ภาษาวกวน" },
  { value: "other", label: "อื่นๆ" },
];

interface ChatTurn {
  user: string;
  assistant: string;
  events: AgentEvent[];
  status: "streaming" | "done" | "error";
  warnings: string[];
  feedback?: Feedback;
}

export default function LivingChatPage() {
  const [input, setInput] = useState(
    "ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง"
  );
  const [mode, setMode] = useState<ChatMode>("local");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [feedbackPickerFor, setFeedbackPickerFor] = useState<number | null>(null);
  const { state, send } = useAgentEventStream();

  // When the live stream finishes, freeze the latest turn
  useEffect(() => {
    if (state.status === "done" || state.status === "error") {
      setHistory((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.status !== "streaming") return prev;
        const collapsedStatus: ChatTurn["status"] =
          state.status === "error" ? "error" : "done";
        const updated: ChatTurn = {
          ...last,
          assistant: state.finalText || state.draftText,
          events: state.events,
          status: collapsedStatus,
          warnings: state.warnings,
        };
        return [...prev.slice(0, -1), updated];
      });
    }
  }, [state.status, state.finalText, state.draftText, state.events, state.warnings]);

  const sendQuery = async (text: string) => {
    if (!text.trim()) return;
    setHistory((prev) => [
      ...prev,
      {
        user: text,
        assistant: "",
        events: [],
        status: "streaming" as const,
        warnings: [],
      } satisfies ChatTurn,
    ]);
    await send({ message: text, preferredMode: mode });
  };

  const onSend = async () => {
    const text = input;
    setInput("");
    await sendQuery(text);
  };

  const onRegenerate = async (idx: number) => {
    const turn = history[idx];
    if (!turn) return;
    await sendQuery(turn.user);
  };

  const submitFeedback = (idx: number, signal: Feedback["signal"], reason?: string) => {
    setHistory((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, feedback: { signal, reason } } : t))
    );
    // POST /api/chat/feedback wiring is C-6.5; the vertical slice records
    // the signal locally so the E2E can assert avoid-canned-phrase logic.
  };

  const liveTurnIdx = history.length - 1;
  const liveTurn = history[liveTurnIdx];
  const isLiveStreaming = liveTurn && liveTurn.status === "streaming";
  const liveAssistantText = isLiveStreaming
    ? state.finalText || state.draftText
    : liveTurn?.assistant || "";
  const liveEvents = isLiveStreaming ? state.events : liveTurn?.events || [];
  const liveStatus = isLiveStreaming ? state.status : liveTurn?.status || "idle";
  const liveWarnings = isLiveStreaming ? state.warnings : liveTurn?.warnings || [];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">InnoMCP — Living Agent Chat</h1>
        <div className="flex items-center gap-2 text-sm">
          <select
            data-testid="mode-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as ChatMode)}
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="local">Local</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <button
            type="button"
            data-testid="open-provider-modal"
            onClick={() => setProviderModalOpen(true)}
            className="rounded border border-border px-2 py-1 text-sm hover:bg-muted"
          >
            + เพิ่มผู้ให้บริการ AI
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-4">
        {history.map((turn, idx) => {
          const isLive = idx === liveTurnIdx && isLiveStreaming;
          const text = isLive ? liveAssistantText : turn.assistant;
          const events = isLive ? liveEvents : turn.events;
          const status = isLive ? liveStatus : turn.status;
          const warnings = isLive ? liveWarnings : turn.warnings;
          return (
            <article key={idx} className="rounded border border-border/60 bg-card/60 p-3">
              <div className="text-sm text-muted-foreground" data-testid="user-message">
                <span className="font-medium text-foreground">คุณ:</span> {turn.user}
              </div>
              <div
                className="mt-2 whitespace-pre-wrap text-sm text-foreground"
                data-testid="assistant-message"
              >
                <span className="font-medium">Innova-bot:</span> {text || "..."}
              </div>
              <ThinkingPanel events={events} status={status as any} warnings={warnings} />
              {!isLive && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    data-testid="feedback-up"
                    onClick={() => submitFeedback(idx, "up")}
                    className={`rounded border border-border px-2 py-0.5 hover:bg-muted ${
                      turn.feedback?.signal === "up" ? "bg-emerald-500/10 text-emerald-700" : ""
                    }`}
                  >
                    👍 ดี
                  </button>
                  <button
                    type="button"
                    data-testid="feedback-down"
                    onClick={() => setFeedbackPickerFor(idx)}
                    className={`rounded border border-border px-2 py-0.5 hover:bg-muted ${
                      turn.feedback?.signal === "down" ? "bg-rose-500/10 text-rose-700" : ""
                    }`}
                  >
                    👎 ไม่ดี
                  </button>
                  <button
                    type="button"
                    data-testid="feedback-regenerate"
                    onClick={() => onRegenerate(idx)}
                    className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                  >
                    🔄 สร้างใหม่
                  </button>
                  <button
                    type="button"
                    data-testid="feedback-more-natural"
                    onClick={() => submitFeedback(idx, "more_natural")}
                    className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                  >
                    เป็นธรรมชาติขึ้น
                  </button>
                  <button
                    type="button"
                    data-testid="feedback-remember-style"
                    onClick={() => submitFeedback(idx, "remember_style")}
                    className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                  >
                    จำสไตล์นี้
                  </button>
                  {feedbackPickerFor === idx && (
                    <div
                      data-testid="feedback-reason-picker"
                      className="ml-2 flex flex-wrap items-center gap-1 rounded border border-border bg-card/80 px-2 py-1"
                    >
                      <span className="mr-1 text-muted-foreground">เหตุผล:</span>
                      {FEEDBACK_REASONS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          data-testid={`feedback-reason-${r.value}`}
                          onClick={() => {
                            submitFeedback(idx, "down", r.value);
                            setFeedbackPickerFor(null);
                          }}
                          className="rounded border border-border px-1.5 py-0.5 hover:bg-muted"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </main>

      <footer className="flex items-end gap-2">
        <textarea
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
          placeholder="พิมพ์คำถาม..."
        />
        <button
          type="button"
          data-testid="chat-send"
          onClick={onSend}
          disabled={state.status === "streaming"}
          className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          ส่ง
        </button>
      </footer>

      <ProviderModal
        open={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
      />
    </div>
  );
}
