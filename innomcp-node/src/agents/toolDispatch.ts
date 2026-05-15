/**
 * agents/toolDispatch.ts — Phase 10.17
 *
 * Bridges MCP tools into the SSE/conductor pipeline. When the user query
 * matches a tool-requiring intent (weather, geo, knowledge, evidence),
 * we call the MCP JSON-RPC endpoint directly, emit tool_call_* events
 * so the MultiAgentPanel sees them, and return the tool result so MDES
 * agents can incorporate it into their synthesis.
 */
import { newEnvelope } from "./events";
import { checkAgentEventSafe } from "./eventGuard";
import type { EmitFn } from "./conductor";
import type { ChatIntent } from "../services/intentClassifier";
import { checkToolAccess, type GuestLimits } from "../middleware/guestLimiter";

const MCP_URL = (process.env.MCPSERVER_URL ?? "http://localhost:3012/mcp").replace(/\/$/, "");
const TOOL_TIMEOUT_MS = 20_000;

/** Resolve intent (and query keywords) → MCP tool name + arg builder */
function planToolCall(intent: ChatIntent, query: string): { toolName: string; args: Record<string, unknown> } | null {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // Weather — handled via NWP daily
  if (intent === "weather" || /อากาศ|พยากรณ์|ฝน|อุณหภูมิ|forecast|weather/.test(lower)) {
    const province = extractThaiProvince(trimmed) || "กรุงเทพมหานคร";
    return {
      toolName: "nwp_daily_by_place",
      args: { province, duration: 2, fields: ["tc_max", "tc_min", "rh", "rain", "cond"] },
    };
  }

  // Evidence intel — keyword-driven (intent classifier doesn't have "evidence" yet)
  if (/หลักฐาน|threat|คดี|nip|forensic|sigint/i.test(trimmed)) {
    return { toolName: "detect_evidence_stats", args: { intent: "list_recent_threats", limit: 10 } };
  }

  // Geo lookup (thai_geo_tool expects { query })
  if (intent === "map") {
    const province = extractThaiProvince(trimmed);
    if (!province) return null;
    return { toolName: "thai_geo_tool", args: { query: province } };
  }

  // No tool for greeting/calc/code/general/planning-broad/datetime
  return null;
}

/** Map known amphoe / city aliases → official province name */
const AMPHOE_TO_PROVINCE: Record<string, string> = {
  "หาดใหญ่": "สงขลา",
  "พัทยา": "ชลบุรี",
  "บางนา": "กรุงเทพมหานคร",
  "เมืองเชียงใหม่": "เชียงใหม่",
  "เกาะสมุย": "สุราษฎร์ธานี",
  "เกาะพะงัน": "สุราษฎร์ธานี",
  "เกาะเต่า": "สุราษฎร์ธานี",
  "อยุธยา": "พระนครศรีอยุธยา",
  "บ้านฉาง": "ระยอง",
  "ดอนเมือง": "กรุงเทพมหานคร",
  "สุวรรณภูมิ": "สมุทรปราการ",
};

