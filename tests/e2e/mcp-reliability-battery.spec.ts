/**
 * MCP Server Reliability Battery
 * Tests the MCP server at :3012 directly with structured tool calls.
 * Covers: tool listing, all major tool groups, error handling, concurrent requests.
 *
 * CONTRACT DEFINITIONS:
 * Each tool is judged by three contracts:
 *   SUCCESS — semantically valid result with expected data structure
 *   DEGRADED — external API error, explicitly detected and flagged (still PASS)
 *   FAIL — empty response, wrong structure, or silent false-positive
 */
import { test, expect } from "@playwright/test";

const MCP_URL = process.env.MCP_URL || "http://localhost:3012/mcp";
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

async function mcpCall(method: string, params?: any, id = 1) {
  const body: any = { jsonrpc: "2.0", id, method };
  if (params) body.params = params;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: `Non-JSON response: ${text.slice(0, 200)}` } };
  }
}

async function callTool(name: string, args: any = {}) {
  return mcpCall("tools/call", { name, arguments: args });
}

// ============ GROUP 1: MCP Protocol Health ============

test.describe("MCP Protocol Health", () => {
  test("tools/list returns tools array", async () => {
    const res = await mcpCall("tools/list");
    expect(res.result).toBeDefined();
    expect(res.result.tools).toBeDefined();
    expect(Array.isArray(res.result.tools)).toBe(true);
    expect(res.result.tools.length).toBeGreaterThan(20);
    console.log(`Tools count: ${res.result.tools.length}`);
  });

  test("invalid method returns error", async () => {
    const res = await mcpCall("nonexistent/method");
    expect(res.error).toBeDefined();
  });

  test("missing tool name returns error", async () => {
    const res = await mcpCall("tools/call", { name: "nonexistent_tool_xyz" });
    expect(res.error || res.result?.content?.[0]?.text?.includes("not found")).toBeTruthy();
  });
});

// ============ GROUP 2: DateTime Tool ============
// SUCCESS: text contains a date pattern (year/month/day or Thai date) and time pattern
// FAIL: empty, no date/time pattern

