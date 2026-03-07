import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function argValue(flag: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === flag);
  if (idx < 0) return undefined;
  const val = process.argv[idx + 1];
  return typeof val === "string" && val.length > 0 ? val : undefined;
}

function dbCandidates(): string[] {
  const argDbName = argValue("--db-name");
  const fromEnv = [
    argDbName,
    process.env.DB_NAME,
    process.env.MYSQL_DATABASE,
    process.env.MARIADB_DATABASE,
    "innomcp",
    "innomcp-db",
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return Array.from(new Set(fromEnv));
}

async function connectDb() {
  const host = String(argValue("--db-host") || process.env.DB_HOST || "127.0.0.1").trim();
  const port = Number(String(argValue("--db-port") || process.env.DB_PORT || "3306").trim());
  const user = String(argValue("--db-user") || process.env.DB_USER || "root").trim();
  const password = String(argValue("--db-password") || process.env.DB_PASSWORD || "").trim();

  let lastErr: any;
  for (const database of dbCandidates()) {
    try {
      const conn = await mysql.createConnection({ host, port, user, password, database });
      return { conn, database };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Unable to connect database");
}

async function main() {
  const sqlPath = path.join(__dirname, "..", "..", "database", "init", "03-seed-thai-geo.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }

  const seedSqlRaw = fs.readFileSync(sqlPath, "utf8").trim();
  const seedSql = seedSqlRaw
    .replace(/^\s*USE\s+`?[^`;\n]+`?\s*;\s*/gim, "")
    .trim();
  if (!seedSql) {
    throw new Error("Seed SQL is empty");
  }

  console.log("🌱 Phase1 GEO seed from database/init/03-seed-thai-geo.sql");
  const { conn, database } = await connectDb();
  console.log(`DB target: ${database}`);

  try {
    const [colRows] = await conn.query<any[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'knowledge_entities'"
      ,
      [database]
    );
    const columnSet = new Set((Array.isArray(colRows) ? colRows : []).map((r: any) => String(r?.COLUMN_NAME || "").toLowerCase()));

    let sqlToRun = seedSql;
    if (!columnSet.has("type")) {
      sqlToRun = sqlToRun
        .replace(/\(\s*id\s*,\s*domain\s*,\s*type\s*,\s*name_th\s*,\s*aliases\s*,\s*description\s*,\s*attributes\s*,\s*relations\s*,\s*source\s*,\s*confidence\s*,\s*version\s*\)/i, "(id, domain, name_th, aliases, description, attributes, relations, source, confidence, version)")
        .replace(/\('([^']+)'\s*,\s*'geo'\s*,\s*'province'\s*,/g, "('$1','geo',");
      console.log("ℹ️ schema has no `type` column, applied compatible SQL transform");
    }

    await conn.query(sqlToRun);
    const [rows] = await conn.query<any[]>(
      columnSet.has("type")
        ? "SELECT COUNT(*) AS cnt FROM knowledge_entities WHERE domain='geo' AND type='province'"
        : "SELECT COUNT(*) AS cnt FROM knowledge_entities WHERE domain='geo'"
    );
    const count = Number((rows?.[0] as any)?.cnt || 0);
    console.log(`✅ province_count=${count}`);

    if (count < 77) {
      throw new Error(`Expected at least 77 provinces after seed, got ${count}`);
    }

    console.log("RESULT: PASS");
  } finally {
    await conn.end();
  }
}

main().catch((err: any) => {
  console.error("seed_phase1_geo_roundB failed:", String(err?.message || err));
  console.log("RESULT: FAIL");
  process.exit(1);
});
