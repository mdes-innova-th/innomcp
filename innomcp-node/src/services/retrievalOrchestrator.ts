/**
 * Retrieval Orchestrator — routes queries to hot, cold, both, or no retrieval.
 * Explicit policy for when to use each retrieval path.
 */

import { RetrievalSource, RetrievalMode, AnswerContract, buildAnswerContract, AnswerMode } from "./answerContract";
import { coldRetriever, ColdRetrievalResult } from "./coldRetriever";
import { RetrievalFact, composeFactSummary } from "./hotRetriever";
import { SessionMemorySnapshot, MemoryDomain } from "./sessionMemory";

export type RetrievalDecision = "hot" | "cold" | "hot+cold" | "none";

export interface RetrievalPlan {
  decision: RetrievalDecision;
  hotDomains: string[];
  coldQuery?: string;
  reason: string;
}

export interface RetrievalResult {
  plan: RetrievalPlan;
  hotFacts: RetrievalFact[];
  coldResults: ColdRetrievalResult[];
  factSummary: string;
  sources: RetrievalSource[];
  contract: AnswerContract;
}

// --- Policy Keywords ---

const HOT_ONLY_PATTERNS = [
  /อากาศ.*วันนี้|วันนี้.*อากาศ|weather.*today|ฝนตก.*ไหม|อุณหภูมิ.*ตอนนี้/i,
  /evidence.*วันนี้|วันนี้.*evidence|url\s*ผิดกฎหมาย|เจอ.*url|nip.*วันนี้/i,
  /เครื่อง.*ออนไลน์|เครื่อง.*ออฟไลน์|machine.*online/i,
  /ตอนนี้|ขณะนี้|ปัจจุบัน|สถานการณ์.*วันนี้|right\s*now|current/i,
  /กี่โมง|วันที่เท่าไร|คำนวณ|เท่ากับ/i,
];

const COLD_ONLY_PATTERNS = [
  /คืออะไร|หมายความว่า|อธิบาย.*ว่า|what\s*is|explain|definition/i,
  /กระบวนการ|ขั้นตอน|วิธีการ|procedure|process|how\s*to/i,
  /นโยบาย|ระเบียบ|เกณฑ์|policy|regulation|guideline/i,
  /สรุป.*เอกสาร|document.*summary|พรบ|กฎหมาย|ข้อกำหนด/i,
  /มาตรฐาน|standard|framework|โครงสร้าง/i,
];

const MIXED_PATTERNS = [
  /.*และ.*อธิบาย|.*แล้ว.*คืออะไร|.*กับ.*หมายถึง/i,
  /สถานการณ์.*อธิบาย|เป็นอย่างไร.*คืออะไร/i,
  /เปรียบเทียบ.*กับ.*อธิบาย/i,
];

/**
 * Determine retrieval plan based on query and context.
 */
export function planRetrieval(
  query: string,
  route?: string,
  memory?: SessionMemorySnapshot | null
): RetrievalPlan {
  const q = query.trim();

  // 1. If route is already deterministic (calculator, datetime), no retrieval needed
  if (route && ["calculator", "datetime"].includes(route)) {
    return { decision: "none", hotDomains: [], reason: "deterministic_route" };
  }

  // 2. Check for mixed (hot+cold) patterns first
  for (const pattern of MIXED_PATTERNS) {
    if (pattern.test(q)) {
      const hotDomains = inferHotDomains(q, route);
      return {
        decision: "hot+cold",
        hotDomains,
        coldQuery: extractColdQuery(q),
        reason: "mixed_hot_cold_query",
      };
    }
  }

  // 3. Explicit cold patterns
  // Only if the query is asking for explanation/definition/process, not operational data
  const hasColdPattern = COLD_ONLY_PATTERNS.some((p) => p.test(q));
  const hasHotPattern = HOT_ONLY_PATTERNS.some((p) => p.test(q));

  if (hasColdPattern && hasHotPattern) {
    return {
      decision: "hot+cold",
      hotDomains: inferHotDomains(q, route),
      coldQuery: extractColdQuery(q),
      reason: "both_patterns_detected",
    };
  }

  if (hasColdPattern && !hasHotPattern) {
    // If cold retriever has docs AND query looks like documentation/policy question
    if (coldRetriever.isReady()) {
      return {
        decision: "cold",
        hotDomains: [],
        coldQuery: q,
        reason: "documentation_policy_query",
      };
    }
    // Fall through to none if cold retriever not ready
  }

  // 4. Operational/live queries → hot only
  if (hasHotPattern || (route && ["weather", "evidence", "geo", "seismic"].includes(route))) {
    return {
      decision: "hot",
      hotDomains: inferHotDomains(q, route),
      reason: "operational_live_query",
    };
  }

  // 5. If recent memory has a domain context, use that to decide
  if (memory && memory.activeDomain) {
    const domain = memory.activeDomain;
    if (["weather", "evidence", "geo"].includes(domain)) {
      return {
        decision: "hot",
        hotDomains: [domain],
        reason: "memory_domain_continuation",
      };
    }
  }

  // 6. Default: no retrieval (normal chat path)
  return { decision: "none", hotDomains: [], reason: "no_retrieval_pattern" };
}

