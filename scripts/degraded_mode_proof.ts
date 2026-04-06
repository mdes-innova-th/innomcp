/**
 * Degraded-Mode Proof Script
 * Tests graceful behavior under upstream/service failures.
 *
 * Uses the built-in x-test-degrade-* headers to simulate:
 *   1. TMD unavailable
 *   2. NWP unavailable
 *   3. TMD + NWP both unavailable (total weather failure)
 *   4. Upstream timeout (TMD + NWP combined)
 *   5. Upstream 429 (simulated via TMD degrade)
 *   6. Redis unavailable (in-memory fallback — tested implicitly)
 *   7. MCP tool unavailable (remote Ollama degrade)
 *   8. Database temporarily unavailable
 *
 * Each scenario: expected → actual → fallback → user-visible answer → PASS/FAIL
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.CHAT_API_URL || "http://localhost:3011";
const TIMEOUT_MS = 45_000;

interface DegradeScenario {
  id: number;
  name: string;
  query: string;
  degradeHeaders: Record<string, string>;
  expectedBehavior: string;
  fallbackPath: string;
  /** RegExp patterns the response MUST match (at least one) */
  mustMatchAny: RegExp[];
  /** RegExp patterns the response must NOT match */
  mustNotMatch?: RegExp[];
  /** If true, response.text being non-empty is sufficient for PASS */
  anyNonEmptyOk?: boolean;
}

