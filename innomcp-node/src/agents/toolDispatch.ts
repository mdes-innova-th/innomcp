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

export interface ToolPlan {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
  authoritative: boolean;
}

function needsHourlyWeather(query: string): boolean {
  // Phase C.03 fix: "ตอนนี้" alone (casual weather check) uses daily — only
  // request 24-hour hourly data when the user specifically asks for hours.
  // "อากาศตอนนี้ดีไหม" → daily;  "อากาศรายชั่วโมงวันนี้" → hourly.
  if (/รายชั่วโมง|ชั่วโมง|hourly/i.test(query)) return true;
  if (/วันนี้|today|current.*hour|now.*hour/i.test(query) && /ชั่วโมง|hour/i.test(query)) return true;
  return false;
}

function extractMathExpression(query: string): string {
  let expr = query
    .replace(/คำนวณ|ช่วย|หน่อย|เท่ากับเท่าไหร่|เท่ากับ|ผลลัพธ์|calculate|compute|what is/gi, " ")
    .replace(/บวก/g, "+")
    .replace(/ลบ/g, "-")
    .replace(/คูณ/g, "*")
    .replace(/หาร/g, "/")
    .replace(/ยกกำลัง/g, "^")
    .replace(/เปอร์เซ็นต์|percent/gi, "%")
    .trim();

  if (/ค่าเฉลี่ย|average|mean/i.test(query)) {
    const nums = query.match(/-?\d+(?:\.\d+)?/g);
    if (nums && nums.length > 0) return `mean([${nums.join(",")}])`;
  }

  const safe = expr.match(/[0-9+\-*/%^().,\s\[\]]+/g)?.join(" ").trim();
  return safe && /\d/.test(safe) ? safe : expr;
}

function inferEvidenceAction(query: string): string {
  if (/offline|ออฟไลน์/i.test(query)) return "active_machines_offline_count";
  if (/machine|เครื่อง/i.test(query) && /ล่าสุด|last|latest/i.test(query)) return "machine_last_scan";
  if (/machine|เครื่อง/i.test(query)) return "active_machines_count";
  if (/7\s*day|7\s*วัน|trend|แนวโน้ม/i.test(query)) return "evidence_records_last_7_days_trend";
  if (/yesterday|เมื่อวาน/i.test(query) && /isp/i.test(query)) return "evidence_records_yesterday_by_isp_top";
  if (/yesterday|เมื่อวาน/i.test(query)) return "evidence_records_yesterday_total";
  if (/nip|url/i.test(query) && /isp|top|สูงสุด|มากสุด/i.test(query)) return "nip_top_isp_this_month";
  if (/nip|url/i.test(query)) return "nip_latest";
  return "officer_summary";
}

function extractIspFilter(query: string): string | undefined {
  const hit = query.match(/\b(ais|dtac|true|tot|3bb|nt)\b/i)?.[1];
  return hit ? hit.toLowerCase() : undefined;
}

function inferKnowledgeDomain(query: string): string | undefined {
  if (/กฎหมาย|พระราชบัญญัติ|พรบ|PDPA|law/i.test(query)) return "law";
  if (/ประวัติ|history/i.test(query)) return "history";
  if (/ศาสนา|วัด|religion/i.test(query)) return "religion";
  if (/จังหวัด|อำเภอ|ตำบล|geo|province/i.test(query)) return "geo";
  return undefined;
}

function hasEvidenceSignal(query: string): boolean {
  if (/หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|threat|sigint/i.test(query)) return true;
  if (/machine|เครื่อง|url|traffic/i.test(query)) {
    return /offline|ล่าสุด|last|latest|scan|สแกน|หลักฐาน|คดี|detect|nip|isp/i.test(query);
  }
  return false;
}

