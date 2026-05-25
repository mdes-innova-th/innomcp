"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faPaperclip,
  faStop,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
// Phase 10.68 — AIModelSelector + ThinkingModeToggle merged into ChatModeSelector
import ChatModeSelector, { type ChatMode } from "./ChatModeSelector";
import ToolsTypeSelector, { type ToolType } from "./ToolsTypeSelector";
import type { Artifact } from "./ArtifactPanel";

// Phase 3 CSV — backend base URL
const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

interface CsvMeta {
  name: string;
  rowCount: number;
  colCount: number;
  content: string;
}

// Provider mode stored in localStorage so it survives page refreshes.
export type ProviderMode = "remote" | "local";
const PROVIDER_MODE_KEY = "innomcp.provider.mode";

function readProviderMode(): ProviderMode {
  if (typeof window === "undefined") return "remote";
  return (localStorage.getItem(PROVIDER_MODE_KEY) as ProviderMode) ?? "remote";
}

function saveProviderMode(mode: ProviderMode): void {
  if (typeof window !== "undefined") localStorage.setItem(PROVIDER_MODE_KEY, mode);
}

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  selectedImage: string | null;
  setSelectedImage: (value: string | null) => void;
  selectedFile: File | null;
  setSelectedFile: (value: File | null) => void;
  handleNewChat: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  sendMessage: () => void;
  handleStop: () => void;
  isSocketReady: boolean;
  isWaitingForResponse: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  adjustTextarea: () => void;
  theme: string;
  layoutMode?: "empty" | "conversation";
  onToolTypeChange?: (type: ToolType) => void;
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  providerMode?: ProviderMode;
  onProviderModeChange?: (mode: ProviderMode) => void;
  /** Phase 3 CSV — called after /api/analyze succeeds so parent can add to ArtifactPanel */
  onAddArtifact?: (artifact: Artifact) => void;
  /** Phase 3 CSV — set a prefix string that sendMessage in parent will prepend to user text */
  setCsvPrefix?: (val: string) => void;
}

