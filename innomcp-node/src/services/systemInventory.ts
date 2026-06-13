import { listProviders } from "../providers/registry";

type RuntimeMcpClient = {
  getAvailableTools?: () => Array<Record<string, any>>;
  getAvailableResources?: () => Array<Record<string, any>>;
  getConnectedClients?: () => string[];
  getToolInventory?: () => Record<string, any>;
};

export interface SystemInventorySnapshot {
  generatedAt: string;
  mcp: {
    totalTools: number;
    localTools: number;
    remoteTools: number;
    connectedClients: string[];
    remoteReady: boolean;
    tools: Array<{
      name: string;
      description?: string;
      category?: string;
      source: "runtime" | "mcp-server";
    }>;
    resources: Array<{ name?: string; title?: string; description?: string; uriTemplate?: string }>;
  };
  providers: Array<{
    id: string;
    name?: string;
    type?: string;
    model?: string;
    enabled: boolean;
  }>;
  commandCode: {
    reachable: boolean;
    modelCount: number;
    models: string[];
    error?: string;
  };
  apiSurfaces: Array<{ method: string; path: string; purpose: string }>;
}

export interface InventoryBuildOptions {
  mcpClient?: RuntimeMcpClient | null;
  mcpServerUrl?: string;
  commandCodeBaseUrl?: string;
  timeoutMs?: number;
}

const API_SURFACES: SystemInventorySnapshot["apiSurfaces"] = [
  { method: "WS", path: "/chat", purpose: "primary browser chat transport" },
  { method: "POST", path: "/api/chat", purpose: "HTTP chat fallback and MCP-backed responses" },
  { method: "POST", path: "/api/chat/stream", purpose: "agent event stream and final synthesis" },
  { method: "GET", path: "/api/chat/mcp/tools", purpose: "runtime MCP tool and resource inventory" },
  { method: "GET", path: "/api/chat/system/inventory", purpose: "sanitized system tools, providers, and API inventory" },
  { method: "GET", path: "/api/health", purpose: "backend, MCP, Redis, provider, and build health" },
  { method: "POST", path: "/api/providers/health-check", purpose: "live provider probes" },
  { method: "POST", path: "/api/providers/test-call", purpose: "single provider test call" },
  { method: "GET", path: "/api/mother/providers", purpose: "Mother dispatch provider roster" },
  { method: "POST", path: "/api/tasks/:id/messages", purpose: "task continuation over SSE" },
  { method: "GET/POST", path: "/api/workspace", purpose: "workspace metadata and instructions" },
  { method: "POST", path: "/api/shell", purpose: "approved sandbox shell tool" },
  { method: "POST", path: "/api/web-fetch", purpose: "safe URL fetch tool" },
  { method: "POST", path: "/api/analyze", purpose: "data analysis helper" },
];

