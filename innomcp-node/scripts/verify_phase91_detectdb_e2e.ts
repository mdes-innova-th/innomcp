import http from "http";
import fs from "fs";
import path from "path";

type ChatResponse = {
  text?: string;
  structuredContent?: any;
  error?: string;
};

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function postJson(
  port: number,
  urlPath: string,
  body: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: any; raw: string }> {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: urlPath,
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

function assertOk(cond: any, message: string, failures: string[]) {
  if (!cond) failures.push(message);
}

function assertNotContainsAny(haystack: string, needles: string[], label: string, failures: string[]) {
  for (const needle of needles) {
    if (haystack.includes(needle)) failures.push(`${label}: must not include "${needle}"`);
  }
}

function getScRoute(sc: any): string {
  return String(sc?.__render?.route || "");
}

function looksLikeBadLeak(text: string): boolean {
  return /(process\.env|DETECT_DB_PASSWORD|EVIDENCE_DB_PASSWORD|Authorization|Bearer\s+)/i.test(text);
}

async function startEphemeralServer() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.SERVER_HOST = "127.0.0.1";

  const { default: app } = await import("../src/app");
  const server = http.createServer(app as any);
  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") return reject(new Error("Failed to bind ephemeral port"));
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
  const evidenceLog = path.join(evidenceDir, `phase91-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  // Ensure we start from a clean Evidence pool between cases.
  const evConnMod: any = await import("../src/utils/db/evidenceConnection");
  const closeEvidencePool: undefined | (() => Promise<void>) = evConnMod?.closeEvidencePool;

  const { port, stop } = await startEphemeralServer();
  logLines.push(`phase91 verifier start: port=${port}`);

  try {
    // ------------------------------------------------------------
    // Case 0: Forced missing DetectDB (must be operator-grade, no env leaks, no ERR: prefix)
    // ------------------------------------------------------------
    process.env.DETECT_DB_DISABLED = "1";
    if (closeEvidencePool) await closeEvidencePool();

    const q0 = "เมื่อวาน evidence แยกตาม ISP และใครมากสุด";
    const r0 = await postJson(
      port,
      "/api/chat",
      { message: q0, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase91-${stamp}-missing` }
    );
    const t0 = String((r0.json as ChatResponse)?.text || r0.raw || "");
    const sc0 = (r0.json as ChatResponse)?.structuredContent;

    logLines.push("Q0 (missing-db) text: " + t0.replace(/\s+/g, " ").slice(0, 240));
    assertOk(getScRoute(sc0) === "evidence", "Q0: structuredContent.__render.route must be evidence", failures);
    assertOk(!/^ERR:/i.test(t0.trim()), "Q0: user-visible text must not start with ERR:", failures);
    assertOk(!looksLikeBadLeak(t0), "Q0: must not leak env/secrets into text", failures);
    assertNotContainsAny(JSON.stringify(r0.json || {}), ["process.env", "DETECT_DB_PASSWORD", "Authorization", "Bearer"], "Q0", failures);

    // Reset for subsequent cases.
    delete process.env.DETECT_DB_DISABLED;
    if (closeEvidencePool) await closeEvidencePool();

    // ------------------------------------------------------------
    // Case 1: Yesterday ISP top (must include kpis + table.rows)
    // ------------------------------------------------------------
    const q1 = "เมื่อวาน evidence แยกตาม ISP และใครมากสุด";
    const r1 = await postJson(
      port,
      "/api/chat",
      { message: q1, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase91-${stamp}-isp` }
    );

    const t1 = String((r1.json as ChatResponse)?.text || r1.raw || "");
    const sc1 = (r1.json as ChatResponse)?.structuredContent;

    logLines.push("Q1 text: " + t1.replace(/\s+/g, " ").slice(0, 260));

    assertOk(getScRoute(sc1) === "evidence", "Q1: structuredContent.__render.route must be evidence", failures);
    assertOk(typeof sc1?.kpis?.total === "number", "Q1: structuredContent.kpis.total must be number", failures);
    assertOk(typeof sc1?.kpis?.topIspName === "string" || sc1?.kpis?.topIspName === null, "Q1: structuredContent.kpis.topIspName must be string|null", failures);
    assertOk(typeof sc1?.kpis?.topIspCount === "number" || sc1?.kpis?.topIspCount === null, "Q1: structuredContent.kpis.topIspCount must be number|null", failures);
    assertOk(Array.isArray(sc1?.table?.rows), "Q1: structuredContent.table.rows must be array", failures);
    assertOk(sc1?.table?.rows?.length >= 3, "Q1: structuredContent.table.rows must have >= 3 rows", failures);
    assertOk(/ISP/i.test(t1) || /ผู้ให้บริการ|ค่าย/i.test(t1), "Q1: text must mention ISP intent", failures);
    assertOk(!looksLikeBadLeak(t1), "Q1: must not leak env/secrets into text", failures);

    // ------------------------------------------------------------
    // Case 2: Yesterday total
    // ------------------------------------------------------------
    const q2 = "เมื่อวานหลักฐานรวมกี่รายการ";
    const r2 = await postJson(
      port,
      "/api/chat",
      { message: q2, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase91-${stamp}-total` }
    );
    const t2 = String((r2.json as ChatResponse)?.text || r2.raw || "");
    const sc2 = (r2.json as ChatResponse)?.structuredContent;

    logLines.push("Q2 text: " + t2.replace(/\s+/g, " ").slice(0, 220));

    assertOk(getScRoute(sc2) === "evidence", "Q2: structuredContent.__render.route must be evidence", failures);
    assertOk(typeof sc2?.kpis?.total === "number" || typeof sc2?.count === "number", "Q2: must include count or kpis.total", failures);
    assertOk(!looksLikeBadLeak(t2), "Q2: must not leak env/secrets into text", failures);

    // ------------------------------------------------------------
    // Case 3: 7-day trend
    // ------------------------------------------------------------
    const q3 = "แนวโน้มหลักฐาน 7 วันล่าสุด";
    const r3 = await postJson(
      port,
      "/api/chat",
      { message: q3, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase91-${stamp}-trend` }
    );
    const t3 = String((r3.json as ChatResponse)?.text || r3.raw || "");
    const sc3 = (r3.json as ChatResponse)?.structuredContent;

    logLines.push("Q3 text: " + t3.replace(/\s+/g, " ").slice(0, 260));

    assertOk(getScRoute(sc3) === "evidence", "Q3: structuredContent.__render.route must be evidence", failures);
    assertOk(Array.isArray(sc3?.series?.points), "Q3: structuredContent.series.points must be array", failures);
    assertOk((sc3?.series?.points?.length || 0) === 7, "Q3: structuredContent.series.points must have 7 points", failures);
    assertOk(/แนวโน้ม|7\s*วัน/i.test(t3), "Q3: text must mention trend/7 days", failures);
    assertOk(!looksLikeBadLeak(t3), "Q3: must not leak env/secrets into text", failures);

    // Global negative checks
    const rawAll = JSON.stringify({ r0: r0.json, r1: r1.json, r2: r2.json, r3: r3.json });
    assertNotContainsAny(rawAll, ["process.env", "DETECT_DB_PASSWORD", "EVIDENCE_DB_PASSWORD", "Authorization", "Bearer"], "GLOBAL", failures);
  } finally {
    await stop();
  }

  const ok = failures.length === 0;
  logLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    logLines.push("FAILURES:");
    for (const f of failures) logLines.push("- " + f);
  }

  fs.writeFileSync(evidenceLog, logLines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidenceLog}`);
  if (!ok) console.error(logLines.join("\n"));
  process.exitCode = ok ? 0 : 1;

  const t = setTimeout(() => process.exit(process.exitCode || 0), 300);
  // @ts-ignore
  if (typeof (t as any).unref === "function") (t as any).unref();
}

main().catch((err) => {
  console.error("verify_phase91_detectdb_e2e failed:", err);
  process.exitCode = 1;
});
