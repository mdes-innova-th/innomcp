import http from "http";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import mysql from "mysql2/promise";

type ChatResponse = { text?: string; structuredContent?: any };

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function assertOk(cond: any, message: string, failures: string[]) {
  if (!cond) failures.push(message);
}

function postJson(
  port: number,
  body: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: any; raw: string }> {
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

function getMariadbPasswordOrEmpty(): string {
  return process.env.MARIADB_ROOT_PASSWORD || process.env.MARIADB_PASSWORD || process.env.INNOMCP_MARIADB_PASSWORD || "";
}

function tryDockerCompose(composeFile: string, cwd: string, action: "up" | "down"): { ok: boolean; cmd: string; out: string } {
  const args =
    action === "up"
      ? ["-f", composeFile, "up", "-d", "--force-recreate", "--remove-orphans"]
      : ["-f", composeFile, "down", "-v", "--remove-orphans"];

  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: "docker", args: ["compose", ...args] },
    { cmd: "docker-compose", args },
  ];

  for (const a of attempts) {
    const r = spawnSync(a.cmd, a.args, { cwd, encoding: "utf8" });
    const out = String(r.stdout || "") + String(r.stderr || "");
    if (r.error && (r.error as any).code === "ENOENT") continue;
    if (r.status === 0) return { ok: true, cmd: `${a.cmd} ${a.args.join(" ")}`, out };
  }

  const x = attempts[0];
  return { ok: false, cmd: `${x.cmd} ${x.args.join(" ")}`, out: "docker compose command failed" };
}

