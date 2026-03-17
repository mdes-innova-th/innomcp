"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useTheme } from "@/app/context/ThemeContext";
import { useAuth } from "@/app/context/AuthContext";
import ToolTypeBadge from "./ToolTypeBadge";
import EvidenceDashboard from "./EvidenceDashboard";

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
  const rawMapTiles = Array.isArray(structuredContent?.weatherPayload?.mapTiles)
    ? structuredContent.weatherPayload.mapTiles
    : [];
  const hasProvinceMissingError = Array.isArray(structuredContent?.weatherPipeline)
    ? structuredContent.weatherPipeline.some((item: any) => String(item?.error || "") === "PROVINCE_MISSING")
    : false;
  // Filter tiles: exclude fallback/no-area tiles and bare default.svg URLs without area context
  const mapTiles = rawMapTiles.filter((tile: any) => {
    const area = String(tile?.area || "").trim();
    const url = String(tile?.url || "").trim();
    if (!area || area === "ไม่ระบุพื้นที่" || area === "ประเทศไทย") return false;
    // Exclude bare /weather-tiles/default.svg with no area query parameter
    if (url === "/weather-tiles/default.svg") return false;
    return true;
  });

  // Placeholder strings emitted by backend when a field has no real data
  const PLACEHOLDER_STRINGS = new Set([
    "ยังไม่มีข้อมูล", "ยังไม่มี", "—", "-", "N/A", "n/a", "null", "undefined", "",
  ]);
  const isPlaceholder = (v: any): boolean => {
    const s = String(v ?? "").trim();
    return PLACEHOLDER_STRINGS.has(s) || s.startsWith("ยังไม่");
  };

  // Returns true only when the weather payload contains actual retrieved data,
  // not just a generated placeholder. Guards against showing the map section
  // when all upstream tools returned errors (TMD_AUTH_FAIL, NWP_UNAVAILABLE, etc.).
  const hasRealWeatherData = (payload: any): boolean => {
    if (!payload || typeof payload !== "object") return false;

    // Fast-fail: if ALL errTaxonomy buckets > 0 and no sources used, no real data
    const tax = payload.errTaxonomy;
    if (tax && typeof tax === "object") {
      const errTotal = (tax.timeout || 0) + (tax.noData || 0) + (tax.upstream || 0);
      const topSrc = Array.isArray(payload.sourcesUsed) ? payload.sourcesUsed.length : 0;
      if (errTotal > 0 && topSrc === 0) return false;
    }

    // Top-level sourcesUsed: any entry means at least one tool returned real data
    const topSources = Array.isArray(payload.sourcesUsed) ? payload.sourcesUsed : [];
    if (topSources.length > 0) return true;

    const areas = Array.isArray(payload.areas) ? payload.areas : [];
    // Exclude fallback-only areas ("ไม่ระบุพื้นที่" / "ประเทศไทย" without sources)
    const realAreas = areas.filter((a: any) => {
      const name = String(a?.area || "").trim();
      return name && name !== "ไม่ระบุพื้นที่";
    });

    // Area-level sourcesUsed
    if (realAreas.some((a: any) => Array.isArray(a?.sourcesUsed) && a.sourcesUsed.length > 0)) return true;
    // Area has a numeric rainChancePct — only set when real forecast data exists
    if (realAreas.some((a: any) => typeof a?.rainChancePct === "number")) return true;
    // Area has a real temperature value (not a placeholder)
    if (realAreas.some((a: any) => !isPlaceholder(a?.temperature))) return true;
    // Area has a real wind value (not a placeholder)
    if (realAreas.some((a: any) => !isPlaceholder(a?.wind))) return true;

    return false;
  };

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
        {/* Evidence Dashboard (structuredContent-only) */}
        <EvidenceDashboard structuredContent={structuredContent} />

        {/* Display NASA APOD Image if available */}
        {structuredContent?.url && structuredContent?.media_type === 'image' && (
          <div className="mb-4">
            <div className="relative rounded-lg overflow-hidden">
              <img 
                src={structuredContent.hdurl || structuredContent.url} 
                alt={structuredContent.title || 'NASA APOD Image'} 
                className="w-full h-auto"
                loading="lazy"
              />
              {structuredContent.title && (
                <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t ${
                  theme === 'dark' 
                    ? 'from-black/80 to-transparent' 
                    : 'from-white/90 to-transparent'
                }`}>
                  <p className="font-semibold text-sm">{structuredContent.title}</p>
                  {structuredContent.copyright && (
                    <p className="text-xs opacity-80">© {structuredContent.copyright}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-center gap-2 mt-2">
              <a
                href={structuredContent.hdurl || structuredContent.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-all ${
                  theme === "dark"
                    ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                เปิดภาพขนาดเต็ม
              </a>
            </div>
          </div>
        )}

        {/* Weather unavailable notice: shown when weather was attempted but no real data */}
        {structuredContent?.weatherPayload && !hasProvinceMissingError &&
          (mapTiles.length === 0 || !hasRealWeatherData(structuredContent?.weatherPayload)) && (() => {
          const tax = structuredContent.weatherPayload?.errTaxonomy;
          const errTotal = tax ? (tax.timeout || 0) + (tax.noData || 0) + (tax.upstream || 0) : 0;
          const sources = Array.isArray(structuredContent.weatherPayload?.sourcesUsed)
            ? structuredContent.weatherPayload.sourcesUsed : [];
          if (errTotal === 0 && sources.length === 0) return null; // not a weather query
          let reason: string;
          if (sources.length > 0) {
            reason = "ข้อมูลอากาศที่ได้รับยังไม่ครบถ้วนสำหรับการแสดงแผนที่";
          } else if (tax?.upstream > 0) {
            reason = "ข้อมูลอากาศจริงไม่พร้อมใช้งาน — TMD/NWP ตอบกลับผิดปกติ (อาจเกิดจาก credentials หรือ API key ไม่ถูกต้อง)";
          } else if (tax?.timeout > 0) {
            reason = "การเชื่อมต่อ TMD/NWP ใช้เวลานานเกินไป — ลองถามใหม่อีกครั้ง";
          } else if (tax?.noData > 0) {
            reason = "ไม่พบข้อมูลอากาศสำหรับพื้นที่ที่ต้องการ (สถานีไม่มีข้อมูล)";
          } else {
            reason = "ขณะนี้ไม่สามารถดึงข้อมูลอากาศจาก TMD/NWP ได้ (อาจเกิดจาก credentials หรือ mode=offline)";
          }
          return (
            <div className="mb-3 rounded-lg border border-yellow-400/30 bg-yellow-50/30 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-400/20 dark:bg-yellow-900/10 dark:text-yellow-300">
              ⚠️ {reason}
            </div>
          );
        })()}

        {/* Weather map tiles (Phase 10.1B minimal contract renderer) */}
        {!hasProvinceMissingError && mapTiles.length > 0 && hasRealWeatherData(structuredContent?.weatherPayload) && (
          <div data-testid="weather-map-tiles" className="mb-4 rounded-lg border border-green-500/20 bg-green-50/30 p-3 dark:border-green-400/20 dark:bg-green-900/10">
            <div className="mb-2 text-sm font-semibold text-green-800 dark:text-green-200">แผนที่สภาพอากาศ</div>
            <div className="space-y-3">
              {mapTiles.slice(0, 3).map((tile: any, idx: number) => {
                const url = String(tile?.url || "").trim();
                const label = String(tile?.label || tile?.area || "แผนที่อากาศ").trim();
                if (!url) return null;
                return (
                  <div key={`${url}-${idx}`} className="overflow-hidden rounded-md border border-green-500/20 dark:border-green-400/20">
                    <img src={url} alt={label} className="h-auto w-full" loading="lazy" />
                    <div className="px-2 py-1 text-xs text-gray-700 dark:text-gray-200">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
  toolsUsed?: string[]; // List of tools used by AI
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
  const [showMoreActions, setShowMoreActions] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [isReading, setIsReading] = React.useState(false);
  const [likeStatus, setLikeStatus] = React.useState<"none" | "like" | "dislike">("none");
  const [showReportModal, setShowReportModal] = React.useState(false);
  const { theme } = useTheme();
  const { isGuestMode } = useAuth();

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

  const handleBranchChat = () => {
    // Copy conversation up to this message into new chat
    const confirmed = confirm("สร้างการสนทนาใหม่จากข้อความนี้?");
    if (confirmed) {
      // Store messages in localStorage for new chat
      const messagesUpToHere = JSON.parse(localStorage.getItem("chatMessages") || "[]").slice(0, index + 1);
      localStorage.setItem("branchMessages", JSON.stringify(messagesUpToHere));
      // Reload page to start new chat with branched messages
      window.location.href = "/";
    }
  };

  const handleReadAloud = () => {
    if (isReading) {
      // Stop reading
      window.speechSynthesis.cancel();
      setIsReading(false);
    } else {
      // Start reading
      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.lang = "th-TH"; // Thai language
      utterance.rate = 0.9;
      utterance.onend = () => setIsReading(false);
      window.speechSynthesis.speak(utterance);
      setIsReading(true);
    }
  };

  // TODO #42: Handle report message with multi-checkbox modal
  const handleReportMessage = async (categories: string[]) => {
    if (categories.length === 0) return;
    
    try {
      await fetch("/api/chat/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIndex: index,
          messageText: message.text,
          categories,
          timestamp: Date.now(),
        }),
      });
      setShowReportModal(false);
      alert("ขอบคุณสำหรับการรายงาน เราจะตรวจสอบและดำเนินการต่อไป");
    } catch (error) {
      console.error("Report failed:", error);
      alert("เกิดข้อผิดพลาดในการรายงาน กรุณาลองใหม่อีกครั้ง");
    }
  };

  // TODO #43: Handle like/dislike feedback
  const handleLike = async () => {
    const newStatus = likeStatus === "like" ? "none" : "like";
    setLikeStatus(newStatus);
    
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIndex: index,
          messageText: message.text,
          feedback: newStatus,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error("Like feedback failed:", error);
    }
  };

  const handleDislike = async () => {
    const newStatus = likeStatus === "dislike" ? "none" : "dislike";
    setLikeStatus(newStatus);
    
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIndex: index,
          messageText: message.text,
          feedback: newStatus,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error("Dislike feedback failed:", error);
    }
  };

  const chatMeta = (message as any)?.structuredContent?.chatMeta;
  const modeBadge = chatMeta?.mode === "online" ? "online" : "offline";
  const metaTools = Array.isArray(chatMeta?.toolsUsed) ? chatMeta.toolsUsed : [];
  const metaConfidence = Number(chatMeta?.confidence);
  const confidenceLabel = Number.isFinite(metaConfidence) ? metaConfidence.toFixed(2) : "-";
  const reasonCode = String(chatMeta?.reason_code || "");
  const guidance = Array.isArray(chatMeta?.userGuidance) ? chatMeta.userGuidance.slice(0, 2) : [];

  return (
    <div
      className={`relative group p-3 rounded-lg ${
        message.sender === "user"
          ? "max-w-full self-end ml-auto pr-5 bg-blue-500 text-white rounded-br-none"
          : "max-w-full self-start pr-5 mb-5 text-left border border-white/10 dark:border-gray-700 rounded-lg"
      } ${className || ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      data-testid={message.sender === "user" ? "message-user" : "message-assistant"}
    >
      {/* Action buttons - moved to bottom-right */}
      {!message.isAnimating && (
        <div
          className={`absolute bottom-1 right-1 flex gap-1 transition-opacity ${
            showActions ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Like/Dislike buttons (AI messages only) - TODO #43 */}
          {message.sender === "ai" && (
            <>
              <button
                title="ถูกใจ"
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  likeStatus === "like"
                    ? "text-green-500"
                    : theme === "light"
                    ? "text-gray-600"
                    : "text-gray-400"
                }`}
                onClick={handleLike}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill={likeStatus === "like" ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
              </button>
              <button
                title="ไม่ถูกใจ"
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  likeStatus === "dislike"
                    ? "text-red-500"
                    : theme === "light"
                    ? "text-gray-600"
                    : "text-gray-400"
                }`}
                onClick={handleDislike}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill={likeStatus === "dislike" ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                </svg>
              </button>
            </>
          )}

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

          {/* Try Again button (AI messages only) */}
          {message.sender === "ai" && onRetry && (
            <button
              title="เริ่มใหม่อีกครั้ง"
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

          {/* More Actions button (AI messages only) */}
          {message.sender === "ai" && (
            <div className="relative">
              <button
                title="More Actions"
                className={`p-1 rounded ${
                  theme === "light"
                    ? "text-gray-600 hover:bg-gray-200"
                    : "text-gray-400 hover:bg-gray-700"
                }`}
                onClick={() => setShowMoreActions(!showMoreActions)}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
              {showMoreActions && (
                <div
                  className={`absolute right-0 mt-2 w-56 rounded-lg shadow-lg z-10 ${
                    theme === "light"
                      ? "bg-white border border-gray-200"
                      : "bg-gray-800 border border-gray-700"
                  }`}
                >
                  <button
                    onClick={() => {
                      handleBranchChat();
                      setShowMoreActions(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${
                      theme === "light"
                        ? "hover:bg-gray-100 text-gray-700"
                        : "hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                    </svg>
                    Branch in new chat
                  </button>
                  <button
                    onClick={() => {
                      handleReadAloud();
                      setShowMoreActions(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${
                      theme === "light"
                        ? "hover:bg-gray-100 text-gray-700"
                        : "hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                    {isReading ? "Stop reading" : "Read aloud"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReportModal(true);
                      setShowMoreActions(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm rounded-b-lg ${
                      theme === "light"
                        ? "hover:bg-red-50 text-red-600"
                        : "hover:bg-red-900/20 text-red-400"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    Report message
                  </button>
                </div>
              )}
            </div>
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
          {/* Tool Type Badge - Only show in auto mode with tools used */}
          {message.sender === "ai" && !isGuestMode && message.toolsUsed && message.toolsUsed.length > 0 && (
            <ToolTypeBadge 
              toolType="auto"
              toolsUsed={message.toolsUsed}
              theme={theme}
            />
          )}
          
          {/* Tool badges for authenticated users only */}
          {message.sender === "ai" && !isGuestMode && message.structuredContent?.toolsUsed && (
            <div className="flex flex-wrap gap-1 mb-2">
              {message.structuredContent.toolsUsed.map((tool: string, idx: number) => (
                <span
                  key={idx}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    theme === "light"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-blue-900/30 text-blue-400"
                  }`}
                >
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                  {tool}
                </span>
              ))}
            </div>
          )}
          
          {message.sender === "ai" && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded px-2 py-0.5 font-semibold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                MODE {modeBadge}
              </span>
              <span className="text-gray-500 dark:text-gray-400">Used tools: {metaTools.length > 0 ? metaTools.map((t: any) => String(t?.name || "")).filter(Boolean).join(", ") : "none"}</span>
              <span className="text-gray-500 dark:text-gray-400">Confidence: {confidenceLabel}</span>
              {reasonCode ? <span className="text-gray-400">{reasonCode}</span> : null}
            </div>
          )}

          {message.sender === "ai" && guidance.length > 0 && (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
              {guidance.map((g: string, idx: number) => (
                <div key={idx}>- {g}</div>
              ))}
            </div>
          )}

          {/* Message content */}
          <div className="whitespace-pre-wrap wrap-break-word">
            {/* Progress indicator - แสดงขณะรอ AI พร้อมกรอบและ font เล็ก */}
            {(message as any).isProgress && (
              <div className={`
                flex items-center gap-2 animate-pulse
                px-3 py-2 rounded-lg border
                ${theme === 'light' 
                  ? 'border-gray-300 bg-gray-50 text-gray-600' 
                  : 'border-gray-700 bg-gray-800/50 text-gray-400'
                }
              `}>
                <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                  <path d="M4 12a8 8 0 018-8" strokeLinecap="round" opacity="0.75"></path>
                </svg>
                <span className="text-sm">{message.text}</span>
                {(message as any).elapsedTime && (
                  <span className="text-xs opacity-70">({(message as any).elapsedTime}วินาที)</span>
                )}
              </div>
            )}
            
            {/* Normal message content */}
            {!(message as any).isProgress && (
              <>
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
              </>
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

      {/* TODO #42: Report Modal */}
      {showReportModal && <ReportModal onClose={() => setShowReportModal(false)} onSubmit={handleReportMessage} theme={theme} />}
    </div>
  );
}