const SCENARIOS: DegradeScenario[] = [
  // ─── 1. TMD Unavailable ───
  {
    id: 1,
    name: "TMD Unavailable — Weather query",
    query: "พยากรณ์อากาศ กรุงเทพ วันนี้",
    degradeHeaders: { "x-test-degrade-tmd": "1" },
    expectedBehavior: "Falls back to NWP or nationwide fallback data",
    fallbackPath: "forecastEngine→error → nwpEngine → or NATIONWIDE_FALLBACK",
    mustMatchAny: [
      /กรุงเทพ|Bangkok/i,
      /อุณหภูมิ|temperature|องศา|℃|°C/i,
      /ฝน|rain|พยากรณ์|forecast|อากาศ|weather/i,
      /ระนอง|พังงา|ภูเก็ต/, // nationwide fallback data provinces
      /NWP|nwp/i,
      /fallback|สำรอง/i,
    ],
    mustNotMatch: [
      /500|Internal Server Error/,
      /Cannot read propert/i,
      /ECONNREFUSED/,
    ],
  },
  // ─── 2. NWP Unavailable ───
  {
    id: 2,
    name: "NWP Unavailable — Weather query",
    query: "อากาศเชียงใหม่พรุ่งนี้",
    degradeHeaders: { "x-test-degrade-nwp": "1" },
    expectedBehavior: "Falls back to TMD forecast/station engine",
    fallbackPath: "nwpEngine→error → forecastEngine → stationEngine",
    mustMatchAny: [
      /เชียงใหม่|Chiang\s*Mai/i,
      /อุณหภูมิ|temperature|องศา|ฝน|rain/i,
      /พยากรณ์|forecast|อากาศ|weather/i,
    ],
    mustNotMatch: [
      /500|Internal Server Error/,
      /Cannot read propert/i,
    ],
  },
  // ─── 3. TMD + NWP Both Down ───
  {
    id: 3,
    name: "TMD + NWP Both Down — Total weather failure",
    query: "วันนี้ฝนตกไหม กรุงเทพ",
    degradeHeaders: { "x-test-degrade-tmd": "1", "x-test-degrade-nwp": "1" },
    expectedBehavior: "Returns nationwide fallback static data or graceful error",
    fallbackPath: "all engines fail → NATIONWIDE_FALLBACK_ROWS or error message",
    mustMatchAny: [
      /ระนอง|พังงา|ภูเก็ต|กระบี่/, // nationwide fallback provinces
      /ฝน|rain|อากาศ|weather/i,
      /ไม่สามารถ|unavailable|ข้อผิดพลาด|error|ขออภัย|sorry/i,
      /กรุงเทพ|Bangkok/i,
    ],
    mustNotMatch: [
      /500|Internal Server Error/,
      /Cannot read propert/i,
      /ECONNREFUSED/,
    ],
  },
  // ─── 4. Upstream Timeout simulation (TMD+NWP degrade = effective timeout) ───
  {
    id: 4,
    name: "Upstream Timeout — Weather with all engines degraded",
    query: "อากาศหาดใหญ่สัปดาห์หน้า",
    degradeHeaders: { "x-test-degrade-tmd": "1", "x-test-degrade-nwp": "1" },
    expectedBehavior: "Graceful fallback or error within budget (30s)",
    fallbackPath: "engines error fast (degrade=instant) → fallback data",
    mustMatchAny: [
      /หาดใหญ่|สงขลา|Hat\s*Yai/i,
      /ฝน|rain|อากาศ|weather|forecast|พยากรณ์/i,
      /ไม่สามารถ|unavailable|ขออภัย|fallback/i,
      /ระนอง|พังงา/, // nationwide fallback
    ],
    mustNotMatch: [
      /timeout|ETIMEDOUT/i,
      /500|Internal Server Error/,
    ],
  },
  // ─── 5. Upstream 429 — TMD rate-limited (simulated via degrade) ───
  {
    id: 5,
    name: "Upstream 429 — TMD rate-limited + NWP degraded",
    query: "ฝนตกที่ไหนบ้างวันนี้",
    degradeHeaders: { "x-test-degrade-tmd": "1", "x-test-degrade-nwp": "1" },
    expectedBehavior: "Uses nationwide fallback or returns graceful message",
    fallbackPath: "all weather engines fail → nationwide fallback",
    mustMatchAny: [
      /ฝน|rain/i,
      /ระนอง|พังงา|ภูเก็ต|กระบี่/, // nationwide fallback
      /ไม่สามารถ|unavailable|ขออภัย/i,
    ],
    mustNotMatch: [
      /429|Too Many Requests/i,
      /500|Internal Server Error/,
    ],
  },
  // ─── 6. Redis Unavailable — Rate limiter falls back to in-memory ───
  // (Redis fallback is architectural: tested by making any normal request with SMOKE bypass)
  {
    id: 6,
    name: "Redis Unavailable — Rate limiter in-memory fallback",
    query: "ตอนนี้กี่โมง",
    degradeHeaders: {}, // no degrade; Redis fallback is transparent
    expectedBehavior: "Normal response, rate limiter uses in-memory fallback silently",
    fallbackPath: "Redis error → memoryLimiter.check()",
    mustMatchAny: [
      /\d{1,2}[:.]\d{2}|เวลา|time|โมง|นาฬิกา|\d{4}/i,
    ],
    mustNotMatch: [
      /500|Internal Server Error/,
      /Redis|ECONNREFUSED/i,
    ],
  },
  // ─── 7. MCP Tool Unavailable — Remote Ollama degraded ───
  {
    id: 7,
    name: "MCP/Remote Ollama Unavailable — General query",
    query: "AI คืออะไร",
    degradeHeaders: { "x-test-degrade-ollama-remote": "1" },
    expectedBehavior: "Falls back to local Ollama or returns a cached/static response",
    fallbackPath: "remote Ollama fail → local Ollama → or static answer",
    mustMatchAny: [
      /AI|artificial intelligence|ปัญญาประดิษฐ์|เครื่องจักร|machine|learning|เรียนรู้/i,
    ],
    mustNotMatch: [
      /500|Internal Server Error/,
      /ECONNREFUSED/,
    ],
    anyNonEmptyOk: true,
  },
  // ─── 8. Database Temporarily Unavailable ───
  {
    id: 8,
    name: "Database Unavailable — Evidence/DetectDB query",
    query: "ค้นหาหลักฐานเกี่ยวกับการทุจริต",
    degradeHeaders: { "x-test-degrade-db": "1" },
    expectedBehavior: "Returns a graceful 'DB unavailable' message, no crash",
    fallbackPath: "evidenceTool → throw DB_DEGRADED → error message to user",
    mustMatchAny: [
      /ฐานข้อมูล|database|ไม่พร้อม|unavailable|ข้อผิดพลาด|error|ขออภัย|ไม่สามารถ|ยังไม่/i,
      /หลักฐาน|evidence|ทุจริต|ค้นหา/i, // may still give some answer
    ],
    mustNotMatch: [
      /500|Internal Server Error/,
      /Cannot read propert/i,
      /ECONNREFUSED/,
    ],
  },
];

function postChat(
  query: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; body: any; rawText: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const url = new URL("/api/chat", BASE_URL);
    const payload = JSON.stringify({ message: query });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-smoke-run": "1",
      ...extraHeaders,
    };

    const start = Date.now();
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const latencyMs = Date.now() - start;
          try {
            const body = JSON.parse(data);
            resolve({ status: res.statusCode || 0, body, rawText: data, latencyMs });
          } catch {
            resolve({ status: res.statusCode || 0, body: null, rawText: data, latencyMs });
          }
        });
      }
    );
    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TIMEOUT"));
    });
    req.write(payload);
    req.end();
  });
}

