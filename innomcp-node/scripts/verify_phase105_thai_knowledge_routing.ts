import http from "http";
import fs from "fs";
import path from "path";

const LOW_CONFIDENCE_FALLBACK_TEXT = "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ";

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
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
  process.env.TS_NODE_CACHE = "false";
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

function hasThaiKnowledgeTool(json: any): boolean {
  const tools = Array.isArray(json?.mcpResults) ? json.mcpResults : [];
  const names = tools
    .map((x: any) => String(x?.toolName || ""))
    .filter(Boolean)
    .map((x: string) => x.toLowerCase());

  return names.some((name: string) => name.includes("thaiknowledgetool"));
}

async function main() {
  const stamp = dateStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, `phase105-knowledge-routing-${stamp}.log`);

  const lines: string[] = [];
  const failures: string[] = [];

  const { port, stop } = await startEphemeralServer();
  try {
    const geoQuery = "จังหวัดนครราชสีมาอยู่ภาคอะไรของประเทศไทย";
    const geoRes = await postJson(
      port,
      { message: geoQuery, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase105-geo-${stamp}` }
    );

    const geoText = String(geoRes.json?.text || geoRes.raw || "").replace(/\s+/g, " ").trim();
    lines.push(`CASE_GEO: status=${geoRes.status} mcpUsed=${String(geoRes.json?.mcpUsed)} text='${geoText.slice(0, 120)}'`);

    assertOk(geoRes.status === 200, "CASE_GEO: status must be 200", failures);
    assertOk(Boolean(geoRes.json?.mcpUsed), "CASE_GEO: mcpUsed must be true", failures);
    assertOk(hasThaiKnowledgeTool(geoRes.json), "CASE_GEO: thaiKnowledgeTool must be selected", failures);
    assertOk(geoText !== LOW_CONFIDENCE_FALLBACK_TEXT, "CASE_GEO: must not fall back low-confidence response", failures);

    const lowQuery = "zxqv-unknown-intent-alpha";
    const lowRes = await postJson(
      port,
      { message: lowQuery, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase105-low-${stamp}` }
    );

    const lowText = String(lowRes.json?.text || lowRes.raw || "").replace(/\s+/g, " ").trim();
    lines.push(`CASE_LOW_CONF: status=${lowRes.status} mcpUsed=${String(lowRes.json?.mcpUsed)} text='${lowText.slice(0, 120)}'`);

    assertOk(lowRes.status === 200, "CASE_LOW_CONF: status must be 200", failures);
    assertOk(lowText === LOW_CONFIDENCE_FALLBACK_TEXT, "CASE_LOW_CONF: must return graceful deterministic fallback", failures);
    assertOk(lowRes.json?.mcpUsed === false, "CASE_LOW_CONF: mcpUsed must be false", failures);
    assertOk(lowRes.json?.mcpResults == null, "CASE_LOW_CONF: mcpResults must be null", failures);
  } finally {
    await stop();
  }

  const ok = failures.length === 0;
  lines.push(ok ? "SUMMARY: phase10.5 thai knowledge routing PASS" : "SUMMARY: phase10.5 thai knowledge routing FAIL");
  lines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");

  if (!ok) {
    lines.push("FAILURES:");
    for (const f of failures) lines.push(`- ${f}`);
  }

  fs.writeFileSync(evidence, lines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidence}`);

  if (!ok) {
    throw new Error("phase10.5 verification failed");
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("verify_phase105_thai_knowledge_routing failed:", err);
  process.exit(1);
});
