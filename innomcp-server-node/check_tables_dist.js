const { queryDetect } = require("./dist/utils/dbDetect");

(async () => {
  try {
    console.log("--- Tables ---");
    const tables = await queryDetect("SHOW TABLES");
    console.log(JSON.stringify(tables, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
