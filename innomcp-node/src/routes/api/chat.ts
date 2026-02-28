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

dotenv.config();

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
    
    remoteOllama = new Ollama({ host: remoteOllamaHostUrl });
    remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;  // gemma3:4b
    remoteFastModel = process.env.FAST_OLLAMA_MODEL || fastModel;  // qwen2.5:0.5b
    logBoth("info", `🎯 Remote AI: ${remoteOllamaHostUrl}`);
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
  const structuredContent = { weatherPipeline: weatherPayload };

  const renderUpstreamWeatherErr = (codeRaw: string, messageRaw?: string): { text: string; structuredContent: any } => {
    const code = String(codeRaw || "UPSTREAM_ERROR").toUpperCase();
    const errToken = `ERR:WX_${code}`;
    const base = String(messageRaw || "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้").trim();
    const msg = base.includes("ERR:") ? base : `${base} (${errToken})`;
    return { text: msg, structuredContent: { weatherPipeline: { ok: false, code, message: msg } } };
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
    return { text: `จังหวัดที่ฝนตกมากสุดในไทย (${label}) Top ${topN} (ถ้าต้องการตาราง บอกได้ครับ)`, structuredContent };
  }

  // Phase W1: strict deterministic contract renderer
  // Must include: จังหวัด, โอกาสฝน (%), อุณหภูมิ, ลม, เวลาอัปเดตข้อมูล (Observation/LastBuildDate)
  return renderWeatherContractAnswer(userText || "", weatherResults as any);
}

function wantsDeepExplain(text: string): boolean {
  return /อธิบายเชิงลึก|ละเอียด|สรุปเป็นภาษาคน|เหตุผล|วิเคราะห์/i.test(text || "");
}

function looksLikeDeterministicWeatherQuery(text: string): boolean {
  const t = String(text || "");

  // Core weather words
  // NOTE: do NOT match "ลม" as a bare substring (e.g. "ถนนสีลม" should not be treated as weather)
  const hasWind = /(?:^|\s)ลม(?:\s|$)|ลมแรง|ความเร็วลม|ทิศทางลม|wind\b/i.test(t);
  const hasWeatherCore = /ฝน|อากาศ|พยากรณ์|อุณหภูมิ|ความชื้น|พายุ|weather|forecast|temperature|humidity|tmd|อุตุ|nwp/i.test(t) || hasWind;

  // Weather-specific patterns that often omit the word "อากาศ"
  const hasWeatherSpecific = /รายชั่วโมง|รายวัน|ตารางสถานี|สถานีอากาศ|รายสถานี|พยากรณ์\s*7\s*วัน|7\s*วัน|สัปดาห์/i.test(t);

  // We only gate when it's clearly weather-related
  return hasWeatherCore || hasWeatherSpecific;
}

