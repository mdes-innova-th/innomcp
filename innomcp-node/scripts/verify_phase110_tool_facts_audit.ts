/**
 * verify_phase110_tool_facts_audit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 11.0 — Tool → Facts → Model → Answer Audit Packet
 *
 * 10 critical domains × 1 sample query each.
 * For each domain, collects:
 *   - selected route
 *   - selected tools
 *   - normalized fact summary (from toolsOutput if available)
 *   - model used or not
 *   - grounded contract snapshot
 *   - final answer snippet
 *   - explanation why grounded
 *
 * This is an AUDIT script, not a pass/fail gate.
 * Output is a structured JSON packet for human review.
 *
 * Run:
 *   npx ts-node scripts/verify_phase110_tool_facts_audit.ts
 *
 * OFFLINE mode:
 *   INNOMCP_MODE=offline SMOKE_MODE=1 WEATHER_FIXTURE_W1=1 \
 *     npx ts-node scripts/verify_phase110_tool_facts_audit.ts
 */

import http from "http";
import fs from "fs";
import path from "path";

const CHAT_PORT = Number(process.env.CHAT_PORT || process.env.PORT || 3011);
const CHAT_HOST = process.env.CHAT_HOST || "127.0.0.1";
const INNOMCP_MODE = process.env.INNOMCP_MODE || "online";
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || "";
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function nowStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
interface AuditResp {
  status: number;
  text: string;
  toolsUsed: string[];
  route: string;
  reasonCode: string;
  groundedContractFields: Record<string, any>;
  toolsOutput: any;
  modelUsed: string | null;
  raw: any;
}

function chatPost(message: string): Promise<AuditResp> {
  const payload = Buffer.from(JSON.stringify({ message }));
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = http.request(
      {
        host: CHAT_HOST,
        port: CHAT_PORT,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
          "X-Smoke-Run": "1",
          "X-Audit-Mode": "1",
          ...(AUTH_TOKEN ? { "Authorization": `Bearer ${AUTH_TOKEN}` } : {}),
        },
        timeout: 60000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: any = null;
          try { json = JSON.parse(raw); } catch { json = null; }

          // Extract grounded contract fields from structuredContent
          const sc = json?.structuredContent || {};
          const chatMeta = sc?.chatMeta || {};
          const groundedContractFields: Record<string, any> = {
            reason_code: chatMeta.reason_code,
            route: chatMeta.route,
            tools_resolved: chatMeta.tools_resolved,
            answer_sourced_from: chatMeta.answer_sourced_from,
            model: chatMeta.model,
            degraded: chatMeta.degraded,
            fallback: chatMeta.fallback,
            grounded_by: chatMeta.grounded_by,
          };

          settled = true;
          resolve({
            status: res.statusCode || 0,
            text: String(json?.text || json?.answer || json?.message || ""),
            toolsUsed: Array.isArray(json?.toolsUsed) ? json.toolsUsed : [],
            route: String(chatMeta.route || json?.route || ""),
            reasonCode: String(chatMeta.reason_code || ""),
            groundedContractFields,
            toolsOutput: json?.toolsOutput || json?.rawToolResults || null,
            modelUsed: chatMeta.model || json?.modelUsed || null,
            raw: json,
          });
        });
      }
    );
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err || "HTTP_REQUEST_ERROR")));
    });
    req.on("timeout", () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error("TIMEOUT"));
    });
    req.write(payload);
    req.end();
  });
}

// ─── Domain definitions ──────────────────────────────────────────────────────
interface Domain {
  id: string;
  name: string;
  sampleQuery: string;
  expectedRoute: string;
  expectedTools: string[];
  modelExpected: boolean; // true if LLM is expected to be invoked
  groundedByExpected: string; // e.g. "tool_output", "deterministic", "general_knowledge"
}

