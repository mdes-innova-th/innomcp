/*
Phase W1: Weather Accuracy Recovery
- Zero network regression shield
- PASS exit 0, FAIL exit 1
*/

import { WeatherPipeline } from "../src/utils/weather/weatherPipeline";
import { renderWeatherContractAnswer } from "../src/utils/weather/answerContract";
import type { WeatherResult } from "../src/utils/weather/types";
import fs from "fs";
import path from "path";

type Wrapped =
  | { ok: true; result: WeatherResult[] }
  | { ok: false; code: string; message: string };

function wrapWeatherResults(weatherResults: any): Wrapped {
  const anySuccess = Array.isArray(weatherResults) && weatherResults.some((r: any) => r && r.type && r.type !== "error");
  if (anySuccess) return { ok: true, result: weatherResults as WeatherResult[] };

  const rawErr = String(weatherResults?.[0]?.error || "WEATHER_PIPELINE_ERROR");
  const code = (() => {
    if (rawErr === "PROVINCE_MISSING") return "PROVINCE_MISSING";
    if (rawErr === "TIMEOUT" || rawErr === "BUDGET_EXCEEDED") return "TIMEOUT";
    if (
      rawErr === "STATION_NOT_FOUND" ||
      rawErr === "PROVINCE_NOT_FOUND_IN_FORECAST" ||
      rawErr === "DATA_UNAVAILABLE" ||
      rawErr === "STATION_SKIPPED"
    ) {
      return "NO_DATA";
    }
    return "UPSTREAM_ERROR";
  })();

  const message = (() => {
    switch (code) {
      case "PROVINCE_MISSING":
        return "กรุณาระบุจังหวัด/พื้นที่ที่ต้องการ (เช่น \"พรุ่งนี้เชียงใหม่ฝนตกไหม\")";
      case "TIMEOUT":
        return "ขออภัย ระบบดึงข้อมูลอากาศไม่ทันเวลา กรุณาลองใหม่อีกครั้ง";
      case "NO_DATA":
        return "ขออภัย ยังไม่มีข้อมูลอากาศสำหรับพื้นที่นี้ในขณะนี้";
      case "UPSTREAM_ERROR":
      default:
        return "ขออภัย ระบบดึงข้อมูลอากาศขัดข้อง กรุณาลองใหม่อีกครั้ง";
    }
  })();

  return { ok: false, code, message };
}

function assert(cond: any, msg: string): void {
  if (!cond) throw new Error(msg);
}

function hasUpdateTime(text: string): boolean {
  return /เวลาอัปเดตข้อมูล\s*:/i.test(text);
}

function looksLikeJson(text: string): boolean {
  const t = String(text || "").trim();
  return t.startsWith("{") || t.startsWith("[");
}

