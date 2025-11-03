import mysql, { Connection } from "mysql2/promise";
import "dotenv/config";

// กำหนดค่าการลองใหม่สำหรับการเชื่อมต่อฐานข้อมูล
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 วินาที

// ฟังก์ชันดำเนินการกับฐานข้อมูลและจัดการการเชื่อมต่อ
export async function withDbConnection<T>(
  operation: (connection: Connection) => Promise<T>
): Promise<T> {
  let connection;
  try {
    connection = await connectWithRetry();
    return await operation(connection);
  } catch (error) {
    console.error("Database operation error:", error);
    throw error;
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

// ฟังก์ชันสำหรับลองเชื่อมต่อฐานข้อมูลใหม่
export async function connectWithRetry(
  retries = MAX_RETRIES
): Promise<Connection> {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
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
      return connectWithRetry(retries - 1);
    }
    console.error("Database connection failed after maximum retries");
    throw error;
  }
}
