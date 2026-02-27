import http from "http";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import mysql from "mysql2/promise";

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

function getMariadbPasswordOrEmpty(): string {
  return (
    process.env.MARIADB_ROOT_PASSWORD ||
    process.env.MARIADB_PASSWORD ||
    process.env.INNOMCP_MARIADB_PASSWORD ||
    ""
  );
}

function setEnvForMissingDetectDbCreds() {
  // Force the EvidenceDB resolver to throw MISSING_DETECT_DB_CREDS via missing env.
  // Do NOT use DETECT_DB_DISABLED here (Phase 9.1.1 requirement).
  delete process.env.DETECT_DB_USER;
  delete process.env.DETECT_DB_PASSWORD;
  delete process.env.DETECT_DB_HOST;
  delete process.env.DETECT_DB_PORT;
  delete process.env.DETECT_DB_NAME;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
}

function setEnvForRealDetectDb() {
  const password = getMariadbPasswordOrEmpty();
  if (!password) throw new Error("MISSING_MARIADB_PASSWORD_ENV");
  process.env.DETECT_DB_HOST = "127.0.0.1";
  process.env.DETECT_DB_PORT = "3308";
  process.env.DETECT_DB_USER = "root";
  process.env.DETECT_DB_PASSWORD = password;
  process.env.DETECT_DB_NAME = "phase91_detectdb";
}

function tryDockerComposeUp(composeFile: string, cwd: string): { ok: boolean; cmd: string; out: string } {
  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: "docker", args: ["compose", "-f", composeFile, "up", "-d", "--force-recreate", "--remove-orphans"] },
    { cmd: "docker-compose", args: ["-f", composeFile, "up", "-d", "--force-recreate", "--remove-orphans"] },
  ];

  for (const a of attempts) {
    const r = spawnSync(a.cmd, a.args, { cwd, encoding: "utf8" });
    const out = String(r.stdout || "") + String(r.stderr || "");
    if (r.error && (r.error as any).code === "ENOENT") continue;
    if (r.status === 0) return { ok: true, cmd: `${a.cmd} ${a.args.join(" ")}`, out };
  }

  const last = attempts[0];
  return { ok: false, cmd: `${last.cmd} ${last.args.join(" ")}`, out: "docker compose failed or not available" };
}

function tryDockerComposeDown(composeFile: string, cwd: string): { ok: boolean; cmd: string; out: string } {
  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: "docker", args: ["compose", "-f", composeFile, "down", "-v", "--remove-orphans"] },
    { cmd: "docker-compose", args: ["-f", composeFile, "down", "-v", "--remove-orphans"] },
  ];

  for (const a of attempts) {
    const r = spawnSync(a.cmd, a.args, { cwd, encoding: "utf8" });
    const out = String(r.stdout || "") + String(r.stderr || "");
    if (r.error && (r.error as any).code === "ENOENT") continue;
    if (r.status === 0) return { ok: true, cmd: `${a.cmd} ${a.args.join(" ")}`, out };
  }

  const last = attempts[0];
  return { ok: false, cmd: `${last.cmd} ${last.args.join(" ")}`, out: "docker compose down failed or not available" };
}

