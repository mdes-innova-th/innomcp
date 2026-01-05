"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useTheme } from "@/app/context/ThemeContext";

type Props = {
  html: string;
  className?: string;
  structuredContent?: any;
};

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "class"], // Allow class attributes on all elements for styling; do NOT allow inline `style` to reduce XSS risk
  },
};

export default function ChatMessage({
  html,
  className,
  structuredContent,
}: Props) {
  const [copiedChart, setCopiedChart] = React.useState(false);
  const { theme } = useTheme();

  const handleCopyChartCode = async () => {
    try {
      if (structuredContent?.chartSvg) {
        await navigator.clipboard.writeText(structuredContent.chartSvg);
        setCopiedChart(true);
        setTimeout(() => setCopiedChart(false), 1500);
      }
    } catch (err) {
      console.error("Failed to copy chart code:", err);
    }
  };

  const handleDownloadChart = () => {
    if (structuredContent?.chartSvg) {
      const element = document.createElement("a");
      const file = new Blob([structuredContent.chartSvg], {
        type: "image/svg+xml",
      });
      element.href = URL.createObjectURL(file);
      element.download = `chart-${Date.now()}.svg`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
    }
  };

  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
        {/* Display SVG chart if available */}
        {structuredContent?.chartSvg && (
          <div className="mb-4">
            <div className="flex justify-center mb-2">
              <div
                className="relative inline-flex"
                dangerouslySetInnerHTML={{ __html: structuredContent.chartSvg }}
              />
            </div>
            <div className="flex justify-center gap-2">
              <button
                onClick={handleCopyChartCode}
                title="คัดลอก SVG Code"
                className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-all ${
                  copiedChart
                    ? theme === "dark"
                      ? "bg-green-600 text-white"
                      : "bg-green-500 text-white"
                    : theme === "dark"
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
                {copiedChart ? "คัดลอกแล้ว" : "คัดลอก SVG"}
              </button>
              <button
                onClick={handleDownloadChart}
                title="ดาวน์โหลด SVG"
                className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-all ${
                  theme === "dark"
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                ดาวน์โหลด
              </button>
            </div>
          </div>
        )}
        {/*
            Render markdown to React elements. We enable remark-gfm for GitHub Flavored Markdown.
            IMPORTANT: We DO NOT enable `rehype-raw` (do not parse raw HTML inside markdown)
            to avoid the risk of executing or injecting unsafe HTML. Any HTML-like text will
            be rendered as literal text. We still include `rehype-sanitize` for defense-in-depth
            if other rehype plugins are used, and to ensure nodes are safe should you enable
            additional rehype processing later.
          */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, schema]]}
          components={{
            h1: ({ children }) => (
              <h1
                className={`text-2xl font-bold mb-4 ${
                  useTheme().theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                className={`text-lg font-bold mb-3 ${
                  useTheme().theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                className={`text-lg font-bold mb-2 ${
                  useTheme().theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4
                className={`text-lg font-bold mb-2 ${
                  useTheme().theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h4>
            ),
            h5: ({ children }) => (
              <h5
                className={`text-lg font-bold mb-1 ${
                  useTheme().theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h5>
            ),
            h6: ({ children }) => (
              <h6
                className={`text-base font-bold mb-1 ${
                  useTheme().theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h6>
            ),
            table: ({ children }) => (
              <table className="border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                {children}
              </td>
            ),
          }}
        >
          {html}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// Enhanced chat message renderer used by ChatPage when passing message objects.
export type Message = {
  sender: "user" | "ai";
  text: string;
  fullText?: string;
  isAnimating?: boolean;
  structuredContent?: any;
  timestamp?: number; // Unix timestamp
  tokenCount?: number; // Number of tokens
  responseTime?: number; // Response time in ms
};

type EnhancedProps = {
  message: Message;
  index: number;
  className?: string;
  onUpdate: (index: number, msg: Message) => void;
  onDelete?: (index: number) => void;
  onRetry?: (index: number) => void;
};

export function MessageView({
  message,
  index,
  className,
  onUpdate,
  onDelete,
  onRetry,
}: EnhancedProps) {
  const [copied, setCopied] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const { theme } = useTheme();

  React.useEffect(() => {
    return () => {
      // cleanup timers if any (none stored here)
    };
  }, []);

  const doCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const TypingDots: React.FC = () => (
    <span className="inline-flex items-center gap-1">
      <span
        className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-bounce"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-bounce"
        style={{ animationDelay: "0.08s" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-bounce"
        style={{ animationDelay: "0.16s" }}
      />
    </span>
  );

  const startEdit = () => {
    setEditValue(message.text);
    setIsEditing(true);
  };

  const saveEdit = () => {
    onUpdate(index, {
      ...message,
      text: editValue,
      fullText: editValue,
      isAnimating: false,
      timestamp: Date.now(),
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && confirm("ต้องการลบข้อความนี้?")) {
      onDelete(index);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(index);
    }
  };

  return (
    <div
      className={`relative group p-3 rounded-lg ${
        message.sender === "user"
          ? "max-w-full self-end ml-auto pr-5 bg-blue-500 text-white rounded-br-none"
          : "max-w-full self-start pr-5 mb-5 text-left"
      } ${className || ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      data-testid={message.sender === "user" ? "message-user" : "message-assistant"}
    >
      {/* Action buttons */}
      {!message.isAnimating && (
        <div
          className={`absolute top-1 right-1 flex gap-1 transition-opacity ${
            showActions ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Copy button */}
          <div className="relative">
            <button
              title="คัดลอกข้อความ"
              className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                message.sender === "user"
                  ? "text-white hover:bg-blue-600"
                  : theme === "light"
                  ? "text-gray-600"
                  : "text-gray-400"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                void doCopy(message.text);
              }}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            {copied && (
              <div className="absolute -top-8 right-0 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                คัดลอกแล้ว
              </div>
            )}
          </div>

          {/* Edit button (user messages only) */}
          {message.sender === "user" && (
            <button
              title="แก้ไขข้อความ"
              className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                message.sender === "user"
                  ? "text-white hover:bg-blue-600"
                  : theme === "light"
                  ? "text-gray-600"
                  : "text-gray-400"
              }`}
              onClick={startEdit}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          )}

          {/* Retry button (AI messages only) */}
          {message.sender === "ai" && onRetry && (
            <button
              title="ลองใหม่"
              className={`p-1 rounded ${
                theme === "light"
                  ? "text-gray-600 hover:bg-gray-200"
                  : "text-gray-400 hover:bg-gray-700"
              }`}
              onClick={handleRetry}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          )}

          {/* Delete button */}
          {onDelete && (
            <button
              title="ลบข้อความ"
              className={`p-1 rounded ${
                message.sender === "user"
                  ? "text-white hover:bg-red-600"
                  : theme === "light"
                  ? "text-gray-600 hover:bg-red-100"
                  : "text-gray-400 hover:bg-red-900"
              }`}
              onClick={handleDelete}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Edit mode */}
      {isEditing ? (
        <div>
          <textarea
            className="w-full rounded border border-gray-400 p-2 text-black dark:text-white bg-white dark:bg-gray-800 mb-2"
            value={editValue}
            rows={Math.max(2, editValue.split("\n").length)}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={saveEdit}
            >
              บันทึก
            </button>
            <button
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              onClick={() => setIsEditing(false)}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Message content */}
          <div className="whitespace-pre-wrap wrap-break-word">
            {message.sender === "ai" ? (
              <ChatMessage
                html={message.fullText || message.text}
                structuredContent={message.structuredContent}
              />
            ) : (
              message.text
            )}
            {message.sender === "ai" && message.isAnimating && (
              <span className="ml-2 inline-block align-middle text-gray-600">
                <TypingDots />
              </span>
            )}
          </div>

          {/* Metadata footer */}
          <div
            className={`mt-2 pt-2 border-t flex flex-wrap gap-3 text-xs ${
              message.sender === "user"
                ? "border-blue-400 text-blue-100"
                : theme === "light"
                ? "border-gray-200 text-gray-500"
                : "border-gray-700 text-gray-400"
            }`}
          >
            {/* Timestamp */}
            {message.timestamp && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                {formatTimestamp(message.timestamp)}
              </span>
            )}

            {/* Token count (AI messages only) */}
            {message.sender === "ai" && message.tokenCount && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                {message.tokenCount} tokens
              </span>
            )}

            {/* Response time (AI messages only) */}
            {message.sender === "ai" && message.responseTime && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                {formatResponseTime(message.responseTime)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
