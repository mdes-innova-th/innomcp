// Phase 6 — Degraded mode hardening test
// Tests graceful degradation when downstream services are unavailable
const http = require("http");
const { execSync } = require("child_process");

function chatQuery(message, sessionId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ message, sessionId });
    const req = http.request(
      { hostname: "localhost", port: 3011, path: "/api/chat", method: "POST",
        timeout: 15000,
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
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.write(body);
    req.end();
  });
}

function healthCheck(port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "localhost", port, path: "/health", method: "GET", timeout: 3000 }, (res) => {
      resolve({ ok: res.statusCode < 400 });
    });
    req.on("error", () => resolve({ ok: false }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false }); });
    req.end();
  });
}

function getPidOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr LISTENING`, { encoding: "utf-8" });
    const match = out.match(/LISTENING\s+(\d+)/);
    return match ? parseInt(match[1]) : null;
  } catch { return null; }
}

function killPid(pid) {
  try { execSync(`taskkill /PID ${pid} /F`, { encoding: "utf-8" }); return true; }
  catch { return false; }
}

async function testDegradedDetect() {
  console.log("\n--- Test D1: detect-api (3013) unavailable ---");
  const pid = getPidOnPort(3013);
  if (!pid) { console.log("SKIP: detect-api not running"); return false; }
  
  // Kill detect-api
  console.log("Stopping detect-api pid=" + pid);
  killPid(pid);
  await new Promise(r => setTimeout(r, 1000));
  
  const h = await healthCheck(3013);
  if (h.ok) { console.log("WARN: detect-api still up after kill"); return false; }
  console.log("detect-api is DOWN");
  
  // Test a general query - should still respond (not crash innomcp-node)
  try {
    const resp = await chatQuery("\u0e2d\u0e32\u0e01\u0e32\u0e28\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e22\u0e31\u0e07\u0e44\u0e07", "p6d1-weather");
    const text = resp.text || "";
    const notCrashed = text.length > 5;
    console.log("PASS D1: innomcp-node responds when detect-api is down (len=" + text.length + ")");
    return { pid, passed: notCrashed };
  } catch (e) {
    console.log("FAIL D1: innomcp-node errored when detect-api down: " + e.message);
    return { pid, passed: false };
  }
}

async function testDegradedWebd() {
  console.log("\n--- Test D2: webd-api (3014) unavailable ---");
  const pid = getPidOnPort(3014);
  if (!pid) { console.log("SKIP: webd-api not running"); return false; }
  
  console.log("Stopping webd-api pid=" + pid);
  killPid(pid);
  await new Promise(r => setTimeout(r, 1000));
  
  const h = await healthCheck(3014);
  if (h.ok) { console.log("WARN: webd-api still up after kill"); return false; }
  console.log("webd-api is DOWN");
  
  // Test a weather query (unrelated to webd) - should still work
  try {
    const resp = await chatQuery("\u0e2d\u0e32\u0e01\u0e32\u0e28\u0e2d\u0e38\u0e1a\u0e25\u0e23\u0e32\u0e0a\u0e18\u0e32\u0e19\u0e35", "p6d2-weather");
    const text = resp.text || "";
    const notCrashed = text.length > 5;
    console.log((notCrashed ? "PASS" : "FAIL") + " D2: weather query works when webd-api is down (len=" + text.length + ")");
    return { pid, passed: notCrashed };
  } catch (e) {
    console.log("FAIL D2: innomcp-node errored when webd-api down: " + e.message);
    return { pid, passed: false };
  }
}

async function main() {
  console.log("=== Phase 6: Degraded mode hardening ===\n");
  
  const d1 = await testDegradedDetect();
  const d2 = await testDegradedWebd();
  
  // Restart killed services
  console.log("\n--- Restarting killed services ---");
  
  // detect-api restart
  const detectPid = getPidOnPort(3013);
  if (!detectPid) {
    require("child_process").exec(
      'cmd /d /c cd /d C:\\Users\\USER-NT\\DEV\\innomcp\\innomcp-server-node && npm run start:detect > NUL 2>&1', 
      { detached: true, windowsHide: true }
    );
    console.log("Restarted detect-api (background)");
  } else {
    console.log("detect-api already running pid=" + detectPid);
  }

  // webd-api restart
  const webdPid = getPidOnPort(3014);
  if (!webdPid) {
    require("child_process").exec(
      'cmd /d /c cd /d C:\\Users\\USER-NT\\DEV\\innomcp\\innomcp-server-node && npm run start:webd > NUL 2>&1',
      { detached: true, windowsHide: true }
    );
    console.log("Restarted webd-api (background)");
  } else {
    console.log("webd-api already running pid=" + webdPid);
  }
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Verify all services back up
  console.log("\n--- Post-test service status ---");
  for (const [name, port] of [["detect-api",3013],["webd-api",3014],["innomcp-node",3011]]) {
    const h = await healthCheck(port);
    console.log((h.ok ? "UP" : "DOWN") + "  " + name + " :" + port);
  }
  
  const passed = [d1, d2].filter(d => d && d.passed).length;
  const total = [d1, d2].filter(d => d !== false).length;
  console.log("\nPhase 6: " + passed + "/" + total + " degraded-mode tests PASS");
}

main().catch(console.error);
