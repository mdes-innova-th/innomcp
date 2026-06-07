"use client";
import React, { useState, useMemo } from "react";
import DOMPurify from "dompurify";

export interface Artifact {
  id: string;
  name: string;
  type: "markdown" | "code" | "json" | "csv" | "html" | "text" | "chart";
  content: string;
  language?: string; // for code artifacts
  createdAt: number;
  taskId?: string;
}

interface Props {
  artifacts: Artifact[];
  onClose?: () => void;
}

/** Relative time string in Thai for artifact age display. */
function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "เมื่อกี้";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

/** Parse YAML frontmatter and extract source_url value, or return null. */
function extractSourceUrl(content: string): string | null {
  // Frontmatter must start at the very first line
  if (!content.startsWith("---")) return null;
  const secondDash = content.indexOf("\n---", 3);
  if (secondDash === -1) return null;
  const block = content.slice(3, secondDash);
  const match = block.match(/^source_url:\s*(.+)$/m);
  if (!match) return null;
  const url = match[1].trim();
  return url.length > 0 ? url : null;
}

function MarkdownPreview({ content }: { content: string }) {
  // Simple Markdown → HTML conversion — sanitized via DOMPurify to prevent XSS
  const rawHtml = content
    .replace(/^### (.+)$/gm, '<h3 class="text-[13px] font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-[14px] font-semibold mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-[15px] font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted/60 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-[12.5px]">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-[12.5px]">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2 text-[12.5px] leading-relaxed">')
    .replace(/\n/g, '<br/>');
  // DOMPurify sanitizes the regex-generated HTML, stripping any injected <script> or event handlers
  const safeHtml = DOMPurify.sanitize(`<p class="mb-2">${rawHtml}</p>`, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'code', 'li', 'br'],
    ALLOWED_ATTR: ['class'],
  });
  return (
    <div
      className="prose prose-sm break-thai-words max-w-none p-3 text-foreground text-[12.5px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

function CodePreview({ content, language }: { content: string; language?: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-[11.5px] font-mono leading-relaxed text-foreground/90 break-thai-words">
      <code>{content}</code>
    </pre>
  );
}

export default function ArtifactPanel({ artifacts, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(artifacts[0]?.id ?? null);
  const [tab, setTab] = useState<"preview" | "raw" | "download">("preview");

  const current = artifacts.find(a => a.id === selected);

  const sourceUrl = useMemo(
    () =>
      current?.type === "markdown" ? extractSourceUrl(current.content) : null,
    [current]
  );

  const handleDownload = () => {
    if (!current) return;
    const ext = {
      markdown: "md",
      code: current.language ?? "txt",
      json: "json",
      csv: "csv",
      html: "html",
      text: "txt",
      chart: "svg",
    }[current.type] ?? "txt";
    const blob = new Blob([current.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current.name}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <span className="text-2xl">📄</span>
        <p className="text-[12.5px]">ยังไม่มี artifact</p>
        <p className="text-[11px]">เมื่อ agent สร้างไฟล์หรือรายงาน จะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] font-semibold text-foreground">Artifacts ({artifacts.length})</p>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground"
            aria-label="ปิด artifact panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* Artifact list */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {artifacts.map(a => (
          <button
            key={a.id}
            onClick={() => { setSelected(a.id); setTab("preview"); }}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
              selected === a.id
                ? "border-primary/40 bg-primary/8 text-foreground"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>
              {a.type === "markdown"
                ? "📝"
                : a.type === "code"
                ? "💻"
                : a.type === "json"
                ? "🔧"
                : a.type === "csv"
                ? "📊"
                : a.type === "chart"
                ? "📈"
                : "📄"}
            </span>
            <span className="max-w-[120px] truncate">{a.name}</span>
          </button>
        ))}
      </div>

      {current && (
        <>
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-border/40 pb-1">
            <div className="flex gap-0.5">
              {(["preview", "raw", "download"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 text-[11px] transition-colors ${
                    tab === t
                      ? "border-b-2 border-primary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "preview" ? "Preview" : t === "raw" ? "Raw" : "⬇ Download"}
                </button>
              ))}
            </div>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10.5px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer pr-1"
              >
                🔗 Source
              </a>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-border/30 bg-background/40">
            {tab === "preview" && (
              current.type === "markdown" ? (
                <MarkdownPreview content={current.content} />
              ) : current.type === "code" ? (
                <CodePreview content={current.content} language={current.language} />
              ) : current.type === "chart" ? (
                <div
                  className="overflow-x-auto p-3 break-thai-words"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(current.content, { USE_PROFILES: { svg: true } }) }}
                />
              ) : (
                <pre className="p-3 text-[11.5px] font-mono text-foreground/80 whitespace-pre-wrap break-thai-words">
                  {current.content}
                </pre>
              )
            )}
            {tab === "raw" && (
              <pre className="p-3 text-[11.5px] font-mono text-foreground/80 whitespace-pre-wrap break-thai-words">
                {current.content}
              </pre>
            )}
            {tab === "download" && (
              <div className="flex flex-col items-center gap-3 p-6">
                <span className="text-3xl">📥</span>
                <p className="text-[12.5px] font-medium">{current.name}</p>
                <p className="text-[11px] text-muted-foreground">{current.content.length} characters</p>
                <button
                  onClick={handleDownload}
                  className="rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
                >
                  ดาวน์โหลดไฟล์
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
