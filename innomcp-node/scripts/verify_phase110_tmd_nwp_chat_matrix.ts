/**
 * verify_phase110_tmd_nwp_chat_matrix.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 11.0 — TMD/NWP Endpoint-Level Chat Coverage Matrix
 *
 * Tests 17 TMD/NWP capability groups via the running chat API.
 * Each group has 4 questions: easy / medium / hard / very-hard.
 * Records: route, toolsUsed, answer snippet, pass/fail, reason.
 *
 * Run (server must be running on port specified by CHAT_PORT or 3000):
 *   npx ts-node scripts/verify_phase110_tmd_nwp_chat_matrix.ts
 *
 * OFFLINE smoke mode (uses fixture data, no real API calls):
 *   INNOMCP_MODE=offline SMOKE_MODE=1 WEATHER_FIXTURE_W1=1 \
 *     npx ts-node scripts/verify_phase110_tmd_nwp_chat_matrix.ts
 */

import http from "http";
import fs from "fs";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────
const CHAT_PORT = Number(process.env.CHAT_PORT || process.env.PORT || 3000);
const INNOMCP_MODE = process.env.INNOMCP_MODE || "online";
const OFFLINE = INNOMCP_MODE === "offline";
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function nowStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────
interface ChatResp {
  status: number;
  text: string;
  toolsUsed: string[];
  route: string;
  reasonCode: string;
  raw: any;
}

function chatPost(message: string, sessionId?: string): Promise<ChatResp> {
  const body: any = { message };
  if (sessionId) body.sessionId = sessionId;

  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: CHAT_PORT,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
          "X-Smoke-Run": "1",
        },
        timeout: 30000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: any = null;
          try { json = JSON.parse(raw); } catch { json = null; }
          resolve({
            status: res.statusCode || 0,
            text: String(json?.text || json?.answer || json?.message || ""),
            toolsUsed: Array.isArray(json?.toolsUsed) ? json.toolsUsed : [],
            route: String(json?.structuredContent?.chatMeta?.route || json?.route || ""),
            reasonCode: String(json?.structuredContent?.chatMeta?.reason_code || ""),
            raw: json,
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => reject(new Error("TIMEOUT")));
    req.write(payload);
    req.end();
  });
}

// ─── Matrix definition ──────────────────────────────────────────────────────
// Each capability: { group, endpointPath, questions: [easy, medium, hard, very_hard] }
// Expected: weather-related route, at least 1 tool used, non-empty answer

interface CapabilityCase {
  q: string;
  difficulty: "easy" | "medium" | "hard" | "very_hard";
}

interface CapabilityGroup {
  id: string;
  name: string;
  endpointGroup: string;   // backend engine path
  tier: "demo" | "api" | "nwp";
  cases: CapabilityCase[];
  expectedRoute: string;
  expectedTools: string[];
  chatReachable: boolean; // false = document why not reachable
  notReachableReason?: string;
}

