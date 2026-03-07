import fs from "fs";
import { withDbConnection } from "./src/utils/db";

async function run() {
  await withDbConnection(async (conn) => {
    console.log("Reading 01-tables.sql");
    const t1 = fs.readFileSync("database/init/01-tables.sql", "utf8");
    await conn.query(t1);

    console.log("Reading 03-seed-thai-geo.sql");
    const t2 = fs.readFileSync("database/init/03-seed-thai-geo.sql", "utf8");
    const stmts = t2.split(';').filter(s => s.trim().length > 0);
    
    for (let s of stmts) {
       await conn.query(s);
    }
    console.log("Done seeding!");
  });
  process.exit(0);
}
run();
