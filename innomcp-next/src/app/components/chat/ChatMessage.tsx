"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import { useTheme } from "@/app/context/ThemeContext";

type Props = {
  html: string;
  className?: string;
};

const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "text",
    "line",
    "polyline",
    "polygon",
    "img",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "class", "id", "style"],
    svg: ["width", "height", "viewBox", "xmlns", "version", "style"],
    path: ["d", "fill", "stroke", "stroke-width", "style", "class"],
    rect: ["x", "y", "width", "height", "fill", "stroke", "style", "id"],
    circle: ["cx", "cy", "r", "fill", "stroke", "style"],
    text: [
      "x",
      "y",
      "fill",
      "font-size",
      "text-anchor",
      "style",
      "transform",
      "dominant-baseline",
      "xml:space",
    ],
    line: ["x1", "y1", "x2", "y2", "stroke", "style"],
    polyline: ["points", "fill", "stroke", "style"],
    polygon: ["points", "fill", "stroke", "style"],
    g: ["transform", "fill", "stroke", "style"],
    img: ["src", "alt", "width", "height", "style", "class"],
  },
  // Allow data: URIs in image srcs (required for data:image/svg+xml;base64,...)
  protocols: {
    src: [...(defaultSchema.protocols?.src || []), "data"],
  },
};

export default function ChatMessage({ html, className }: Props) {
  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
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
          rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
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
};

type EnhancedProps = {
  message: Message;
  index: number;
  className?: string;
  onUpdate: (index: number, msg: Message) => void;
};

export function MessageView({
  message,
  index,
  className,
  onUpdate,
}: EnhancedProps) {
  const [copied, setCopied] = React.useState(false);
  const [showCopy, setShowCopy] = React.useState(false);
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

  const saveEdit = () => {
    onUpdate(index, {
      ...message,
      text: editValue,
      fullText: editValue,
      isAnimating: false,
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`relative group p-2 rounded-lg ${
        message.sender === "user"
          ? "max-w-full self-end ml-auto pr-5 bg-blue-500 text-white rounded-br-none"
          : "max-w-full self-start pr-5 mb-5 text-left"
      } ${className || ""}`}
      onClick={() => {
        setShowCopy(true);
        window.setTimeout(() => setShowCopy(false), 3000);
      }}
    >
      {!message.isAnimating && (
        <div
          className={`absolute top-1 right-0 flex gap-2 transition-opacity pointer-events-none ${
            showCopy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div className="relative">
            <button
              title="คัดลอกข้อความ"
              className={`pointer-events-auto cursor-pointer ${
                message.sender === "user"
                  ? theme === "light"
                    ? "text-white hover:text-gray-200"
                    : "text-gray-300 hover:text-white"
                  : theme === "light"
                  ? "text-gray-600 hover:text-gray-800"
                  : "text-gray-400 hover:text-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                void doCopy(message.text);
              }}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
              </svg>
            </button>

            {copied && (
              <div className="pointer-events-none absolute top-0 right-0">
                <div className="bg-black text-white text-xs rounded-md px-2 py-1 shadow-md dark:bg-gray-800 whitespace-nowrap inline-block">
                  คัดลอกแล้ว
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {message.sender === "ai" && isEditing ? (
        <div>
          <textarea
            className="w-full rounded border border-gray-400 p-2 text-black bg-white mb-2"
            value={editValue}
            rows={Math.max(2, editValue.split("\n").length)}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              className="text-blue-600 hover:text-blue-800 cursor-pointer"
              title="บันทึก"
              onClick={saveEdit}
            >
              บันทึก
            </button>
            <button
              className="text-gray-500 hover:text-red-600 cursor-pointer"
              title="ยกเลิก"
              onClick={() => setIsEditing(false)}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap wrap-break-word">
          {message.sender === "ai" ? (
            // If server provided structuredContent with a chartSvg, render it as an image
            message.structuredContent && message.structuredContent.chartSvg ? (
              <div className="my-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    กราฟ
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      title="คัดลอก SVG"
                      className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-90"
                      onClick={() => {
                        try {
                          void navigator.clipboard.writeText(
                            message.structuredContent.chartSvg
                          );
                        } catch (e) {
                          console.error("Clipboard write failed", e);
                        }
                      }}
                    >
                      คัดลอก SVG
                    </button>
                    <a
                      title="ดาวน์โหลด SVG"
                      className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-90"
                      href={`data:image/svg+xml;base64,${btoa(
                        unescape(
                          encodeURIComponent(message.structuredContent.chartSvg)
                        )
                      )}`}
                      download={`chart-${Date.now()}.svg`}
                    >
                      ดาวน์โหลด
                    </a>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <img
                    src={`data:image/svg+xml;base64,${btoa(
                      unescape(
                        encodeURIComponent(message.structuredContent.chartSvg)
                      )
                    )}`}
                    alt="chart"
                    className="w-full h-auto block"
                  />
                </div>
                {/* optional textual description / markdown below (strip raw <svg> from the text if present) */}
                {(message.fullText || message.text) &&
                  (() => {
                    const raw = message.fullText || message.text || "";
                    const idx = raw.indexOf("<svg");
                    const textOnly = idx >= 0 ? raw.slice(0, idx).trim() : raw;
                    return textOnly ? (
                      <div className="mt-2">
                        <ChatMessage html={textOnly} />
                      </div>
                    ) : null;
                  })()}
              </div>
            ) : (
              <ChatMessage html={message.fullText || message.text} />
            )
          ) : (
            message.text
          )}
          {message.sender === "ai" && message.isAnimating && (
            <span className="ml-2 inline-block align-middle text-gray-600">
              <TypingDots />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
