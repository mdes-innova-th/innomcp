
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'innomcp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const getDbConnection = async () => {
  return pool;
};

export const executeQuery = async (sql: string, params: any[] = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};
