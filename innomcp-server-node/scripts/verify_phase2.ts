import "dotenv/config";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { query } from "../src/utils/db";
import { thaiHistoryTool } from "../src/mcp/tools/thaiHistoryTool";
import { thaiLawTool } from "../src/mcp/tools/thaiLawTool";

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function buildDbCandidates(): DbConfig[] {
  const hosts = uniq(
    [process.env.DB_HOST, "127.0.0.1", "localhost"]
      .map((v) => String(v || "").trim())
      .filter(Boolean),
  );
  const ports = uniq(
    [process.env.DB_PORT, "3306", "3308"]
      .map((v) => Number(String(v || "").trim()))
      .filter((v) => Number.isFinite(v) && v > 0),
  );
  const databases = uniq(
    [process.env.DB_NAME, process.env.MYSQL_DATABASE, process.env.MARIADB_DATABASE, "innomcp"]
      .map((v) => String(v || "").trim())
      .filter(Boolean),
  );

  const credentials = uniq(
    [
      `${String(process.env.DB_USER || "").trim()}\u0000${String(process.env.DB_PASSWORD || "").trim()}`,
      `${String(process.env.MARIADB_USER || "").trim()}\u0000${String(process.env.MARIADB_PASSWORD || "").trim()}`,
      `root\u0000${String(process.env.MARIADB_ROOT_PASSWORD || "").trim()}`,
    ].filter((v) => {
      const [user] = v.split("\u0000");
      return Boolean(user);
    }),
  );

  const candidates: DbConfig[] = [];
  for (const host of hosts) {
    for (const port of ports) {
      for (const database of databases) {
        for (const pair of credentials) {
          const [user, password] = pair.split("\u0000");
          candidates.push({ host, port, user, password: password || "", database });
        }
      }
    }
  }
  return candidates;
}

async function pickWorkingDbConfig(): Promise<DbConfig> {
  let lastErr: unknown;
  for (const cfg of buildDbCandidates()) {
    try {
      const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        connectTimeout: 2500,
      });
      await conn.query("SELECT 1");
      await conn.end();
      return cfg;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("No working DB config found");
}

async function ensureDbEnv(): Promise<void> {
  const selected = await pickWorkingDbConfig();
  process.env.DB_HOST = selected.host;
  process.env.DB_PORT = String(selected.port);
  process.env.DB_USER = selected.user;
  process.env.DB_PASSWORD = selected.password;
  process.env.DB_NAME = selected.database;
  console.log(
    `DB selected: host=${selected.host} port=${selected.port} user=${selected.user} db=${selected.database}`,
  );
}

function getToolText(result: any): string {
  assert.ok(result);
  assert.ok(Array.isArray(result.content));
  assert.equal(result.content[0]?.type, "text");
  return String(result.content[0].text ?? "");
}

function parseToolJson(result: any): any {
  return JSON.parse(getToolText(result));
}

async function main(): Promise<void> {
  console.log("🔎 verify_phase2: start");
  await ensureDbEnv();

  const counts = await query<any[]>(
    "SELECT domain, COUNT(*) as cnt FROM knowledge_entities WHERE domain IN ('history','law') GROUP BY domain",
  );
  console.log("DB counts:", counts);

  const countMap = new Map<string, number>();
  for (const row of Array.isArray(counts) ? counts : []) {
    countMap.set(String(row.domain), Number(row.cnt));
  }

  assert.ok((countMap.get("history") ?? 0) >= 1, "DB should have >= 1 history entity");
  assert.ok((countMap.get("law") ?? 0) >= 1, "DB should have >= 1 law entity");

  const historyRes = await thaiHistoryTool.execute({ query: "สุโขทัย" });
  const historyBody = parseToolJson(historyRes);
  console.log("historyBody:", historyBody);
  assert.equal(historyBody.domain, "history");
  assert.equal(historyBody.success, true);
  assert.ok(Array.isArray(historyBody.data));
  assert.ok(historyBody.data.length >= 1);

  const lawRes = await thaiLawTool.execute({ query: "พ.ร.บ. คอมฯ" });
  const lawText = getToolText(lawRes);
  console.log("lawText:", lawText);
  assert.ok(
    lawText.includes("พ.ร.บ. คอมฯ") || lawText.includes("พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์"),
    "law output should include Computer Crime Act",
  );
  assert.ok(
    lawText.includes("ม.") || lawText.includes("มาตรา"),
    "law output should include at least one legal section",
  );

  // Proof: sources should match seed
  assert.ok(Array.isArray(historyBody.source));
  assert.ok(
    historyBody.source.includes("Royal Thai Government Gazette"),
    "history source should include RTGG",
  );

  console.log("✅ verify_phase2: PASS");
}

main().catch((err) => {
  console.error("❌ verify_phase2: FAIL", err);
  process.exitCode = 1;
});