const MATRIX: CapabilityGroup[] = [
  // ─── TMD API-tier tools ────────────────────────────────────────────────────
  {
    id: "tmd_current_conditions",
    name: "TMD Current Weather (today 7am all stations)",
    endpointGroup: "tmd_weather_today_07am_all_stations",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: ["tmd_weather_today_07am_all_stations"],
    chatReachable: true,
    cases: [
      { q: "อากาศตอนเช้าวันนี้เป็นอย่างไร", difficulty: "easy" },
      { q: "สถานีอุตุนิยมวิทยาทั่วประเทศรายงานอุณหภูมิเช้านี้ว่าอย่างไร", difficulty: "medium" },
      { q: "ข้อมูลตรวจอากาศเวลา 07.00 น. วันนี้ทุกสถานีเป็นอย่างไร", difficulty: "hard" },
      { q: "เปรียบเทียบอุณหภูมิสถานีอุตุนิยมวิทยาหลักทั่วประเทศเวลา 07.00 น. วันนี้", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_3hour_obs",
    name: "TMD 3-Hourly Observations (all stations)",
    endpointGroup: "tmd_weather_3hours_all_stations",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: ["tmd_weather_3hours_all_stations"],
    chatReachable: true,
    cases: [
      { q: "อากาศช่วง 3 ชั่วโมงที่ผ่านมาเป็นอย่างไร", difficulty: "easy" },
      { q: "ข้อมูลตรวจอากาศ 3 ชั่วโมงล่าสุดจากทุกสถานีมีอะไรบ้าง", difficulty: "medium" },
      { q: "แนวโน้มสภาพอากาศจากการตรวจ 3 ชั่วโมงย้อนหลัง 2 รอบ", difficulty: "hard" },
      { q: "ช่วงเวลาใดในรอบ 3 ชั่วโมงที่ฝนตกหนักที่สุดในภาคกลาง", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_forecast_7d_province",
    name: "TMD 7-Day Province Forecast",
    endpointGroup: "tmd_weather_forecast_7days_by_province",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: ["tmd_weather_forecast_7days_by_province"],
    chatReachable: true,
    cases: [
      { q: "พยากรณ์อากาศเชียงใหม่ 7 วัน", difficulty: "easy" },
      { q: "อากาศกรุงเทพฯ สัปดาห์หน้าจะเป็นอย่างไร", difficulty: "medium" },
      { q: "พยากรณ์ 7 วันของภูเก็ต เหมาะกับการท่องเที่ยวไหม", difficulty: "hard" },
      { q: "เปรียบเทียบพยากรณ์ 7 วันระหว่างเชียงใหม่และสุราษฎร์ธานี และสรุปวันไหนดีที่สุดสำหรับเที่ยวกลางแจ้ง", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_forecast_7d_region",
    name: "TMD 7-Day Region Forecast",
    endpointGroup: "tmd_weather_forecast_7days_by_region",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: ["tmd_weather_forecast_7days_by_region"],
    chatReachable: true,
    cases: [
      { q: "อากาศภาคใต้สัปดาห์นี้", difficulty: "easy" },
      { q: "พยากรณ์อากาศภาคเหนือ 7 วันข้างหน้า", difficulty: "medium" },
      { q: "พยากรณ์ 7 วันภาคตะวันออกเฉียงเหนือ มีโอกาสฝนกี่วัน", difficulty: "hard" },
      { q: "สรุปพยากรณ์ 7 วันทุกภาครวมทั้งประเทศ โดยเน้นวันที่มีฝนมากที่สุด", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_warning_news",
    name: "TMD Weather Warning/News",
    endpointGroup: "tmd_weather_warning_news",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: ["tmd_weather_warning_news"],
    chatReachable: true,
    cases: [
      { q: "มีคำเตือนอากาศร้ายแรงวันนี้ไหม", difficulty: "easy" },
      { q: "ประกาศเตือนภัยอากาศล่าสุดจากกรมอุตุฯ มีอะไรบ้าง", difficulty: "medium" },
      { q: "ข่าวอุตุนิยมวิทยาและการเตือนภัยสำหรับภาคใต้ล่าสุด", difficulty: "hard" },
      { q: "ประกาศเตือนภัยทุกฉบับในช่วง 24 ชั่วโมงที่ผ่านมา จัดกลุ่มตามความรุนแรง", difficulty: "very_hard" },
    ],
  },
  // ─── TMD Demo-tier tools ────────────────────────────────────────────────────
  {
    id: "tmd_seismic",
    name: "TMD Seismic Daily Events",
    endpointGroup: "tmd_seismic_daily_events",
    tier: "demo",
    expectedRoute: "weather",
    expectedTools: ["tmd_seismic_daily_events"],
    chatReachable: true,
    cases: [
      { q: "วันนี้มีแผ่นดินไหวที่ไหนบ้าง", difficulty: "easy" },
      { q: "แผ่นดินไหวในไทยและรอบๆ วันนี้มีกี่ครั้ง", difficulty: "medium" },
      { q: "แผ่นดินไหวขนาดเกิน 4 ริกเตอร์ในภูมิภาคเอเชียตะวันออกเฉียงใต้วันนี้", difficulty: "hard" },
      { q: "วิเคราะห์รูปแบบแผ่นดินไหวรายวันของไทยในช่วงที่ผ่านมา และชี้จุดที่มีความเสี่ยงสูง", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_climate_normal",
    name: "TMD Climate Normal 1981-2010",
    endpointGroup: "tmd_thailand_climate_normal_1981_2010",
    tier: "demo",
    expectedRoute: "weather",
    expectedTools: ["tmd_thailand_climate_normal_1981_2010"],
    chatReachable: true,
    cases: [
      { q: "อุณหภูมิเฉลี่ยของไทยตามค่าปกติ", difficulty: "easy" },
      { q: "ค่าปกติอุณหภูมิเฉลี่ยช่วงปี 1981-2010 ของกรุงเทพฯ", difficulty: "medium" },
      { q: "เปรียบเทียบค่าปกติอุณหภูมิของภาคเหนือกับภาคใต้ปี 1981-2010", difficulty: "hard" },
      { q: "สร้างตารางค่าปกติอุณหภูมิและปริมาณฝนรายเดือนสำหรับ 5 ภาคของไทย", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_monthly_rainfall",
    name: "TMD Monthly Rainfall Thailand",
    endpointGroup: "tmd_thailand_monthly_rainfall",
    tier: "demo",
    expectedRoute: "weather",
    expectedTools: ["tmd_thailand_monthly_rainfall"],
    chatReachable: true,
    cases: [
      { q: "ปริมาณฝนเฉลี่ยรายเดือนของไทย", difficulty: "easy" },
      { q: "เดือนไหนมีฝนมากที่สุดในประเทศไทย", difficulty: "medium" },
      { q: "ปริมาณฝนรายเดือนของภาคใต้ฝั่งตะวันตกเปรียบเทียบกับฝั่งตะวันออก", difficulty: "hard" },
      { q: "วิเคราะห์ความแปรปรวนของปริมาณฝนรายเดือนตลอดปีในแต่ละภาค พร้อมเดือนสูงสุดต่ำสุด", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_rain_regions",
    name: "TMD Rain Regions",
    endpointGroup: "tmd_rain_regions",
    tier: "demo",
    expectedRoute: "weather",
    expectedTools: ["tmd_rain_regions"],
    chatReachable: true,
    cases: [
      { q: "ภูมิภาคใดของไทยฝนตกมากที่สุดตอนนี้", difficulty: "easy" },
      { q: "ข้อมูลฝนตกตามภูมิภาคล่าสุดจากกรมอุตุฯ", difficulty: "medium" },
      { q: "เปรียบเทียบปริมาณฝนปัจจุบันแต่ละภาคและวิเคราะห์ความเสี่ยงน้ำท่วม", difficulty: "hard" },
      { q: "แผนที่ความเข้มของฝนรายภาคพร้อมระบุว่าภาคใดต้องระวังน้ำท่วมฉับพลัน", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_station_list",
    name: "TMD Station List",
    endpointGroup: "tmd_station_list",
    tier: "demo",
    expectedRoute: "weather",
    expectedTools: ["tmd_station_list"],
    chatReachable: true,
    cases: [
      { q: "สถานีอุตุนิยมวิทยาในไทยมีกี่แห่ง", difficulty: "easy" },
      { q: "รายชื่อสถานีอุตุฯ ในภาคเหนือ", difficulty: "medium" },
      { q: "สถานีอุตุฯ ในจังหวัดเชียงใหม่มีสถานีอะไรบ้างและตั้งอยู่ที่ใด", difficulty: "hard" },
      { q: "จำแนกสถานีอุตุฯ ทุกแห่งตามภาคและจังหวัด พร้อมพิกัด", difficulty: "very_hard" },
    ],
  },
  // ─── NWP tools ─────────────────────────────────────────────────────────────
  {
    id: "nwp_daily_location",
    name: "NWP Daily Forecast by Location",
    endpointGroup: "nwp_daily / /forecast/location/daily",
    tier: "nwp",
    expectedRoute: "weather",
    expectedTools: ["nwp_daily", "nwpDailyTool"],
    chatReachable: true,
    cases: [
      { q: "พยากรณ์อากาศรายวันกรุงเทพวันนี้", difficulty: "easy" },
      { q: "พยากรณ์อากาศรายวันเชียงใหม่ 3 วันข้างหน้า", difficulty: "medium" },
      { q: "NWP รายวันของขอนแก่น สัปดาห์หน้ามีฝนกี่วัน", difficulty: "hard" },
      { q: "เปรียบเทียบ NWP รายวันของ 3 จังหวัด ฝั่งอ่าวไทย ฝั่งอันดามัน และภาคเหนือ สรุปเป็นตาราง", difficulty: "very_hard" },
    ],
  },
  {
    id: "nwp_hourly_location",
    name: "NWP Hourly Forecast by Location",
    endpointGroup: "nwp_hourly / /forecast/location/hourly",
    tier: "nwp",
    expectedRoute: "weather",
    expectedTools: ["nwp_hourly", "nwpHourlyTool"],
    chatReachable: true,
    cases: [
      { q: "พยากรณ์อากาศรายชั่วโมงกรุงเทพวันนี้", difficulty: "easy" },
      { q: "ฝนจะตกกี่โมงที่ภูเก็ตพรุ่งนี้", difficulty: "medium" },
      { q: "พยากรณ์รายชั่วโมงของขอนแก่น 24 ชั่วโมงข้างหน้า มีช่วงไหนควรระวังฝน", difficulty: "hard" },
      { q: "ชั่วโมงไหนในพรุ่งนี้ที่กรุงเทพฯ จะมีความชื้นสูงสุดและอุณหภูมิต่ำสุด", difficulty: "very_hard" },
    ],
  },
  {
    id: "nwp_area_region",
    name: "NWP Area Region Forecast",
    endpointGroup: "nwp_area / /forecast/area/region",
    tier: "nwp",
    expectedRoute: "weather",
    expectedTools: ["nwp_area", "nwp_daily"],
    chatReachable: true,
    cases: [
      { q: "อากาศภาคใต้พรุ่งนี้", difficulty: "easy" },
      { q: "พยากรณ์อากาศรายพื้นที่ภาคตะวันออกเฉียงเหนือสัปดาห์นี้", difficulty: "medium" },
      { q: "แนวโน้มพยากรณ์อากาศรายพื้นที่ภาคเหนือ 7 วันข้างหน้า", difficulty: "hard" },
      { q: "เปรียบเทียบพยากรณ์รายพื้นที่ระหว่างทุกภาคของไทย และระบุว่าภาคใดมีโอกาสเกิดน้ำท่วมสูงสุด", difficulty: "very_hard" },
    ],
  },
  // ─── Analytical / Short-circuit paths ──────────────────────────────────────
  {
    id: "weather_analytical_time",
    name: "Weather Analytical — Time/Date reasoning",
    endpointGroup: "analytical / short-circuit",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: [],
    chatReachable: true,
    cases: [
      { q: "ตอนนี้กี่โมงแล้ว", difficulty: "easy" },
      { q: "วันนี้วันที่เท่าไร", difficulty: "medium" },
      { q: "สัปดาห์หน้าเริ่มวันจันทร์หรือวันอาทิตย์", difficulty: "hard" },
      { q: "นับจากวันนี้ถึงสิ้นปีนี้เหลืออีกกี่วัน", difficulty: "very_hard" },
    ],
  },
  {
    id: "weather_risk_flood",
    name: "Weather Risk: Flood/Hydro reasoning",
    endpointGroup: "weather_analytical / risk_assessment",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: [],
    chatReachable: true,
    cases: [
      { q: "วันนี้มีความเสี่ยงน้ำท่วมไหม", difficulty: "easy" },
      { q: "ภาคใดมีความเสี่ยงน้ำท่วมมากที่สุดในสัปดาห์นี้", difficulty: "medium" },
      { q: "ประเมินความเสี่ยงน้ำท่วมฉับพลันของภาคเหนือช่วง 3-5 วันข้างหน้า", difficulty: "hard" },
      { q: "วิเคราะห์ปัจจัยเสี่ยงน้ำท่วมทั้งระดับน้ำ ปริมาณฝน และพื้นที่รับน้ำสำหรับภาคกลาง", difficulty: "very_hard" },
    ],
  },
  {
    id: "weather_general_question",
    name: "General Weather Questions (GuardedPath)",
    endpointGroup: "general_knowledge / guarded_path",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: [],
    chatReachable: true,
    cases: [
      { q: "ฝนตกฤดูร้อนดีหรือไม่", difficulty: "easy" },
      { q: "ฤดูฝนของไทยกินเวลากี่เดือน", difficulty: "medium" },
      { q: "เปรียบเทียบลักษณะภูมิอากาศไทยกับประเทศเพื่อนบ้าน", difficulty: "hard" },
      { q: "อธิบายกลไก ITCZ และผลกระทบต่อฤดูฝนไทยแบบละเอียด", difficulty: "very_hard" },
    ],
  },
  {
    id: "tmd_additional_tools",
    name: "Other TMD Tools (pressure/solar/misc)",
    endpointGroup: "tmd_various_api_tier",
    tier: "api",
    expectedRoute: "weather",
    expectedTools: [],
    chatReachable: true,
    cases: [
      { q: "ความกดอากาศในกรุงเทพวันนี้เท่าไร", difficulty: "easy" },
      { q: "ข้อมูลรังสีดวงอาทิตย์ในประเทศไทยล่าสุด", difficulty: "medium" },
      { q: "ระดับน้ำทะเลบริเวณชายฝั่งอ่าวไทยวันนี้", difficulty: "hard" },
      { q: "สรุปข้อมูลอุตุนิยมวิทยาทางทะเลครบถ้วนสำหรับนักเดินเรือ", difficulty: "very_hard" },
    ],
  },
];

// ─── Result record ─────────────────────────────────────────────────────────
interface MatrixResult {
  group: string;
  name: string;
  endpointGroup: string;
  tier: string;
  difficulty: string;
  question: string;
  expectedRoute: string;
  expectedTools: string[];
  actualRoute: string;
  actualTools: string[];
  status: number;
  answerSnippet: string;
  pass: boolean;
  failReason: string;
  notReachable: boolean;
  notReachableReason: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const stamp = nowStamp();
  const logFile = path.join(EVIDENCE_DIR, `phase110-tmd-nwp-chat-matrix-${stamp}.log`);
  const lines: string[] = [];

  const log = (s: string) => { lines.push(s); process.stdout.write(s + "\n"); };

  log(`═══════════════════════════════════════════════════════════`);
  log(`  Phase 11.0 — TMD/NWP Chat Coverage Matrix`);
  log(`  Mode: ${INNOMCP_MODE} | Port: ${CHAT_PORT} | Stamp: ${stamp}`);
  log(`═══════════════════════════════════════════════════════════`);

  const results: MatrixResult[] = [];
  let passed = 0, failed = 0, notReachable = 0;

  for (const group of MATRIX) {
    log(`\n──── ${group.id} (${group.tier}) ────`);
    log(`  Name: ${group.name}`);
    log(`  Endpoint: ${group.endpointGroup}`);

    if (!group.chatReachable) {
      notReachable += group.cases.length;
      for (const c of group.cases) {
        results.push({
          group: group.id,
          name: group.name,
          endpointGroup: group.endpointGroup,
          tier: group.tier,
          difficulty: c.difficulty,
          question: c.q,
          expectedRoute: group.expectedRoute,
          expectedTools: group.expectedTools,
          actualRoute: "NOT_REACHABLE",
          actualTools: [],
          status: 0,
          answerSnippet: "",
          pass: false,
          failReason: group.notReachableReason || "Not wired from chat",
          notReachable: true,
          notReachableReason: group.notReachableReason || "Not wired from chat",
        });
        log(`  [NOT_REACHABLE] ${c.difficulty}: ${c.q}`);
        log(`    Reason: ${group.notReachableReason || "Not wired from chat"}`);
      }
      continue;
    }

    for (const c of group.cases) {
      let resp: ChatResp;
      try {
        resp = await chatPost(c.q);
      } catch (err: any) {
        const rec: MatrixResult = {
          group: group.id,
          name: group.name,
          endpointGroup: group.endpointGroup,
          tier: group.tier,
          difficulty: c.difficulty,
          question: c.q,
          expectedRoute: group.expectedRoute,
          expectedTools: group.expectedTools,
          actualRoute: "ERROR",
          actualTools: [],
          status: 0,
          answerSnippet: "",
          pass: false,
          failReason: `HTTP error: ${err.message}`,
          notReachable: false,
          notReachableReason: "",
        };
        results.push(rec);
        failed++;
        log(`  [FAIL-ERR] ${c.difficulty}: ${c.q.slice(0, 60)}`);
        log(`    Error: ${err.message}`);
        continue;
      }

      // Pass criteria:
      //   1. status 200
      //   2. answer non-empty
      //   3. either route matches OR tools include at least one expected tool
      const routeOk = resp.route.toLowerCase().includes(group.expectedRoute.toLowerCase())
        || group.expectedRoute === "" || group.expectedRoute === "any";
      const toolsOk = group.expectedTools.length === 0
        || group.expectedTools.some(t =>
            resp.toolsUsed.some(u => u.toLowerCase().includes(t.toLowerCase()))
          );
      const answerOk = resp.text.length > 5;

      const pass = resp.status === 200 && answerOk && (routeOk || toolsOk);
      const failReasons: string[] = [];
      if (resp.status !== 200) failReasons.push(`status=${resp.status}`);
      if (!answerOk) failReasons.push("empty answer");
      if (!routeOk && !toolsOk && group.expectedTools.length > 0) failReasons.push(`route=${resp.route} tools=${JSON.stringify(resp.toolsUsed)}`);

      if (pass) passed++;
      else failed++;

      const rec: MatrixResult = {
        group: group.id,
        name: group.name,
        endpointGroup: group.endpointGroup,
        tier: group.tier,
        difficulty: c.difficulty,
        question: c.q,
        expectedRoute: group.expectedRoute,
        expectedTools: group.expectedTools,
        actualRoute: resp.route,
        actualTools: resp.toolsUsed,
        status: resp.status,
        answerSnippet: resp.text.slice(0, 120),
        pass,
        failReason: failReasons.join("; "),
        notReachable: false,
        notReachableReason: "",
      };
      results.push(rec);

      const icon = pass ? "✅" : "❌";
      log(`  [${icon}] ${c.difficulty}: ${c.q.slice(0, 60)}`);
      log(`     route=${resp.route} tools=${JSON.stringify(resp.toolsUsed)}`);
      log(`     answer: "${resp.text.slice(0, 100)}"`);
      if (failReasons.length) log(`     FAIL: ${failReasons.join("; ")}`);
    }
  }

  // ─── Summary table ──────────────────────────────────────────────────────
  log(`\n${"═".repeat(57)}`);
  log(`  SUMMARY`);
  log(`${"═".repeat(57)}`);
  log(`  Total questions : ${results.length}`);
  log(`  Passed          : ${passed}`);
  log(`  Failed          : ${failed}`);
  log(`  Not reachable   : ${notReachable}`);
  log(`  Pass rate       : ${results.length > 0 ? ((passed / (passed + failed + notReachable)) * 100).toFixed(1) : "N/A"}%`);

  // Per-group summary
  log(`\n  Per-group breakdown:`);
  for (const group of MATRIX) {
    const groupResults = results.filter(r => r.group === group.id);
    const gPass = groupResults.filter(r => r.pass).length;
    const gNR = groupResults.filter(r => r.notReachable).length;
    const gTotal = groupResults.length;
    const status = gNR > 0 ? "NOT_REACHABLE" : gPass === gTotal ? "ALL_PASS" : `${gPass}/${gTotal}`;
    log(`  ${group.id.padEnd(35)} ${status}`);
  }

  // ─── Write JSON matrix ──────────────────────────────────────────────────
  const jsonFile = path.join(EVIDENCE_DIR, `phase110-tmd-nwp-chat-matrix-${stamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify({ stamp, summary: { total: results.length, passed, failed, notReachable }, results }, null, 2), "utf8");

  fs.writeFileSync(logFile, lines.join("\n") + "\n", "utf8");
  log(`\nevidence log: ${logFile}`);
  log(`evidence json: ${jsonFile}`);

  const finalResult = failed === 0 ? "PASS ✅" : `FAIL ❌ (${failed} failures, ${notReachable} not reachable)`;
  log(`\nFINAL: ${finalResult}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
