/**
 * Cold Retriever — document-based retrieval with source trace.
 * Uses a controlled seed corpus of markdown/text files.
 * Simple TF-IDF + keyword matching (no external vector DB dependency).
 */

import * as fs from "fs";
import * as path from "path";
import { RetrievalSource } from "./answerContract";

export interface ColdDocument {
  id: string;
  path: string;
  title: string;
  content: string;
  chunks: ColdChunk[];
  metadata: {
    updatedAt: string;
    domain: string;
    tags: string[];
    fileSize: number;
  };
}

export interface ColdChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  startLine: number;
  endLine: number;
}

export interface ColdRetrievalResult {
  chunk: ColdChunk;
  document: ColdDocument;
  score: number;
  source: RetrievalSource;
}

// --- Document Registry ---

const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 100;

function chunkText(text: string, docId: string): ColdChunk[] {
  const lines = text.split("\n");
  const chunks: ColdChunk[] = [];
  let buffer = "";
  let startLine = 0;
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    buffer += lines[i] + "\n";

    if (buffer.length >= CHUNK_SIZE || i === lines.length - 1) {
      const trimmed = buffer.trim();
      if (trimmed.length > 0) {
        chunks.push({
          id: `${docId}:chunk:${chunkIndex}`,
          documentId: docId,
          content: trimmed,
          index: chunkIndex,
          startLine,
          endLine: i,
        });
        chunkIndex++;
      }

      // Overlap: keep last CHUNK_OVERLAP chars
      if (buffer.length > CHUNK_OVERLAP) {
        const overlapStart = buffer.length - CHUNK_OVERLAP;
        buffer = buffer.slice(overlapStart);
        startLine = Math.max(0, i - 2);
      } else {
        buffer = "";
        startLine = i + 1;
      }
    }
  }

  return chunks;
}

function extractTitle(content: string, filePath: string): string {
  // Try to extract title from first markdown heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  return path.basename(filePath, path.extname(filePath));
}