/** Resolve intent (and query keywords) → MCP tool name + arg builder */
export function planToolCall(intent: ChatIntent, query: string): ToolPlan | null {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  if (intent === "datetime") {
    return {
      toolName: "dateTimeTool",
      args: { format: "thai" },
      reason: "datetime intent",
      authoritative: true,
    };
  }

  if (intent === "calc") {
    return {
      toolName: "calculatorTool",
      args: { expression: extractMathExpression(trimmed) },
      reason: "calculation intent",
      authoritative: true,
    };
  }

  // Weather — handled via NWP daily
  if (intent === "weather" || /อากาศ|พยากรณ์|ฝน|อุณหภูมิ|forecast|weather/.test(lower)) {
    const province = extractThaiProvince(trimmed) || "กรุงเทพมหานคร";
    const hourly = needsHourlyWeather(trimmed);
    return {
      toolName: hourly ? "nwp_hourly_by_place" : "nwp_daily_by_place",
      args: hourly
        ? { province, duration: 24, fields: ["tc", "rh", "rain", "cond"] }
        : { province, duration: 2, fields: ["tc_max", "tc_min", "rh", "rain", "cond"] },
      reason: hourly ? "current weather intent" : "daily weather intent",
      authoritative: true,
    };
  }

  // Evidence intel — keyword-driven fallback for officer/data questions.
  if (hasEvidenceSignal(trimmed)) {
    const ispFilter = extractIspFilter(trimmed);
    return {
      toolName: "evidenceTool",
      args: {
        action: inferEvidenceAction(trimmed),
        limit: 5,
        ...(ispFilter ? { ispFilter } : {}),
      },
      reason: "evidence/officer keyword",
      authoritative: true,
    };
  }

  if (intent === "evidence") {
    const ispFilter = extractIspFilter(trimmed);
    return {
      toolName: "evidenceTool",
      args: {
        action: inferEvidenceAction(trimmed),
        limit: 5,
        ...(ispFilter ? { ispFilter } : {}),
      },
      reason: "evidence/officer intent",
      authoritative: true,
    };
  }

  // Geo lookup (thai_geo_tool expects { query })
  if (intent === "map") {
    const province = extractThaiProvince(trimmed);
    return {
      toolName: "thai_geo_tool",
      args: { query: province || trimmed },
      reason: "map/geo intent",
      authoritative: true,
    };
  }

  if (intent === "knowledge") {
    const domain = inferKnowledgeDomain(trimmed);
    return {
      toolName: "thaiKnowledgeTool",
      args: {
        query: trimmed,
        context: {
          ...(domain ? { domain } : {}),
          confidence_required: 0.45,
        },
      },
      reason: domain ? `thai knowledge:${domain}` : "thai knowledge",
      authoritative: false,
    };
  }

  if (intent === "planning-broad") {
    const province = extractThaiProvince(trimmed);
    return {
      toolName: province ? "thai_geo_tool" : "thaiKnowledgeTool",
      args: province
        ? { query: province }
        : { query: trimmed, context: { confidence_required: 0.45 } },
      reason: "planning support lookup",
      authoritative: false,
    };
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
    if (["dateTimeTool", "calculatorTool", "evidenceTool"].includes(toolName)) {
      return rawText.trim().slice(0, 4000);
    }
    // Couldn't parse — for evidence tool return a graceful message
    if (toolName === "detect_evidence_stats") {
      return `🛡️ ระบบฐานข้อมูลหลักฐาน (Detect API) ยังไม่พร้อมให้บริการในขณะนี้ ลองเรียกใหม่ภายหลังครับ`;
    }
    return null;
  }

  if (toolName.startsWith("nwp_daily") || toolName.startsWith("nwp_hourly")) {
    const fc = parsed?.data?.WeatherForecasts?.[0] || parsed?.WeatherForecasts?.[0];
    const loc = fc?.location;
    const days = fc?.forecasts || [];
    if (!loc || days.length === 0) return null;
    const place = loc.province + (loc.amphoe ? ` อำเภอ${loc.amphoe}` : "");
    const lines = [`📍 พยากรณ์อากาศรายวัน — ${place}`];
    for (const d of days.slice(0, 7)) {
      const date = String(d.time || "").slice(0, 10);
      const temp = d.data?.tc != null ? `อุณหภูมิ ${d.data.tc.toFixed(1)}°C` : "";
      const tmax = d.data?.tc_max != null ? `สูงสุด ${d.data.tc_max.toFixed(1)}°C` : "";
      const tmin = d.data?.tc_min != null ? `ต่ำสุด ${d.data.tc_min.toFixed(1)}°C` : "";
      const rh = d.data?.rh != null ? `ความชื้น ${d.data.rh.toFixed(0)}%` : "";
      const rain = d.data?.rain != null ? `ฝน ${d.data.rain.toFixed(1)}mm` : "";
      const cond = d.data?.cond != null ? `(${weatherCond(d.data.cond)})` : "";
      lines.push(`• **${date}**: ${[temp, tmax, tmin, rh, rain].filter(Boolean).join(", ")} ${cond}`);
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

  if (toolName === "thaiKnowledgeTool") {
    if (parsed?.success === false) {
      // Phase C.03 fix: NOT_FOUND → return a useful string (not null) so
      // liveOutputs["__tool__"] is set and synthesizeAnswer doesn't fall back
      // to the canned template. MDES agents will then add context on top.
      const msg = typeof parsed.message === "string" ? parsed.message : "ไม่พบข้อมูลในฐานความรู้ท้องถิ่น";
      const errCode = typeof parsed.error_code === "string" ? ` (${parsed.error_code})` : "";
      return `📚 ${msg}${errCode} — MDES จะช่วยค้นหาคำตอบเพิ่มเติมให้ท่าน`;
    }
    const rows = Array.isArray(parsed?.data) ? parsed.data : [];
    if (rows.length > 0) {
      const lines = rows.slice(0, 5).map((row: any) => {
        const name = row.name_th || row.name || row.id || "ข้อมูล";
        const desc = row.description ? `: ${row.description}` : "";
        return `• **${name}**${desc}`;
      });
      const source = Array.isArray(parsed?.source) && parsed.source.length > 0
        ? `\n\nแหล่งข้อมูล: ${parsed.source.map((s: any) => s.name).filter(Boolean).join(", ")}`
        : "";
      return `${lines.join("\n")}${source}`;
    }
    return JSON.stringify(parsed).slice(0, 800);
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

  // Phase C.01b — Bug B fix: evidenceTool success-path formatter.
  // Previously `formatToolResult` only handled evidenceTool in the JSON.parse
  // failure branch, so a successful (parsed) response fell through to `return null`
  // and the chat bubble showed nothing. Now we summarize the array / data shape
  // in Thai and fall back to a bounded raw slice if the shape is unfamiliar.
  if (toolName === "evidenceTool") {
    if (Array.isArray(parsed)) {
      const count = parsed.length;
      const items = parsed
        .slice(0, 3)
        .map((r: any) => {
          const label =
            r?.url ||
            r?.ip ||
            r?.id ||
            r?.nip ||
            r?.ref ||
            JSON.stringify(r).slice(0, 80);
          return `• ${label}`;
        })
        .join("\n");
      return `พบข้อมูลหลักฐาน ${count} รายการ:\n${items}`;
    }
    if (parsed && typeof parsed === "object" && parsed.data !== undefined) {
      return `ข้อมูลหลักฐาน: ${JSON.stringify(parsed.data).slice(0, 2000)}`;
    }
    return rawText.slice(0, 2000);
  }

  // Phase C.06 fix: previously returned null for any tool not explicitly
  // handled (currency, RSS, WorldBank, nasa, etc.) causing liveOutputs["__tool__"]
  // to never be set → synthesizeAnswer skips tool path → blank/template answer.
  // Now: return the raw text bounded to 2000 chars so the user always sees
  // the tool result, even if we haven't built a pretty formatter for it yet.
  if (rawText && rawText.trim().length > 5) {
    return rawText.trim().slice(0, 2000);
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
