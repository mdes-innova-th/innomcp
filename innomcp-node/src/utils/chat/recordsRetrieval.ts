import fs from "fs";
import path from "path";

export interface RecordHit {
  id: string;
  title: string;
  snippet: string;
  source: string;
  score: number;
}

export interface RecordPayload {
  query: string;
  hits: RecordHit[];
  summary: string;
  stats: {
    hitCount: number;
    totalIndexed: number;
    mode: "index" | "fixture";
  };
  refs: string[];
  sources: string[];
  meta: {
    dataSource: "records-index" | "none";
    note: string;
  };
}

interface IndexRow {
  id?: string;
  title?: string;
  summary?: string;
  body?: string;
  source?: string;
  tags?: string[];
}

const THAI_STOP_TERMS = new Set([
  "ค้น",
  "ค้นหา",
  "ค้นข้อมูล",
  "ดึง",
  "ดึงข้อมูล",
  "ข้อมูล",
  "เรื่อง",
  "เกี่ยวกับ",
  "ล่าสุด",
  "ให้หน่อย",
  "ช่วย",
]);

function defaultPayload(query: string): RecordPayload {
  return {
    query,
    hits: [],
    summary: "ไม่พบข้อมูลในคลัง",
    stats: { hitCount: 0, totalIndexed: 0, mode: "fixture" },
    refs: ["local-index:none"],
    sources: ["local-index:none"],
    meta: { dataSource: "none", note: "fixture-fallback" },
  };
}

function tokenize(input: string): string[] {
  const normalized = String(input || "")
    .replace(/ค้นข้อมูล/g, "")
    .replace(/ค้นหา/g, "")
    .replace(/ดึงข้อมูล/g, "")
    .replace(/ข้อมูล/g, "")
    .replace(/เรื่อง/g, "")
    .trim();

  const terms = normalized
    .toLowerCase()
    .split(/[\s,.;:!?()\[\]{}\-_/]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .filter((term) => !THAI_STOP_TERMS.has(term));

  if (terms.length === 1 && terms[0].length >= 8) {
    const compact = terms[0];
    const chunks: string[] = [];
    for (let i = 0; i <= compact.length - 4; i += 2) {
      chunks.push(compact.slice(i, i + 4));
      if (chunks.length >= 6) break;
    }
    return Array.from(new Set([...terms, ...chunks]));
  }

  return terms;
}

function cleanSnippet(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function buildSnippet(summary: string, body: string, terms: string[]): string {
  const candidate = cleanSnippet(summary || body || "");
  if (!candidate) return "";
  const lower = candidate.toLowerCase();
  const matchIdx = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (typeof matchIdx !== "number") {
    return candidate.slice(0, 180);
  }

  const start = Math.max(0, matchIdx - 50);
  const end = Math.min(candidate.length, start + 180);
  const head = start > 0 ? "…" : "";
  const tail = end < candidate.length ? "…" : "";
  return `${head}${candidate.slice(start, end)}${tail}`;
}

function scoreRow(row: IndexRow, terms: string[]): number {
  const title = String(row.title || "").toLowerCase();
  const summary = String(row.summary || "").toLowerCase();
  const body = String(row.body || "").toLowerCase();
  const tags = Array.isArray(row.tags) ? row.tags.join(" ").toLowerCase() : "";

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 5;
    if (summary.includes(term)) score += 3;
    if (body.includes(term)) score += 2;
    if (tags.includes(term)) score += 1;
  }
  return score;
}

function resolveIndexPath(): string {
  const configured = String(process.env.RECORDS_INDEX_PATH || "").trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), "data", "records", "index.json");
}

export function retrieveRecordsPayload(query: string): RecordPayload {
  const safeQuery = String(query || "").trim();
  const payload = defaultPayload(safeQuery);
  const filePath = resolveIndexPath();

  if (!fs.existsSync(filePath)) {
    return payload;
  }

  let rows: IndexRow[] = [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
  } catch {
    return payload;
  }

  if (!rows.length) {
    return {
      ...payload,
      stats: { hitCount: 0, totalIndexed: 0, mode: "index" },
      refs: ["local-index:empty"],
      sources: ["local-index:empty"],
      meta: { dataSource: "records-index", note: "index-empty" },
    };
  }

  const terms = tokenize(safeQuery);
  const ranked = rows
    .map((row, index) => {
      const score = terms.length > 0 ? scoreRow(row, terms) : index === 0 ? 0.01 : 0;
      return { row, index, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 8);

  const hits: RecordHit[] = ranked.map((item, idx) => {
    const title = String(item.row.title || "(ไม่มีหัวข้อ)");
    const summary = String(item.row.summary || "");
    const body = String(item.row.body || "");
    const source = String(item.row.source || "records-index");
    const snippet = buildSnippet(summary, body, terms);
    return {
      id: String(item.row.id || `rec-${idx + 1}`),
      title,
      snippet,
      source,
      score: Number(item.score.toFixed(2)),
    };
  });

  const refs = Array.from(new Set(hits.map((hit) => `local-index:${hit.source}`)));
  const hitCount = hits.length;

  return {
    query: safeQuery,
    hits,
    summary: hitCount > 0 ? `พบข้อมูลที่เกี่ยวข้อง ${hitCount} รายการ` : "ไม่พบข้อมูลในคลัง",
    stats: {
      hitCount,
      totalIndexed: rows.length,
      mode: "index",
    },
    refs: refs.length ? refs : ["local-index:none"],
    sources: refs.length ? refs : ["local-index:none"],
    meta: {
      dataSource: "records-index",
      note: hitCount > 0 ? "index-match-qg1" : "index-no-match-qg1",
    },
  };
}