async function run() {
  // Ensure fixture priming happens (WeatherPipeline constructor checks this env)
  process.env.WEATHER_FIXTURE_W1 = "1";

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const outFile = path.join(evidenceDir, `phaseW1-weather-verify-accuracy-v1-${stamp}.out.log`);

  // Fake MCP client: if cache misses, this will throw and fail (ensures zero-network)
  const fakeClient = {
    callTool: async () => {
      throw new Error("UNEXPECTED_TOOL_CALL (cache miss)");
    },
  };

  const clients = new Map<string, any>([["innomcp-server", fakeClient]]);
  const pipeline = new WeatherPipeline(clients);

  const cases: Array<{
    name: string;
    q: string;
    expectOk: boolean;
    expectIncludes?: string[];
    expectNotIncludes?: string[];
    expectModeNowStation?: boolean;
    expectTodaySegments?: boolean;
  }> = [
    {
      name: "now_bkk",
      q: "ตอนนี้ กทม ฝนตกไหม",
      expectOk: true,
      expectIncludes: ["กรุงเทพมหานคร", "โอกาสฝน", "อุณหภูมิ", "ลม", "เวลาอัปเดตข้อมูล"],
      expectModeNowStation: true,
    },
    {
      name: "now_bkk_variant",
      q: "ตอนนี้ที่กรุงเทพฯ ฝนตกไหม",
      expectOk: true,
      expectIncludes: ["กรุงเทพมหานคร", "เวลาอัปเดตข้อมูล"],
      expectModeNowStation: true,
    },
    {
      name: "today_rain_segments",
      q: "วันนี้ กทม ฝนจะตกช่วงไหน",
      expectOk: true,
      expectIncludes: ["กรุงเทพมหานคร", "ช่วงเช้า", "ช่วงบ่าย", "ช่วงเย็น", "เวลาอัปเดตข้อมูล"],
      expectTodaySegments: true,
    },
    {
      name: "tomorrow_chiangrai",
      q: "พรุ่งนี้ เชียงราย ฝนตกไหม",
      expectOk: true,
      expectIncludes: ["เชียงราย", "โอกาสฝน", "เวลาอัปเดตข้อมูล"],
    },
    {
      name: "in2days_arabic",
      q: "อีก 2 วัน เชียงราย ฝนตกไหม",
      expectOk: true,
      expectIncludes: ["เชียงราย", "โอกาสฝน", "เวลาอัปเดตข้อมูล"],
    },
    {
      name: "in2days_thai_digits",
      q: "อีก ๒ วัน เชียงราย ฝนตกไหม",
      expectOk: true,
      expectIncludes: ["เชียงราย", "โอกาสฝน", "เวลาอัปเดตข้อมูล"],
    },
    {
      name: "multi_province",
      q: "พรุ่งนี้ กทม กับ เชียงราย ฝนตกไหม",
      expectOk: true,
      expectIncludes: ["กรุงเทพมหานคร", "เชียงราย", "เวลาอัปเดตข้อมูล"],
    },
    {
      name: "province_missing",
      q: "วันนี้ฝนตกไหม",
      expectOk: false,
      expectIncludes: ["กรุณาระบุจังหวัด"],
    },
    {
      name: "fake_province",
      q: "พรุ่งนี้ เมืองสมมติ ฝนตกไหม",
      expectOk: false,
      expectIncludes: ["กรุณาระบุจังหวัด"],
    },
    {
      name: "abbr_bkk",
      q: "ขณะนี้ กทม อากาศเป็นไง",
      expectOk: true,
      expectIncludes: ["กรุงเทพมหานคร", "เวลาอัปเดตข้อมูล"],
      expectModeNowStation: true,
    },
  ];

  const failures: string[] = [];

  for (const c of cases) {
    try {
      const target = pipeline.resolveTarget(c.q);
      const results = await pipeline.execute(target);
      const wrapped = wrapWeatherResults(results);

      if (!c.expectOk) {
        assert(wrapped.ok === false, `${c.name}: expected ok=false`);
        const msg = wrapped.ok === false ? wrapped.message : "";
        assert(typeof msg === "string" && msg.length > 0, `${c.name}: missing error message`);
        if (c.expectIncludes) {
          for (const s of c.expectIncludes) assert(msg.includes(s), `${c.name}: missing '${s}' in error msg`);
        }
        continue;
      }

      assert(wrapped.ok === true, `${c.name}: expected ok=true`);
      const rendered = renderWeatherContractAnswer(c.q, wrapped.ok ? wrapped.result : []);
      const text = rendered.text || "";

      assert(!looksLikeJson(text), `${c.name}: output must not be JSON`);
      assert(hasUpdateTime(text), `${c.name}: missing update time`);

      if (c.expectIncludes) {
        for (const s of c.expectIncludes) {
          assert(text.includes(s), `${c.name}: missing '${s}' in output`);
        }
      }
      if (c.expectNotIncludes) {
        for (const s of c.expectNotIncludes) {
          assert(!text.includes(s), `${c.name}: should not include '${s}'`);
        }
      }

      if (c.expectModeNowStation) {
        if (!wrapped.ok) {
          throw new Error(`${c.name}: expected ok=true before station check`);
        }
        const hasStation = wrapped.result.some((r: WeatherResult) => r.type === "station3h");
        assert(hasStation, `${c.name}: expected station3h result for NOW mode`);
      }

      if (c.expectTodaySegments) {
        assert(/ช่วงเช้า/.test(text) && /ช่วงบ่าย/.test(text) && /ช่วงเย็น/.test(text), `${c.name}: missing today segments`);
      }

    } catch (e: any) {
      failures.push(`${c.name}: ${String(e?.message || e)}`);
    }
  }

  if (failures.length > 0) {
    const header = `[verify_weather_accuracy_v1] FAIL (${failures.length})`;
    console.error(header);
    for (const f of failures) console.error(`- ${f}`);
    fs.writeFileSync(outFile, [header, ...failures.map((f) => `- ${f}`)].join("\n") + "\n", "utf8");
    process.exit(1);
  }

  const okLine = `[verify_weather_accuracy_v1] PASS (${cases.length})`;
  console.log(okLine);
  fs.writeFileSync(outFile, okLine + "\n", "utf8");
  process.exit(0);
}

run().catch((e) => {
  console.error("[verify_weather_accuracy_v1] UNCAUGHT", e);
  process.exit(1);
});
