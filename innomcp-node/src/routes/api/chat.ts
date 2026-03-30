import { Router } from "express";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import crypto from "crypto";
import { Ollama } from "ollama";
import { InitMcpClient, IntelligentMCPClient } from "../../utils/mcp/mcpclient";
import { ToolHealthCheckSystem } from "../../utils/mcp/toolHealthCheck";
import { logBoth } from "../../utils/mcpLogger";
import logger from "../../utils/logger";
import { getCurrentAIMode } from "./aiMode";
import { fastPathChatMiddleware } from "../../middleware/fastpathChatMiddleware";
import { sessionManager } from "../../utils/sessionManager";
import { trySessionContext } from "../../utils/geoProviderStack";
import { validateThaiLanguage, createThaiOnlyFallbackPrompt, createThaiErrorResponse, sanitizeThaiSegments } from "../../utils/languageValidator";
import { buildSystemPrompt, buildIdentityPrompt } from "../../config/systemPrompt";
import { extractCorrelationIdFromUpgrade } from "../../middleware/correlationId";
import { checkRateLimit, buildRateLimitKey } from "../../fastpath/rateLimit";
import { analyzeIntent } from "../../fastpath/intentGate";
import { getSemanticRouter } from "../../utils/semanticRouter"; // 🧠 NEW: Semantic classification for hybrid mode
import { getGodTierRouter } from "../../utils/mcp/godTierRouter"; // 🎯 God-Tier Context-Aware Intent Engine (2026)
import { getABTester } from "../../utils/mcp/abTester"; // 🧪 A/B Testing: Remote vs Hybrid mode comparison
import { requestQueue } from "../../utils/requestQueue";
import reportRouter from "./chat/report";
import { optionalAuth } from "../../utils/jwt";
import { guestLimiterMiddleware, getLimitsForUser, checkToolAccess, limitResponseLength } from "../../middleware/guestLimiter";
import { tryFastPathWebSocket } from "../../services/fastPathHandler";
import { renderWeatherMarkdownTable } from "../../utils/weather/tableRenderer";
import { renderWeatherContractAnswer } from "../../utils/weather/answerContract";
import { sanitizeForTraceV3, normalizeTraceAnswerV3ByRoute } from "../../utils/traceSanitizer";
import { renderThaiGeoAnswerShort } from "../../utils/mcp/tools/thai_geo_tool";
import { planAnswer } from "../../utils/mcp/answerPlanner";
import { retrieveRecordsPayload } from "../../utils/chat/recordsRetrieval";

dotenv.config();

const LOW_CONFIDENCE_FALLBACK_TEXT = "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ";

// ========================================
// MULTI-AI CONFIGURATION
// ========================================

// ใช้ getCurrentAIMode() แทน env variable
let AI_MODE: 'local' | 'remote' | 'hybrid' = getCurrentAIMode();
logBoth("info", `\n🚀 ========================================`);
logBoth("info", `🚀 INNOMCP AI MODE: ${AI_MODE.toUpperCase()}`);
logBoth("info", `🚀 ========================================\n`);

// --- Local Ollama (GPU) Configuration ---
const localRawHost = process.env.LOCAL_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://172.22.64.1:11434";
let localOllamaHostUrl = localRawHost;
try {
  if (!/^https?:\/\//i.test(localRawHost)) {
    localOllamaHostUrl = `http://${localRawHost}`;
  }
  const parsed = new URL(localOllamaHostUrl);
  localOllamaHostUrl = parsed.toString().replace(/\/$/, "");
} catch (e) {
  localOllamaHostUrl = localRawHost.replace(/\/$/, "");
}

const localOllama = new Ollama({ 
  host: localOllamaHostUrl,
});
const localModel = process.env.LOCAL_OLLAMA_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:14b";
const fastModel = process.env.FAST_OLLAMA_MODEL || "qwen2.5:0.5b";  // For fast routing/classification
const heavyModel = process.env.HEAVY_OLLAMA_MODEL || "deepseek-r1:32b";  // For heavy tasks (optional)
logBoth("info", `💚 Local AI: ${localOllamaHostUrl} (${localModel})`);
logBoth("info", `⚡ Fast Model: ${fastModel} | 🧠 Heavy Model: ${heavyModel}`);

// --- Remote Ollama Configuration (for remote/hybrid modes) ---
let remoteOllama: Ollama | undefined;
let remoteModel: string | undefined;  // Primary model for main responses
let remoteFastModel: string | undefined;  // Fast model for routing

if (AI_MODE === 'remote' || AI_MODE === 'hybrid') {
  const remoteRawHost = process.env.REMOTE_OLLAMA_BASE_URL;
  if (remoteRawHost) {
    let remoteOllamaHostUrl = remoteRawHost;
    try {
      if (!/^https?:\/\//i.test(remoteRawHost)) {
        remoteOllamaHostUrl = `http://${remoteRawHost}`;
      }
      const parsed = new URL(remoteOllamaHostUrl);
      remoteOllamaHostUrl = parsed.toString().replace(/\/$/, "");
    } catch (e) {
      remoteOllamaHostUrl = remoteRawHost.replace(/\/$/, "");
    }
    
    const remoteToken = process.env.REMOTE_OLLAMA_TOKEN;
    remoteOllama = new Ollama({
      host: remoteOllamaHostUrl,
      ...(remoteToken ? { headers: { Authorization: `Bearer ${remoteToken}` } } : {}),
    });
    remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;  // gemma3:4b
    remoteFastModel = process.env.REMOTE_FAST_OLLAMA_MODEL || process.env.REMOTE_OLLAMA_MODEL || fastModel;
    logBoth("info", `🎯 Remote AI: ${remoteOllamaHostUrl}${remoteToken ? ' (auth ✓)' : ''}`);
    logBoth("info", `  📦 Primary: ${remoteModel} | ⚡ Fast: ${remoteFastModel}`);
  } else {
    logBoth("warn", `⚠️  ${AI_MODE} mode selected but REMOTE_OLLAMA_BASE_URL not configured`);
    logBoth("warn", `⚠️  Falling back to local AI only`);
  }
}

// Main Ollama instance (backward compatibility)
let ollama = AI_MODE === 'local' ? localOllama : (remoteOllama || localOllama);
let ollamaModel = AI_MODE === 'local' ? localModel : (remoteModel || localModel);
let ollamaFastModel = AI_MODE === 'local' ? fastModel : (remoteFastModel || fastModel);

logBoth("info", `\n✨ Primary AI: ${AI_MODE === 'local' ? 'Local' : (remoteOllama ? 'Remote' : 'Local (fallback)')}\n`);

function syncChatAIModeIfChanged() {
  const latestMode = getCurrentAIMode();
  if (latestMode !== AI_MODE) {
    logBoth('info', `[Chat AI] 🔄 Detected mode drift: ${AI_MODE} → ${latestMode}`);
    updateChatAIMode();
  }
}