function DotsAnimation() {
  // Phase 10.47 — render as three CSS-animated dots so the cursor doesn't
  // flicker and the reflow-cost is zero. Pure CSS bouncy stagger.
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 align-middle" aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0s]" />
      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:140ms]" />
      <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:280ms]" />
    </span>
  );
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  selectedImage,
  setSelectedImage: _setSelectedImage,
  selectedFile,
  setSelectedFile: _setSelectedFile,
  handleNewChat,
  handleFileUpload,
  handleRemoveImage,
  sendMessage,
  handleStop,
  isSocketReady,
  isWaitingForResponse,
  textareaRef,
  fileInputRef,
  adjustTextarea,
  theme,
  layoutMode: _layoutMode = "conversation",
  onToolTypeChange,
  chatMode = "normal",
  onChatModeChange,
  onFocus,
  onBlur,
  providerMode: providerModeProp,
  onProviderModeChange,
  onAddArtifact,
  setCsvPrefix,
}) => {
  // Provider mode — read from localStorage on first render; sync back on toggle
  const [providerMode, setProviderMode] = useState<ProviderMode>(() => providerModeProp ?? "remote");
  useEffect(() => {
    const stored = readProviderMode();
    setProviderMode(stored);
    onProviderModeChange?.(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleProviderMode() {
    const next: ProviderMode = providerMode === "remote" ? "local" : "remote";
    setProviderMode(next);
    saveProviderMode(next);
    onProviderModeChange?.(next);
  }

  // Draft persistence
  const DRAFT_KEY = "innomcp-chat-draft";
  const [draftSaved, setDraftSaved] = useState(false);

  // Load saved draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved && saved.trim() && !input) {
      setInput(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save draft on change (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim()) {
        localStorage.setItem(DRAFT_KEY, input);
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      } else {
        localStorage.removeItem(DRAFT_KEY);
        setDraftSaved(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input]);

  // Phase 3 CSV state
  const [csvMeta, setCsvMeta] = useState<CsvMeta | null>(null);
  const [csvAnalyzing, setCsvAnalyzing] = useState(false);
  // Phase 3 drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  // Clear CSV badge when parent removes the file attachment
  useEffect(() => {
    if (!selectedFile) setCsvMeta(null);
  }, [selectedFile]);

  // Intercept file input change: also parse CSV meta
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleFileUpload(event);
    if (file && /\.csv$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const text = reader.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        const rowCount = Math.max(0, lines.length - 1); // exclude header
        const colCount = lines[0] ? lines[0].split(",").length : 0;
        setCsvMeta({ name: file.name, rowCount, colCount, content: text });
      };
      reader.readAsText(file);
    }
  };

  // Send handler: POST CSV to /api/analyze, emit artifact, set prefix, then call sendMessage
  const handleSendWithCsv = async () => {
    if (csvMeta) {
      setCsvAnalyzing(true);
      try {
        const res = await fetch(`${BACKEND}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: csvMeta.content }),
        });
        if (res.ok) {
          const data = await res.json();
          const artifact: Artifact = {
            id: Date.now().toString(),
            name: csvMeta.name.replace(/\.csv$/i, ""),
            type: "chart",
            content: data.chartSvg ?? "",
            createdAt: Date.now(),
          };
          onAddArtifact?.(artifact);
        }
      } catch {
        // silent — still send the message
      } finally {
        setCsvAnalyzing(false);
      }
      setCsvPrefix?.(
        `[Attached: ${csvMeta.name} — ${csvMeta.rowCount} rows, ${csvMeta.colCount} cols]`
      );
      setCsvMeta(null);
    }
    sendMessage();
    localStorage.removeItem(DRAFT_KEY);
  };

  useEffect(() => {
    adjustTextarea();
    const handler = () => adjustTextarea();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [input, adjustTextarea]);

  // Phase 10.38 — rotate the textarea placeholder when empty + unfocused so the
  // canvas feels "alive". Cycles every 4 s; pauses while user is typing.
  const PLACEHOLDER_ROTATION = React.useMemo(() => ([
    "ถามเรื่องอากาศ วิเคราะห์ หรือสั่งงาน AI…",
    "สรุปไฟล์ PDF / Word / Excel ที่แนบ…",
    "สร้างกราฟ ตาราง หรือเอกสาร DOCX/PDF…",
    "วาดรูป AI: 'นักบินอวกาศกลางทุ่งนาไทย'…",
    "ค่าเงิน USD→บาท หรือข่าวล่าสุด RSS…",
    "พิมพ์ ? เพื่อดูคีย์ลัด",
  ]), []);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    if (input.length > 0) return; // pause while typing
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_ROTATION.length);
    }, 4000);
    return () => clearInterval(id);
  }, [input.length, PLACEHOLDER_ROTATION.length]);
  const rotatingPlaceholder = PLACEHOLDER_ROTATION[placeholderIndex];

  const hasAttachment = Boolean(selectedFile);
  // Character counter — only surface when the input is non-trivial.
  // 4000 is a comfortable soft-ceiling; warn at 80% and tint at 95%.
  const CHAR_LIMIT = 4000;
  const charCount = input.length;
  const showCharCounter = charCount >= 600;
  const charPct = charCount / CHAR_LIMIT;
  const counterTone =
    charPct >= 0.95
      ? "text-rose-500 dark:text-rose-300"
      : charPct >= 0.8
      ? "text-amber-600 dark:text-amber-300"
      : "text-muted-foreground/85";

  // Detect audio attachments so we can hint the user about Whisper STT.
  const isAudioAttachment =
    selectedFile?.type?.startsWith("audio/") ||
    /\.(mp3|wav|m4a|ogg|webm|flac|mpga)$/i.test(selectedFile?.name || "");
  const attachmentSizeLabel = selectedFile
    ? selectedFile.size >= 1024 * 1024
      ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
      : `${(selectedFile.size / 1024).toFixed(0)} KB`
    : null;

  // Connection state — kept compact (req 3: status visible but not space-hungry)
  const stateDot = isWaitingForResponse
    ? "bg-amber-500"
    : isSocketReady
    ? "bg-emerald-500"
    : "bg-rose-500";
  const stateLabel = isWaitingForResponse
    ? "กำลังประมวลผล"
    : isSocketReady
    ? "พร้อมใช้งาน"
    : "กำลังเชื่อมต่อ";

  return (
    <div className="mx-auto w-full max-w-[64rem]">
      {hasAttachment && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 shadow-sm">
          {selectedImage ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/60">
              <Image
                src={selectedImage}
                alt="preview"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground">
              <FontAwesomeIcon icon={faPaperclip} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium leading-tight text-foreground">
              {selectedFile?.name ?? "ไฟล์ที่แนบ"}
            </div>
            {attachmentSizeLabel && (
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {attachmentSizeLabel}
              </div>
            )}
          </div>

          <button
            onClick={handleRemoveImage}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="ลบไฟล์แนบ"
            aria-label="ลบไฟล์แนบ"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      )}

      {/* Audio attachment hint — Whisper STT will auto-transcribe on send. */}
      {hasAttachment && isAudioAttachment && (
        <div
          data-testid="audio-attach-hint"
          className="mb-2 flex items-center gap-2 rounded-md border border-sky-500/25 bg-sky-50/70 px-3 py-1.5 text-[12px] text-sky-900 dark:bg-sky-950/30 dark:text-sky-100"
        >
          <span aria-hidden="true">🎙</span>
          <span>ตรวจพบไฟล์เสียง — ระบบจะถอดเสียงเป็นข้อความ (Whisper) เมื่อกดส่ง</span>
        </div>
      )}

      {/* Phase 3 CSV badge — shows parsed row/col counts after file pick */}
      {csvMeta && (
        <div
          data-testid="csv-badge"
          className="mb-2 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-50/70 px-3 py-1.5 text-[12px] text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          <span aria-hidden="true">📊</span>
          <span>
            {csvMeta.name} — {csvMeta.rowCount} rows, {csvMeta.colCount} cols
            {csvAnalyzing && <span className="ml-1 opacity-70">กำลังวิเคราะห์…</span>}
          </span>
        </div>
      )}

      <div
        className="group/composer relative rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-all duration-200 focus-within:border-primary/45 focus-within:shadow-[0_4px_18px_-4px_oklch(0.65_0.18_265/0.18)] focus-within:ring-1 focus-within:ring-primary/15"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileChange({ target: { files: e.dataTransfer.files } } as any);
        }}
      >
        {/* Phase 3 drag-and-drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/[0.05] backdrop-blur-sm">
            <div className="text-center">
              <span className="text-2xl block">📎</span>
              <p className="text-[12px] text-primary font-medium mt-1">วางไฟล์ที่นี่</p>
              <p className="text-[10.5px] text-muted-foreground">รองรับ CSV, JSON, รูปภาพ, PDF</p>
            </div>
          </div>
        )}
        {/* Phase 10.26 — focus-glow halo */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-focus-within/composer:opacity-100"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--primary) 6%, transparent), transparent 60%)",
          }}
        />
        {/* Textarea — autosizes via adjustTextarea, capped at max-h-60 */}
        <div className="px-3.5 pt-3 sm:px-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                if ((input.trim() || csvMeta) && isSocketReady && !isWaitingForResponse) {
                  handleSendWithCsv();
                }
              }
            }}
            rows={1}
            placeholder={rotatingPlaceholder}
            className="block max-h-60 w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-7 text-foreground placeholder:text-muted-foreground/65 focus:outline-none sm:text-base"
            data-testid="chat-input"
          />
        </div>

        {/* Single-row toolbar on desktop; wraps on mobile */}
        <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5 pt-2 sm:px-3">
          <ToolsTypeSelector
            onNewChat={handleNewChat}
            onToolTypeChange={onToolTypeChange}
            theme={theme}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            title="แนบไฟล์"
            aria-label="แนบไฟล์"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/8"
          >
            <FontAwesomeIcon icon={faPaperclip} className="text-muted-foreground" />
            <span className="hidden sm:inline">แนบไฟล์</span>
          </button>

          {/* Connection state — single dot+label, hidden on very small viewports */}
          <span
            title={
              isSocketReady
                ? "ระบบพร้อมส่งคำสั่ง"
                : "กำลังเชื่อมต่อระบบตอบกลับ"
            }
            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium text-muted-foreground sm:inline-flex"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stateDot}`} aria-hidden="true" />
            {stateLabel}
          </span>

          {/* Right-aligned: provider badge + model selector + send */}
          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {/* Provider mode badge — MDES Cloud vs Ollama Local */}
            <button
              type="button"
              onClick={toggleProviderMode}
              disabled={isWaitingForResponse}
              title={
                providerMode === "remote"
                  ? "ใช้ MDES Cloud Ollama — คลิกเพื่อเปลี่ยนเป็น Local"
                  : "ใช้ Ollama Local (localhost:11434) — คลิกเพื่อเปลี่ยนเป็น MDES Cloud"
              }
              data-testid="provider-mode-toggle"
              className={`hidden h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex ${
                providerMode === "local"
                  ? "border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/16"
                  : "border-sky-500/40 bg-sky-500/8 text-sky-800 dark:text-sky-200 hover:bg-sky-500/14"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  providerMode === "local" ? "bg-amber-500" : "bg-sky-500"
                }`}
                aria-hidden="true"
              />
              <span>{providerMode === "local" ? "Ollama Local" : "MDES Cloud"}</span>
            </button>

            <ChatModeSelector
              mode={chatMode}
              onChange={(m) => onChatModeChange?.(m)}
              disabled={isWaitingForResponse}
            />

            <button
              onClick={isWaitingForResponse ? handleStop : handleSendWithCsv}
              disabled={!isSocketReady || (!isWaitingForResponse && !input.trim() && !csvMeta)}
              className={`relative inline-flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-md px-3.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
                isWaitingForResponse
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-primary hover:bg-primary/92"
              } disabled:cursor-not-allowed disabled:scale-100 disabled:bg-muted disabled:text-muted-foreground/70 disabled:shadow-none`}
              data-testid="send-btn"
              title={
                isWaitingForResponse
                  ? "หยุดการตอบ (Esc)"
                  : isSocketReady
                  ? "ส่งข้อความ (Enter)"
                  : "กำลังเชื่อมต่อ AI"
              }
              aria-label={isWaitingForResponse ? "หยุดการตอบของ AI" : "ส่งข้อความ"}
            >
              {/* Phase 10.41 — animated halo only while waiting so the user
                  knows the stop button is "armed" and clickable. */}
              {isWaitingForResponse && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-white/15 to-transparent agent-shimmer-active"
                  style={{ ['--agent-accent' as any]: '#fff' }}
                />
              )}
              {isWaitingForResponse ? (
                <>
                  <FontAwesomeIcon icon={faStop} className="relative" />
                  <span className="relative">หยุด</span>
                </>
              ) : isSocketReady ? (
                <>
                  <span>ส่ง</span>
                  <FontAwesomeIcon icon={faArrowUp} />
                </>
              ) : (
                <span>
                  เชื่อมต่อ
                  <DotsAnimation />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Draft saved indicator */}
        {draftSaved && (
          <span className="text-[10px] text-muted-foreground/50 absolute bottom-1 right-2 pointer-events-none select-none">
            📝 ดราฟท์บันทึกแล้ว
          </span>
        )}
      </div>

      {/* Phase 3 drag-and-drop hint — shown only when input is empty and no file attached */}
      {!hasAttachment && !isDragging && input.length === 0 && (
        <p className="text-[10px] text-muted-foreground/40 text-center mt-0.5">
          ลากไฟล์มาวางได้เลย
        </p>
      )}

      {/* Helper line — keys on left, character counter on right when relevant.
          Phase 10.36 — kbds upgraded with a faint inner bevel + tight gap so the
          row reads as a single hint strip rather than three separate phrases. */}
      <div className="mt-1.5 hidden items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground/85 sm:flex">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <kbd className="inline-flex h-4 min-w-[26px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
              ↵
            </kbd>
            <span className="text-muted-foreground/85">ส่ง</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="inline-flex h-4 min-w-[34px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
              ⇧
            </kbd>
            <span aria-hidden="true" className="opacity-60">+</span>
            <kbd className="inline-flex h-4 min-w-[26px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
              ↵
            </kbd>
            <span className="text-muted-foreground/85">ขึ้นบรรทัดใหม่</span>
          </span>
          <span className="hidden items-center gap-1 md:inline-flex">
            <kbd className="inline-flex h-4 min-w-[20px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
              ?
            </kbd>
            <span className="text-muted-foreground/85">คีย์ลัด</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {charCount > 0 && (
            <span className="text-[10.5px] text-muted-foreground/50 tabular-nums">
              {(() => { const t = Math.round(charCount / 4); return t > 1000 ? `~${(t/1000).toFixed(1)}k` : `~${t}`; })()} tokens
            </span>
          )}
          {showCharCounter && (
            <span
              data-testid="char-counter"
              className={`font-mono tabular-nums ${counterTone}`}
              title={`${charCount.toLocaleString()} / ${CHAR_LIMIT.toLocaleString()} อักขระ`}
            >
              {charCount.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.json,image/*,application/pdf,audio/*"
        className="hidden"
      />
    </div>
  );
};

export default ChatInput;
