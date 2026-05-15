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
import AIModelSelector from "./AIModelSelector";
import ToolsTypeSelector, { type ToolType } from "./ToolsTypeSelector";

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
  onFocus?: () => void;
  onBlur?: () => void;
}

function DotsAnimation() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : "."));
    }, 300);
    return () => clearInterval(interval);
  }, []);
  return <span>{dots}</span>;
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
  onFocus,
  onBlur,
}) => {
  useEffect(() => {
    adjustTextarea();
    const handler = () => adjustTextarea();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [input, adjustTextarea]);

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

      <div className="group/composer relative rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-all duration-200 focus-within:border-primary/45 focus-within:shadow-[0_4px_18px_-4px_oklch(0.65_0.18_265/0.18)] focus-within:ring-1 focus-within:ring-primary/15">
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
                if (input.trim() && isSocketReady && !isWaitingForResponse) {
                  sendMessage();
                }
              }
            }}
            rows={1}
            placeholder="ถามเรื่องอากาศ วิเคราะห์ หรือสั่งงาน AI..."
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

          {/* Right-aligned: model selector + send */}
          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <AIModelSelector theme={theme} />

            <button
              onClick={isWaitingForResponse ? handleStop : sendMessage}
              disabled={!isSocketReady || (!isWaitingForResponse && !input.trim())}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm transition-colors ${
                isWaitingForResponse
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-primary hover:bg-primary/92"
              } disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/70 disabled:shadow-none`}
              data-testid="send-btn"
              title={
                isWaitingForResponse
                  ? "หยุดการตอบ"
                  : isSocketReady
                  ? "ส่งข้อความ (Enter)"
                  : "กำลังเชื่อมต่อ AI"
              }
            >
              {isWaitingForResponse ? (
                <>
                  <FontAwesomeIcon icon={faStop} />
                  <span>หยุด</span>
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
      </div>

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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default ChatInput;