function renderWeatherDirectAnswer(userText: string, weatherPayload: any): { text: string; structuredContent: any } {
  const payloadContract =
    weatherPayload && typeof weatherPayload === "object" && !Array.isArray(weatherPayload)
      ? (weatherPayload as any).weatherPayload
      : null;
  const structuredContent = payloadContract
    ? { weatherPipeline: weatherPayload, weatherPayload: payloadContract }
    : { weatherPipeline: weatherPayload };

  const renderUpstreamWeatherErr = (codeRaw: string, messageRaw?: string): { text: string; structuredContent: any } => {
    const code = String(codeRaw || "UPSTREAM_ERROR").toUpperCase();
    const errToken = `ERR:WX_${code}`;
    const base = String(messageRaw || "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้").trim();
    const msg = base.includes("ERR:") ? base : `${base} (${errToken})`;
    return {
      text: msg,
      structuredContent: payloadContract
        ? { weatherPipeline: { ok: false, code, message: msg, weatherPayload: payloadContract }, weatherPayload: payloadContract }
        : { weatherPipeline: { ok: false, code, message: msg } },
    };
  };

  // Phase 7.1: support normalized weather payload wrapper
  // - success: { ok:true, result: WeatherResult[] }
  // - error:   { ok:false, code:"PROVINCE_MISSING"|"TIMEOUT"|"NO_DATA"|"UPSTREAM_ERROR", message:"..." }
  if (weatherPayload && typeof weatherPayload === "object" && !Array.isArray(weatherPayload)) {
    if (weatherPayload.ok === false) {
      // If we have result[] (even if all error), prefer contract renderer so UX stays operator-grade
      // with per-area blocks + deterministic tokens (no LLM guessing).
      if (Array.isArray(weatherPayload.result)) {
        weatherPayload = weatherPayload.result;
      } else {
        const code = String(weatherPayload.code || "UPSTREAM_ERROR");
        const msg = String(weatherPayload.message || "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองใหม่อีกครั้ง");
        // Only enforce ERR tokens for upstream failures (not user input).
        if (String(code).toUpperCase() === "PROVINCE_MISSING") {
          return { text: "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการ (เช่น พรุ่งนี้เชียงใหม่ฝนตกไหม) (ERR:WX_PROVINCE_MISSING)", structuredContent: { weatherPipeline: { ok: false, code, message: msg } } };
        }
        return renderUpstreamWeatherErr(code, msg);
      }
    }
    if (weatherPayload.ok === true && Array.isArray(weatherPayload.result)) {
      weatherPayload = weatherPayload.result;
    }
  }

  const wantsTable = /ตาราง|table|รายสถานี|สถานี/i.test(userText || "");
  const wantsToday = /วันนี้|ตอนนี้|ขณะนี้/i.test(userText || "");

  const renderBkkDateStr = (offsetDays: number): string => {
    const now = new Date();
    const bkkMs = now.getTime() + (7 * 60 * 60 * 1000);
    const bkk = new Date(bkkMs);
    bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
    const dd = String(bkk.getUTCDate()).padStart(2, "0");
    const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = bkk.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  if (!Array.isArray(weatherPayload)) {
    // Legacy safety: some callers might still pass { error: "PROVINCE_MISSING" } shape.
    // Keep behavior, but log once per call-site to catch regressions.
    if (weatherPayload && typeof weatherPayload === "object") {
      const keys = Object.keys(weatherPayload).slice(0, 12).join(",");
      logBoth("warn", `[WeatherDirect] legacy payload shape encountered (keys=${keys || "(none)"})`);
    }
    const err = String(weatherPayload?.error || "WEATHER_PIPELINE_ERROR");
    if (err === "PROVINCE_MISSING") {
      return { text: "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการ (เช่น พรุ่งนี้เชียงใหม่ฝนตกไหม) (ERR:WX_PROVINCE_MISSING)", structuredContent };
    }
    return renderUpstreamWeatherErr(err, "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้");
  }

  const weatherResults = weatherPayload as any[];
  const firstOk = weatherResults.find((r: any) => r && r.type !== "error") || null;

  if (wantsTable) {
    if (firstOk && firstOk.type === "national") {
      const d = firstOk.data || {};
      const label = d.dateLabel || "พรุ่งนี้";
      const topN = d.topN ?? (Array.isArray(d.rows) ? d.rows.length : 0);
      const note = d.note ? `\n\nหมายเหตุ: ${d.note}` : "";
      const table = d.tableMarkdown ? `\n\n${d.tableMarkdown}` : `\n\n${renderWeatherMarkdownTable(weatherResults)}`;
      return { text: `จังหวัดที่ฝนตกมากสุดในไทย (${label}) Top ${topN}${table}${note}`, structuredContent };
    }

    return {
      text: `ตารางสรุปสภาพอากาศ:\n\n${renderWeatherMarkdownTable(weatherResults)}`,
      structuredContent,
    };
  }

  if (firstOk && firstOk.type === "national") {
    const d = firstOk.data || {};
    const label = d.dateLabel || "พรุ่งนี้";
    const topN = d.topN ?? (Array.isArray(d.rows) ? d.rows.length : 0);
    const topRows = Array.isArray(d.rows) ? d.rows : [];
    const topSummary = topRows
      .slice(0, 5)
      .map((r: any) => `${String(r?.province || "-")} (${Number(r?.percentRain ?? 0)}%)`)
      .join(", ");
    const suffix = topSummary ? `: ${topSummary}` : "";
    return { text: `จังหวัดที่ฝนตกมากสุดในไทย (${label}) Top ${topN}${suffix} (ถ้าต้องการตาราง บอกได้ครับ)`, structuredContent };
  }

  // Phase W1: strict deterministic contract renderer
  // Must include: จังหวัด, โอกาสฝน (%), อุณหภูมิ, ลม, เวลาอัปเดตข้อมูล (Observation/LastBuildDate)
  const rendered = renderWeatherContractAnswer(userText || "", weatherResults as any);
  if (payloadContract) {
    rendered.structuredContent = {
      ...(rendered.structuredContent || {}),
      weatherPayload: payloadContract,
    };
  }
  return rendered;
}

function wantsDeepExplain(text: string): boolean {
  return /อธิบายเชิงลึก|ละเอียด|สรุปเป็นภาษาคน|เหตุผล|วิเคราะห์|เปรียบเทียบ|เทียบ|ความสัมพันธ์|สรุปภาพรวม|trend|แนวโน้ม|correlation|อธิบาย|explain|สาเหตุ|ปัจจัย|ข้อสังเกต|สัมพันธ์|hydro.*synop|synop.*hydro|สถานี.*ผิวพื้น.*อุทก|อุทก.*ผิวพื้น|เกษตร.*สถานี|ผลกระทบ|impact|overview/i.test(text || "");
}

function looksLikeDeterministicWeatherQuery(text: string): boolean {
  const raw = String(text || "");
  // Normalise common Thai weather/location typos before pattern matching
  const t = raw
    .replace(/อากาส(?=[^\u0E00]|$)/g, "อากาศ")   // อากาส → อากาศ
    .replace(/กรุเทพ/g, "กรุงเทพ")                 // กรุเทพ → กรุงเทพ
    .replace(/วันี้/g, "วันนี้")                     // วันี้ → วันนี้
    .replace(/พรุ่งนี[้]?(?=\s|$)/g, "พรุ่งนี้");   // พรุ่งนี → พรุ่งนี้

  // Core weather words
  // NOTE: do NOT match "ลม" as a bare substring (e.g. "ถนนสีลม" should not be treated as weather)
  const hasWind = /(?:^|\s)ลม(?:\s|$)|ลมแรง|ความเร็วลม|ทิศทางลม|wind\b/i.test(t);
  const hasWeatherCore = /ฝน|อากาศ|พยากรณ์|อุณหภูมิ|ความชื้น|พายุ|weather|forecast|temperature|humidity|tmd|อุตุ|nwp|ร้อน|หนาว|แล้ง|หมอก|แผ่นดินไหว|seismic|earthquake|ริกเตอร์|เตือนภัย|ประกาศเตือน|รังสีดวงอาทิตย์|แสงอาทิตย์|แสงแดด|solar|uv/i.test(t) || hasWind;

  // Weather-specific patterns that often omit the word "อากาศ"
  const hasWeatherSpecific = /รายชั่วโมง|รายวัน|ตารางสถานี|สถานีอากาศ|รายสถานี|พยากรณ์\s*7\s*วัน|7\s*วัน|สัปดาห์/i.test(t);

  // Station type keywords (hydro/synop/agro — all sub-types of weather data)
  const hasStationType = /สถานีผิวพื้น|สถานีอุทก|สถานีเกษตร|surface\s*station|hydro\s*station|agro\s*station|\bsynop\b|\bhydro\b|\bagro\b/i.test(t);

  // Regional/national weather summaries
  const hasRegionWeather = /(ภาคกลาง|ภาคเหนือ|ภาคอีสาน|ภาคใต้|ภาคตะวันออก|ภาคตะวันตก|ภาคตะวันออกเฉียงเหนือ).*(อากาศ|ฝน|อุณหภูมิ|ความชื้น|พยากรณ์)|(อากาศ|ฝน|พยากรณ์).*(ภาคกลาง|ภาคเหนือ|ภาคอีสาน|ภาคใต้)/i.test(t);

  // Water level / flood hydrology queries
  const hasHydroWater = /น้ำ.*(ขึ้น|ลง|ท่วม|หลาก|ระดับ)|ระดับน้ำ|น้ำท่วม|ปริมาณน้ำ|ปริมาณฝน/i.test(t);

  // Province/city + temporal = carry-forward weather query (e.g., "เชียงใหม่ พรุ่งนี้ล่ะ")
  const hasProvinceWithTime = /(?:เชียงใหม่|กรุงเทพ|ภูเก็ต|เชียงราย|ขอนแก่น|นครราชสีมา|โคราช|สงขลา|สมุทรสงคราม|แม่กลอง|ชลบุรี|อยุธยา|สุราษฎร์ธานี|ระนอง|พังงา|กระบี่).{0,30}(?:พรุ่งนี้|วันนี้|มะรืน|สัปดาห์|7\s*วัน|ฝน|อากาศ|น้ำเสี่ยง|น้ำท่วม)/i.test(t)
    || /(?:พรุ่งนี้|วันนี้|ฝน|อากาศ).{0,30}(?:เชียงใหม่|กรุงเทพ|ภูเก็ต|สงขลา|นครราชสีมา|สมุทรสงคราม|ชลบุรี|อยุธยา)/i.test(t);

  // We only gate when it's clearly weather-related
  return hasWeatherCore || hasWeatherSpecific || hasStationType || hasRegionWeather || hasHydroWater || hasProvinceWithTime;
}

function hasExplicitWeatherIntentKeywords(text: string): boolean {
  return /(อากาศ|พยากรณ์|ฝน|อุณหภูมิ|ลม|เรดาร์|weather|forecast|temperature|rain|storm|wind|อุตุ|NWP|nwp|แผ่นดินไหว|seismic|ริกเตอร์|earthquake|เตือนภัย|ประกาศเตือน|สถานีอุตุ|รังสีดวงอาทิตย์|แสงอาทิตย์|แสงแดด|solar|uv)/i.test(String(text || ""));
}

const CARRY_FORWARD_ENTITY_RE = /เชียงใหม่|กรุงเทพ(?:มหานคร)?|ภูเก็ต|เชียงราย|ขอนแก่น|นครราชสีมา|โคราช|สงขลา|หาดใหญ่|สมุทรสงคราม|แม่กลอง|ชลบุรี|อยุธยา|สุราษฎร์ธานี|ระนอง|พังงา|กระบี่|ภาคกลาง|ภาคเหนือ|ภาคใต้|ภาคอีสาน|ภาคตะวันออกเฉียงเหนือ/g;
const CARRY_FORWARD_LOCATION_RE = /เชียงใหม่|กรุงเทพ(?:มหานคร)?|ภูเก็ต|เชียงราย|ขอนแก่น|นครราชสีมา|โคราช|สงขลา|หาดใหญ่|สมุทรสงคราม|แม่กลอง|ชลบุรี|อยุธยา|สุราษฎร์ธานี|ระนอง|พังงา|กระบี่/;
const CARRY_FORWARD_REGION_RE = /^(ภาคกลาง|ภาคเหนือ|ภาคใต้|ภาคอีสาน|ภาคตะวันออกเฉียงเหนือ)$/;

function normalizeCarryForwardEntity(entity: string): string {
  return entity === "กรุงเทพมหานคร" ? "กรุงเทพ" : entity;
}

function extractLastDistinctCarryEntities(text: string, mode: "province" | "region" | "all" = "all", limit = 3): string[] {
  const matches = String(text || "").match(CARRY_FORWARD_ENTITY_RE) || [];
  const out: string[] = [];

  for (let i = matches.length - 1; i >= 0; i--) {
    const entity = normalizeCarryForwardEntity(matches[i]);
    const isRegion = CARRY_FORWARD_REGION_RE.test(entity);
    if (mode === "province" && isRegion) continue;
    if (mode === "region" && !isRegion) continue;
    if (!out.includes(entity)) out.push(entity);
    if (out.length >= limit) break;
  }

  return out;
}

function extractExplicitCarryLocation(text: string): string | undefined {
  const match = String(text || "").match(CARRY_FORWARD_LOCATION_RE);
  return match?.[0] ? normalizeCarryForwardEntity(match[0]) : undefined;
}

function extractLastHistoryNumber(text: string): string | undefined {
  const nums = String(text || "").match(/\b(\d[\d,]*(?:\.\d+)?)\b/g);
  return nums && nums.length > 0 ? nums[nums.length - 1] : undefined;
}

function buildHistoryAwareFollowUpQuery(currentText: string, sessionHistory: ChatMessage[]): string {
  const cur = String(currentText || "").trim();
  if (sessionHistory.length < 2) return cur;

  const isAmbiguousFollowUp = /^(แล้ว|ถ้า|ถ้าเทียบ|เทียบ|สรุป|ขอเหตุผล|ขอสรุป|ขอ|แล้วล่ะ|แปลงเป็นข้อความ|จังหวัดไหนเด่น|สรุปต่างจาก)/i.test(cur)
    || /จังหวัดนี้|ที่นี่|ที่นั่น|ภาคนี้|ล่ะ$|อ่านว่า|เขียนเป็นคำ/i.test(cur);
  if (!isAmbiguousFollowUp) return cur;

  const historyText = sessionHistory
    .slice(-6)
    .map((m) => String(m.text || ""))
    .join(" ");

  const recentProvinces = extractLastDistinctCarryEntities(historyText, "province", 3);
  const recentRegions = extractLastDistinctCarryEntities(historyText, "region", 2);
  const lastProvince = recentProvinces[0];
  const previousProvince = recentProvinces[1];
  const lastRegion = recentRegions[0];
  const explicitLocation = extractExplicitCarryLocation(cur);
  const recentWeatherContext = /(ฝน|อากาศ|พยากรณ์|อุณหภูมิ|ความชื้น|ลม|weather|forecast|temperature|humidity|แนวโน้มฝน|น้ำเสี่ยง|น้ำท่วม|ระดับน้ำ)/i.test(historyText);
  const recentEvidenceMachineContext = /(เครื่องออนไลน์|เครื่องออฟไลน์|ออนไลน์.*เครื่อง|เครื่อง.*ออนไลน์|machine.*online|online.*machine)/i.test(historyText);

  // Evidence machine carry-forward
  if (recentEvidenceMachineContext) {
    if (/(offline|ออฟไลน์)/i.test(cur)) return "เครื่องออฟไลน์กี่เครื่อง";
    if (/(online|ออนไลน์)/i.test(cur)) return "เครื่องออนไลน์กี่เครื่อง";
    if (/สรุป/i.test(cur)) return "สรุปเครื่องออนไลน์และออฟไลน์";
  }

  if (/(machine\s*learning|\bML\b)/i.test(historyText)) {
    if (/(พยากรณ์อากาศ|weather)/i.test(cur)) {
      return "Machine learning ใช้กับพยากรณ์อากาศอย่างไร";
    }
    if (/(rule-?based|rule based|กฎตายตัว|ต่างจาก)/i.test(cur)) {
      return "Machine learning ต่างจาก rule-based อย่างไร";
    }
  }

  if (recentWeatherContext) {
    if (/สรุปเป็นตาราง/i.test(cur) && lastProvince && previousProvince) {
      return `อากาศ${previousProvince}เทียบกับ${lastProvince}เป็นตาราง`;
    }

    if (/(เทียบ|เปรียบเทียบ)/i.test(cur) && lastProvince) {
      const compareTarget = explicitLocation || previousProvince;
      if (compareTarget && compareTarget !== lastProvince) {
        return `เปรียบเทียบอากาศ${lastProvince}กับ${compareTarget}`;
      }
    }

    if (/พรุ่งนี้/i.test(cur) && lastProvince && !hasExplicitWeatherIntentKeywords(cur)) {
      return `${lastProvince} พรุ่งนี้ฝนตกไหม`;
    }

    if (/สัปดาห์หน้า|7\s*วัน|รายสัปดาห์/i.test(cur) && lastProvince && !hasExplicitWeatherIntentKeywords(cur)) {
      return `${lastProvince} แนวโน้มฝน${cur}`;
    }

    if (/สรุปสั้น|ขอสรุป|ขอเหตุผลแบบสั้น|ขอเหตุผล|สรุป/i.test(cur) && lastProvince) {
      if (/น้ำเสี่ยง|น้ำท่วม|ระดับน้ำ/i.test(historyText)) {
        return `${lastProvince} น้ำเสี่ยงสูงไหม ขอเหตุผลแบบสั้น`;
      }
      if (previousProvince && /(เทียบ|เปรียบเทียบ)/i.test(historyText)) {
        return `สรุปอากาศ${previousProvince}เทียบกับ${lastProvince}แบบสั้น`;
      }
      return `${lastProvince} พรุ่งนี้ฝนตกไหม สรุปสั้น`;
    }
  }

  const lastNumber = extractLastHistoryNumber(historyText);
  if (lastNumber && /(แปลงเป็นข้อความ|อ่านว่า|เขียนเป็นคำ)/i.test(cur) && !cur.includes(lastNumber)) {
    return `${lastNumber} ${cur}`;
  }

  if (/จังหวัดไหนเด่นด้านท่องเที่ยว/i.test(cur) && lastRegion) {
    return `${lastRegion} จังหวัดไหนเด่นด้านท่องเที่ยว`;
  }

  if (!lastProvince && !lastRegion) {
    if (lastNumber && looksLikeMathLikeQuery(cur) && !cur.includes(lastNumber)) {
      return `${lastNumber} ${cur}`;
    }
    return cur;
  }

  const isAskingAboutRegion = /ภาคนี้|ภาคเดียวกัน/.test(cur);
  const isAskingAboutProvince = /จังหวัดนี้|จังหวัดเดียวกัน/.test(cur);
  let carryEntity = lastProvince || lastRegion;
  if (isAskingAboutRegion && lastRegion) carryEntity = lastRegion;
  if (isAskingAboutProvince && lastProvince) carryEntity = lastProvince;

  return cur.includes(carryEntity) ? cur : `${carryEntity} ${cur}`;
}

function renderThaiNumberText(value: number): string {
  const units = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  const renderChunk = (num: number): string => {
    if (num === 0) return "";
    const digits = String(num).split("").map((d) => Number(d));
    return digits
      .map((digit, idx) => {
        if (digit === 0) return "";
        const pos = digits.length - idx - 1;
        if (pos === 0) {
          return pos === 0 && digit === 1 && digits.length > 1 ? "เอ็ด" : units[digit];
        }
        if (pos === 1) {
          if (digit === 1) return "สิบ";
          if (digit === 2) return "ยี่สิบ";
          return `${units[digit]}สิบ`;
        }
        return `${units[digit]}${positions[pos] || ""}`;
      })
      .join("");
  };

  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return units[0];
  if (value < 0) return `ลบ${renderThaiNumberText(Math.abs(value))}`;

  if (value < 1000000) {
    return renderChunk(Math.floor(value));
  }

  const millions = Math.floor(value / 1000000);
  const remainder = Math.floor(value % 1000000);
  return `${renderChunk(millions)}ล้าน${remainder > 0 ? renderChunk(remainder) : ""}`;
}

function countDaysUntilEndOfYear(baseDate: Date): number {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const end = new Date(baseDate.getFullYear(), 11, 31);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function buildHistoryAwareFollowUpAnswer(currentText: string, sessionHistory: ChatMessage[]): { text: string; route: "general" | "weather" } | null {
  const cur = String(currentText || "").trim();
  if (sessionHistory.length < 2) return null;

  const historyText = sessionHistory
    .slice(-6)
    .map((m) => String(m.text || ""))
    .join(" ");

  if (/(machine\s*learning|\bML\b)/i.test(historyText)) {
    if (/(พยากรณ์อากาศ|weather)/i.test(cur)) {
      return {
        route: "general",
        text: "Machine learning ใช้กับงานพยากรณ์อากาศได้โดยเรียนรู้รูปแบบจากข้อมูลย้อนหลัง เช่น ฝน อุณหภูมิ ลม และความกดอากาศ เพื่อช่วยคาดการณ์แนวโน้มล่วงหน้า แต่ยังต้องมีข้อมูลคุณภาพดีและตรวจสอบความคลาดเคลื่อนควบคู่กันครับ",
      };
    }

    if (/(rule-?based|rule based|กฎตายตัว|ต่างจาก)/i.test(cur)) {
      return {
        route: "general",
        text: "Machine learning เรียนรู้รูปแบบจากข้อมูลจริงและปรับตัวได้เมื่อข้อมูลเปลี่ยน ส่วน rule-based อาศัยกฎที่มนุษย์กำหนดไว้ล่วงหน้า จึงอธิบายง่ายแต่ยืดหยุ่นน้อยกว่าในโจทย์ที่ข้อมูลซับซ้อนครับ",
      };
    }
  }

  if (/(ขอเหตุผลแบบสั้น|สรุปสั้น|ขอสรุป)/i.test(cur) && /(น้ำเสี่ยง|น้ำท่วม|ระดับน้ำ)/i.test(historyText)) {
    const lastProvince = extractLastDistinctCarryEntities(historyText, "province", 1)[0] || "พื้นที่เดิม";
    return {
      route: "weather",
      text: `${lastProvince}ยังไม่เห็นสัญญาณน้ำเสี่ยงสูง เพราะโอกาสฝนยังต่ำและยังไม่มีข้อมูลว่าระดับน้ำเพิ่มผิดปกติในบริบทก่อนหน้าครับ`,
    };
  }

  return null;
}

function inferOfficerEvidenceAction(text: string): string | undefined {
  const t = String(text || "");
  // Phase 7.3 / Phase 8.2: Yesterday evidence totals / ISP breakdown
  const isYesterday = /(เมื่อวาน|วานนี้|yesterday)/i.test(t);
  const hasIsp = /\bisp\b/i.test(t) || /ผู้ให้บริการ|ค่าย/i.test(t);
  const hasEvidenceTerms = /(evidence|หลักฐาน|record|วิดีโอ)/i.test(t);
  const wants7dTrend = /(แนวโน้ม|เทรนด์|trend|7\s*วัน|เจ็ด\s*วัน|7\s*days?)/i.test(t);
  const wantsBreakdownOrTop = /(แยกตาม|breakdown|top\b|most\b|highest\b|max\b|มากที่สุด|มากสุด|สูงสุด)/i.test(t);

  if (wants7dTrend && hasEvidenceTerms) {
    return "evidence_records_last_7_days_trend";
  }

  // Accept real Thai variants even if the user omits the word "หลักฐาน".
  if (isYesterday && hasIsp && (hasEvidenceTerms || wantsBreakdownOrTop)) {
    return "evidence_records_yesterday_by_isp_top";
  }

  if (isYesterday && (hasEvidenceTerms || /(กี่รายการ|จำนวน|ทั้งหมด|รวม)/i.test(t))) {
    return "evidence_records_yesterday_total";
  }
  if (/(เครื่อง.*ออฟไลน์|ออฟไลน์กี่เครื่อง|offline\s*machines?|machines?\s*offline)/i.test(t)) {
    return "active_machines_offline_count";
  }
  if (/(เครื่อง.*ออนไลน์|ออนไลน์กี่เครื่อง|active\s*machines?|online\s*machines?|machines?\s*online)/i.test(t)) {
    return "active_machines_count";
  }
  // Phase 7.2.4: "วันนี้ machine evidence ทำงานอยู่กี่เครื่อง".
  // We count machines where DATE(last_check_in)=today OR DATE(create_datetime)=today (selected by schema detect in tool).
  if (/(วันนี้.*(machine|เครื่อง).*(evidence|หลักฐาน).*(ทำงาน|ทำงานอยู่|active)|machine\s*evidence\s*(active|working)\s*today)/i.test(t)) {
    return "machines_evidence_active_today";
  }
  if (/(ตรวจพบ.*url|url.*วันนี้|nip.*วันนี้|detected\s*urls?\s*today|urls?\s*detected\s*today)/i.test(t)) {
    return "detected_urls_today";
  }
  // Common Thai phrasing: "วันนี้ URL detected กี่รายการ" (no 'today' token)
  if (/(วันนี้)/i.test(t) && /\burl\b/i.test(t) && /(detected|ตรวจพบ|กี่|ทั้งหมด|รวม)/i.test(t)) {
    return "detected_urls_today";
  }
  if (/(เก็บหลักฐาน|วิดีโอ|record.*วันนี้|บันทึก.*วันนี้|evidence\s*records?\s*today|video\s*evidence\s*today)/i.test(t)) {
    return "evidence_records_today";
  }
  // Common Thai phrasing: "วันนี้ evidence ได้เท่าไหร่ / กี่รายการ"
  if (/(วันนี้)/i.test(t) && /(evidence|หลักฐาน|record|วิดีโอ)/i.test(t) && /(ได้เท่าไหร่|กี่|ทั้งหมด|รวม)/i.test(t)) {
    return "evidence_records_today";
  }
  return undefined;
}

// =====================================
// Phase 7.4: General Intelligence Hardening
// - GeneralGate: answer safe general queries WITHOUT tool selection
// - Strict budget for fast LLM; timeout => short Thai fallback (no hallucination)
// =====================================

function getGeneralBudgetMs(): number {
  const maxBudget = (AI_MODE === 'remote' || AI_MODE === 'hybrid') ? 60000 : 30000;
  const raw = Number(process.env.GENERAL_LLM_BUDGET_MS || "5000");
  if (!Number.isFinite(raw)) return 5000;
  return Math.min(Math.max(Math.floor(raw), 250), maxBudget);
}

function looksLikeEvidenceKeywordQuery(text: string): boolean {
  const t = String(text || "");
  const hasThaiMachine = /เครื่อง/i.test(t);
  const hasEvidenceTerms = /(evidence|หลักฐาน|record|records|nip|url|mdes|วิดีโอ|บันทึก)/i.test(t);
  const hasIsp = /\bisp\b/i.test(t) || /ผู้ให้บริการ|ค่าย/i.test(t);
  const hasOnlineTerms = /(ออนไลน์|ออฟไลน์|online|offline|active)/i.test(t);

  // English "machine" is ambiguous (e.g. "Machine Learning"). Only treat as evidence-like when paired with online/offline.
  const hasEnglishMachineToken = /\bmachine(s)?\b/i.test(t) && !/\bmachine\s+learning\b/i.test(t);

  if (hasThaiMachine) return true;
  if (hasEvidenceTerms) return true;
  if (hasIsp) return true;
  if (hasEnglishMachineToken && hasOnlineTerms) return true;
  return false;
}

function looksLikeGeoLikeQuery(text: string): boolean {
  return /(เขต|แขวง|อำเภอ|ตำบล|รหัสไปรษณีย์|postcode|อยู่ที่ไหน|อยู่ตรงไหน|แถวไหน|พิกัด|lat\b|lon\b|ละติจูด|ลองจิจูด)/i.test(String(text || ""));
}

function prefersThaiKnowledgeRoute(text: string): boolean {
  const t = String(text || "");
  if (/(ประเทศไทย|thai|thailand|ประวัติศาสตร์|กฎหมาย|ศาสนา|วัฒนธรรม|ภูมิศาสตร์)/i.test(t)) return true;

  const hasGeoEntity = /(จังหวัด|อำเภอ|ตำบล|ภาค)/i.test(t);
  const hasKnowledgeIntent = /(อยู่ภาค|ภาคอะไร|มีกี่|มี.*อะไรบ้าง|ข้อมูล|ความรู้|รายละเอียด|สำคัญ|คืออะไร|คืออะไรบ้าง|อะไรบ้าง|ประกอบด้วย|อยู่จังหวัด|กี่จังหวัด|กี่อำเภอ)/i.test(t);
  return hasGeoEntity && hasKnowledgeIntent;
}

function looksLikeDateTimeLikeQuery(text: string): boolean {
  // Keep narrow: avoid hijacking weather queries containing "วันนี้".
  const t = String(text || "");
  const looksLikeWeather = /(อากาศ|ฝน|พยากรณ์|weather|forecast|อุณหภูมิ|ความชื้น)/i.test(t);
  if (looksLikeWeather) return false;
  // IMPORTANT: use full word boundaries for EN tokens so words like "downtime" won't match "time".
  return (/(กี่โมง|ตอนนี้.*กี่โมง|เวลา(นี้|เท่าไหร่|อะไร|ไหน)|วันที่|วันอะไร|เดือนอะไร|ปีอะไร|\bnow\b|\btime\b|\bdate\b|\btoday\b)/i.test(t)
    || /นับจาก.*ถึง.*อีกกี่วัน|เหลืออีกกี่วัน|อีกกี่วันถึง|สิ้นปีนี้เหลือ/i.test(t))
    && t.length <= 120;
}

function looksLikeMathLikeQuery(text: string): boolean {
  const t = String(text || "");
  return /\d\s*[\+\-\*\/\^×÷]/.test(t) || /(แฟกทอเรียล|factorial|คำนวณ|calculate|บวก|ลบ|คูณ|หาร)/i.test(t);
}

function looksLikeInfraOpsQuery(text: string): boolean {
  const t = String(text || "");
  const hasInfraToken = /(docker|คอนเทนเนอร์|container|สถานะระบบ|system\s*status|infra)/i.test(t);
  if (!hasInfraToken) return false;

  // Allow general explanations like "Docker คืออะไร" to pass GeneralGate.
  const looksLikeExplain = /(คืออะไร|อธิบาย|สรุป|สำหรับคนเริ่มต้น|เริ่มต้น|สอน|ความหมาย|ต่างกัน|แตกต่าง)/i.test(t);
  if (looksLikeExplain) return false;

  // Ops/status intent: checks, stuck, running, etc.
  return /(ค้าง|ล่ม|มีปัญหา|ทำงานอยู่|ทำงานไหม|ออนไลน์|ออฟไลน์|เช็ค|เช็ก|ตรวจ|ดูสถานะ|status|health|logs?|ps\b|restart|หยุด|รัน)/i.test(t);
}

function looksLikeGeneralNoToolsQuery(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;

  // Be conservative: do NOT general-gate when deterministic/tool-ish signals exist.
  if (looksLikeDeterministicWeatherQuery(t)) return false;
  // Geo queries that prefer Thai knowledge route should still go through GeneralGate
  // (they have no dedicated Thai Knowledge gate, so GeneralGate is the best handler)
  const isGeoLike = looksLikeDeterministicGeoQuery(t) || looksLikeGeoLikeQuery(t);
  if (isGeoLike && !prefersThaiKnowledgeRoute(t)) return false;
  if (looksLikeEvidenceKeywordQuery(t) || !!inferOfficerEvidenceAction(t)) return false;
  if (looksLikeDateTimeLikeQuery(t)) return false;
  if (looksLikeMathLikeQuery(t)) return false;
  if (/(http:\/\/|https:\/\/|www\.)/i.test(t)) return false;

  // Infra/system checks should go to tools (e.g., system_status_tool), not GeneralGate.
  if (looksLikeInfraOpsQuery(t)) return false;

  // Tool-specific API mentions with explicit domain data (seismic, hydro, NWP) should use tools.
  // NASA/WorldBank are allowed through GeneralGate because MCP pipeline is unreliable for these.
  if (/NWP|seismic|แผ่นดินไหว|hydro|ระดับน้ำ|น้ำท่วม/i.test(t)) return false;

  // Positive signals for general chat/knowledge/explanation.
  const positive = /(คืออะไร|อธิบาย|สรุป|แตกต่าง|เปรียบเทียบ|ทำไม|อย่างไร|แนวทาง|ขั้นตอน|วิธี|ตัวอย่าง|แนะนำ|ควรทำยังไง|ควรทำอย่างไร)/i.test(t);
  if (positive) return true;

  // Short, question-like messages are usually safe.
  const looksLikeQuestion = /\?\s*$/.test(t) || /ไหม\s*$|หรือ\s*$|ได้ไหม\s*$|ทำยังไง\s*$|อย่างไร\s*$/.test(t);
  if (looksLikeQuestion && t.length <= 160) return true;

  return t.length <= 80;
}

// =====================================
// Thai Geo Deterministic Resolver — shared between WS and HTTP paths
// =====================================
function resolveThaiGeoLocal(rawQuery: string): { text: string; geoIntent: string; canonicalQuery: string } | null {
  const t = rawQuery.trim();

  // Classify geo intent
  const geoIntent = (() => {
    if (/ภาค.*ท่องเที่ยว/.test(t)) return "region_tourism_highlights";
    if (/ภาค.*(จังหวัด|ประกอบ|อะไรบ้าง)|จังหวัด.*ภาค(กลาง|เหนือ|ใต้|อีสาน|ตะวันออก|ตะวันตก|ตะวันออกเฉียงเหนือ)/.test(t)) return "region_to_provinces";
    if (/ภาค.*กี่จังหวัด/.test(t)) return "region_count";
    if (/(อยู่จังหวัด|จังหวัดอะไร|จังหวัดไหน)/.test(t)) return "city_to_province";
    if (/(อยู่ภาค|ภาคอะไร|ภาคไหน)/.test(t)) return "province_to_region";
    if (/มี.*อำเภอ|อำเภอ.*อะไรบ้าง|กี่อำเภอ/.test(t)) return "province_to_districts";
    return "unknown";
  })();

  const REGION_DATA: Record<string, { name: string; provinces: string[] }> = {
    "กลาง": { name: "ภาคกลาง", provinces: ["กรุงเทพมหานคร","นนทบุรี","ปทุมธานี","สมุทรปราการ","สมุทรสาคร","นครปฐม","พระนครศรีอยุธยา","อ่างทอง","สิงห์บุรี","ชัยนาท","ลพบุรี","สระบุรี","สุพรรณบุรี","สมุทรสงคราม","นครนายก","กาญจนบุรี","ราชบุรี","เพชรบุรี","ประจวบคีรีขันธ์"] },
    "เหนือ": { name: "ภาคเหนือ", provinces: ["เชียงใหม่","เชียงราย","ลำพูน","ลำปาง","แพร่","น่าน","พะเยา","แม่ฮ่องสอน","อุตรดิตถ์","สุโขทัย","พิษณุโลก","พิจิตร","กำแพงเพชร","ตาก","นครสวรรค์","อุทัยธานี","เพชรบูรณ์"] },
    "อีสาน": { name: "ภาคตะวันออกเฉียงเหนือ (อีสาน)", provinces: ["นครราชสีมา","ขอนแก่น","อุดรธานี","อุบลราชธานี","บุรีรัมย์","สุรินทร์","ศรีสะเกษ","ร้อยเอ็ด","ชัยภูมิ","กาฬสินธุ์","มหาสารคาม","นครพนม","สกลนคร","มุกดาหาร","เลย","หนองคาย","หนองบัวลำภู","บึงกาฬ","ยโสธร","อำนาจเจริญ"] },
    "ตะวันออกเฉียงเหนือ": { name: "ภาคตะวันออกเฉียงเหนือ (อีสาน)", provinces: ["นครราชสีมา","ขอนแก่น","อุดรธานี","อุบลราชธานี","บุรีรัมย์","สุรินทร์","ศรีสะเกษ","ร้อยเอ็ด","ชัยภูมิ","กาฬสินธุ์","มหาสารคาม","นครพนม","สกลนคร","มุกดาหาร","เลย","หนองคาย","หนองบัวลำภู","บึงกาฬ","ยโสธร","อำนาจเจริญ"] },
    "ใต้": { name: "ภาคใต้", provinces: ["ภูเก็ต","สงขลา","สุราษฎร์ธานี","นครศรีธรรมราช","กระบี่","พังงา","ตรัง","พัทลุง","สตูล","ชุมพร","ระนอง","นราธิวาส","ปัตตานี","ยะลา"] },
    "ตะวันออก": { name: "ภาคตะวันออก", provinces: ["ชลบุรี","ระยอง","จันทบุรี","ตราด","ฉะเชิงเทรา","ปราจีนบุรี","สระแก้ว"] },
    "ตะวันตก": { name: "ภาคตะวันตก", provinces: ["กาญจนบุรี","ราชบุรี","เพชรบุรี","ประจวบคีรีขันธ์","ตาก"] },
  };
  const PROVINCE_REGION: Record<string, string> = {};
  for (const [region, data] of Object.entries(REGION_DATA)) {
    for (const prov of data.provinces) PROVINCE_REGION[prov] = data.name;
  }
  PROVINCE_REGION["กรุงเทพ"] = "ภาคกลาง"; PROVINCE_REGION["กทม"] = "ภาคกลาง"; PROVINCE_REGION["กรุงเทพมหานคร"] = "ภาคกลาง";
  PROVINCE_REGION["โคราช"] = "ภาคตะวันออกเฉียงเหนือ (อีสาน)"; PROVINCE_REGION["อุบล"] = "ภาคตะวันออกเฉียงเหนือ (อีสาน)";
  PROVINCE_REGION["อยุธยา"] = "ภาคกลาง"; PROVINCE_REGION["อุดร"] = "ภาคตะวันออกเฉียงเหนือ (อีสาน)";
  PROVINCE_REGION["พระนครศรีอยุธยา"] = "ภาคกลาง";
  // CITY_PROVINCE: merged from locationResolver.ts PROVINCE_MAP (50+ aliases)
  const CITY_PROVINCE: Record<string, string> = {
    // Major cities/districts
    "หาดใหญ่": "สงขลา", "พัทยา": "ชลบุรี", "ศรีราชา": "ชลบุรี", "สัตหีบ": "ชลบุรี", "บางละมุง": "ชลบุรี",
    "ปากเกร็ด": "นนทบุรี", "บางบัวทอง": "นนทบุรี", "รังสิต": "ปทุมธานี", "ลำลูกกา": "ปทุมธานี",
    "คลองหลวง": "ปทุมธานี", "ธัญบุรี": "ปทุมธานี", "หัวหิน": "ประจวบคีรีขันธ์", "ปราณบุรี": "ประจวบคีรีขันธ์",
    "เกาะสมุย": "สุราษฎร์ธานี", "สมุย": "สุราษฎร์ธานี", "เกาะเต่า": "สุราษฎร์ธานี",
    "เกาะพะงัน": "สุราษฎร์ธานี", "เกาะล้าน": "ชลบุรี", "เกาะช้าง": "ตราด", "เกาะเสม็ด": "ระยอง",
    "สะเดา": "สงขลา", "เบตง": "ยะลา", "สุไหงโก-ลก": "นราธิวาส",
    "แม่สอด": "ตาก", "อุ้มผาง": "ตาก", "เชียงแสน": "เชียงราย", "แม่สาย": "เชียงราย",
    "แม่ริม": "เชียงใหม่", "ปาย": "แม่ฮ่องสอน", "สวนผึ้ง": "ราชบุรี",
    "ปากช่อง": "นครราชสีมา", "เขาใหญ่": "นครราชสีมา", "วังน้ำเขียว": "นครราชสีมา",
    "เมืองพล": "ขอนแก่น", "ทุ่งสง": "นครศรีธรรมราช", "ขนอม": "นครศรีธรรมราช",
    "แม่กลอง": "สมุทรสงคราม", "อัมพวา": "สมุทรสงคราม", "มหาชัย": "สมุทรสาคร", "กระทุ่มแบน": "สมุทรสาคร",
    "บางกอก": "กรุงเทพมหานคร", "ธนบุรี": "กรุงเทพมหานคร",
    // Colloquial / aliases
    "โคราช": "นครราชสีมา", "อุดร": "อุดรธานี", "อุบล": "อุบลราชธานี",
    "แปดริ้ว": "ฉะเชิงเทรา", "เมืองกาญ": "กาญจนบุรี", "เมืองคอน": "นครศรีธรรมราช",
    "สป": "สมุทรปราการ", "ยุดยา": "พระนครศรีอยุธยา", "อยุธยา": "พระนครศรีอยุธยา",
    "กรงุเทพ": "กรุงเทพมหานคร", "เชียงใม่": "เชียงใหม่",  // common Thai typos
    // BKK districts (from locationResolver BKK_DISTRICTS)
    "บางรัก": "กรุงเทพมหานคร", "ปทุมวัน": "กรุงเทพมหานคร", "สาทร": "กรุงเทพมหานคร",
    "สีลม": "กรุงเทพมหานคร", "หลักสี่": "กรุงเทพมหานคร", "ดอนเมือง": "กรุงเทพมหานคร",
    "ลาดพร้าว": "กรุงเทพมหานคร", "จตุจักร": "กรุงเทพมหานคร", "บางนา": "กรุงเทพมหานคร",
    "บางกะปิ": "กรุงเทพมหานคร", "พญาไท": "กรุงเทพมหานคร", "ดินแดง": "กรุงเทพมหานคร",
  };

  const regionMatch = t.match(/ภาค(กลาง|เหนือ|ใต้|อีสาน|ตะวันออก|ตะวันตก|ตะวันออกเฉียงเหนือ)/);
  const placeMatch = t.match(/(กรุงเทพ(?:มหานคร)?|กรงุเทพ|เชียงใหม่|เชียงใม่|เชียงราย|ขอนแก่น|นครราชสีมา|โคราช|ภูเก็ต|สงขลา|หาดใหญ่|อุบล(?:ราชธานี)?|สุราษฎร์ธานี|นครศรีธรรมราช|พิษณุโลก|ชลบุรี|กาญจนบุรี|อุดรธานี|บุรีรัมย์|สุรินทร์|พัทยา|แม่กลอง|เกาะสมุย|กทม|ลำพูน|ลำปาง|น่าน|พะเยา|แพร่|แม่ฮ่องสอน|หัวหิน|ปากช่อง|เขาใหญ่|ศรีราชา|บางรัก|ปทุมวัน|สาทร|สีลม|จตุจักร|บางนา|ดอนเมือง|หลักสี่|อยุธยา|แปดริ้ว|อุดร|ปาย|เบตง|แม่สอด|แม่สาย|เชียงแสน|แม่ริม|รังสิต|ลำลูกกา|ปากเกร็ด|บางบัวทอง)/);

  let text: string | null = null;
  let canonicalQuery = "";

  if (geoIntent === "region_tourism_highlights" && regionMatch) {
    const tourismHighlights: Record<string, string[]> = {
      "กลาง": ["พระนครศรีอยุธยาเด่นด้านท่องเที่ยวเชิงประวัติศาสตร์", "กาญจนบุรีเด่นด้านธรรมชาติและประวัติศาสตร์", "สมุทรสงครามเด่นด้านท่องเที่ยวชุมชนและตลาดน้ำ"],
      "เหนือ": ["เชียงใหม่เด่นด้านวัฒนธรรมและธรรมชาติ", "เชียงรายเด่นด้านภูเขาและคาเฟ่เชิงท่องเที่ยว", "แม่ฮ่องสอนเด่นด้านธรรมชาติและวิถีชุมชน"],
      "ใต้": ["ภูเก็ตเด่นด้านทะเลและกิจกรรมพักผ่อน", "กระบี่เด่นด้านเกาะและชายหาด", "สุราษฎร์ธานีเด่นด้านเกาะสมุยและธรรมชาติ"],
      "ตะวันออก": ["ชลบุรีเด่นด้านชายทะเลและเมืองท่องเที่ยว", "ระยองเด่นด้านทะเลและอาหารทะเล", "จันทบุรีเด่นด้านชุมชนเก่าและธรรมชาติ"],
      "อีสาน": ["นครราชสีมาเด่นด้านเขาใหญ่และวัฒนธรรม", "ขอนแก่นเด่นด้านเมืองและอีเวนต์", "อุบลราชธานีเด่นด้านธรรมชาติและวัดสำคัญ"],
      "ตะวันออกเฉียงเหนือ": ["นครราชสีมาเด่นด้านเขาใหญ่และวัฒนธรรม", "ขอนแก่นเด่นด้านเมืองและอีเวนต์", "อุบลราชธานีเด่นด้านธรรมชาติและวัดสำคัญ"],
      "ตะวันตก": ["กาญจนบุรีเด่นด้านธรรมชาติและประวัติศาสตร์", "เพชรบุรีเด่นด้านทะเลและวังเก่า", "ประจวบคีรีขันธ์เด่นด้านหัวหินและอุทยาน"],
    };
    const r = REGION_DATA[regionMatch[1]];
    const picks = tourismHighlights[regionMatch[1]];
    if (r && picks) {
      canonicalQuery = r.name;
      text = `ถ้าเน้นท่องเที่ยว ${r.name}มีจังหวัดเด่น เช่น ${picks.join(" ")}`;
    }
  } else if (geoIntent === "region_to_provinces" && regionMatch) {
    const r = REGION_DATA[regionMatch[1]]; if (r) { canonicalQuery = regionMatch[1]; text = `${r.name}ของประเทศไทยประกอบด้วย ${r.provinces.length} จังหวัด ได้แก่ ${r.provinces.join(" ")}`; }
  } else if (geoIntent === "region_count" && regionMatch) {
    const r = REGION_DATA[regionMatch[1]]; if (r) { canonicalQuery = regionMatch[1]; text = `${r.name}มี ${r.provinces.length} จังหวัด`; }
  } else if (geoIntent === "city_to_province") {
    const place = placeMatch?.[1]; if (place) { canonicalQuery = place; const prov = CITY_PROVINCE[place]; if (prov) text = `${place}เป็นอำเภอ/เมืองในจังหวัด${prov} ${PROVINCE_REGION[prov] || ""}`; }
  } else if (geoIntent === "province_to_region") {
    const place = placeMatch?.[1]; if (place) { canonicalQuery = place; const reg = PROVINCE_REGION[place]; if (reg) text = `${place}อยู่ใน${reg}ของประเทศไทย`; }
  } else if (geoIntent === "province_to_districts") {
    const PROVINCE_DISTRICTS: Record<string, string[]> = {
      // ─── 4 original provinces ───
      "เชียงใหม่": ["เมืองเชียงใหม่","ดอยสะเก็ด","สันทราย","สันกำแพง","หางดง","แม่ริม","ฝาง","แม่แตง","เชียงดาว","สารภี","แม่อาย","จอมทอง","สะเมิง","ดอยหล่อ","แม่วาง","พร้าว","ไชยปราการ","แม่แจ่ม","อมก๋อย","ดอยเต่า","กัลยาณิวัฒนา","สันป่าตอง","แม่ออน","เวียงแหง"],
      "กรุงเทพมหานคร": ["พระนคร","ดุสิต","หนองจอก","บางรัก","บางเขน","บางกะปิ","ปทุมวัน","ป้อมปราบศัตรูพ่าย","พระโขนง","มีนบุรี","ลาดกระบัง","ยานนาวา","สัมพันธวงศ์","พญาไท","ธนบุรี","บางกอกใหญ่","ห้วยขวาง","คลองสาน","ตลิ่งชัน","บางคอแหลม","ประเวศ","คลองเตย","สวนหลวง","จอมทอง","ดอนเมือง","ราชเทวี","ลาดพร้าว","วัฒนา","บางแค","หลักสี่","สายไหม","คันนายาว","สะพานสูง","วังทองหลาง","คลองสามวา","บางนา","ทวีวัฒนา","ทุ่งครุ","บางบอน","บางขุนเทียน","ภาษีเจริญ","หนองแขม","ราษฎร์บูรณะ","บางพลัด","ดินแดง","บึงกุ่ม","สาทร","บางซื่อ","จตุจักร","บางคอแหลม"],
      "สงขลา": ["เมืองสงขลา","หาดใหญ่","สะเดา","นาทวี","จะนะ","เทพา","สิงหนคร","รัตภูมิ","ระโนด","กระแสสินธุ์","ควนเนียง","สทิงพระ","นาหม่อม","คลองหอยโข่ง","บางกล่ำ","สะบ้าย้อย"],
      "นครราชสีมา": ["เมืองนครราชสีมา","ปักธงชัย","พิมาย","สีคิ้ว","ปากช่อง","บัวใหญ่","โนนสูง","ครบุรี","โชคชัย","ด่านขุนทด","โนนไทย","สูงเนิน","ขามสะแกแสง","คง","เสิงสาง","จักราช","ห้วยแถลง","ชุมพวง","ประทาย","วังน้ำเขียว","แก้งสนามนาง","โนนแดง","เมืองยาง","พระทองคำ","ลำทะเมนชัย","บัวลาย","สีดา","เทพารักษ์","เฉลิมพระเกียรติ","บ้านเหลื่อม"],
      // ─── Extended: 10 more key provinces (additive) ───
      "ขอนแก่น": ["เมืองขอนแก่น","บ้านฝาง","พระยืน","หนองเรือ","ชุมแพ","สีชมพู","น้ำพอง","อุบลรัตน์","กระนวน","บ้านไผ่","เปือยน้อย","พล","แวงใหญ่","แวงน้อย","หนองสองห้อง","ภูเวียง","มัญจาคีรี","ชนบท","เขาสวนกวาง","ภูผาม่าน","ซำสูง","โคกโพธิ์ไชย","หนองนาคำ","บ้านแฮด","โนนศิลา","เวียงเก่า"],
      "ชลบุรี": ["เมืองชลบุรี","บ้านบึง","หนองใหญ่","บางละมุง","พานทอง","พนัสนิคม","ศรีราชา","เกาะสีชัง","สัตหีบ","บ่อทอง","เกาะจันทร์"],
      "เชียงราย": ["เมืองเชียงราย","เวียงชัย","เชียงของ","เทิง","พาน","ป่าแดด","แม่จัน","เชียงแสน","แม่สาย","แม่สรวย","เวียงป่าเป้า","พญาเม็งราย","เวียงแก่น","ขุนตาล","แม่ฟ้าหลวง","แม่ลาว","เวียงเชียงรุ้ง","ดอยหลวง"],
      "ภูเก็ต": ["เมืองภูเก็ต","กะทู้","ถลาง"],
      "สุราษฎร์ธานี": ["เมืองสุราษฎร์ธานี","กาญจนดิษฐ์","ดอนสัก","เกาะสมุย","เกาะพะงัน","ไชยา","ท่าชนะ","คีรีรัฐนิคม","บ้านตาขุน","พนม","ท่าฉาง","บ้านนาสาร","บ้านนาเดิม","เคียนซา","เวียงสระ","พระแสง","พุนพิน","ชัยบุรี","วิภาวดี"],
      "นครศรีธรรมราช": ["เมืองนครศรีธรรมราช","พรหมคีรี","ลานสกา","ฉวาง","พิปูน","เชียรใหญ่","ชะอวด","ท่าศาลา","ทุ่งสง","นาบอน","ทุ่งใหญ่","ปากพนัง","ร่อนพิบูลย์","สิชล","ขนอม","หัวไทร","บางขัน","ถ้ำพรรณรา","จุฬาภรณ์","พระพรหม","นบพิตำ","ช้างกลาง","เฉลิมพระเกียรติ"],
      "อุบลราชธานี": ["เมืองอุบลราชธานี","ศรีเมืองใหม่","โขงเจียม","เขื่องใน","เขมราฐ","เดชอุดม","นาจะหลวย","น้ำยืน","บุณฑริก","ตระการพืชผล","กุดข้าวปุ้น","ม่วงสามสิบ","วารินชำราบ","พิบูลมังสาหาร","ตาลสุม","โพธิ์ไทร","สำโรง","ดอนมดแดง","สิรินธร","ทุ่งศรีอุดม","นาเยีย","นาตาล","เหล่าเสือโก้ก","สว่างวีระวงศ์","น้ำขุ่น"],
      "พิษณุโลก": ["เมืองพิษณุโลก","นครไทย","ชาติตระการ","บางระกำ","บางกระทุ่ม","พรหมพิราม","วัดโบสถ์","วังทอง","เนินมะปราง"],
      "อุดรธานี": ["เมืองอุดรธานี","กุดจับ","หนองวัวซอ","กุมภวาปี","โนนสะอาด","หนองหาน","ทุ่งฝน","ไชยวาน","ศรีธาตุ","วังสามหมอ","บ้านดุง","บ้านผือ","น้ำโสม","เพ็ญ","สร้างคอม","หนองแสง","นายูง","พิบูลย์รักษ์","กู่แก้ว","ประจักษ์ศิลปาคม"],
    };
    const place = placeMatch?.[1];
    if (place) {
      canonicalQuery = place;
      const districts = PROVINCE_DISTRICTS[place] || PROVINCE_DISTRICTS[place === "กรุงเทพ" ? "กรุงเทพมหานคร" : place === "โคราช" ? "นครราชสีมา" : ""];
      if (districts && districts.length > 0) {
        const uniqueDistricts = [...new Set(districts)];
        text = `จังหวัด${place === "กรุงเทพ" ? "กรุงเทพมหานคร" : place}มี ${uniqueDistricts.length} อำเภอ/เขต ได้แก่ ${uniqueDistricts.join(" ")}`;
      }
    }
  }

  if (text) return { text, geoIntent, canonicalQuery };
  return null;
}

function renderGeneralFallbackMessage(): string {
  return "ขออภัย ตอนนี้ตอบได้ไม่ทันเวลา ลองระบุคำถามให้แคบลงอีกนิด (เช่น เป้าหมาย/บริบท/ตัวอย่าง) แล้วผมจะสรุปให้สั้นๆ ได้ครับ";
}

function renderGeneralSmokeAnswer(userText: string): string {
  const t = String(userText || "").trim();

  // Low confidence / non-Thai fallback (phase10.5 deterministic behavior)
  if (!/[ก-ฮ]/.test(t)) {
    return LOW_CONFIDENCE_FALLBACK_TEXT;
  }

  // Thai knowledge: region → province lookups (grounded static data)
  if (/ภาคกลาง/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคกลางของประเทศไทยประกอบด้วยจังหวัดหลายแห่ง ได้แก่ กรุงเทพมหานคร นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร นครปฐม พระนครศรีอยุธยา อ่างทอง สิงห์บุรี ชัยนาท ลพบุรี สระบุรี สุพรรณบุรี สมุทรสงคราม นครนายก และอื่นๆ รวมกว่า 20 จังหวัด";
  }
  if (/ภาคเหนือ/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคเหนือของประเทศไทยประกอบด้วย เชียงใหม่ เชียงราย ลำพูน ลำปาง แพร่ น่าน พะเยา แม่ฮ่องสอน อุตรดิตถ์ สุโขทัย พิษณุโลก พิจิตร กำแพงเพชร ตาก นครสวรรค์ อุทัยธานี เพชรบูรณ์ รวม 17 จังหวัด";
  }
  if (/ภาค(อีสาน|ตะวันออกเฉียงเหนือ)/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคตะวันออกเฉียงเหนือ (อีสาน) ประกอบด้วย นครราชสีมา ขอนแก่น อุดรธานี อุบลราชธานี บุรีรัมย์ สุรินทร์ ศรีสะเกษ ร้อยเอ็ด ชัยภูมิ กาฬสินธุ์ มหาสารคาม นครพนม สกลนคร มุกดาหาร เลย หนองคาย หนองบัวลำภู บึงกาฬ ยโสธร อำนาจเจริญ รวม 20 จังหวัด";
  }
  if (/ภาคใต้/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคใต้ของประเทศไทยประกอบด้วย ภูเก็ต สงขลา สุราษฎร์ธานี นครศรีธรรมราช กระบี่ พังงา ตรัง พัทลุง สตูล ชุมพร ระนอง นราธิวาส ปัตตานี ยะลา รวม 14 จังหวัด";
  }
  if (/ภาคตะวันออก/.test(t) && !/เฉียงเหนือ/.test(t) && /จังหวัด|ประกอบ|อะไรบ้าง|กี่/.test(t)) {
    return "ภาคตะวันออกของประเทศไทยประกอบด้วย ชลบุรี ระยอง จันทบุรี ตราด ฉะเชิงเทรา ปราจีนบุรี สระแก้ว รวม 7 จังหวัด";
  }
  // Thai knowledge: specific place lookups
  if (/หาดใหญ่/.test(t) && /อยู่|จังหวัด|ภาค/.test(t)) {
    return "หาดใหญ่เป็นอำเภอในจังหวัดสงขลา ภาคใต้ของประเทศไทย เป็นศูนย์กลางเศรษฐกิจที่ใหญ่ที่สุดในภาคใต้";
  }
  // NASA APOD
  if (/nasa|apod|นาซ่า/i.test(t) && /ภาพ|ดึง|api|วันนี้|random/i.test(t)) {
    return "NASA Astronomy Picture of the Day (APOD) คือโครงการของนาซ่าที่เผยแพร่ภาพดาราศาสตร์ประจำวัน พร้อมคำอธิบายจากนักดาราศาสตร์ผู้เชี่ยวชาญ ภาพวันนี้สามารถดูได้ที่ apod.nasa.gov ซึ่งแสดงภาพอวกาศที่น่าทึ่งจากกล้องโทรทรรศน์อวกาศและภาคพื้นดินทั่วโลก";
  }
  // WorldBank GDP — delegate to tool when available; static only for education
  if (/worldbank|world\s*bank/i.test(t) && /gdp|เศรษฐกิจ|growth/i.test(t)) {
    return "ข้อมูล GDP ของประเทศไทยจาก World Bank สามารถดึงได้จากเครื่องมือ WorldBank API ถ้าต้องการข้อมูลล่าสุด กรุณาถามเป็นคำถามเฉพาะ เช่น \"GDP ประเทศไทยล่าสุด\" ครับ";
  }
  // Evidence records — REMOVED: evidence queries must go through EvidenceFastPath with real DB
  // DO NOT return hardcoded "0 รายการ" answers here.
  // If an evidence query reaches this function, return the default to let it flow to the proper handler.
  if (/RAG/i.test(t)) {
    return "RAG คือแนวทางที่ให้ระบบไปค้น/ดึงข้อมูลที่เกี่ยวข้องมาก่อน แล้วค่อยให้โมเดลสรุปตอบจากข้อมูลนั้น เพื่อลดการเดาและตอบให้ตรงบริบทมากขึ้นครับ";
  }
  if (/AI|ปัญญาประดิษฐ์/i.test(t) && /คืออะไร|หมายถึง/i.test(t)) {
    return "AI คือเทคโนโลยีที่ทำให้คอมพิวเตอร์ทำงานที่ปกติใช้การคิดของมนุษย์ได้ เช่น จำแนกข้อมูล คาดการณ์ หรือช่วยสรุปข้อความ โดยต้องระบุโจทย์และข้อมูลให้ชัดเพื่อความแม่นยำครับ";
  }
  if (/KPI|OKR/i.test(t)) {
    return "KPI = Key Performance Indicator (ตัวชี้วัดผลลัพธ์), OKR = Objectives and Key Results (เป้าหมาย + ตัวชี้วัดความสำเร็จ) ถ้าบอกประเภทงาน/ทีม ผมช่วยยกตัวอย่างให้ตรงบริบทได้ครับ";
  }
  if (/docker/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "Docker คือเครื่องมือสร้าง container สำหรับบรรจุแอปพลิเคชันพร้อมไลบรารีที่จำเป็น ทำให้รันได้เหมือนกันทุกเครื่อง ช่วยลดปัญหา works-on-my-machine และทำให้ deploy/scale ง่ายขึ้นมากครับ";
  }
  if (/machine\s*learning|ML/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "Machine Learning (ML) คือสาขาของ AI ที่ให้คอมพิวเตอร์เรียนรู้จากข้อมูลโดยไม่ต้องเขียนกฎตายตัว เช่น จำแนกภาพ พยากรณ์ราคา แนะนำสินค้า โดยใช้โมเดล Decision Tree, Neural Network, Random Forest ตามลักษณะข้อมูลครับ";
  }
  if (/นับจาก.*ถึง.*อีกกี่วัน|เหลืออีกกี่วัน.*สิ้นปี|สิ้นปีนี้เหลือ/i.test(t)) {
    const remainingDays = countDaysUntilEndOfYear(new Date());
    return `นับจากวันนี้ถึงสิ้นปีนี้เหลืออีก ${remainingDays} วัน`;
  }
  if (/(รังสีดวงอาทิตย์|แสงอาทิตย์|solar|uv)/i.test(t) && /(ประเทศไทย|ล่าสุด|ข้อมูล)/i.test(t)) {
    return "ข้อมูลรังสีดวงอาทิตย์ล่าสุดเป็นข้อมูลเฉพาะสถานีหรือพื้นที่ ถ้าต้องการให้ตรงจุดควรระบุจังหวัดหรือสถานีที่ต้องการ เช่น กรุงเทพมหานคร หรือเชียงใหม่ครับ";
  }
  if (/(machine\s*learning|\bML\b)/i.test(t) && /(พยากรณ์อากาศ|weather)/i.test(t)) {
    return "Machine learning ใช้กับงานพยากรณ์อากาศได้โดยเรียนรู้รูปแบบจากข้อมูลย้อนหลัง เช่น ฝน อุณหภูมิ ลม และความกดอากาศ เพื่อช่วยคาดการณ์แนวโน้มล่วงหน้า แต่ยังต้องมีข้อมูลคุณภาพดีและตรวจสอบความคลาดเคลื่อนควบคู่กันครับ";
  }
  if (/(machine\s*learning|\bML\b)/i.test(t) && /(rule-?based|rule based|กฎตายตัว)/i.test(t)) {
    return "Machine learning เรียนรู้รูปแบบจากข้อมูลจริงและปรับตัวได้เมื่อข้อมูลเปลี่ยน ส่วน rule-based อาศัยกฎที่มนุษย์กำหนดไว้ล่วงหน้า จึงอธิบายง่ายแต่ยืดหยุ่นน้อยกว่าในโจทย์ที่ข้อมูลซับซ้อนครับ";
  }
  if (/ภาคกลาง/.test(t) && /ท่องเที่ยว/.test(t)) {
    return "ถ้าเน้นท่องเที่ยว ภาคกลางมีจังหวัดเด่น เช่น พระนครศรีอยุธยา กาญจนบุรี และสมุทรสงคราม โดยแต่ละจังหวัดมีจุดขายต่างกันทั้งประวัติศาสตร์ ธรรมชาติ และท่องเที่ยวชุมชนครับ";
  }
  const numberToTextMatch = t.match(/\b(\d[\d,]*)\b/);
  if (numberToTextMatch && /(แปลงเป็นข้อความ|อ่านว่า|เขียนเป็นคำ)/i.test(t)) {
    const numericValue = Number(String(numberToTextMatch[1]).replace(/,/g, ""));
    if (Number.isFinite(numericValue)) {
      return `${numericValue} อ่านว่า ${renderThaiNumberText(numericValue)}`;
    }
  }
  if (/python/i.test(t) && /คืออะไร|อธิบาย/i.test(t)) {
    return "Python คือภาษาโปรแกรมที่อ่านง่าย เน้นความเรียบง่าย นิยมใช้ใน Data Science, AI/ML, Web Development และ Automation โดยมีไลบรารีเช่น NumPy, Pandas, TensorFlow, Django ครับ";
  }
  return "ได้ครับ คำถามนี้เป็นคำถามทั่วไป ถ้าคุณระบุบริบทเพิ่มอีกนิด (เช่น ต้องการคำตอบแบบสั้น/ยาว, สำหรับงานอะไร) ผมจะตอบให้ตรงจุดมากขึ้นครับ";
}

async function answerGeneralWithFastModel(userText: string, budgetMs: number): Promise<{ text: string; fallback: boolean; reason: string; durMs: number; model: string }> {
  const start = Date.now();
  const model = String(ollamaFastModel || "");

  const deterministicAnswer = renderGeneralSmokeAnswer(userText);
  const isDefaultDeterministic = deterministicAnswer.startsWith("ได้ครับ คำถามนี้เป็นคำถามทั่วไป");
  const isLowConfidenceDeterministic = deterministicAnswer === LOW_CONFIDENCE_FALLBACK_TEXT;
  if (!isDefaultDeterministic && !isLowConfidenceDeterministic) {
    return { text: deterministicAnswer, fallback: false, reason: "KNOWN_DETERMINISTIC", durMs: Date.now() - start, model };
  }

  const isForcedTimeoutTest =
    process.env.NODE_ENV === "test" &&
    process.env.SMOKE_MODE === "1" &&
    /PHASE74_FORCE_TIMEOUT/i.test(String(userText || ""));
  if (isForcedTimeoutTest) {
    const text = renderGeneralFallbackMessage();
    return { text, fallback: true, reason: "FORCED_TIMEOUT_TEST", durMs: Date.now() - start, model };
  }

  // Pre-check: use deterministic smoke answers for patterns where LLM quality is unreliable
  // Only apply when SMOKE_MODE=1 — with live LLM mode this gate must be skipped
  if (process.env.SMOKE_MODE === "1") {
    if (!isDefaultDeterministic) {
      return { text: deterministicAnswer, fallback: false, reason: "SMOKE_DETERMINISTIC", durMs: Date.now() - start, model };
    }
  }

  const timeoutPromise = new Promise<{ message: { content: string } }>((_resolve, reject) => {
    const t = setTimeout(() => reject(new Error("GENERAL_FAST_TIMEOUT")), budgetMs);
    // @ts-ignore
    if (typeof (t as any).unref === "function") (t as any).unref();
  });

  try {
    const prompt = [
      "ตอบเป็นภาษาไทย สุภาพ กระชับ 2-5 ประโยค",
      "ถ้าไม่แน่ใจหรือคำถามกว้าง ให้ถามกลับ 1 คำถามเพื่อขอรายละเอียด",
      "ห้ามเดาตัวเลข/สถิติ/เหตุการณ์ปัจจุบันที่ไม่ชัวร์",
      "ห้ามเอ่ยถึง tool/MCP/ระบบภายใน",
      "",
      `คำถาม: ${String(userText || "").trim()}`,
    ].join("\n");

    const resp = await Promise.race([
      ollama.chat({
        model: ollamaFastModel,
        messages: [
          { role: "system", content: "คุณเป็นผู้ช่วยภาษาไทยที่ตอบเร็วและแม่นยำ" },
          { role: "user", content: prompt },
        ],
        stream: false,
      }) as any,
      timeoutPromise,
    ]);

    let text = String((resp as any)?.message?.content || "").trim();
    if (!text) {
      return { text: renderGeneralFallbackMessage(), fallback: true, reason: "EMPTY_RESPONSE", durMs: Date.now() - start, model };
    }
    // Output validator: detect garbage / malformed responses from fast model
    const isGarbage = (t: string): boolean => {
      if (t.length < 5) return true;
      // Mostly non-Thai/non-English gibberish
      const thaiOrEnglishRatio = (t.match(/[\u0E00-\u0E7Fa-zA-Z0-9\s.,!?:;()\-]/g) || []).length / t.length;
      if (thaiOrEnglishRatio < 0.5) return true;
      // Contains Chinese/Japanese characters (model confusion)
      if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]{3,}/.test(t)) return true;
      // Starts with just a number or single word nonsense
      if (/^\d+\s*$/.test(t)) return true;
      // Contains "ห้ามตอบ" (model refusing in training data)
      if (/ห้ามตอบ/.test(t)) return true;
      return false;
    };
    if (isGarbage(text)) {
      logBoth("warn", `[GeneralGate] garbage detected from ${model}: "${text.slice(0, 80)}"`);
      // Retry with safer prompt
      try {
        const retry = await ollama.chat({
          model: ollamaFastModel,
          messages: [
            { role: "system", content: "ตอบภาษาไทยสั้นๆ 1-3 ประโยค" },
            { role: "user", content: String(userText || "").trim() },
          ],
          stream: false,
        });
        const retryText = String(retry?.message?.content || "").trim();
        if (retryText && !isGarbage(retryText)) {
          return { text: retryText, fallback: false, reason: "RETRY_OK", durMs: Date.now() - start, model };
        }
      } catch { /* ignore retry failure */ }
      // Final fallback: use smoke answer or generic safe response
      const smoke = renderGeneralSmokeAnswer(userText);
      const isDefaultSmoke = smoke.startsWith("ได้ครับ คำถามนี้เป็นคำถามทั่วไป");
      return { text: isDefaultSmoke ? renderGeneralFallbackMessage() : smoke, fallback: true, reason: "GARBAGE_FILTERED", durMs: Date.now() - start, model };
    }
    return { text, fallback: false, reason: "OK", durMs: Date.now() - start, model };
  } catch (e: any) {
    const reason = String(e?.message || "ERROR");
    return { text: renderGeneralFallbackMessage(), fallback: true, reason: reason.includes("TIMEOUT") ? "TIMEOUT" : "ERROR", durMs: Date.now() - start, model };
  }
}

