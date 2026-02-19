
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

// Ensure env is loaded for standalone scripts, but prefer explicit process env (e.g., `DETECT_DB_*`).
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

type DetectDbConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    waitForConnections: boolean;
    connectionLimit: number;
    queueLimit: number;
    enableKeepAlive: boolean;
    keepAliveInitialDelay: number;
};

function resolveDetectDbConfig(): DetectDbConfig {
    const host =
        process.env.DETECT_DB_HOST ||
        process.env.EVIDENCE_DB_HOST ||
        process.env.DB_HOST ||
        "localhost";

    const port =
        Number(process.env.DETECT_DB_PORT || process.env.EVIDENCE_DB_PORT || process.env.DB_PORT || "3306") ||
        3306;

    const user =
        process.env.DETECT_DB_USER ||
        process.env.EVIDENCE_DB_USER ||
        process.env.DB_USER ||
        "root";

    const password =
        process.env.DETECT_DB_PASSWORD ||
        process.env.EVIDENCE_DB_PASSWORD ||
        process.env.DB_PASSWORD ||
        "";

    const database =
        process.env.DETECT_DB_NAME ||
        process.env.EVIDENCE_DB_NAME ||
        "detect";

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
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
    };
}

// Singleton Pool (lazy init so we can fail fast on missing creds)
let pool: mysql.Pool | null = null;

export const getEvidencePool = (): mysql.Pool => {
    if (!pool) {
        const dbConfig = resolveDetectDbConfig();
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
        // Keep logs safe (no SQL text dump in production logs)
        console.error(`[EvidenceDB] Query Failed: ${String(error?.message || error)}`);

        if (error?.code === "ETIMEDOUT" || error?.code === "ECONNREFUSED") {
            console.error("[EvidenceDB] Remote DB Unreachable.");
        }
        throw error;
    }
};
