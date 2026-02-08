import "dotenv/config";
import { query } from "../src/utils/db";
import { THAI_GEO_SEED } from "../src/mcp/tools/thaiGeoTool";

const shouldExec = process.argv.includes("--exec");

async function main(): Promise<void> {
  const insertSql =
    "INSERT INTO knowledge_entities (id, domain, name_th, aliases, description, attributes, relations, source, confidence, version, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  console.log("🌱 Thai GEO Seed");
  console.log(`Mode: ${shouldExec ? "EXEC" : "DRY-RUN"}`);
  console.log("Target table: knowledge_entities");
  console.log("Note: expects knowledge_entities.id to accept string IDs like geo:nakhon-ratchasima");

  for (const entity of THAI_GEO_SEED) {
    const params = [
      entity.id,
      entity.domain,
      entity.name_th,
      JSON.stringify(entity.aliases ?? []),
      entity.description,
      JSON.stringify(entity.attributes ?? {}),
      JSON.stringify(entity.relations ?? []),
      JSON.stringify(entity.source ?? { name: "unknown" }),
      entity.confidence ?? 1.0,
      entity.version ?? "1.0.0",
      entity.updated_at ?? new Date().toISOString(),
    ];

    if (!shouldExec) {
      console.log(insertSql);
      console.log(params);
      continue;
    }

    await query(insertSql, params);
    console.log(`✅ inserted: ${entity.id} (${entity.name_th})`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("❌ seed_thai_geo failed:", err);
  process.exitCode = 1;
});