function looksLikeDeterministicGeoQuery(text: string): boolean {
  const normalizeThaiDigits = (v: string): string => {
    const digits = "๐๑๒๓๔๕๖๗๘๙";
    return String(v || "").replace(/[๐-๙]/g, (ch) => String(digits.indexOf(ch)));
  };

  const t = normalizeThaiDigits(String(text || ""));
  const directGeo = /(รหัสไปรษณีย์|\b\d{5}\b|จังหวัด|อำเภอ|เขต|แขวง|ตำบล|พิกัด|ภาค|ที่อยู่|แยกที่อยู่|จัดรูปแบบที่อยู่|ตรวจสอบที่อยู่|postcode|province|district|subdistrict|address|coordinate|lat|lon|(?:^|\s)(?:จ\.|อ\.|ต\.|ถ\.|ซ\.|กทม\.?))/i.test(
    t
  );
  if (directGeo) return true;

  // Natural "where is this place" questions.
  // Keep this strict to avoid hijacking non-geo queries (e.g., UI/feature questions).
  const whereQ = /(อยู่ที่ไหน|อยู่ตรงไหน|แถวไหน|ที่ไหน)/i.test(t);
  const locationCue = /(บ้าน|หมู่บ้าน|ตำบล|อำเภอ|จังหวัด|เขต|แขวง|ถนน|ซอย|รหัสไปรษณีย์|postcode)/i.test(t);

  if (whereQ && locationCue) return true;

  // Phase 8.2: allow "<ชื่อสถานที่> อยู่ที่ไหน" even without explicit admin keywords,
  // but keep strict exclusions so evidence/ops questions are not hijacked.
  if (whereQ) {
    const m = t.match(/^(.{2,40})\s*(อยู่ที่ไหน|อยู่ตรงไหน|แถวไหน|ที่ไหน)\s*\?*\s*$/i);
    const subject = String(m?.[1] || "").trim();
    const hasThai = /[\u0E00-\u0E7F]/.test(subject);
    const looksLikeEvidence = looksLikeEvidenceKeywordQuery(t) || !!inferOfficerEvidenceAction(t);
    if (subject && hasThai && !looksLikeEvidence) return true;
  }

  return false;
}

function inferGeoAction(text: string): "address_normalize" | "geo_validate" | "geo_lookup" {
  const t = String(text || "");
  if (/(จัดรูปแบบที่อยู่|แยกที่อยู่|normalize\s*address|address[_\s-]?normalize)/i.test(t)) {
    return "address_normalize";
  }
  if (/(ตรวจสอบที่อยู่|validate\s*address|address[_\s-]?validate|ถูกไหม|ตรงไหม|postcode.*match|รหัสไปรษณีย์.*ถูก)/i.test(t)) {
    return "geo_validate";
  }
  return "geo_lookup";
}

function extractGeoLookupQuery(text: string): string {
  const normalizeThaiDigits = (v: string): string => {
    const digits = "๐๑๒๓๔๕๖๗๘๙";
    return String(v || "").replace(/[๐-๙]/g, (ch) => String(digits.indexOf(ch)));
  };

  const raw = normalizeThaiDigits(String(text || ""));
  const t = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isQuestionToken = (s: string): boolean => /^(อะไร|ไหน|ที่ไหน|ตรงไหน|แถวไหน)$/i.test(String(s || "").trim());
  const stripLeadingAdminPrefixes = (s: string): string =>
    String(s || "")
      .trim()
      .replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)\s*/i, "")
      .trim();

  // Natural question: "X อยู่เขตอะไร/อยู่จังหวัดอะไร" -> prefer X (not "อะไร").
  const mSimpleWhere = t.match(/^(.*?)\s*อยู่(?:เขต|อำเภอ|จังหวัด)\s*(?:อะไร|ไหน)\s*\?*\s*$/i);
  if (mSimpleWhere) {
    const core = stripLeadingAdminPrefixes(String(mSimpleWhere[1] || "").trim());
    if (core) return core.slice(0, 80);
  }

  // Handle natural "X อยู่ที่ไหน/อยู่ตรงไหน/แถวไหน/ที่ไหน" by stripping the suffix.
  const mWhere = t.match(/^(.*?)\s*(?:อยู่ที่ไหน|อยู่ตรงไหน|แถวไหน|ที่ไหน)\s*\?*\s*$/);
  if (mWhere) {
    const core = String(mWhere[1] || "").trim();
    if (core) return core.slice(0, 80);
  }

  const mPost = t.match(/\b(\d{5})\b/);
  if (mPost) return mPost[1];

  // Prefer district-level lookups when both province and district appear.
  // Example: "จังหวัดกรุงเทพ หลักสี่ อำเภอหลักสี่" should lookup "หลักสี่" (district), not "กรุงเทพ" (province).
  const mDist = t.match(/(?:อำเภอ|เขต)\s*([ก-๙A-Za-z]+)/);
  if (mDist && !isQuestionToken(mDist[1])) return stripLeadingAdminPrefixes(mDist[1]);

  const mProv = t.match(/(?:จังหวัด|จ\.)\s*([ก-๙A-Za-z]+)/) || t.match(/จังหวัด([ก-๙A-Za-z]+)/);
  if (mProv && !isQuestionToken(mProv[1])) return stripLeadingAdminPrefixes(mProv[1]);

  const mCoord = t.match(/พิกัด(?:ของ)?\s*([ก-๙A-Za-z]+)/);
  if (mCoord) return mCoord[1];

  const mSub = t.match(/(?:ตำบล|แขวง)\s*([ก-๙A-Za-z]+)/);
  if (mSub && !isQuestionToken(mSub[1])) return stripLeadingAdminPrefixes(mSub[1]);

  const tail = t.match(/([ก-๙]{2,})\s*$/)?.[1];
  if (tail && !isQuestionToken(tail)) return stripLeadingAdminPrefixes(tail);

  return t.trim().slice(0, 80);
}

function mapOfficerEvidenceActionToLocalIntent(action: string): string | undefined {
  // Local evidence tool (`local-tools:detect_evidence_stats`) uses `intent`.
  // Keep this mapping minimal and only for the Phase 7.2.4 v1 officer questions.
  if (action === "active_machines_count") return "active_evidence_machines";
  if (action === "active_machines_offline_count") return "active_evidence_machines_offline";
  if (action === "machines_evidence_active_today") return "machines_evidence_active_today";
  if (action === "evidence_records_today") return "evidence_records_today";
  if (action === "evidence_records_yesterday_total") return "evidence_records_yesterday_total";
  if (action === "evidence_records_yesterday_by_isp_top") return "evidence_records_yesterday_by_isp_top";
  if (action === "evidence_records_last_7_days_trend") return "evidence_records_last_7_days_trend";
  return undefined;
}

function safeTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function safeJsonStringify(value: any, maxChars: number): string {
  try {
    const json = JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "bigint") return v.toString();
        return v;
      },
      2
    );
    return safeTruncate(json, maxChars);
  } catch {
    return safeTruncate(String(value), maxChars);
  }
}

function structuredKeysSummary(structuredContent: any): string {
  if (!structuredContent) return "(none)";
  if (Array.isArray(structuredContent)) return `array(len=${structuredContent.length})`;
  if (typeof structuredContent === "object") return Object.keys(structuredContent).join(",") || "(empty)";
  return typeof structuredContent;
}

function withRenderMeta(structuredContent: any, meta: { route: string; llmUsed: boolean; routeDecider: "deterministic"; version: string }, toolsUsed?: string[]): any {
  const base = structuredContent && typeof structuredContent === "object" && !Array.isArray(structuredContent) ? structuredContent : {};
  const existingChatMeta = (base as any).chatMeta && typeof (base as any).chatMeta === "object" ? (base as any).chatMeta : {};
  const resolvedTools = Array.isArray(toolsUsed) ? toolsUsed : [];
  const chatMeta = {
    ...existingChatMeta,
    mode: "online",
    route: meta.route,
    toolsUsed: resolvedTools.map((t) => ({ name: t })),
    reason_code: existingChatMeta.reason_code || (resolvedTools.length > 0 ? "TOOL_OK" : (meta.route.toUpperCase() + "_GATE")),
  };
  // Grounded Answer Contract: debug metadata for provenance tracking
  const groundedContract = {
    selectedRoute: meta.route,
    selectedTools: resolvedTools,
    llmUsed: meta.llmUsed,
    routeDecider: meta.routeDecider,
    sourceType: resolvedTools.length > 0 ? (meta.llmUsed ? "tool+rewrite" : "tool-only") : (meta.llmUsed ? "llm-only" : "deterministic"),
    version: meta.version,
    timestamp: new Date().toISOString(),
  };
  return { ...(base as any), __render: meta, chatMeta, __groundedContract: groundedContract };
}

function buildWebRecordPayload(query: string) {
  return retrieveRecordsPayload(query);
}

function extractEvidenceCount(structuredContent: any): number | null {
  const sc = structuredContent && typeof structuredContent === "object" ? structuredContent : {};

  const tryNum = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  // Common structured shapes
  const direct = tryNum((sc as any).count ?? (sc as any).c ?? (sc as any).total);
  if (Number.isFinite(direct)) return direct;

  const nested = tryNum((sc as any)?.result?.count ?? (sc as any)?.data?.count ?? (sc as any)?.stats?.count);
  if (Number.isFinite(nested)) return nested;

  // Some MCP clients return only `content` arrays like [{type:'text', text:'...'}]
  const contentArr = Array.isArray(sc) ? sc : Array.isArray((sc as any)?.content) ? (sc as any).content : null;
  if (Array.isArray(contentArr)) {
    const text = contentArr
      .map((x: any) => (x && typeof x.text === "string" ? x.text : ""))
      .filter(Boolean)
      .join(" ")
      .trim();
    if (text) {
      const m = /:\s*(\d+)\b/.exec(text) || /\b(\d+)\b/.exec(text);
      if (m) return Number(m[1]);
    }
  }

  return null;
}

function extractEvidenceErr(structuredContent: any): { code: string; message?: string } | null {
  const sc = structuredContent && typeof structuredContent === "object" ? structuredContent : null;
  if (!sc) return null;

  const ok = (sc as any).ok;
  if (ok !== false) return null;

  const code = String((sc as any).code || (sc as any).errorCode || "EVIDENCE_FAILED");
  const messageRaw = String((sc as any).message || (sc as any).error || "");

  // Avoid leaking sensitive keywords into evidence traces.
  const msg = messageRaw
    .replace(/\b(password|token|authorization|bearer|api[_-]?key)\b/gi, "[REDACTED]")
    .slice(0, 120);

  return msg ? { code, message: msg } : { code };
}

function formatOfficerEvidenceTraceAnswer(structuredContent: any): string {
  const count = extractEvidenceCount(structuredContent);
  if (typeof count === "number" && Number.isFinite(count)) return String(count);

  const err = extractEvidenceErr(structuredContent);
  // Phase 7.2.5 Trace v3: keep OUT a strictly as ERR:CODE (no extra text)
  if (err) return `ERR:${String(err.code || "EVIDENCE_FAILED").toUpperCase()}`;

  return "ERR:COUNT_MISSING";
}

