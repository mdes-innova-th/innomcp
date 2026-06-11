// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import type { AgentEvent } from "@/app/components/chat/useAgentEventStream";
// กำหนดประเภท AgentEvent จาก useAgentEventStream (เพื่อความเข้ากันได้)
import type { AgentEvent as AgentEventStream } from "./useAgentEventStream";

// ----------------------------------------------------------------------
// Private helper functions
// ----------------------------------------------------------------------

/**
 * จัดกลุ่มข้อความตามวันที่ (แสดงผลในรูปแบบไทย)
 */
function groupMessagesByDate(
  messages: ChatMessage[]
): { date: string; messages: ChatMessage[] }[] {
  const groups = new Map<string, ChatMessage[]>();
  messages.forEach((msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const existing = groups.get(date);
    if (existing) {
      existing.push(msg);
    } else {
      groups.set(date, [msg]);
    }
  });
  return Array.from(groups.entries()).map(([date, messages]) => ({
    date,
    messages,
  }));
}

/**
 * นับจำนวน AI agent ที่ปรากฏใน events
 */
function countActiveAgents(events: AgentEvent[]): number {
  const agents = new Set<string>();
  events.forEach((e) => {
    if (e.agent) agents.add(e.agent);
  });
  return agents.size;
}

/**
 * รวบรวมรายชื่อโมเดลทั้งหมดที่ถูกเรียกใช้งาน
 */
function getActiveModels(events: AgentEvent[]): string[] {
  const models = new Set<string>();
  events.forEach((e) => {
    if (e.type === "llm_response" && e.model) {
      models.add(e.model);
    }
  });
  return Array.from(models);
}

/**
 * โมเดลที่ถูกใช้ในเหตุการณ์ llm_response ล่าสุด
 */
function getLatestModel(events: AgentEvent[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "llm_response" && events[i].model) {
      return events[i].model;
    }
  }
  return undefined;
}

/**
 * เวลาที่ใช้ทั้งหมด (จาก timestamp แรกสุดถึงล่าสุด)
 */
function getTotalElapsed(events: AgentEvent[]): number {
  if (events.length === 0) return 0;
  // events ถูกเรียงตามลำดับเวลาที่ได้รับ (chronological)
  const start = events[0].timestamp;
  const end = events[events.length - 1].timestamp;
  return end - start;
}

// ----------------------------------------------------------------------
// Hook 1: useChatMessages
// ----------------------------------------------------------------------

/**
 * ประมวลผลข้อความแชทแบบ memoized เพื่อลดการคำนวณ
 * @param messages - รายการข้อความทั้งหมด
 * @returns ข้อมูลสรุป เช่น จำนวนข้อความ, ข้อความล่าสุด, กลุ่มตามวันที่ ฯลฯ
 */
export function useChatMessages(messages: ChatMessage[]) {
  return useMemo(
    () => ({
      hasMessages: messages.length > 0,
      lastMessage: messages[messages.length - 1],
      isLastAI: messages[messages.length - 1]?.sender === "ai",
      userCount: messages.filter((m) => m.sender === "user").length,
      aiCount: messages.filter((m) => m.sender === "ai").length,
      groupedByDate: groupMessagesByDate(messages),
    }),
    [messages]
  );
}

// ----------------------------------------------------------------------
// Hook 2: useAgentStats
// ----------------------------------------------------------------------

/**
 * สร้างสถิติของ agent จาก event stream (memoized)
 * @param events - อาร์เรย์ของเหตุการณ์จากระบบ AI agent
 * @returns ข้อมูลเช่น จำนวน agent, โมเดลที่ใช้, สถานะเครื่องมือ, ระยะเวลา
 */
export function useAgentStats(events: AgentEvent[]) {
  return useMemo(
    () => ({
      agentCount: countActiveAgents(events),
      activeModels: getActiveModels(events),
      latestModel: getLatestModel(events),
      isAnyToolActive: events.some((e) => e.type === "tool_call_started"),
      totalElapsedMs: getTotalElapsed(events),
    }),
    [events]
  );
}

// ----------------------------------------------------------------------
// Hook 3: useScrollBehavior
// ----------------------------------------------------------------------

/**
 * จัดการพฤติกรรมการเลื่อน (scroll) ของ container แสดงข้อความ
 * - เลื่อนไปด้านล่างอัตโนมัติเมื่อผู้ใช้อยู่ใกล้ปลายสุด
 * - นับจำนวนข้อความใหม่ที่ยังไม่ได้อ่าน (unread)
 * - ตรวจจับว่าผู้ใช้เลื่อนขึ้นไปดูประวัติหรือไม่
 *
 * @param messagesRef - React ref ของ element ที่เป็น scroll container
 * @returns ฟังก์ชัน scrollToBottom, จำนวน unread, และสถานะ isNearBottom
 */
export function useScrollBehavior(
  messagesRef: React.RefObject<HTMLDivElement | null>
) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const unreadCountRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setUnreadCount(0);
      unreadCountRef.current = 0;
      setIsNearBottom(true);
      isNearBottomRef.current = true;
    }
  }, [messagesRef]);

  // ติดตามสถานะการเลื่อน
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distance = scrollHeight - scrollTop - clientHeight;
      const near = distance < 50; // ใกล้ด้านล่าง 50px
      if (near && unreadCountRef.current > 0) {
        setUnreadCount(0);
        unreadCountRef.current = 0;
      }
      isNearBottomRef.current = near;
      setIsNearBottom(near);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // ตรวจสอบครั้งแรก

    return () => el.removeEventListener("scroll", handleScroll);
  }, [messagesRef]);

  // ตรวจจับการเปลี่ยนแปลงขนาดของ container (เมื่อข้อความใหม่ถูกเพิ่ม)
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    let prevHeight = el.scrollHeight;
    const observer = new ResizeObserver(() => {
      const newHeight = el.scrollHeight;
      if (newHeight > prevHeight) {
        // มีเนื้อหาใหม่เพิ่มเข้ามา
        if (!isNearBottomRef.current) {
          // ผู้ใช้ไม่ได้อยู่ล่างสุด → เพิ่ม unread count
          unreadCountRef.current += 1;
          setUnreadCount(unreadCountRef.current);
        } else {
          // ผู้ใช้อยู่ล่างสุด → เลื่อนตามอัตโนมัติ
          el.scrollTop = el.scrollHeight;
        }
      }
      prevHeight = newHeight;
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [messagesRef]);

  return {
    scrollToBottom,
    unreadCount,
    isNearBottom,
  };
}