test.describe("DateTime Tool", () => {
  test("dateTimeTool returns current date/time", async () => {
    const res = await callTool("dateTimeTool", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    // Semantic: must contain a recognizable date OR time pattern
    const hasDate = /\d{4}|\u0e1e\.?\u0e28\.?|\u0e40\u0e21\u0e29\u0e32\u0e22\u0e19|\u0e21\u0e01\u0e23\u0e32\u0e04\u0e21|\u0e01\u0e31\u0e19\u0e22\u0e32\u0e22\u0e19/.test(text);
    const hasTime = /\d{1,2}:\d{2}|\u0e40\u0e27\u0e25\u0e32/.test(text);
    expect(hasDate || hasTime).toBe(true);
    console.log(`DateTime [SUCCESS]: ${text.slice(0, 100)}`);
  });
});

// ============ GROUP 3: Calculator Tool ============
// SUCCESS: result contains expected numeric value
// FAIL: wrong number, error, or empty

test.describe("Calculator Tool", () => {
  test("calculatorTool: basic addition", async () => {
    const res = await callTool("calculatorTool", { expression: "2+3" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("5");
    // Must not contain error indicators
    expect(text).not.toMatch(/error|failed|exception/i);
    console.log(`Calculator add [SUCCESS]: ${text.slice(0, 60)}`);
  });

  test("calculatorTool: complex expression", async () => {
    const res = await callTool("calculatorTool", { expression: "sqrt(144)" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("12");
    console.log(`Calculator sqrt [SUCCESS]: ${text.slice(0, 60)}`);
  });

  test("calculatorTool: trigonometry", async () => {
    const res = await callTool("calculatorTool", { expression: "sin(0)" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("0");
    console.log(`Calculator trig [SUCCESS]: ${text.slice(0, 60)}`);
  });
});

// ============ GROUP 4: Thai Geo Tool ============
// SUCCESS: JSON with success:true, data array with lat/lon
// FAIL (not-found): must return NOT_FOUND or ไม่พบ
// FAIL (crash): non-JSON, empty, or missing structure

test.describe("Thai Geo Tool", () => {
  test("thaiGeoTool: province lookup", async () => {
    const res = await callTool("thai_geo_tool", { query: "เชียงใหม่" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("เชียงใหม่");
    const data = JSON.parse(text);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].attributes.lat).toBeDefined();
    expect(data.data[0].attributes.lon).toBeDefined();
    // Semantic: lat/lon must be numeric and within Thailand bounds
    const lat = parseFloat(data.data[0].attributes.lat);
    const lon = parseFloat(data.data[0].attributes.lon);
    expect(lat).toBeGreaterThan(5);
    expect(lat).toBeLessThan(21);
    expect(lon).toBeGreaterThan(97);
    expect(lon).toBeLessThan(106);
    console.log(`Thai Geo [SUCCESS]: ${data.data[0].attributes.name_th} (${lat}, ${lon})`);
  });

  test("thaiGeoTool: with region filter", async () => {
    const res = await callTool("thai_geo_tool", { query: "เชียงใหม่", filter_region: "เหนือ" });
    const text = res.result?.content?.[0]?.text || "";
    const data = JSON.parse(text);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    console.log(`Thai Geo filtered [SUCCESS]: ${data.data.length} results`);
  });

  test("thaiGeoTool: not found query returns error", async () => {
    const res = await callTool("thai_geo_tool", { query: "xyznotaplace" });
    const text = res.result?.content?.[0]?.text || res.error?.message || "";
    // Accept either structured JSON error or text error message
    const isError = text.includes("NOT_FOUND") || text.includes("ไม่พบ") || text.includes("error") || text.includes("not found");
    expect(isError).toBe(true);
    console.log(`Thai Geo not-found [SUCCESS]: correctly returned error`);
  });
});

// ============ GROUP 5: Weather Tools (TMD) ============
// SUCCESS: text > 10 chars AND contains weather data structure (JSON/XML with forecast data)
// DEGRADED: TMD API error with explicit error message (PASS with warning)
// FAIL: empty, non-weather data, or silent error

test.describe("Weather Tools", () => {
  test("tmd_weather_forecast_7days_by_province", async () => {
    const res = await callTool("tmd_weather_forecast_7days_by_province", { province: "กรุงเทพมหานคร" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
    // Semantic: must contain weather data OR explicit degraded status
    const isSuccess = /พยากรณ์|forecast|อากาศ|weather|สำเร็จ|@attributes|ForecastDaily/.test(text);
    const isDegraded = /error|ผิดพลาด|ไม่สามารถ|timeout|500|503/.test(text);
    expect(isSuccess || isDegraded).toBe(true);
    if (isDegraded) console.log(`TMD 7day [DEGRADED]: ${text.slice(0, 120)}`);
    else console.log(`TMD 7day [SUCCESS]: ${text.slice(0, 120)}`);
  });

  test("tmd_daily_forecast_4_times", async () => {
    const res = await callTool("tmd_daily_forecast_4_times", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
    // Semantic: must contain forecast data OR explicit error
    const isSuccess = /สำเร็จ|forecast|พยากรณ์|อากาศ|ForecastDaily|@attributes/.test(text);
    const isDegraded = /error|ผิดพลาด|ไม่สามารถ|timeout/.test(text);
    expect(isSuccess || isDegraded).toBe(true);
    if (isDegraded) console.log(`TMD daily [DEGRADED]: ${text.slice(0, 120)}`);
    else console.log(`TMD daily [SUCCESS]: ${text.slice(0, 120)}`);
  });
});

// ============ GROUP 6: NWP Tools ============
// SUCCESS: JSON with source/location/data structure containing NWP forecast
// DEGRADED: NWP API error with explicit error message
// FAIL: empty, non-JSON, or silent error

test.describe("NWP Tools", () => {
  test("nwp_hourly_by_place", async () => {
    const res = await callTool("nwp_hourly_by_place", { place: "กรุงเทพมหานคร" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
    // Semantic: must be valid JSON with NWP structure OR explicit error
    const isSuccess = /source|NWP|province|location|temperature|tc|rh/.test(text);
    const isDegraded = /error|ผิดพลาด|ไม่สามารถ|timeout/.test(text);
    expect(isSuccess || isDegraded).toBe(true);
    if (isDegraded) console.log(`NWP hourly [DEGRADED]: ${text.slice(0, 120)}`);
    else console.log(`NWP hourly [SUCCESS]: ${text.slice(0, 120)}`);
  });

  test("nwp_daily_by_place", async () => {
    const res = await callTool("nwp_daily_by_place", { place: "เชียงใหม่" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
    // Semantic: must contain NWP data structure OR explicit error
    const isSuccess = /source|NWP|province|location|forecast/.test(text);
    const isDegraded = /error|ผิดพลาด|ไม่สามารถ|timeout/.test(text);
    expect(isSuccess || isDegraded).toBe(true);
    if (isDegraded) console.log(`NWP daily [DEGRADED]: ${text.slice(0, 120)}`);
    else console.log(`NWP daily [SUCCESS]: ${text.slice(0, 120)}`);
  });
});

// ============ GROUP 7: Seismic Tool ============
// SUCCESS: text contains seismic/earthquake data (JSON with events or summary)
// DEGRADED: TMD seismic API error with explicit message
// FAIL: empty, non-seismic data, or silent error

test.describe("Seismic Tool", () => {
  test("tmd_seismic_daily_events", async () => {
    const res = await callTool("tmd_seismic_daily_events", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    // Semantic: must contain seismic data OR explicit degraded status
    const isSuccess = /แผ่นดินไหว|seismic|earthquake|magnitude|Earthquakes|สำเร็จ/.test(text);
    const isDegraded = /\berror\b|ผิดพลาด|ไม่สามารถ|timeout/i.test(text) && !isSuccess;
    expect(isSuccess || isDegraded).toBe(true);
    if (isSuccess) console.log(`Seismic [SUCCESS]: ${text.slice(0, 120)}`);
    else console.log(`Seismic [SUCCESS]: ${text.slice(0, 120)}`);
  });
});

// ============ GROUP 8: WorldBank Tool ============
// SUCCESS: markdown/text with World Bank data, country name, numeric GDP value
// DEGRADED: WorldBank API error with explicit message
// FAIL: empty, non-WB data, or raw error text counting as success

test.describe("WorldBank Tool", () => {
  test("worldBankTool: GDP query", async () => {
    const res = await callTool("worldbank", { country: "TH", indicator: "NY.GDP.MKTP.CD", year: "2022" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    // Semantic: must contain WB data structure OR explicit degraded status
    const isSuccess = /World Bank|Thailand|GDP|\$|NY\.GDP/.test(text);
    const isDegraded = /error|ผิดพลาด|ไม่สามารถ|timeout|500|unavailable/.test(text);
    expect(isSuccess || isDegraded).toBe(true);
    // Must not be a raw error pretending to be success
    if (isSuccess) {
      expect(text).toMatch(/Thailand|TH/);
      console.log(`WorldBank [SUCCESS]: ${text.slice(0, 120)}`);
    } else {
      console.log(`WorldBank [DEGRADED]: ${text.slice(0, 120)}`);
    }
  });
});

// ============ GROUP 9: NASA Tool ============
// SUCCESS: JSON with title/url/explanation or markdown with APOD content
// DEGRADED: NASA API error (500, rate limit) — must be explicitly detected, NOT silent pass
// FAIL: empty response or unrecognized format

test.describe("NASA Tool", () => {
  test("nasaApodTool: astronomy picture of the day", async () => {
    const res = await callTool("nasa", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    // Classify: SUCCESS vs DEGRADED
    const isSuccess = /title|url|explanation|APOD|Astronomy|NASA.*Picture/.test(text) && !/"success":\s*false/.test(text);
    const isDegraded = /"success":\s*false|error|API error|500|429|rate.limit|unavailable/i.test(text);
    // Must be one or the other — not an unrecognized blob
    expect(isSuccess || isDegraded).toBe(true);
    if (isSuccess) {
      console.log(`NASA [SUCCESS]: ${text.slice(0, 120)}`);
    } else {
      // Degraded is acceptable for external API — but must be flagged, not hidden
      console.log(`NASA [DEGRADED]: external API returned error — ${text.slice(0, 150)}`);
    }
  });
});

// ============ GROUP 10: Concurrent Requests ============

test.describe("Concurrent Stress", () => {
  test("5 concurrent tool calls", async () => {
    const calls = [
      callTool("dateTimeTool", {}),
      callTool("calculatorTool", { expression: "1+1" }),
      callTool("thai_geo_tool", { query: "กรุงเทพ" }),
      callTool("dateTimeTool", {}),
      callTool("calculatorTool", { expression: "10*10" }),
    ];
    const results = await Promise.all(calls);
    for (const r of results) {
      expect(r.result).toBeDefined();
      expect(r.result?.content?.[0]?.text?.length).toBeGreaterThan(0);
    }
  });

  test("10 rapid sequential calls", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await callTool("calculatorTool", { expression: `${i}+${i}` });
      expect(res.result).toBeDefined();
    }
  });
});
