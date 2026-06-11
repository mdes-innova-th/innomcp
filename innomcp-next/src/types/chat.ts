// chat.ts — shared chat type definitions for INNOMCP
export interface ChatMessage {
  id?: string;
  sender?: "user" | "ai";
  role?: "user" | "assistant" | "system";
  text?: string;
  content?: string;
  fullText?: string;
  isAnimating?: boolean;
  structuredContent?: unknown;
  toolsUsed?: string[];
  isProgress?: boolean;
  progressStage?: string;
  elapsedTime?: number;
  mdesEnhanced?: boolean;
  timestamp?: number;
  isComplete?: boolean;
  elapsedMs?: number;
  followUpSuggestions?: string[];
  responseTime?: number;
}

export interface Artifact {
  id: string;
  name: string;
  type: "code" | "html" | "markdown" | "json" | "csv" | "text" | "chart";
  content: string;
  createdAt: number;
}

export type ChatMode = "normal" | "multiagent" | "reasoning" | "fast" | "general";

export type ToolType = "auto" | "weather" | "geo" | "evidence" | "knowledge" | "image" | "code" | "none";
