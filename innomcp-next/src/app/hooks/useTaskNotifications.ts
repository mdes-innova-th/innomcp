"use client";
import { useEffect, useRef } from "react";
import type { AgentEvent } from "@/app/components/chat/useAgentEventStream";
import { addNotification } from "@/app/components/common/NotificationCenter";

/**
 * useTaskNotifications — Phase 3 browser notification hook
 *
 * Requests Notification permission on first mount, then fires a browser
 * notification whenever a streaming session completes (isStreaming goes
 * from true → false) and there is a `final_answer` event in the list.
 */
export function useTaskNotifications(
  events: AgentEvent[],
  isStreaming: boolean
): { notificationsEnabled: boolean } {
  const prevIsStreamingRef = useRef<boolean>(false);

  // Request permission once on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Fire notification when streaming completes and final_answer exists
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    // Only fire once per completion: wasStreaming=true → isStreaming=false
    if (!wasStreaming || isStreaming) return;

    const finalAnswerEvent = events.find((e) => e.type === "final_answer");
    if (!finalAnswerEvent) return;

    // Persist to in-app notification center
    addNotification({
      type: "task_complete",
      title: "งานเสร็จแล้ว",
      body:
        finalAnswerEvent.publicSummary?.slice(0, 80) ||
        "Agent ทำงานเสร็จแล้ว",
      taskId: events[0]?.runId,
    });

    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("INNOMCP — งานเสร็จแล้ว", {
        body:
          finalAnswerEvent.publicSummary?.slice(0, 80) ||
          "Agent ทำงานเสร็จแล้ว",
        icon: "/favicon.ico",
      });
    }
  }, [events, isStreaming]);

  const notificationsEnabled =
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted";

  return { notificationsEnabled };
}
