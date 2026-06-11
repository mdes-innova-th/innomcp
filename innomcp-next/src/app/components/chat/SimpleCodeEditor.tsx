"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface SimpleCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  filename?: string;
  readOnly?: boolean;
  maxHeight?: number;
  className?: string;
}

export default function SimpleCodeEditor({
  value,
  onChange,
  language = "plaintext",
  filename,
  readOnly = false,
  maxHeight,
  className = "",
}: SimpleCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const lines = value.split("\n");
  const lineCount = lines.length || 1;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const spaces = "  ";

        const newValue =
          value.substring(0, start) + spaces + value.substring(end);

        onChange(newValue);

        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = start + spaces.length;
          textarea.selectionEnd = start + spaces.length;
        });
      }
    },
    [value, onChange]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Copy failed silently
      }
      document.body.removeChild(textarea);
    }
  }, [value]);

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Update line numbers scroll position when value changes externally
  useEffect(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, [value]);

  const languageLabel =
    language === "typescript"
      ? "TypeScript"
      : language === "javascript"
        ? "JavaScript"
        : language === "json"
          ? "JSON"
          : language === "html"
            ? "HTML"
            : language === "css"
              ? "CSS"
              : language === "python"
                ? "Python"
                : language === "markdown" || language === "md"
                  ? "Markdown"
                  : language === "plaintext"
                    ? "ข้อความ"
                    : language.toUpperCase();

  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden border border-gray-700 bg-gray-900 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {filename && (
            <span className="text-sm text-gray-300 truncate font-mono">
              {filename}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600 shrink-0">
            {languageLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={copied}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors shrink-0
            bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500
            border border-gray-600 disabled:opacity-70 disabled:cursor-default"
          title="คัดลอกโค้ด"
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>คัดลอกแล้ว</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                />
              </svg>
              <span>คัดลอก</span>
            </>
          )}
        </button>
      </div>

      {/* Editor body */}
      <div
        className="flex overflow-hidden"
        style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
      >
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="overflow-hidden shrink-0 bg-gray-850 py-3 select-none"
          style={{ backgroundColor: "#1a1d23" }}
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i + 1}
              className="text-right pr-3 pl-2 leading-[1.625] text-xs text-gray-500 font-mono"
              style={{ fontSize: "13px", lineHeight: "1.625" }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            readOnly={readOnly}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="w-full h-full resize-none bg-gray-900 text-gray-100 font-mono leading-[1.625] p-3 pl-2 outline-none
              border-0 focus:ring-0 focus:outline-none
              placeholder-gray-600
              scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900
              disabled:opacity-100 disabled:cursor-text"
            style={{
              fontSize: "13px",
              lineHeight: "1.625",
              tabSize: 2,
              MozTabSize: 2,
              whiteSpace: "pre",
              overflowWrap: "normal",
              overflowX: "auto",
              minHeight: maxHeight
                ? `${maxHeight}px`
                : `${Math.max(lineCount * 1.625 * 13 + 24, 120)}px`,
            }}
            aria-label={
              filename ? `โค้ด ${filename}` : "โปรแกรมแก้ไขโค้ด"
            }
            wrap="off"
          />
        </div>
      </div>
    </div>
  );
}