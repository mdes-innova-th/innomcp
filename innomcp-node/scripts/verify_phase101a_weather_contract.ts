import http from "http";
import fs from "fs";
import path from "path";

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function assertOk(cond: any, message: string, failures: string[]) {
  if (!cond) failures.push(message);
}

function postJson(port: number, body: any, headers: Record<string, string> = {}): Promise<{ status: number; json: any; raw: string }> {
  const payload = Buffer.from(JSON.stringify(body));
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
          ...headers,
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
          resolve({ status: res.statusCode || 0, json, raw });
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
  process.env.WEATHER_FIXTURE_W1 = "1";
  process.env.SERVER_HOST = "127.0.0.1";

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("bind fail"));
      resolve(addr.port);
    });
  });

  const stop = async () => {
    try {
      const chatMod: any = await import("../src/routes/api/chat");
      const toolHealthChecker = chatMod?.toolHealthChecker;
      const mcpClient = chatMod?.mcpClient;
      if (toolHealthChecker && typeof toolHealthChecker.stopHealthChecks === "function") {
        toolHealthChecker.stopHealthChecks();
      }
      if (mcpClient && typeof mcpClient.shutdown === "function") {
        await mcpClient.shutdown();
      } else if (mcpClient && typeof mcpClient.stopHealthCheck === "function") {
        mcpClient.stopHealthCheck();
      }
    } catch {
      // ignore
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return { port, stop };
}

function validateWeatherPayload(sc: any, failures: string[], label: string) {
  const payload = sc?.weatherPayload;
  assertOk(payload && typeof payload === "object", `${label}: weatherPayload must be object`, failures);
  assertOk(payload?.version === "10.1", `${label}: weatherPayload.version must be 10.1`, failures);
  assertOk(Array.isArray(payload?.sourcesUsed), `${label}: weatherPayload.sourcesUsed must be array`, failures);
  assertOk(typeof payload?.confidence === "number", `${label}: weatherPayload.confidence must be number`, failures);
  assertOk(payload?.errTaxonomy && typeof payload.errTaxonomy === "object", `${label}: weatherPayload.errTaxonomy must exist`, failures);

  const areas = Array.isArray(payload?.areas) ? payload.areas : [];
  assertOk(areas.length > 0, `${label}: weatherPayload.areas must be non-empty`, failures);

  for (const [idx, a] of areas.entries()) {
    assertOk(typeof a?.area === "string" && a.area.length > 0, `${label}: areas[${idx}].area required`, failures);
    assertOk("rainChancePct" in a, `${label}: areas[${idx}].rainChancePct required`, failures);
    assertOk(typeof a?.temperature === "string" && a.temperature.length > 0, `${label}: areas[${idx}].temperature required`, failures);
    assertOk(typeof a?.wind === "string" && a.wind.length > 0, `${label}: areas[${idx}].wind required`, failures);
    assertOk(typeof a?.updateTime === "string" && a.updateTime.length > 0, `${label}: areas[${idx}].updateTime required`, failures);
    assertOk(typeof a?.summary === "string" && a.summary.length > 0, `${label}: areas[${idx}].summary required`, failures);
    assertOk(Array.isArray(a?.sourcesUsed), `${label}: areas[${idx}].sourcesUsed required`, failures);
  }
}

async function main() {
  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, `phase101a-${stamp}.log`);

  const lines: string[] = [];
  const failures: string[] = [];

  const cases = [
    "อากาศกรุงเทพวันนี้เป็นอย่างไร",
    "พรุ่งนี้เชียงใหม่ฝนตกไหม",
    "ตารางอากาศลำปาง",
    "ตอนนี้อากาศภูเก็ต",
  ];

  const { port, stop } = await startEphemeralServer();
  try {
    for (let i = 0; i < cases.length; i++) {
      const q = cases[i];
      const r = await postJson(port, { message: q, messages: [] }, { "X-Smoke-Run": "1", "X-Correlation-Id": `phase101a-${stamp}-${i}` });
      const text = String(r.json?.text || r.raw || "").replace(/\s+/g, " ").trim();
      const sc = r.json?.structuredContent;

      lines.push(`Case${i + 1}: status=${r.status} q='${q}' text='${text.slice(0, 100)}'`);
      assertOk(r.status === 200, `Case${i + 1}: HTTP status must be 200`, failures);
      validateWeatherPayload(sc, failures, `Case${i + 1}`);
      assertOk(!/30°C\s*70%\s*20%/i.test(text), `Case${i + 1}: must not contain placeholder combo text`, failures);
    }
  } finally {
    await stop();
  }

  const ok = failures.length === 0;
  lines.push(ok ? "SUMMARY: weatherPayload contract shape PASS" : "SUMMARY: weatherPayload contract shape FAIL");
  lines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    lines.push("FAILURES:");
    for (const f of failures) lines.push(`- ${f}`);
  }

  fs.writeFileSync(evidence, lines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidence}`);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify_phase101a_weather_contract failed:", err);
  process.exit(1);
});
