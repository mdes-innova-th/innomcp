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

async function main() {
  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, `phase101b-${stamp}.log`);

  const lines: string[] = [];
  const failures: string[] = [];

  const { port, stop } = await startEphemeralServer();
  try {
    const q = "อากาศกรุงเทพวันนี้พร้อมแผนที่";
    const r = await postJson(port, { message: q, messages: [] }, { "X-Smoke-Run": "1", "X-Correlation-Id": `phase101b-${stamp}` });
    const sc = r.json?.structuredContent;
    const payload = sc?.weatherPayload;
    const tiles = Array.isArray(payload?.mapTiles) ? payload.mapTiles : [];

    lines.push(`Case1: status=${r.status} mapTiles=${tiles.length}`);
    assertOk(r.status === 200, "Case1: HTTP status must be 200", failures);
    assertOk(payload && typeof payload === "object", "Case1: weatherPayload must exist", failures);
    assertOk(Array.isArray(tiles) && tiles.length > 0, "Case1: weatherPayload.mapTiles must be non-empty", failures);

    for (const [idx, t] of tiles.slice(0, 3).entries()) {
      const url = String(t?.url || "").trim();
      const area = String(t?.area || "").trim();
      const label = String(t?.label || "").trim();
      assertOk(url.startsWith("/weather-tiles/"), `Case1: mapTiles[${idx}].url must be local static url`, failures);
      assertOk(area.length > 0, `Case1: mapTiles[${idx}].area required`, failures);
      assertOk(label.length > 0, `Case1: mapTiles[${idx}].label required`, failures);
    }
  } finally {
    await stop();
  }

  const ok = failures.length === 0;
  lines.push(ok ? "SUMMARY: weather map tile contract PASS" : "SUMMARY: weather map tile contract FAIL");
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
  console.error("verify_phase101b_weather_map failed:", err);
  process.exit(1);
});