export function looksLikeSystemInventoryQuestion(message: string): boolean {
  const text = String(message || "").toLowerCase();
  if (!text.trim()) return false;

  const hasSystemSubject =
    /\b(tools?|apis?|endpoints?|providers?|models?|mcp|registry|inventory|capabilit(?:y|ies)|commandcode|maw|innova-bot)\b/i.test(text) ||
    /เครื่องมือ|เอพีไอ|ระบบมี|ระบบใช้|ความสามารถ|รายการ|ทั้งหมด|เคยใช้|โมเดล|ผู้ให้บริการ|พร็อกซี|พร็อกซี่/.test(text);

  const asksInventory =
    /\b(list|show|what|which|available|used|inventory|ทั้งหมด|all)\b/i.test(text) ||
    /อะไร|ไหน|บ้าง|มี|ใช้งานได้|เคยใช้|แสดง|สรุป|ตรวจ/.test(text);

  return hasSystemSubject && asksInventory;
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

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

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

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

async function fetchCommandCodeModels(baseUrl: string | undefined, timeoutMs: number) {
  const endpoint = (baseUrl || "http://127.0.0.1:4322").replace(/\/$/, "");
  try {
    const json = await fetchJson(`${endpoint}/v1/models`, { method: "GET" }, timeoutMs);
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

export async function buildSystemInventorySnapshot(
  options: InventoryBuildOptions = {}
): Promise<SystemInventorySnapshot> {
  const timeoutMs = options.timeoutMs ?? 1600;
  const mcpClient = options.mcpClient ?? null;
  const runtimeTools = Array.isArray(mcpClient?.getAvailableTools?.())
    ? mcpClient!.getAvailableTools!().map((tool) => normalizeTool(tool, "runtime"))
    : [];
  const resources = Array.isArray(mcpClient?.getAvailableResources?.())
    ? mcpClient!.getAvailableResources!().map((r) => ({
        name: typeof r.name === "string" ? r.name : undefined,
        title: typeof r.title === "string" ? r.title : undefined,
        description: typeof r.description === "string" ? r.description : undefined,
        uriTemplate: typeof r.uriTemplate === "string" ? r.uriTemplate : undefined,
      }))
    : [];
  const inventory = mcpClient?.getToolInventory?.() ?? {};
  const connectedClients = Array.isArray(mcpClient?.getConnectedClients?.())
    ? mcpClient!.getConnectedClients!()
    : [];

  const [mcpServerTools, commandCode] = await Promise.all([
    fetchMcpServerTools(options.mcpServerUrl ?? process.env.MCPSERVER_URL ?? "http://localhost:3012/mcp", timeoutMs),
    fetchCommandCodeModels(options.commandCodeBaseUrl ?? process.env.COMMANDCODE_BASE_URL ?? "http://127.0.0.1:4322", timeoutMs),
  ]);

  const tools = uniqueByName([...runtimeTools, ...mcpServerTools]).sort((a, b) => a.name.localeCompare(b.name));
  const providers = listProviders().map((provider) => ({
    id: provider.id,
    name: provider.displayName,
    type: provider.type,
    model: provider.model,
    enabled: Boolean(provider.enabled),
  }));

  return {
    generatedAt: new Date().toISOString(),
    mcp: {
      totalTools: Number(inventory.totalTools ?? tools.length),
      localTools: Number(inventory.localTools ?? runtimeTools.filter((t) => t.name.startsWith("local-tools:")).length),
      remoteTools: Number(inventory.remoteTools ?? Math.max(0, tools.length - runtimeTools.length)),
      connectedClients,
      remoteReady: Boolean(inventory.remoteReady ?? connectedClients.length > 0),
      tools,
      resources,
    },
    providers,
    commandCode,
    apiSurfaces: API_SURFACES,
  };
}

export function renderSystemInventoryAnswer(snapshot: SystemInventorySnapshot): string {
  const enabledProviders = snapshot.providers.filter((p) => p.enabled);
  const providerLines = enabledProviders.length
    ? enabledProviders.map((p) => `- ${p.id}${p.model ? ` (${p.model})` : ""}`).join("\n")
    : "- ยังไม่มี provider ที่เปิดใช้งานใน registry";

  const toolLines = snapshot.mcp.tools.length
    ? snapshot.mcp.tools.map((tool) => `- ${tool.name}${tool.description ? ` — ${tool.description}` : ""}`).join("\n")
    : "- runtime ตอนนี้ยังไม่ส่งรายชื่อ tool กลับมา";

  const apiLines = snapshot.apiSurfaces.map((api) => `- ${api.method} ${api.path} — ${api.purpose}`).join("\n");
  const commandCodeLine = snapshot.commandCode.reachable
    ? `พร้อมใช้งาน เห็น ${snapshot.commandCode.modelCount} models เช่น ${snapshot.commandCode.models.slice(0, 8).join(", ")}`
    : `ยังไม่พร้อมในรอบตรวจนี้ (${snapshot.commandCode.error ?? "unreachable"})`;

  return [
    "สรุป Tools/API ที่ระบบ INNOMCP เห็นจาก runtime ตอนนี้",
    "",
    `MCP tools: ${snapshot.mcp.totalTools} รายการ (local ${snapshot.mcp.localTools}, remote ${snapshot.mcp.remoteTools})`,
    `MCP clients: ${snapshot.mcp.connectedClients.length ? snapshot.mcp.connectedClients.join(", ") : "ยังไม่มี remote client ที่เชื่อมอยู่"}`,
    `CommandCode proxy: ${commandCodeLine}`,
    "",
    "Providers ที่เปิดอยู่:",
    providerLines,
    "",
    "API surfaces สำคัญ:",
    apiLines,
    "",
    "Tools ที่ใช้งานได้/เคยโหลดใน runtime นี้:",
    toolLines,
  ].join("\n");
}

export async function buildSystemInventoryAnswer(options: InventoryBuildOptions = {}): Promise<string> {
  const snapshot = await buildSystemInventorySnapshot(options);
  return renderSystemInventoryAnswer(snapshot);
}
