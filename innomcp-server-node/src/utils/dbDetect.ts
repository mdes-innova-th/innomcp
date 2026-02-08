import mysql from "mysql2/promise";

// Evidence / Detect database configuration
export const detectDbConfig = {
  host: process.env.DETECT_DB_HOST || "209.15.105.27",
  port: parseInt(process.env.DETECT_DB_PORT || "3306", 10),
  user: process.env.DETECT_DB_USER || "root",
  password: process.env.DETECT_DB_PASSWORD || "1nN0!-@-#$",
  database: process.env.DETECT_DB_NAME || "detect",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: "utf8mb4",
};

export const poolDetect = mysql.createPool(detectDbConfig);

export async function queryDetect<T>(
  sql: string,
  params?: any[],
): Promise<T[]> {
  const [rows] = await poolDetect.execute(sql, params);
  return rows as T[];
}

export async function checkDetectConnection(): Promise<boolean> {
  try {
    const connection = await poolDetect.getConnection();
    connection.release();
    return true;
  } catch (error) {
    console.error("Detect Database connection failed:", error);
    return false;
  }
}
