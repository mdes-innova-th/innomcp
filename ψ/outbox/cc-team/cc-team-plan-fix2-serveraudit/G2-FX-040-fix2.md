<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-040 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1239,"completion_tokens":3437,"total_tokens":4676,"prompt_tokens_details":{"cached_tokens":1152,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3157,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:11:52.166Z -->
FILE: innomcp-server-node/src/utils/dbDetect.ts
<<<<<<< SEARCH
let poolDetect: mysql.Pool | null = null;

function getPoolDetect(): mysql.Pool {
  if (!poolDetect) {
    const cfg = resolveDetectDbConfig();
    poolDetect = mysql.createPool(cfg);
  }
  return poolDetect;
}
=======
let poolDetectPromise: Promise<mysql.Pool> | null = null;

async function getPoolDetect(): Promise<mysql.Pool> {
  return await (poolDetectPromise ??= (async () => {
    const cfg = resolveDetectDbConfig();
    return mysql.createPool(cfg);
  })());
}
>>>>>>> REPLACE
FILE: innomcp-server-node/src/utils/dbDetect.ts
<<<<<<< SEARCH
  const pool = getPoolDetect();
=======
  const pool = await getPoolDetect();
>>>>>>> REPLACE
FILE: innomcp-server-node/src/utils/dbDetect.ts
<<<<<<< SEARCH
    const connection = await getPoolDetect().getConnection();
    connection.release();
=======
    const pool = await getPoolDetect();
    const connection = await pool.getConnection();
    connection.release();
>>>>>>> REPLACE