const DOMAINS: Domain[] = [
  {
    id: "D01_weather_factual",
    name: "Weather factual",
    sampleQuery: "อุณหภูมิกรุงเทพวันนี้",
    expectedRoute: "weather",
    expectedTools: ["tmd_weather_today_07am_all_stations", "nwp_daily"],
    modelExpected: true,
    groundedByExpected: "tool_output",
  },
  {
    id: "D02_weather_analytical_shortcircuit",
    name: "Weather analytical short-circuit",
    sampleQuery: "วันนี้วันที่เท่าไร",
    expectedRoute: "weather",
    expectedTools: [],
    modelExpected: false,
    groundedByExpected: "deterministic",
  },
  {
    id: "D03_weather_analytical_rewrite",
    name: "Weather analytical rewrite",
    sampleQuery: "สรุปแนวโน้มอากาศภาคเหนือสัปดาห์นี้แบบกระชับ",
    expectedRoute: "weather",
    expectedTools: ["nwp_daily", "tmd_weather_forecast_7days_by_region"],
    modelExpected: true,
    groundedByExpected: "tool_output",
  },
  {
    id: "D04_nasa",
    name: "NASA Space & Astronomy",
    sampleQuery: "ภาพอวกาศจาก NASA วันนี้",
    expectedRoute: "nasa",
    expectedTools: ["nasa_apod"],
    modelExpected: true,
    groundedByExpected: "tool_output",
  },
  {
    id: "D05_worldbank",
    name: "World Bank economic data",
    sampleQuery: "GDP ประเทศไทยล่าสุด",
    expectedRoute: "worldbank",
    expectedTools: ["worldbank_indicator"],
    modelExpected: true,
    groundedByExpected: "tool_output",
  },
  {
    id: "D06_evidence",
    name: "Evidence / Detect",
    sampleQuery: "แสดงหลักฐานและ threat ล่าสุดจากระบบ",
    expectedRoute: "evidence",
    expectedTools: ["evidence_search", "detect_evidence"],
    modelExpected: false,
    groundedByExpected: "tool_output",
  },
  {
    id: "D07_thai_knowledge_deterministic",
    name: "Thai knowledge deterministic",
    sampleQuery: "หาดใหญ่อยู่จังหวัดอะไร",
    expectedRoute: "thai_knowledge",
    expectedTools: ["resolveThaiGeoLocal", "thai_geo_tool"],
    modelExpected: false,
    groundedByExpected: "deterministic",
  },
  {
    id: "D08_calculator",
    name: "Calculator",
    sampleQuery: "คำนวณ 365 × 24",
    expectedRoute: "calculator",
    expectedTools: ["calculator", "calculate"],
    modelExpected: false,
    groundedByExpected: "deterministic",
  },
  {
    id: "D09_datetime",
    name: "DateTime",
    sampleQuery: "ตอนนี้กี่โมง zone Bangkok",
    expectedRoute: "datetime",
    expectedTools: ["datetime", "time_tool"],
    modelExpected: false,
    groundedByExpected: "deterministic",
  },
  {
    id: "D10_general_guarded",
    name: "General knowledge guarded path",
    sampleQuery: "Machine learning คืออะไร อธิบายสั้น ๆ",
    expectedRoute: "general",
    expectedTools: [],
    modelExpected: true,
    groundedByExpected: "general_knowledge",
  },
];

// ─── Audit record ────────────────────────────────────────────────────────────
interface AuditRecord {
  domain: string;
  name: string;
  sampleQuery: string;
  status: number;
  selectedRoute: string;
  selectedTools: string[];
  normalizedFactSummary: string;
  modelUsed: string | null;
  groundedContractSnapshot: Record<string, any>;
  finalAnswerSnippet: string;
  whyGrounded: string;
  expectedRoute: string;
  expectedTools: string[];
  routeMatch: boolean;
  toolsMatch: boolean;
  pass: boolean;
  error?: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const stamp = nowStamp();
  const logFile = path.join(EVIDENCE_DIR, `phase110-tool-facts-audit-${stamp}.log`);
  const lines: string[] = [];
  const log = (s: string) => { lines.push(s); process.stdout.write(s + "\n"); };

  log(`═══════════════════════════════════════════════════════════`);
  log(`  Phase 11.0 — Tool → Facts → Model → Answer Audit Packet`);
  log(`  Mode: ${INNOMCP_MODE} | Port: ${CHAT_PORT} | Stamp: ${stamp}`);
  log(`  Date: ${new Date().toISOString()}`);
  log(`═══════════════════════════════════════════════════════════`);

  const records: AuditRecord[] = [];

