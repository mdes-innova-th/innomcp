/**
 * seed_workspace_files.ts
 *
 * อ่านไฟล์ TXT / PDF จาก workspace-storage/data/users/
 * แล้ว seed เข้า knowledge_entities table (domain=law หรือ auto-detect)
 *
 * Usage:
 *   npx ts-node scripts/seed_workspace_files.ts             # dry-run
 *   npx ts-node scripts/seed_workspace_files.ts --exec      # actually insert
 *   npx ts-node scripts/seed_workspace_files.ts --exec --clear  # clear old file-seeded entries first
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
// @ts-ignore — pdf-parse CJS module
const { PDFParse } = require("pdf-parse");
import { query } from "../src/utils/db";

// ─── Config ──────────────────────────────────────────────────────────────────

const WORKSPACE_USERS_DIR = path.resolve(
  __dirname,
  "../../workspace-storage/data/users"
);
const CHUNK_SIZE = 1200;   // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks

const SHOULD_EXEC = process.argv.includes("--exec");
const SHOULD_CLEAR = process.argv.includes("--clear");

// ─── Domain detection ────────────────────────────────────────────────────────

type Domain = "law" | "history" | "religion" | "geo" | "education" | "general";

const DOMAIN_KEYWORDS: { domain: Domain; patterns: RegExp[] }[] = [
  {
    domain: "law",
    patterns: [
      /พ\.ร\.บ\.|พระราชบัญญัติ|มาตรา|กฎหมาย|ประมวลกฎหมาย|PDPA|คุ้มครองข้อมูล/,
    ],
  },
  {
    domain: "history",
    patterns: [/ประวัติศาสตร์|พ\.ศ\.|รัชกาล|สงคราม|อาณาจักร/],
  },
  {
    domain: "religion",
    patterns: [/พุทธ|วัด|พระ|ศาสนา|ธรรม|นิกาย/],
  },
  {
    domain: "geo",
    patterns: [/จังหวัด|อำเภอ|ตำบล|ภูมิภาค|แผนที่/],
  },
];

function detectDomain(text: string): Domain {
  for (const { domain, patterns } of DOMAIN_KEYWORDS) {
    if (patterns.some((p) => p.test(text))) return domain;
  }
  return "general";
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    start += size - overlap;
    if (start >= cleaned.length) break;
  }
  return chunks.filter((c) => c.trim().length > 30);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

// ─── File readers ─────────────────────────────────────────────────────────────

async function readTxt(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

async function readPdf(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  return result.text as string;
}

async function extractText(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === ".txt" || ext === ".md") return readTxt(filePath);
    if (ext === ".pdf") return readPdf(filePath);
    return null; // unsupported
  } catch (err) {
    console.warn(`  ⚠ Cannot read ${filePath}: ${(err as Error).message}`);
    return null;
  }
}

// ─── DB ───────────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id VARCHAR(64) NOT NULL,
  domain VARCHAR(50) NOT NULL,
  name_th VARCHAR(255) NOT NULL,
  aliases JSON DEFAULT NULL,
  description TEXT,
  attributes JSON DEFAULT NULL,
  relations JSON DEFAULT NULL,
  source JSON DEFAULT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.00,
  version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_domain (domain),
  FULLTEXT KEY idx_ft_name_desc (name_th, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const INSERT_SQL =
  "INSERT INTO knowledge_entities " +
  "(id, domain, name_th, aliases, description, attributes, relations, source, confidence, version) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
  "ON DUPLICATE KEY UPDATE " +
  "domain=VALUES(domain), name_th=VALUES(name_th), description=VALUES(description), " +
  "attributes=VALUES(attributes), source=VALUES(source), " +
  "updated_at=CURRENT_TIMESTAMP";

const CLEAR_SQL = `DELETE FROM knowledge_entities WHERE JSON_UNQUOTE(JSON_EXTRACT(source, '$.type')) = 'workspace_file'`;

// ─── Main ─────────────────────────────────────────────────────────────────────

interface FileEntry {
  filePath: string;
  relativePath: string;
}

async function collectFiles(dir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  async function walk(current: string): Promise<void> {
    let items: string[];
    try {
      items = await fs.readdir(current);
    } catch {
      return;
    }
    for (const item of items) {
      const full = path.join(current, item);
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        await walk(full);
      } else {
        const ext = path.extname(item).toLowerCase();
        if ([".txt", ".md", ".pdf"].includes(ext)) {
          entries.push({
            filePath: full,
            relativePath: path.relative(dir, full),
          });
        }
      }
    }
  }

  await walk(dir);
  return entries;
}

async function main(): Promise<void> {
  console.log("📂 seed_workspace_files");
  console.log(`  Workspace dir : ${WORKSPACE_USERS_DIR}`);
  console.log(`  Mode          : ${SHOULD_EXEC ? "EXEC" : "DRY-RUN"}`);
  console.log(`  Clear old     : ${SHOULD_CLEAR}`);
  console.log();

  // Collect files
  const files = await collectFiles(WORKSPACE_USERS_DIR);
  console.log(`Found ${files.length} file(s):`);
  files.forEach((f) => console.log(`  - ${f.relativePath}`));
  console.log();

  if (files.length === 0) {
    console.log("No files found. Exiting.");
    return;
  }

  if (SHOULD_EXEC) {
    await query(CREATE_TABLE_SQL);
    console.log("✓ Ensured table: knowledge_entities\n");
    if (SHOULD_CLEAR) {
      await query(CLEAR_SQL);
      console.log("✓ Cleared old workspace_file entries\n");
    }
  }

  let total = 0;

  for (const { filePath, relativePath } of files) {
    console.log(`📄 ${relativePath}`);
    const text = await extractText(filePath);
    if (!text || text.trim().length < 20) {
      console.log("   (empty or unreadable — skipped)\n");
      continue;
    }

    const domain = detectDomain(text);
    const chunks = chunkText(text);
    const filename = path.basename(filePath);
    const baseId = `ws:${slugify(relativePath)}`;

    console.log(`   domain: ${domain}, ${chunks.length} chunk(s)`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const entityId = `${baseId}:${i}`;

      // Use first sentence of chunk as name_th
      const firstLine = chunk.slice(0, 100).replace(/\n/g, " ").trim();
      const name_th =
        chunks.length === 1
          ? filename
          : `${filename} (ส่วนที่ ${i + 1}/${chunks.length})`;

      const params = [
        entityId,                             // id
        domain,                               // domain
        name_th,                              // name_th
        JSON.stringify([filename]),           // aliases
        chunk,                                // description
        JSON.stringify({ chunk_index: i, total_chunks: chunks.length, filename }), // attributes
        JSON.stringify([]),                   // relations
        JSON.stringify({ name: filename, type: "workspace_file", path: relativePath }), // source
        0.9,                                  // confidence
        "1.0.0",                              // version
      ];

      if (!SHOULD_EXEC) {
        console.log(`   [DRY-RUN] ${entityId} — ${firstLine.slice(0, 60)}…`);
        total++;
        continue;
      }

      await query(INSERT_SQL, params);
      console.log(`   + ${entityId}`);
      total++;
    }
    console.log();
  }

  console.log(`\n✅ Done. ${total} chunk(s) ${SHOULD_EXEC ? "upserted" : "would be inserted"}.`);
}

main().catch((err) => {
  console.error("seed_workspace_files failed:", err);
  process.exitCode = 1;
});
