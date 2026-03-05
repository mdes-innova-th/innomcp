import http from "http";
import fs from "fs";
import path from "path";

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function assertOk(cond: any, msg: string, failures: string[]) {
  if (!cond) failures.push(msg);
}

function postJson(port: number, body: any): Promise<{ status: number; json: any; raw: string; ms: number }> {
  const payload = Buffer.from(JSON.stringify(body));
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: any = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, raw, ms: Date.now() - started });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function startEphemeralServer() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.CHAT_TRACE_QA = "1";
  process.env.LOG_DEBUG = "0";
  process.env.SERVER_HOST = "127.0.0.1";
  process.env.WEATHER_FIXTURE_W1 = "1";
  // We use real MCP and GodTierRouter since they are configured in the container loop

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
    server.on("error", reject);
  });

  const address = server.address() as any;
  return { server, port: address.port };
}

async function runTests() {
  const { server, port } = await startEphemeralServer();
  const failures: string[] = [];
  const logLines: string[] = [];
  const startMs = Date.now();
  let passed = 0;

  const runCase = async (name: string, body: any, check: (res: any) => void) => {
    try {
      const res = await postJson(port, body);
      check(res);
      passed++;
      logLines.push(`✅ [${name}] OK (${res.ms}ms)`);
    } catch (e: any) {
      failures.push(`[${name}] Crashed: ${e.message}`);
      logLines.push(`❌ [${name}] FAIL: ${e.message}`);
    }
  };

  logLines.push(`Starting Phase 10.2 Chat IQ Gate Verifier (${nowStamp()})`);
  logLines.push(`Server listening on port ${port}`);
  logLines.push("====================================");

  // 1. Weather Intent
  await runCase("1. intent=weather: happy path", { message: "อากาศกรุงเทพวันนี้เป็นไง" },
    (res) => {
      assertOk(res.status === 200, "status should be 200", failures);
      const sc = res.json?.structuredContent;
      assertOk(sc?.__render?.route === "weather", "route should be weather", failures);
      assertOk(res.json?.text?.includes("กรุงเทพมหานคร") || res.json?.text?.includes("กรุงเทพฯ"), "weather result missing expected province text", failures);
    }
  );

  // 2. Evidence Intent
  await runCase("2. intent=evidence: happy path", { message: "ขอดูหลักฐานสถิติของ 7 วันย้อนหลัง" },
    (res) => {
      assertOk(res.status === 200, "status should be 200", failures);
      // Even if DB is empty, structuredContent should exist
      assertOk(res.json?.structuredContent, "structuredContent missing", failures);
    }
  );

  // 3. Web-Record Intent
  await runCase("3. intent=web-record: happy path", { message: "ค้นหาบันทึกระบบเกี่ยวกับการประชุมล่าสุด" },
    (res) => {
      assertOk(res.status === 200, "status should be 200", failures);
      assertOk(res.json?.structuredContent?.recordsPayload || res.json?.text, "response missing", failures);
    }
  );

  // 4. General / IQ Gate
  await runCase("4. intent=unknown: Low Confidence Chat IQ Gate Fallback", { message: "sadsadwewqeq213dasd" },
    (res) => {
      assertOk(res.status === 200, `status should be 200, got ${res.status}`, failures);
      assertOk(res.json?.text?.includes("ห้ามเดาโว้ย") || res.json?.text?.includes("ขออภัย"), "chat gate fallback failed", failures);
    }
  );

  server.close();
  
  const dur = Date.now() - startMs;
  logLines.push("====================================");
  if (failures.length === 0) {
    logLines.push(`RESULT: PASS (${passed}/${passed} cases) in ${dur}ms`);
  } else {
    logLines.push(`RESULT: FAIL (${passed} passed, ${failures.length} failed) in ${dur}ms`);
    failures.forEach((f) => logLines.push(` - ${f}`));
  }

  const logStr = logLines.join("\n") + "\n";
  console.log(logStr);

  const evDir = path.join(__dirname, "../evidence");
  if (!fs.existsSync(evDir)) fs.mkdirSync(evDir, { recursive: true });
  fs.writeFileSync(path.join(evDir, `phase102-chat-iq-gate-${nowStamp()}.log`), logStr);

  if (failures.length > 0) process.exit(1);
}

runTests().catch(console.error);