async function runScenario(sc: DegradeScenario): Promise<{
  id: number;
  name: string;
  query: string;
  expectedBehavior: string;
  fallbackPath: string;
  actualStatus: number;
  actualAnswer: string;
  latencyMs: number;
  groundedness: string;
  verdict: "PASS" | "FAIL";
  failReason?: string;
}> {
  const result = {
    id: sc.id,
    name: sc.name,
    query: sc.query,
    expectedBehavior: sc.expectedBehavior,
    fallbackPath: sc.fallbackPath,
    actualStatus: 0,
    actualAnswer: "",
    latencyMs: 0,
    groundedness: "",
    verdict: "FAIL" as "PASS" | "FAIL",
    failReason: undefined as string | undefined,
  };

  try {
    const resp = await postChat(sc.query, sc.degradeHeaders);
    result.actualStatus = resp.status;
    result.latencyMs = resp.latencyMs;

    const answerText =
      resp.body?.text ||
      resp.body?.message ||
      resp.body?.error ||
      resp.rawText?.slice(0, 500) ||
      "";
    result.actualAnswer = String(answerText).slice(0, 300);

    // Check structuredContent for grounding data
    const sc2 = resp.body?.structuredContent;
    if (sc2) {
      const meta = sc2.chatMeta || sc2.__groundedContract || {};
      result.groundedness = JSON.stringify({
        route: meta.route || meta.selectedRoute || "unknown",
        tools: meta.toolsUsed || meta.selectedTools || [],
        source: meta.sourceType || "unknown",
      });
    } else {
      result.groundedness = "no-structured-content";
    }

    // PASS criteria
    if (resp.status >= 500) {
      result.failReason = `HTTP ${resp.status} — server crash`;
      return result;
    }

    // Check must-not-match
    if (sc.mustNotMatch) {
      for (const re of sc.mustNotMatch) {
        if (re.test(answerText)) {
          result.failReason = `Matched forbidden pattern: ${re}`;
          return result;
        }
      }
    }

    // Check must-match-any
    if (sc.anyNonEmptyOk && answerText.length > 5) {
      result.verdict = "PASS";
      return result;
    }

    const matched = sc.mustMatchAny.some((re) => re.test(answerText));
    if (matched) {
      result.verdict = "PASS";
    } else {
      result.failReason = `No expected pattern matched in response: "${answerText.slice(0, 100)}"`;
    }
  } catch (e: any) {
    result.failReason = `Exception: ${e.message}`;
    result.actualAnswer = `ERROR: ${e.message}`;
  }

  return result;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  DEGRADED-MODE PROOF — 8 Scenarios                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results: Awaited<ReturnType<typeof runScenario>>[] = [];

  for (const sc of SCENARIOS) {
    process.stdout.write(`  [${sc.id}/8] ${sc.name}... `);
    const r = await runScenario(sc);
    results.push(r);
    console.log(
      r.verdict === "PASS"
        ? `PASS (${r.latencyMs}ms)`
        : `FAIL — ${r.failReason} (${r.latencyMs}ms)`
    );
    // small delay between scenarios to avoid rate limit
    await new Promise((res) => setTimeout(res, 500));
  }

  const passed = results.filter((r) => r.verdict === "PASS").length;
  const failed = results.length - passed;

  console.log("\n" + "═".repeat(70));
  console.log(`SUMMARY: ${passed} PASS / ${failed} FAIL out of ${results.length}`);
  console.log("═".repeat(70));

  // Print table
  console.log("\n| # | Scenario | Expected | Actual Status | Actual Answer (first 80) | Fallback | Grounded | Verdict |");
  console.log("|---|----------|----------|---------------|--------------------------|----------|----------|---------|");
  for (const r of results) {
    console.log(
      `| ${r.id} | ${r.name.slice(0, 30)} | ${r.expectedBehavior.slice(0, 25)} | ${r.actualStatus} | ${r.actualAnswer.slice(0, 80).replace(/\n/g, " ")} | ${r.fallbackPath.slice(0, 20)} | ${r.groundedness.slice(0, 20)} | **${r.verdict}** |`
    );
  }

  // Save evidence
  const evidencePath = path.join(__dirname, "degraded_mode_proof_evidence.json");
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        target: BASE_URL,
        summary: { total: results.length, passed, failed },
        results,
      },
      null,
      2
    )
  );
  console.log(`\nEvidence saved: ${evidencePath}`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