function hasExplicitWeatherIntentKeywords(text: string): boolean {
  return /(อากาศ|พยากรณ์|ฝน|อุณหภูมิ|ลม|เรดาร์|weather|forecast|temperature|rain|storm|wind)/i.test(String(text || ""));
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
  const raw = Number(process.env.GENERAL_LLM_BUDGET_MS || "5000");
  if (!Number.isFinite(raw)) return 5000;
  return Math.min(Math.max(Math.floor(raw), 250), 30000);
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

function looksLikeDateTimeLikeQuery(text: string): boolean {
  // Keep narrow: avoid hijacking weather queries containing "วันนี้".
  const t = String(text || "");
  const looksLikeWeather = /(อากาศ|ฝน|พยากรณ์|weather|forecast|อุณหภูมิ|ความชื้น)/i.test(t);
  if (looksLikeWeather) return false;
  // IMPORTANT: use full word boundaries for EN tokens so words like "downtime" won't match "time".
  return /(กี่โมง|ตอนนี้.*กี่โมง|เวลา(นี้|เท่าไหร่|อะไร|ไหน)|วันที่|วันอะไร|เดือนอะไร|ปีอะไร|\bnow\b|\btime\b|\bdate\b|\btoday\b)/i.test(t) && t.length <= 80;
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
  if (looksLikeDeterministicGeoQuery(t) || looksLikeGeoLikeQuery(t)) return false;
  if (looksLikeEvidenceKeywordQuery(t) || !!inferOfficerEvidenceAction(t)) return false;
  if (looksLikeDateTimeLikeQuery(t)) return false;
  if (looksLikeMathLikeQuery(t)) return false;
  if (/(http:\/\/|https:\/\/|www\.)/i.test(t)) return false;

  // Infra/system checks should go to tools (e.g., system_status_tool), not GeneralGate.
  if (looksLikeInfraOpsQuery(t)) return false;

  // Positive signals for general chat/knowledge/explanation.
  const positive = /(คืออะไร|อธิบาย|สรุป|แตกต่าง|เปรียบเทียบ|ทำไม|อย่างไร|แนวทาง|ขั้นตอน|วิธี|ตัวอย่าง|แนะนำ|ควรทำยังไง|ควรทำอย่างไร)/i.test(t);
  if (positive) return true;

  // Short, question-like messages are usually safe.
  const looksLikeQuestion = /\?\s*$/.test(t) || /ไหม\s*$|หรือ\s*$|ได้ไหม\s*$|ทำยังไง\s*$|อย่างไร\s*$/.test(t);
  if (looksLikeQuestion && t.length <= 160) return true;

  return t.length <= 80;
}

function renderGeneralFallbackMessage(): string {
  return "ขออภัย ตอนนี้ตอบได้ไม่ทันเวลา ลองระบุคำถามให้แคบลงอีกนิด (เช่น เป้าหมาย/บริบท/ตัวอย่าง) แล้วผมจะสรุปให้สั้นๆ ได้ครับ";
}

function renderGeneralSmokeAnswer(userText: string): string {
  const t = String(userText || "").trim();
  if (/RAG/i.test(t)) {
    return "RAG คือแนวทางที่ให้ระบบไปค้น/ดึงข้อมูลที่เกี่ยวข้องมาก่อน แล้วค่อยให้โมเดลสรุปตอบจากข้อมูลนั้น เพื่อลดการเดาและตอบให้ตรงบริบทมากขึ้นครับ";
  }
  if (/AI|ปัญญาประดิษฐ์/i.test(t) && /คืออะไร|หมายถึง/i.test(t)) {
    return "AI คือเทคโนโลยีที่ทำให้คอมพิวเตอร์ทำงานที่ปกติใช้การคิดของมนุษย์ได้ เช่น จำแนกข้อมูล คาดการณ์ หรือช่วยสรุปข้อความ โดยต้องระบุโจทย์และข้อมูลให้ชัดเพื่อความแม่นยำครับ";
  }
  if (/KPI|OKR/i.test(t)) {
    return "KPI คือ “ตัวชี้วัดผลลัพธ์” ส่วน OKR คือ “เป้าหมาย + ตัวชี้วัดความสำเร็จ” ถ้าบอกประเภทงาน/ทีม ผมช่วยยกตัวอย่างให้ตรงบริบทได้ครับ";
  }
  return "ได้ครับ คำถามนี้เป็นคำถามทั่วไป ถ้าคุณระบุบริบทเพิ่มอีกนิด (เช่น ต้องการคำตอบแบบสั้น/ยาว, สำหรับงานอะไร) ผมจะตอบให้ตรงจุดมากขึ้นครับ";
}

async function answerGeneralWithFastModel(userText: string, budgetMs: number): Promise<{ text: string; fallback: boolean; reason: string; durMs: number; model: string }> {
  const start = Date.now();
  const model = String(ollamaFastModel || "");

  const isForcedTimeoutTest =
    process.env.NODE_ENV === "test" &&
    process.env.SMOKE_MODE === "1" &&
    /PHASE74_FORCE_TIMEOUT/i.test(String(userText || ""));
  if (isForcedTimeoutTest) {
    const text = renderGeneralFallbackMessage();
    return { text, fallback: true, reason: "FORCED_TIMEOUT_TEST", durMs: Date.now() - start, model };
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

    const text = String((resp as any)?.message?.content || "").trim();
    if (!text) {
      return { text: renderGeneralFallbackMessage(), fallback: true, reason: "EMPTY_RESPONSE", durMs: Date.now() - start, model };
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

function withRenderMeta(structuredContent: any, meta: { route: "weather" | "geo" | "evidence" | "general"; llmUsed: boolean; routeDecider: "deterministic"; version: "phase8" }): any {
  const base = structuredContent && typeof structuredContent === "object" && !Array.isArray(structuredContent) ? structuredContent : {};
  return { ...(base as any), __render: meta };
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
      
      remoteOllama = new Ollama({ host: remoteOllamaHostUrl });
      remoteModel = process.env.REMOTE_OLLAMA_MODEL || localModel;
      remoteFastModel = process.env.FAST_OLLAMA_MODEL || fastModel;
      logBoth('info', `[Chat AI] 🌐 Initializing Remote Ollama: ${remoteOllamaHostUrl}`);
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

    if (!origin || allowedOrigins.includes(origin)) {
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
  // redact "Authorization: Bearer <blob>" style tokens
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
    | "mcpDirect"
    | "weatherDirect"
    | "mcpToolsFailed"
    | "ollama"
    | "ollamaError";
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
        const evidenceAction = inferOfficerEvidenceAction(messageWithFile);

        // Session id helper used across branches (WeatherGate returns early)
        const currentSessionId = (ws as any).sessionId;

        const cid = (ws as any).correlationId as string | undefined;

        chatTraceIn({ transport: "ws", sid: currentSessionId, cid, uiMode, msg: messageWithFile });

        // =====================================
        // Phase 7.2.5: Deterministic Evidence Fastpath (NO LLM classify/tool-select)
        // Route machine/evidence online/offline patterns directly to EvidenceTool with forced args.
        // Applies even when uiMode is not officer.
        // =====================================
        if (mcpClient && evidenceAction) {
          logBoth("info", `[EvidenceFastPath] deterministicEvidence=true transport=ws action=${evidenceAction} uiMode=${uiMode}`);

          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

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

          const scOut = withRenderMeta(sc, { route: "evidence", llmUsed: false, routeDecider: "deterministic", version: "phase8" });

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

        // =====================================
        // Phase 7.1: Deterministic Weather Router (NO LLM tool planning)
        // Gate BEFORE any God-Tier Router / semantic / LLM-based tool selection.
        // =====================================
        const geoLike = looksLikeDeterministicGeoQuery(messageWithFile);
        const weatherLike = looksLikeDeterministicWeatherQuery(messageWithFile);
        const allowWeatherGate = !officerMode
          ? weatherLike && (!geoLike || hasExplicitWeatherIntentKeywords(messageWithFile))
          : weatherLike && hasExplicitWeatherIntentKeywords(messageWithFile);
        if (mcpClient && allowWeatherGate) {
          const deep = wantsDeepExplain(messageWithFile);
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
            toolResult = await mcpClient.runDeterministicWeatherPipeline(messageWithFile, { signal: wxAbort.signal });
          } finally {
            try { ws.removeListener("close", onWsClose); } catch {}
          }
          const sc = toolResult.structuredContent;
          const payload = sc?.weatherPipeline ?? sc;

          const direct = renderStructuredDirect("weatherPipeline", sc, messageWithFile) || renderWeatherDirectAnswer(messageWithFile, payload);
          const textOut = direct.text;
          const scOut = withRenderMeta(direct.structuredContent ?? sc, { route: "weather", llmUsed: false, routeDecider: "deterministic", version: "phase8" });

          // Send response + history update
          const aiMessage: any = { sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["weatherPipeline"] };
          sessionHistory.push(aiMessage);
          sessionManager.addMessage(currentSessionId, "assistant", textOut, ["weatherPipeline"]);
          sessionManager.completeResponse(currentSessionId);

          sendSafe(ws, { type: "message", sender: "ai", text: textOut, structuredContent: scOut, toolsUsed: ["weatherPipeline"] });
          sendSafe(ws, { type: "history-update", messages: sessionHistory, toolsUsed: ["weatherPipeline"] });
          sendDoneOnce();

          chatTraceOut({
            transport: "ws",
            sid: currentSessionId,
            cid,
            uiMode,
            route: "weatherGate",
            tool: "weatherPipeline",
            code: 200,
            durMs: Date.now() - traceStartMs,
            q: messageWithFile,
            ans: textOut,
          });
          return;
        }

        // =====================================
        // Phase 1 GEO Round B: Deterministic GEO Gate (NO LLM tool planning)
        // Minimal Happy Path: address_normalize / geo_lookup / geo_validate
        // =====================================
        if (mcpClient && geoLike) {
          const geoToolName = "local-tools:thai_geo_tool";
          const action = inferGeoAction(messageWithFile);
          const toolArgs: any =
            action === "geo_lookup"
              ? { action, query: extractGeoLookupQuery(messageWithFile), topN: 5 }
              : { action, address: messageWithFile };

          logBoth("info", `[GeoGate] bypass=true transport=ws action=${action} query=${String(toolArgs.query || "").slice(0, 60)}`);

          // Add user message to history now (this branch returns early)
          sessionHistory.push({ sender: "user", text: messageWithFile });
          sessionManager.addMessage(currentSessionId, "user", messageWithFile);
          sessionManager.startResponse(currentSessionId);

          const toolResults = await mcpClient.executeTools([geoToolName], messageWithFile, {
            [geoToolName]: toolArgs,
          });

          const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
          const sc = first?.structuredContent ?? first?.result;

          const rendered = renderThaiGeoAnswerShort(sc);
          const textOut = rendered.text;
          const scOut = withRenderMeta(sc, { route: "geo", llmUsed: false, routeDecider: "deterministic", version: "phase8" });

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
        // Phase 7.4: GeneralGate (NO tool selection)
        // BEFORE God-Tier Router / MCP processMessage.
        // =====================================
        if (looksLikeGeneralNoToolsQuery(messageWithFile)) {
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
        try {
          const godTierRouter = getGodTierRouter();
          const startTime = Date.now();

          // Get last 2 messages from history for context
          const conversationHistory = sessionHistory.slice(-2).map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date()
          }));

          const routingResult = await godTierRouter.route(messageWithFile, conversationHistory);
          semanticCategory = routingResult.category;
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
          logBoth('warn', `[God-Tier Router] ⚠️  Routing failed: ${err}, falling back to MCP default`);
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
                const note = d.note ? `\n\nหมายเหตุ: ${d.note}` : "";
                const table = d.tableMarkdown ? `\n\n${d.tableMarkdown}` : "";
                finalText = `จังหวัดที่ฝนตกมากสุดในไทย (${label}) Top ${topN}${table}${note}`;
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
    const { message, messages } = req.body;
    const uiModeRaw = String((req.body as any)?.uiMode || "").trim();
    const uiMode = uiModeRaw || "auto";
    const officerMode = uiMode === "officer";
    const httpCid = String((req.headers["x-correlation-id"] as string) || (req.headers["x-correlationid"] as string) || "");
    if (officerMode) {
      logBoth("info", `[OfficerMode] uiMode=officer boostedTools=evidenceTool,detect_evidence_stats,webdTool_*`);
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    logBoth("info", `[Chat API] Received POST chat message (len=${String(message || "").length})`);

    // Get full message history from client or initialize empty
    let sessionHistory: ChatMessage[] = messages || [];

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

    const traceStartMs = Date.now();
    const evidenceAction = inferOfficerEvidenceAction(messageWithFile);

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

    // =====================================
    // Phase 7.2.5: Deterministic Evidence Fastpath (NO LLM classify/tool-select)
    // =====================================
    if (mcpClient && evidenceAction) {
      logBoth("info", `[EvidenceFastPath] deterministicEvidence=true transport=http action=${evidenceAction} uiMode=${uiMode}`);

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
    // Phase 7.1: Deterministic Weather Router (NO LLM tool planning)
    // Gate BEFORE any MCP tool selection / LLM classification.
    // =====================================
    const geoLike = looksLikeDeterministicGeoQuery(messageWithFile);
    const weatherLike = looksLikeDeterministicWeatherQuery(messageWithFile);
    const allowWeatherGate = !officerMode
      ? weatherLike && (!geoLike || hasExplicitWeatherIntentKeywords(messageWithFile))
      : weatherLike && hasExplicitWeatherIntentKeywords(messageWithFile);
    if (mcpClient && allowWeatherGate) {
      const mcp = mcpClient;
      const deep = wantsDeepExplain(messageWithFile);
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
          toolResults = [await mcp.runDeterministicWeatherPipeline(messageWithFile, { signal: wxAbort.signal })];
        }
      } finally {
        try { res.removeListener("close", onHttpClose); } catch {}
      }

      const primaryToolResult = toolResults[0];
      const sc = primaryToolResult.structuredContent;
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

      const scOut = withRenderMeta(direct.structuredContent ?? sc, { route: "weather", llmUsed: false, routeDecider: "deterministic", version: "phase8" });

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
      });
    }

    // =====================================
    // Phase 1 GEO Round B: Deterministic GEO Gate (NO LLM tool planning)
    // Minimal Happy Path: address_normalize / geo_lookup / geo_validate
    // =====================================
    if (mcpClient && geoLike) {
      const geoToolName = "local-tools:thai_geo_tool";
      const action = inferGeoAction(messageWithFile);
      const toolArgs: any =
        action === "geo_lookup"
          ? { action, query: extractGeoLookupQuery(messageWithFile), topN: 5 }
          : { action, address: messageWithFile };

      logBoth("info", `[GeoGate] bypass=true transport=http action=${action} query=${String(toolArgs.query || "").slice(0, 60)}`);

      const toolResults = await mcpClient.executeTools([geoToolName], messageWithFile, {
        [geoToolName]: toolArgs,
      });

      const first = Array.isArray(toolResults) ? toolResults[0] : undefined;
      const sc = first?.structuredContent ?? first?.result;
      const rendered = renderThaiGeoAnswerShort(sc);
      const textOut = rendered.text;
      const scOut = withRenderMeta(sc, { route: "geo", llmUsed: false, routeDecider: "deterministic", version: "phase8" });

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
    // Phase 7.4: GeneralGate (NO tool selection)
    // BEFORE MCP processMessage.
    // =====================================
    if (looksLikeGeneralNoToolsQuery(messageWithFile)) {
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
        ? await answerGeneralWithFastModel(messageWithFile, budgetMs)
        : isSmokeRun
          ? { text: renderGeneralSmokeAnswer(messageWithFile), fallback: false, reason: "SMOKE_DETERMINISTIC", durMs: 0, model: String(ollamaFastModel || "") }
          : await answerGeneralWithFastModel(messageWithFile, budgetMs);

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

    let finalMessage = messageWithFile;
    let mcpResults: any[] | null = null;
    let structuredContent: any = undefined;
    let toolsUsedInThisRequest: string[] = [];

    // **Process with MCP**
    if (mcpClient) {
      try {
        const mcpResult = await mcpClient.processMessage(
          messageWithFile,
          undefined,
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
              return res.json({
                text: direct.text,
                structuredContent: direct.structuredContent,
                messages: sessionHistory,
                mcpUsed: true,
                mcpResults: mcpResults,
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

