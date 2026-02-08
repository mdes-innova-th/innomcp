import { queryDetect } from "./src/utils/dbDetect";

(async () => {
  try {
    console.log("--- Tables ---");
    const tables = await queryDetect("SHOW TABLES");
    console.log(JSON.stringify(tables, null, 2));

    if (Array.isArray(tables) && tables.length > 0) {
      // Get first few tables to describe
      for (const t of tables) {
        const tableName = Object.values(t)[0];
        console.log(`--- Schema: ${tableName} ---`);
        const schema = await queryDetect(`DESCRIBE ${tableName}`);
        console.log(JSON.stringify(schema, null, 2));
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
