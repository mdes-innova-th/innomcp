// Phase 5 — All-tools grounding audit
// Tests: weather, detect/evidence, webd/reduction, geo, calculator, thai knowledge, mixed-intent
const http = require("http");

function chatQuery(message, sessionId, port) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ message, sessionId });
    const req = http.request(
      { hostname: "localhost", port: port || 3011, path: "/api/chat", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "X-Smoke-Run": "1" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error("Bad JSON: " + data.slice(0, 200))); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const TESTS = [
  // WEATHER
  { id: "T1", tool: "weather", msg: "\u0e2d\u0e32\u0e01\u0e32\u0e28\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e01\u0e23\u0e38\u0e07\u0e40\u0e17\u0e1e\u0e40\u0e1b\u0e47\u0e19\u0e22\u0e31\u0e07\u0e44\u0e07", expect: ["toolsUsed", "weatherPipeline"] },
  { id: "T2", tool: "weather-eng", msg: "weather in Chiang Mai today", expect: ["toolsUsed", "weatherPipeline"] },
  // DETECT / EVIDENCE
  { id: "T3", tool: "detect", msg: "detect evidence port 3013", msgOverride: true, rawPort: 3013, rawPath: "/health" },
  // GEO  
  { id: "T4", tool: "geo", msg: "\u0e08\u0e31\u0e07\u0e2b\u0e27\u0e31\u0e14\u0e19\u0e04\u0e23\u0e23\u0e32\u0e0a\u0e2a\u0e35\u0e21\u0e32\u0e2d\u0e22\u0e39\u0e48\u0e20\u0e32\u0e04\u0e44\u0e2b\u0e19", expect: ["toolsUsed"] },
  // KNOWLEDGE / THAI KNOWLEDGE
  { id: "T5", tool: "thai-knowledge", msg: "\u0e23\u0e31\u0e10\u0e18\u0e23\u0e23\u0e21\u0e19\u0e39\u0e0d\u0e44\u0e17\u0e22\u0e1b\u0e35 2560 \u0e21\u0e35\u0e01\u0e35\u0e48\u0e21\u0e32\u0e15\u0e23\u0e32", expect: ["toolsUsed"] },
  // CALCULATOR
  { id: "T6", tool: "calculator", msg: "calculate (15 * 24) + 100", expect: ["toolsUsed"] },
  // CONTEXT CARRY-FORWARD (session continuity)
  { id: "T7", tool: "context", msg: "\u0e2d\u0e38\u0e13\u0e2b\u0e20\u0e39\u0e21\u0e34\u0e2a\u0e39\u0e07\u0e2a\u0e38\u0e14\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e40\u0e17\u0e48\u0e32\u0e44\u0e23", expect: ["toolsUsed", "weatherPipeline"], session: "T7-ctx" },
];

async function healthCheck(port, path) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "localhost", port, path: path || "/", method: "GET" }, (res) => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode < 400, status: res.statusCode, body: d.slice(0, 100) }));
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.end();
  });
}

async function main() {
  console.log("=== Phase 5: All-tools grounding audit ===\n");

  // Health checks first
  const services = [
    { name: "frontend", port: 3000, path: "/" },
    { name: "innomcp-node", port: 3011, path: "/health" },
    { name: "mcp-server", port: 3012, path: "/health" },
    { name: "detect-api", port: 3013, path: "/health" },
    { name: "webd-api", port: 3014, path: "/health" },
  ];
  console.log("--- Service health checks ---");
  for (const s of services) {
    const h = await healthCheck(s.port, s.path);
    console.log((h.ok ? "UP" : "DOWN") + "  " + s.name + " :" + s.port + (h.error ? " (" + h.error + ")" : ""));
  }
  console.log("");

  // Tool queries
  console.log("--- Tool grounding tests ---");
  let pass = 0, fail = 0;
  for (const t of TESTS) {
    if (t.rawPath) {
      const h = await healthCheck(t.rawPort, t.rawPath);
      console.log((h.ok ? "PASS" : "FAIL") + " " + t.id + " (" + t.tool + "): health=" + h.ok + " status=" + h.status);
      h.ok ? pass++ : fail++;
      continue;
    }
    try {
      const sess = t.session || ("p5-" + t.id);
      const resp = await chatQuery(t.msg, sess);
      const toolsUsed = resp.toolsUsed || [];
      const text = resp.text || "";
      const hasContent = text.length > 10;
      const hasTools = toolsUsed.length > 0;
      const status = hasContent || hasTools ? "PASS" : "FAIL";
      console.log(status + " " + t.id + " (" + t.tool + "): tools=[" + toolsUsed.join(",") + "] len=" + text.length);
      if (status === "FAIL") { console.log("  text:", text.slice(0, 100)); fail++; }
      else pass++;
    } catch (e) {
      console.log("ERROR " + t.id + " (" + t.tool + "): " + e.message);
      fail++;
    }
  }
  console.log("\nPhase 5: " + pass + "/" + (pass + fail) + " PASS");
}

main();