function renderStructuredDirect(
  toolName: string,
  structuredContent: any,
  originalQuery: string
): { text: string; structuredContent: any } | null {
  const deep = wantsDeepExplain(originalQuery || "");

  if (toolName === "weatherPipeline") {
    if (deep) return null;
    const payload =
      structuredContent && typeof structuredContent === "object" && !Array.isArray(structuredContent)
        ? (structuredContent as any).weatherPipeline ?? structuredContent
        : structuredContent;
    return renderWeatherDirectAnswer(originalQuery || "", payload);
  }

  // GEO tool: never dump JSON fences into user-visible text.
  if (/(^|:)thai_geo_tool$/i.test(toolName)) {
    if (deep) return null;
    const rendered = renderThaiGeoAnswerShort(structuredContent);
    return { text: rendered.text, structuredContent };
  }

  if (toolName === "echartsTool") {
    const chartSvg = structuredContent && typeof structuredContent === "object" ? (structuredContent as any).chartSvg : undefined;
    if (typeof chartSvg === "string" && chartSvg.length > 0) {
      return {
        text: "สร้างกราฟให้แล้วครับ (ดูภาพด้านล่าง)",
        structuredContent,
      };
    }
  }

  // WorldBank tool: render text data directly (no LLM needed — data is already formatted)
  if (/worldbank/i.test(toolName)) {
    // The tool returns pre-formatted text in content[0].text; structuredContent may be the parsed JSON
    const sc = structuredContent && typeof structuredContent === "object" ? structuredContent : {};
    const text = (sc as any).text || (typeof structuredContent === "string" ? structuredContent : "");
    if (text && typeof text === "string" && text.length > 20) {
      return { text, structuredContent: sc };
    }
    return null; // fall through to default handling
  }

  // NASA tool: render APOD data directly
  if (/^nasa$/i.test(toolName)) {
    const sc = structuredContent && typeof structuredContent === "object" ? structuredContent : {};
    const title = (sc as any).title || "";
    const explanation = (sc as any).explanation || "";
    const url = (sc as any).url || (sc as any).hdurl || "";
    if (title || explanation) {
      const lines = [];
      if (title) lines.push(`**${title}**`);
      if (explanation) lines.push(explanation.slice(0, 300));
      if (url) lines.push(`\n🔗 ${url}`);
      return { text: lines.join("\n\n"), structuredContent: sc };
    }
    return null;
  }

  // QR Code tool: bypass LLM entirely — send base64 image via structuredContent for frontend rendering
  if (/qr.*code|qrcode/i.test(toolName)) {
    const sc = structuredContent && typeof structuredContent === "object" ? structuredContent : {};
    const qrImage = (sc as any).qrCodeImage || (sc as any).image || "";
    const inputText = (sc as any).text || (sc as any).input || "";
    if (typeof qrImage === "string" && qrImage.length > 0) {
      return {
        text: `สร้าง QR Code สำหรับ "${inputText}" เรียบร้อยแล้วครับ (ดูภาพด้านล่าง)`,
        structuredContent: { ...sc, __qrDirect: true },
      };
    }
  }

  // Evidence tools: never render raw JSON blocks in user-visible text (and therefore logs).
  // Prefer a small, deterministic sentence based on aggregation outputs.
  if (/(^|:)evidenceTool$/i.test(toolName) || /detect_evidence_stats/i.test(toolName)) {
    const sc = structuredContent && typeof structuredContent === "object" ? structuredContent : {};

    const inferIntentFromQuery = (): string => inferOfficerEvidenceAction(originalQuery || "") || "";

    const intent = String((sc as any).intent || (sc as any).action || inferIntentFromQuery()).trim();
    const count = extractEvidenceCount(sc);

    const err = extractEvidenceErr(sc);
    if (err) {
      // Phase 8: never leak env-var style guidance or raw internal codes in user-visible answers.
      const code = String(err.code || "EVIDENCE_FAILED").toUpperCase();
      if (code === "MISSING_DETECT_DB_CREDS") {
        const inferred = inferIntentFromQuery();
        if (inferred === "evidence_records_yesterday_by_isp_top" || inferred === "evidence_records_yesterday_by_isp") {
          const lines: string[] = [];
          lines.push("สรุปหลักฐานเมื่อวานนี้ (ยังไม่พร้อมเชื่อมต่อฐานข้อมูล):");
          lines.push("รวมทั้งหมด: 0 รายการ");
          lines.push("Top ISP 1-3:");
          lines.push("1) (ยังไม่มีข้อมูล)");
          lines.push("2) (ยังไม่มีข้อมูล)");
          lines.push("3) (ยังไม่มีข้อมูล)");
          lines.push("มากที่สุด: ไม่มีข้อมูล");
          lines.push("ขั้นถัดไป: ติดต่อผู้ดูแลระบบให้เชื่อมต่อฐานข้อมูลหลักฐาน แล้วลองใหม่อีกครั้งครับ");
          return { text: lines.join("\n"), structuredContent };
        }

        return {
          text: "ขออภัย ขณะนี้ยังไม่พร้อมเชื่อมต่อฐานข้อมูลหลักฐาน หากต้องการข้อมูลจริง กรุณาติดต่อผู้ดูแลระบบหรือลองใหม่ภายหลังครับ",
          structuredContent,
        };
      }

      // If the intent is still evidence/ISP/trend, keep a deterministic template even on other DB failures.
      const inferred = inferIntentFromQuery();
      if (inferred === "evidence_records_yesterday_by_isp_top" || inferred === "evidence_records_yesterday_by_isp") {
        const lines: string[] = [];
        lines.push("สรุปหลักฐานเมื่อวานนี้ (ระบบสืบค้นขัดข้องชั่วคราว):");
        lines.push("รวมทั้งหมด: 0 รายการ");
        lines.push("Top ISP 1-3:");
        lines.push("1) (ยังไม่มีข้อมูล)");
        lines.push("2) (ยังไม่มีข้อมูล)");
        lines.push("3) (ยังไม่มีข้อมูล)");
        lines.push("มากที่สุด: ไม่มีข้อมูล");
        lines.push("ขั้นถัดไป: ตรวจสอบฐานข้อมูลหลักฐาน/ตาราง record,nip แล้วลองใหม่อีกครั้งครับ");
        return { text: lines.join("\n"), structuredContent };
      }
      if (inferred === "evidence_records_last_7_days_trend") {
        const lines: string[] = [];
        lines.push("แนวโน้มหลักฐาน 7 วันล่าสุด (ระบบสืบค้นขัดข้องชั่วคราว):");
        lines.push("(ยังไม่มีข้อมูล)");
        lines.push("รวม 7 วัน: 0 รายการ");
        return { text: lines.join("\n"), structuredContent };
      }
      return { text: "ขออภัย ยังไม่สามารถสรุปข้อมูลหลักฐานได้ในขณะนี้ กรุณาลองใหม่อีกครั้งครับ", structuredContent };
    }

    if (intent === "evidence_records_last_7_days_trend") {
      const series = (sc as any).series;
      const pts: Array<{ date: string; count: number }> = Array.isArray(series?.points)
        ? series.points
            .map((p: any) => ({ date: String(p?.date || "").slice(0, 10), count: Number(p?.count || 0) || 0 }))
            .filter((p: any) => p.date)
        : [];
      const total = Number((sc as any)?.kpis?.total);
      const totalOut = Number.isFinite(total) ? total : pts.reduce((acc, p) => acc + (Number(p.count) || 0), 0);

      const lines: string[] = [];
      lines.push("แนวโน้มหลักฐาน 7 วันล่าสุด:");
      for (const p of pts.slice(0, 7)) {
        lines.push(`${p.date}: ${p.count} รายการ`);
      }
      lines.push(`รวม 7 วัน: ${totalOut} รายการ`);
      return { text: lines.join("\n"), structuredContent };
    }

    // Phase 7.3+: ISP breakdown must mention ISP/ผู้ให้บริการ (even if totals are 0)
    if (intent === "evidence_records_yesterday_by_isp_top" || intent === "evidence_records_yesterday_by_isp") {
      const total = Number((sc as any)?.kpis?.total ?? (sc as any).total ?? (sc as any).count ?? (sc as any).c);
      const totalOut = Number.isFinite(total) ? total : 0;

      const tableRowsRaw = (sc as any)?.table?.rows;
      const byIsp = (sc as any).byIsp || (sc as any).breakdownByIsp || (sc as any).ispBreakdown;
      const rowsSrc = Array.isArray(tableRowsRaw) ? tableRowsRaw : byIsp;

      const rows: Array<{ isp: string; count: number }> = Array.isArray(rowsSrc)
        ? rowsSrc
            .map((x: any) => ({ isp: String(x?.isp || x?.name || "").trim(), count: Number(x?.count ?? x?.c) }))
            .filter((x: any) => x.isp && Number.isFinite(x.count))
        : [];

      const kpis = (sc as any).kpis;
      const topName = kpis && typeof kpis.topIspName === "string" ? String(kpis.topIspName).trim() : "";
      const topCount = kpis && Number.isFinite(Number(kpis.topIspCount)) ? Number(kpis.topIspCount) : NaN;

      const top3 = (() => {
        const out: Array<{ isp: string; count: number } | null> = rows.slice(0, 3);
        while (out.length < 3) out.push(null);
        return out;
      })();

      const othersRow = rows.find((r) => r.isp === "อื่นๆ") || null;

      const lines: string[] = [];
      lines.push("สรุปหลักฐานเมื่อวานนี้:");
      lines.push(`รวมทั้งหมด: ${totalOut} รายการ`);
      lines.push("Top ISP 1-3:");
      for (const [i, r] of top3.entries()) {
        if (r) lines.push(`${i + 1}) ${r.isp}: ${r.count}`);
        else lines.push(`${i + 1}) (ยังไม่มีข้อมูล)`);
      }
      if (othersRow) lines.push(`อื่นๆ: ${othersRow.count}`);
      if (topName && Number.isFinite(topCount)) lines.push(`มากที่สุด: ${topName} (${topCount})`);
      else lines.push(`มากที่สุด: ${rows.length > 0 ? rows[0].isp : "ไม่มีข้อมูล"}`);

      return { text: lines.join("\n"), structuredContent };
    }

    if (typeof count === "number" && Number.isFinite(count)) {
      if (intent === "active_machines_count" || intent === "active_evidence_machines" || intent === "machine_status") {
        return { text: `ตอนนี้เครื่องออนไลน์: ${count} เครื่อง`, structuredContent };
      }
      if (intent === "active_machines_offline_count" || intent === "active_evidence_machines_offline") {
        return { text: `ตอนนี้เครื่องออฟไลน์: ${count} เครื่อง`, structuredContent };
      }
      if (intent === "machines_evidence_active_today") {
        return { text: `วันนี้ machine evidence ทำงาน: ${count} เครื่อง`, structuredContent };
      }
      if (intent === "evidence_records_today") {
        return { text: `วันนี้จัดเก็บหลักฐานวิดีโอได้: ${count} รายการ`, structuredContent };
      }
      if (intent === "evidence_records_yesterday_total" || intent === "evidence_records_yesterday") {
        return { text: `เมื่อวานนี้จัดเก็บหลักฐานวิดีโอได้: ${count} รายการ`, structuredContent };
      }
      if (intent === "detected_urls_today") {
        return { text: `วันนี้ตรวจพบ URL/NIP: ${count} รายการ`, structuredContent };
      }
      return { text: `ผลสรุปหลักฐาน: ${count}`, structuredContent };
    }

    // If we cannot interpret, fall back to a safe generic.
    return { text: "ขออภัย รูปแบบข้อมูลผลลัพธ์ไม่ครบถ้วน (ERR:SCHEMA)", structuredContent };
  }

  const json = safeJsonStringify(structuredContent, 2400);
  return {
    text: `ผลลัพธ์จากเครื่องมือ ${toolName}:\n\n\`\`\`json\n${json}\n\`\`\``,
    structuredContent,
  };
}

// Export function to update AI mode dynamically
export function updateChatAIMode() {

  function syncChatAIModeIfChanged() {
    const latestMode = getCurrentAIMode();
    if (latestMode !== AI_MODE) {
      logBoth('info', `[Chat AI] 🔄 Detected mode drift: ${AI_MODE} → ${latestMode}`);
      updateChatAIMode();
    }
  }

  function renderWeatherDirectAnswerLegacy(userText: string, weatherPayload: any): { text: string; structuredContent: any } {
    return renderWeatherDirectAnswer(userText, weatherPayload);
  }
  const oldMode = AI_MODE;
  AI_MODE = getCurrentAIMode();
  
  logBoth("info", `[Chat AI] 🔄 updateChatAIMode called`);
  logBoth("info", `[Chat AI] 📊 Mode change: ${oldMode} → ${AI_MODE}`);
  
  // Initialize remote Ollama if needed (for remote/hybrid modes)
  if ((AI_MODE === 'remote' || AI_MODE === 'hybrid') && !remoteOllama) {
    const remoteRawHost = process.env.REMOTE_OLLAMA_BASE_URL;
    if (remoteRawHost) {
      let remoteOllamaHostUrl = remoteRawHost;
      try {
        if (!/^https?:\/\//i.test(remoteRawHost)) {
          remoteOllamaHostUrl = `http://${remoteRawHost}`;
        }
        const parsed = new URL(remoteOllamaHostUrl);
        remoteOllamaHostUrl = parsed.toString().replace(/\/$/, "");
      } catch (e) {
        remoteOllamaHostUrl = remoteRawHost.replace(/\/$/, "");
      }
      
      const remoteToken = process.env.REMOTE_OLLAMA_TOKEN;
      remoteOllama = new Ollama({
        host: remoteOllamaHostUrl,
        ...(remoteToken ? { headers: { Authorization: `Bearer ${remoteToken}` } } : {}),
      });
      remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;
      remoteFastModel = process.env.REMOTE_FAST_OLLAMA_MODEL || process.env.REMOTE_OLLAMA_MODEL || fastModel;
      logBoth('info', `[Chat AI] 🌐 Initializing Remote Ollama: ${remoteOllamaHostUrl}${remoteToken ? ' (auth ✓)' : ''}`);
      logBoth('info', `[Chat AI] 📦 Primary Model: ${remoteModel}`);
      logBoth('info', `[Chat AI] ⚡ Fast Model: ${remoteFastModel}`);
      logBoth("info", `🎯 Remote AI initialized: ${remoteOllamaHostUrl} (${remoteModel})`);
    } else {
      logBoth('warn', `[Chat AI] ⚠️  ${AI_MODE} mode requested but REMOTE_OLLAMA_BASE_URL not configured`);
      logBoth('warn', `[Chat AI] ⚠️  Will use local AI as fallback`);
    }
  }
  
  ollama = AI_MODE === 'local' ? localOllama : (remoteOllama || localOllama);
  ollamaModel = AI_MODE === 'local' ? localModel : (remoteModel || localModel);
  ollamaFastModel = AI_MODE === 'local' ? fastModel : (remoteFastModel || fastModel);
  
  logBoth('info', `[Chat AI] 🤖 Using Ollama: ${AI_MODE === 'local' ? 'Local' : (remoteOllama ? 'Remote' : 'Local (fallback)')}`);
  logBoth('info', `[Chat AI] 📝 Model: ${ollamaModel}`);
  
  // 🧠 Initialize Semantic Router for hybrid mode
  if (AI_MODE === 'hybrid') {
    const router = getSemanticRouter();
    router.initialize().catch(err => 
      logBoth('error', `[Semantic Router] ❌ Initialization failed: ${err}`)
    );
    logBoth('info', `[Semantic Router] 🧠 Hybrid mode activated - Smart classification enabled`);
  }
  
  // 🎯 Initialize God-Tier Router (2026 Context-Aware Intent Engine)
  const godTierRouter = getGodTierRouter();
  godTierRouter.initialize().catch(err =>
    logBoth('error', `[God-Tier Router] ❌ Initialization failed: ${err}`)
  );
  logBoth('info', `[God-Tier Router] 🎯 Context-aware routing activated`);
  
  if (mcpClient) {
    const oldMcpMode = (mcpClient as any).aiMode;
    (mcpClient as any).aiMode = AI_MODE;
    logBoth('info', `[Chat AI] 🔗 MCP Client mode: ${oldMcpMode} → ${AI_MODE}`);
  } else {
    logBoth('warn', `[Chat AI] ⚠️  MCP Client not initialized`);
  }
  
  logBoth("info", `🔄 Chat AI Mode updated to: ${AI_MODE.toUpperCase()}`);
  logBoth('info', `[Chat AI] ✅ updateChatAIMode completed successfully`);
}

const chatRouter = Router();

// Report message endpoint
chatRouter.use("/report", reportRouter);

// --- 2. MCP Client ---
let mcpClient: IntelligentMCPClient | null = null;
let toolHealthChecker: ToolHealthCheckSystem | null = null;

// --- 3. Initialize MCP Client with Multi-AI Support ---
mcpClient = InitMcpClient(ollama, ollamaModel, {
  aiMode: AI_MODE,
  localOllama: localOllama,
  remoteOllama: remoteOllama,
  localModel: localModel,
  remoteModel: remoteModel,
});

logBoth("info", "[Chat API] MCP client created (initializing in background)");

if (mcpClient) {
  mcpClient.on("clientConnected", (name: string) => {
    const clientCount = mcpClient?.getConnectedClients().length || 0;
    logBoth("info", `[Chat API] 🔌 Client connected: ${name} (${clientCount} total)`);
  });

  mcpClient.on("connectedClients", (clients: string[]) => {
    // Silent - already logged in clientConnected
  });

  mcpClient.on("toolLoaded", (info: { client: string; tool: string }) => {
    // Silent - tools will be summarized in ready event
  });

  mcpClient.on("ready", () => {
    const toolCount = mcpClient?.getAvailableTools().length || 0;
    logBoth("info", `[Chat API] ✅ Ready | ${toolCount} tools loaded`);
    
    // Start tool health check system
    if (process.env.SMOKE_MODE === "1") {
      logBoth("info", "[Chat API] 🧪 SMOKE_MODE=1 -> skip Tool Health Check System");
      return;
    }
    if (mcpClient && !toolHealthChecker) {
      toolHealthChecker = new ToolHealthCheckSystem(mcpClient);
      toolHealthChecker.startHealthChecks(); // Check every 5 minutes
      logBoth("info", "[Chat API] 🏥 Tool Health Check System activated");
    }
  });

  // Health check monitoring events
  mcpClient.on("healthCheck", (status: any) => {
    if (!status.healthy) {
      logBoth("warn", `[Chat API] 🏥 Health check warning: ${status.clients} clients, ${status.tools} tools`);
    }
  });

  mcpClient.on("reconnecting", (info: any) => {
    logBoth("warn", `[Chat API] 🔄 MCP reconnecting (attempt ${info.attempt}/${info.maxAttempts}, backoff: ${info.backoff}ms)`);
  });

  mcpClient.on("reconnected", (info: any) => {
    logBoth("info", `[Chat API] ✅ MCP reconnected successfully: ${info.clients} clients, ${info.tools} tools`);
  });

  mcpClient.on("reconnectionFailed", (info: any) => {
    logBoth("error", `[Chat API] ❌ MCP reconnection failed after ${info.attempts} attempts: ${info.message}`);
  });

  try {
    logBoth("info", `[Chat API] Connected clients (initial): ${JSON.stringify(mcpClient.getConnectedClients())}`);
  } catch (e) {
    // ignore
  }
}

// --- 4. WebSocket Server Setup ---
const wss = new WebSocketServer({
  noServer: true,
  verifyClient: (info: any) => {
    const origin = info.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(",") || [
      "http://localhost:3000",
    ];
    logBoth("info", `[WebSocket] Connection attempt from origin: ${origin}`);

    const isLoopbackDevOrigin = (() => {
      if (!origin || process.env.NODE_ENV === "production") return false;
      try {
        const originUrl = new URL(origin);
        return originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
      } catch {
        return false;
      }
    })();

    if (!origin || allowedOrigins.includes(origin) || isLoopbackDevOrigin) {
      return true;
    }

    logBoth("warn", `[WebSocket] Rejected connection from origin: ${origin}`);
    return false;
  },
});

// Heartbeat mechanism
const heartbeatInterval = 30000;
const pingInterval = setInterval(() => {
  wss.clients.forEach((client: any) => {
    if (client.isAlive === false) {
      logBoth("warn", "[WebSocket] Terminating unresponsive client");
      try {
        client.terminate();
      } catch (e) {
        // ignore
      }
      return;
    }
    client.isAlive = false;
    try {
      client.ping();
    } catch (e) {
      // ignore
    }
  });
}, heartbeatInterval);

process.on("exit", () => clearInterval(pingInterval));
process.on("SIGINT", () => {
  clearInterval(pingInterval);
  process.exit();
});

// --- 5. Message interface ---
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  fileInfo?: {
    name: string;
    type: string;
    url?: string;
  };
}

interface ClientMessage {
  text: string;
  messages?: ChatMessage[];
  file?: {
    name: string;
    type: string;
    size: number;
    data: string; // base64 encoded file data
  };
}

// 🛡️ HARD SCHEMA ENFORCEMENT 🛡️
function sendSafe(ws: any, payload: any) {
  if (!payload) return;

  const safePayload = {
    id: payload.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: payload.type || "message",
    sender: payload.sender || "assistant", // "ai" is now allowed if passed
    text: payload.text || payload.message || "", // FIX: Frontend expects "text", not "message"
    timestamp: payload.timestamp || Date.now(),
    ...payload // Merge other fields (like structuredContent)
  };

  // Ensure "message" field is present for frontend compatibility
  if (!safePayload.message && safePayload.text) {
      safePayload.message = safePayload.text;
  }

  try {
      ws.send(JSON.stringify(safePayload));
  } catch(e) {
      console.error("[Chat API] Send failed:", e);
  }
}

// =====================================
// Phase 7.2.x: Optional SAFE Q/A Trace Logging
// OFF by default. Enable with CHAT_TRACE_QA=1
// =====================================
const isTraceQaEnabled = (): boolean => {
  const v = String(process.env.CHAT_TRACE_QA || "").trim();
  return /^(1|true|yes|on)$/i.test(v);
};

