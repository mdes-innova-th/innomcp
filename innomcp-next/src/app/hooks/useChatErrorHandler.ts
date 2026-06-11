// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState, useCallback } from "react";

type ChatError =
  | { type: "websocket"; code?: number; message: string }
  | { type: "stream_timeout"; elapsed: number }
  | { type: "provider_error"; provider: string; statusCode?: number; message: string }
  | { type: "file_too_large"; fileName: string; sizeMB: number }
  | { type: "tool_error"; toolName: string; message: string }
  | { type: "rate_limit"; retryAfter?: number }
  | { type: "unknown"; message: string };

interface UseChatErrorHandlerReturn {
  lastError: ChatError | null;
  handleError: (error: unknown) => ChatError;
  clearError: () => void;
  getThaiMessage: (error: ChatError) => string;
  shouldRetry: (error: ChatError) => boolean;
}

function isWebSocketError(error: unknown): error is { code?: number; message: string } {
  if (typeof error !== "object" || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    ("code" in e && typeof e.code === "number") ||
    "message" in e &&
    typeof e.message === "string" &&
    (typeof (e as any).type === "string" && (e as any).type === "close")
  );
}

function isTimeoutError(error: unknown): error is { elapsed: number } {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    return /timeout|timed out/i.test(error.message);
  }
  return false;
}

function isProviderError(error: unknown): error is { provider?: string; statusCode?: number; message: string } {
  if (typeof error !== "object" || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    "statusCode" in e ||
    ("message" in e && typeof e.message === "string" && /openai|anthropic|gemini/i.test(e.message))
  );
}

function isFileTooLargeError(error: unknown): error is { fileName: string; sizeMB: number } {
  if (error instanceof Error) {
    return /file too large|ขนาดไฟล์ใหญ่เกิน/i.test(error.message);
  }
  return false;
}

function isToolError(error: unknown): error is { toolName: string; message: string } {
  if (error instanceof Error) {
    return /tool|function_call|ฟังก์ชัน/i.test(error.message);
  }
  return false;
}

function isRateLimitError(error: unknown): error is { retryAfter?: number } {
  if (error instanceof Error) {
    return /rate limit|เกินจำนวนคำขอ|retry after/i.test(error.message);
  }
  return false;
}

export function useChatErrorHandler(): UseChatErrorHandlerReturn {
  const [lastError, setLastError] = useState<ChatError | null>(null);

  const handleError = useCallback((error: unknown): ChatError => {
    let chatError: ChatError;

    // WebSocket
    if (isWebSocketError(error)) {
      chatError = {
        type: "websocket",
        code: (error as { code?: number }).code,
        message: (error as { message: string }).message,
      };
    }
    // Stream timeout
    else if (isTimeoutError(error)) {
      chatError = {
        type: "stream_timeout",
        elapsed: 0, // cannot reliably infer elapsed time from unknown error
      };
    }
    // Provider error
    else if (isProviderError(error)) {
      chatError = {
        type: "provider_error",
        provider: (error as { provider?: string }).provider ?? "unknown",
        statusCode: (error as { statusCode?: number }).statusCode,
        message: (error as { message: string }).message ?? String(error),
      };
    }
    // File too large
    else if (isFileTooLargeError(error)) {
      const msg = (error as Error).message;
      const match = msg.match(/ขนาดไฟล์ใหญ่เกิน\s*([\d.]+)/i) || msg.match(/size[:\s]*([\d.]+)\s*MB/i);
      const sizeMB = match ? parseFloat(match[1]) : 0;
      chatError = {
        type: "file_too_large",
        fileName: "unknown", // could be extracted but minimal for this implementation
        sizeMB,
      };
    }
    // Tool error
    else if (isToolError(error)) {
      chatError = {
        type: "tool_error",
        toolName: "unknown",
        message: (error as Error).message,
      };
    }
    // Rate limit
    else if (isRateLimitError(error)) {
      const msg = (error as Error).message;
      const retryMatch = msg.match(/retry after[:\s]*(\d+)/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : undefined;
      chatError = {
        type: "rate_limit",
        retryAfter,
      };
    }
    // Fallback unknown
    else {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
      chatError = {
        type: "unknown",
        message,
      };
    }

    setLastError(chatError);
    return chatError;
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const getThaiMessage = useCallback((error: ChatError): string => {
    switch (error.type) {
      case "websocket":
        return `การเชื่อมต่อขาดหาย (${error.message.slice(0, 50)}) โปรดลองเชื่อมต่อใหม่`;
      case "stream_timeout":
        return "การรับข้อมูลใช้เวลานานเกินไป โปรดลองอีกครั้ง";
      case "provider_error": {
        const codeStr = error.statusCode ? ` (รหัส ${error.statusCode})` : "";
        return `เกิดข้อผิดพลาดจากผู้ให้บริการ ${error.provider}${codeStr}: ${error.message.slice(0, 50)}`;
      }
      case "file_too_large":
        return `ไฟล์ "${error.fileName}" ใหญ่เกินไป (${error.sizeMB} MB) กรุณาลดขนาดแล้วลองใหม่`;
      case "tool_error":
        return `เกิดข้อผิดพลาดในการเรียกใช้ฟังก์ชัน ${error.toolName}: ${error.message.slice(0, 50)}`;
      case "rate_limit": {
        const waitStr = error.retryAfter ? ` กรุณารอ ${error.retryAfter} วินาที` : "";
        return `เกินจำนวนคำขอที่กำหนด${waitStr} โปรดลองใหม่อีกครั้ง`;
      }
      case "unknown":
        return `เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ: ${error.message.slice(0, 80)}`;
    }
  }, []);

  const shouldRetry = useCallback((error: ChatError): boolean => {
    switch (error.type) {
      case "websocket":
      case "stream_timeout":
      case "rate_limit":
      case "tool_error":
      case "unknown":
        return true;
      case "provider_error":
      case "file_too_large":
        return false;
    }
  }, []);

  return {
    lastError,
    handleError,
    clearError,
    getThaiMessage,
    shouldRetry,
  };
}