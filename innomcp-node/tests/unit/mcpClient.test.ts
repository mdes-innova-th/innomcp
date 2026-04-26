/**
 * Unit tests for services/mcpClient.ts (Phase 4 scaffold)
 * All tests use injected fetchImpl — no real HTTP required.
 */

import {
  McpClient,
  McpClientOptions,
  McpToolResult,
  getDefaultMcpClient,
} from "../../src/services/mcpClient";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): typeof fetch {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: (k: string) => headers[k] ?? null },
  } as unknown as Response);
}

function makeErrorFetch(err: Error): typeof fetch {
  return jest.fn().mockRejectedValue(err);
}

const BASE_URL = "http://localhost:3012";

// ─── constructor ──────────────────────────────────────────────────────────────

describe("McpClient constructor", () => {
  it("uses env MCP_SERVER_URL when no baseUrl provided", () => {
    const old = process.env.MCP_SERVER_URL;
    process.env.MCP_SERVER_URL = "http://mcp-host:9999";
    const mcp = new McpClient({ fetchImpl: makeFetch(200, {}) });
    expect((mcp as any).baseUrl).toBe("http://mcp-host:9999");
    process.env.MCP_SERVER_URL = old;
  });

  it("trims trailing slash from baseUrl", () => {
    const mcp = new McpClient({ baseUrl: "http://localhost:3012/", fetchImpl: makeFetch(200, {}) });
    expect((mcp as any).baseUrl).toBe("http://localhost:3012");
  });

  it("defaults to port 3012", () => {
    delete process.env.MCP_SERVER_URL;
    const mcp = new McpClient({ fetchImpl: makeFetch(200, {}) });
    expect((mcp as any).baseUrl).toBe("http://localhost:3012");
  });
});

// ─── callTool ─────────────────────────────────────────────────────────────────

describe("McpClient.callTool", () => {
  it("returns success=true with data on 200", async () => {
    const fetchImpl = makeFetch(200, { province: "กรุงเทพมหานคร" });
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });

    const result = await mcp.callTool("thaiGeo", { query: "กทม" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ province: "กรุงเทพมหานคร" });
    expect(typeof result.latencyMs).toBe("number");
    expect(result.status).toBe(200);
  });

  it("POSTs to /tool/:toolName with correct headers", async () => {
    const fetchImpl = makeFetch(200, {});
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });

    await mcp.callTool("calculator", { expression: "2+2" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3012/tool/calculator",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: "2+2" }),
      })
    );
  });

  it("URL-encodes the tool name", async () => {
    const fetchImpl = makeFetch(200, {});
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });

    await mcp.callTool("thai geo", { query: "test" });

    const url = (fetchImpl as jest.Mock).mock.calls[0][0] as string;
    expect(url).toBe("http://localhost:3012/tool/thai%20geo");
  });

  it("returns success=false with error on 500", async () => {
    const fetchImpl = makeFetch(500, { error: "internal" });
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });

    const result = await mcp.callTool("anyTool", {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
    expect(result.status).toBe(500);
  });

  it("returns success=false on network error", async () => {
    const fetchImpl = makeErrorFetch(new Error("ECONNREFUSED"));
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });

    const result = await mcp.callTool("anyTool", {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("does NOT retry on 4xx (client bug)", async () => {
    const fetchImpl = makeFetch(400, { error: "bad request" });
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 2 });

    await mcp.callTool("anyTool", {});

    // Only 1 attempt despite maxRetries=2
    expect((fetchImpl as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("retries on 500 up to maxRetries times", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "500", json: () => Promise.resolve({}), text: () => Promise.resolve("") } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "500", json: () => Promise.resolve({}), text: () => Promise.resolve("") } as unknown as Response)
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve("") } as unknown as Response);

    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 2, timeout: 5000 });
    const result = await mcp.callTool("anyTool", {});

    expect(result.success).toBe(true);
    expect((fetchImpl as jest.Mock).mock.calls).toHaveLength(3);
  }, 10000);
});

// ─── callBatch ────────────────────────────────────────────────────────────────

describe("McpClient.callBatch", () => {
  it("runs all calls in parallel and returns array in order", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ r: 1 }), text: () => Promise.resolve("") } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ r: 2 }), text: () => Promise.resolve("") } as unknown as Response);

    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });
    const results = await mcp.callBatch([
      { toolName: "tool1", params: {} },
      { toolName: "tool2", params: {} },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect((results[0].data as any).r).toBe(1);
    expect((results[1].data as any).r).toBe(2);
  });

  it("one failure does not abort others", async () => {
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve("") } as unknown as Response);

    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl, maxRetries: 0 });
    const results = await mcp.callBatch([
      { toolName: "bad", params: {} },
      { toolName: "good", params: {} },
    ]);

    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });
});

// ─── isAvailable ──────────────────────────────────────────────────────────────

describe("McpClient.isAvailable", () => {
  it("returns true when /health responds 200", async () => {
    const fetchImpl = makeFetch(200, { status: "ok" });
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl });

    const ok = await mcp.isAvailable();
    expect(ok).toBe(true);
    const url = (fetchImpl as jest.Mock).mock.calls[0][0] as string;
    expect(url).toBe("http://localhost:3012/health");
  });

  it("returns false when /health responds 503", async () => {
    const fetchImpl = makeFetch(503, {});
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl });
    expect(await mcp.isAvailable()).toBe(false);
  });

  it("returns false on network error", async () => {
    const fetchImpl = makeErrorFetch(new Error("ECONNREFUSED"));
    const mcp = new McpClient({ baseUrl: BASE_URL, fetchImpl });
    expect(await mcp.isAvailable()).toBe(false);
  });
});

// ─── singleton ────────────────────────────────────────────────────────────────

describe("getDefaultMcpClient", () => {
  it("returns the same instance on repeated calls", () => {
    const a = getDefaultMcpClient();
    const b = getDefaultMcpClient();
    expect(a).toBe(b);
  });

  it("returns a McpClient instance", () => {
    expect(getDefaultMcpClient()).toBeInstanceOf(McpClient);
  });
});
