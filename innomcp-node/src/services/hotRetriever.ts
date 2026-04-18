/**
 * Hot Retriever — normalizes live tool/API/DB results into RetrievalFact objects.
 * Hot RAG deals with current/live operational data: weather, evidence, machine state.
 */

import { RetrievalSource } from "./answerContract";

export interface RetrievalFact {
  id: string;
  source: RetrievalSource;
  domain: string;
  content: string;
  entities: string[];
  timestamp: string;
  confidence: number;
  raw?: unknown;
}

let factCounter = 0;
function nextFactId(domain: string): string {
  return `hot:${domain}:${++factCounter}`;
}

/**
 * Normalize weather pipeline results into retrieval facts.
 */
export function normalizeWeatherFacts(
  toolResult: any,
  query: string
): RetrievalFact[] {
  const facts: RetrievalFact[] = [];
  const now = new Date().toISOString();

  if (!toolResult) return facts;

  // Handle structured weather result
  const results = toolResult.result || toolResult.data || toolResult;
  if (Array.isArray(results)) {
    for (const item of results) {
      const province = item.province || item.location || "unknown";
      facts.push({
        id: nextFactId("weather"),
        source: {
          id: `tool:weatherPipeline:${province}`,
          type: "api",
          name: "weatherPipeline",
          freshness: "live",
          timestamp: now,
          confidence: 0.9,
        },
        domain: "weather",
        content: typeof item === "string" ? item : JSON.stringify(item),
        entities: [province],
        timestamp: now,
        confidence: 0.9,
        raw: item,
      });
    }
  } else if (typeof results === "object" && results !== null) {
    facts.push({
      id: nextFactId("weather"),
      source: {
        id: "tool:weatherPipeline",
        type: "api",
        name: "weatherPipeline",
        freshness: "live",
        timestamp: now,
        confidence: 0.9,
      },
      domain: "weather",
      content: typeof results === "string" ? results : JSON.stringify(results),
      entities: extractWeatherEntities(query),
      timestamp: now,
      confidence: 0.9,
      raw: results,
    });
  }

  return facts;
}

/**
 * Normalize evidence tool results into retrieval facts.
 */
export function normalizeEvidenceFacts(
  toolResult: any,
  query: string
): RetrievalFact[] {
  const facts: RetrievalFact[] = [];
  const now = new Date().toISOString();

  if (!toolResult) return facts;

  const data = toolResult.result || toolResult.data || toolResult;
  const isp = extractISP(query) || "all";

  facts.push({
    id: nextFactId("evidence"),
    source: {
      id: `tool:evidenceTool:${isp}`,
      type: "database",
      name: "evidenceTool",
      freshness: "live",
      timestamp: now,
      confidence: 0.95,
    },
    domain: "evidence",
    content: typeof data === "string" ? data : JSON.stringify(data),
    entities: [isp],
    timestamp: now,
    confidence: 0.95,
    raw: data,
  });

  return facts;
}

/**
 * Normalize calculator/datetime results into retrieval facts.
 */
export function normalizeDeterministicFact(
  domain: string,
  toolName: string,
  result: any,
  query: string
): RetrievalFact {
  const now = new Date().toISOString();
  return {
    id: nextFactId(domain),
    source: {
      id: `tool:${toolName}`,
      type: "tool",
      name: toolName,
      freshness: "live",
      timestamp: now,
      confidence: 1.0,
    },
    domain,
    content: typeof result === "string" ? result : String(result),
    entities: [],
    timestamp: now,
    confidence: 1.0,
    raw: result,
  };
}

/**
 * Merge multiple retrieval fact arrays, preserving source identity.
 */
export function mergeRetrievalFacts(factSets: RetrievalFact[][]): RetrievalFact[] {
  const merged: RetrievalFact[] = [];
  const seen = new Set<string>();

  for (const set of factSets) {
    for (const fact of set) {
      if (!seen.has(fact.id)) {
        seen.add(fact.id);
        merged.push(fact);
      }
    }
  }

  return merged;
}

/**
 * Compose a concise fact summary from retrieval facts for answer composition.
 */
export function composeFactSummary(facts: RetrievalFact[]): string {
  if (facts.length === 0) return "";

  const lines: string[] = [];
  for (const fact of facts) {
    const sourceLabel = `[${fact.source.name}]`;
    // Truncate long content
    const content = fact.content.length > 500
      ? fact.content.slice(0, 500) + "..."
      : fact.content;
    lines.push(`${sourceLabel} ${content}`);
  }

  return lines.join("\n\n");
}

// --- Helper functions ---

function extractWeatherEntities(query: string): string[] {
  const entities: string[] = [];
  // Match known province patterns
  const provincePattern = /(?:กรุงเทพ|เชียงใหม่|เชียงราย|ขอนแก่น|ภูเก็ต|นครราชสีมา|สงขลา|อุบลราชธานี|สุราษฎร์ธานี|พิษณุโลก|หาดใหญ่|โคราช|อุดรธานี|ลำปาง|น่าน|ตราด|ระยอง|สมุทรปราการ|อยุธยา|แม่ฮ่องสอน|แม่สอด)/gi;
  const matches = query.match(provincePattern);
  if (matches) entities.push(...matches);
  // Region patterns
  const regionPattern = /(?:ภาคเหนือ|ภาคใต้|ภาคอีสาน|ภาคตะวันออก|ภาคกลาง|ภาคตะวันตก|ทั้งประเทศ)/gi;
  const regionMatches = query.match(regionPattern);
  if (regionMatches) entities.push(...regionMatches);
  return entities;
}

function extractISP(query: string): string | null {
  const m = query.match(/\b(ais|dtac|ดีแทค|true|ทรู|trueonline|truemove|nt\b|cat\b|tot\b|3bb|เอไอเอส|ทีโอที)\b/i);
  return m ? m[1].toUpperCase() : null;
}
