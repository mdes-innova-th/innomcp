
export class TimeoutError extends Error {
  code = "TIMEOUT" as const;
  constructor(msg: string) { super(msg); }
}

const isTimeoutText = (s: string) =>
  /timeout|timed out|TMD API timeout/i.test(s);

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Parse MCP tool result into usable JSON payload.
 * Handles:
 *   1. structuredContent: { ok, meta, data } → extract .data
 *   2. content[0].text JSON string → parse
 *   3. Single-element array unwrap: [{ X }] → { X }
 */
export function parseMcpPayload(result: any): any {
  if (!result) return null;

  let payload: any;

  // Step 1: Prefer structuredContent
  if (result?.structuredContent !== undefined) {
    payload = result.structuredContent;
    if (typeof payload === "string") {
      const trimmed = payload.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          payload = JSON.parse(trimmed);
        } catch {
          // keep as string
        }
      }
    }
  }

  // Step 2: Parse from content if structuredContent is missing/empty
  if (payload === undefined) {
    const content = Array.isArray(result?.content) ? result.content : [];
    const first = content[0];

    // Common: { type: 'text', text: '{...json...}' }
    const text = first?.text;
    if (typeof text === "string") {
      const trimmed = text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          payload = JSON.parse(trimmed);
        } catch {
          payload = text;
        }
      } else {
        payload = text;
      }
    } else if (first && typeof first === "object") {
      // Some tools may embed a structured object in content
      payload = first?.json ?? first?.data ?? first;
    } else {
      payload = result;
    }
  }

  // Step 3: Unwrap common envelope: { ok, meta, data } -> data
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload) {
    if (("ok" in payload) || ("meta" in payload)) {
      payload = (payload as any).data;
    }
  }

  // Step 4: Unwrap single-element array wrapper
  // TMD often returns [{ Provinces: { Province: [...] } }] or [{ Stations: { Station: [...] } }]
  if (Array.isArray(payload) && payload.length === 1 && typeof payload[0] === "object" && payload[0] !== null) {
    payload = payload[0];
  }

  return payload;
}

export interface ToolExecutionOptions {
    client: any;
    toolName: string;
    args: any;
    timeoutMs: number;
}

export async function executeWeatherToolCall(opts: ToolExecutionOptions): Promise<any> {
    const { client, toolName, args, timeoutMs } = opts;

    try {
        const result = await withTimeout(
            client.callTool({
                name: toolName,
                arguments: args,
            }),
            timeoutMs,
            toolName
        );
        const safeResult = result as any;

        if (safeResult.isError) {
            const errText = safeResult.content?.[0]?.text || "Tool execution error";
            if (isTimeoutText(errText)) {
                throw new TimeoutError(errText);
            }
            throw new Error(errText);
        }

        return parseMcpPayload(safeResult);

    } catch (error: any) {
        if (isTimeoutText(error.message)) {
            throw new TimeoutError(error.message);
        }
        throw error;
    }
}