async function ensureDetectDbSeeded(logLines: string[], failures: string[]) {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const composeFile = path.resolve(repoRoot, "mariadb", "docker-compose.yml");

  const password = getMariadbPasswordOrEmpty();
  if (!password) {
    failures.push("BLOCKED:MISSING_MARIADB_PASSWORD_ENV");
    logLines.push("detectdb seed blocked: missing env MARIADB_ROOT_PASSWORD/MARIADB_PASSWORD");
    return;
  }

  const down = tryDockerComposeDown(composeFile, path.dirname(composeFile));
  logLines.push(`detectdb docker down: ok=${down.ok} cmd=${down.cmd}`);

  const up = tryDockerComposeUp(composeFile, path.dirname(composeFile));
  logLines.push(`detectdb docker up: ok=${up.ok} cmd=${up.cmd}`);
  if (!up.ok) {
    failures.push("BLOCKED:DOCKER_NOT_AVAILABLE");
    return;
  }

  // Wait for DB readiness (simple connect retry)
  const connectDeadline = Date.now() + 60_000;
  let conn: mysql.Connection | null = null;
  let lastErr: any = null;
  while (Date.now() < connectDeadline) {
    try {
      conn = await mysql.createConnection({ host: "127.0.0.1", port: 3308, user: "root", password });
      await conn.ping();
      break;
    } catch (e: any) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (!conn) {
    failures.push(`BLOCKED:DETECTDB_CONNECT_FAILED:${String(lastErr?.message || lastErr || "unknown")}`);
    return;
  }

  try {
    await conn.execute("CREATE DATABASE IF NOT EXISTS `phase91_detectdb` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    await conn.execute("USE `phase91_detectdb`");

    await conn.execute(
      "CREATE TABLE IF NOT EXISTS machines (id INT AUTO_INCREMENT PRIMARY KEY, is_online TINYINT NOT NULL, last_check_in DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    await conn.execute(
      "CREATE TABLE IF NOT EXISTS nip (nip_no VARCHAR(64) PRIMARY KEY, isp VARCHAR(64) NOT NULL, create_date DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    await conn.execute(
      "CREATE TABLE IF NOT EXISTS record (id INT AUTO_INCREMENT PRIMARY KEY, nip_no VARCHAR(64) NOT NULL, create_date DATETIME NOT NULL, INDEX idx_create_date (create_date), INDEX idx_nip_no (nip_no)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    // Clear prior fixture rows (idempotent)
    await conn.execute("DELETE FROM record WHERE nip_no LIKE 'phase91-%'");
    await conn.execute("DELETE FROM nip WHERE nip_no LIKE 'phase91-%'");

    // Seed ISPs
    const isps = [
      { isp: "AIS", nip: "phase91-ais" },
      { isp: "TRUE", nip: "phase91-true" },
      { isp: "DTAC", nip: "phase91-dtac" },
      { isp: "3BB", nip: "phase91-3bb" },
    ];
    for (const x of isps) {
      await conn.execute("INSERT INTO nip (nip_no, isp, create_date) VALUES (?, ?, NOW())", [x.nip, x.isp]);
    }

    // Seed records for last 7 days (make yesterday non-zero and AIS top)
    const now = new Date();
    const mkDate = (offsetDays: number, hour: number) => {
      const d = new Date(now.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
      // Use Bangkok-ish time by pinning hour; DB stores as local container time.
      d.setHours(hour, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
    };

    // Yesterday: AIS 12, TRUE 5, DTAC 3, 3BB 2 => total 22
    const y = -1;
    const insertMany = async (nipNo: string, dateStr: string, count: number) => {
      for (let i = 0; i < count; i++) {
        await conn!.execute("INSERT INTO record (nip_no, create_date) VALUES (?, ?)", [nipNo, dateStr]);
      }
    };

    await insertMany("phase91-ais", mkDate(y, 10), 12);
    await insertMany("phase91-true", mkDate(y, 11), 5);
    await insertMany("phase91-dtac", mkDate(y, 12), 3);
    await insertMany("phase91-3bb", mkDate(y, 13), 2);

    // Spread some records across other days so 7-day trend isn't all-zero.
    await insertMany("phase91-ais", mkDate(-6, 9), 2);
    await insertMany("phase91-true", mkDate(-5, 9), 1);
    await insertMany("phase91-dtac", mkDate(-4, 9), 1);
    await insertMany("phase91-ais", mkDate(-3, 9), 2);
    await insertMany("phase91-3bb", mkDate(-2, 9), 1);
  } finally {
    await conn.end();
  }
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
  const evidenceLog = path.join(evidenceDir, `phase912-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  // Ensure we start from a clean Evidence pool between cases.
  const evConnMod: any = await import("../src/utils/db/evidenceConnection");
  const closeEvidencePool: undefined | (() => Promise<void>) = evConnMod?.closeEvidencePool;

  const { port, stop } = await startEphemeralServer();
  logLines.push(`phase912 verifier start: port=${port}`);

  try {
    // ------------------------------------------------------------
    // Case A: Forced placeholder via UNSET creds (no DETECT_DB_DISABLED)
    // ------------------------------------------------------------
    setEnvForMissingDetectDbCreds();
    if (closeEvidencePool) await closeEvidencePool();

    const q0 = "เมื่อวาน evidence แยกตาม ISP และใครมากสุด";
    const r0 = await postJson(
      port,
      "/api/chat",
      { message: q0, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase912-${stamp}-missing` }
    );
    const t0 = String((r0.json as ChatResponse)?.text || r0.raw || "");
    const sc0 = (r0.json as ChatResponse)?.structuredContent;

    logLines.push("Q0 (missing-db) text: " + t0.replace(/\s+/g, " ").slice(0, 240));
    assertOk(getScRoute(sc0) === "evidence", "Q0: structuredContent.__render.route must be evidence", failures);
    assertOk(sc0?.meta?.dataSource === "placeholder", "Q0: structuredContent.meta.dataSource must be placeholder", failures);
    assertOk(typeof sc0?.meta?.note === "string" && sc0.meta.note.length > 0, "Q0: structuredContent.meta.note must be present for placeholder", failures);
    assertOk(!/^ERR:/i.test(t0.trim()), "Q0: user-visible text must not start with ERR:", failures);
    assertOk(!looksLikeBadLeak(t0), "Q0: must not leak env/secrets into text", failures);
    assertNotContainsAny(JSON.stringify(r0.json || {}), ["process.env", "DETECT_DB_PASSWORD", "Authorization", "Bearer"], "Q0", failures);

    // ------------------------------------------------------------
    // Case B: Real DetectDB (Docker MariaDB + seeded schema)
    // ------------------------------------------------------------
    await ensureDetectDbSeeded(logLines, failures);
    setEnvForRealDetectDb();
    if (closeEvidencePool) await closeEvidencePool();

    // ------------------------------------------------------------
    // Case 1: Yesterday ISP top (must be detectdb + include real top ISP)
    // ------------------------------------------------------------
    const q1 = "เมื่อวาน evidence แยกตาม ISP และใครมากสุด";
    const r1 = await postJson(
      port,
      "/api/chat",
      { message: q1, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase912-${stamp}-isp` }
    );

    const t1 = String((r1.json as ChatResponse)?.text || r1.raw || "");
    const sc1 = (r1.json as ChatResponse)?.structuredContent;

    logLines.push("Q1 text: " + t1.replace(/\s+/g, " ").slice(0, 260));

    assertOk(getScRoute(sc1) === "evidence", "Q1: structuredContent.__render.route must be evidence", failures);
    assertOk(sc1?.meta?.dataSource === "detectdb", "Q1: structuredContent.meta.dataSource must be detectdb", failures);
    assertOk(typeof sc1?.kpis?.total === "number", "Q1: structuredContent.kpis.total must be number", failures);
    assertOk(typeof sc1?.kpis?.topIspName === "string" || sc1?.kpis?.topIspName === null, "Q1: structuredContent.kpis.topIspName must be string|null", failures);
    assertOk(typeof sc1?.kpis?.topIspCount === "number" || sc1?.kpis?.topIspCount === null, "Q1: structuredContent.kpis.topIspCount must be number|null", failures);
    assertOk(Array.isArray(sc1?.table?.rows), "Q1: structuredContent.table.rows must be array", failures);
    assertOk(sc1?.table?.rows?.length >= 3, "Q1: structuredContent.table.rows must have >= 3 rows", failures);
    assertOk(typeof sc1?.kpis?.topIspName === "string" && sc1.kpis.topIspName !== "(ยังไม่มีข้อมูล)", "Q1: top ISP must be real (non-placeholder)", failures);
    assertOk(typeof sc1?.kpis?.topIspCount === "number" && sc1.kpis.topIspCount > 0, "Q1: top ISP count must be > 0", failures);
    assertOk(typeof sc1?.kpis?.total === "number" && sc1.kpis.total > 0, "Q1: total must be > 0 for real detectdb", failures);
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
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase912-${stamp}-total` }
    );
    const t2 = String((r2.json as ChatResponse)?.text || r2.raw || "");
    const sc2 = (r2.json as ChatResponse)?.structuredContent;

    logLines.push("Q2 text: " + t2.replace(/\s+/g, " ").slice(0, 220));

    assertOk(getScRoute(sc2) === "evidence", "Q2: structuredContent.__render.route must be evidence", failures);
    assertOk(sc2?.meta?.dataSource === "detectdb", "Q2: structuredContent.meta.dataSource must be detectdb", failures);
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
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase912-${stamp}-trend` }
    );
    const t3 = String((r3.json as ChatResponse)?.text || r3.raw || "");
    const sc3 = (r3.json as ChatResponse)?.structuredContent;

    logLines.push("Q3 text: " + t3.replace(/\s+/g, " ").slice(0, 260));

    assertOk(getScRoute(sc3) === "evidence", "Q3: structuredContent.__render.route must be evidence", failures);
    assertOk(sc3?.meta?.dataSource === "detectdb", "Q3: structuredContent.meta.dataSource must be detectdb", failures);
    assertOk(Array.isArray(sc3?.series?.points), "Q3: structuredContent.series.points must be array", failures);
    assertOk((sc3?.series?.points?.length || 0) === 7, "Q3: structuredContent.series.points must have 7 points", failures);

    const pts: Array<{ date: string; count: number }> = Array.isArray(sc3?.series?.points) ? sc3.series.points : [];
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const [idx, p] of pts.entries()) {
      const d = String((p as any)?.date || "").slice(0, 10);
      const c = Number((p as any)?.count ?? (p as any)?.c ?? 0);
      assertOk(dateRe.test(d), `Q3: points[${idx}].date must be YYYY-MM-DD`, failures);
      assertOk(Number.isFinite(c), `Q3: points[${idx}].count must be number`, failures);
    }
    assertOk(pts.some((p: any) => Number(p?.count ?? 0) > 0), "Q3: at least one day must have count > 0 (real detectdb proof)", failures);

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
