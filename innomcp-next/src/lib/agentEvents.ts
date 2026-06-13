/**
 * Agent Event Utilities
 * Parses Server-Sent Events (SSE) from the agent orchestration backend.
 */

export interface AgentEvent {
  type: string;
  timestamp?: number;
  content?: string;
  result?: any;
  success?: boolean;
  name?: string;
  args?: any;
  url?: string;
  filename?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/**
 * Parses a single line of SSE data.
 * Expects format: "data: { ...json... }" or just "{ ...json... }"
 */
export function parseSSELine(line: string): AgentEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let jsonString = trimmed;
  if (trimmed.startsWith('data:')) {
    jsonString = trimmed.substring(5).trim();
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed as AgentEvent;
  } catch (e) {
    console.warn(`[agentEvents] Failed to parse SSE line: ${trimmed}`, e);
    return null;
  }
}
