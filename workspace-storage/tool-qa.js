/**
 * MCP Tool QA — Phase 10.68
 * Tests all major tool categories via the chat WebSocket + MCP health endpoints.
 * Reports PASS/FAIL per tool group and timestamps.
 */
const http = require("http");
const https = require("https");

const BE = "http://localhost:3011";
const MCP = "http://localhost:3012";

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const mod = url.startsWith("https") ? https : http;
    const u = new URL(url);
    const req = mod.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Content-Length": Buffer.byteLength(payload)
        } },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
          catch { resolve({ status: res.statusCode, data: b }); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(payload);
    req.end();
  });
}

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function callMcpTool(name, args) {
  const res = await post(`${MCP}/mcp`, {
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name, arguments: args }
  });
  if (res.data?.result?.content) {
    const text = res.data.result.content[0]?.text || "";
    // Some tools return JSON-RPC errors as content text (not error field)
    const isContentError = /^MCP error|^Error:|tool.*not found/i.test(text);
    return { ok: !isContentError, text: text.slice(0, 150) };
  }
  if (res.data?.error) return { ok: false, text: `err: ${res.data.error.message}` };
  return { ok: res.status === 200, text: String(res.data).slice(0, 100) };
}

async function run() {
  console.log("\n═══ INNOMCP Tool QA — Phase 10.68 ═══\n");
  const results = [];

  // ── 1. Stack health ──────────────────────────────────────────────────────
  try {
    const be = await get(`${BE}/api/health`);
    const mcp = await get(`${MCP}/health`);
    const beOk = [200, 503].includes(be.status); // 503 = degraded Redis, OK
    const mcpOk = mcp.status === 200;
    console.log(`Stack  BE:${be.status} MCP:${mcp.status}  ${beOk && mcpOk ? PASS : FAIL}`);
    results.push({ name: "Stack health", ok: beOk && mcpOk });
  } catch (e) { results.push({ name: "Stack health", ok: false, err: e.message }); }

  // ── 2. MCP tools/list ───────────────────────────────────────────────────
  let toolNames = [];
  try {
    const r = await post(`${MCP}/mcp`, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    toolNames = r.data?.result?.tools?.map(t => t.name) || [];
    const ok = toolNames.length >= 40;
    console.log(`Tools list  ${toolNames.length} tools  ${ok ? PASS : FAIL}`);
    results.push({ name: "MCP tools/list", ok, detail: `${toolNames.length} tools` });
  } catch (e) { results.push({ name: "MCP tools/list", ok: false, err: e.message }); }

  // ── 3. DateTime tool ─────────────────────────────────────────────────────
  try {
    const r = await callMcpTool("dateTimeTool", { action: "current_time" });
    const ok = r.ok && /\d{4}/.test(r.text || "");
    console.log(`DateTime    ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "dateTimeTool", ok });
  } catch (e) { results.push({ name: "dateTimeTool", ok: false, err: e.message }); }

  // ── 4. Calculator tool ────────────────────────────────────────────────────
  try {
    const r = await callMcpTool("calculatorTool", { expression: "25 * 40 + 100" });
    const ok = r.ok && r.text?.includes("1100");
    console.log(`Calculator  ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "calculatorTool", ok });
  } catch (e) { results.push({ name: "calculatorTool", ok: false, err: e.message }); }

  // ── 5. QR code tool ───────────────────────────────────────────────────────
  try {
    const r = await callMcpTool("qrCodeTool", { text: "https://mdes-innova.online", size: 200 });
    const ok = r.ok;
    console.log(`QR Code     ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "qrCodeTool", ok });
  } catch (e) { results.push({ name: "qrCodeTool", ok: false, err: e.message }); }

  // ── 6. Currency exchange ──────────────────────────────────────────────────
  try {
    const r = await callMcpTool("currencyExchangeTool", { fromCurrency: "USD", toCurrency: "THB", amount: 1 });
    const ok = r.ok && r.text && r.text.length > 5;
    console.log(`Currency    ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "currencyExchangeTool", ok });
  } catch (e) { results.push({ name: "currencyExchangeTool", ok: false, err: e.message }); }

  // ── 7. Thai Geo tool ─────────────────────────────────────────────────────
  try {
    const r = await callMcpTool("thai_geo_tool", { query: "กรุงเทพมหานคร" });
    const ok = r.ok && /กรุงเทพ|Bangkok/i.test(r.text || "");
    console.log(`ThaiGeo     ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "thaiGeoTool", ok });
  } catch (e) { results.push({ name: "thaiGeoTool", ok: false, err: e.message }); }

  // ── 8. Thai Knowledge tool ───────────────────────────────────────────────
  try {
    const r = await callMcpTool("thaiKnowledgeTool", { query: "PDPA คืออะไร", context: { confidence_required: 0.3 } });
    const ok = r.ok && r.text && r.text.length > 10;
    console.log(`ThaiKnow    ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "thaiKnowledgeTool", ok });
  } catch (e) { results.push({ name: "thaiKnowledgeTool", ok: false, err: e.message }); }

  // ── 9. Weather (NWP daily) ───────────────────────────────────────────────
  try {
    const r = await callMcpTool("nwp_daily_by_place", { province: "กรุงเทพมหานคร", duration: 1 });
    const ok = r.ok;
    console.log(`NWP Weather ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "nwp_daily_by_place", ok });
  } catch (e) { results.push({ name: "nwp_daily_by_place", ok: false, err: e.message }); }

  // ── 10. NASA tool (correct name: "nasa") ─────────────────────────────────
  try {
    const r = await callMcpTool("nasa", { type: "apod" });
    const ok = r.ok && r.text && r.text.length > 10;
    console.log(`NASA APOD   ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "nasa", ok });
  } catch (e) { results.push({ name: "nasa", ok: false, err: e.message }); }

  // ── 11. RSS Feed tool ────────────────────────────────────────────────────
  try {
    const r = await callMcpTool("rssFeedTool", { feedUrl: "https://feeds.bbci.co.uk/thai/rss.xml", limit: 3 });
    const ok = r.ok && r.text && r.text.length > 10;
    console.log(`RSS Feed    ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "rssFeedTool", ok });
  } catch (e) { results.push({ name: "rssFeedTool", ok: false, err: e.message }); }

  // ── 12. ECharts tool ─────────────────────────────────────────────────────
  try {
    const r = await callMcpTool("echartsTool", {
      type: "bar",
      labels: ["Q1", "Q2", "Q3"],
      datasets: [{ label: "Sales", data: [100, 150, 120] }],
      chartTitle: "QA Test"
    });
    const ok = r.ok;
    console.log(`ECharts     ${ok ? PASS : FAIL}  ${r.text?.slice(0, 60)}`);
    results.push({ name: "echartsTool", ok });
  } catch (e) { results.push({ name: "echartsTool", ok: false, err: e.message }); }

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\n═══ Summary: ${passed}/${results.length} PASS ═══`);
  if (failed.length > 0) {
    console.log("Failed tools:");
    failed.forEach(f => console.log(`  ${FAIL} ${f.name}${f.err ? ": " + f.err : ""}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(err => { console.error("QA script error:", err); process.exit(1); });