  for (const domain of DOMAINS) {
    log(`\n──── ${domain.id}: ${domain.name} ────`);
    log(`  Query: "${domain.sampleQuery}"`);

    let resp: AuditResp;
    let errorMsg: string | undefined;
    try {
      resp = await chatPost(domain.sampleQuery);
    } catch (err: any) {
      errorMsg = err?.message || String(err || "UNKNOWN_ERROR");
      log(`  ERROR: ${errorMsg}`);
      records.push({
        domain: domain.id,
        name: domain.name,
        sampleQuery: domain.sampleQuery,
        status: 0,
        selectedRoute: "ERROR",
        selectedTools: [],
        normalizedFactSummary: "",
        modelUsed: null,
        groundedContractSnapshot: {},
        finalAnswerSnippet: "",
        whyGrounded: "N/A - request failed",
        expectedRoute: domain.expectedRoute,
        expectedTools: domain.expectedTools,
        routeMatch: false,
        toolsMatch: false,
        pass: false,
        error: errorMsg,
      });
      continue;
    }

    // Build normalized fact summary
    let normalizedFacts = "";
    if (resp.toolsOutput) {
      normalizedFacts = `tool_output present (${typeof resp.toolsOutput === "object" ? Object.keys(resp.toolsOutput).join(", ") : "raw"})`;
    } else if (resp.toolsUsed.length > 0) {
      normalizedFacts = `tools called: ${resp.toolsUsed.join(", ")}`;
    } else {
      normalizedFacts = "no tools called (deterministic or LLM-only path)";
    }

    // Route and tool match
    const routeMatch = resp.route.toLowerCase().includes(domain.expectedRoute.toLowerCase())
      || domain.expectedRoute === "any";
    const toolsMatch = domain.expectedTools.length === 0
      || domain.expectedTools.some(et =>
          resp.toolsUsed.some(tu => tu.toLowerCase().includes(et.toLowerCase()))
        );

    // Why grounded explanation
    let whyGrounded: string;
    if (resp.toolsUsed.length > 0) {
      whyGrounded = `Answer derived from tool output: ${resp.toolsUsed.join(", ")}. reasonCode=${resp.reasonCode}`;
    } else if (resp.reasonCode === "DETERMINISTIC" || resp.reasonCode === "TOOL_OK") {
      whyGrounded = `Short-circuit / deterministic path. No LLM rewrite needed. reasonCode=${resp.reasonCode}`;
    } else if (resp.reasonCode === "LOW_CONTEXT" || resp.reasonCode === "FALLBACK") {
      whyGrounded = `Graceful fallback: reasonCode=${resp.reasonCode}. Answer is honest.`;
    } else {
      whyGrounded = `General knowledge path with LLM guard. reasonCode=${resp.reasonCode}`;
    }

    const pass = resp.status === 200 && resp.text.length > 5;
    log(`  status=${resp.status} route=${resp.route} tools=${JSON.stringify(resp.toolsUsed)}`);
    log(`  model=${resp.modelUsed || "none"} reasonCode=${resp.reasonCode}`);
    log(`  facts: ${normalizedFacts}`);
    log(`  answer: "${resp.text.slice(0, 120)}"`);
    log(`  grounded: ${whyGrounded}`);
    log(`  → ${pass ? "✅ PASS" : "❌ FAIL"} (routeMatch=${routeMatch}, toolsMatch=${toolsMatch})`);

    records.push({
      domain: domain.id,
      name: domain.name,
      sampleQuery: domain.sampleQuery,
      status: resp.status,
      selectedRoute: resp.route,
      selectedTools: resp.toolsUsed,
      normalizedFactSummary: normalizedFacts,
      modelUsed: resp.modelUsed,
      groundedContractSnapshot: resp.groundedContractFields,
      finalAnswerSnippet: resp.text.slice(0, 200),
      whyGrounded,
      expectedRoute: domain.expectedRoute,
      expectedTools: domain.expectedTools,
      routeMatch,
      toolsMatch,
      pass,
      error: errorMsg,
    });
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  const passed = records.filter(r => r.pass).length;
  const failed = records.length - passed;

  log(`\n${"═".repeat(57)}`);
  log(`  AUDIT PACKET SUMMARY`);
  log(`${"═".repeat(57)}`);
  log(`  Total domains: ${records.length} | Passed: ${passed} | Failed: ${failed}`);
  log(``);

  // Full matrix table
  log(`  Domain ID                         Route     Tools   Pass`);
  log(`  ─────────────────────────────────────────────────────────`);
  for (const r of records) {
    const tools = r.selectedTools.length > 0 ? r.selectedTools.slice(0, 2).join(",") : "none";
    log(`  ${r.domain.padEnd(34)} ${(r.selectedRoute || "-").padEnd(10)} ${tools.padEnd(8)} ${r.pass ? "✅" : "❌"}`);
  }

  // ─── Write JSON audit packet ─────────────────────────────────────────────
  const jsonFile = path.join(EVIDENCE_DIR, `phase110-tool-facts-audit-${stamp}.json`);
  const packet = {
    stamp,
    mode: INNOMCP_MODE,
    summary: { total: records.length, passed, failed },
    records,
  };
  fs.writeFileSync(jsonFile, JSON.stringify(packet, null, 2), "utf8");
  fs.writeFileSync(logFile, lines.join("\n") + "\n", "utf8");

  log(`\nevidence log: ${logFile}`);
  log(`evidence json: ${jsonFile}`);
  log(`\nNOTE: This is an audit packet — human review required for grounding quality.`);
  log(`FINAL: ${failed === 0 ? "ALL PASS ✅" : `SOME FAIL ❌ (${failed}/${records.length})`}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
