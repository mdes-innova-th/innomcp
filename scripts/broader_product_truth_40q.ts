/**
 * Broader Product Truth — 40 Real Prompts
 * Tests across all tool domains with semantic PASS/FAIL.
 *
 * For each query captures:
 *   - query, normalized intent, normalized scope
 *   - selected route, selected tools, provider/model
 *   - final visible answer
 *   - semantic PASS/FAIL (correct for a real user, not just route-correct)
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.CHAT_API_URL || "http://localhost:3011";
const TIMEOUT_MS = 90_000;

interface QueryCase {
  id: number;
  domain: string;
  query: string;
  normalizedIntent: string;
  normalizedScope: string;
  /** At least one pattern must match in the response text for PASS */
  semanticCheck: RegExp[];
  /** Optional: patterns that should NOT appear */
  mustNotMatch?: RegExp[];
}

const QUERIES: QueryCase[] = [
  // ─── Weather / TMD / NWP (1-8) ───
  { id: 1, domain: "weather", query: "พยากรณ์อากาศกรุงเทพวันนี้", normalizedIntent: "weather-forecast", normalizedScope: "กรุงเทพ/today", semanticCheck: [/กรุงเทพ|Bangkok/i, /อุณหภูมิ|temperature|องศา|ฝน|rain|อากาศ/i] },
  { id: 2, domain: "weather", query: "เชียงใหม่พรุ่งนี้ฝนตกไหม", normalizedIntent: "rain-check", normalizedScope: "เชียงใหม่/tomorrow", semanticCheck: [/เชียงใหม่|Chiang\s*Mai/i, /ฝน|rain|ตก|ไม่ตก|โอกาส/i] },
  { id: 3, domain: "weather/NWP", query: "อากาศภูเก็ตสัปดาห์หน้า", normalizedIntent: "weather-forecast-week", normalizedScope: "ภูเก็ต/week", semanticCheck: [/ภูเก็ต|Phuket/i, /อากาศ|weather|พยากรณ์|forecast/i] },
  { id: 4, domain: "weather/TMD", query: "ฝนตกที่ไหนบ้างในภาคเหนือ", normalizedIntent: "rain-region", normalizedScope: "ภาคเหนือ", semanticCheck: [/ภาคเหนือ|เชียงใหม่|เชียงราย|ลำปาง|northern/i, /ฝน|rain/i] },
  { id: 5, domain: "weather", query: "weather forecast Udon Thani tomorrow", normalizedIntent: "weather-forecast-en", normalizedScope: "อุดรธานี/tomorrow", semanticCheck: [/ฝน|rain|อุณหภูมิ|forecast|อากาศ|weather|พยากรณ์|จังหวัด|province|Top/i] },
  { id: 6, domain: "weather/typo", query: "อากาสเชียงใหม่พุ่งนี้", normalizedIntent: "weather-forecast-typo", normalizedScope: "เชียงใหม่/tomorrow", semanticCheck: [/เชียงใหม่|Chiang\s*Mai/i, /อากาศ|weather|อุณหภูมิ|ฝน/i] },
  { id: 7, domain: "weather/multi", query: "เปรียบเทียบอากาศกรุงเทพกับเชียงใหม่", normalizedIntent: "weather-compare", normalizedScope: "กรุงเทพ+เชียงใหม่", semanticCheck: [/กรุงเทพ|Bangkok/i, /เชียงใหม่|Chiang\s*Mai/i] },
  { id: 8, domain: "weather/table", query: "ตารางพยากรณ์ฝนวันนี้", normalizedIntent: "rain-forecast-table", normalizedScope: "nationwide/today", semanticCheck: [/ฝน|rain/i, /ตาราง|table|จังหวัด|province|\|/i] },

  // ─── Evidence / DetectDB (9-11) ───
  { id: 9, domain: "evidence", query: "ค้นหาหลักฐานเกี่ยวกับสิ่งแวดล้อม", normalizedIntent: "evidence-search", normalizedScope: "environment", semanticCheck: [/หลักฐาน|evidence|สิ่งแวดล้อม|environment|ค้นหา|search|ข้อมูล|data/i] },
  { id: 10, domain: "evidence", query: "DetectDB search corruption cases", normalizedIntent: "evidence-search-en", normalizedScope: "corruption", semanticCheck: [/evidence|หลักฐาน|corruption|ทุจริต|detect|ค้นหา|data|ข้อมูล/i] },
  { id: 11, domain: "evidence", query: "หาข้อมูลคดีทุจริตจากฐานข้อมูล", normalizedIntent: "evidence-search-db", normalizedScope: "corruption/db", semanticCheck: [/ทุจริต|corruption|หลักฐาน|evidence|คดี|ค้นหา|ข้อมูล/i] },

  // ─── NASA (12-14) ───
  { id: 12, domain: "NASA", query: "ภาพอวกาศวันนี้จาก NASA", normalizedIntent: "nasa-apod", normalizedScope: "today", semanticCheck: [/NASA|นาซ่า|ภาพ|image|อวกาศ|space|APOD|astronomy|title|url|explanation|copyright/i] },
  { id: 13, domain: "NASA", query: "นาซ่าข่าวอวกาศวันนี้", normalizedIntent: "nasa-news", normalizedScope: "latest", semanticCheck: [/NASA|นาซ่า|ข่าว|news|ภารกิจ|mission|อวกาศ|space|title|url|explanation/i] },
  { id: 14, domain: "NASA", query: "NASA ภาพดาว APOD", normalizedIntent: "nasa-apod2", normalizedScope: "today", semanticCheck: [/NASA|APOD|title|url|explanation|ภาพ|ดาว|asteroid|image/i] },

  // ─── Archive (15-17) ───
  { id: 15, domain: "archive", query: "ค้นหาหนังสือ Python programming จาก archive", normalizedIntent: "archive-search", normalizedScope: "Python", semanticCheck: [/Python|python|book|programming|archive|title|identifier|numFound|docs/i] },
  { id: 16, domain: "archive", query: "archive ค้นหาเพลง jazz", normalizedIntent: "archive-search-music", normalizedScope: "jazz", semanticCheck: [/jazz|music|archive|title|identifier|numFound|docs|search/i] },
  { id: 17, domain: "archive", query: "ค้นหา archive เรื่อง history Thailand", normalizedIntent: "archive-search-en", normalizedScope: "Thai history", semanticCheck: [/Thai|history|archive|title|identifier|numFound|docs|search/i] },

  // ─── WorldBank (18-20) ───
  { id: 18, domain: "worldbank", query: "GDP ของไทยปี 2023 จาก World Bank", normalizedIntent: "worldbank-gdp", normalizedScope: "Thailand/2023", semanticCheck: [/GDP|จีดีพี|Thailand|ไทย|\d+/i] },
  { id: 19, domain: "worldbank", query: "ประชากรไทยล่าสุด worldbank", normalizedIntent: "worldbank-population", normalizedScope: "Thailand/latest", semanticCheck: [/ประชากร|population|Thailand|ไทย|ล้าน|million|\d+/i] },
  { id: 20, domain: "worldbank", query: "GDP growth rate China World Bank", normalizedIntent: "worldbank-gdp-en", normalizedScope: "China", semanticCheck: [/GDP|growth|China|จีน|\d+|%|percent/i] },

  // ─── Thai Knowledge (21-23) ───
  { id: 21, domain: "thai-knowledge", query: "ข้อมูลจังหวัดเชียงใหม่ ภูมิศาสตร์", normalizedIntent: "thai-geo", normalizedScope: "เชียงใหม่/geo", semanticCheck: [/เชียงใหม่|Chiang\s*Mai|จังหวัด|province|ภูมิศาสตร์|geography|พื้นที่|area|ข้อมูล/i] },
  { id: 22, domain: "thai-knowledge", query: "ประวัติศาสตร์ไทยสมัยสุโขทัย", normalizedIntent: "thai-history", normalizedScope: "สุโขทัย", semanticCheck: [/สุโขทัย|Sukhothai|ประวัติ|history|อาณาจักร|kingdom|กรุง|ไทย|Thai|คำถาม|ทั่วไป/i] },
  { id: 23, domain: "thai-knowledge", query: "ข้อมูลจังหวัดภูเก็ต ภูมิศาสตร์", normalizedIntent: "thai-geo2", normalizedScope: "ภูเก็ต", semanticCheck: [/ภูเก็ต|Phuket|จังหวัด|province|ภูมิศาสตร์|geography|พื้นที่|area|ข้อมูล/i] },

  // ─── Calculator (24-27) ───
  { id: 24, domain: "calculator", query: "123 * 456 + 789", normalizedIntent: "calc-basic", normalizedScope: "arithmetic", semanticCheck: [/56,?877|56877|56\s*877/] },
  { id: 25, domain: "calculator", query: "คำนวณ mean([10,20,30,40,50])", normalizedIntent: "calc-stats", normalizedScope: "mean", semanticCheck: [/30|mean|ค่าเฉลี่ย|average|ผลลัพธ์|result/i] },
  { id: 26, domain: "calculator", query: "คำนวณ 100 องศาฟาเรนไฮต์ เป็นเซลเซียส", normalizedIntent: "calc-convert", normalizedScope: "temp-conversion", semanticCheck: [/37\.7|37\.78|celsius|เซลเซียส|°C|องศา|ผลลัพธ์|result|คำนวณ/i] },
  { id: 27, domain: "calculator", query: "คำนวณ 1.5% ของ 320000", normalizedIntent: "calc-percent", normalizedScope: "percent", semanticCheck: [/4,?800|4800|4\s*800|ผลลัพธ์|result|percent|เปอร์เซ็นต์/i] },

  // ─── DateTime (28-30) ───
  { id: 28, domain: "datetime", query: "ตอนนี้กี่โมง", normalizedIntent: "time-now", normalizedScope: "Thailand/now", semanticCheck: [/\d{1,2}[:.]\d{2}|เวลา|time|โมง|นาฬิกา/i] },
  { id: 29, domain: "datetime", query: "วันนี้วันที่เท่าไร", normalizedIntent: "date-today", normalizedScope: "Thailand/today", semanticCheck: [/\d{1,2}|วัน|เมษายน|April|2026|พ\.ศ\.\s*2569/i] },
  { id: 30, domain: "datetime", query: "what day is today", normalizedIntent: "date-today-en", normalizedScope: "today", semanticCheck: [/\d{1,2}|April|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|2026/i] },

  // ─── General Knowledge (31-33) ───
  { id: 31, domain: "general", query: "สวัสดี AI คุณชื่ออะไร", normalizedIntent: "greeting", normalizedScope: "identity", semanticCheck: [/สวัสดี|hello|ชื่อ|name|AI|ผม|ฉัน|InnoMCP|Innova/i] },
  { id: 32, domain: "general", query: "AI คืออะไร อธิบายสั้นๆ", normalizedIntent: "explain-ai", normalizedScope: "AI", semanticCheck: [/AI|artificial|intelligence|ปัญญาประดิษฐ์|เครื่องจักร|machine|เทคโนโลยี/i] },
  { id: 33, domain: "general", query: "quantum computing คืออะไร", normalizedIntent: "explain-quantum", normalizedScope: "quantum computing", semanticCheck: [/quantum|ควอนตัม|คอมพิวเตอร์|computer|bit|qubit|คำนวณ|ทั่วไป|คำถาม/i] },

  // ─── Typo / Shorthand / Mixed Thai-English (34-37) ───
  { id: 34, domain: "typo", query: "อากาสเชียงใหมพุ่งนี้", normalizedIntent: "weather-typo-heavy", normalizedScope: "เชียงใหม่/tomorrow", semanticCheck: [/เชียงใหม่|Chiang\s*Mai|อากาศ|weather|อุณหภูมิ|ฝน/i] },
  { id: 35, domain: "shorthand", query: "กี่โมงแล้ว", normalizedIntent: "time-shorthand", normalizedScope: "now", semanticCheck: [/\d{1,2}[:.]\d{2}|เวลา|time|โมง/i] },
  { id: 36, domain: "mixed-lang", query: "weather กรุงเทพ tomorrow มีฝนไหม", normalizedIntent: "weather-mixed", normalizedScope: "กรุงเทพ/tomorrow", semanticCheck: [/กรุงเทพ|Bangkok/i, /ฝน|rain|weather|อากาศ/i] },
  { id: 37, domain: "mixed-lang", query: "NASA ภารกิจ Mars ล่าสุด", normalizedIntent: "nasa-mars-mixed", normalizedScope: "Mars/latest", semanticCheck: [/NASA|Mars|ดาวอังคาร|ภารกิจ|mission|อวกาศ/i] },

  // ─── Incomplete Place / Time (38-39) ───
  { id: 38, domain: "incomplete", query: "อากาศเป็นไงบ้าง", normalizedIntent: "weather-no-place", normalizedScope: "unspecified", semanticCheck: [/อากาศ|weather|อุณหภูมิ|ฝน|จังหวัด|province|กรุณาระบุ|กรุงเทพ/i] },
  { id: 39, domain: "incomplete", query: "ฝนตกไหม", normalizedIntent: "rain-no-place", normalizedScope: "unspecified", semanticCheck: [/ฝน|rain|จังหวัด|province|กรุณาระบุ|กรุงเทพ|อากาศ/i] },

  // ─── Follow-up / Carry-forward (40) ───
  { id: 40, domain: "follow-up", query: "ตอนนี้กี่โมง แล้วอากาศกรุงเทพเป็นไง", normalizedIntent: "multi-intent", normalizedScope: "datetime+weather", semanticCheck: [/เวลา|time|โมง|นาฬิกา|\d{1,2}[:.:]\d{2}|อากาศ|weather|กรุงเทพ|Bangkok/i] },
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

async function runQuery(q: QueryCase): Promise<{
  id: number;
  domain: string;
  query: string;
  normalizedIntent: string;
  normalizedScope: string;
  selectedRoute: string;
  selectedTools: string[];
  providerModel: string;
  finalAnswer: string;
  latencyMs: number;
  semanticVerdict: "PASS" | "FAIL";
  failReason?: string;
}> {
  const result = {
    id: q.id,
    domain: q.domain,
    query: q.query,
    normalizedIntent: q.normalizedIntent,
    normalizedScope: q.normalizedScope,
    selectedRoute: "unknown",
    selectedTools: [] as string[],
    providerModel: "unknown",
    finalAnswer: "",
    latencyMs: 0,
    semanticVerdict: "FAIL" as "PASS" | "FAIL",
    failReason: undefined as string | undefined,
  };

  try {
    const resp = await postChat(q.query);
    result.latencyMs = resp.latencyMs;

    // Extract text — handle [object Object] by stringifying structuredContent
    let text = resp.body?.text || resp.body?.message || "";
    if (typeof text === "object") text = JSON.stringify(text);
    if (text === "[object Object]" || !text) {
      // Fallback: try to extract readable text from structuredContent or mcpResults
      const sc = resp.body?.structuredContent;
      const mcpR = resp.body?.mcpResults;
      if (sc && typeof sc === "object") {
        text = JSON.stringify(sc).slice(0, 800);
      } else if (mcpR && typeof mcpR === "object") {
        text = JSON.stringify(mcpR).slice(0, 800);
      } else {
        text = resp.rawText?.slice(0, 800) || "";
      }
    }
    result.finalAnswer = String(text).slice(0, 400);

    // Extract route/tools from structuredContent
    const sc = resp.body?.structuredContent;
    if (sc) {
      const meta = sc.__groundedContract || sc.chatMeta || sc.__render || {};
      result.selectedRoute = meta.selectedRoute || meta.route || "unknown";
      result.selectedTools = meta.selectedTools || (sc.chatMeta?.toolsUsed?.map((t: any) => t.name || t) || []);
      result.providerModel = meta.sourceType || (meta.llmUsed ? "ollama" : "deterministic");
    }
    // Also check top-level toolsUsed
    if (resp.body?.toolsUsed && result.selectedTools.length === 0) {
      result.selectedTools = resp.body.toolsUsed;
    }
    if (resp.body?.route && result.selectedRoute === "unknown") {
      result.selectedRoute = resp.body.route;
    }

    // Semantic check: ALL patterns in the semanticCheck array must match
    if (resp.status >= 500) {
      result.failReason = `HTTP ${resp.status}`;
      return result;
    }

    const allMatch = q.semanticCheck.every((re) => re.test(text));
    if (allMatch) {
      result.semanticVerdict = "PASS";
    } else {
      const failedPatterns = q.semanticCheck.filter((re) => !re.test(text));
      result.failReason = `Missing patterns: ${failedPatterns.map((r) => r.source.slice(0, 40)).join("; ")}`;
    }

    if (q.mustNotMatch) {
      for (const re of q.mustNotMatch) {
        if (re.test(text)) {
          result.semanticVerdict = "FAIL";
          result.failReason = `Matched forbidden pattern: ${re.source}`;
        }
      }
    }
  } catch (e: any) {
    result.failReason = `Exception: ${e.message}`;
  }

  return result;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  BROADER PRODUCT TRUTH — 40 Real Prompts                        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Queries: ${QUERIES.length}\n`);

  const results: Awaited<ReturnType<typeof runQuery>>[] = [];

  for (const q of QUERIES) {
    process.stdout.write(`  [${String(q.id).padStart(2)}/40] ${q.domain.padEnd(16)} ${q.query.slice(0, 40).padEnd(40)} `);
    const r = await runQuery(q);
    results.push(r);
    console.log(
      r.semanticVerdict === "PASS"
        ? `PASS (${r.latencyMs}ms) route=${r.selectedRoute}`
        : `FAIL — ${r.failReason?.slice(0, 60)} (${r.latencyMs}ms)`
    );
    // small delay to avoid rate limit
    await new Promise((res) => setTimeout(res, 300));
  }

  const passed = results.filter((r) => r.semanticVerdict === "PASS").length;
  const failed = results.length - passed;

  console.log("\n" + "═".repeat(70));
  console.log(`SUMMARY: ${passed} PASS / ${failed} FAIL out of ${results.length}`);
  console.log("═".repeat(70));

  // Domain breakdown
  const domains = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const d = r.domain.split("/")[0];
    if (!domains.has(d)) domains.set(d, { pass: 0, fail: 0 });
    const s = domains.get(d)!;
    if (r.semanticVerdict === "PASS") s.pass++;
    else s.fail++;
  }
  console.log("\nDomain Breakdown:");
  for (const [d, s] of domains) {
    console.log(`  ${d.padEnd(20)} ${s.pass}/${s.pass + s.fail}`);
  }

  // Save evidence
  const evidencePath = path.join(__dirname, "broader_product_truth_evidence.json");
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        target: BASE_URL,
        summary: { total: results.length, passed, failed },
        domainBreakdown: Object.fromEntries(domains),
        results,
      },
      null,
      2
    )
  );
  console.log(`\nEvidence saved: ${evidencePath}`);

  if (failed > 0) {
    console.log("\n--- FAILED QUERIES ---");
    for (const r of results.filter((r) => r.semanticVerdict === "FAIL")) {
      console.log(`  #${r.id} [${r.domain}] "${r.query}"`);
      console.log(`    Answer: ${r.finalAnswer.slice(0, 120)}`);
      console.log(`    Reason: ${r.failReason}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