// TODO #42: Report Modal Component
const ReportModal: React.FC<{
  onClose: () => void;
  onSubmit: (categories: string[]) => void;
  theme: string;
}> = ({ onClose, onSubmit, theme }) => {
  const [selectedCategories, setSelectedCategories] = React.useState<Set<string>>(new Set());

  const categories = [
    { id: "violence", label: "ความรุนแรงหรือการทำร้ายตนเอง" },
    { id: "sexual", label: "การแสวงหาประโยชน์ทางเพศ" },
    { id: "child-abuse", label: "การล่วงละเมิดเด็ก" },
    { id: "bullying", label: "การกลั่นแกล้งหรือคุกคาม" },
    { id: "spam", label: "สแปมหรือการหลอกลวง" },
    { id: "privacy", label: "การละเมิดความเป็นส่วนตัว" },
    { id: "ip", label: "การละเมิดทรัพย์สินทางปัญญา" },
    { id: "age-inappropriate", label: "เนื้อหาไม่เหมาะสมกับเด็ก" },
    { id: "other", label: "อื่นๆ" },
  ];

  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategories(newSet);
  };

  const handleSubmit = () => {
    if (selectedCategories.size === 0) {
      alert("กรุณาเลือกอย่างน้อย 1 หมวดหมู่");
      return;
    }
    onSubmit(Array.from(selectedCategories));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${
          theme === "light" ? "bg-white text-gray-900" : "bg-gray-800 text-gray-100"
        } rounded-lg shadow-2xl p-6 w-full max-w-md m-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">รายงานข้อความ</h2>
        <p className={`mb-4 text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}>
          เลือกหมวดหมู่ที่เหมาะสมกับเหตุผลในการรายงาน (เลือกได้หลายรายการ):
        </p>

        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${
                selectedCategories.has(cat.id)
                  ? theme === "light"
                    ? "bg-blue-50 border border-blue-500"
                    : "bg-blue-900/30 border border-blue-500"
                  : theme === "light"
                  ? "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                  : "bg-gray-700/50 border border-gray-600 hover:bg-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedCategories.has(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="w-5 h-5 rounded accent-blue-500"
              />
              <span>{cat.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded transition-colors ${
              theme === "light"
                ? "bg-gray-200 hover:bg-gray-300 text-gray-800"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedCategories.size === 0}
            className={`px-4 py-2 rounded transition-colors ${
              selectedCategories.size === 0
                ? "bg-gray-400 cursor-not-allowed text-gray-600"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            ส่งรายงาน
          </button>
        </div>
      </div>
    </div>
  );
};
