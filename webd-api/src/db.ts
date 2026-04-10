/**
 * Web-D DB connection layer (db_aces / detect_bridge)
 *
 * Mode detection:
 * - WEBD_API_MODE=detect_bridge → bridge mode (queries detect.nip/record for court-order data)
 * - WEBD_DB_HOST set and reachable → "live" mode (real SQL against db_aces or detect bridge)
 * - Otherwise → "scaffold" mode (503 responses)
 *
 * Expected db_aces tables (normal mode):
 *   case_order, courtorder, case_data, case_listdata,
 *   case_record, isp, outdoc, sent, case_listdata_check
 *
 * Detect bridge tables (detect_bridge mode):
 *   nip → court_order, url, isp_name, status_open
 *   record → evidence linked via nip_no
 */
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;
let _mode: "live" | "scaffold" = "scaffold";

export function getMode(): "live" | "scaffold" {
  return _mode;
}

export function isDetectBridge(): boolean {
  return process.env.WEBD_API_MODE === "detect_bridge";
}

export function getPool(): mysql.Pool | null {
  if (!pool && isConfigured()) {
    pool = mysql.createPool({
      host: process.env.WEBD_DB_HOST!,
      port: Number(process.env.WEBD_DB_PORT || 3306),
      user: process.env.WEBD_DB_USER!,
      password: process.env.WEBD_DB_PASSWORD!,
      database: process.env.WEBD_DB_NAME || "db_aces",
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
      charset: "utf8mb4",
    });
  }
  return pool;
}

export function isConfigured(): boolean {
  return !!(process.env.WEBD_DB_HOST && process.env.WEBD_DB_USER && process.env.WEBD_DB_PASSWORD);
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const p = getPool();
  if (!p) throw new Error("WEBD_DB_NOT_CONFIGURED");
  const [rows] = await p.query(sql, params);
  return rows as T;
}

export async function healthCheck(): Promise<{ ok: boolean; mode: string; latencyMs: number; error?: string }> {
  if (!isConfigured()) {
    _mode = "scaffold";
    return { ok: false, mode: "scaffold", latencyMs: 0, error: "WEBD_DB_HOST/USER/PASSWORD not configured" };
  }
  const start = Date.now();
  try {
    const p = getPool();
    if (!p) throw new Error("Pool creation failed");
    await p.execute("SELECT 1");
    _mode = "live";
    return { ok: true, mode: "live", latencyMs: Date.now() - start };
  } catch (e: any) {
    _mode = "scaffold";
    return { ok: false, mode: "scaffold", latencyMs: Date.now() - start, error: e.message };
  }
}
