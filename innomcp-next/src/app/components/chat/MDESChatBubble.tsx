"use client";

import React from "react";

export interface MDESChatBubbleProps {
  role: "user" | "ai" | "system";
  content: string;
  timestamp?: number;
  model?: string;
  agentId?: string;
  isStreaming?: boolean;
  isComplete?: boolean;
  elapsedMs?: number;
  followUpSuggestions?: string[];
  onSuggestionClick?: (s: string) => void;
  onRetry?: () => void;
  onCopy?: () => void;
  onFeedback?: (rating: "good" | "bad") => void;
  className?: string;
}

export default function MDESChatBubble({
  role,
  content,
  timestamp,
  model,
  agentId,
  isStreaming = false,
  isComplete,
  elapsedMs,
  followUpSuggestions,
  onSuggestionClick,
  onRetry,
  onCopy,
  onFeedback,
  className,
}: MDESChatBubbleProps) {
  const formatElapsed = (ms: number): string => {
    if (ms < 1000) return `${ms} มิลลิวินาที`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} วินาที`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins} นาที ${secs} วินาที`;
  };

  const formatTimestamp = (ts: number): string => {
    return new Intl.DateTimeFormat("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(ts);
  };

  // Determine bubble alignment and styling
  const isUser = role === "user";
  const isAi = role === "ai";
  const isSystem = role === "system";

  const alignmentClass = isUser
    ? "justify-end"
    : isSystem
    ? "justify-center"
    : "justify-start";

  const bubbleAnimation = isUser
    ? "animate-slide-in-right"
    : isAi
    ? "animate-slide-in-left"
    : "animate-slide-in-down";

  const bubbleBaseClass = isUser
    ? "bg-indigo-600 text-white rounded-3xl rounded-br-sm"
    : isAi
    ? "bg-white border border-gray-200 rounded-3xl rounded-bl-sm"
    : "text-gray-500 italic";

  const maxWidthClass = isSystem ? "max-w-[90%]" : "max-w-[80%]";

  const timestampAlignClass = isUser
    ? "text-right"
    : isAi
    ? "text-left"
    : "text-center";

  return (
    <>
      <style>{`
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out forwards;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.3s ease-out forwards;
        }
        .animate-slide-in-down {
          animation: slideInDown 0.3s ease-out forwards;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div className={`flex w-full ${alignmentClass} ${className ?? ""}`}>
        <div className={`flex flex-col ${maxWidthClass}`}>
          <div
            className={`group relative p-4 ${bubbleBaseClass} ${bubbleAnimation} ${maxWidthClass}`}
          >
            {/* AI Header */}
            {isAi && (
              <div className="mb-2 flex items-center gap-2">
                {model && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {model}
                  </span>
                )}
                {elapsedMs !== undefined && (
                  <span className="text-xs text-gray-400">
                    {formatElapsed(elapsedMs)}
                  </span>
                )}
              </div>
            )}

            {/* Content */}
            <div className="whitespace-pre-wrap break-words">
              {isAi && isStreaming && !content.trim() ? (
                <span className="text-gray-400">
                  AI กำลังตอบ...
                  <span className="animate-blink">|</span>
                </span>
              ) : (
                <>
                  {content}
                  {isAi && isStreaming && (
                    <span className="animate-blink">|</span>
                  )}
                </>
              )}
            </div>

            {/* AI Footer (appears on hover) */}
            {isAi && (onCopy || onRetry || onFeedback) && (
              <div className="mt-2 hidden items-center gap-2 border-t border-gray-100 pt-2 group-hover:flex">
                {onCopy && (
                  <button
                    onClick={onCopy}
                    className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title="คัดลอก"
                  >
                    คัดลอก
                  </button>
                )}
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title="ลองใหม่"
                  >
                    ลองใหม่
                  </button>
                )}
                {onFeedback && (
                  <>
                    <button
                      onClick={() => onFeedback("good")}
                      className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title="ดี"
                    >
                      👍 ดี
                    </button>
                    <button
                      onClick={() => onFeedback("bad")}
                      className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title="ไม่ดี"
                    >
                      👎 ไม่ดี
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Timestamp */}
          {timestamp && (
            <div className={`mt-1 text-xs text-gray-400 ${timestampAlignClass}`}>
              {formatTimestamp(timestamp)}
            </div>
          )}
        </div>
      </div>

      {/* Follow-up suggestions */}
      {isAi && !isStreaming && followUpSuggestions && followUpSuggestions.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto px-1">
          {followUpSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className="flex-shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </>
  );
}