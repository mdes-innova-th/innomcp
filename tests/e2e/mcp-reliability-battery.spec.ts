/**
 * MCP Server Reliability Battery
 * Tests the MCP server at :3012 directly with structured tool calls.
 * Covers: tool listing, all major tool groups, error handling, concurrent requests.
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

test.describe("DateTime Tool", () => {
  test("dateTimeTool returns current date/time", async () => {
    const res = await callTool("dateTimeTool", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    console.log(`DateTime: ${text.slice(0, 100)}`);
  });
});

// ============ GROUP 3: Calculator Tool ============

test.describe("Calculator Tool", () => {
  test("calculatorTool: basic addition", async () => {
    const res = await callTool("calculatorTool", { expression: "2+3" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("5");
  });

  test("calculatorTool: complex expression", async () => {
    const res = await callTool("calculatorTool", { expression: "sqrt(144)" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("12");
  });

  test("calculatorTool: trigonometry", async () => {
    const res = await callTool("calculatorTool", { expression: "sin(0)" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("0");
  });
});

// ============ GROUP 4: Thai Geo Tool ============

test.describe("Thai Geo Tool", () => {
  test("thaiGeoTool: province lookup", async () => {
    const res = await callTool("thai_geo_tool", { query: "เชียงใหม่" });
    const text = res.result?.content?.[0]?.text || "";
    expect(text).toContain("เชียงใหม่");
    const data = JSON.parse(text);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].attributes.lat).toBeDefined();
  });

  test("thaiGeoTool: with region filter", async () => {
    const res = await callTool("thai_geo_tool", { query: "เชียงใหม่", filter_region: "เหนือ" });
    const text = res.result?.content?.[0]?.text || "";
    const data = JSON.parse(text);
    expect(data.success).toBe(true);
  });

  test("thaiGeoTool: not found query returns error", async () => {
    const res = await callTool("thai_geo_tool", { query: "xyznotaplace" });
    const text = res.result?.content?.[0]?.text || res.error?.message || "";
    // Accept either structured JSON error or text error message
    const isError = text.includes("NOT_FOUND") || text.includes("ไม่พบ") || text.includes("error") || text.includes("not found");
    expect(isError).toBe(true);
  });
});

// ============ GROUP 5: Weather Tools (TMD) ============

test.describe("Weather Tools", () => {
  test("tmd_weather_forecast_7days_by_province", async () => {
    const res = await callTool("tmd_weather_forecast_7days_by_province", { province: "กรุงเทพมหานคร" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
    console.log(`TMD 7day: ${text.slice(0, 120)}`);
  });

  test("tmd_daily_forecast_4_times", async () => {
    const res = await callTool("tmd_daily_forecast_4_times", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
  });
});

// ============ GROUP 6: NWP Tools ============

test.describe("NWP Tools", () => {
  test("nwp_hourly_by_place", async () => {
    const res = await callTool("nwp_hourly_by_place", { place: "กรุงเทพมหานคร" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(10);
    console.log(`NWP hourly: ${text.slice(0, 120)}`);
  });

  test("nwp_daily_by_place", async () => {
    const res = await callTool("nwp_daily_by_place", { place: "เชียงใหม่" });
    expect(res.result).toBeDefined();
  });
});

// ============ GROUP 7: Seismic Tool ============

test.describe("Seismic Tool", () => {
  test("tmd_seismic_daily_events", async () => {
    const res = await callTool("tmd_seismic_daily_events", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    console.log(`Seismic: ${text.slice(0, 120)}`);
  });
});

// ============ GROUP 8: WorldBank Tool ============

test.describe("WorldBank Tool", () => {
  test("worldBankTool: GDP query", async () => {
    const res = await callTool("worldbank", { country: "TH", indicator: "NY.GDP.MKTP.CD", year: "2022" });
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    console.log(`WorldBank: ${text.slice(0, 120)}`);
  });
});

// ============ GROUP 9: NASA Tool ============

test.describe("NASA Tool", () => {
  test("nasaApodTool: astronomy picture of the day", async () => {
    const res = await callTool("nasa", {});
    expect(res.result).toBeDefined();
    const text = res.result?.content?.[0]?.text || "";
    expect(text.length).toBeGreaterThan(5);
    console.log(`NASA: ${text.slice(0, 120)}`);
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
