/**
 * thaiKnowledgeTool.test.ts
 * Real unit tests for thaiKnowledgeTool — no passWithNoTests
 *
 * Coverage:
 *  - empty query → fast-fail without DB call
 *  - happy path: query returns matching records
 *  - alias path: query matches via alias field
 *  - region filter: normalized region (กลาง → ภาคกลาง)
 *  - low-confidence path: data returned but confidence < 0.5
 *  - DB error: executeQuery throws → returns db-error note
 *  - limit clamping: limit > 20 clamped to 20
 *  - regression: โคราช alias search returns นครราชสีมา
 */

import { thaiKnowledgeTool } from "../../../src/tools/thaiKnowledgeTool";

jest.mock("../../../src/utils/db/connector", () => ({
  executeQuery: jest.fn(),
}));

import { executeQuery } from "../../../src/utils/db/connector";
const mockExecuteQuery = executeQuery as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<{
  id: string;
  name_th: string;
  aliases: string;
  attributes: string;
  confidence: number;
  rel: number;
}> = {}) {
  return {
    id: "1",
    name_th: "กรุงเทพมหานคร",
    aliases: '["กทม","Bangkok","กรุงเทพ"]',
    attributes: '{"region":"ภาคกลาง","type":"province"}',
    confidence: 0.9,
    rel: 1.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockExecuteQuery.mockReset();
});