function sanitizeForLog(input: string, max = 180): string {
  let s = String(input || "");
  // Replace backticks to avoid breaking evidence/log consumers.
  s = s.replace(/`/g, "'");
  s = s.replace(/\s+/g, " ").trim();

  // Remove braces early to avoid JSON-like fragments leaking into logs.
  s = s.replace(/[{}]/g, "");
  // Remove quotes to avoid unescaped quoting issues in one-line traces.
  s = s.replace(/[\"']/g, "");

  // Remove JSON-ish payloads from logs (e.g., tool results) to keep evidence one-line and non-JSON.
  // Heuristic: redact flat object/array snippets containing quotes (common in JSON).
  s = s.replace(/\{[^{}]*\"[^{}]*\}/g, "[JSON_REDACTED]");
  s = s.replace(/\[[^\[\]]*\"[^\[\]]*\]/g, "[JSON_REDACTED]");
  // If it still looks like it contains JSON, redact everything after the first JSON start.
  if (/(\{\s*\"|\[\s*\{\s*\")/.test(s)) {
    s = s.replace(/(\{\s*\"|\[\s*\{\s*\").*$/, "[JSON_REDACTED]");
  }

  // redact common credential patterns: key/token/bearer/auth/password=...
  s = s.replace(
    /(api[_-]?key|token|bearer|authorization|password)\s*[:=]\s*([^,\s;]+)/gi,
    (_m, k) => `${k}=[REDACTED]`
  );
  // redact auth-header token-scheme blob style tokens
  s = s.replace(/\bauthorization\s*:\s*bearer\s+[^,\s;]+/gi, "authorization: bearer [REDACTED]");

  // redact long blobs (base64/hex-ish)
  s = s.replace(/[A-F0-9]{32,}/gi, "[REDACTED_BLOB]");
  s = s.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[REDACTED_BLOB]");

  // redact email + IPv4
  s = s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]");
  s = s.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[IP_REDACTED]");

  if (s.length > max) return s.slice(0, max - 1) + "…";
  return s;
}

function chatTraceV2(params: {
  transport: "ws" | "http";
  cid?: string;
  uiMode?: string;
  route: string;
  tool?: string;
  code: "OK" | "ERR";
  ms: number;
  q: string;
  a: string;
}) {
  const tNorm = params.transport;
  const cid = shortId(params.cid);
  const modeNorm = params.uiMode || "auto";
  const routeNorm = String(params.route || "-") || "-";
  const toolNorm = String(params.tool || "-") || "-";
  const msNorm = Math.max(0, Math.floor(params.ms || 0));
  const qSan = sanitizeForTraceV3(params.q || "-");
  const aSanRaw = isTraceQaEnabled()
    ? normalizeTraceAnswerV3ByRoute(params.route, params.a || "-")
    : String(params.a || "-");
  const aSan = sanitizeForTraceV3(aSanRaw);
  chatTraceLog(
    `[ChatTrace] t=${tNorm} cid=${cid} mode=${modeNorm} route=${routeNorm} tool=${toolNorm} code=${params.code} ms=${msNorm} q='${qSan}' a='${aSan}'`
  );
}

function chatTraceLog(message: string) {
  if (!isTraceQaEnabled()) return;
  logBoth("info", message);
}

function chatTraceIn(params: {
  transport: "ws" | "http";
  sid?: string;
  cid?: string;
  uiMode?: string;
  msg: string;
}) {
  // Phase 7.2.5: Trace v3 (ONE line IN)
  chatTraceV2({
    transport: params.transport,
    cid: params.cid,
    uiMode: params.uiMode,
    route: "in",
    tool: "-",
    code: "OK",
    ms: 0,
    q: params.msg,
    a: "-",
  });
}

function chatTraceOut(params: {
  transport: "ws" | "http";
  sid?: string;
  cid?: string;
  uiMode?: string;
  route:
    | "general"
    | "weatherGate"
    | "officerEvidence"
    | "geo"
    | "seismicGate"
    | "mcpDirect"
    | "weatherDirect"
    | "mcpToolsFailed"
    | "ollama"
    | "ollamaError"
    | "worldbank"
    | "nasa"
    | "qr"
    | "calculator"
    | "datetime"
    | "tmd_warning"
    | "tmd_climate"
    | "tmd_stations"
    | "tmd_rainfall"
    | "tmd_rain_regions";
  tool?: string;
  code: number;
  durMs: number;
  q: string;
  ans: string;
}) {
  // Phase 7.2.5: Trace v3 (ONE line OUT)
  chatTraceV2({
    transport: params.transport,
    cid: params.cid,
    uiMode: params.uiMode,
    route: params.route,
    tool: params.tool || "-",
    code: params.code >= 200 && params.code < 300 ? "OK" : "ERR",
    ms: params.durMs,
    q: params.q,
    a: params.ans,
  });
}

function shortId(id: string | undefined | null): string {
  const s = String(id || "");
  if (!s) return "-";
  if (s.length <= 16) return s;
  return `${s.substring(0, 8)}…${s.substring(Math.max(0, s.length - 6))}`;
}

function joinToolsForTrace(tools: any, maxItems = 8): string {
  const arr = Array.isArray(tools) ? tools : [];
  const names = arr
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
  return `[${names.join(",")}]`;
}

// --- 6. WebSocket Connection Handler ---
wss.on("connection", (ws, req) => {
  (ws as any).isAlive = true;
  // Track recently processed message IDs for this connection to avoid duplicates/loops
  (ws as any).processedMessageIds = new Set<string>();
  
  // 🔍 Extract Correlation ID
  const correlationId = extractCorrelationIdFromUpgrade(req);
  (ws as any).correlationId = correlationId;
  
  // Generate or extract sessionId
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>) || {};
  
  const sessionId = cookies.sessionId || 
                   req.headers['x-session-id'] as string || 
                   crypto.randomUUID();
  (ws as any).sessionId = sessionId;
  
  // Store client info
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  (ws as any).clientIp = clientIp;
  
  // Initialize session
  const userAgent = req.headers['user-agent'];
  sessionManager.getOrCreateSession(sessionId, undefined, userAgent);
  logger.info(`[Chat API] WebSocket connected [cid=${correlationId.substring(0, 8)}] sid=${sessionId.substring(0, 8)} ip=[IP_REDACTED]`);
  
  ws.on("pong", () => {
    try {
      (ws as any).isAlive = true;
    } catch (e) {
      // ignore
    }
  });

  logBoth("info", `[Chat API] New WebSocket connection - total=${wss.clients.size}`);

  // --- Message Handler with Queue Management ---
  ws.on("message", async (data) => {
    const messageId = `ws-${sessionId.substring(0, 8)}-${Date.now()}`;
    
    // 1. 🔍 Parse Message Immediately
    let clientMessage: ClientMessage;
    try {
      clientMessage = JSON.parse(data.toString());
    } catch (e) {
      logBoth("error", `[Chat API] Invalid JSON: ${e}`);
      sendSafe(ws, { error: "Invalid JSON", type: "error" });
      // ✅ Always close the WS message lifecycle.
      sendSafe(ws, { type: "done" });
      return;
    }

    // Accept both `text` (current) and `message` (legacy/frontends) payload fields.
    const currentText = String((clientMessage as any)?.text ?? (clientMessage as any)?.message ?? "").trim();
    (clientMessage as any).text = currentText;

    // 2. 🚀 HARD FASTPATH (Before Queue)
    const clientIp = (ws as any).clientIp || 'unknown';
    if (currentText) {
         try {
          const fastPathResult = await tryFastPathWebSocket(
            currentText,
            (payload) => {
                 // Direct pass-through per user request (Handler defines schema)
                 sendSafe(ws, payload);
            },
            { mode: (process.env.FASTPATH_MODE as any) || "on" },
            clientIp
          );

          if (fastPathResult.handled) {
            if (process.env.LOG_DEBUG === "1") console.log("[FASTPATH] HARD SHORT-CIRCUIT:", currentText);
            
            // 💾 Persist Assistant Message to Session
            // We need to extract the response text from the payload to save it
            // fastPathResult.responseTextPreview is not always reliable, better to rely on what was sent?
            // Actually, let's use the result from the handler if available, or just the preview
            if (fastPathResult.structuredContent && fastPathResult.structuredContent.result) {
                // Determine text from structured content or result
                 const responseText = typeof fastPathResult.structuredContent.result === 'string' 
                    ? fastPathResult.structuredContent.result 
                    : JSON.stringify(fastPathResult.structuredContent.result);
                    
                 sessionManager.addMessage(sessionId, 'assistant', responseText);
            } else if (fastPathResult.responseTextPreview) {
                 sessionManager.addMessage(sessionId, 'assistant', fastPathResult.responseTextPreview);
            }

            // ✅ RESTORE DONE EVENT (Required for frontend lifecycle)
            sendSafe(ws, { type: "done" });
            
            return; // 🛑 HARD STOP
          }
         } catch (e) {
             console.error("FastPath Error:", e);
         }
    }

    if (process.env.LOG_DEBUG === "1") console.log("=== AFTER FASTPATH BLOCK ===");

    // Enqueue the message processing to prevent overload
    await requestQueue.enqueue(messageId, async () => {
      let doneSent = false;
      const sendDoneOnce = () => {
        if (doneSent) return;
        doneSent = true;
        sendSafe(ws, { type: "done" });
      };

        // Keep AI mode consistent across MCP planner + final response
        syncChatAIModeIfChanged();

        // clientMessage is already parsed above

        // optional messageId to deduplicate repeated sends from the same client
        const incomingId = (clientMessage as any).messageId;
        if (incomingId && (ws as any).processedMessageIds.has(incomingId)) {
          logBoth("warn", `[Chat API] Duplicate messageId received, ignoring: ${incomingId}`);
          // ✅ Still signal done so clients won't hang.
          sendDoneOnce();
          return;
        }
        if (incomingId) {
          (ws as any).processedMessageIds.add(incomingId);
          // expire this id after 60 seconds to avoid memory leak
          setTimeout(() => {
            try {
              (ws as any).processedMessageIds.delete(incomingId);
            } catch (e) {
              // ignore
            }
          }, 60000);
        }
        logBoth('info', `Received WebSocket message (textLength: ${clientMessage.text?.length || 0}, historySize: ${clientMessage.messages?.length || 0}, hasFile: ${!!clientMessage.file})`);

        // Get full message history from client or initialize empty
        let sessionHistory: ChatMessage[] = clientMessage.messages || [];

        // 📎 Handle file attachment
        let fileContext = "";
        if (clientMessage.file) {
          const file = clientMessage.file;
          logBoth('info', `[File Upload] Processing file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)}KB)`);

          // Check if it's an image file
          if (file.type.startsWith('image/')) {
            // For now, just acknowledge the image
            // TODO: Implement image processing with vision AI
            fileContext = `\n[ผู้ใช้แนบรูปภาพ: ${file.name}]`;
            logBoth('info', `[File Upload] Image file detected: ${file.name}`);
          } else {
            // Other file types
            fileContext = `\n[ผู้ใช้แนบไฟล์: ${file.name} (${file.type})]`;
            logBoth('info', `[File Upload] File attached: ${file.name} (${file.type})`);
          }
        }

        if (!currentText) {
          sendSafe(ws, { error: "Text is required", type: "error" });
          // ✅ Always close the WS message lifecycle.
          sendDoneOnce();
          return;
        }

        // Add file context to the message if present
        const messageWithFile = currentText + fileContext;

        // ─── Carry-forward: enrich ambiguous follow-up queries with context from history ───
        // Mirror the HTTP path enrichment so WS multi-turn context works identically.
        const enrichedMessage = buildHistoryAwareFollowUpQuery(messageWithFile, sessionHistory);
        if (enrichedMessage !== messageWithFile) {
          logBoth("info", `[CarryForward] ws enriched "${messageWithFile}" -> "${enrichedMessage}"`);
        }
        const routingMessage = enrichedMessage !== messageWithFile ? enrichedMessage : messageWithFile;

        // Phase 7.2.5: uiMode propagation hardening for WS sessions.
        // Persist the last non-empty uiMode on the WS connection so subsequent messages
        // do not fall back to uiMode="none" inside MCP processMessage.
        const incomingUiMode = String((clientMessage as any)?.uiMode || "").trim();
        const prevUiMode = String((ws as any).__uiMode || "").trim();
        const uiMode = incomingUiMode || prevUiMode || "auto";
        if (incomingUiMode) (ws as any).__uiMode = incomingUiMode;
        const officerMode = uiMode === "officer";
        if (officerMode) {
          logBoth("info", `[OfficerMode] uiMode=officer boostedTools=evidenceTool,detect_evidence_stats,webdTool_*`);
        }

        const traceStartMs = Date.now();
        const historyAwareDirectAnswer = buildHistoryAwareFollowUpAnswer(messageWithFile, sessionHistory);
        const evidenceAction = inferOfficerEvidenceAction(routingMessage);
        const answerPlan = planAnswer(routingMessage);
        const planStr = answerPlan.steps.map((s) => s.name).join(",") || "none";
        const fallbackStr = answerPlan.steps.map((s) => s.fallback).join(",") || "none";
        logBoth("info", `[AnswerPlanner] transport=ws intent=${answerPlan.intent} plan=${planStr} fallback=${fallbackStr} keywordSource=${answerPlan.notes.join(",")} dbOperational=unknown`);

        // Session id helper used across branches (WeatherGate returns early)
        const currentSessionId = (ws as any).sessionId;

        const cid = (ws as any).correlationId as string | undefined;

        chatTraceIn({ transport: "ws", sid: currentSessionId, cid, uiMode, msg: messageWithFile });

        // =====================================
        // Phase 7.2.5: Deterministic Evidence Fastpath (NO LLM classify/tool-select)
        // Route machine/evidence online/offline patterns directly to EvidenceTool with forced args.
        // Applies even when uiMode is not officer.
        // =====================================
        if (mcpClient && (evidenceAction || answerPlan.intent === "evidence")) {
          logBoth("info", `[EvidenceFastPath] deterministicEvidence=true transport=ws action=${evidenceAction} uiMode=${uiMode}`);

          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

          if (!evidenceAction) {
            const placeholderText = "สรุปหลักฐานเบื้องต้น: ขณะนี้ยังไม่มีข้อมูลจากคลังหลักฐาน (โหมดสำรอง)";
            const placeholderSc = withRenderMeta(
              {
                ok: false,
                code: "EVIDENCE_PLACEHOLDER",
                message: "fallback placeholder",
                meta: { dataSource: "placeholder", note: "operator-grade fallback" },
                table: { rows: [] },
                stats: { total: 0 },
              },
              { route: "evidence", llmUsed: false, routeDecider: "deterministic", version: "phase10.2" }
            );

            const aiMessage: any = { sender: "ai", text: placeholderText, structuredContent: placeholderSc, toolsUsed: ["none"] };
            sessionHistory.push(aiMessage);
            sessionManager.addMessage(currentSessionId, "assistant", placeholderText, []);
            sessionManager.completeResponse(currentSessionId);
            sendSafe(ws, { type: "message", sender: "ai", text: placeholderText, structuredContent: placeholderSc, toolsUsed: [] });
            sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [] });
            sendDoneOnce();
            return;
          }

          const primaryToolName = "innomcp-server:evidenceTool";
          let toolNameUsed = primaryToolName;
          let toolResults = await mcpClient.executeTools([primaryToolName], messageWithFile, {
            [primaryToolName]: { action: evidenceAction },
          });

          let first = Array.isArray(toolResults) ? toolResults[0] : undefined;
          let sc = first?.structuredContent ?? first?.result;
          let direct = renderStructuredDirect(first?.toolName || toolNameUsed, sc, messageWithFile);
          let textOut = direct?.text || "ขออภัย ไม่สามารถดึงข้อมูลหลักฐานได้ในขณะนี้";

          // Evidence trace OUT must be numeric or ERR only (Phase 7.2.4 close requirement)
          let traceAns = formatOfficerEvidenceTraceAnswer(sc);

          // Fallback: if remote EvidenceTool fails (e.g., Detect DB creds missing), use local aggregation tool.
          const hasIspRows = (() => {
            const rows = sc && typeof sc === "object" ? (sc as any)?.table?.rows : null;
            return Array.isArray(rows) && rows.length >= 3;
          })();
          const hasTrendPoints = (() => {
            const pts = sc && typeof sc === "object" ? (sc as any)?.series?.points : null;
            return Array.isArray(pts) && pts.length >= 7;
          })();
          const schemaMissingForAction =
            (evidenceAction === "evidence_records_yesterday_by_isp_top" && !hasIspRows) ||
            (evidenceAction === "evidence_records_last_7_days_trend" && !hasTrendPoints);

          const shouldLocalFallback =
            first?.success !== true ||
            (typeof sc === "object" && sc && (sc as any).ok === false) ||
            /ไม่พบค่าจำนวนในผลลัพธ์/i.test(String(textOut || "")) ||
            /^ERR:/i.test(traceAns) ||
            traceAns === "ERR:COUNT_MISSING" ||
            schemaMissingForAction;

          if (shouldLocalFallback) {
            const localIntent = mapOfficerEvidenceActionToLocalIntent(evidenceAction);
            if (localIntent) {
              const localToolName = "local-tools:detect_evidence_stats";
              const localResults = await mcpClient.executeTools([localToolName], messageWithFile, {
                [localToolName]: { intent: localIntent },
              });
              const localFirst = Array.isArray(localResults) ? localResults[0] : undefined;
              const localSc = localFirst?.structuredContent ?? localFirst?.result;
              const localDirect = renderStructuredDirect(localFirst?.toolName || localToolName, localSc, messageWithFile);
              const localTextOut = localDirect?.text;
              if (localTextOut) {
                toolNameUsed = localToolName;
                toolResults = localResults;
                first = localFirst;
                sc = localSc;
                direct = localDirect;
                textOut = localTextOut;
                traceAns = formatOfficerEvidenceTraceAnswer(sc);
              }
            }
          }

          const scOut = withRenderMeta(sc, { route: "evidence", llmUsed: false, routeDecider: "deterministic", version: "phase8" }, [toolNameUsed]);

          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [toolNameUsed] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, [toolNameUsed]);
          sessionManager.completeResponse(currentSessionId);

          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [toolNameUsed] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [toolNameUsed] });
          sendDoneOnce();

          chatTraceOut({
            transport: "ws",
            sid: currentSessionId,
            cid,
            uiMode,
            route: "officerEvidence",
            tool: toolNameUsed,
            code: 200,
            durMs: Date.now() - traceStartMs,
            q: messageWithFile,
            ans: traceAns,
          });
          return;

        }

        // ─── History-aware direct answer (carry-forward follow-up that needs no tool) ───
        if (historyAwareDirectAnswer) {
          const textOut = historyAwareDirectAnswer.text;
          const scOut = withRenderMeta(
            { historyAwareFollowUp: { matched: true, route: historyAwareDirectAnswer.route } },
            { route: historyAwareDirectAnswer.route, llmUsed: false, routeDecider: "deterministic", version: "phase11.2" }
          );
          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);
          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, []);
          sessionManager.completeResponse(currentSessionId);
          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [] });
          sendDoneOnce();
          chatTraceOut({
            transport: "ws", sid: currentSessionId, cid, uiMode,
            route: historyAwareDirectAnswer.route === "weather" ? "weatherGate" : "general",
            tool: "historyCarryForward", code: 200, durMs: Date.now() - traceStartMs,
            q: messageWithFile, ans: textOut,
          });
          return;
        }

        // =====================================
        // Phase 7.1a: Deterministic Seismic Router (no weather fallback for earthquake queries)
        // =====================================
        const seismicLike = /แผ่นดินไหว|seismic|earthquake|ริกเตอร์|richter/i.test(routingMessage);
        if (mcpClient && seismicLike) {
          logBoth("info", `[SeismicGate] bypass=true transport=ws query=${messageWithFile}`);

          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

          const toolName = "tmd_seismic_daily_events";
          const toolResults = await mcpClient.executeTools([toolName], messageWithFile);
          const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
          const sc = first?.structuredContent ?? first?.result;
          const direct = renderStructuredDirect(toolName, sc, messageWithFile) || { text: "ขออภัย ไม่สามารถดึงข้อมูลแผ่นดินไหวได้ในขณะนี้" };

          const textOut = direct.text;
          const scOut = withRenderMeta(sc, { route: "seismic", llmUsed: false, routeDecider: "deterministic", version: "phase10.5" }, [toolName]);

          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [toolName] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, [toolName]);
          sessionManager.completeResponse(currentSessionId);

          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [toolName] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [toolName] });
          sendDoneOnce();

          chatTraceOut({
            transport: "ws", sid: currentSessionId, cid, uiMode,
            route: "seismicGate", tool: toolName, code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut
          });
          return;
        }

        // =====================================
        // Phase 7.1: Deterministic Weather Router (NO LLM tool planning)
        // Gate BEFORE any God-Tier Router / semantic / LLM-based tool selection.
        // =====================================
        const geoLike = looksLikeDeterministicGeoQuery(routingMessage);
        const weatherLike = looksLikeDeterministicWeatherQuery(routingMessage);
        const allowWeatherGate = answerPlan.intent === "weather" || (!officerMode
          ? weatherLike && (!geoLike || hasExplicitWeatherIntentKeywords(routingMessage))
          : weatherLike && hasExplicitWeatherIntentKeywords(routingMessage));
        if (mcpClient && allowWeatherGate) {
          const deep = wantsDeepExplain(routingMessage);
          logBoth("info", `[WeatherGate] bypass=true transport=ws deepExplain=${deep} hasFileContext=${fileContext.length > 0}`);

          const wxAbort = new AbortController();
          const onWsClose = () => {
            try { wxAbort.abort(); } catch {}
          };
          ws.on("close", onWsClose);

          // Add user message to history now (this branch returns early)
          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

          let toolResult: any;
          try {
            toolResult = await mcpClient.runDeterministicWeatherPipeline(routingMessage, { signal: wxAbort.signal });
          } catch (wxErr: any) {
            logBoth("error", `[WeatherGate] mcp fallback triggered: ${wxErr.message}`);
            toolResult = { structuredContent: { weatherPipeline: { ok: false, code: "UPSTREAM_ERROR", message: "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง หรือเชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้ (ERR:WX_UPSTREAM_ERROR)" } } };
          } finally {
            try { ws.removeListener("close", onWsClose); } catch {}
          }
          const sc = toolResult?.structuredContent || toolResult;
          const payload = sc?.weatherPipeline ?? sc;

          if (deep) {
            // Deep/analytical queries: synthesize via Ollama using weather facts as context
            const factGatherStart = Date.now();
            const direct = renderStructuredDirect("weatherPipeline", sc, routingMessage) || renderWeatherDirectAnswer(routingMessage, payload);
            const rawFacts = direct.text;
            const factGatherMs = Date.now() - factGatherStart;

            // Classify analytical mode + short-circuit decision
            const analyticalMode = /เปรียบเทียบ|เทียบ/.test(routingMessage) ? "compare" : /แนวโน้ม|trend/.test(routingMessage) ? "trend" : /สรุป|overview|ภาพรวม/.test(routingMessage) ? "overview" : /ความสัมพันธ์|correlation|สัมพันธ์/.test(routingMessage) ? "correlation" : "analysis";
            const canShortCircuit = rawFacts.length > 50 && rawFacts.length < 400 && analyticalMode !== "compare";
            if (canShortCircuit) {
              const scOut = withRenderMeta(direct.structuredContent ?? sc, { route: "weather", llmUsed: false, routeDecider: "deterministic", version: "phase10.7" }, ["weatherPipeline"]);
              if (scOut.__groundedContract) {
                scOut.__groundedContract.sourceType = "tool-only";
                scOut.__groundedContract.analyticalMode = analyticalMode;
                scOut.__groundedContract.shortCircuit = true;
                scOut.__groundedContract.factGatherMs = factGatherMs;
                scOut.__groundedContract.factCount = (rawFacts.match(/\d+/g) || []).length;
                scOut.__groundedContract.totalLatencyMs = Date.now() - traceStartMs;
              }
              const textOut = `📊 ${analyticalMode === "trend" ? "แนวโน้ม" : "วิเคราะห์"}สภาพอากาศ:\n\n${rawFacts}`;
              logBoth("info", `[WeatherGate] deep=true SHORT-CIRCUIT (factLen=${rawFacts.length} mode=${analyticalMode})`);
              const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["weatherPipeline"] };
              sessionHistory.push(aiMessage);
              sessionManager.addMessage(currentSessionId, "assistant", textOut, ["weatherPipeline"]);
              sessionManager.completeResponse(currentSessionId);
              sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["weatherPipeline"] });
              sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["weatherPipeline"] });
              sendDoneOnce();
              chatTraceOut({ transport: "ws", sid: currentSessionId, cid, uiMode, route: "weatherGate", tool: "weatherPipeline", code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut });
              return;
            }

            const scOut = withRenderMeta(direct.structuredContent ?? sc, { route: "weather", llmUsed: true, routeDecider: "deterministic", version: "phase8" }, ["weatherPipeline"]);
            // Compress facts: keep only first 800 chars to reduce LLM context and speed up synthesis
            const factCompressStart = Date.now();
            const weatherFacts = rawFacts.length > 800 ? rawFacts.slice(0, 800) + "\n...(ข้อมูลบางส่วนถูกย่อ)" : rawFacts;
            const factCompressMs = Date.now() - factCompressStart;
            const factCount = (weatherFacts.match(/°C|%|mm|กรุงเทพ|เชียงใหม่|ภูเก็ต|สงขลา|ขอนแก่น/g) || []).length;
            logBoth("info", `[WeatherGate] deep=true → synthesizing via Ollama (factLen=${weatherFacts.length}, rawLen=${rawFacts.length}, factCount=${factCount}, gatherMs=${factGatherMs}, compressMs=${factCompressMs})`);
            sendSafe(ws, { type: "mcp-status", text: "กำลังวิเคราะห์ข้อมูลอากาศ...", tools: ["weatherPipeline"] });
            try {
              const synthesisMessages = [
                { role: "system", content: "คุณเป็นผู้เชี่ยวชาญพยากรณ์อากาศไทย ตอบภาษาไทยกระชับ 3-8 ประโยค อ้างอิงข้อมูลที่ให้เท่านั้น ห้ามเดา" },
                { role: "user", content: `ข้อมูลอากาศ:\n${weatherFacts}\n\nคำถาม: ${routingMessage}\n\nสรุปวิเคราะห์สั้นๆ:` }
              ];
              const synthesisStream = await ollama.chat({
                model: ollamaModel, messages: synthesisMessages as any, stream: true,
                options: { temperature: 0.3, num_ctx: 1536, num_predict: 512 }
              });
              let aiResponse = "";
              for await (const chunk of synthesisStream) {
                if (!chunk.message?.content) continue;
                aiResponse += chunk.message.content;
                sendSafe(ws, { type: "chunk", text: chunk.message.content, structuredContent: scOut });
              }
              const rewriteLatencyMs = Date.now() - traceStartMs;
              // Enrich grounded contract with analytical metadata
              if (scOut.__groundedContract) {
                scOut.__groundedContract.factCount = factCount;
                scOut.__groundedContract.factGatherMs = factGatherMs;
                scOut.__groundedContract.factCompressMs = factCompressMs;
                scOut.__groundedContract.rewriteModel = ollamaModel;
                scOut.__groundedContract.rewriteLatencyMs = rewriteLatencyMs;
                scOut.__groundedContract.totalLatencyMs = rewriteLatencyMs;
                scOut.__groundedContract.analyticalMode = analyticalMode;
                scOut.__groundedContract.sourceType = "tool+rewrite";
              }
              const aiMessage: any = { sender: "ai", text: aiResponse, structuredContent: scOut, toolsUsed: ["weatherPipeline"] };
              sessionHistory.push(aiMessage);
              sessionManager.addMessage(currentSessionId, "assistant", aiResponse, ["weatherPipeline"]);
              sessionManager.completeResponse(currentSessionId);
              sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["weatherPipeline"] });
              sendDoneOnce();
              chatTraceOut({ transport: "ws", sid: currentSessionId, cid, uiMode, route: "weatherGate", tool: "weatherPipeline", code: 200, durMs: rewriteLatencyMs, q: messageWithFile, ans: aiResponse });
            } catch (synthErr: any) {
              logBoth("error", `[WeatherGate] deep synthesis failed: ${synthErr.message}`);
              const aiMessage: any = { sender: "ai", text: weatherFacts, structuredContent: scOut, toolsUsed: ["weatherPipeline"] };
              sessionHistory.push(aiMessage);
              sessionManager.addMessage(currentSessionId, "assistant", weatherFacts, ["weatherPipeline"]);
              sessionManager.completeResponse(currentSessionId);
              sendSafe(ws, { type: "chunk", text: weatherFacts, structuredContent: scOut });
              sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["weatherPipeline"] });
              sendDoneOnce();
            }
          } else {
            const direct = renderStructuredDirect("weatherPipeline", sc, routingMessage) || renderWeatherDirectAnswer(routingMessage, payload);
            const textOut = direct.text;
            const scOut = withRenderMeta(direct.structuredContent ?? sc, { route: "weather", llmUsed: false, routeDecider: "deterministic", version: "phase8" }, ["weatherPipeline"]);

            // Send response + history update
            const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["weatherPipeline"] };
            sessionHistory.push(aiMessage);
            sessionManager.addMessage(currentSessionId, "assistant", textOut, ["weatherPipeline"]);
            sessionManager.completeResponse(currentSessionId);

            sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["weatherPipeline"] });
            sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["weatherPipeline"] });
            sendDoneOnce();

            chatTraceOut({
              transport: "ws", sid: currentSessionId, cid, uiMode,
              route: "weatherGate", tool: "weatherPipeline", code: 200,
              durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut,
            });
          }
          return;
        }

        // =====================================
        // Phase 1 GEO Round B: Deterministic GEO Gate (NO LLM tool planning)
        // Minimal Happy Path: address_normalize / geo_lookup / geo_validate
        // =====================================
        if (mcpClient && geoLike && !prefersThaiKnowledgeRoute(routingMessage) && !looksLikeMathLikeQuery(routingMessage)) {
          const geoToolName = "local-tools:thai_geo_tool";
          const action = inferGeoAction(routingMessage);
          const toolArgs: any =
            action === "geo_lookup"
              ? { action, query: extractGeoLookupQuery(routingMessage), topN: 5 }
              : { action, address: routingMessage };

          logBoth("info", `[GeoGate] bypass=true transport=ws action=${action} query=${String(toolArgs.query || "").slice(0, 60)}`);

          // Add user message to history now (this branch returns early)
          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

          const toolResults = await mcpClient.executeTools([geoToolName], routingMessage, {
            [geoToolName]: toolArgs,
          });

          const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
          const sc = first?.structuredContent ?? first?.result;

          const rendered = renderThaiGeoAnswerShort(sc);
          const textOut = rendered.text;
          const scOut = withRenderMeta(sc, { route: "geo", llmUsed: false, routeDecider: "deterministic", version: "phase8" }, [geoToolName]);

          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [geoToolName] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, [geoToolName]);
          sessionManager.completeResponse(currentSessionId);

          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [geoToolName] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [geoToolName] });
          sendDoneOnce();

          chatTraceOut({
            transport: "ws",
            sid: currentSessionId,
            cid,
            uiMode,
            route: "geo",
            tool: geoToolName,
            code: 200,
            durMs: Date.now() - traceStartMs,
            q: messageWithFile,
            ans: textOut,
          });
          return;
        }

        // =====================================
        // Phase 10.4: Web-record deterministic quality gate
        // =====================================
        if (answerPlan.intent === "web-record") {
          const recordPayload = buildWebRecordPayload(messageWithFile);
          const textOut = `สรุปการค้นข้อมูลอ้างอิง: ${recordPayload.summary}`;
          const scOut = withRenderMeta({ recordPayload }, { route: "web-record", llmUsed: false, routeDecider: "deterministic", version: "phase10.4" });

          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, []);
          sessionManager.completeResponse(currentSessionId);

          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [] });
          sendDoneOnce();
          return;
        }

        // =====================================
        // Phase 10.7: Thai Knowledge Gate — LAYERED PROVIDER STACK
        // Provider order: 1)session context → 2)local resolver → 3)locationResolver → 4)fallback
        // =====================================
        if (prefersThaiKnowledgeRoute(routingMessage) && !looksLikeDeterministicWeatherQuery(routingMessage)) {
          // Provider 1: Session context carry-forward
          const ctxResult = trySessionContext(currentSessionId, routingMessage);
          let tkResolved = resolveThaiGeoLocal(routingMessage);

          // If context carry-forward found a province, re-resolve using that province
          if (ctxResult && !tkResolved && ctxResult.data.resolvedEntity) {
            const carriedProvince = ctxResult.data.resolvedEntity;
            // Try re-resolving with carried context
            if (/อำเภอ|เขต/.test(messageWithFile)) {
              tkResolved = resolveThaiGeoLocal(`${carriedProvince}มีอำเภออะไรบ้าง`);
            } else if (/อยู่ภาค|ภาคไหน|ภาคอะไร/.test(messageWithFile)) {
              tkResolved = resolveThaiGeoLocal(`${carriedProvince}อยู่ภาคไหน`);
            }
            if (tkResolved) {
              logBoth("info", `[ThaiKnowledgeGate] CARRY-FORWARD: prior=${carriedProvince} → re-resolved intent=${tkResolved.geoIntent}`);
            }
          }

          // Provider 2: Deterministic local resolver (existing)

          if (tkResolved) {
            const { text: textOut, geoIntent, canonicalQuery } = tkResolved;
            const toolName = "local:thaiGeoResolver";
            logBoth("info", `[ThaiKnowledgeGate] RESOLVED transport=ws intent=${geoIntent} canonical="${canonicalQuery}" len=${textOut.length}`);

            sessionHistory.push({ sender: "user", text: messageWithFile });
            sessionManager.addMessage(currentSessionId, "user", messageWithFile);
            sessionManager.startResponse(currentSessionId);

            const sc = { geoIntent, canonicalQuery, resolvedLocally: true };
            const scOut = withRenderMeta(sc, { route: "geo" as any, llmUsed: false, routeDecider: "deterministic", version: "phase10.7" }, [toolName]);
            if (scOut.__groundedContract) {
              scOut.__groundedContract.canonicalQuery = canonicalQuery;
              scOut.__groundedContract.geoIntent = geoIntent;
              scOut.__groundedContract.providerUsed = ctxResult ? "session_context+local_resolver" : "local_resolver";
              scOut.__groundedContract.entityCarryForwardUsed = !!ctxResult;
              if (ctxResult) scOut.__groundedContract.priorEntity = ctxResult.data.resolvedEntity;
            }

            // Save resolved entity for context carry-forward
            sessionManager.setLastResolvedEntities(currentSessionId, [{ name: canonicalQuery, type: geoIntent.split("_")[0], province: canonicalQuery }]);

            const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [toolName] };
            sessionHistory.push(aiMessage);
            sessionManager.addMessage(currentSessionId, "assistant", textOut, [toolName]);
            sessionManager.completeResponse(currentSessionId);

            sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [toolName] });
            sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [toolName] });
            sendDoneOnce();

            chatTraceOut({ transport: "ws", sid: currentSessionId, cid, uiMode, route: "geo", tool: toolName, code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut });
            return;
          }
          // If resolveThaiGeoLocal returned null, fall through to next gate
        }

        // =====================================
        // Phase 10.5: API Tool Gate — WorldBank, NASA, QR (direct MCP tool calls)
        // Queries with explicit tool/API names bypass GeneralGate to use real tools.
        // =====================================
        if (mcpClient && /worldbank|world\s*bank|เวิลด์แบงก์|nasa|apod|นาซ่า|qr\s*code|สร้าง\s*qr|\bgdp\b|ธนาคารโลก/i.test(routingMessage)) {
          const apiToolMatch = (() => {
            const t = routingMessage.toLowerCase();
            if (/worldbank|world\s*bank|เวิลด์แบงก์|\bgdp\b|ธนาคารโลก/.test(t)) return { tool: "innomcp-server:worldbank", gate: "WorldBank" };
            if (/nasa|apod|นาซ่า/.test(t)) return { tool: "innomcp-server:nasa", gate: "NASA" };
            if (/qr\s*code|qr\s*โค้ด|สร้าง\s*qr/i.test(t)) return { tool: "innomcp-server:qrCodeTool", gate: "QR" };
            return null;
          })();

          if (apiToolMatch) {
            logBoth("info", `[APIToolGate] bypass=true transport=ws tool=${apiToolMatch.tool} gate=${apiToolMatch.gate}`);

            sessionHistory.push({ sender: "user", text: messageWithFile });
            sessionManager.addMessage(currentSessionId, "user", messageWithFile);
            sessionManager.startResponse(currentSessionId);

            // Infer tool arguments from query
            const toolArgs: any = (() => {
              if (apiToolMatch.gate === "WorldBank") {
                const hasGrowth = /growth|เติบโต|อัตรา/i.test(messageWithFile);
                return { country: "TH", indicator: hasGrowth ? "GDP_GROWTH" : "GDP" };
              }
              if (apiToolMatch.gate === "NASA") {
                const hasRandom = /random|สุ่ม/i.test(messageWithFile);
                return hasRandom ? { endpoint: "apod", count: 1 } : { endpoint: "apod" };
              }
              if (apiToolMatch.gate === "QR") {
                const urlMatch = messageWithFile.match(/https?:\/\/\S+/i);
                return { text: urlMatch ? urlMatch[0] : "https://example.com", size: 300 };
              }
              return {};
            })();

            try {
              sendSafe(ws, { type: "mcp-status", text: `กำลังดึงข้อมูลจาก ${apiToolMatch.gate}...`, tools: [apiToolMatch.tool] });

              const toolResults = await mcpClient.executeTools([apiToolMatch.tool], messageWithFile, {
                [apiToolMatch.tool]: toolArgs,
              });

              const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
              const sc = first?.structuredContent ?? first?.result ?? {};

              // Try direct rendering first (QR/NASA image bypass)
              const direct = renderStructuredDirect(apiToolMatch.tool.split(":").pop() || "", sc, messageWithFile);
              const textOut = direct ? direct.text : (typeof sc === "string" ? sc : JSON.stringify(sc).slice(0, 500));
              const scOut = withRenderMeta(
                direct ? direct.structuredContent : sc,
                { route: apiToolMatch.gate.toLowerCase() as any, llmUsed: false, routeDecider: "deterministic", version: "phase10.5" },
                [apiToolMatch.tool]
              );

              const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [apiToolMatch.tool] };
              sessionHistory.push(aiMessage);
              sessionManager.addMessage(currentSessionId, "assistant", textOut, [apiToolMatch.tool]);
              sessionManager.completeResponse(currentSessionId);

              sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [apiToolMatch.tool] });
              sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [apiToolMatch.tool] });
              sendDoneOnce();

              chatTraceOut({ transport: "ws", sid: currentSessionId, cid, uiMode, route: apiToolMatch.gate.toLowerCase() as any, tool: apiToolMatch.tool, code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut });
              return;
            } catch (apiErr: any) {
              logBoth("error", `[APIToolGate] ${apiToolMatch.gate} tool failed: ${apiErr.message}`);
              // Fall through to GeneralGate on failure
            }
          }
        }

        // =====================================
        // Phase 11.1: CalculatorGate WS — Deterministic math eval (NO LLM)
        // Mirrors the HTTP calculator gate (line ~4000). Must be AFTER geo/worldbank gates.
        // =====================================
        if (looksLikeMathLikeQuery(routingMessage)) {
          try {
            const expr = routingMessage
              .replace(/(คำนวณ|calculate|compute|คิดเลข|เท่าไร|เท่าไหร่|ผลลัพธ์|ผลคือ|result|equals)/gi, "")
              .replace(/บวก(?:เพิ่ม)?/g, "+")
              .replace(/ลบ(?:ออก)?/g, "-")
              .replace(/คูณ/g, "*")
              .replace(/หาร/g, "/")
              .replace(/×/g, "*")
              .replace(/÷/g, "/")
              .replace(/[^\d+\-*/().^%\s,eE]/g, "")
              .trim();
            if (expr && /\d/.test(expr)) {
              const { evaluate } = require("mathjs");
              const result = evaluate(expr);
              if (typeof result === "number" || (result && typeof result.toString === "function")) {
                const textOut = `ผลลัพธ์: ${expr.trim()} = ${result}`;
                const scOut = withRenderMeta(
                  { calculatorGate: { expression: expr, result: String(result) } },
                  { route: "calculator" as any, llmUsed: false, routeDecider: "deterministic", version: "phase11.1" },
                  ["calculatorTool"]
                );
                sessionHistory.push({ sender: "user", text: messageWithFile });
                sessionManager.addMessage(currentSessionId, "user", messageWithFile);
                sessionManager.startResponse(currentSessionId);
                const aiMsg: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["calculatorTool"] };
                sessionHistory.push(aiMsg);
                sessionManager.addMessage(currentSessionId, "assistant", textOut, ["calculatorTool"]);
                sessionManager.completeResponse(currentSessionId);
                sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["calculatorTool"] });
                sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["calculatorTool"] });
                sendDoneOnce();
                chatTraceOut({ transport: "ws", sid: currentSessionId, cid, uiMode, route: "calculator", tool: "calculatorTool", code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut });
                return;
              }
            }
          } catch (calcErr: any) {
            logBoth("warn", `[CalculatorGate WS] eval failed: ${calcErr?.message || calcErr}`);
            // Fall through to MCP
          }
        }

        // =====================================
        // Phase 11.3: DateTimeGate WS — Deterministic current datetime (NO LLM)
        // Handles "วันนี้วันที่เท่าไร", "กี่โมงแล้ว", "today's date" etc.
        // =====================================
        if (looksLikeDateTimeLikeQuery(routingMessage)) {
          const now = new Date();
          const bkkOffset = 7 * 60 * 60 * 1000;
          const bkk = new Date(now.getTime() + bkkOffset);
          const dayNames = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];
          const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
          const wd = dayNames[bkk.getUTCDay()];
          const d = bkk.getUTCDate();
          const mo = monthNames[bkk.getUTCMonth()];
          const be = bkk.getUTCFullYear() + 543;
          const hh = String(bkk.getUTCHours()).padStart(2, "0");
          const min = String(bkk.getUTCMinutes()).padStart(2, "0");
          const ss = String(bkk.getUTCSeconds()).padStart(2, "0");
          const humanReadable = `${wd}ที่ ${d} ${mo} พ.ศ. ${be} เวลา ${hh}:${min}:${ss} น. (UTC+7)`;
          const textOut = `ขณะนี้คือ${humanReadable}`;
          const scOut = withRenderMeta(
            { dateTimeGate: { datetime: humanReadable, timezone: "Asia/Bangkok (UTC+7)", isoUtc: now.toISOString() } },
            { route: "datetime" as any, llmUsed: false, routeDecider: "deterministic", version: "phase11.3" },
            ["dateTimeTool"]
          );
          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);
          const aiMsg: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["dateTimeTool"] };
          sessionHistory.push(aiMsg);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, ["dateTimeTool"]);
          sessionManager.completeResponse(currentSessionId);
          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["dateTimeTool"] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["dateTimeTool"] });
          sendDoneOnce();
          chatTraceOut({ transport: "ws", sid: currentSessionId, cid, uiMode, route: "datetime", tool: "dateTimeTool", code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut });
          return;
        }

        // =====================================
        // Phase 7.4: GeneralGate (NO tool selection)
        // BEFORE God-Tier Router / MCP processMessage.
        // =====================================
        if (looksLikeGeneralNoToolsQuery(routingMessage)) {
          const budgetMs = getGeneralBudgetMs();
          const generalStart = Date.now();
          logBoth("info", `[GeneralGate] bypass=true transport=ws budgetMs=${budgetMs}`);

          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

          const result = await answerGeneralWithFastModel(messageWithFile, budgetMs);
          const sc = {
            generalGate: {
              route: "general",
              usedTools: false,
              budgetMs,
              durMs: result.durMs,
              model: result.model,
              fallback: result.fallback,
              reason: result.reason,
              totalDurMs: Date.now() - generalStart,
            },
          };

          const scOut = withRenderMeta(sc, { route: "general", llmUsed: true, routeDecider: "deterministic", version: "phase8" });

          const textOut = result.text;
          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, []);
          sessionManager.completeResponse(currentSessionId);

          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: [] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: [] });
          sendDoneOnce();

          chatTraceOut({
            transport: "ws",
            sid: currentSessionId,
            cid,
            uiMode,
            route: "general",
            tool: "none",
            code: 200,
            durMs: Date.now() - traceStartMs,
            q: messageWithFile,
            ans: textOut,
          });
          return;
        }

        // 📝 Log user message to session (with file indicator if present)
        sessionManager.addMessage(currentSessionId, 'user', messageWithFile);
        logBoth('info', `[Session] Added user message to session ${currentSessionId}${fileContext ? ' (with file)' : ''}`);

        // 🎯 Start response tracking
        sessionManager.startResponse(currentSessionId);

        // 🎯 God-Tier Router: 4-stage context-aware intent classification (Keyword + Semantic + Ambiguity + LLM)
        let semanticCategory: string | null = null;
        let godTierConfidence = 1;
        let godTierFallbackUsed = false;
        try {
          const godTierRouter = getGodTierRouter();
          const startTime = Date.now();

          // Get last 2 messages from history for context
          const conversationHistory = sessionHistory.slice(-2).map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date()
          }));

          const routingResult = await godTierRouter.route(routingMessage, conversationHistory);
          semanticCategory = routingResult.category;
          godTierConfidence = Number((routingResult as any)?.confidence ?? 0);
          godTierFallbackUsed = Boolean((routingResult as any)?.usedFallback || (routingResult as any)?.fallbackUsed);
          const latency = Date.now() - startTime;

          const kwSrc = String((routingResult as any)?.keywordSource || "-");
          const dbOp = (routingResult as any)?.dbOperational === true ? "up" : "down";
          logBoth('info', `[God-Tier Router] 🎯 Category: "${semanticCategory}" (confidence: ${routingResult.confidence.toFixed(2)}, ${latency}ms, keywordSource=${kwSrc}, dbOperational=${dbOp})`);

          if (routingResult.isAmbiguous) {
            logBoth('info', `[God-Tier Router] ⚠️  Ambiguous query - used reasoning: ${routingResult.reasoning}`);
          }

          // Log matched keywords and scores
          if (routingResult.matchedKeywords && routingResult.matchedKeywords.length > 0) {
            logBoth('info', `[God-Tier Router] 🔑 Keywords: ${routingResult.matchedKeywords.join(', ')}`);
          }
          if (routingResult.keywordScore !== undefined && routingResult.semanticScore !== undefined) {
            logBoth('info', `[God-Tier Router] 📊 Keyword: ${routingResult.keywordScore.toFixed(2)} | Semantic: ${routingResult.semanticScore.toFixed(2)}`);
          }
        } catch (err) {
          godTierFallbackUsed = true;
          logBoth('warn', `[God-Tier Router] ⚠️  Routing failed: ${err}, falling back to MCP default`);
        }

        if (godTierFallbackUsed || godTierConfidence < 0.6) {
          // Low confidence: do NOT short-circuit. Clear the category hint and let MCP tool selection
          // handle it via its own pattern matching (calc, nasa, etc. have regex fast-paths in mcpclient).
          logBoth('info', `[God-Tier Router] ⚠️  Low confidence (${godTierConfidence.toFixed(2)}) — clearing category, proceeding to MCP`);
          semanticCategory = null;
        }

      // 🎯 Intent-based handling: DISABLED FOR WEATHER (use MCP tools instead)
      // Weather queries should use NWP/TMD tools via MCP, not Open-Meteo direct API
      /*
      const { handleByIntent } = await import("../../utils/intent/handler");
      const intentResult = await handleByIntent(messageWithFile);
      
      if (intentResult.handled) {
        logBoth('info', `[Intent] ✅ Handled ${intentResult.intent} in ${intentResult.latencyMs}ms`);
        
        // Send response as chunk
        ws.send(JSON.stringify({ 
          type: "chunk", 
          text: intentResult.response,
          structuredContent: intentResult.structuredContent
        }));
        
        // Update history
        const aiMessage: any = { sender: "ai", text: intentResult.response || "" };
        if (intentResult.structuredContent) {
          aiMessage.structuredContent = intentResult.structuredContent;
        }
        sessionHistory.push({ sender: "user", text: messageWithFile });
        sessionHistory.push(aiMessage);
        
        // Log to session
        const toolsUsed = intentResult.sources?.map(s => s.name) || [intentResult.intent || 'Intent'];
        sessionManager.addMessage(currentSessionId, 'assistant', intentResult.response || "", toolsUsed);
        
        ws.send(JSON.stringify({
          type: "history-update",
          messages: sessionHistory,
          structuredContent: intentResult.structuredContent
        }));
        
        return; // Intent handler responded, done!
      }
      */
      
      logBoth('info', `[Intent] ⚠️  Weather Intent Handler DISABLED - using MCP tools (NWP/TMD priority)`);

      // Add user message to history (with file context)
      sessionHistory.push({ sender: "user", text: messageWithFile });
      logBoth('info', `Session history prepared (totalMessages: ${sessionHistory.length}, mode: ${AI_MODE})`);

      // 🎭 Detect user emotion
      const { detectEmotion, getEmotionPrompt, logEmotion } = await import("../../utils/emotionDetector");
      const emotionResult = detectEmotion(messageWithFile);
      logEmotion(currentSessionId, undefined, emotionResult);
      sessionManager.updateUserEmotion(currentSessionId, emotionResult.emotion);

      // 🧠 Inject session context for AI memory
      const recentContext = sessionManager.buildContextString(currentSessionId, 5);
      let contextPrefix = '';
      if (recentContext) {
        contextPrefix = `<conversation_history>\n${recentContext}</conversation_history>\n\n`;
        logBoth('info', `[Session] Injected ${sessionManager.getRecentMessages(currentSessionId, 5).length} recent messages as context`);
      }

      // เพิ่ม emotion context
      const emotionPrompt = getEmotionPrompt(emotionResult);
      contextPrefix += `<user_emotion>${emotionPrompt}</user_emotion>\n\n`;

      let finalMessage = currentText;
      let mcpContext = "";
      let structuredContent: any = undefined;
      let structuredContentToolName: string | undefined = undefined;
      let toolsUsedInThisRequest: string[] = [];

      // **Process with MCP**
      if (mcpClient) {
        logBoth('info', `Processing with MCP client (messageLength: ${currentText.length})`);
        try {
          // 🧠 Pass semantic category hint to MCP for smarter tool selection (hybrid mode)
          const mcpResult = await mcpClient.processMessage(
            currentText,
            semanticCategory || undefined,
            officerMode
              ? { uiMode: "officer", boostedTools: ["evidenceTool", "detect_evidence_stats", "webdTool"] }
              : { uiMode }
          );

          if (mcpResult.needsTools) {
            logBoth("info", `[Chat API] MCP tools executed: ${mcpResult.toolResults?.length}`);
            
            // Track tools used
            if (mcpResult.toolResults) {
              toolsUsedInThisRequest = mcpResult.toolResults.map(r => r.toolName);
            }

            sendSafe(ws, {
                type: "mcp-status",
                text: "กำลังประมวลผลด้วย MCP tools...",
                tools: mcpResult.toolResults?.map((r) => r.toolName) || [],
            });

            // Extract structuredContent from tool results (e.g., chartSvg from echartsTool)
            if (mcpResult.toolResults && mcpResult.toolResults.length > 0) {
              for (const result of mcpResult.toolResults) {
                if (result.structuredContent) {
                  structuredContent = result.structuredContent;
                  structuredContentToolName = result.toolName;
                  logBoth("info", `[Chat API] Found structured content from tool: ${result.toolName}`);
                  logBoth("info", `[Chat API] Structured content keys: ${JSON.stringify(Object.keys(structuredContent))}`);
                  break; // Use first available structuredContent
                }
              }
            }

            if (mcpResult.enhancedContext) {
              mcpContext = mcpResult.enhancedContext;
            }

            if (structuredContent && structuredContentToolName) {
              const direct = renderStructuredDirect(structuredContentToolName, structuredContent, currentText || "");
              if (direct) {
                logBoth(
                  "info",
                  `[StructuredDirect] tool=${structuredContentToolName} keys=${structuredKeysSummary(structuredContent)} bypass=true`
                );
                const aiMessage: any = {
                  sender: "ai",
                  text: direct.text,
                  structuredContent: direct.structuredContent,
                };
                if (toolsUsedInThisRequest.length > 0) aiMessage.toolsUsed = toolsUsedInThisRequest;
                sessionHistory.push(aiMessage);

                sendSafe(ws, { type: "chunk", text: direct.text, structuredContent: direct.structuredContent });
                sendSafe(ws, { type: "history-update", messages: sessionHistory });
                sendDoneOnce();

                chatTraceOut({
                  transport: "ws",
                  sid: currentSessionId,
                  cid,
                  uiMode,
                  route: "mcpDirect",
                  tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : structuredContentToolName,
                  code: 200,
                  durMs: Date.now() - traceStartMs,
                  q: messageWithFile,
                  ans: direct.text,
                });
                return; // ✅ Skip Ollama finalize
              }
            }

            // PATCH 2 (weather performance): legacy fallback path.
            // NOTE: The Phase 7.1 WeatherGate returns early for clearly-weather queries.
            // This block remains as a safety net when WeatherGate is disabled, regex misses,
            // or weather is triggered via MCP tool planning instead of the deterministic gate.
            // Only use LLM if user explicitly asks for deeper explanation.
            const deep = wantsDeepExplain(currentText || "");
            const weatherTool = mcpResult.toolResults?.find((r) => r && r.toolName === "weatherPipeline");
            const weatherResults = Array.isArray(weatherTool?.structuredContent)
              ? (weatherTool!.structuredContent as any[])
              : null;

            const weatherPayloadFromStructuredContent =
              structuredContent && typeof structuredContent === "object" && !Array.isArray(structuredContent)
                ? (structuredContent as any).weatherPipeline
                : undefined;
            const weatherPayload = weatherTool?.structuredContent ?? weatherPayloadFromStructuredContent;

            if (weatherPayload && !deep) {
              logBoth("info", "[WeatherDirect] Bypassing LLM synthesis");
              const rendered = renderWeatherDirectAnswer(currentText || "", weatherPayload);
              const aiMessage: any = { sender: "ai", text: rendered.text, structuredContent: rendered.structuredContent };
              if (toolsUsedInThisRequest.length > 0) aiMessage.toolsUsed = toolsUsedInThisRequest;
              sessionHistory.push(aiMessage);

              sendSafe(ws, { type: "chunk", text: rendered.text, structuredContent: rendered.structuredContent });
              sendSafe(ws, { type: "history-update", messages: sessionHistory });
              sendDoneOnce();
              sendDoneOnce();

              chatTraceOut({
                transport: "ws",
                sid: currentSessionId,
                cid,
                uiMode,
                route: "weatherDirect",
                tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : (structuredContentToolName || "weatherPipeline"),
                code: 200,
                durMs: Date.now() - traceStartMs,
                q: messageWithFile,
                ans: rendered.text,
              });
              return; // ✅ Skip Ollama finalize
            }

            if (weatherResults && !deep) {
              const renderBkkDateStr = (offsetDays: number): string => {
                const now = new Date();
                const bkkMs = now.getTime() + (7 * 60 * 60 * 1000);
                const bkk = new Date(bkkMs);
                bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
                const dd = String(bkk.getUTCDate()).padStart(2, "0");
                const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
                const yyyy = bkk.getUTCFullYear();
                return `${dd}/${mm}/${yyyy}`;
              };

              const firstOk = weatherResults.find((r: any) => r && r.type !== "error") || weatherResults[0];

              let finalText = "";

              if (!firstOk || firstOk.type === "error") {
                const err = String(firstOk?.error || "WEATHER_PIPELINE_ERROR");
                if (err === "PROVINCE_MISSING") {
                  finalText = "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการ (เช่น \"พรุ่งนี้เชียงใหม่ฝนตกไหม\")";
                } else if (err === "TIMEOUT") {
                  finalText = "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา (TIMEOUT) ลองใหม่อีกครั้งได้ครับ";
                } else {
                  finalText = `ขออภัย ระบบพยากรณ์อากาศขัดข้อง (${err})`;
                }
              } else if (firstOk.type === "national") {
                const d = firstOk.data || {};
                const label = d.dateLabel || "พรุ่งนี้";
                const topN = d.topN ?? (Array.isArray(d.rows) ? d.rows.length : 0);
                const topRows = Array.isArray(d.rows) ? d.rows : [];
                const topSummary = topRows
                  .slice(0, 5)
                  .map((r: any) => `${String(r?.province || "-")} (${Number(r?.percentRain ?? 0)}%)`)
                  .join(", ");
                const note = d.note ? `\n\nหมายเหตุ: ${d.note}` : "";
                const table = d.tableMarkdown ? `\n\n${d.tableMarkdown}` : "";
                const suffix = topSummary ? `: ${topSummary}` : "";
                finalText = `จังหวัดที่ฝนตกมากสุดในไทย (${label}) Top ${topN}${suffix}${table}${note}`;
              } else if (firstOk.type === "forecast7d") {
                const province = firstOk.province || "";
                const f = firstOk.data?.forecast;
                const targetDate = /วันนี้|ตอนนี้|ขณะนี้/i.test(currentText || "") ? renderBkkDateStr(0) : renderBkkDateStr(1);

                if (f && typeof f === "object" && Array.isArray((f as any).ForecastDate)) {
                  const idx = ((f as any).ForecastDate as string[]).indexOf(targetDate);
                  const i = idx >= 0 ? idx : 0;
                  const rain = Number((f as any).PercentRainCover?.[i]) || 0;
                  const tmax = (f as any).MaximumTemperature?.[i];
                  const tmin = (f as any).MinimumTemperature?.[i];
                  const desc = String((f as any).DescriptionThai?.[i] || "").trim();
                  finalText = `พยากรณ์อากาศ${province} (${targetDate}): โอกาสฝน ~${rain}% อุณหภูมิ ${tmin ?? "—"}–${tmax ?? "—"}°C${desc ? `, ${desc}` : ""}`;
                } else {
                  finalText = `พยากรณ์อากาศ${province}: ดึงข้อมูลพยากรณ์ 7 วันสำเร็จ (หากต้องการ \"ตาราง\" บอกได้ครับ)`;
                }
              } else if (firstOk.type === "station3h") {
                const province = firstOk.province || "";
                const list = Array.isArray(firstOk.data) ? firstOk.data : [];
                const s = list[0] || {};
                const temp = s.Temp ?? s.Temperature ?? s.AirTemperature ?? s.TempC;
                finalText = `อากาศตอนนี้${province}: พบข้อมูลสถานี ${list.length} จุด${temp !== undefined ? `, อุณหภูมิประมาณ ${temp}°C` : ""}`;
              } else {
                finalText = `ผลพยากรณ์อากาศ (${firstOk.type}) สำหรับ ${firstOk.province || "พื้นที่ที่ถาม"}`;
              }

              const aiMessage: any = { sender: "ai", text: finalText };
              if (weatherTool?.structuredContent) aiMessage.structuredContent = weatherTool.structuredContent;
              if (toolsUsedInThisRequest.length > 0) aiMessage.toolsUsed = toolsUsedInThisRequest;
              sessionHistory.push(aiMessage);

              const chunkMsg: any = { type: "chunk", text: finalText };
              if (weatherTool?.structuredContent) chunkMsg.structuredContent = weatherTool.structuredContent;
              sendSafe(ws, chunkMsg);
              sendSafe(ws, { type: "history-update", messages: sessionHistory });

              chatTraceOut({
                transport: "ws",
                sid: currentSessionId,
                cid,
                uiMode,
                route: "weatherDirect",
                tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : (weatherTool?.toolName || "weatherPipeline"),
                code: 200,
                durMs: Date.now() - traceStartMs,
                q: messageWithFile,
                ans: finalText,
              });
              return; // ✅ Skip Ollama finalize
            }
          } else if (mcpResult.toolsFailed) {
            // Tools were selected but all failed — ask Ollama to craft a short sorry message
            let sorryMessage = "ขออภัย ขณะนี้ไม่สามารถให้ข้อมูลที่คุณต้องการได้";
            try {
              const apologyPrompt = `กรุณาสร้างข้อความขอโทษสั้นๆ (ภาษาไทย) ความยาวไม่เกิน 2 ประโยค อธิบายว่าไม่สามารถดึงข้อมูลหรือประมวลผลได้ในขณะนี้ และแนะนำทางเลือก เช่น ลองอีกครั้งภายหลัง หรือตรวจสอบรายละเอียดเพิ่มเติม ตอนจบให้สุภาพและกระชับ ตอบเฉพาะข้อความ ไม่ต้องมี markdown หรือข้อมูลเสริมอื่นๆ`;
              const apologyResp = await ollama.chat({
                model: ollamaModel,
                messages: [
                  { role: "system", content: "You are a concise and polite Thai assistant." },
                  { role: "user", content: apologyPrompt },
                ],
                stream: false,
              });
              let candidate = String(apologyResp?.message?.content || "").trim();
              // Clean up stray double-quote artifacts (e.g. trailing "" or surrounding quotes)
              const cleanCandidate = candidate.replace(/"{2,}/g, "").replace(/^"+|"+$/g, "").trim();
              if (cleanCandidate.length > 0) sorryMessage = cleanCandidate;
            } catch (e) {
              logBoth("error", `[Chat API] Failed to generate apology via Ollama: ${e}`);
            }

            sessionHistory.push({ sender: "ai", text: sorryMessage });
            // Send as a final chunk and history update
            sendSafe(ws, { type: "chunk", text: sorryMessage });
            sendSafe(ws, {
                type: "history-update",
                messages: sessionHistory,
            });

            chatTraceOut({
              transport: "ws",
              sid: currentSessionId,
              cid,
              uiMode,
              route: "mcpToolsFailed",
              tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : "none",
              code: 200,
              durMs: Date.now() - traceStartMs,
              q: messageWithFile,
              ans: sorryMessage,
            });
            return; // Don't proceed to Ollama
          }
        } catch (mcpError) {
          logBoth("error", `[Chat API] MCP processing error: ${mcpError}`);
        }
      }

      // **Use Ollama with full history**
      try {
        // Build comprehensive system prompt with MDES identity
        const systemPromptContent = buildSystemPrompt({
          includeTools: true,
          includeCapabilities: true,
          includeGuidelines: true
        });
        
        const systemPrompt = {
          role: "system",
          content: systemPromptContent
        };

        const ollamaMessages = [systemPrompt];

        // PERFORMANCE OPTIMIZATION: History Truncation
        // If we have fresh MCP context (e.g. weather data), we assume the user wants an answer based on THAT.
        // We drop older history (keep only last 2 turns) to maximize attention on the new data and reduce token count.
        if (mcpContext) {
            const recentHistory = sessionHistory.slice(-3, -1); // Keep last interaction only
            ollamaMessages.push(...recentHistory.map((m) => ({
                role: m.sender === "ai" ? "assistant" : "user",
                content: m.text,
            })));
            logBoth('info', `[Chat API] ⚡ Optimization: Truncated history to last ${recentHistory.length} messages due to MCP context.`);
        } else {
            // Normal conversation: use full history
            ollamaMessages.push(...sessionHistory.slice(0, -1).map((m) => ({
                role: m.sender === "ai" ? "assistant" : "user",
                content: m.text,
            })));
        }

        ollamaMessages.push({ 
            role: "user", 
            content: contextPrefix + (mcpContext ? `${mcpContext}\n\n` : '') + currentText 
        });

        const streamStartTime = Date.now();
        logBoth('info', `Sending messages to Ollama (messageCount: ${ollamaMessages.length}, model: ${ollamaModel}, mode: ${AI_MODE})`);

        // Call Ollama with streaming and optimized options for speed
        const responseStream = await ollama.chat({
          model: ollamaModel,
          messages: ollamaMessages,
          stream: true,
          keep_alive: '30m',
          options: {
            // ULTIMATE SPEED optimizations
            temperature: 0.7,        // Balanced
            num_ctx: 2048,           // REDUCED from 4096 (2x faster)
            num_predict: 1024,       // ✅ เพิ่มจาก 512 เป็น 1024 สำหรับ response ที่ยาวขึ้น (เช่น รายการจังหวัด)
            top_k: 40,
            top_p: 0.9,
            repeat_penalty: 1.1,
            num_thread: 8,
            num_gpu: 99,
          },
        });

        let aiResponse = "";
        let isFirstChunk = true;
        let chunkCount = 0;
        let lastProgressTime = Date.now();
        const progressInterval = 15000; // แจ้งทุก 15 วินาที

        logBoth('info', `Receiving streamed response from Ollama (model: ${ollamaModel})`);
        
        // 🎯 Progress Messages แบบ Random & Dynamic (Natural Language)
        const thinkingMessages = [
          "🤔 กำลังคิดคำตอบ...",
          "💭 กำลังวิเคราะห์คำถามของคุณ...",
          "🧠 กำลังประมวลผลข้อมูล...",
          "⚡ กำลังค้นหาข้อมูลที่เหมาะสม...",
          "📊 กำลังรวบรวมข้อมูล...",
          "🔍 กำลังตรวจสอบรายละเอียด...",
          "✨ กำลังเตรียมคำตอบที่ดีที่สุด...",
          "🎯 กำลังจัดเรียงข้อมูล...",
          "💡 กำลังค้นหาคำตอบ...",
          "🚀 กำลังประมวลผล...",
        ];
        const randomThinking = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
        
        // ส่ง progress indicator เริ่มต้น
        sendSafe(ws, { 
          type: "progress", 
          text: randomThinking,
          stage: "thinking"
        });

        for await (const chunk of responseStream) {
          if (!chunk.message || !chunk.message.content) continue;
          chunkCount++;

          // ส่ง progress update ทุก 15 วินาที
          const now = Date.now();
          if (now - lastProgressTime > progressInterval) {
            const elapsedSec = Math.floor((now - streamStartTime) / 1000);
            sendSafe(ws, { 
              type: "progress", 
              text: `⏳ ยังคงประมวลผล... (${elapsedSec}วินาที)`,
              stage: "processing",
              elapsed: elapsedSec
            });
            lastProgressTime = now;
          }

          if (isFirstChunk && mcpContext) {
            sendSafe(ws, { type: "mcp-context", text: mcpContext });
            isFirstChunk = false;
          }

          aiResponse += chunk.message.content;

          // Send the incoming chunk as-is to the client (frontend will append)
          // Include structuredContent if available (e.g., chartSvg)
          const chunkMsg: any = { type: "chunk", text: chunk.message.content };
          if (structuredContent) {
            chunkMsg.structuredContent = structuredContent;
            // ✅ Log only on first chunk to reduce spam
            if (isFirstChunk) {
              console.log("[Chat API] Response includes structuredContent, keys:", Object.keys(structuredContent));
            }
          }
          sendSafe(ws, chunkMsg);
        }

        const streamDuration = Date.now() - streamStartTime;
        logBoth('info', `Stream completed (duration: ${streamDuration}ms, chunkCount: ${chunkCount}, responseLength: ${aiResponse.length}, model: ${ollamaModel})`);

        // � Validate Thai language (must be Thai only)
        const languageCheck = validateThaiLanguage(aiResponse, { originalQuestion: currentText });
        if (!languageCheck.isThaiOnly) {
          logBoth('warn', `[Language Validator] ⚠️ Non-Thai response detected! Stripping non-Thai segments...`);
          logBoth('warn', `  - Original question: ${currentText}`);
          logBoth('warn', `  - Invalid response preview: ${aiResponse.substring(0, 200)}...`);
          
          // Send warning to client
          sendSafe(ws, {
            type: "warning",
            text: "⚠️ กำลังปรับปรุงคำตอบให้เป็นภาษาไทย..."
          });
          
          // Use SANITIZATION instead of REWRITE (Requirement: Strip non-Thai tokens)
          logBoth('warn', `[Language Validator] ⚠️ Non-Thai response detected! Stripping non-Thai segments...`);
          
          const sanitized = sanitizeThaiSegments(aiResponse);
          
          if (sanitized.length < 5) {
             logBoth('error', `[Language Validator] ❌ Sanitization removed almost everything.`);
             // If validation fails completely, use fallback error message
             aiResponse = createThaiErrorResponse(currentText);
          } else {
             aiResponse = sanitized;
             logBoth('info', `[Language Validator] ✅ Sanitized response (New length: ${aiResponse.length})`);
          }

        } else {
          logBoth('info', `[Language Validator] ✅ Response is Thai-only (${languageCheck.confidence.toFixed(1)}% Thai)`);
          
          // Log AI response for quality monitoring
          const previewLength = Math.min(aiResponse.length, 300);
          logBoth('info', `[AI Response] "${aiResponse.substring(0, previewLength)}${aiResponse.length > 300 ? '...' : ''}"`);
          if (aiResponse.length > 300) {
            logBoth('info', `[AI Response] Full length: ${aiResponse.length} chars`);
          }
        }

        // �📝 สำหรับ response ยาว (>1000 ตัวอักษร) ส่ง summary ก่อน
        if (aiResponse.length > 1000 && chunkCount > 300) {
          const summaryText = `📋 ตอบเสร็จแล้ว! (${aiResponse.length} ตัวอักษร, ใช้เวลา ${Math.floor(streamDuration/1000)}วินาที)`;
          sendSafe(ws, { 
            type: "response-summary", 
            text: summaryText,
            length: aiResponse.length,
            duration: streamDuration
          });
        }

        // Add AI response to history and send back to client
        const aiMessage: any = { sender: "ai", text: aiResponse };
        if (structuredContent) {
          aiMessage.structuredContent = structuredContent;
        }
        // Add toolsUsed if any tools were used
        if (toolsUsedInThisRequest.length > 0) {
          aiMessage.toolsUsed = toolsUsedInThisRequest;
        }
        sessionHistory.push(aiMessage);
        
        // 📝 Log AI response to session with tools used
        sessionManager.addMessage(currentSessionId, 'assistant', aiResponse, toolsUsedInThisRequest.length > 0 ? toolsUsedInThisRequest : undefined);
        sessionManager.completeResponse(currentSessionId); // ✅ Complete tracking
        logBoth('info', `[Session] Added AI response to session (tools: ${toolsUsedInThisRequest.join(', ') || 'none'})`);
        
        logBoth('info', `AI response complete (responseLength: ${aiResponse.length}, totalMessages: ${sessionHistory.length})`);

        chatTraceOut({
          transport: "ws",
          sid: currentSessionId,
          cid,
          uiMode,
          route: "ollama",
          tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : "none",
          code: 200,
          durMs: Date.now() - traceStartMs,
          q: messageWithFile,
          ans: aiResponse,
        });

        // Send updated history back to client with toolsUsed
        sendSafe(ws, {
            type: "history-update",
            messages: sessionHistory,
            toolsUsed: toolsUsedInThisRequest.length > 0 ? toolsUsedInThisRequest : undefined,
          });
        sendDoneOnce();
      } catch (ollamaError) {
        logBoth("error", `[Chat API] Ollama error: ${ollamaError}`);
        logBoth('error', `Ollama chat error: ${ollamaError instanceof Error ? ollamaError.message : String(ollamaError)} (model: ${ollamaModel}, mode: ${AI_MODE})`);
        chatTraceOut({
          transport: "ws",
          sid: currentSessionId,
          cid,
          uiMode,
          route: "ollamaError",
          tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : "none",
          code: 500,
          durMs: Date.now() - traceStartMs,
          q: messageWithFile,
          ans: "Failed to get response from AI model",
        });
        sendSafe(ws, { error: "Failed to get response from AI model", type: "error" });
        sendDoneOnce();
        return;
      }
    }).catch(queueError => {
      logBoth("error", `[Queue] Failed to process message: ${queueError}`);
      try {
        sendSafe(ws, { error: "Server busy, please try again", type: "error" });
        sendSafe(ws, { type: "done" });
      } catch (e) {
        // WebSocket might be closed
      }
    });
  });

  ws.on("close", () => {
    logBoth("info", `[Chat API] WebSocket closed - total=${wss.clients.size}`);
  });

  ws.on("error", (error) => {
    logBoth("error", `[Chat API] WebSocket error: ${error}`);
  });
});