/**
 * Execute cold retrieval based on the plan.
 */
export function executeColdRetrieval(plan: RetrievalPlan): ColdRetrievalResult[] {
  if (!plan.coldQuery || (plan.decision !== "cold" && plan.decision !== "hot+cold")) {
    return [];
  }

  if (!coldRetriever.isReady()) {
    return [];
  }

  return coldRetriever.search(plan.coldQuery, { maxResults: 3 });
}

/**
 * Build a full retrieval result combining hot and cold.
 */
export function buildRetrievalResult(
  plan: RetrievalPlan,
  hotFacts: RetrievalFact[],
  coldResults: ColdRetrievalResult[],
  meta: {
    route: string;
    toolsUsed: string[];
    answerMode: AnswerMode;
    memoryUsed: boolean;
    memoryEntities?: string[];
    grounded: boolean;
    confidence: number;
    latencyMs?: number;
    degraded?: boolean;
    degradedReasons?: string[];
  }
): RetrievalResult {
  const hotSources = hotFacts.map((f) => f.source);
  const coldSources = coldResults.map((r) => r.source);
  const allSources = [...hotSources, ...coldSources];

  let retrievalUsed: RetrievalMode = "none";
  if (hotFacts.length > 0 && coldResults.length > 0) retrievalUsed = "both";
  else if (hotFacts.length > 0) retrievalUsed = "hot";
  else if (coldResults.length > 0) retrievalUsed = "cold";

  // Compose fact summary
  const hotSummary = composeFactSummary(hotFacts);
  const coldSummary = coldResults
    .map((r) => `[doc:${r.document.title}] ${r.chunk.content}`)
    .join("\n\n");
  const factSummary = [hotSummary, coldSummary].filter(Boolean).join("\n\n---\n\n");

  const contract = buildAnswerContract({
    route: meta.route,
    toolsUsed: meta.toolsUsed,
    sources: allSources,
    answerMode: meta.answerMode,
    retrievalUsed,
    memoryUsed: meta.memoryUsed,
    memoryEntities: meta.memoryEntities,
    confidence: meta.confidence,
    grounded: meta.grounded,
    degraded: meta.degraded,
    degradedReasons: meta.degradedReasons,
    latencyMs: meta.latencyMs,
  });

  return {
    plan,
    hotFacts,
    coldResults,
    factSummary,
    sources: allSources,
    contract,
  };
}

// --- Helpers ---

function inferHotDomains(query: string, route?: string): string[] {
  const domains: string[] = [];
  if (route) domains.push(route);

  if (/อากาศ|ฝน|weather|forecast|อุณหภูมิ|พยากรณ์/i.test(query)) {
    if (!domains.includes("weather")) domains.push("weather");
  }
  if (/evidence|url.*ผิดกฎหมาย|nip|หลักฐาน|เครื่อง.*ออนไลน์/i.test(query)) {
    if (!domains.includes("evidence")) domains.push("evidence");
  }
  if (/คำนวณ|เท่ากับ|\d+\s*[+\-*/]/i.test(query)) {
    if (!domains.includes("calculator")) domains.push("calculator");
  }

  return domains.length > 0 ? domains : ["general"];
}

function extractColdQuery(query: string): string {
  // Strip hot-data parts and keep the explanatory/definitional part
  let cold = query;
  // Remove operational data request fragments
  cold = cold.replace(/วันนี้\s*(อากาศ|evidence|สถานการณ์)[^\s]*\s*/gi, "").trim();
  cold = cold.replace(/ตอนนี้\s*อากาศ[^\s]*\s*/gi, "").trim();
  // If nothing left, use the original
  return cold.length > 5 ? cold : query;
}
