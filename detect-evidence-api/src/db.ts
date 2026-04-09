/**
 * Detect DB connection pool
 * Connects to the external detect database (209.15.105.27)
 * Tables: nip, record, machines, sip, hash, log_login, user
 */
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DETECT_DB_HOST || "209.15.105.27",
      port: Number(process.env.DETECT_DB_PORT || 3306),
      user: process.env.DETECT_DB_USER || "root",
      password: process.env.DETECT_DB_PASSWORD || "",
      database: process.env.DETECT_DB_NAME || "detect",
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
      charset: "utf8mb4",
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  // Use query() not execute() — execute() uses prepared statements which
  // have issues with LIMIT parameters in some MySQL/MariaDB versions
  const [rows] = await getPool().query(sql, params);
  return rows as T;
}

export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await getPool().execute("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, error: e.message };
  }
}