/** Heuristic — extract Thai province name from query if present */
function extractThaiProvince(query: string): string | null {
  // First check amphoe/city aliases — more specific
  for (const [alias, province] of Object.entries(AMPHOE_TO_PROVINCE)) {
    if (query.includes(alias)) return province;
  }
  const PROVINCES = [
    "กรุงเทพมหานคร", "กรุงเทพ", "เชียงใหม่", "เชียงราย", "นครราชสีมา", "ขอนแก่น",
    "อุบลราชธานี", "อุดรธานี", "ภูเก็ต", "สงขลา", "ชลบุรี", "ระยอง", "พิษณุโลก",
    "นครศรีธรรมราช", "สุราษฎร์ธานี", "พังงา", "กระบี่", "ตรัง", "ลำปาง", "ลำพูน",
    "น่าน", "แพร่", "พะเยา", "แม่ฮ่องสอน", "ตาก", "สุโขทัย", "อุตรดิตถ์",
    "นครสวรรค์", "เพชรบุรี", "ราชบุรี", "ประจวบคีรีขันธ์", "นครปฐม", "สมุทรปราการ",
    "สมุทรสาคร", "ปทุมธานี", "นนทบุรี", "พระนครศรีอยุธยา", "สุพรรณบุรี", "กาญจนบุรี",
    "หัวหิน", "เลย", "อ่างทอง", "สิงห์บุรี", "ชัยภูมิ", "บุรีรัมย์", "สุรินทร์",
    "ศรีสะเกษ", "ยโสธร", "ร้อยเอ็ด", "มหาสารคาม", "กาฬสินธุ์", "นครพนม",
    "สกลนคร", "หนองคาย", "บึงกาฬ", "หนองบัวลำภู", "มุกดาหาร", "อำนาจเจริญ",
    "ปราจีนบุรี", "สระแก้ว", "นครนายก", "ฉะเชิงเทรา", "ตราด", "จันทบุรี",
  ];
  for (const p of PROVINCES) {
    if (query.includes(p)) return p === "กรุงเทพ" ? "กรุงเทพมหานคร" : p;
  }
  return null;
}

/** Call MCP JSON-RPC tool endpoint */
async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; text?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TOOL_TIMEOUT_MS);
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, latencyMs: Date.now() - start };
    const body = await res.text();
    // MCP JSON-RPC response: {"result":{"content":[{"type":"text","text":"..."}]}}
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const text =
      parsed?.result?.content?.[0]?.text ||
      parsed?.content?.[0]?.text ||
      body;
    return { ok: true, text: String(text).slice(0, 4000), latencyMs: Date.now() - start };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

/**
 * Dispatch an MCP tool for the given intent and emit tool_call events.
 * Writes the result into liveOutputs under a `__tool__` key so synthesizeAnswer
 * sees it as a priority source.
 */
export async function dispatchTool(
  intent: ChatIntent,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn,
  liveOutputs: Record<string, string>,
  limits?: GuestLimits
): Promise<void> {
  const plan = planToolCall(intent, query);
  if (!plan) return;

  if (limits && !checkToolAccess(plan.toolName, limits)) {
    const blockedEv = newEnvelope({
      runId,
      messageId,
      type: "fallback",
      publicSummary: `This account tier cannot use ${plan.toolName}; sign in for full tool access.`,
      agentId: "tool-scout",
    });
    blockedEv.fallbackReason = "tool_not_allowed_for_account_tier";
    if (checkAgentEventSafe(blockedEv, { expectedToolUsage: true }).ok) emit(blockedEv);
    return;
  }

  const startEv = newEnvelope({
    runId,
    messageId,
    type: "tool_call_started",
    publicSummary: `เรียก ${plan.toolName} …`,
    agentId: "tool-scout",
  });
  startEv.toolName = plan.toolName;
  if (checkAgentEventSafe(startEv, { expectedToolUsage: true }).ok) emit(startEv);

  const result = await callMcpTool(plan.toolName, plan.args);

  const finEv = newEnvelope({
    runId,
    messageId,
    type: "tool_call_finished",
    publicSummary: result.ok
      ? `${plan.toolName} เสร็จ (${result.latencyMs}ms)`
      : `${plan.toolName} ล้มเหลว: ${result.error?.slice(0, 60)}`,
    agentId: "tool-scout",
  });
  finEv.toolName = plan.toolName;
  if (checkAgentEventSafe(finEv, { expectedToolUsage: true }).ok) emit(finEv);

  if (result.ok && result.text) {
    // Format tool data into readable Thai before handing off to synthesizeAnswer
    const formatted = formatToolResult(plan.toolName, result.text);
    if (formatted) liveOutputs["__tool__"] = formatted;
  }
}

/**
 * Convert raw tool JSON into a friendly Thai summary that fits the chat bubble.
 * Falls back to raw text only if shape is unexpected.
 */
