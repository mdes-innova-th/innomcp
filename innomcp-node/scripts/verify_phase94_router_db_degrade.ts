import http from "http";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import mysql from "mysql2/promise";

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function assertOk(cond: any, msg: string, failures: string[]) {
  if (!cond) failures.push(msg);
}

function trimLine(s: any): string {
  return String(s || "").replace(/\s+/g, " ").trim();
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
          "X-Smoke-Run": "1",
          "X-Correlation-Id": `phase94-${started}`,
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

async function seedDb(logs: string[], failures: string[], dbName: string) {
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
        } catch {
          // ignore
        }
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
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS keyword_training (
        id INT AUTO_INCREMENT PRIMARY KEY,
        keyword VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL,
        confidence_score DECIMAL(5,2) NOT NULL DEFAULT 0.90,
        priority_level VARCHAR(16) NOT NULL DEFAULT 'high'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.execute("DELETE FROM keyword_training WHERE keyword LIKE 'phase94-%'");
    await conn.execute(
      "INSERT INTO keyword_training (keyword, category, confidence_score, priority_level) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      ["phase94-ทั่วไป", "general", 0.95, "high", "phase94-อากาศ", "weather", 0.93, "high"]
    );
    logs.push("seed: keyword_training rows inserted=2");
  } catch (e: any) {
    failures.push(`BLOCKED:SEED_FAILED:${String(e?.message || e)}`);
  } finally {
    if (conn) await conn.end();
  }
}

async function startServer() {
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
  process.env.NODE_ENV = "test";

  const stamp = nowStamp();
  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = path.join(evidenceDir, `phase94-${stamp}.log`);

  const logs: string[] = [];
  const failures: string[] = [];

  // Case A: DB down -> snapshot/defaults + general chat still responds quickly
  process.env.GODTIER_KEYWORDS_SOURCE = "auto";
  process.env.DB_HOST = "127.0.0.1";
  process.env.DB_PORT = "3399";
  process.env.DB_USER = "root";
  process.env.DB_PASSWORD = "invalid";
  process.env.DB_NAME = "phase94_down";

  const { GodTierRouter } = await import("../src/utils/mcp/godTierRouter");
  const routerA = new GodTierRouter();
  const routeA = await routerA.route("phase94-ทั่วไป ช่วยอธิบายระบบนี้แบบสั้นๆ");
  logs.push(`CaseA route: category=${routeA.category} source=${routeA.keywordSource || "-"} dbOperational=${routeA.dbOperational === true ? "up" : "down"} usedFallback=${routeA.usedFallback}`);
  assertOk(routeA.keywordSource === "snapshot" || routeA.keywordSource === "defaults", "CaseA: keywordSource must be snapshot/defaults when DB down", failures);
  assertOk(routeA.dbOperational === false, "CaseA: dbOperational must be false when DB down", failures);

  const srvA = await startServer();
  try {
    const r = await postJson(srvA.port, {
      message: "ช่วยอธิบายว่า MCP คืออะไรแบบสั้นๆ",
      messages: [],
    });
    const text = trimLine(String(r.json?.text || r.json?.message || r.raw || ""));
    logs.push(`CaseA chat: status=${r.status} ms=${r.ms} text='${text.slice(0, 120)}'`);
    assertOk(r.status === 200, "CaseA: /api/chat must return HTTP 200", failures);
    assertOk(text.length > 0, "CaseA: chat general response must not be empty", failures);
    assertOk(r.ms <= 20000, `CaseA: chat must respond within budget (<=20000ms), got ${r.ms}ms`, failures);
  } finally {
    await srvA.stop();
  }

  // Case B: DB up + minimal seed -> keywordSource=db and dbOperational=true
  const dbName = "phase94_router";
  await seedDb(logs, failures, dbName);

  const pwd = getMariadbPasswordOrEmpty();
  if (!pwd) {
    failures.push("BLOCKED:MISSING_MARIADB_PASSWORD_ENV");
    logs.push("CaseB blocked: missing MARIADB_ROOT_PASSWORD/MARIADB_PASSWORD env");
  } else {
    process.env.GODTIER_KEYWORDS_SOURCE = "db";
    process.env.DB_HOST = "127.0.0.1";
    process.env.DB_PORT = "3308";
    process.env.DB_USER = "root";
    process.env.DB_PASSWORD = pwd;
    process.env.DB_NAME = dbName;

    const routerB = new GodTierRouter();
    const routeB = await routerB.route("phase94-ทั่วไป ช่วยสรุปความสามารถระบบ");
    logs.push(`CaseB route: category=${routeB.category} source=${routeB.keywordSource || "-"} dbOperational=${routeB.dbOperational === true ? "up" : "down"} usedFallback=${routeB.usedFallback}`);
    assertOk(routeB.keywordSource === "db", "CaseB: keywordSource must be db when DB seeded/up", failures);
    assertOk(routeB.dbOperational === true, "CaseB: dbOperational must be true when DB seeded/up", failures);
  }

  const ok = failures.length === 0;
  logs.push(ok ? "SUMMARY: router db degrade pass (down->fallback, up->db)" : "SUMMARY: router db degrade failed");
  logs.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) {
    logs.push("FAILURES:");
    for (const f of failures) logs.push(`- ${f}`);
  }

  fs.writeFileSync(evidence, logs.join("\n") + "\n", "utf8");
  console.log(`evidence: ${evidence}`);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("verify_phase94_router_db_degrade failed:", err);
  process.exit(1);
});
