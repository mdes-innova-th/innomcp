import http from "http";
import fs from "fs";
import path from "path";

const LOW_CONFIDENCE_FALLBACK_TEXT = "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ";

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
  const evidence = path.join(evidenceDir, `phase107-chat-pro-iq-${stamp}.log`);

  const lines: string[] = [];
  const failures: string[] = [];

  lines.push(`CONFIG: INNOMCP_MODE=offline SMOKE_MODE=1 WEATHER_FIXTURE_W1=1`);

  const { port, stop } = await startEphemeralServer();
  try {
    const clear = await postJson(port, { message: "อากาศกรุงเทพวันนี้เป็นอย่างไร" });
    const clearText = String(clear.json?.text || "");
    const clearMeta = clear.json?.structuredContent?.chatMeta;
    lines.push(`CASE_CLEAR: status=${clear.status} tools=${JSON.stringify(clear.json?.toolsUsed || [])} reason=${String(clearMeta?.reason_code || "")}`);
    assertOk(clear.status === 200, "CASE_CLEAR status != 200", failures);
    assertOk((clear.json?.toolsUsed || []).length > 0, "CASE_CLEAR should use at least one tool", failures);
    assertOk(clearMeta?.reason_code === "TOOL_OK", "CASE_CLEAR reason_code should be TOOL_OK", failures);
    assertOk(clearText.length > 0, "CASE_CLEAR empty answer", failures);

    const ambiguous = await postJson(port, { message: "zxqv-unknown-intent-alpha" });
    const ambiguousText = String(ambiguous.json?.text || "");
    const ambiguousMeta = ambiguous.json?.structuredContent?.chatMeta;
    lines.push(`CASE_AMBIG: status=${ambiguous.status} reason=${String(ambiguousMeta?.reason_code || "")} text='${ambiguousText.slice(0, 120)}'`);
    assertOk(ambiguous.status === 200, "CASE_AMBIG status != 200", failures);
    assertOk(ambiguousText === LOW_CONFIDENCE_FALLBACK_TEXT, "CASE_AMBIG should return deterministic polite fallback", failures);
    assertOk(ambiguousMeta?.reason_code === "LOW_CONTEXT", "CASE_AMBIG reason_code should be LOW_CONTEXT", failures);
    assertOk(Array.isArray(ambiguousMeta?.userGuidance) && ambiguousMeta.userGuidance.length > 0, "CASE_AMBIG should include userGuidance", failures);
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
  if (!ok) throw new Error("phase10.7 chat pro iq failed");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
