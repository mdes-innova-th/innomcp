import "dotenv/config";
import { query } from "../src/utils/db";
import { THAI_HISTORY_SEED } from "../src/mcp/tools/thaiHistoryTool";
import { THAI_LAW_SEED } from "../src/mcp/tools/thaiLawTool";

const shouldExec = process.argv.includes("--exec");

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id VARCHAR(64) NOT NULL,
  domain VARCHAR(50) NOT NULL COMMENT 'geo, law, history, religion, education',
  name_th VARCHAR(255) NOT NULL,
  aliases JSON DEFAULT NULL COMMENT 'Array of strings',
  description TEXT,
  attributes JSON DEFAULT NULL COMMENT 'Domain specific attributes',
  relations JSON DEFAULT NULL,
  source JSON DEFAULT NULL COMMENT '{name, url}',
  confidence DECIMAL(3,2) DEFAULT 1.00,
  version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_domain (domain),
  FULLTEXT KEY idx_ft_name_desc (name_th, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

type SeedEntity = {
  id: string;
  domain: string;
  name_th: string;
  aliases?: string[];
  description: string;
  attributes?: Record<string, unknown>;
  relations?: any[];
  source?: { name: string; url?: string };
  confidence?: number;
  version?: string;
};

function toSeedEntity(e: any): SeedEntity {
  return {
    id: e.id,
    domain: e.domain,
    name_th: e.name_th,
    aliases: e.aliases,
    description: e.description,
    attributes: e.attributes,
    relations: e.relations,
    source: e.source,
    confidence: e.confidence,
    version: e.version,
  };
}

async function main(): Promise<void> {
  const allSeeds: SeedEntity[] = [
    ...THAI_HISTORY_SEED.map(toSeedEntity),
    ...THAI_LAW_SEED.map(toSeedEntity),
  ];

  console.log("Phase 2 Seed: Thai History + Law");
  console.log(`Mode: ${shouldExec ? "EXEC" : "DRY-RUN"}`);
  console.log(`Total entities: ${allSeeds.length} (history: ${THAI_HISTORY_SEED.length}, law: ${THAI_LAW_SEED.length})`);

  const insertSql =
    "INSERT INTO knowledge_entities (id, domain, name_th, aliases, description, attributes, relations, source, confidence, version) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE " +
    "domain=VALUES(domain), name_th=VALUES(name_th), aliases=VALUES(aliases), description=VALUES(description), " +
    "attributes=VALUES(attributes), relations=VALUES(relations), source=VALUES(source), confidence=VALUES(confidence), " +
    "version=VALUES(version), updated_at=CURRENT_TIMESTAMP";

  if (shouldExec) {
    await query(CREATE_TABLE_SQL);
    console.log("ensured table: knowledge_entities");
  }

  for (const entity of allSeeds) {
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
    ];

    if (!shouldExec) {
      console.log(`[DRY-RUN] ${entity.id} (${entity.domain}) - ${entity.name_th}`);
      continue;
    }

    await query(insertSql, params);
    console.log(`upserted: ${entity.id} (${entity.domain})`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("seed_thai_history_law failed:", err);
  process.exitCode = 1;
});
