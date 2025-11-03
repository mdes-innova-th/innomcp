import mysql, { Connection } from "mysql2/promise";
import "dotenv/config";

// กำหนดค่าการลองใหม่สำหรับการเชื่อมต่อฐานข้อมูล
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 วินาที

// ฟังก์ชันสำหรับลองเชื่อมต่อฐานข้อมูลใหม่
export async function connectDbwebdWithRetry(
  retries = MAX_RETRIES
): Promise<Connection> {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: "db_webd",
      connectTimeout: 10000, // 10 วินาที
      connectionLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    // ทดสอบการเชื่อมต่อ
    await connection.ping();
    console.log("Database connection successful");
    return connection;
  } catch (error) {
    if (retries > 0) {
      console.log(
        `Database connection failed, retrying... (${
          MAX_RETRIES - retries + 1
        }/${MAX_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return connectDbwebdWithRetry(retries - 1);
    }
    console.error("Database connection failed after maximum retries");
    throw error;
  }
}

// ฟังก์ชันสำหรับใช้งาน connection แบบ callback และปิด connection อัตโนมัติ
export async function withDbwebdConnection<T>(
  callback: (conn: Connection) => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  const connection = await connectDbwebdWithRetry(retries);
  try {
    const result = await callback(connection);
    return result;
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log("Database connection closed");
      } catch (closeError) {
        console.error("Error closing database connection:", closeError);
      }
    }
  }
}
