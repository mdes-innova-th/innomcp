/**
 * Memory + RAG Integration Hook
 * Single integration point for sessionMemory + retrieval pipeline.
 * Keeps chat.ts touches minimal by consolidating all hooks here.
 */

import * as path from "path";
import { sessionMemory, MemoryDomain, MemoryEntity } from "./sessionMemory";
import { coldRetriever } from "./coldRetriever";
import { planRetrieval, executeColdRetrieval, buildRetrievalResult, RetrievalResult } from "./retrievalOrchestrator";
import { normalizeWeatherFacts, normalizeEvidenceFacts, normalizeDeterministicFact, RetrievalFact } from "./hotRetriever";
import { buildAnswerContract, AnswerContract, AnswerMode, RetrievalMode } from "./answerContract";

// ---- Initialization ----

let initialized = false;

export async function initMemoryRag(): Promise<{ docCount: number; chunkCount: number }> {
  if (initialized) return { docCount: coldRetriever.getDocumentCount(), chunkCount: 0 };
  const corpusDir = path.resolve(__dirname, "../../data/knowledge-base");
  const result = await coldRetriever.loadCorpus(corpusDir);
  initialized = true;
  console.log(`[MemoryRag] Cold RAG initialized: ${result.docCount} docs, ${result.chunkCount} chunks`);
  return result;
}

// ---- Entity Extraction ----

function extractEntities(query: string, route: string, toolResult?: any): Omit<MemoryEntity, "sourceTurn" | "sourceQuery" | "timestamp" | "freshness">[] {
  const entities: Omit<MemoryEntity, "sourceTurn" | "sourceQuery" | "timestamp" | "freshness">[] = [];
  const domain = routeToDomain(route);

  // Province extraction
  const provincePattern = /(?:กรุงเทพ|เชียงใหม่|เชียงราย|ขอนแก่น|ภูเก็ต|นครราชสีมา|สงขลา|อุบลราชธานี|สุราษฎร์ธานี|พิษณุโลก|อุดรธานี|ลำปาง|น่าน|ตราด|ระยอง|สมุทรปราการ|อยุธยา|แม่ฮ่องสอน|นครสวรรค์|กาญจนบุรี|ชลบุรี|นนทบุรี|ปทุมธานี|ราชบุรี|ลพบุรี|เพชรบุรี|สระบุรี|นครปฐม|เลย)/gi;
  const provinces = query.match(provincePattern);
  if (provinces) {
    for (const p of provinces) {
      entities.push({ name: p, type: "province", value: p, domain, confidence: 0.9 });
    }
  }

  // Region extraction
  const regionPattern = /(?:ภาคเหนือ|ภาคใต้|ภาคอีสาน|ภาคตะวันออก|ภาคกลาง|ภาคตะวันตก|ภาคตะวันออกเฉียงเหนือ)/gi;
  const regions = query.match(regionPattern);
  if (regions) {
    for (const r of regions) {
      entities.push({ name: r, type: "region", value: r, domain, confidence: 0.85 });
    }
  }

  // ISP extraction (for evidence domain)
  const ispPattern = /\b(ais|dtac|ดีแทค|true|ทรู|trueonline|truemove|nt\b|cat\b|tot\b|3bb|เอไอเอส|ทีโอที)\b/gi;
  const isps = query.match(ispPattern);
  if (isps) {
    for (const isp of isps) {
      entities.push({ name: isp.toUpperCase(), type: "isp", value: isp.toUpperCase(), domain: "evidence", confidence: 0.95 });
    }
  }

  // Concept extraction for knowledge domain
  if (domain === "knowledge" || domain === "general") {
    const conceptPatterns = [
      /(?:NIP|nip)/g,
      /(?:URL\s*ผิดกฎหมาย|หลักฐานดิจิทัล)/g,
      /(?:พยากรณ์อากาศ|forecast|TMD|กรมอุตุ)/gi,
    ];
    for (const pattern of conceptPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        for (const m of matches) {
          entities.push({ name: m, type: "concept", value: m, domain, confidence: 0.8 });
        }
      }
    }
  }

  return entities;
}

