import mysql, { Connection } from "mysql2/promise";
import "dotenv/config";

// ฟังก์ชันหลักสำหรับเชื่อมต่อฐานข้อมูล DASHBOARD พร้อมปิดการเชื่อมต่ออัตโนมัติ
export async function withDashbDbConnection<T>(
  operation: (connection: Connection) => Promise<T>
): Promise<T> {
  let connection: Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_DASHB_HOST,
      port: Number(process.env.DB_DASHB_PORT),
      user: process.env.DB_DASHB_USER,
      password: process.env.DB_DASHB_PASSWORD,
      database: process.env.DB_DASHB_NAME,
      charset: "utf8mb4",
      connectTimeout: 10000, // 10 seconds
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    await connection.ping();
    console.log("[dbdashb] Database connection established");

    const result = await operation(connection);
    return result;
  } catch (error) {
    console.error("Database operation failed:", error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log("[dbdashb] Database connection closed");
      } catch (closeError) {
        console.error("Error closing database connection:", closeError);
      }
    }
  }
}
