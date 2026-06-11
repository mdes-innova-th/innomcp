// @ts-nocheck
"use client";

import React, { useEffect, useRef } from "react";
import type ChatMessage from "@/types/chat";
import type { AgentEvent } from "./useAgentEventStream";
import MDESStreamIndicator from "./MDESStreamIndicator";
import TypingIndicator from "./TypingIndicator";

interface MessageThreadProps {
  messages: ChatMessage[];
  isWaitingForResponse: boolean;
  streamStatus: string;
  agentEvents?: AgentEvent[];
  typingUsers?: Array<{ name: string }>;
  onCopy?: (text: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  className?: string;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

function formatThaiDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MessageThread({
  messages,
  isWaitingForResponse,
  streamStatus,
  agentEvents,
  typingUsers,
  onCopy,
  scrollRef,
  className = "",
}: MessageThreadProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef || innerRef;

  // Auto‑scroll to bottom when messages change or a reply is streaming
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isWaitingForResponse, containerRef]);

  if (messages.length === 0) return null;

  let lastDate: Date | null = null;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col space-y-2 overflow-y-auto ${className}`}
    >
      {messages.map((message, index) => {
        const currentDate = message.timestamp
          ? new Date(message.timestamp)
          : new Date();
        const showDateSeparator =
          !lastDate ||
          lastDate.toDateString() !== currentDate.toDateString();

        // Prepare date label
        let dateLabel: string | null = null;
        if (showDateSeparator) {
          dateLabel = isToday(currentDate)
            ? "วันนี้"
            : isYesterday(currentDate)
            ? "เมื่อวาน"
            : formatThaiDate(currentDate);
        }

        // Update tracked date for next iteration
        lastDate = currentDate;

        return (
          <React.Fragment key={message.id ?? index}>
            {dateLabel && (
              <div className="flex justify-center my-2">
                <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {dateLabel}
                </span>
              </div>
            )}

            <div
              role={message.role}
              className={`message p-3 rounded-lg ${
                message.role === "user"
                  ? "user-message bg-blue-50 self-end text-right"
                  : "ai-message bg-gray-50 self-start"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          </React.Fragment>
        );
      })}

      {isWaitingForResponse && (
        <MDESStreamIndicator
          streamStatus={streamStatus}
          agentEvents={agentEvents}
        />
      )}

      {typingUsers && typingUsers.length > 0 && (
        <TypingIndicator users={typingUsers} />
      )}
    </div>
  );
}