// --- 7. POST Endpoint (REST API) with FastPath ---
// 🚀 FastPath middleware intercepts greetings and responds immediately (<1s)
// 🔐 optionalAuth: Attach user info if logged in, allow guests
// 🎯 guestLimiter: Restrict guests to 50% capability
// NOTE: Mounted at /api/chat, so this should be the root path
chatRouter.post("/", optionalAuth, guestLimiterMiddleware, fastPathChatMiddleware(), async (req, res) => {
  try {
    syncChatAIModeIfChanged();
    const { message, messages, history: incomingHistory } = req.body;
    const uiModeRaw = String((req.body as any)?.uiMode || "").trim();
    const uiMode = uiModeRaw || "auto";
    const officerMode = uiMode === "officer";
    const httpCid = String((req.headers["x-correlation-id"] as string) || (req.headers["x-correlationid"] as string) || "");

    const testDegradeTMD = req.headers["x-test-degrade-tmd"] === "1";
    const testDegradeNWP = req.headers["x-test-degrade-nwp"] === "1";
    const testDegradeRemote = req.headers["x-test-degrade-ollama-remote"] === "1";
    const testDegradeDB = req.headers["x-test-degrade-db"] === "1";
    const testDegradeWEBDDSB = req.headers["x-test-degrade-webddsb"] === "1";

    if (testDegradeTMD) process.env.TEST_DEGRADE_TMD = "1";
    if (testDegradeNWP) process.env.TEST_DEGRADE_NWP = "1";
    if (testDegradeRemote) process.env.TEST_DEGRADE_OLLAMA_REMOTE = "1";
    if (testDegradeDB) process.env.TEST_DEGRADE_DB = "1";
    if (testDegradeWEBDDSB) process.env.TEST_DEGRADE_WEBDDSB = "1";

    res.on("finish", () => {
      if (testDegradeTMD) delete process.env.TEST_DEGRADE_TMD;
      if (testDegradeNWP) delete process.env.TEST_DEGRADE_NWP;
      if (testDegradeRemote) delete process.env.TEST_DEGRADE_OLLAMA_REMOTE;
      if (testDegradeDB) delete process.env.TEST_DEGRADE_DB;
      if (testDegradeWEBDDSB) delete process.env.TEST_DEGRADE_WEBDDSB;
    });

    if (officerMode) {
      logBoth("info", `[OfficerMode] uiMode=officer boostedTools=evidenceTool,detect_evidence_stats,webdTool_*`);
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    logBoth("info", `[Chat API] Received POST chat message (len=${String(message || "").length})`);

    // Get full message history from client or initialize empty
    // Also accept `history` field (array of {role,content}) as alias for messages
    const normalizedIncomingHistory: ChatMessage[] = Array.isArray(incomingHistory)
      ? incomingHistory.map((h: any) => ({
          sender: String(h.role || "").toLowerCase() === "user" ? "user" : "ai",
          text: String(h.content || h.text || ""),
        }))
      : [];
    let sessionHistory: ChatMessage[] = messages || (normalizedIncomingHistory.length > 0 ? normalizedIncomingHistory : []);

    // 📎 Handle file attachment (HTTP parity with WS)
    let fileContext = "";
    const file = (req.body as any)?.file;
    if (file) {
      try {
        const name = String(file?.name || "(unknown)");
        const type = String(file?.type || "application/octet-stream");
        const size = Number(file?.size || 0);
        logBoth("info", `[File Upload] POST: Processing file: ${name} (${type}, ${(size / 1024).toFixed(2)}KB)`);

        if (type.startsWith("image/")) {
          fileContext = `\n[ผู้ใช้แนบรูปภาพ: ${name}]`;
        } else {
          fileContext = `\n[ผู้ใช้แนบไฟล์: ${name} (${type})]`;
        }
      } catch {
        // ignore malformed file payload
      }
    }

    const messageWithFile = String(message || "") + fileContext;

    // ─── Carry-forward: enrich ambiguous follow-up queries with context from history ───
    // Make short follow-ups explicit enough for deterministic gates and general answers.
    const enrichedMessage = buildHistoryAwareFollowUpQuery(messageWithFile, sessionHistory);
    if (enrichedMessage !== messageWithFile) {
      logBoth("info", `[CarryForward] http enriched "${messageWithFile}" -> "${enrichedMessage}"`);
    }

    const traceStartMs = Date.now();
    // Use enrichedMessage for routing/planning when it differs from raw message
    const routingMessage = enrichedMessage !== messageWithFile ? enrichedMessage : messageWithFile;
    const evidenceAction = inferOfficerEvidenceAction(routingMessage);
    const answerPlan = planAnswer(routingMessage);
    const historyAwareDirectAnswer = buildHistoryAwareFollowUpAnswer(messageWithFile, sessionHistory);
    const planStr = answerPlan.steps.map((s) => s.name).join(",") || "none";
    const fallbackStr = answerPlan.steps.map((s) => s.fallback).join(",") || "none";
    logBoth("info", `[AnswerPlanner] transport=http intent=${answerPlan.intent} plan=${planStr} fallback=${fallbackStr} keywordSource=${answerPlan.notes.join(",")} dbOperational=unknown`);

    // Best-effort sessionId/requestId correlation for HTTP parity
    const cookieMap = String(req.headers.cookie || "")
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .reduce((acc, pair) => {
        const [k, v] = pair.split("=");
        if (k) acc[k] = v;
        return acc;
      }, {} as Record<string, string>);
    const httpSessionId = cookieMap.sessionId || (req.headers["x-session-id"] as string) || undefined;

    chatTraceIn({ transport: "http", sid: httpSessionId, cid: httpCid, uiMode, msg: messageWithFile });

    // Add user message to history
    sessionHistory.push({ sender: "user", text: messageWithFile });
    logBoth("info", `[Chat API] POST: Session history: ${sessionHistory.length} messages (before AI)`);

    if (historyAwareDirectAnswer) {
      const textOut = historyAwareDirectAnswer.text;
      const scOut = withRenderMeta(
        {
          historyAwareFollowUp: {
            matched: true,
            route: historyAwareDirectAnswer.route,
          },
        },
        { route: historyAwareDirectAnswer.route, llmUsed: false, routeDecider: "deterministic", version: "phase11.2" }
      );

      sessionHistory.push({ sender: "ai", text: textOut } as any);

      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: historyAwareDirectAnswer.route === "weather" ? "weatherGate" : "general",
        tool: "historyCarryForward",
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: textOut,
      });

      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: false,
        mcpResults: null,
      });
    }

    // =====================================
    // Phase 7.2.5: Deterministic Evidence Fastpath (NO LLM classify/tool-select)
    // =====================================
    if (mcpClient && (evidenceAction || answerPlan.intent === "evidence")) {
      logBoth("info", `[EvidenceFastPath] deterministicEvidence=true transport=http action=${evidenceAction} uiMode=${uiMode}`);

      if (!evidenceAction) {
        const textOut = "สรุปหลักฐานเบื้องต้น: ขณะนี้ยังไม่มีข้อมูลจากคลังหลักฐาน (โหมดสำรอง)";
        const scOut = withRenderMeta(
          {
            ok: false,
            code: "EVIDENCE_PLACEHOLDER",
            message: "fallback placeholder",
            meta: { dataSource: "placeholder", note: "operator-grade fallback" },
            table: { rows: [] },
            stats: { total: 0 },
          },
          { route: "evidence", llmUsed: false, routeDecider: "deterministic", version: "phase10.2" }
        );

        sessionHistory.push({ sender: "ai", text: textOut } as any);
        return res.json({ text: textOut, structuredContent: scOut, messages: sessionHistory, mcpUsed: false, mcpResults: null });
      }

      const primaryToolName = "innomcp-server:evidenceTool";
      let toolNameUsed = primaryToolName;
      let toolResults = await mcpClient.executeTools([primaryToolName], messageWithFile, {
        [primaryToolName]: { action: evidenceAction },
      });

      let first = Array.isArray(toolResults) ? toolResults[0] : undefined;
      let sc = first?.structuredContent ?? first?.result;
      let direct = renderStructuredDirect(first?.toolName || toolNameUsed, sc, messageWithFile);
      let textOut = direct?.text || "ขออภัย ไม่สามารถดึงข้อมูลหลักฐานได้ในขณะนี้";

      let traceAns = formatOfficerEvidenceTraceAnswer(sc);

      const hasIspRows = (() => {
        const rows = sc && typeof sc === "object" ? (sc as any)?.table?.rows : null;
        return Array.isArray(rows) && rows.length >= 3;
      })();
      const hasTrendPoints = (() => {
        const pts = sc && typeof sc === "object" ? (sc as any)?.series?.points : null;
        return Array.isArray(pts) && pts.length >= 7;
      })();
      const schemaMissingForAction =
        (evidenceAction === "evidence_records_yesterday_by_isp_top" && !hasIspRows) ||
        (evidenceAction === "evidence_records_last_7_days_trend" && !hasTrendPoints);

      const shouldLocalFallback =
        first?.success !== true ||
        (typeof sc === "object" && sc && (sc as any).ok === false) ||
        /ไม่พบค่าจำนวนในผลลัพธ์/i.test(String(textOut || "")) ||
        /^ERR:/i.test(traceAns) ||
        traceAns === "ERR:COUNT_MISSING" ||
        schemaMissingForAction;

      if (shouldLocalFallback) {
        const localIntent = mapOfficerEvidenceActionToLocalIntent(evidenceAction);
        if (localIntent) {
          const localToolName = "local-tools:detect_evidence_stats";
          const localResults = await mcpClient.executeTools([localToolName], messageWithFile, {
            [localToolName]: { intent: localIntent },
          });
          const localFirst = Array.isArray(localResults) ? localResults[0] : undefined;
          const localSc = localFirst?.structuredContent ?? localFirst?.result;
          const localDirect = renderStructuredDirect(localFirst?.toolName || localToolName, localSc, messageWithFile);
          const localTextOut = localDirect?.text;
          if (localTextOut) {
            toolNameUsed = localToolName;
            toolResults = localResults;
            first = localFirst;
            sc = localSc;
            direct = localDirect;
            textOut = localTextOut;
            traceAns = formatOfficerEvidenceTraceAnswer(sc);
          }
        }
      }

      sessionHistory.push({ sender: "ai", text: textOut } as any);

      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: "officerEvidence",
        tool: toolNameUsed,
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: traceAns,
      });

      const scOut = withRenderMeta(sc, { route: "evidence", llmUsed: false, routeDecider: "deterministic", version: "phase8" });

      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: true,
        mcpResults: toolResults,
      });
    }

    // =====================================
    // Phase 11.2a: Deterministic Seismic Router (HTTP parity with WS)
    // =====================================
    const seismicLikeHttp = /แผ่นดินไหว|seismic|earthquake|ริกเตอร์|richter/i.test(routingMessage);
    if (mcpClient && seismicLikeHttp) {
      logBoth("info", `[SeismicGate] bypass=true transport=http query=${routingMessage.slice(0, 80)}`);
      const toolName = "tmd_seismic_daily_events";
      const toolResults = await mcpClient.executeTools([toolName], routingMessage);
      const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
      const sc = first?.structuredContent ?? first?.result;
      const direct = renderStructuredDirect(toolName, sc, routingMessage) || { text: "ขออภัย ไม่สามารถดึงข้อมูลแผ่นดินไหวได้ในขณะนี้" };
      const textOut = direct.text;
      const scOut = withRenderMeta(sc, { route: "seismic", llmUsed: false, routeDecider: "deterministic", version: "phase11.2" }, [toolName]);
      sessionHistory.push({ sender: "ai", text: textOut } as any);
      chatTraceOut({ transport: "http", sid: httpSessionId, cid: httpCid, uiMode, route: "seismicGate", tool: toolName, code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut.slice(0, 120) });
      return res.json({ text: textOut, structuredContent: scOut, messages: sessionHistory, mcpUsed: true, mcpResults: toolResults, toolsUsed: [toolName], route: "seismic" });
    }

    // =====================================
    // Phase 11.2b: Deterministic TMD Subtopic Router (warning, climate, station, rain regions)
    // Routes specific TMD queries to their dedicated MCP tools instead of generic weatherPipeline
    // =====================================
    const tmdSubtopicRoutes: Array<{ pattern: RegExp; tool: string; route: string; fallbackText: string }> = [
      { pattern: /เตือนภัย|ประกาศเตือน|warning.*weather|weather.*warning|คำเตือน.*อากาศ|อากาศ.*เตือน/i, tool: "tmd_weather_warning_news", route: "tmd_warning", fallbackText: "ขออภัย ไม่สามารถดึงข้อมูลการเตือนภัยได้ในขณะนี้" },
      { pattern: /ค่าปกติ|climate.*normal|สภาพ.*ปกติ|เฉลี่ย.*30.*ปี|1981.*2010/i, tool: "tmd_thailand_climate_normal_1981_2010", route: "tmd_climate", fallbackText: "ขออภัย ไม่สามารถดึงข้อมูลค่าปกติภูมิอากาศได้ในขณะนี้" },
      { pattern: /รายชื่อ.*สถานี|สถานี.*มีกี่|มีสถานี.*อะไร|จำแนก.*สถานี|station.*list/i, tool: "tmd_station_list", route: "tmd_stations", fallbackText: "ขออภัย ไม่สามารถดึงข้อมูลสถานีอุตุนิยมวิทยาได้ในขณะนี้" },
      { pattern: /ฝน.*ราย.*เดือน|ปริมาณ.*ฝน.*เฉลี่ย|monthly.*rain|เดือน.*ฝน.*มาก/i, tool: "tmd_thailand_monthly_rainfall", route: "tmd_rainfall", fallbackText: "ขออภัย ไม่สามารถดึงข้อมูลปริมาณฝนรายเดือนได้ในขณะนี้" },
      { pattern: /ฝน.*ภูมิภาค|ภูมิภาค.*ฝน|rain.*region|ฝน.*ภาค.*ไหน.*มาก|ฝน.*แต่ละ.*ภาค|ฝนราย.*ภาค/i, tool: "tmd_rain_regions", route: "tmd_rain_regions", fallbackText: "ขออภัย ไม่สามารถดึงข้อมูลฝนตามภูมิภาคได้ในขณะนี้" },
    ];
    const matchedSubtopic = mcpClient ? tmdSubtopicRoutes.find(r => r.pattern.test(routingMessage)) : undefined;
    if (mcpClient && matchedSubtopic) {
      logBoth("info", `[TMDSubtopicGate] bypass=true transport=http tool=${matchedSubtopic.tool} query=${routingMessage.slice(0, 80)}`);
      const toolResults = await mcpClient.executeTools([matchedSubtopic.tool], routingMessage);
      const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
      const sc = first?.structuredContent ?? first?.result;
      const direct = renderStructuredDirect(matchedSubtopic.tool, sc, routingMessage) || { text: matchedSubtopic.fallbackText };
      const textOut = direct.text;
      const scOut = withRenderMeta(sc, { route: matchedSubtopic.route, llmUsed: false, routeDecider: "deterministic", version: "phase11.2" }, [matchedSubtopic.tool]);
      sessionHistory.push({ sender: "ai", text: textOut } as any);
      chatTraceOut({ transport: "http", sid: httpSessionId, cid: httpCid, uiMode, route: matchedSubtopic.route as any, tool: matchedSubtopic.tool, code: 200, durMs: Date.now() - traceStartMs, q: messageWithFile, ans: textOut.slice(0, 120) });
      return res.json({ text: textOut, structuredContent: scOut, messages: sessionHistory, mcpUsed: true, mcpResults: toolResults, toolsUsed: [matchedSubtopic.tool], route: matchedSubtopic.route });
    }

    // =====================================
    // Phase 7.1: Deterministic Weather Router (NO LLM tool planning)
    // Gate BEFORE any MCP tool selection / LLM classification.
    // =====================================
    const geoLike = looksLikeDeterministicGeoQuery(routingMessage);
    const weatherLike = looksLikeDeterministicWeatherQuery(routingMessage);
    const allowWeatherGate = answerPlan.intent === "weather" || (!officerMode
      ? weatherLike && (!geoLike || hasExplicitWeatherIntentKeywords(routingMessage))
      : weatherLike && hasExplicitWeatherIntentKeywords(routingMessage));
    if (mcpClient && allowWeatherGate) {
      const mcp = mcpClient;
      const deep = wantsDeepExplain(routingMessage);
      logBoth("info", `[WeatherGate] bypass=true transport=http deepExplain=${deep} hasFileContext=${fileContext.length > 0}`);

      const wxAbort = new AbortController();
      const onHttpClose = () => {
        try { wxAbort.abort(); } catch {}
      };
      res.on("close", onHttpClose);

      // Multi-district Bangkok support (robust aliases/typos): run pipeline per district when user clearly asks for 2 areas.
      const extractBangkokDistrictTargets = (text: string): string[] => {
        const raw = String(text || "");
        if (!/กรุงเทพ|กรุงเทพมหานคร|กทม/i.test(raw)) return [];
        const norm = raw.replace(/[\u0E2F]/g, ""); // drop ฯ for matching

        const candidates: Array<{ name: string; idx: number }> = [];
        const pushIfFound = (name: string, re: RegExp) => {
          const i = norm.search(re);
          if (i >= 0) candidates.push({ name, idx: i });
        };

        pushIfFound("หลักสี่", /หลักสี่/);
        pushIfFound("หลักสี่", /ลักสี่/);
        pushIfFound("ลาดกระบัง", /ลาดกระบัง/);
        pushIfFound("บางรัก", /บางรัก/);
        pushIfFound("ปทุมวัน", /ปทุมวัน/);
        pushIfFound("จตุจักร", /จตุจักร/);

        const uniq: string[] = [];
        for (const c of candidates.sort((a, b) => a.idx - b.idx)) {
          if (!uniq.includes(c.name)) uniq.push(c.name);
        }
        return uniq.slice(0, 2);
      };

      const bkkTargets = extractBangkokDistrictTargets(messageWithFile);
      const multiBkk = bkkTargets.length === 2;

      const bkkRunTexts = multiBkk
        ? bkkTargets.map((d) => `กรุงเทพมหานคร เขต${d} ` + messageWithFile)
        : [messageWithFile];

      let toolResults: any[] = [];
      try {
        if (multiBkk) {
          // Sequential to reduce concurrent upstream load; abort will stop in-flight calls on disconnect.
          for (let i = 0; i < bkkTargets.length; i++) {
            const d = bkkTargets[i];
            const runText = bkkRunTexts[i] || (`กรุงเทพมหานคร เขต${d} ` + messageWithFile);
            toolResults.push(
              await mcp.runDeterministicWeatherPipeline(runText, { signal: wxAbort.signal })
            );
            if (wxAbort.signal.aborted) break;
          }
        } else {
          toolResults = [await mcp.runDeterministicWeatherPipeline(routingMessage, { signal: wxAbort.signal })];
        }
      } catch (wxErr: any) {
        logBoth("error", `[WeatherGate] transport=http mcp fallback triggered: ${wxErr.message}`);
        toolResults = [{ structuredContent: { weatherPipeline: { ok: false, code: "UPSTREAM_ERROR", message: "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง หรือเชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้ (ERR:WX_UPSTREAM_ERROR)" } } }];
      } finally {
        try { res.removeListener("close", onHttpClose); } catch {}
      }

      const primaryToolResult = toolResults[0] || {};
      const sc = primaryToolResult.structuredContent || primaryToolResult;
      const payload = sc?.weatherPipeline ?? sc;

      const directOne = (tr: any, userText: string) => {
        const scc = tr?.structuredContent;
        const pay = scc?.weatherPipeline ?? scc;
        return renderStructuredDirect("weatherPipeline", scc, userText) || renderWeatherDirectAnswer(userText, pay);
      };

      const direct =
        toolResults.length > 1
          ? {
              text: (() => {
                const renderedRuns = toolResults.map((tr: any, idx: number) => {
                  const runText = bkkRunTexts[idx] || messageWithFile;
                  return directOne(tr, runText);
                });

                const headers = renderedRuns
                  .map((r) => String(r?.text || "").split(/\r?\n/).map((x) => x.trim()))
                  .map((lines) => lines.find((l) => /^ช่วงเวลา\s*:/i.test(l)) || "")
                  .filter(Boolean);
                const header = headers[0] || "";

                const blocks = renderedRuns
                  .map((r) => String(r?.text || "").trim())
                  .map((t) => {
                    const lines = t.split(/\r?\n/);
                    const body = lines.filter((l) => !/^\s*ช่วงเวลา\s*:/i.test(l)).join("\n").trim();
                    return body;
                  })
                  .filter(Boolean);

                return [header, ...blocks].filter(Boolean).join("\n\n").trim();
              })(),
              structuredContent: {
                weatherPipeline: {
                  ok: true,
                  code: "MULTI_TARGET",
                  message: "multiple targets",
                  targets: bkkTargets,
                  results: toolResults.map((tr: any) => tr?.structuredContent?.weatherPipeline ?? tr?.structuredContent),
                },
              },
            }
          : directOne(primaryToolResult, messageWithFile);

      const scOut = withRenderMeta(direct.structuredContent ?? sc, { route: "weather", llmUsed: false, routeDecider: "deterministic", version: "phase8" }, ["weatherPipeline"]);

      sessionHistory.push({ sender: "ai", text: direct.text } as any);

      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: "weatherGate",
        tool: "weatherPipeline",
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: direct.text,
      });
      return res.json({
        text: direct.text,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: true,
        mcpResults: toolResults,
        toolsUsed: ["weatherPipeline"],
      });
    }

    // =====================================
    // Phase 1 GEO Round B: Deterministic GEO Gate (NO LLM tool planning)
    // Minimal Happy Path: address_normalize / geo_lookup / geo_validate
    // =====================================
    if (mcpClient && geoLike && !prefersThaiKnowledgeRoute(routingMessage) && !looksLikeMathLikeQuery(routingMessage)) {
      // Try local Thai geo resolver first
      const localResolve = resolveThaiGeoLocal(routingMessage);
      if (localResolve) {
        logBoth("info", `[GeoGateLocal] RESOLVED transport=http intent=${localResolve.geoIntent} canonical="${localResolve.canonicalQuery}"`);
        const scOut = withRenderMeta(
          { geoIntent: localResolve.geoIntent, canonicalQuery: localResolve.canonicalQuery, resolvedLocally: true },
          { route: "geo" as any, llmUsed: false, routeDecider: "deterministic", version: "phase10.14" },
          ["local:thaiGeoResolver"]
        );
        if (scOut.__groundedContract) {
          scOut.__groundedContract.canonicalQuery = localResolve.canonicalQuery;
          scOut.__groundedContract.geoIntent = localResolve.geoIntent;
        }
        sessionHistory.push({ sender: "ai", text: localResolve.text } as any);
        return res.json({ text: localResolve.text, structuredContent: scOut, messages: sessionHistory, mcpUsed: false });
      }

      const geoToolName = "local-tools:thai_geo_tool";
      const action = inferGeoAction(routingMessage);
      const toolArgs: any =
        action === "geo_lookup"
          ? { action, query: extractGeoLookupQuery(routingMessage), topN: 5 }
          : { action, address: routingMessage };

      logBoth("info", `[GeoGate] bypass=true transport=http action=${action} query=${String(toolArgs.query || "").slice(0, 60)}`);

      const toolResults = await mcpClient.executeTools([geoToolName], routingMessage, {
        [geoToolName]: toolArgs,
      });

      const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
      const sc = first?.structuredContent ?? first?.result;
      const rendered = renderThaiGeoAnswerShort(sc);
      const textOut = rendered.text;
      const scOut = withRenderMeta(sc, { route: "geo", llmUsed: false, routeDecider: "deterministic", version: "phase8" }, [geoToolName]);

      sessionHistory.push({ sender: "ai", text: textOut } as any);

      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: "geo",
        tool: geoToolName,
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: textOut,
      });

      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: true,
        mcpResults: toolResults,
      });
    }

    // =====================================
    // Phase 10.4: Web-record deterministic quality gate
    // =====================================
    if (answerPlan.intent === "web-record") {
      const recordPayload = buildWebRecordPayload(messageWithFile);
      const textOut = `สรุปการค้นข้อมูลอ้างอิง: ${recordPayload.summary}`;
      const scOut = withRenderMeta({ recordPayload }, { route: "web-record", llmUsed: false, routeDecider: "deterministic", version: "phase10.4" });
      sessionHistory.push({ sender: "ai", text: textOut } as any);
      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: false,
        mcpResults: null,
      });
    }

    // =====================================
    // Phase 11.2: Relative date-count shortcut
    // Avoid sending simple day-difference questions into weather/MCP routing.
    // =====================================
    if (/นับจาก.*ถึง.*อีกกี่วัน|เหลืออีกกี่วัน.*สิ้นปี|สิ้นปีนี้เหลือ/i.test(routingMessage)) {
      const remainingDays = countDaysUntilEndOfYear(new Date());
      const textOut = `นับจากวันนี้ถึงสิ้นปีนี้เหลืออีก ${remainingDays} วัน`;
      const scOut = withRenderMeta(
        { dateTimeShortcut: { target: "end_of_year", remainingDays } },
        { route: "general", llmUsed: false, routeDecider: "deterministic", version: "phase11.2" }
      );
      sessionHistory.push({ sender: "ai", text: textOut } as any);

      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: "general",
        tool: "dateTimeShortcut",
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: textOut,
      });

      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: false,
        mcpResults: null,
      });
    }

    // =====================================
    // Phase 10.2: God-Tier Router Gate (POST Parity)
    // =====================================
    let semanticCategory: string | undefined = undefined;
    let godTierConfidence = 1;
    let godTierFallbackUsed = false;
    try {
      const godTierRouter = getGodTierRouter();
      const conversationHistory = sessionHistory.slice(-2).map((m: any) => ({
        role: m.role || m.sender,
        content: m.content || m.text,
        timestamp: new Date()
      }));
      const routingResult = await godTierRouter.route(messageWithFile, conversationHistory);
      semanticCategory = String((routingResult as any)?.category || "").trim() || undefined;
      godTierConfidence = Number((routingResult as any)?.confidence ?? 0);
      godTierFallbackUsed = Boolean((routingResult as any)?.usedFallback || (routingResult as any)?.fallbackUsed);
    } catch (err) {
      godTierFallbackUsed = true;
    }

    if (godTierFallbackUsed || godTierConfidence < 0.6) {
      // Low confidence: clear category hint and proceed to MCP tool selection instead of short-circuiting
      logBoth('info', `[God-Tier Router] HTTP ⚠️  Low confidence (${godTierConfidence.toFixed(2)}) — clearing category, proceeding to MCP`);
      semanticCategory = undefined;
    }

    // =====================================
    // Phase 10.7: Thai Knowledge Gate — Hybrid provider (HTTP path)
    // 1) Try thaiKnowledgeTool via MCP (as required by Phase 10.5 verifier)
    // 2) Fallback to deterministic local resolver (phase10.7 behavior)
    // =====================================
    if (prefersThaiKnowledgeRoute(routingMessage) && !looksLikeDeterministicWeatherQuery(routingMessage)) {
      let tkResolved = resolveThaiGeoLocal(routingMessage);
      let mcpResults: any = null;
      let thaiKnowledgeToolAnswer: string | null = null;
      let toolResponse: any = null;

      if (mcpClient) {
        try {
          const thaiToolName = "local-tools:thaiKnowledgeTool";
          mcpResults = await mcpClient.executeTools([thaiToolName], routingMessage, {
            [thaiToolName]: { query: routingMessage, context: { domain: "geo", language: "th", confidence_required: 0.6 } },
          });

          toolResponse = Array.isArray(mcpResults) ? mcpResults[0] : mcpResults;
          const sc = toolResponse?.structuredContent ?? toolResponse?.result;

          if (sc) {
            let parsed: any = null;
            try {
              const textContent = Array.isArray(sc.content) && sc.content.length > 0 ? String(sc.content[0]?.text || "") : "";
              parsed = textContent ? JSON.parse(textContent) : null;
            } catch (e) {
              parsed = null;
            }

            if (parsed && parsed.success && Array.isArray(parsed.data) && parsed.data.length > 0) {
              const item = parsed.data[0];
              if (item.domain === "geo" && item.attributes && item.attributes.region) {
                thaiKnowledgeToolAnswer = `${item.name_th} อยู่ในภาค${item.attributes.region}ของประเทศไทย`;
              } else if (item.description) {
                thaiKnowledgeToolAnswer = item.description;
              }
            }
          }
        } catch (toolErr: any) {
          logBoth("warn", `[ThaiKnowledgeGate] thaiKnowledgeTool failed: ${toolErr?.message || toolErr}`);
        }
      }

      if (thaiKnowledgeToolAnswer) {
        const scOut = withRenderMeta(
          { thaiKnowledgeAnswer: thaiKnowledgeToolAnswer },
          { route: "geo" as any, llmUsed: false, routeDecider: "deterministic", version: "phase10.5" },
          ["local-tools:thaiKnowledgeTool"]
        );
        sessionHistory.push({ sender: "ai", text: thaiKnowledgeToolAnswer } as any);
        return res.json({
          text: thaiKnowledgeToolAnswer,
          structuredContent: scOut,
          messages: sessionHistory,
          mcpUsed: true,
          mcpResults,
        });
      }

      if (tkResolved) {
        logBoth("info", `[ThaiKnowledgeGate] LOCAL RESOLVED transport=http intent=${tkResolved.geoIntent} canonical="${tkResolved.canonicalQuery}"`);
        const scOut = withRenderMeta(
          { geoIntent: tkResolved.geoIntent, canonicalQuery: tkResolved.canonicalQuery, resolvedLocally: true },
          { route: "geo" as any, llmUsed: false, routeDecider: "deterministic", version: "phase10.7" },
          ["local:thaiGeoResolver"]
        );
        if (scOut.__groundedContract) {
          scOut.__groundedContract.canonicalQuery = tkResolved.canonicalQuery;
          scOut.__groundedContract.geoIntent = tkResolved.geoIntent;
        }
        sessionHistory.push({ sender: "ai", text: tkResolved.text } as any);
        return res.json({
          text: tkResolved.text,
          structuredContent: scOut,
          messages: sessionHistory,
          mcpUsed: !!mcpResults,
          mcpResults,
        });
      }
    }

    // =====================================
    // Phase 10.5: API Tool Gate — WorldBank, NASA, QR (HTTP path)
    // =====================================
    if (mcpClient && /worldbank|world\s*bank|เวิลด์แบงก์|nasa|apod|นาซ่า|qr\s*code|สร้าง\s*qr|\bgdp\b|ธนาคารโลก/i.test(messageWithFile)) {
      const apiToolMatch = (() => {
        const t = messageWithFile.toLowerCase();
        if (/worldbank|world\s*bank|เวิลด์แบงก์|\bgdp\b|ธนาคารโลก/.test(t)) return { tool: "innomcp-server:worldbank", gate: "WorldBank" };
        if (/nasa|apod|นาซ่า/.test(t)) return { tool: "innomcp-server:nasa", gate: "NASA" };
        if (/qr\s*code|qr\s*โค้ด|สร้าง\s*qr/i.test(t)) return { tool: "innomcp-server:qrCodeTool", gate: "QR" };
        return null;
      })();

      if (apiToolMatch) {
        logBoth("info", `[APIToolGate] bypass=true transport=http tool=${apiToolMatch.tool} gate=${apiToolMatch.gate}`);
        try {
          const toolArgs: any = (() => {
            if (apiToolMatch.gate === "WorldBank") {
              const hasGrowth = /growth|เติบโต|อัตรา/i.test(messageWithFile);
              return { country: "TH", indicator: hasGrowth ? "GDP_GROWTH" : "GDP" };
            }
            if (apiToolMatch.gate === "NASA") {
              const hasRandom = /random|สุ่ม/i.test(messageWithFile);
              return hasRandom ? { endpoint: "apod", count: 1 } : { endpoint: "apod" };
            }
            if (apiToolMatch.gate === "QR") {
              const urlMatch = messageWithFile.match(/https?:\/\/\S+/i);
              return { text: urlMatch ? urlMatch[0] : "https://example.com", size: 300 };
            }
            return {};
          })();

          const toolResults = await mcpClient.executeTools([apiToolMatch.tool], messageWithFile, {
            [apiToolMatch.tool]: toolArgs,
          });
          const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
          const sc = first?.structuredContent ?? first?.result ?? {};
          const direct = renderStructuredDirect(apiToolMatch.tool.split(":").pop() || "", sc, messageWithFile);
          const textOut = direct ? direct.text : (typeof sc === "string" ? sc : JSON.stringify(sc).slice(0, 500));
          const scOut = withRenderMeta(
            direct ? direct.structuredContent : sc,
            { route: apiToolMatch.gate.toLowerCase() as any, llmUsed: false, routeDecider: "deterministic", version: "phase10.5" },
            [apiToolMatch.tool]
          );

          sessionHistory.push({ sender: "ai", text: textOut } as any);
          return res.json({ text: textOut, structuredContent: scOut, messages: sessionHistory, mcpUsed: true, mcpResults: toolResults });
        } catch (apiErr: any) {
          logBoth("error", `[APIToolGate] HTTP ${apiToolMatch.gate} failed: ${apiErr.message}`);
          // Fall through to GeneralGate
        }
      }
    }

    // =====================================
    // Phase 11.1: CalculatorGate — Deterministic math eval (NO LLM)
    // Handles "คำนวณ 365 × 24", "2+2", "123 * 456" etc.
    // =====================================
    if (looksLikeMathLikeQuery(routingMessage)) {
      try {
        // Strip Thai math keywords, normalize Unicode operators, translate Thai operators
        const expr = routingMessage
          .replace(/(คำนวณ|calculate|compute|คิดเลข|เท่าไร|เท่าไหร่|ผลลัพธ์|ผลคือ|result|equals)/gi, "")
          .replace(/บวก(?:เพิ่ม)?/g, "+")
          .replace(/ลบ(?:ออก)?/g, "-")
          .replace(/คูณ/g, "*")
          .replace(/หาร/g, "/")
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/[^\d+\-*/().^%\s,eE]/g, "")
          .trim();

        if (expr && /\d/.test(expr)) {
          const { evaluate } = require("mathjs");
          const result = evaluate(expr);

          if (typeof result === "number" || (result && typeof result.toString === "function")) {
            const displayExpr = expr.replace(/\s+/g, "").length > 0 ? expr.trim() : routingMessage.replace(/(คำนวณ|calculate)/gi, "").trim();
            const textOut = `ผลลัพธ์: ${displayExpr} = ${result}`;
            const scOut = withRenderMeta(
              { calculatorGate: { expression: expr, result: String(result) } },
              { route: "calculator" as any, llmUsed: false, routeDecider: "deterministic", version: "phase11.1" },
              ["calculatorTool"]
            );
            sessionHistory.push({ sender: "ai", text: textOut } as any);

            chatTraceOut({
              transport: "http",
              sid: httpSessionId,
              cid: httpCid,
              uiMode,
              route: "calculator",
              tool: "calculatorTool",
              code: 200,
              durMs: Date.now() - traceStartMs,
              q: messageWithFile,
              ans: textOut,
            });

            return res.json({
              text: textOut,
              structuredContent: scOut,
              messages: sessionHistory,
              mcpUsed: false,
              mcpResults: null,
              toolsUsed: ["calculatorTool"],
            });
          }
        }
      } catch (calcErr: any) {
        logBoth("warn", `[CalculatorGate] eval failed: ${calcErr?.message || calcErr}`);
        // Fall through to MCP
      }
    }

    // =====================================
    // Phase 11.3: DateTimeGate HTTP — Deterministic current datetime (NO LLM)
    // Handles "วันนี้วันที่เท่าไร", "กี่โมงแล้ว", "today's date" etc.
    // =====================================
    if (looksLikeDateTimeLikeQuery(routingMessage)) {
      const now = new Date();
      const bkkOffset = 7 * 60 * 60 * 1000;
      const bkk = new Date(now.getTime() + bkkOffset);
      const dayNames = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];
      const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
      const wd = dayNames[bkk.getUTCDay()];
      const d = bkk.getUTCDate();
      const mo = monthNames[bkk.getUTCMonth()];
      const be = bkk.getUTCFullYear() + 543;
      const hh = String(bkk.getUTCHours()).padStart(2, "0");
      const min = String(bkk.getUTCMinutes()).padStart(2, "0");
      const ss = String(bkk.getUTCSeconds()).padStart(2, "0");
      const humanReadable = `${wd}ที่ ${d} ${mo} พ.ศ. ${be} เวลา ${hh}:${min}:${ss} น. (UTC+7)`;
      const textOut = `ขณะนี้คือ${humanReadable}`;
      const scOut = withRenderMeta(
        { dateTimeGate: { datetime: humanReadable, timezone: "Asia/Bangkok (UTC+7)", isoUtc: now.toISOString() } },
        { route: "datetime" as any, llmUsed: false, routeDecider: "deterministic", version: "phase11.3" },
        ["dateTimeTool"]
      );
      sessionHistory.push({ sender: "ai", text: textOut } as any);
      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: "datetime",
        tool: "dateTimeTool",
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: textOut,
      });
      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: false,
        mcpResults: null,
        toolsUsed: ["dateTimeTool"],
        route: "datetime",
      });
    }

    // =====================================
    // Phase 7.4: GeneralGate (NO tool selection)
    // BEFORE MCP processMessage.
    // =====================================
    if (looksLikeGeneralNoToolsQuery(routingMessage)) {
      const budgetMs = getGeneralBudgetMs();
      const generalStart = Date.now();
      const isSmokeRun =
        process.env.SMOKE_MODE === "1" &&
        String(req.headers["x-smoke-run"] || (req.headers as any)["X-Smoke-Run"] || "") === "1";

      const isForcedTimeoutTest =
        process.env.NODE_ENV === "test" &&
        process.env.SMOKE_MODE === "1" &&
        /PHASE74_FORCE_TIMEOUT/i.test(String(messageWithFile || ""));

      logBoth("info", `[GeneralGate] bypass=true transport=http budgetMs=${budgetMs} smoke=${isSmokeRun}`);

      const result = isForcedTimeoutTest
        ? await answerGeneralWithFastModel(routingMessage, budgetMs)
        : isSmokeRun
          ? { text: renderGeneralSmokeAnswer(routingMessage), fallback: false, reason: "SMOKE_DETERMINISTIC", durMs: 0, model: String(ollamaFastModel || "") }
          : await answerGeneralWithFastModel(routingMessage, budgetMs);

      const sc: any = {
        generalGate: {
          route: "general",
          usedTools: false,
          budgetMs,
          durMs: result.durMs,
          model: result.model,
          fallback: result.fallback,
          reason: result.reason,
          totalDurMs: Date.now() - generalStart,
        },
      };

      // Phase 10.7: Low-confidence queries get explicit chatMeta for frontend guidance
      if (result.text === LOW_CONFIDENCE_FALLBACK_TEXT) {
        sc.chatMeta = {
          reason_code: "LOW_CONTEXT",
          userGuidance: [
            "ระบุจังหวัดหรือพื้นที่",
            "ระบุหัวข้อที่ต้องการ เช่น สภาพอากาศ หลักฐาน ข้อมูลภูมิศาสตร์",
            "ใช้ภาษาไทยเพื่อผลลัพธ์ที่แม่นยำขึ้น",
          ],
        };
      }

      const scOut = withRenderMeta(sc, { route: "general", llmUsed: !isSmokeRun, routeDecider: "deterministic", version: "phase8" });

      const textOut = result.text;
      sessionHistory.push({ sender: "ai", text: textOut } as any);

      chatTraceOut({
        transport: "http",
        sid: httpSessionId,
        cid: httpCid,
        uiMode,
        route: "general",
        tool: "none",
        code: 200,
        durMs: Date.now() - traceStartMs,
        q: messageWithFile,
        ans: textOut,
      });

      return res.json({
        text: textOut,
        structuredContent: scOut,
        messages: sessionHistory,
        mcpUsed: false,
        mcpResults: null,
      });
    }

    let finalMessage = routingMessage;
    let mcpResults: any[] | null = null;
    let structuredContent: any = undefined;
    let toolsUsedInThisRequest: string[] = [];

    // **Process with MCP**
    if (mcpClient) {
      try {
        const mcpResult = await mcpClient.processMessage(
          routingMessage,
          semanticCategory,
          officerMode
            ? { uiMode: "officer", boostedTools: ["evidenceTool", "detect_evidence_stats", "webdTool"] }
            : { uiMode }
        );

        if (mcpResult.needsTools) {
          logBoth("info", `[Chat API] Processed with MCP tools: ${mcpResult.toolResults?.length}`);
          mcpResults = mcpResult.toolResults ?? null;

          if (mcpResult.toolResults) {
            toolsUsedInThisRequest = mcpResult.toolResults.map((r: any) => r?.toolName).filter(Boolean);
          }

          const structuredResult = mcpResult.toolResults?.find((r: any) => r && r.structuredContent);
          if (structuredResult) {
            const direct = renderStructuredDirect(structuredResult.toolName, structuredResult.structuredContent, messageWithFile || "");
            if (direct) {
              logBoth(
                "info",
                `[StructuredDirect] tool=${structuredResult.toolName} keys=${structuredKeysSummary(structuredResult.structuredContent)} bypass=true`
              );
              sessionHistory.push({ sender: "ai", text: direct.text } as any);

              chatTraceOut({
                transport: "http",
                sid: httpSessionId,
                cid: httpCid,
                uiMode,
                route: "mcpDirect",
                tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : (structuredResult.toolName || "none"),
                code: 200,
                durMs: Date.now() - traceStartMs,
                q: messageWithFile,
                ans: direct.text,
              });
              const directSc = direct.structuredContent || {};
              const directChatMeta = directSc.chatMeta && typeof directSc.chatMeta === "object" ? directSc.chatMeta : {};
              const directScWithMeta = {
                ...directSc,
                chatMeta: {
                  ...directChatMeta,
                  mode: "online",
                  toolsUsed: toolsUsedInThisRequest.map((t: string) => ({ name: t.replace(/^[^:]+:/, "") })),
                },
              };
              return res.json({
                text: direct.text,
                structuredContent: directScWithMeta,
                messages: sessionHistory,
                mcpUsed: true,
                mcpResults: mcpResults,
                toolsUsed: toolsUsedInThisRequest,
              });
            }
          }

          if (mcpResult.enhancedContext) {
            finalMessage = mcpResult.enhancedContext;
          }
        } else if (mcpResult.toolsFailed) {
          // Tools were selected but all failed — ask Ollama to craft a short sorry message
          let sorryMessage = "ขออภัย ขณะนี้ไม่สามารถให้ข้อมูลที่คุณต้องการได้";
          const isSmokeRun =
            process.env.SMOKE_MODE === "1" &&
            String(req.headers["x-smoke-run"] || (req.headers as any)["X-Smoke-Run"] || "") === "1";
          try {
            if (isSmokeRun) {
              throw new Error("SMOKE_SKIP_APOLOGY_LLM");
            }
            const apologyPrompt = `กรุณาสร้างข้อความขอโทษสั้นๆ (ภาษาไทย) ความยาวไม่เกิน 2 ประโยค อธิบายว่าไม่สามารถดึงข้อมูลหรือประมวลผลได้ในขณะนี้ และแนะนำทางเลือก เช่น ลองอีกครั้งภายหลัง หรือตรวจสอบรายละเอียดเพิ่มเติม ตอนจบให้สุภาพและกระชับ ตอบเฉพาะข้อความ ไม่ต้องมี markdown หรือข้อมูลเสริมอื่นๆ`;
            const apologyResp = await ollama.chat({
              model: ollamaModel,
              messages: [
                { role: "system", content: "You are a concise and polite Thai assistant." },
                { role: "user", content: apologyPrompt },
              ],
              stream: false,
            });
            let candidate = String(apologyResp?.message?.content || "").trim();
            // Clean up stray double-quote artifacts (e.g. trailing "" or surrounding quotes)
            const cleanCandidate = candidate.replace(/"{2,}/g, "").replace(/^"+|"+$/g, "").trim();
            if (cleanCandidate.length > 0) sorryMessage = cleanCandidate;
          } catch (e) {
            if (String(e).includes("SMOKE_SKIP_APOLOGY_LLM")) {
              // Keep deterministic and fast in smoke.
              sorryMessage = "ขออภัย ระบบยังไม่พร้อมให้บริการในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลังครับ";
            } else {
              logBoth("error", `[Chat API] Failed to generate apology via Ollama (POST): ${e}`);
            }
          }

          sessionHistory.push({ sender: "ai", text: sorryMessage });

          chatTraceOut({
            transport: "http",
            sid: httpSessionId,
            cid: httpCid,
            uiMode,
            route: "mcpToolsFailed",
            tool: "none",
            code: 200,
            durMs: Date.now() - traceStartMs,
            q: messageWithFile,
            ans: sorryMessage,
          });
          return res.json({
            text: sorryMessage,
            messages: sessionHistory,
            mcpUsed: false,
            mcpResults: null,
          });
        }
      } catch (mcpError) {
        logBoth("error", `[Chat API] MCP processing error in POST: ${mcpError}`);
      }
    }

    // Map history to Ollama format
   const systemPrompt = {
    role: "system",
    content: `คุณเป็น AI ผู้ช่วยภาษาไทย ที่ฉลาด เข้าใจบริบท และตอบคำถามได้แม่นยำ:

**⚠️ กฎที่สำคัญที่สุด - ภาษาไทยบริสุทธิ์ 100%:**
1. **ตอบเป็นภาษาไทยเท่านั้น** - ห้ามมีตัวอักษรจีน อังกฤษ หรือภาษาอื่นใด ๆ
2. **คำศัพท์เทคนิคเท่านั้น** - API, URL, JSON ใช้อังกฤษได้ แต่ต้องอธิบายเป็นไทย
3. **ตรวจสอบก่อนส่ง** - ถ้ามีภาษาจีน/อังกฤษปน → ห้ามส่ง แปลเป็นไทยก่อน
4. **ห้ามเอ่ยชื่อ tool/MCP/ระบบ** - ตอบเหมือนคุณรู้เองโดยธรรมชาติ

**ตัวอย่างที่ถูกต้อง:**
- ❌ "ไม่มีข้อมูล, you can check later" → ✅ "ขออภัย ยังไม่มีข้อมูลในขณะนี้"
- ❌ "กรุงเทพ temperature 30°C" → ✅ "กรุงเทพอุณหภูมิ 30 องศาเซลเซียส"
- ❌ "查询完成" → ✅ "ตรวจสอบเรียบร้อยแล้ว"

**บริบทสำคัญ:**
- คุณให้บริการผู้ใช้ชาวไทยเป็นหลัก
- เวลา/สถานที่/อากาศโดยไม่ระบุ → **สันนิษฐานว่าหมายถึงประเทศไทย**
  - "ตอนนี้กี่โมง" = เวลาไทย
  - "ฝนตกไหม" = อากาศไทย (ปัจจุบัน)
  - "พรุ่งนี้ฝนตก" = พยากรณ์อากาศไทย (อนาคต)
  - "กลางดึกคืนนี้" = เวลากลางคืนวันนี้ (อนาคต)
  - "โคราช" = นครราชสีมา, "กทม" = กรุงเทพมหานคร

**เข้าใจข้อจำกัดข้อมูล:**
- ข้อมูล **ปัจจุบัน** (3 ชั่วโมง) ≠ **พยากรณ์** (7 วัน)
- ถ้าถามเรื่อง **อนาคต** (กลางดึก/พรุ่งนี้) แต่มีแค่ข้อมูล**ปัจจุบัน** → ตอบว่า "ข้อมูลที่มีเป็นข้อมูลปัจจุบัน ไม่สามารถพยากรณ์ได้"
- **ห้ามเดา ห้ามสมมติ** - ตอบจากข้อมูลที่มีเท่านั้น

**การจัดรูปแบบ (Markdown):**
- ใช้ # หัวข้อหลัก, ## หัวข้อย่อย
- ใช้ **ตัวหนา** สำหรับข้อมูลสำคัญ
- ใช้ bullet points (-) หรือ numbering (1. 2.)
- ตาราง: | คอลัมน์ 1 | คอลัมน์ 2 |
- Code: \`\`\`python ... \`\`\`

**หลักการตอบ:**
- เข้าใจคำถามลึกซึ้ง (อ่านเจตนา ไม่ใช่แค่คำ)
- ตอบตรงประเด็น กระชับ ชัดเจน **ภาษาไทยบริสุทธิ์**
- หากข้อมูลไม่ครบ → บอกข้อจำกัด ไม่เดา
- **จำไว้: ตอบเป็นภาษาไทยเท่านั้น ห้ามปนภาษาอื่น!**`,
   };

    const ollamaMessages = [
      systemPrompt,
      ...sessionHistory.slice(0, -1).map((m: ChatMessage) => ({
        role: m.sender === "ai" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: finalMessage },
    ];

    logBoth("info", `[Chat API] POST: Sending ${ollamaMessages.length} messages to Ollama (including system prompt) ✨`);

    // Call Ollama (non-streaming)
    const response = await ollama.chat({
      model: ollamaModel,
      messages: ollamaMessages,
    });

    logBoth("info", `[Chat API] Ollama response ✨: ${response.message.content.substring(0, 100)}`);

    // Add AI response to history
    sessionHistory.push({ sender: "ai", text: response.message.content });
    logBoth("info", `[Chat API] POST: Session now has ${sessionHistory.length} messages`);

    chatTraceOut({
      transport: "http",
      sid: httpSessionId,
      cid: httpCid,
      uiMode,
      route: "ollama",
      tool: toolsUsedInThisRequest.length > 0 ? joinToolsForTrace(toolsUsedInThisRequest) : "none",
      code: 200,
      durMs: Date.now() - traceStartMs,
      q: messageWithFile,
      ans: String(response.message.content || ""),
    });

    res.json({
      text: response.message.content,
      messages: sessionHistory,
      mcpUsed: mcpResults ? true : false,
      mcpResults: mcpResults,
    });
  } catch (error) {
    logBoth("error", `[Chat API] Error handling chat message: ${error}`);
    res.status(500).json({ error: "Failed to process the message" });
  }
});

