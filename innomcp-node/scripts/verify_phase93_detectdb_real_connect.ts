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
  headers: Record<string, string> = {},
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
      },
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
  return /(process\.env|DETECT_DB_PASSWORD|EVIDENCE_DB_PASSWORD|authorization|bearer\s+)/i.test(text);
}

function getMariadbPasswordOrEmpty(): string {
  return process.env.MARIADB_ROOT_PASSWORD || process.env.MARIADB_PASSWORD || process.env.INNOMCP_MARIADB_PASSWORD || "";
}

function setEnvForMissingDetectDbCreds() {
  delete process.env.DETECT_DB_USER;
  delete process.env.DETECT_DB_PASSWORD;
  delete process.env.DETECT_DB_HOST;
  delete process.env.DETECT_DB_PORT;
  delete process.env.DETECT_DB_NAME;
}

function setEnvForRealDetectDb(dbName: string): { ok: true } | { ok: false; code: string } {
  const password = getMariadbPasswordOrEmpty();
  if (!password) return { ok: false, code: "MISSING_MARIADB_PASSWORD_ENV" };
  process.env.DETECT_DB_HOST = "127.0.0.1";
  process.env.DETECT_DB_PORT = "3308";
  process.env.DETECT_DB_USER = "root";
  process.env.DETECT_DB_PASSWORD = password;
  process.env.DETECT_DB_NAME = dbName;
  return { ok: true };
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

async function ensureDetectDbSeeded(dbName: string, logLines: string[], failures: string[]) {
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
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.execute(`USE \`${dbName}\``);

    await conn.execute(
      "CREATE TABLE IF NOT EXISTS machines (id INT AUTO_INCREMENT PRIMARY KEY, is_online TINYINT NOT NULL, last_check_in DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    );
    await conn.execute(
      "CREATE TABLE IF NOT EXISTS nip (nip_no VARCHAR(64) PRIMARY KEY, isp VARCHAR(64) NOT NULL, create_date DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    );
    await conn.execute(
      "CREATE TABLE IF NOT EXISTS record (id INT AUTO_INCREMENT PRIMARY KEY, nip_no VARCHAR(64) NOT NULL, create_date DATETIME NOT NULL, INDEX idx_create_date (create_date), INDEX idx_nip_no (nip_no)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    );

    await conn.execute("DELETE FROM record WHERE nip_no LIKE 'phase93-%'");
    await conn.execute("DELETE FROM nip WHERE nip_no LIKE 'phase93-%'");

    const isps = [
      { isp: "AIS", nip: "phase93-ais" },
      { isp: "TRUE", nip: "phase93-true" },
      { isp: "DTAC", nip: "phase93-dtac" },
      { isp: "3BB", nip: "phase93-3bb" },
    ];
    for (const x of isps) {
      await conn.execute("INSERT INTO nip (nip_no, isp, create_date) VALUES (?, ?, NOW())", [x.nip, x.isp]);
    }

    const now = new Date();
    const mkDate = (offsetDays: number, hour: number) => {
      const d = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      d.setHours(hour, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
    };

    const insertMany = async (nipNo: string, dt: string, count: number) => {
      for (let i = 0; i < count; i++) {
        await conn!.execute("INSERT INTO record (nip_no, create_date) VALUES (?, ?)", [nipNo, dt]);
      }
    };

    // Deterministic non-zero proof:
    // - yesterday total > 0
    // - AIS is top
    // - 7-day trend has at least one non-zero
    await insertMany("phase93-ais", mkDate(-1, 9), 12);
    await insertMany("phase93-true", mkDate(-1, 9), 5);
    await insertMany("phase93-dtac", mkDate(-1, 9), 3);
    await insertMany("phase93-3bb", mkDate(-1, 9), 2);

    await insertMany("phase93-ais", mkDate(-6, 9), 1);
    await insertMany("phase93-ais", mkDate(-3, 9), 2);
    await insertMany("phase93-3bb", mkDate(-2, 9), 1);
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
  const evidenceLog = path.join(evidenceDir, `phase93-${stamp}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  const evConnMod: any = await import("../src/utils/db/evidenceConnection");
  const closeEvidencePool: undefined | (() => Promise<void>) = evConnMod?.closeEvidencePool;

  const { port, stop } = await startEphemeralServer();
  logLines.push(`phase93 verifier start: port=${port}`);

  const bannedTextNeedles = ["Access denied", "ER_ACCESS_DENIED", "jlapps"]; // user-visible / noisy markers

  try {
    // ------------------------------------------------------------
    // Case A: creds unset => placeholder + polite note
    // ------------------------------------------------------------
    setEnvForMissingDetectDbCreds();
    if (closeEvidencePool) await closeEvidencePool();

    const qA = "เมื่อวาน evidence แยกตาม ISP และใครมากสุด";
    const rA = await postJson(
      port,
      "/api/chat",
      { message: qA, messages: [] },
      { "X-Smoke-Run": "1", "X-Correlation-Id": `phase93-${stamp}-missing` },
    );

    const tA = String((rA.json as ChatResponse)?.text || rA.raw || "");
    const scA = (rA.json as ChatResponse)?.structuredContent;

    logLines.push("CaseA text: " + tA.replace(/\s+/g, " ").slice(0, 240));
    assertOk(getScRoute(scA) === "evidence", "CaseA: structuredContent.__render.route must be evidence", failures);
    assertOk(scA?.meta?.dataSource === "placeholder", "CaseA: structuredContent.meta.dataSource must be placeholder", failures);
    assertOk(typeof scA?.meta?.note === "string" && scA.meta.note.length > 0, "CaseA: structuredContent.meta.note must be present", failures);
    assertOk(!/^ERR:/i.test(tA.trim()), "CaseA: user-visible text must not start with ERR:", failures);
    assertOk(!looksLikeBadLeak(tA), "CaseA: must not leak env/secrets into text", failures);
    assertNotContainsAny(JSON.stringify(rA.json || {}), ["process.env", "DETECT_DB_PASSWORD", "authorization", "bearer"], "CaseA", failures);
    assertNotContainsAny(tA, bannedTextNeedles, "CaseA-text", failures);

    // ------------------------------------------------------------
    // Case B: docker seed => detectdb + KPI/rows/series not all zero
    // ------------------------------------------------------------
    const dbName = "phase93_detectdb";
    await ensureDetectDbSeeded(dbName, logLines, failures);
    const envOk = setEnvForRealDetectDb(dbName);
    if (!envOk.ok) {
      failures.push(`BLOCKED:${envOk.code}`);
      logLines.push(`detectdb blocked: missing env MARIADB_ROOT_PASSWORD/MARIADB_PASSWORD`);
    }
    if (closeEvidencePool) await closeEvidencePool();

    if (envOk.ok) {
      // Case C (as spec): yesterday + ISP + most => table.rows >= 3
      const qC = "เมื่อวาน + ISP + มากที่สุด";
      const rC = await postJson(
        port,
        "/api/chat",
        { message: qC, messages: [] },
        { "X-Smoke-Run": "1", "X-Correlation-Id": `phase93-${stamp}-isp` },
      );

      const tC = String((rC.json as ChatResponse)?.text || rC.raw || "");
      const scC = (rC.json as ChatResponse)?.structuredContent;

      logLines.push("CaseC text: " + tC.replace(/\s+/g, " ").slice(0, 260));
      assertOk(getScRoute(scC) === "evidence", "CaseC: structuredContent.__render.route must be evidence", failures);
      assertOk(scC?.meta?.dataSource === "detectdb", "CaseC: structuredContent.meta.dataSource must be detectdb", failures);
      assertOk(Array.isArray(scC?.table?.rows), "CaseC: structuredContent.table.rows must be array", failures);
      assertOk((scC?.table?.rows?.length || 0) >= 3, "CaseC: structuredContent.table.rows must have >= 3 rows", failures);

      const rows: any[] = Array.isArray(scC?.table?.rows) ? scC.table.rows : [];
      assertOk(rows.some((r) => Number(r?.count ?? r?.c ?? 0) > 0), "CaseC: table must include at least one non-zero count", failures);
      assertOk(typeof scC?.kpis?.total === "number" && scC.kpis.total > 0, "CaseC: kpis.total must be > 0", failures);
      assertOk(typeof scC?.kpis?.topIspName === "string" && scC.kpis.topIspName !== "(ยังไม่มีข้อมูล)", "CaseC: topIspName must be real", failures);
      assertOk(typeof scC?.kpis?.topIspCount === "number" && scC.kpis.topIspCount > 0, "CaseC: topIspCount must be > 0", failures);

      assertOk(!looksLikeBadLeak(tC), "CaseC: must not leak env/secrets into text", failures);
      assertNotContainsAny(tC, bannedTextNeedles, "CaseC-text", failures);

      // Case B extra: trend series proof (7 points, date format, some > 0)
      const qB = "แนวโน้มหลักฐาน 7 วันล่าสุด";
      const rB = await postJson(
        port,
        "/api/chat",
        { message: qB, messages: [] },
        { "X-Smoke-Run": "1", "X-Correlation-Id": `phase93-${stamp}-trend` },
      );

      const tB = String((rB.json as ChatResponse)?.text || rB.raw || "");
      const scB = (rB.json as ChatResponse)?.structuredContent;

      logLines.push("CaseB text: " + tB.replace(/\s+/g, " ").slice(0, 260));
      assertOk(getScRoute(scB) === "evidence", "CaseB: structuredContent.__render.route must be evidence", failures);
      assertOk(scB?.meta?.dataSource === "detectdb", "CaseB: structuredContent.meta.dataSource must be detectdb", failures);
      assertOk(Array.isArray(scB?.series?.points), "CaseB: structuredContent.series.points must be array", failures);
      assertOk((scB?.series?.points?.length || 0) === 7, "CaseB: structuredContent.series.points must have 7 points", failures);

      const pts: Array<{ date: string; count: number }> = Array.isArray(scB?.series?.points) ? scB.series.points : [];
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      for (const [idx, p] of pts.entries()) {
        const d = String((p as any)?.date || "").slice(0, 10);
        const c = Number((p as any)?.count ?? (p as any)?.c ?? 0);
        assertOk(dateRe.test(d), `CaseB: points[${idx}].date must be YYYY-MM-DD`, failures);
        assertOk(Number.isFinite(c), `CaseB: points[${idx}].count must be number`, failures);
      }
      assertOk(pts.some((p: any) => Number(p?.count ?? 0) > 0), "CaseB: at least one day must have count > 0 (real detectdb proof)", failures);

      assertOk(!looksLikeBadLeak(tB), "CaseB: must not leak env/secrets into text", failures);
      assertNotContainsAny(tB, bannedTextNeedles, "CaseB-text", failures);

      const rawAll = JSON.stringify({ A: rA.json, C: rC.json, B: rB.json });
      assertNotContainsAny(rawAll, ["process.env", "DETECT_DB_PASSWORD", "EVIDENCE_DB_PASSWORD", "authorization", "bearer"], "GLOBAL", failures);
    }
  } finally {
    await stop();
    if (closeEvidencePool) {
      try {
        await closeEvidencePool();
      } catch {
        // ignore
      }
    }
  }

  const ok = failures.length === 0;
  logLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    logLines.push("FAILURES:");
    for (const f of failures) logLines.push("- " + f);
  }

  fs.writeFileSync(evidenceLog, logLines.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidenceLog}`);

  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify_phase93_detectdb_real_connect failed:", err);
  process.exit(1);
});
