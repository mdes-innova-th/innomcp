
import { getDbConnection, executeQuery } from './connector';

async function check() {
  try {
    console.log("Testing DB Connection...");
    const rows = await executeQuery('SELECT 1 as val');
    console.log("Query Result:", rows);
    console.log("Connection OK.");
    process.exit(0);
  } catch (err) {
    console.error("Connection Failed:", err);
    process.exit(1);
  }
}

check();
