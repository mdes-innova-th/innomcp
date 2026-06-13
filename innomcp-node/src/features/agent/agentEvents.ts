// === Agent Event Types ===

/** Base type for all agent events */
interface AgentEventBase {
  /** Unique id for this event (optional) */
  id?: string;
  /** Timestamp (ISO string) */
  timestamp: string;
}

/** A plan event – agent is announcing its high‑level plan */
export interface PlanEvent extends AgentEventBase {
  type: 'plan';
  /** The plan description (e.g. "1. Search for documentation...") */
  plan: string;
  /** Optional list of steps */
  steps?: string[];
}

/** A tool call event – agent is about to invoke a tool */
export interface ToolCallEvent extends AgentEventBase {
  type: 'tool_call';
  /** Tool name (e.g. "read_file", "web_search") */
  tool: string;
  /** Arguments passed to the tool (as JSON object) */
  arguments: Record<string, unknown>;
  /** Optional correlation id for matching result */
  callId?: string;
}

/** A tool result event – agent received result from a tool call */
export interface ToolResultEvent extends AgentEventBase {
  type: 'tool_result';
  /** Tool name */
  tool: string;
  /** The result data (could be string, number, object, etc.) */
  result: unknown;
  /** Optional callId matching the corresponding tool_call */
  callId?: string;
  /** Optional flag if the result indicates an error */
  error?: boolean;
  /** Human‑readable summary if any */
  summary?: string;
}

/** A message event – agent emits a natural language message */
export interface MessageEvent extends AgentEventBase {
  type: 'message';
  /** The message content (markdown or plain text) */
  content: string;
  /** Optional role (e.g. 'agent', 'user') */
  role?: 'agent' | 'user' | 'system';
}

/** An artifact event – agent produces a file or other artifact */
export interface ArtifactEvent extends AgentEventBase {
  type: 'artifact';
  /** File name */
  name: string;
  /** MIME type (e.g. "text/markdown", "image/png") */
  mimeType?: string;
  /** Content – usually a string, but could be base64 */
  content: string;
  /** Optional path in workspace */
  path?: string;
}

/** A done event – agent signals completion */
export interface DoneEvent extends AgentEventBase {
  type: 'done';
  /** Optional final message */
  message?: string;
  /** Did the execution succeed? Default true */
  success?: boolean;
}

/** An error event – agent encountered a problem */
export interface ErrorEvent extends AgentEventBase {
  type: 'error';
  /** Error message */
  message: string;
  /** Optional error code */
  code?: string;
  /** Optional stack trace */
  stack?: string;
}

/** Union type of all agent events */
export type AgentEvent =
  | PlanEvent
  | ToolCallEvent
  | ToolResultEvent
  | MessageEvent
  | ArtifactEvent
  | DoneEvent
  | ErrorEvent;

// === SSE Line Parser ===

type SSEFields = {
  event: string;
  data: string;
  id?: string;
  retry?: number;
};

/**
 * Parse a single SSE line (including possible continuation or comment).
 * Returns an SSEFields object if a complete event has been fully buffered,
 * otherwise returns null. This implementation processes one line at a time
 * and does NOT handle multi‑line data fields – it expects the full data
 * on a single "data:" line (which is typical for our stream).
 *
 * For a production system, consider using a proper SSE parser that
 * buffers lines until an empty line is received.
 */
function parseSSEFields(line: string): SSEFields | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    // Comment or empty line – ignore
    return null;
  }

  // Field patterns
  const eventMatch = trimmed.match(/^event:\s*(.*)$/);
  if (eventMatch) {
    return { event: eventMatch[1].trim(), data: '', id: undefined, retry: undefined };
  }

  const dataMatch = trimmed.match(/^data:\s*(.*)$/);
  if (dataMatch) {
    return { event: '', data: dataMatch[1], id: undefined, retry: undefined };
  }

  const idMatch = trimmed.match(/^id:\s*(.*)$/);
  if (idMatch) {
    return { event: '', data: '', id: idMatch[1].trim(), retry: undefined };
  }

  const retryMatch = trimmed.match(/^retry:\s*(\d+)$/);
  if (retryMatch) {
    return { event: '', data: '', id: undefined, retry: parseInt(retryMatch[1], 10) };
  }

  // Unknown field – ignore according to SSE spec
  return null;
}

/**
 * Parse a single SSE line and return an AgentEvent if it represents a complete event,
 * or null if more lines are needed. This simplified implementation assumes that
 * the entire event (event type + data) fits in one line pair – i.e. the data does
 * not contain newlines. If you need to support multiline data, you must buffer lines.
 *
 * @param line - The raw SSE line (including trailing newline).
 * @returns An AgentEvent object or null.
 */