function extractTags(content: string, filePath: string): string[] {
  const tags: string[] = [];
  // Extract from YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]+)\]/);
    if (tagsMatch) {
      tags.push(...tagsMatch[1].split(",").map((t) => t.trim().replace(/['"]/g, "")));
    }
  }
  // Add domain tags from path
  if (/weather|อากาศ/i.test(filePath)) tags.push("weather");
  if (/evidence|หลักฐาน|nip/i.test(filePath)) tags.push("evidence");
  if (/geo|จังหวัด|province/i.test(filePath)) tags.push("geo");
  if (/law|กฎหมาย|พรบ/i.test(filePath)) tags.push("law");
  if (/process|กระบวนการ|procedure/i.test(filePath)) tags.push("process");
  return [...new Set(tags)];
}

function inferDomain(tags: string[], filePath: string): string {
  if (tags.includes("weather")) return "weather";
  if (tags.includes("evidence")) return "evidence";
  if (tags.includes("geo")) return "geo";
  if (tags.includes("law")) return "law";
  if (tags.includes("process")) return "process";
  return "general";
}

// --- TF-IDF scoring ---

function tokenize(text: string): string[] {
  // Simple tokenization: split on whitespace and punctuation, lowercase
  return text
    .toLowerCase()
    .replace(/[^\wก-๙เแโใไ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function computeTFIDF(query: string, chunk: string, idfMap: Map<string, number>): number {
  const queryTokens = tokenize(query);
  const chunkTokens = tokenize(chunk);
  if (queryTokens.length === 0 || chunkTokens.length === 0) return 0;

  const chunkFreq = new Map<string, number>();
  for (const t of chunkTokens) {
    chunkFreq.set(t, (chunkFreq.get(t) || 0) + 1);
  }

  let score = 0;
  for (const qt of queryTokens) {
    const tf = (chunkFreq.get(qt) || 0) / chunkTokens.length;
    const idf = idfMap.get(qt) || 0;
    score += tf * idf;
  }

  return score;
}

// --- Cold Retriever Class ---

export class ColdRetriever {
  private documents: ColdDocument[] = [];
  private idfMap: Map<string, number> = new Map();
  private initialized = false;

  /**
   * Load and index a corpus directory.
   * Only indexes .md and .txt files.
   */
  async loadCorpus(corpusDir: string): Promise<{ docCount: number; chunkCount: number }> {
    this.documents = [];
    this.idfMap = new Map();

    if (!fs.existsSync(corpusDir)) {
      console.warn(`[ColdRetriever] Corpus directory not found: ${corpusDir}`);
      return { docCount: 0, chunkCount: 0 };
    }

    const files = this.listFiles(corpusDir);
    const allowedExts = [".md", ".txt"];

    let totalChunks = 0;
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!allowedExts.includes(ext)) continue;

      // Skip dotfiles and hidden dirs
      if (file.includes("node_modules") || file.includes(".git")) continue;

      try {
        const content = fs.readFileSync(file, "utf-8");
        if (content.trim().length === 0) continue;

        const relativePath = path.relative(corpusDir, file).replace(/\\/g, "/");
        const docId = `cold:${relativePath}`;
        const tags = extractTags(content, relativePath);
        const stat = fs.statSync(file);

        const doc: ColdDocument = {
          id: docId,
          path: relativePath,
          title: extractTitle(content, file),
          content,
          chunks: chunkText(content, docId),
          metadata: {
            updatedAt: stat.mtime.toISOString(),
            domain: inferDomain(tags, relativePath),
            tags,
            fileSize: stat.size,
          },
        };

        this.documents.push(doc);
        totalChunks += doc.chunks.length;
      } catch (err) {
        console.warn(`[ColdRetriever] Failed to load ${file}:`, err);
      }
    }

    this.buildIDF();
    this.initialized = true;
    console.log(`[ColdRetriever] Loaded ${this.documents.length} docs, ${totalChunks} chunks from ${corpusDir}`);
    return { docCount: this.documents.length, chunkCount: totalChunks };
  }

  /**
   * Search the corpus for relevant chunks.
   */
  search(query: string, options?: { maxResults?: number; domain?: string }): ColdRetrievalResult[] {
    if (!this.initialized || this.documents.length === 0) return [];

    const maxResults = options?.maxResults ?? 5;
    const domainFilter = options?.domain;

    const scored: { chunk: ColdChunk; doc: ColdDocument; score: number }[] = [];

    for (const doc of this.documents) {
      if (domainFilter && doc.metadata.domain !== domainFilter) continue;

      for (const chunk of doc.chunks) {
        const score = computeTFIDF(query, chunk.content, this.idfMap);
        // Also boost for exact keyword match
        const keywordBoost = this.keywordBoost(query, chunk.content);
        const totalScore = score + keywordBoost;

        if (totalScore > 0) {
          scored.push({ chunk, doc, score: totalScore });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, maxResults).map((s) => ({
      chunk: s.chunk,
      document: s.doc,
      score: s.score,
      source: {
        id: s.chunk.id,
        type: "document" as const,
        name: s.doc.title,
        path: s.doc.path,
        freshness: this.computeDocFreshness(s.doc.metadata.updatedAt),
        timestamp: s.doc.metadata.updatedAt,
        confidence: Math.min(0.95, s.score * 2),
      },
    }));
  }

  /**
   * Get the document registry (list of all indexed docs).
   */
  getRegistry(): Array<{ id: string; path: string; title: string; domain: string; chunks: number; updatedAt: string }> {
    return this.documents.map((d) => ({
      id: d.id,
      path: d.path,
      title: d.title,
      domain: d.metadata.domain,
      chunks: d.chunks.length,
      updatedAt: d.metadata.updatedAt,
    }));
  }

  /**
   * Check if the retriever has any documents loaded.
   */
  isReady(): boolean {
    return this.initialized && this.documents.length > 0;
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  // --- Private helpers ---

  private listFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            results.push(...this.listFiles(fullPath));
          }
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      // skip inaccessible dirs
    }
    return results;
  }

  private buildIDF(): void {
    this.idfMap = new Map();
    const docCount = this.documents.length;
    if (docCount === 0) return;

    // Count how many docs contain each token
    const docFreq = new Map<string, number>();
    for (const doc of this.documents) {
      const tokens = new Set(tokenize(doc.content));
      for (const t of tokens) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
    }

    for (const [token, freq] of docFreq) {
      this.idfMap.set(token, Math.log((docCount + 1) / (freq + 1)) + 1);
    }
  }

  private keywordBoost(query: string, chunk: string): number {
    const queryLower = query.toLowerCase();
    const chunkLower = chunk.toLowerCase();
    let boost = 0;

    // Thai keyword exact match boost
    const thaiKeywords = queryLower.match(/[\u0E00-\u0E7F]+/g) || [];
    for (const kw of thaiKeywords) {
      if (kw.length >= 3 && chunkLower.includes(kw)) {
        boost += 0.3;
      }
    }

    // English keyword match
    const engKeywords = queryLower.match(/[a-z]{3,}/g) || [];
    for (const kw of engKeywords) {
      if (chunkLower.includes(kw)) {
        boost += 0.2;
      }
    }

    return boost;
  }

  private computeDocFreshness(updatedAt: string): "live" | "recent" | "stale" {
    const age = Date.now() - new Date(updatedAt).getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (age < ONE_DAY) return "live";
    if (age < 7 * ONE_DAY) return "recent";
    return "stale";
  }
}

// Singleton instance
export const coldRetriever = new ColdRetriever();
