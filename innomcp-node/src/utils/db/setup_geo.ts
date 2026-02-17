
import { executeQuery } from './connector';

const PROVINCES_SEED = [
  {
    id: "PROV-10",
    name_th: "กรุงเทพมหานคร",
    aliases: ["กทม", "Bangkok", "Krung Thep"],
    description: "เมืองหลวงและศูนย์กลางเศรษฐกิจของประเทศไทย",
    attributes: { lat: 13.7563, lon: 100.5018, region: "กลาง" },
    confidence: 1.0,
    source: ["DOPA", "OSM"]
  },
  {
    id: "PROV-50",
    name_th: "เชียงใหม่",
    aliases: ["Chiang Mai", "เวียงพิงค์", "นพบุรีศรีนครพิงค์"],
    description: "จังหวัดศูนย์กลางของภาคเหนือ มีดอยอินทนนท์สูงสุดในไทย",
    attributes: { lat: 18.7932, lon: 98.9853, region: "เหนือ" },
    confidence: 1.0,
    source: ["DOPA", "OSM"]
  },
  {
    id: "PROV-40",
    name_th: "ขอนแก่น",
    aliases: ["Khon Kaen", "เมืองหมอแคน"],
    description: "ศูนย์กลางการศึกษาและเศรษฐกิจของภาคตะวันออกเฉียงเหนือ",
    attributes: { lat: 16.4322, lon: 102.8236, region: "ตะวันออกเฉียงเหนือ" },
    confidence: 1.0,
    source: ["DOPA", "OSM"]
  },
  {
    id: "PROV-83",
    name_th: "ภูเก็ต",
    aliases: ["Phuket", "ไข่มุกอันดามัน"],
    description: "เกาะที่ใหญ่ที่สุดในไทย แหล่งท่องเที่ยวระดับโลก",
    attributes: { lat: 7.8804, lon: 98.3923, region: "ใต้" },
    confidence: 1.0,
    source: ["DOPA", "OSM"]
  },
  {
    id: "PROV-95",
    name_th: "ยะลา",
    aliases: ["Yala", "ใต้สุดสยาม"],
    description: "จังหวัดทางใต้สุดของไทย มีผังเมืองสวยงาม",
    attributes: { lat: 6.540, lon: 101.280, region: "ใต้" },
    confidence: 1.0,
    source: ["DOPA", "OSM"]
  }
];

async function setup() {
  try {
    console.log("🛠️  Setting up Thai Knowledge Database...");

    const ensureColumn = async (tableName: string, columnName: string, alterSql: string) => {
      const rows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
      ) as Array<{ cnt: number }>;

      const cnt = Number((rows?.[0] as any)?.cnt ?? 0);
      if (cnt === 0) {
        console.log(`🧩 Migrating: adding missing column ${tableName}.${columnName} ...`);
        await executeQuery(alterSql);
        console.log(`✅ Column added: ${tableName}.${columnName}`);
      }
    };

    const ensureIndex = async (tableName: string, indexName: string, createSql: string) => {
      const rows = await executeQuery(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?`,
        [tableName, indexName]
      ) as Array<{ cnt: number }>;

      const cnt = Number((rows?.[0] as any)?.cnt ?? 0);
      if (cnt === 0) {
        console.log(`🧩 Migrating: creating missing index ${tableName}.${indexName} ...`);
        await executeQuery(createSql);
        console.log(`✅ Index created: ${tableName}.${indexName}`);
      }
    };

    // 1. Create Table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS knowledge_entities (
        id VARCHAR(32) PRIMARY KEY,
        domain VARCHAR(20) NOT NULL,
        entity_type VARCHAR(32) NOT NULL,
        name_th VARCHAR(255) NOT NULL,
        aliases JSON,
        description TEXT,
        attributes JSON,
        confidence FLOAT DEFAULT 1.0,
        source JSON,
        INDEX idx_domain (domain),
        INDEX idx_entity (entity_type),
        FULLTEXT INDEX idx_name (name_th)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await executeQuery(createTableSQL);
    console.log("✅ Table 'knowledge_entities' verified/created.");

    // 1.5 Backward-compatible migration for older schemas (CREATE IF NOT EXISTS won't alter)
    await ensureColumn(
      'knowledge_entities',
      'entity_type',
      `ALTER TABLE knowledge_entities
        ADD COLUMN entity_type VARCHAR(32) NOT NULL DEFAULT 'unknown' AFTER domain;`
    );

    await ensureIndex(
      'knowledge_entities',
      'idx_domain',
      `CREATE INDEX idx_domain ON knowledge_entities (domain);`
    );

    await ensureIndex(
      'knowledge_entities',
      'idx_entity',
      `CREATE INDEX idx_entity ON knowledge_entities (entity_type);`
    );

    // FULLTEXT may not be supported depending on engine/version; keep best-effort.
    try {
      await ensureIndex(
        'knowledge_entities',
        'idx_name',
        `CREATE FULLTEXT INDEX idx_name ON knowledge_entities (name_th);`
      );
    } catch (e) {
      console.log('⚠️ FULLTEXT index skipped (not supported or already exists).');
    }

    // 2. Seed Data
    console.log("🌱 Seeding initial provinces...");
    
    for (const p of PROVINCES_SEED) {
      const sql = `
        INSERT INTO knowledge_entities 
        (id, domain, entity_type, name_th, aliases, description, attributes, confidence, source)
        VALUES (?, 'geo', 'province', ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name_th=VALUES(name_th), 
          aliases=VALUES(aliases),
          description=VALUES(description),
          attributes=VALUES(attributes);
      `;
      
      await executeQuery(sql, [
        p.id, 
        p.name_th, 
        JSON.stringify(p.aliases), 
        p.description, 
        JSON.stringify(p.attributes), 
        p.confidence, 
        JSON.stringify(p.source)
      ]);
    }

    console.log(`✅ Seeded ${PROVINCES_SEED.length} provinces successfully.`);
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

setup();
