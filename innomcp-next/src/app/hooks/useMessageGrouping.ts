"use client";

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: number; // Unix epoch milliseconds
  role: "user" | "assistant" | "system";
  agentId?: string;
}

export interface MessageGroup {
  date: string; // "YYYY-MM-DD"
  label: string; // "Today", "Yesterday", or formatted date like "June 5, 2026"
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a Date object to a human-readable label.
 *
 * - If the date is today (according to local time), returns "Today".
 * - If the date is yesterday, returns "Yesterday".
 * - Otherwise, returns a long-form date string like "June 5, 2026".
 */
export function formatGroupLabel(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    todayStart.getDate() - 1,
  );

  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateStart.getTime() === todayStart.getTime()) {
    return "Today";
  }
  if (dateStart.getTime() === yesterdayStart.getTime()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Converts a Date object to a "YYYY-MM-DD" string (local time).
 */
function dateToKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Groups an array of ChatMessage objects by their calendar date (local time).
 *
 * Messages within each group maintain their original order.
 * Groups are returned oldest‑first.
 *
 * @param messages - The list of messages to group.
 * @returns An array of MessageGroup objects.
 */
export function useMessageGrouping(messages: ChatMessage[]): MessageGroup[] {
  return useMemo(() => {
    if (messages.length === 0) {
      return [];
    }

    // 1. Group messages by date key
    const groupsByKey = new Map<string, ChatMessage[]>();

    for (const message of messages) {
      const date = new Date(message.timestamp);
      const key = dateToKey(date);

      const group = groupsByKey.get(key);
      if (group) {
        group.push(message);
      } else {
        groupsByKey.set(key, [message]);
      }
    }

    // 2. Sort keys chronologically (oldest first)
    const sortedKeys = Array.from(groupsByKey.keys()).sort();

    // 3. Build MessageGroup array
    const result: MessageGroup[] = [];

    for (const key of sortedKeys) {
      const groupMessages = groupsByKey.get(key)!;
      // Reconstruct date from key to avoid time offset issues
      const [year, month, day] = key.split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);
      const label = formatGroupLabel(dateObj);

      result.push({
        date: key,
        label,
        messages: groupMessages,
      });
    }

    return result;
  }, [messages]);
}
