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

function postJson(port: number, body: any): Promise<{ status: number; json: any; raw: string }> {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(payload.length),
        "X-Smoke-Run": "1",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let json: any = null;
        try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
        resolve({ status: res.statusCode || 0, json, raw });
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function startEphemeralServer() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.INNOMCP_MODE = "offline";
  process.env.SMOKE_MODE = "1";
  process.env.WEATHER_FIXTURE_W1 = "1";
  process.env.CHAT_TRACE_QA = "1";
  process.env.LOG_DEBUG = "0";
  process.env.SERVER_HOST = "127.0.0.1";

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve);
    server.on("error", reject);
  });
  const port = (server.address() as any).port as number;

  const stop = async () => {
    try {
      const chatMod: any = await import("../src/routes/api/chat");
      const toolHealthChecker = chatMod?.toolHealthChecker;
      const mcpClient = chatMod?.mcpClient;
      if (toolHealthChecker && typeof toolHealthChecker.stopHealthChecks === "function") toolHealthChecker.stopHealthChecks();
      if (mcpClient && typeof mcpClient.shutdown === "function") await mcpClient.shutdown();
    } catch {
      // ignore
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return { port, stop };
}

async function main() {
  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, `phase107-tool-transparency-${stamp}.log`);

  const lines: string[] = [];
  const failures: string[] = [];

  lines.push(`CONFIG: INNOMCP_MODE=offline SMOKE_MODE=1 WEATHER_FIXTURE_W1=1`);

  const { port, stop } = await startEphemeralServer();
  try {
    // CASE_WEATHER: weather query → should route to weatherPipeline, return real data
    const weather = await postJson(port, { message: "อากาศกรุงเทพวันนี้เป็นอย่างไร" });
    lines.push(`CASE_WEATHER: status=${weather.status} mcpUsed=${String(weather.json?.mcpUsed)} toolsUsed=${JSON.stringify(weather.json?.toolsUsed || [])}`);
    assertOk(weather.status === 200, "CASE_WEATHER status != 200", failures);
    assertOk(weather.json?.mcpUsed === true, "CASE_WEATHER mcpUsed should be true", failures);
    assertOk(typeof weather.json?.text === "string" && weather.json.text.length > 0, "CASE_WEATHER text must be non-empty", failures);
    // Weather response should contain actual weather content (rain%, temp, or wind)
    const weatherText = String(weather.json?.text || "");
    assertOk(
      weatherText.includes("โอกาสฝน") || weatherText.includes("อุณหภูมิ") || weatherText.includes("ฝน") || weatherText.includes("°C"),
      "CASE_WEATHER text should contain weather data",
      failures
    );

    // CASE_LOW: unknown intent → should return low-confidence guidance (mcpUsed=false)
    const low = await postJson(port, { message: "zxqv-unknown-intent-alpha" });
    lines.push(`CASE_LOW: status=${low.status} mcpUsed=${String(low.json?.mcpUsed)} text='${String(low.json?.text || "").slice(0, 100)}'`);
    assertOk(low.status === 200, "CASE_LOW status != 200", failures);
    assertOk(low.json?.mcpUsed === false, "CASE_LOW mcpUsed should be false", failures);
    assertOk(typeof low.json?.text === "string" && low.json.text.length > 0, "CASE_LOW text must be non-empty", failures);
    // Low-confidence response should prompt user for more info (not a weather/data answer)
    const lowText = String(low.json?.text || "");
    assertOk(
      !lowText.includes("โอกาสฝน") && !lowText.includes("อุณหภูมิ"),
      "CASE_LOW should not return weather data for unknown intent",
      failures
    );
  } finally {
    await stop();
  }

  const ok = failures.length === 0;
  lines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    lines.push("FAILURES:");
    failures.forEach((f) => lines.push(`- ${f}`));
  }

  fs.writeFileSync(evidence, lines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidence}`);
  if (!ok) throw new Error("phase10.7 tool transparency failed");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
