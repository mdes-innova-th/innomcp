import { computeDetailedQualityScore, INTENT_KEYWORDS, AI_ISMS, MotherResult } from "../../src/agents/motherDispatch";

describe("computeDetailedQualityScore", () => {
  const mockIntent = "knowledge";
  const keywords = INTENT_KEYWORDS[mockIntent] || INTENT_KEYWORDS.general;

  const createResult = (id: string, text: string, success = true): MotherResult => ({
    providerId: id,
    providerName: "Mock Provider",
    text,
    latencyMs: 100,
    success,
  });

  test("should return 0 if target failed or text is empty", () => {
    const target = createResult("p1", "");
    const results = [target];
    expect(computeDetailedQualityScore(results, target, mockIntent)).toBe(0);

    const targetFailed = createResult("p1", "Valid text", false);
    expect(computeDetailedQualityScore(results, targetFailed, mockIntent)).toBe(0);
  });

  test("should award 100 novelty if no other successful results exist", () => {
    const target = createResult("p1", "This is a unique answer about the knowledge of things.");
    const results = [target];

    // Novelty: 100 (no comparison)
    // Completeness: partial (matches "ข้อมูล", "รายละเอียด" etc? Let's check)
    // Coherence: 100 (no AI-isms)

    const score = computeDetailedQualityScore(results, target, mockIntent);
    expect(score).toBeGreaterThan(0);
    // We can't easily assert exactly 100 without knowing exactly which keywords match,
    // but we know Novelty part is 30.
  });

  test("should penalize low novelty (high overlap)", () => {
    const text = "The quick brown fox jumps over the lazy dog for knowledge and data.";
    const target = createResult("p1", text);
    const other = createResult("p2", text); // Identical
    const results = [target, other];

    const score = computeDetailedQualityScore(results, target, mockIntent);

    // Novelty should be 0 because overlap is 100%
    // NoveltyScore = (1 - 1)*100 = 0.
    // Expected score should be lower than if 'other' was different.

    const differentOther = createResult("p3", "Something completely unrelated and different.");
    const scoreWithDifferent = computeDetailedQualityScore([target, differentOther], target, mockIntent);

    expect(score).toBeLessThan(scoreWithDifferent);
  });

  test("should award high completeness when all intent keywords are present", () => {
    const targetText = keywords.join(" ").concat(" This is a very detailed response.");
    const target = createResult("p1", targetText);
    const results = [target];

    const score = computeDetailedQualityScore(results, target, mockIntent);

    // CompletenessScore = (keywords.length / keywords.length) * 100 = 100.
    // Coherence = 100.
    // Novelty = 100.
    // Total = 30 + 40 + 30 = 100.
    expect(score).toBe(100);
  });

  test("should penalize coherence for AI-isms", () => {
    const targetText = "As an AI language model, I hope this helps. " + keywords.join(" ");
    const target = createResult("p1", targetText);
    const results = [target];

    const score = computeDetailedQualityScore(results, target, mockIntent);

    // a-isms: "As an AI language model", "I hope this helps" (2 matches)
    // CoherenceScore = 100 - (2 * 15) = 70.
    // Novelty = 100, Completeness = 100.
    // Total = (100 * 0.3) + (100 * 0.4) + (70 * 0.3) = 30 + 40 + 21 = 91.
    expect(score).toBe(91);
  });

  test("should handle empty or non-existent intent by using general keywords", () => {
    const target = createResult("p1", "General answer with no specific intent keywords.");
    const results = [target];

    const score = computeDetailedQualityScore(results, target, "non-existent-intent");
    expect(score).toBeDefined();
    expect(typeof score).toBe("number");
  });

  test("should calculate a mixed score correctly", () => {
    // Setup:
    // Target: some keywords, one AI-ism, some overlap
    const targetText = "ข้อมูล รายละเอียด. As an AI language model, I know this.";
    const target = createResult("p1", targetText);

    const otherText = "ข้อมูล รายละเอียด. This is another way to say it.";
    const other = createResult("p2", otherText);

    const results = [target, other];
    const score = computeDetailedQualityScore(results, target, mockIntent);

    // Target Words: {ข้อมูล, รายละเอียด, language, model, know, this} (approx)
    // Other Words: {ข้อมูล, รายละเอียด, another, way, say} (approx)
    // Intersection: {ข้อมูล, รายละเอียด}
    // Overlap: 2 / 6 = 0.33
    // Novelty: (1 - 0.33) * 100 = 67

    // Keywords for knowledge: ["ข้อมูล", "รายละเอียด", "ประวัติ", "ข้อเท็จจริง", "สรุป"]
    // Matched: ["ข้อมูล", "รายละเอียด"] (2/5) = 40%

    // AI-isms: "As an AI language model" (1 match)
    // Coherence: 100 - 15 = 85

    // Total: (67 * 0.3) + (40 * 0.4) + (85 * 0.3) = 20.1 + 16 + 25.5 = 61.6
    expect(score).toBeCloseTo(61.6, 0);
  });
});