export function parseSSELine(line: string): AgentEvent | null {
  // We store fields from consecutive calls; however, this function is stateless
  // and returns null for incomplete events. To handle actual streaming, you must
  // maintain state across calls (e.g., using a parser object). For convenience,
  // this implementation tries to parse when a data field appears after an event field.
  // It will not work for multiline data or events split across multiple lines.
  //
  // For a real streaming use case, you should create a class like:
  // class SSEParser { ... } that accumulates lines until blank line.
  //
  // Given the spec (single line per event), we assume "event:" and "data:" appear
  // on consecutive lines or even on the same line? We'll try to handle both.
  // We'll require an event line followed by a data line. Since we only see one line
  // at a time, we need to cache. But the function signature says line-based.
  // Therefore we assume that the caller provides entire lines and we detect
  // a complete event when we see a "data:" line after an "event:" line.
  // This requires a static variable – but pure function can't have state.
  //
  // Instead, we assume that the line contains complete JSON after the "data:" prefix
  // and that the event type is embedded as a field in the JSON. Many custom SSE
  // streams include the type inside the data JSON. We'll attempt to parse the data
  // as JSON and extract the type from it. This is a common pattern.
  //
  // Example:
  //   data: {"type":"plan","plan":"...","timestamp":"..."}
  //
  // If the line starts with "data:", we try to parse the rest as JSON.
  // If it's valid JSON with a "type" field matching the union, we build the event.
  // Otherwise return null.

  if (!line.startsWith('data:')) {
    // Ignore non-data lines from the perspective of this simplified parser
    return null;
  }

  const jsonStr = line.substring(5).trim(); // remove "data:"
  if (!jsonStr) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  // Must have a "type" field that is a string
  const type = parsed.type;
  if (typeof type !== 'string') return null;

  // Build the event based on type
  const base: AgentEventBase = {
    id: typeof parsed.id === 'string' ? parsed.id : undefined,
    timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
  };

  switch (type) {
    case 'plan': {
      if (typeof parsed.plan !== 'string') return null;
      const event: PlanEvent = {
        ...base,
        type: 'plan',
        plan: parsed.plan,
        steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : undefined,
      };
      return event;
    }
    case 'tool_call': {
      if (typeof parsed.tool !== 'string') return null;
      if (!parsed.arguments || typeof parsed.arguments !== 'object') return null;
      const event: ToolCallEvent = {
        ...base,
        type: 'tool_call',
        tool: parsed.tool,
        arguments: parsed.arguments as Record<string, unknown>,
        callId: typeof parsed.callId === 'string' ? parsed.callId : undefined,
      };
      return event;
    }
    case 'tool_result': {
      if (typeof parsed.tool !== 'string') return null;
      const event: ToolResultEvent = {
        ...base,
        type: 'tool_result',
        tool: parsed.tool,
        result: parsed.result,
        callId: typeof parsed.callId === 'string' ? parsed.callId : undefined,
        error: typeof parsed.error === 'boolean' ? parsed.error : undefined,
        summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      };
      return event;
    }
    case 'message': {
      if (typeof parsed.content !== 'string') return null;
      const event: MessageEvent = {
        ...base,
        type: 'message',
        content: parsed.content,
        role: parsed.role === 'agent' || parsed.role === 'user' || parsed.role === 'system'
          ? parsed.role
          : undefined,
      };
      return event;
    }
    case 'artifact': {
      if (typeof parsed.name !== 'string') return null;
      if (typeof parsed.content !== 'string') return null;
      const event: ArtifactEvent = {
        ...base,
        type: 'artifact',
        name: parsed.name,
        mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : undefined,
        content: parsed.content,
        path: typeof parsed.path === 'string' ? parsed.path : undefined,
      };
      return event;
    }
    case 'done': {
      const event: DoneEvent = {
        ...base,
        type: 'done',
        message: typeof parsed.message === 'string' ? parsed.message : undefined,
        success: typeof parsed.success === 'boolean' ? parsed.success : true,
      };
      return event;
    }
    case 'error': {
      if (typeof parsed.message !== 'string') return null;
      const event: ErrorEvent = {
        ...base,
        type: 'error',
        message: parsed.message,
        code: typeof parsed.code === 'string' ? parsed.code : undefined,
        stack: typeof parsed.stack === 'string' ? parsed.stack : undefined,
      };
      return event;
    }
    default:
      return null;
  }
}
