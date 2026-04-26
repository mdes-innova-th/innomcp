/**
 * Phase 4 — mcpClient abstraction (scaffold).
 *
 * Thin HTTP client for invoking MCP tools on the innomcp-server-node host.
 * Designed to replace the inline `fetch(`${MCP_URL}/tool/${name}`, ...)` calls
 * that are currently scattered through routes/api/chat.ts.
 *
 * NOT YET wired into chat.ts — see docs/4Opus/03_PHASE_BACKLOG.md, Phase 4.
 * The IntelligentMCPClient at utils/mcp/mcpclient.ts is the live integration;
 * this file is the abstraction layer that future refactors will route through.
 *
 * Public surface (kept minimal so tests don't have to stub a wide API):
 *   const mcp = new McpClient({ baseUrl: 'http://localhost:3012' });
 *   const r = await mcp.callTool('thaiGeo', { query: '...' });
 *   if (r.success) use(r.data); else log(r.error);
 *
 * Retry policy: only retries network/5xx errors, never 4xx (client bug).
 * Timeouts: per-attempt (default 10s); total wall-clock = timeout * (1 + retries).
 */

export interface McpClientOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export interface McpToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs?: number;
  status?: number;
}

export interface McpCall {
  toolName: string;
  params: Record<string, unknown>;
}

const DEFAULT_BASE_URL = "http://localhost:3012";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 250;

export class McpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: McpClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.MCP_SERVER_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Invoke a single MCP tool. Resolves with `success: false` on failure
   * rather than throwing — callers can branch on the flag.
   */
  async callTool<T = unknown>(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<McpToolResult<T>> {
    const start = Date.now();
    let lastError = "unknown error";
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.requestOnce<T>(toolName, params);
        return { ...result, latencyMs: Date.now() - start };
      } catch (err) {
        const e = err as { name?: string; status?: number; message?: string };
        lastError = e.message ?? String(err);
        lastStatus = e.status;

        // 4xx is a contract bug — no retry, the next attempt would fail the same way.
        if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
          break;
        }
        if (attempt < this.maxRetries) {
          await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        }
      }
    }

    return {
      success: false,
      error: lastError,
      status: lastStatus,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Invoke multiple tools in parallel. Results are returned in input order.
   * One failed call does not abort the others.
   */
  async callBatch(calls: McpCall[]): Promise<McpToolResult[]> {
    return Promise.all(
      calls.map((c) => this.callTool(c.toolName, c.params))
    );
  }

  /**
   * Health probe against GET /health. Useful for circuit-breaker style
   * pre-checks before a batch of expensive calls.
   */
  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      return resp.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private async requestOnce<T>(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<McpToolResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await this.fetchImpl(
        `${this.baseUrl}/tool/${encodeURIComponent(toolName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const body = await safeReadText(resp);
        const err = new Error(
          `MCP tool ${toolName} failed: ${resp.status} ${resp.statusText} ${body}`.trim()
        ) as Error & { status: number };
        err.status = resp.status;
        throw err;
      }

      const data = (await resp.json()) as T;
      return { success: true, data, status: resp.status };
    } finally {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return (await resp.text()).slice(0, 500);
  } catch {
    return "";
  }
}

let defaultClient: McpClient | null = null;
export function getDefaultMcpClient(): McpClient {
  if (!defaultClient) defaultClient = new McpClient();
  return defaultClient;
}
