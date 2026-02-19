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
  const host = process.env.DETECT_DB_HOST || "209.15.105.27";
  const port = parseInt(process.env.DETECT_DB_PORT || "3306", 10);
  const user = process.env.DETECT_DB_USER || "root";
  const password = String(process.env.DETECT_DB_PASSWORD || "");
  const database = process.env.DETECT_DB_NAME || "detect";

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
    console.error("Detect Database connection failed:", error);
    return false;
  }
}
