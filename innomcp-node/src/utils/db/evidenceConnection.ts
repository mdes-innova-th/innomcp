
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Ensure env is loaded (redundant if loaded in index, but safe for standalone usage)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const dbConfig = {
    host: process.env.EVIDENCE_DB_HOST || process.env.DB_HOST || 'localhost',
    user: process.env.EVIDENCE_DB_USER || process.env.DB_USER || 'root',
    password: process.env.EVIDENCE_DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.EVIDENCE_DB_NAME || 'detect',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Singleton Pool
let pool: mysql.Pool | null = null;

export const getEvidencePool = (): mysql.Pool => {
    if (!pool) {
        console.log(`[EvidenceDB] Connecting to ${dbConfig.host} / ${dbConfig.database}...`);
        pool = mysql.createPool(dbConfig);
    }
    return pool;
};

export const closeEvidencePool = async () => {
    if (pool) {
        await pool.end();
        pool = null;
        console.log("[EvidenceDB] Connection pool closed.");
    }
};

/**
 * Helper to execute a query and return rows.
 * Handles ping check lazily.
 */
export const queryEvidence = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
    try {
        const p = getEvidencePool();
        const [rows] = await p.execute(sql, params);
        return rows as T[];
    } catch (error: any) {
        console.error(`[EvidenceDB] Query Failed: ${error.message} (SQL: ${sql})`);
        
        // Timeout handling (implicit via mysql2 default or can be customized in config)
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
            console.error("[EvidenceDB] Remote DB Unreachable.");
        }
        throw error;
    }
};
