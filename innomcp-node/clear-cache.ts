import { withDbConnection } from './src/utils/db';

async function clearCache() {
  try {
    await withDbConnection(async (conn) => {
        await conn.query('TRUNCATE TABLE tool_cache;');
    });
    console.log('Successfully truncated tool_cache table');
  } catch (e) {
    console.error('Error truncating cache:', e);
  } finally {
    process.exit(0);
  }
}

clearCache();
