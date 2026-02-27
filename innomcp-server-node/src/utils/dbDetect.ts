import mysql from "mysql2/promise";

type DetectDbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: true;
  connectionLimit: number;
  queueLimit: number;
  charset: string;
};

function resolveDetectDbConfig(): DetectDbConfig {
  // Deterministic defaults:
  // - Host mode (Node on host, MariaDB in Docker): 127.0.0.1:3308
  // - Container mode (Node in Docker): mariadb:3306 (DB_HOST overridden in compose)
  // We still require explicit DETECT_DB_USER/PASSWORD/NAME to avoid accidental remote connections.
  const appDbHost = String(process.env.DB_HOST || "").trim();
  const isContainerMode = /^mariadb$/i.test(appDbHost);

  const host = String(process.env.DETECT_DB_HOST || (isContainerMode ? "mariadb" : "127.0.0.1")).trim();
  const portRaw = process.env.DETECT_DB_PORT || (isContainerMode ? "3306" : "3308");
  const port = parseInt(String(portRaw), 10) || (isContainerMode ? 3306 : 3308);
  const user = String(process.env.DETECT_DB_USER || "").trim();
  const password = String(process.env.DETECT_DB_PASSWORD || "");
  const database = String(process.env.DETECT_DB_NAME || "").trim();

  if (!host || !user || !database || !password) {
    const e: any = new Error("Detect DB is not configured (missing DETECT_DB_* credentials)");
    e.code = "MISSING_DETECT_DB_CREDS";
    throw e;
  }

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: "utf8mb4",
  };
}

let poolDetect: mysql.Pool | null = null;

function getPoolDetect(): mysql.Pool {
  if (!poolDetect) {
    const cfg = resolveDetectDbConfig();
    poolDetect = mysql.createPool(cfg);
  }
  return poolDetect;
}

export async function queryDetect<T>(
  sql: string,
  params?: any[],
): Promise<T[]> {
  const pool = getPoolDetect();
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function checkDetectConnection(): Promise<boolean> {
  try {
    const connection = await getPoolDetect().getConnection();
    connection.release();
    return true;
  } catch (error) {
    // Avoid noisy/secret-ish logs; callers should surface structured placeholder instead.
    console.error("Detect Database connection failed");
    return false;
  }
}