function formatToolResult(toolName: string, rawText: string): string | null {
  let parsed: any;
  try { parsed = JSON.parse(rawText); } catch {
    // Couldn't parse — for evidence tool return a graceful message
    if (toolName === "detect_evidence_stats") {
      return `🛡️ ระบบฐานข้อมูลหลักฐาน (Detect API) ยังไม่พร้อมให้บริการในขณะนี้ ลองเรียกใหม่ภายหลังครับ`;
    }
    return null;
  }

  if (toolName.startsWith("nwp_daily")) {
    const fc = parsed?.data?.WeatherForecasts?.[0] || parsed?.WeatherForecasts?.[0];
    const loc = fc?.location;
    const days = fc?.forecasts || [];
    if (!loc || days.length === 0) return null;
    const place = loc.province + (loc.amphoe ? ` อำเภอ${loc.amphoe}` : "");
    const lines = [`📍 พยากรณ์อากาศรายวัน — ${place}`];
    for (const d of days.slice(0, 7)) {
      const date = String(d.time || "").slice(0, 10);
      const tmax = d.data?.tc_max != null ? `สูงสุด ${d.data.tc_max.toFixed(1)}°C` : "";
      const tmin = d.data?.tc_min != null ? `ต่ำสุด ${d.data.tc_min.toFixed(1)}°C` : "";
      const rh = d.data?.rh != null ? `ความชื้น ${d.data.rh.toFixed(0)}%` : "";
      const rain = d.data?.rain != null ? `ฝน ${d.data.rain.toFixed(1)}mm` : "";
      const cond = d.data?.cond != null ? `(${weatherCond(d.data.cond)})` : "";
      lines.push(`• **${date}**: ${[tmax, tmin, rh, rain].filter(Boolean).join(", ")} ${cond}`);
    }
    lines.push("");
    lines.push(`ข้อมูลจาก NWP (TMD High Performance Computing)`);
    return lines.join("\n");
  }

  if (toolName === "thai_geo_tool") {
    const out: string[] = [];
    if (parsed?.location || parsed?.province) {
      const p = parsed.location || parsed;
      if (p.province) out.push(`📍 **${p.province}**`);
      if (p.region) out.push(`ภูมิภาค: ${p.region}`);
      if (p.lat && p.lon) out.push(`พิกัด: ${p.lat}, ${p.lon}`);
    }
    return out.length > 0 ? out.join("\n") : null;
  }

  if (toolName === "detect_evidence_stats") {
    if (parsed?.error || parsed?.code) {
      const code = parsed.code || "EVIDENCE_QUERY_FAILED";
      return `🛡️ ยังไม่สามารถดึงข้อมูลหลักฐานได้ (${code}) — ระบบฐานข้อมูล Detect อาจไม่พร้อมในขณะนี้`;
    }
    if (Array.isArray(parsed?.items) || Array.isArray(parsed?.data)) {
      const items = parsed.items || parsed.data || [];
      const lines = [`🛡️ พบหลักฐาน ${items.length} รายการล่าสุด:`];
      for (const it of items.slice(0, 5)) {
        const id = it.id || it.nip || it.ref || "—";
        const status = it.status || it.threat || "";
        lines.push(`• ${id} ${status ? `(${status})` : ""}`);
      }
      return lines.join("\n");
    }
    return `🛡️ ผลการตรวจสอบหลักฐาน:\n${JSON.stringify(parsed).slice(0, 300)}`;
  }

  return null;
}

function weatherCond(code: number): string {
  const map: Record<number, string> = {
    1: "ท้องฟ้าแจ่มใส", 2: "เมฆบางส่วน", 3: "เมฆเป็นส่วนมาก", 4: "เมฆมาก",
    5: "ฝนเล็กน้อย", 6: "ฝนปานกลาง", 7: "ฝนหนัก", 8: "ฝนฟ้าคะนอง",
    9: "หนาวจัด", 10: "หนาว", 11: "เย็น", 12: "ร้อนจัด",
  };
  return map[code] ?? `cond ${code}`;
}