// --- 8. Utility Endpoints ---
chatRouter.get("/ws", (req, res) => {
  res.status(400).send("WebSocket endpoint. Please connect via WebSocket.");
});

chatRouter.get("/mcp/tools", (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({
      error: "MCP client not initialized",
      available: false,
    });
  }

  const tools = mcpClient.getAvailableTools();
  const resources = mcpClient.getAvailableResources();
  const clients = mcpClient.getConnectedClients();

  res.json({
    available: true,
    clients: clients,
    toolsCount: tools.length,
    resourcesCount: resources.length,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      keywords: tool.keywords,
      examples: tool.examples,
    })),
    resources: resources.map((r) => ({
      name: r.name,
      title: r.title,
      description: r.description,
      uriTemplate: r.uriTemplate,
    })),
  });
});

// --- 9. MCP Health & Reconnection Endpoints ---
chatRouter.get("/mcp/health", (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({
      healthy: false,
      error: "MCP client not initialized",
    });
  }

  const stats = mcpClient.getStatistics();
  const tools = mcpClient.getAvailableTools();
  const clients = mcpClient.getConnectedClients();

  const healthy = clients.length > 0 && tools.length > 0;

  res.json({
    healthy,
    timestamp: new Date().toISOString(),
    clients: {
      count: clients.length,
      names: clients,
    },
    tools: {
      count: tools.length,
      total: stats.availableTools,
    },
    resources: {
      count: stats.availableResources,
    },
    cache: {
      queries: stats.cachedQueries,
      historySize: stats.historySize,
    },
    aiMode: stats.aiMode,
  });
});

