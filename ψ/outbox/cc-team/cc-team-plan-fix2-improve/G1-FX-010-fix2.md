<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-010 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3571,"completion_tokens":8000,"total_tokens":11571,"prompt_tokens_details":{"cached_tokens":3456,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6757,"image_tokens":0},"cache_creation_input_tokens":0} | 90s
 generated: 2026-06-13T11:36:40.474Z -->
FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
const MIXED_PATTERNS = [
  /.*และ.*อธิบาย|.*แล้ว.*คืออะไร|.*กับ.*หมายถึง/i,
  /สถานการณ์.*อธิบาย|เป็นอย่างไร.*คืออะไร/i,
  /เปรียบเทียบ.*กับ.*อธิบาย/i,
];
=======
const MIXED_PATTERNS = [
  /.*และ.*อธิบาย|.*แล้ว.*คืออะไร|.*กับ.*หมายถึง/is,
  /สถานการณ์.*อธิบาย|เป็นอย่างไร.*คืออะไร|คืออะไร.*เป็นอย่างไร/is,
  /เปรียบเทียบ.*กับ.*อธิบาย/is,
];
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
const COLD_ONLY_PATTERNS = [
  /คืออะไร|หมายความว่า|อธิบาย.*ว่า|what\s*is|explain|definition/i,
  /กระบวนการ|ขั้นตอน|วิธีการ|procedure|process|how\s*to/i,
  /นโยบาย|ระเบียบ|เกณฑ์|policy|regulation|guideline/i,
  /สรุป.*เอกสาร|document.*summary|พรบ|กฎหมาย|ข้อกำหนด/i,
  /มาตรฐาน|standard|framework|โครงสร้าง/i,
];
=======
const COLD_ONLY_PATTERNS = [
  /คืออะไร|หมายความว่า|อธิบาย.*ว่า|what\s*is|explain|definition/i,
  /กระบวนการ|ขั้นตอน|วิธีการ|procedure|process|how\s*to/i,
  /นโยบาย|ระเบียบ|เกณฑ์|policy|regulation|guideline/i,
  /สรุป.*เอกสาร|document.*summary|พรบ|กฎหมาย|ข้อกำหนด/i,
  /มาตรฐาน|standard|framework|โครงสร้าง/i,
];

const STRONG_COLD_PATTERNS = [
  /กระบวนการ|ขั้นตอน|วิธีการ|procedure|process|how\s*to/i,
  /นโยบาย|ระเบียบ|เกณฑ์|policy|regulation|guideline/i,
  /สรุป.*เอกสาร|document.*summary|พรบ|กฎหมาย|ข้อกำหนด/i,
  /มาตรฐาน|standard|framework|โครงสร้าง/i,
];
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
  if (hasColdPattern && hasHotPattern) {
    return {
      decision: "hot+cold",
      hotDomains: inferHotDomains(q, route),
      coldQuery: extractColdQuery(q),
      reason: "both_patterns_detected",
    };
  }
=======
  if (hasColdPattern && hasHotPattern && STRONG_COLD_PATTERNS.some(p => p.test(q))) {
    return {
      decision: "hot+cold",
      hotDomains: inferHotDomains(q, route),
      coldQuery: extractColdQuery(q),
      reason: "both_patterns_detected",
    };
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
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
=======
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
    return { decision: "none", hotDomains: [], reason: "cold_not_ready" };
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
export interface RetrievalPlan {
  decision: RetrievalDecision;
  hotDomains: string[];
  coldQuery?: string;
  reason: string;
}
=======
export interface RetrievalPlan {
  decision: RetrievalDecision;
  hotDomains: string[];
  coldQuery?: string;
  reason: string;
  coldDegraded?: boolean;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
  if (!coldRetriever.isReady()) {
    return [];
  }
=======
  if (!coldRetriever.isReady()) {
    plan.coldDegraded = true;
    return [];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/retrievalOrchestrator.ts
<<<<<<< SEARCH
  // Compose fact summary
  const hotSummary = composeFactSummary(hotFacts);
  const coldSummary = coldResults
    .map((r) => `[doc:${r.document.title}] ${r.chunk.content}`)
    .join("\n\n");
  const factSummary = [hotSummary, coldSummary].filter(Boolean).join("\n\n---\n\n");
=======
  // Compose fact summary
  const hotSummary = composeFactSummary(hotFacts);
  const coldSummary = coldResults
    .map((r) => `[doc:
