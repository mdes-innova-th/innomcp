<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-020 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3565,"completion_tokens":7061,"total_tokens":10626,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5620,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:44:45.216Z -->
FILE: innomcp-node/src/services/systemInventory.ts
<<<<<<< SEARCH
async function fetchMcpServerTools(mcpServerUrl: string | undefined, timeoutMs: number) {
  if (!mcpServerUrl) return [];
  try {
    const json = await fetchJson(
      mcpServerUrl.replace(/\/$/, ""),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "tools-list", method: "tools/list", params: {} }),
      },
      timeoutMs
    );
    const tools = Array.isArray(json?.result?.tools) ? json.result.tools : [];
    return tools.map((tool: Record<string, any>) => normalizeTool(tool, "mcp-server"));
  } catch {
    return [];
  }
}
=======
async function fetchMcpServerTools(mcpServerUrl: string | undefined, timeoutMs: number) {
  if (!mcpServerUrl) return [];
  let safeUrl: string;
  try {
    const parsed = new URL(mcpServerUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return [];
    if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)) return [];
    safeUrl = parsed.toString().replace(/\/$/, "");
  } catch {
    return [];
  }
  try {
    const json = await fetchJson(
      safeUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "tools-list", method: "tools/list", params: {} }),
      },
      timeoutMs
    );
    const tools = Array.isArray(json?.result?.tools) ? json.result.tools : [];
    return tools.map((tool: Record<string, any>) => normalizeTool(tool, "mcp-server"));
  } catch {
    return [];
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/systemInventory.ts
<<<<<<< SEARCH
async function fetchCommandCodeModels(baseUrl: string | undefined, timeoutMs: number) {
  const endpoint = (baseUrl || "http://127.0.0.1:4322").replace(/\/$/, "");
  const modelsUrl = endpoint.endsWith("/v1") ? `${endpoint}/models` : `${endpoint}/v1/models`;
  try {
    const json = await fetchJson(modelsUrl, { method: "GET" }, timeoutMs);
    const models = Array.isArray(json?.data)
      ? json.data.map((m: any) => String(m.id)).filter(Boolean)
      : [];
    return { reachable: true, modelCount: models.length, models: models.slice(0, 80) };
  } catch (error) {
    return {
      reachable: false,
      modelCount: 0,
      models: [],
      error: error instanceof Error ? error.message : "unreachable",
    };
  }
}
=======
async function fetchCommandCodeModels(baseUrl: string | undefined, timeoutMs: number) {
  let endpoint: string;
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { reachable: false, modelCount: 0, models: [], error: "unreachable" };
      }
      if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)) {
        return { reachable: false, modelCount: 0, models: [], error: "unreachable" };
      }
      endpoint = parsed.toString().replace(/\/$/, "");
    } catch {
      return { reachable: false, modelCount: 0, models: [], error: "unreachable" };
    }
  } else {
    endpoint = "http://127.0.0.1:4322";
  }
  const modelsUrl = endpoint.endsWith("/v1") ? `${endpoint}/models` : `${endpoint}/v1/models`;
  try {
    const json = await fetchJson(modelsUrl, { method: "GET" }, timeoutMs);
    const models = Array.isArray(json?.data)
      ? json.data.map((m: any) => String(m.id)).filter(Boolean)
      : [];
    return { reachable: true, modelCount: models.length, models: models.slice(0, 80) };
  } catch (error) {
    return {
      reachable: false,
      modelCount: 0,
      models: [],
      error: "unreachable",
    };
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/systemInventory.ts
<<<<<<< SEARCH
function normalizeTool(tool: Record<string, any>, source: "runtime" | "mcp-server") {
  const inputSchema = tool.inputSchema ?? tool.schema ?? {};
  const schemaHint = inputSchema?.properties
    ? ` params: ${Object.keys(inputSchema.properties).slice(0, 6).join(", ")}`
    : "";
  return {
    name: String(tool.name ?? tool.id ?? "unknown-tool"),
    description: String(tool.description ?? tool.title ?? "").slice(0, 220) + schemaHint,
    category: typeof tool.category === "string" ? tool.category : undefined,
    source,
  };
}
=======
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function normalizeTool(tool: Record<string, any>, source: "runtime" | "mcp-server") {
  const inputSchema = tool.inputSchema ?? tool.schema ?? {};
  const rawDescription = String(tool.description ?? tool.title ?? "");
  const safeDescription = escapeHtml(rawDescription);
  const schemaHint = inputSchema?.properties
    ? ` params: ${Object.keys(inputSchema.properties).slice(0, 6).join(", ")}`
    : "";
  return {
    name: escapeHtml(String(tool.name ?? tool.id ?? "unknown-tool")),
    description: safeDescription.slice(0, 220) + schemaHint,
    category: typeof tool.category === "string" ? escapeHtml(tool.category) : undefined,
    source,
  };
}
>>>>>>> REPLACE
