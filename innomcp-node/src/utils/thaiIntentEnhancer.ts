/**
 * Thai Intent Enhancer — Phase 4
 *
 * Produces a richer, language-aware intent signal on top of the primary
 * keyword classifier in services/intentClassifier.ts.  The output is
 * consumed by callers that need confidence scores, language detection, or
 * the requiresTool hint (e.g. conductors, naturalness guards).
 *
 * Design: pure-function, no I/O, deterministic — identical input always
 * yields identical output.  All regex constants are compiled once at
 * module load time.
 */

export interface EnhancedIntent {
  /** Main intent category */
  primary: "data" | "code" | "research" | "shell" | "write" | "general";
  /** Confidence in [0, 1] */
  confidence: number;
  /** Detected script / language mix */
  language: "th" | "en" | "mixed";
  /** True when the query ends with or contains a question particle */
  hasQuestion: boolean;
  /**
   * True when fulfilling the intent typically requires a tool call
   * (shell execution, data fetch, web search, etc.)
   */
  requiresTool: boolean;
}

// ---------------------------------------------------------------------------
// Pattern banks (compiled once)
// ---------------------------------------------------------------------------

const DATA_PATTERNS = [
  /วิเคราะห์|analyse|analyze|ข้อมูล|data|ตาราง|graph|chart|กราฟ/i,
  /csv|excel|สถิติ|statistic|เปรียบเทียบ|compare/i,
];

const CODE_PATTERNS = [
  /เขียน|สร้าง|code|โค้ด|program|script|function|api/i,
  /debug|แก้บัก|error|fix|implement|build/i,
];

const RESEARCH_PATTERNS = [
  /ค้นหา|search|หา|find|research|ข้อมูลเกี่ยวกับ|เกี่ยวกับ|about/i,
  /อธิบาย|explain|บอก|tell|what is|คืออะไร|ช่วยอธิบาย/i,
];

const SHELL_PATTERNS = [
  /รัน|run|execute|install|npm|pip|git|bash|shell|command/i,
  /ติดตั้ง|deploy|start|stop|restart|ls|cd|mkdir/i,
];

const WRITE_PATTERNS = [
  /เขียน|write|draft|สรุป|summarize|report|รายงาน|document/i,
  /proposal|email|อีเมล|จดหมาย|บทความ|article/i,
];

/** Question signals — Thai particles + universal "?" */
const QUESTION_PATTERN =
  /ไหม|หรือเปล่า|ใช่ไหม|ไหมครับ|ไหมคะ|มั้ย|ปะ|\?/;

// Thai Unicode block: U+0E00–U+0E7F
const THAI_CHAR_PATTERN = /[฀-๿]/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count how many patterns in a bank match the query (0–bank.length). */
function scoreBank(query: string, bank: RegExp[]): number {
  return bank.reduce((n, rx) => n + (rx.test(query) ? 1 : 0), 0);
}

/** Map raw match count + bank size to a confidence in [0, 1]. */
function toConfidence(matched: number, total: number): number {
  if (total === 0) return 0;
  // Single-match from a 2-pattern bank → 0.60; both → 0.90
  return Math.min(0.5 + (matched / total) * 0.45, 0.95);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enhance a raw user query with richer intent metadata.
 *
 * @param query  Raw (possibly colloquial Thai / mixed) user message.
 * @returns      EnhancedIntent — never throws.
 */
export function enhanceIntent(query: string): EnhancedIntent {
  if (!query || typeof query !== "string") {
    return {
      primary: "general",
      confidence: 0.5,
      language: "en",
      hasQuestion: false,
      requiresTool: false,
    };
  }

  // --- Language detection ---
  const thaiMatches = query.match(THAI_CHAR_PATTERN) ?? [];
  const thaiRatio = thaiMatches.length / Math.max(query.length, 1);
  const language: EnhancedIntent["language"] =
    thaiRatio > 0.3 ? "th" : thaiRatio > 0 ? "mixed" : "en";

  // --- Question detection ---
  const hasQuestion = QUESTION_PATTERN.test(query);

  // --- Score each intent bank ---
  const scores: Array<{ primary: EnhancedIntent["primary"]; score: number; size: number }> = [
    { primary: "data",     score: scoreBank(query, DATA_PATTERNS),     size: DATA_PATTERNS.length },
    { primary: "code",     score: scoreBank(query, CODE_PATTERNS),     size: CODE_PATTERNS.length },
    { primary: "research", score: scoreBank(query, RESEARCH_PATTERNS), size: RESEARCH_PATTERNS.length },
    { primary: "shell",    score: scoreBank(query, SHELL_PATTERNS),    size: SHELL_PATTERNS.length },
    { primary: "write",    score: scoreBank(query, WRITE_PATTERNS),    size: WRITE_PATTERNS.length },
  ];

  // Pick the highest-scoring bank (ties broken by declaration order)
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));

  if (best.score === 0) {
    return {
      primary: "general",
      confidence: 0.5,
      language,
      hasQuestion,
      requiresTool: false,
    };
  }

  const confidence = toConfidence(best.score, best.size);

  // requiresTool: data queries need fetch/parse; shell obviously runs a command;
  // research needs web search.  code and write are handled locally.
  const requiresTool = best.primary === "data" ||
                       best.primary === "shell" ||
                       best.primary === "research";

  return {
    primary: best.primary,
    confidence,
    language,
    hasQuestion,
    requiresTool,
  };
}