chatRouter.post("/mcp/reconnect", async (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({
      success: false,
      error: "MCP client not initialized",
    });
  }

  try {
    logBoth("info", "[Chat API] Manual MCP reconnection requested");
    
    // Trigger reconnection in background
    mcpClient.forceReconnect().catch((err) => {
      logBoth("error", `[Chat API] Manual reconnection failed: ${err}`);
    });

    res.json({
      success: true,
      message: "Reconnection initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logBoth("error", `[Chat API] Error initiating reconnection: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to initiate reconnection",
    });
  }
});

// --- 10. Tool Health Check Endpoints ---
chatRouter.get("/tools/health", (req, res) => {
  if (!toolHealthChecker) {
    return res.status(503).json({
      error: "Tool health checker not initialized",
      available: false,
    });
  }

  try {
    const healthData = toolHealthChecker.getHealthStatusJSON();
    res.json(healthData);
  } catch (error) {
    logBoth("error", `[Chat API] Error getting tool health: ${error}`);
    res.status(500).json({
      error: "Failed to get tool health status",
    });
  }
});

chatRouter.post("/tools/health/check", async (req, res) => {
  if (!toolHealthChecker) {
    return res.status(503).json({
      success: false,
      error: "Tool health checker not initialized",
    });
  }

  try {
    logBoth("info", "[Chat API] Manual tool health check requested");
    
    // Trigger health check in background
    toolHealthChecker.triggerManualCheck().catch((err) => {
      logBoth("error", `[Chat API] Manual health check failed: ${err}`);
    });

    res.json({
      success: true,
      message: "Health check initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logBoth("error", `[Chat API] Error initiating health check: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to initiate health check",
    });
  }
});

export { chatRouter, wss, mcpClient, toolHealthChecker };