describe("thaiKnowledgeTool", () => {
  // 1. Empty query fast-fail
  test("empty query returns success=false without calling DB", async () => {
    const result = await thaiKnowledgeTool({ query: "" });
    expect(result.success).toBe(false);
    expect(result.note).toBe("empty-query");
    expect(result.confidence).toBe(0);
    expect(result.data).toHaveLength(0);
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  test("whitespace-only query returns success=false without calling DB", async () => {
    const result = await thaiKnowledgeTool({ query: "   " });
    expect(result.success).toBe(false);
    expect(result.note).toBe("empty-query");
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  // 2. Happy path
  test("happy path: exact province name returns matching records", async () => {
    mockExecuteQuery.mockResolvedValueOnce([makeRow()]);
    const result = await thaiKnowledgeTool({ query: "กรุงเทพมหานคร" });
    expect(result.success).toBe(true);
    expect(result.domain).toBe("geo");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name_th).toBe("กรุงเทพมหานคร");
    expect(result.confidence).toBe(0.9);
    expect(result.source).toBe("knowledge_entities");
    expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
  });

  // 3. Alias path
  test("alias path: query string matches alias field (โคราช → นครราชสีมา)", async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      makeRow({
        id: "2",
        name_th: "นครราชสีมา",
        aliases: '["โคราช","Korat","นครราชสีมา"]',
        attributes: '{"region":"ภาคตะวันออกเฉียงเหนือ","type":"province"}',
        confidence: 0.85,
      }),
    ]);

    const result = await thaiKnowledgeTool({ query: "โคราช" });
    expect(result.success).toBe(true);
    expect(result.data[0].name_th).toBe("นครราชสีมา");
    expect(result.data[0].aliases).toContain("โคราช");
    // Verify the alias was included in the SQL parameters
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(String(sql)).toMatch(/aliases/i);
    expect(params.some((p: unknown) => String(p).includes("โคราช"))).toBe(true);
  });

  // 4. Region filter — raw name should be normalized to ภาคกลาง
  test("region filter normalizes raw name: กลาง → ภาคกลาง", async () => {
    mockExecuteQuery.mockResolvedValueOnce([makeRow()]);
    await thaiKnowledgeTool({ query: "จังหวัด", filter_region: "กลาง" });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    // Should include region filter param
    expect(params.some((p: unknown) => String(p).includes("ภาคกลาง"))).toBe(true);
  });

  test("region filter with ภาค prefix passes through unchanged", async () => {
    mockExecuteQuery.mockResolvedValueOnce([makeRow()]);
    await thaiKnowledgeTool({ query: "จังหวัด", filter_region: "ภาคเหนือ" });
    const [, params] = mockExecuteQuery.mock.calls[0];
    expect(params.some((p: unknown) => String(p).includes("ภาคเหนือ"))).toBe(true);
    // Should NOT have double-prefix ภาคภาคเหนือ
    expect(params.every((p: unknown) => !String(p).includes("ภาคภาค"))).toBe(true);
  });

  // 5. Low-confidence path
  test("low-confidence records are returned with confidence < 0.5", async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      makeRow({ confidence: 0.3, name_th: "หมู่บ้านทดสอบ" }),
    ]);
    const result = await thaiKnowledgeTool({ query: "ทดสอบ" });
    expect(result.success).toBe(true); // still returned, caller decides threshold
    expect(result.confidence).toBeCloseTo(0.3, 1);
  });

  // 6. DB error
  test("DB error returns success=false with db-error note", async () => {
    const dbErr = new Error("ECONNREFUSED");
    (dbErr as any).code = "ECONNREFUSED";
    mockExecuteQuery.mockRejectedValueOnce(dbErr);

    const result = await thaiKnowledgeTool({ query: "เชียงใหม่" });
    expect(result.success).toBe(false);
    expect(result.note).toMatch(/db-error/);
    expect(result.confidence).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  // 7. Limit clamping
  test("limit > 20 is clamped to 20", async () => {
    mockExecuteQuery.mockResolvedValueOnce([]);
    await thaiKnowledgeTool({ query: "จังหวัด", limit: 100 });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    // Last param is the LIMIT value
    const limitParam = params[params.length - 1];
    expect(limitParam).toBe(20);
  });

  test("limit=0 (falsy) falls back to default 8 due to || operator", async () => {
    // limit: 0 → Number(0 || 8) = 8 (0 is falsy in JS, so 8 is used as default)
    mockExecuteQuery.mockResolvedValueOnce([]);
    await thaiKnowledgeTool({ query: "จังหวัด", limit: 0 });
    const [, params] = mockExecuteQuery.mock.calls[0];
    expect(params[params.length - 1]).toBe(8);
  });

  // 8. No results
  test("no results returns success=false", async () => {
    mockExecuteQuery.mockResolvedValueOnce([]);
    const result = await thaiKnowledgeTool({ query: "xyzzy-impossible" });
    expect(result.success).toBe(false);
    expect(result.data).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  // 9. Aliases field: JSON string, comma-separated, array
  test("handles aliases as JSON string array", async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      makeRow({ aliases: '["สงขลา","Songkhla","หาดใหญ่"]' }),
    ]);
    const result = await thaiKnowledgeTool({ query: "สงขลา" });
    expect(result.data[0].aliases).toEqual(["สงขลา", "Songkhla", "หาดใหญ่"]);
  });

  test("handles aliases as comma-separated string", async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      makeRow({ aliases: "สงขลา,Songkhla,หาดใหญ่" }),
    ]);
    const result = await thaiKnowledgeTool({ query: "สงขลา" });
    expect(result.data[0].aliases).toEqual(["สงขลา", "Songkhla", "หาดใหญ่"]);
  });

  // 10. Attributes parsing
  test("parses JSON attributes correctly", async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      makeRow({ attributes: '{"region":"ภาคใต้","type":"province","lat":7.19}' }),
    ]);
    const result = await thaiKnowledgeTool({ query: "สงขลา" });
    expect(result.data[0].attributes.region).toBe("ภาคใต้");
    expect(result.data[0].attributes.lat).toBe(7.19);
  });

  // 11. Multi-result confidence = max confidence across records
  test("confidence = max across all returned records", async () => {
    mockExecuteQuery.mockResolvedValueOnce([
      makeRow({ id: "1", name_th: "ก", confidence: 0.6 }),
      makeRow({ id: "2", name_th: "ข", confidence: 0.95 }),
      makeRow({ id: "3", name_th: "ค", confidence: 0.7 }),
    ]);
    const result = await thaiKnowledgeTool({ query: "จังหวัด" });
    expect(result.confidence).toBeCloseTo(0.95, 2);
  });

  // 12. Regression: region-filter note is included when filter applied
  test("note includes region-filter when filter_region is set", async () => {
    mockExecuteQuery.mockResolvedValueOnce([makeRow()]);
    const result = await thaiKnowledgeTool({ query: "จังหวัด", filter_region: "เหนือ" });
    expect(result.note).toMatch(/region-filter/);
  });
});
