<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-039 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1011,"completion_tokens":5116,"total_tokens":6127,"prompt_tokens_details":{"cached_tokens":896,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4424,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T12:10:12.924Z -->
FILE: innomcp-server-node/src/utils/db.ts
<<<<<<< SEARCH
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
=======
function getPool(): Pool {
  if (!pool) {
    const host = process.env.DB_HOST || '127.0.0.1';
    const portStr = process.env.DB_PORT;
    let port = 3306;
    if (portStr) {
      port = parseInt(portStr, 10);
      if (isNaN(port) || port <= 0) {
        console.warn('[db] Invalid DB_PORT "' + portStr + '", using default 3306');
        port = 3306;
      }
    }
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;
    if (!user || !database) {
      throw new Error('[db] Missing required environment variables: DB_USER and DB_NAME must be set.');
    }
    // console.log("[db] Creating MySQL Pool...");
    pool = mysql.createPool({
      host,
      port,
      user,
      password: password || '',
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/utils/db.ts
<<<<<<< SEARCH
// Compatibility functions (if used by other parts)
export async function connectWithRetry(): Promise<PoolConnection> {
  return getPool().getConnection();
}
=======
export async function connect(): Promise<PoolConnection> {
  return getPool().getConnection();
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/utils/db.ts
<<<<<<< SEARCH
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
=======
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

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
>>>>>>> REPLACE

SKIP: Low severity; unchecked type assertion is acceptable for now; runtime validation can be added later if needed.