async function seedDetectDb(dbName: string, logs: string[], failures: string[]) {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const composeFile = path.resolve(repoRoot, "mariadb", "docker-compose.yml");
  const pwd = getMariadbPasswordOrEmpty();
  if (!pwd) {
    failures.push("BLOCKED:MISSING_MARIADB_PASSWORD_ENV");
    return;
  }

  const down = tryDockerCompose(composeFile, path.dirname(composeFile), "down");
  logs.push(`docker down: ok=${down.ok} cmd=${down.cmd}`);
  const up = tryDockerCompose(composeFile, path.dirname(composeFile), "up");
  logs.push(`docker up: ok=${up.ok} cmd=${up.cmd}`);
  if (!up.ok) {
    failures.push("BLOCKED:DOCKER_NOT_AVAILABLE");
    return;
  }

  let conn: mysql.Connection | null = null;
  try {
    const deadline = Date.now() + 90_000;
    let lastErr: any = null;
    while (Date.now() < deadline) {
      try {
        conn = await mysql.createConnection({ host: "127.0.0.1", port: 3308, user: "root", password: pwd });
        await conn.ping();
        break;
      } catch (e: any) {
        lastErr = e;
        try {
          if (conn) await conn.end();
        } catch {}
        conn = null;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!conn) {
      failures.push(`BLOCKED:SEED_CONNECT_TIMEOUT:${String(lastErr?.message || lastErr || "unknown")}`);
      return;
    }

    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.execute(`USE \`${dbName}\``);

    await conn.execute(
      "CREATE TABLE IF NOT EXISTS machines (id INT AUTO_INCREMENT PRIMARY KEY, is_online TINYINT NOT NULL, last_check_in DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    await conn.execute(
      "CREATE TABLE IF NOT EXISTS nip (nip_no VARCHAR(64) PRIMARY KEY, isp VARCHAR(64) NOT NULL, create_date DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    await conn.execute(
      "CREATE TABLE IF NOT EXISTS record (id INT AUTO_INCREMENT PRIMARY KEY, nip_no VARCHAR(64) NOT NULL, create_date DATETIME NOT NULL, INDEX idx_create_date (create_date), INDEX idx_nip_no (nip_no)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    await conn.execute("DELETE FROM record WHERE nip_no LIKE 'phase95-%'");
    await conn.execute("DELETE FROM nip WHERE nip_no LIKE 'phase95-%'");

    const isps = [
      { isp: "AIS", nip: "phase95-ais" },
      { isp: "TRUE", nip: "phase95-true" },
      { isp: "DTAC", nip: "phase95-dtac" },
      { isp: "NT", nip: "phase95-nt" },
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

    const ins = async (nipNo: string, dt: string, count: number) => {
      for (let i = 0; i < count; i++) {
        await conn!.execute("INSERT INTO record (nip_no, create_date) VALUES (?, ?)", [nipNo, dt]);
      }
    };

    await ins("phase95-ais", mkDate(-1, 9), 11);
    await ins("phase95-true", mkDate(-1, 9), 4);
    await ins("phase95-dtac", mkDate(-1, 9), 2);
    await ins("phase95-nt", mkDate(-1, 9), 1);

    await ins("phase95-ais", mkDate(-6, 9), 1);
    await ins("phase95-true", mkDate(-4, 9), 1);
    await ins("phase95-dtac", mkDate(-2, 9), 1);

    logs.push("seed: detectdb rows inserted for yesterday/topISP/trend");
  } catch (e: any) {
    failures.push(`BLOCKED:SEED_FAILED:${String(e?.message || e)}`);
  } finally {
    if (conn) await conn.end();
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
  process.env.SMOKE_MODE = "1";
  process.env.CHAT_TRACE_QA = "1";
  process.env.LOG_DEBUG = "0";
  process.env.TS_NODE_CACHE = "false";

  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, `phase95-${stamp}.log`);

  const logs: string[] = [];
  const failures: string[] = [];

  const dbName = "phase95_detectdb";
  await seedDetectDb(dbName, logs, failures);

  const pwd = getMariadbPasswordOrEmpty();
  process.env.DETECT_DB_HOST = "127.0.0.1";
  process.env.DETECT_DB_PORT = "3308";
  process.env.DETECT_DB_USER = "root";
  process.env.DETECT_DB_PASSWORD = pwd;
  process.env.DETECT_DB_NAME = dbName;

  const { port, stop } = await startEphemeralServer();
  try {
    const q1 = "เมื่อวาน evidence แยกตาม ISP และใครมากสุด";
    const r1 = await postJson(port, { message: q1, messages: [] }, { "X-Smoke-Run": "1", "X-Correlation-Id": `phase95-${stamp}-isp` });
    const sc1 = (r1.json as ChatResponse)?.structuredContent;

    const rows: any[] = Array.isArray(sc1?.table?.rows) ? sc1.table.rows : [];
    const rowNames = rows.map((r) => String(r?.isp || "").trim());
    const topName = String(sc1?.kpis?.topIspName || "").trim();
    logs.push(`CaseISP: status=${r1.status} rows=${rows.length} top=${topName || "-"}`);

    assertOk(r1.status === 200, "CaseISP: HTTP status must be 200", failures);
    assertOk(sc1?.meta?.dataSource === "detectdb", "CaseISP: meta.dataSource must be detectdb", failures);
    assertOk(rows.length >= 3, "CaseISP: table rows must be >= 3", failures);
    assertOk(topName.length > 0 && topName !== "(ยังไม่มีข้อมูล)", "CaseISP: topIspName must be non-empty real name", failures);
    assertOk(rowNames.some((n) => n.length > 0 && n !== "(ยังไม่มีข้อมูล)"), "CaseISP: table must include non-empty ISP names", failures);

    const q2 = "แนวโน้มหลักฐาน 7 วันล่าสุด";
    const r2 = await postJson(port, { message: q2, messages: [] }, { "X-Smoke-Run": "1", "X-Correlation-Id": `phase95-${stamp}-trend` });
    const sc2 = (r2.json as ChatResponse)?.structuredContent;

    const pts: Array<{ date: string; count: number }> = Array.isArray(sc2?.series?.points) ? sc2.series.points : [];
    const trendSum = pts.reduce((acc, p) => acc + (Number((p as any)?.count ?? 0) || 0), 0);
    logs.push(`CaseTrend: status=${r2.status} points=${pts.length} trendSum=${trendSum}`);

    assertOk(r2.status === 200, "CaseTrend: HTTP status must be 200", failures);
    assertOk(sc2?.meta?.dataSource === "detectdb", "CaseTrend: meta.dataSource must be detectdb", failures);
    assertOk(pts.length === 7, "CaseTrend: series points must be exactly 7", failures);
    assertOk(trendSum > 0, "CaseTrend: trend sum must be > 0", failures);
    for (const [idx, p] of pts.entries()) {
      const d = String((p as any)?.date || "").slice(0, 10);
      assertOk(/^\d{4}-\d{2}-\d{2}$/.test(d), `CaseTrend: points[${idx}].date must be YYYY-MM-DD`, failures);
    }
  } finally {
    await stop();
    try {
      const evConnMod: any = await import("../src/utils/db/evidenceConnection");
      if (typeof evConnMod?.closeEvidencePool === "function") {
        await evConnMod.closeEvidencePool();
      }
    } catch {
      // ignore
    }
  }

  const ok = failures.length === 0;
  logs.push(ok ? "SUMMARY: detectdb real stats quality PASS (isp/top/trend)" : "SUMMARY: detectdb real stats quality FAIL");
  logs.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    logs.push("FAILURES:");
    for (const f of failures) logs.push(`- ${f}`);
  }

  fs.writeFileSync(evidence, logs.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidence}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("verify_phase95_evidence_real_quality failed:", err);
  process.exit(1);
});
