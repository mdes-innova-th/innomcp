import mysql, { Pool, PoolConnection } from "mysql2/promise";
import "dotenv/config";

// Singleton Pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // console.log("[db] Creating MySQL Pool...");
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}

// Generic query function used by tools
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const p = getPool();
  try {
    const [rows] = await p.execute(sql, params);
    return rows as T;
  } catch (error) {
    console.error("[db] Query Error:", error);
    throw error;
  }
}

// Compatibility functions (if used by other parts)
export async function connectWithRetry(): Promise<PoolConnection> {
  return getPool().getConnection();
}

export async function withDbConnection<T>(
  operation: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    return await operation(connection);
  } finally {
    connection.release();
  }
}
