"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface MDESCodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
}

// Escape HTML special characters
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Basic JavaScript/TypeScript highlighter
function highlightJSCode(line: string): string {
  const tokens: { type: string; value: string }[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    let match: RegExpExecArray | null;
    // Single-line comment
    match = /^\/\/.*/.exec(remaining);
    if (match) {
      tokens.push({ type: "comment", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Multi-line comment start handled later (this simple tokenizer may miss it, acceptable for demo)
    // String literals (single, double, backtick)
    match = /^(["'`])(?:\\.|[^\\])*?\1/.exec(remaining);
    if (match) {
      tokens.push({ type: "string", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Keywords
    match = /^(break|case|catch|continue|debugger|default|delete|do|else|finally|for|function|if|in|instanceof|new|return|switch|this|throw|try|typeof|var|void|while|with|class|const|enum|export|extends|import|super|implements|interface|let|package|private|protected|public|static|yield|async|await|of)\b/.exec(
      remaining
    );
    if (match) {
      tokens.push({ type: "keyword", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Numbers
    match = /^\d+(\.\d+)?/.exec(remaining);
    if (match) {
      tokens.push({ type: "number", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Any other character
    tokens.push({ type: "plain", value: remaining.charAt(0) });
    remaining = remaining.slice(1);
  }
  return tokens
    .map((t) => {
      if (t.type === "plain") return escapeHTML(t.value);
      return `<span class="token ${t.type}">${escapeHTML(t.value)}</span>`;
    })
    .join("");
}

// Basic Python highlighter
function highlightPythonCode(line: string): string {
  const tokens: { type: string; value: string }[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    let match: RegExpExecArray | null;
    // Comment
    match = /^#.*/.exec(remaining);
    if (match) {
      tokens.push({ type: "comment", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // String literals (single, double, triple not fully handled but basic)
    match = /^(["'])(?:\\.|[^\\])*?\1/.exec(remaining);
    if (match) {
      tokens.push({ type: "string", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Keywords
    match = /^(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/.exec(
      remaining
    );
    if (match) {
      tokens.push({ type: "keyword", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Numbers
    match = /^\d+(\.\d+)?/.exec(remaining);
    if (match) {
      tokens.push({ type: "number", value: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }
    // Any other character
    tokens.push({ type: "plain", value: remaining.charAt(0) });
    remaining = remaining.slice(1);
  }
  return tokens
    .map((t) => {
      if (t.type === "plain") return escapeHTML(t.value);
      return `<span class="token ${t.type}">${escapeHTML(t.value)}</span>`;
    })
    .join("");
}

export default function MDESCodeBlock({
  code,
  language,
  filename,
  showLineNumbers = false,
  maxHeight = 300,
}: MDESCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const preRef = useRef<HTMLDivElement>(null);

  // Copy button handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("ไม่สามารถคัดลอกโค้ดได้:", err);
    }
  }, [code]);

  // Run button handler (console stub / placeholder)
  const handleRun = () => {
    const lang = language?.toLowerCase() || "";
    if (lang === "javascript" || lang === "js" || lang === "typescript" || lang === "ts") {
      try {
        // Execute code and show result in an alert (console stub)
        // eslint-disable-next-line no-eval
        const result = eval(code);
        alert(`ผลลัพธ์: ${result}`);
      } catch (e: any) {
        alert(`ข้อผิดพลาด: ${e.message}`);
      }
    } else if (lang === "python" || lang === "py") {
      alert("การรัน Python ไม่รองรับบนเบราว์เซอร์ (placeholder)");
    }
  };

  // Highlight code into HTML with line spans
  const highlightedHtml = useMemo(() => {
    if (!code) return "";
    const lines = code.split("\n");
    const lang = language?.toLowerCase() || "";
    const highlightFn =
      lang === "javascript" || lang === "js" || lang === "typescript" || lang === "ts"
        ? highlightJSCode
        : lang === "python" || lang === "py"
        ? highlightPythonCode
        : (line: string) => escapeHTML(line); // no syntax highlights

    return lines
      .map((line) => `<span class="line">${highlightFn(line)}</span>`)
      .join("");
  }, [code, language]);

  // Check if content overflows the maxHeight container
  useEffect(() => {
    const el = preRef.current;
    if (el && maxHeight && !expanded) {
      const overflows = el.scrollHeight > el.clientHeight;
      setOverflowing(overflows);
    } else {
      setOverflowing(false);
    }
  }, [code, maxHeight, expanded]);

  // Show run button only for supported languages
  const showRunButton =
    language &&
    (["javascript", "js", "typescript", "ts", "python", "py"]
      .map((l) => l.toLowerCase())
      .includes(language.toLowerCase()));

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-900 text-gray-100 border border-gray-700 my-4">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-sm">
        <div className="flex items-center space-x-3">
          {language && (
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-gray-700 text-gray-300 uppercase">
              {language}
            </span>
          )}
          {filename && (
            <span className="text-gray-400 ml-1 truncate">{filename}</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-xs rounded hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={copied ? "คัดลอกแล้ว" : "คัดลอกโค้ด"}
          >
            {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
          </button>
          {showRunButton && (
            <button
              onClick={handleRun}
              className="px-2 py-1 text-xs rounded bg-green-700 hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="รันโค้ด"
            >
              รัน
            </button>
          )}
        </div>
      </div>

      {/* Code area with optional max height and fade */}
      <div
        ref={preRef}
        className={`relative ${expanded ? "" : "overflow-hidden"}`}
        style={{ maxHeight: expanded ? "none" : `${maxHeight}px` }}
      >
        <pre className="p-4 overflow-x-auto">
          <code
            style={{ counterReset: showLineNumbers ? "line" : "none" }}
            className={`font-mono text-sm ${
              showLineNumbers ? "code-with-lines" : ""
            }`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>

        {/* Fade out gradient when truncated */}
        {!expanded && overflowing && maxHeight > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand button */}
      {!expanded && overflowing && maxHeight > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2 text-center text-sm text-blue-400 hover:text-blue-300 bg-gray-800 border-t border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ดูเพิ่มเติม
        </button>
      )}

      {/* Styles for syntax highlighting and line numbers */}
      <style jsx>{`
        .line {
          display: block;
          position: relative;
          padding-left: ${showLineNumbers ? "3.5em" : "0"};
        }
        .code-with-lines .line::before {
          content: counter(line);
          counter-increment: line;
          position: absolute;
          left: 0;
          width: 2.5em;
          text-align: right;
          color: #6b7280; /* gray-500 */
          user-select: none;
        }
        .token.comment {
          color: #6a9955;
          font-style: italic;
        }
        .token.keyword {
          color: #569cd6;
        }
        .token.string {
          color: #ce9178;
        }
        .token.number {
          color: #b5cea8;
        }
        .token.operator {
          color: #d4d4d4;
        }
        .token.punctuation {
          color: #d4d4d4;
        }
        .token.function {
          color: #dcdcaa;
        }
        .token.plain {
          color: #d4d4d4;
        }
      `}</style>
    </div>
  );
}