function routeToDomain(route: string): MemoryDomain {
  const map: Record<string, MemoryDomain> = {
    weather: "weather",
    weatherPipeline: "weather",
    tmd_warning: "weather",
    tmd_climate: "weather",
    tmd_stations: "weather",
    tmd_rainfall: "weather",
    tmd_rain_regions: "weather",
    seismic: "weather",
    evidence: "evidence",
    officerEvidence: "evidence",
    webd_court_order: "evidence",
    geo: "geo",
    thaiGeo: "geo",
    knowledge: "knowledge",
    thaiKnowledge: "knowledge",
    calculator: "calculator",
    datetime: "datetime",
    general: "general",
    multi_intent: "mixed",
    image_generation: "general",
  };
  return map[route] || "general";
}

// ---- Post-Response Hook ----

export interface MemoryRagMeta {
  memoryUsed: boolean;
  memoryEntities: string[];
  retrievalMode: RetrievalMode;
  retrievalReason: string;
  coldDocHits: number;
  hotFactCount: number;
  sessionTurnCount: number;
  activeDomain: MemoryDomain | null;
}

/**
 * Record a turn in session memory and compute RAG metadata.
 * Call AFTER response is composed, BEFORE sending to client.
 * Returns enrichment metadata to attach to __groundedContract.
 */
export function recordTurnAndGetMeta(
  sessionId: string,
  query: string,
  route: string,
  toolsUsed: string[],
  toolResult?: any
): MemoryRagMeta {
  const domain = routeToDomain(route);
  const entities = extractEntities(query, route, toolResult);

  // 1. Record in session memory
  sessionMemory.recordTurn(sessionId, query, domain, entities, {
    route,
    toolsUsed,
  });

  // 2. Check memory state
  const snapshot = sessionMemory.getSnapshot(sessionId);
  const memoryEntities = snapshot.entities.map((e) => `${e.type}:${e.name}`);

  // 3. Plan retrieval (doesn't execute — just decides)
  const plan = planRetrieval(query, route, snapshot);

  // 4. If cold retrieval needed and ready, execute
  let coldDocHits = 0;
  if (plan.decision === "cold" || plan.decision === "hot+cold") {
    const coldResults = executeColdRetrieval(plan);
    coldDocHits = coldResults.length;
  }

  return {
    memoryUsed: snapshot.entities.length > 0,
    memoryEntities,
    retrievalMode: plan.decision === "hot+cold" ? "both" : plan.decision === "none" ? "none" : plan.decision as RetrievalMode,
    retrievalReason: plan.reason,
    coldDocHits,
    hotFactCount: toolsUsed.length > 0 ? 1 : 0,
    sessionTurnCount: snapshot.turnCount,
    activeDomain: snapshot.activeDomain,
  };
}

/**
 * Enrich a __groundedContract object with memory/RAG metadata.
 * Mutates the structuredContent in-place if it has __groundedContract.
 */
export function enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void {
  if (!structuredContent || typeof structuredContent !== "object") return;
  const gc = structuredContent.__groundedContract;
  if (!gc || typeof gc !== "object") return;

  gc.memoryRag = {
    memoryUsed: ragMeta.memoryUsed,
    memoryEntities: ragMeta.memoryEntities,
    retrievalMode: ragMeta.retrievalMode,
    retrievalReason: ragMeta.retrievalReason,
    coldDocHits: ragMeta.coldDocHits,
    hotFactCount: ragMeta.hotFactCount,
    sessionTurnCount: ragMeta.sessionTurnCount,
    activeDomain: ragMeta.activeDomain,
  };
}

// ---- Cold RAG Query ----

/**
 * Execute a cold RAG query and return the top results as a formatted string.
 * Use this to inject corpus-retrieved context into LLM prompts.
 */
export function queryColdRag(query: string, domain?: string): { context: string; docCount: number; sources: string[] } {
  if (!coldRetriever.isReady()) {
    return { context: "", docCount: 0, sources: [] };
  }

  const results = coldRetriever.search(query, { maxResults: 3, domain });
  if (results.length === 0) {
    return { context: "", docCount: 0, sources: [] };
  }

  const context = results
    .map((r) => `[${r.document.title}] ${r.chunk.content}`)
    .join("\n\n---\n\n");

  const sources = results.map((r) => r.document.path);

  return { context, docCount: results.length, sources };
}

// ---- Debug Endpoint Data ----

export function getMemoryDebugData(sessionId: string) {
  const snapshot = sessionMemory.getSnapshot(sessionId);
  const coldRegistry = coldRetriever.isReady() ? coldRetriever.getRegistry() : [];
  return {
    session: snapshot,
    coldRag: {
      ready: coldRetriever.isReady(),
      documentCount: coldRetriever.getDocumentCount(),
      documents: coldRegistry,
    },
    initialized,
  };
}
