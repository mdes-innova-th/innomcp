/**
 * agents/events.ts — Phase C agent event contract
 *
 * Public-safe SSE event schema that flows from /api/chat/stream to the
 * frontend ThinkingPanel. Every field listed here is safe for the user to
 * see. Anything not listed (especially raw model thoughts) MUST NOT
 * appear in the SSE stream — see eventGuard.ts for the runtime gate.
 *
 * Schema version: 1.0.0
 * Reference: docs/brain/AGENT_WORKSTREAM_CONTRACT.md
 */

export type AgentEventType =
  | "agent_run_started"
  | "route_selected"
  | "agent_started"
  | "agent_delta"
  | "agent_finished"
  | "tool_call_started"
  | "tool_call_finished"
  | "fact_found"
  | "draft_delta"
  | "critique"
  | "fallback"
  | "final_answer"
  | "feedback_saved"
  | "follow_up_suggestions"
  | "timing"
  | "error";

export type AgentId =
  | "conductor"
  | "concierge"
  | "tool-scout"
  | "weather-analyst"
  | "geo-planner"
  | "rag-agent"
  | "critic"
  | "stylist"
  | "broker"
  | "scribe"
  | "thinker"
  | "researcher"
  | "fact-checker"
  | "linguist"
  | "domain-expert";

export const AGENT_ROLE_LABEL_TH: Record<AgentId, string> = {
  conductor: "ผู้กำกับงาน",
  concierge: "ผู้เรียบเรียงคำตอบ",
  "tool-scout": "ผู้เลือกเครื่องมือ",
  "weather-analyst": "นักวิเคราะห์อากาศ",
  "geo-planner": "นักวางแผนพื้นที่/การเดินทาง",
  "rag-agent": "ผู้สืบค้นความรู้",
  critic: "ผู้ตรวจสอบความถูกต้อง",
  stylist: "ผู้ขัดเกลาภาษาไทย",
  broker: "ผู้คัดเลือกผู้ให้บริการ",
  scribe: "ผู้บันทึกความจำ",
  thinker: "นักคิดวิเคราะห์",
  researcher: "นักค้นคว้า",
  "fact-checker": "ผู้ตรวจสอบข้อเท็จจริง",
  linguist: "ผู้เชี่ยวชาญภาษา",
  "domain-expert": "ผู้เชี่ยวชาญเฉพาะทาง",
};

export interface AgentEvent {
  type: AgentEventType;
  runId: string;
  messageId: string;
  agentId?: AgentId;
  role?: string;

  publicSummary: string;
  isSafeForUser: true;

  timestamp: string;
  confidence?: number;
  sourceIds?: string[];
  toolName?: string;
  provider?: string;
  model?: string;

  deltaText?: string;
  finalText?: string;
  fallbackReason?: string;
  totalMs?: number;
  latencyMs?: number;
}

export const SCHEMA_VERSION = "1.0.0";

const PUBLIC_SUMMARY_MAX = 240;

/**
 * Lightweight runtime validator for AgentEvent shape. Returns null if the
 * event is well-formed, or a string explaining the first violation. This
 * is a *shape* check; the public-safe key/string scan lives in eventGuard.ts.
 */
export function validateAgentEvent(ev: unknown): string | null {
  if (!ev || typeof ev !== "object") return "event is not an object";
  const e = ev as Record<string, unknown>;

  const requiredStrings = ["type", "runId", "messageId", "publicSummary", "timestamp"] as const;
  for (const k of requiredStrings) {
    if (typeof e[k] !== "string" || (e[k] as string).length === 0) {
      return `missing or empty required string field: ${k}`;
    }
  }

  if (e.isSafeForUser !== true) return "isSafeForUser must be the literal true";

  const allowedTypes: AgentEventType[] = [
    "agent_run_started",
    "route_selected",
    "agent_started",
    "agent_delta",
    "agent_finished",
    "tool_call_started",
    "tool_call_finished",
    "fact_found",
    "draft_delta",
    "critique",
    "fallback",
    "final_answer",
    "feedback_saved",
    "follow_up_suggestions",
    "timing",
    "error",
  ];
  if (!allowedTypes.includes(e.type as AgentEventType)) {
    return `unknown event type: ${String(e.type)}`;
  }

  if ((e.publicSummary as string).length > PUBLIC_SUMMARY_MAX) {
    return `publicSummary exceeds ${PUBLIC_SUMMARY_MAX} chars`;
  }

  if (e.confidence !== undefined) {
    const c = e.confidence as number;
    if (typeof c !== "number" || c < 0 || c > 1) return "confidence must be 0..1";
  }

  if (e.sourceIds !== undefined) {
    if (!Array.isArray(e.sourceIds) || e.sourceIds.some((s) => typeof s !== "string")) {
      return "sourceIds must be string[]";
    }
  }

  // Type-specific required fields
  switch (e.type) {
    case "draft_delta":
      if (typeof e.deltaText !== "string") return "draft_delta requires deltaText:string";
      break;
    case "final_answer":
      if (typeof e.finalText !== "string") return "final_answer requires finalText:string";
      break;
    case "tool_call_started":
    case "tool_call_finished":
      if (typeof e.toolName !== "string" || (e.toolName as string).length === 0) {
        return `${e.type} requires toolName:string`;
      }
      break;
    case "fallback":
      if (typeof e.fallbackReason !== "string") return "fallback requires fallbackReason:string";
      break;
  }

  return null;
}

/**
 * Build a base envelope for a new event. Caller must set type + payload-
 * specific fields. publicSummary defaults to a safe placeholder and should
 * always be overridden.
 */
export function newEnvelope(opts: {
  runId: string;
  messageId: string;
  type: AgentEventType;
  publicSummary: string;
  agentId?: AgentId;
}): AgentEvent {
  const role = opts.agentId ? AGENT_ROLE_LABEL_TH[opts.agentId] : undefined;
  return {
    type: opts.type,
    runId: opts.runId,
    messageId: opts.messageId,
    agentId: opts.agentId,
    role,
    publicSummary: opts.publicSummary,
    isSafeForUser: true,
    timestamp: new Date().toISOString(),
  };
}
