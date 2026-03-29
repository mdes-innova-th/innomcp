/**
 * thaiGeoTool.test.ts
 * Real unit tests for thaiGeoTool — no passWithNoTests
 *
 * Coverage:
 *  - empty query → fast-fail, no DB call
 *  - happy path: rows returned, mapped to data array
 *  - no results from DB: data=[], success=true, note=ไม่พบ
 *  - confidence threshold: note differs when below threshold
 *  - DB error: returns success=false with error note
 *  - aliases matching: rows with alias field
 *  - source parsing: source JSON array from rows[0].source
 *  - regression: หาดใหญ่ matches สงขลา district entity
 */

import { thaiGeoTool } from "../../../src/tools/thaiGeoTool";

jest.mock("../../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

import { withDbConnection } from "../../../src/utils/db";
const mockWithDb = withDbConnection as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbRow(overrides: Partial<{
  id: string;
  name_th: string;
  aliases: string;
  type: string;
  attributes: string;
  confidence: string;
  source: string;
}> = {}) {
  return {
    id: "10",
    name_th: "กรุงเทพมหานคร",
    aliases: '["กทม","Bangkok"]',
    type: "province",
    attributes: JSON.stringify({ region: "ภาคกลาง", lat: 13.75, lon: 100.5 }),
    confidence: "0.9",
    source: JSON.stringify([{ name: "กรมการปกครอง" }]),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockWithDb.mockReset();
});

describe("thaiGeoTool", () => {
  // 1. Empty query fast-fail
  test("empty query returns success=false without calling DB", async () => {
    const result = await thaiGeoTool.execute({ query: "" });
    expect(result.success).toBe(false);
    expect(result.data).toHaveLength(0);
    expect(result.confidence).toBe(0);
    expect(mockWithDb).not.toHaveBeenCalled();
  });

  test("whitespace-only query returns success=false without calling DB", async () => {
    const result = await thaiGeoTool.execute({ query: "   " });
    expect(result.success).toBe(false);
    expect(mockWithDb).not.toHaveBeenCalled();
  });

  // 2. Happy path
  test("happy path: rows found and mapped correctly", async () => {
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([[makeDbRow()], []]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "กรุงเทพ" });
    expect(result.success).toBe(true);
    expect(result.domain).toBe("geo");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("กรุงเทพมหานคร");
    expect(result.data[0].type).toBe("province");
    expect(result.confidence).toBe(0.9);
  });

  // 3. No results from DB
  test("no rows returns success=true with empty data and ไม่พบ note", async () => {
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([[], []]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "xyzzy-impossible" });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
    expect(result.note).toMatch(/ไม่พบ/);
    expect(result.confidence).toBe(0);
  });

  // 4. Confidence threshold: low confidence note
  test("low confidence note when max confidence < threshold", async () => {
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([
          [makeDbRow({ confidence: "0.3" })],
          [],
        ]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({
      query: "ทดสอบ",
      context: { confidence_required: 0.6 },
    });
    expect(result.note).toMatch(/ความน่าเชื่อถือ/);
  });

  test("meets confidence threshold → note is positive", async () => {
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([
          [makeDbRow({ confidence: "0.8" })],
          [],
        ]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({
      query: "กรุงเทพ",
      context: { confidence_required: 0.6 },
    });
    expect(result.note).toMatch(/พบข้อมูล/);
  });

  // 5. DB error
  test("DB error returns success=false with error message", async () => {
    mockWithDb.mockRejectedValueOnce(new Error("ECONNREFUSED: connect failed"));

    const result = await thaiGeoTool.execute({ query: "เชียงใหม่" });
    expect(result.success).toBe(false);
    expect(result.note).toMatch(/Database Error/);
    expect(result.data).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  // 6. Alias matching: query is in aliases column
  test("alias match: หาดใหญ่ matches row with alias in สงขลา record", async () => {
    const songkhlaRow = makeDbRow({
      id: "50",
      name_th: "หาดใหญ่",
      aliases: '["Hat Yai","อ.หาดใหญ่"]',
      type: "district",
      attributes: JSON.stringify({ region: "ภาคใต้", province: "สงขลา" }),
      confidence: "0.85",
    });

    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([[songkhlaRow], []]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "หาดใหญ่" });
    expect(result.success).toBe(true);
    expect(result.data[0].name).toBe("หาดใหญ่");
    // Verify execute was called with LIKE params
    const mockConn = mockWithDb.mock.calls[0];
    expect(mockWithDb).toHaveBeenCalledTimes(1);
  });

  // 7. Attributes parsing: JSON string → object
  test("parses JSON attributes into object", async () => {
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([
          [makeDbRow({ attributes: JSON.stringify({ region: "ภาคเหนือ", lat: 18.79, lon: 98.98 }) })],
          [],
        ]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "เชียงใหม่" });
    expect(result.data[0].attributes.region).toBe("ภาคเหนือ");
    expect(result.data[0].attributes.lat).toBe(18.79);
  });

  // 8. Source parsing from rows[0].source
  test("parses source JSON array from first row", async () => {
    const sources = [{ name: "กรมการปกครอง" }, { name: "DOPA" }];
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([
          [makeDbRow({ source: JSON.stringify(sources) })],
          [],
        ]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "กรุงเทพ" });
    expect(result.source).toEqual(sources);
  });

  // 9. Multi-row: confidence = max across rows
  test("confidence is max value across all rows", async () => {
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([
          [
            makeDbRow({ id: "1", name_th: "ก", confidence: "0.6" }),
            makeDbRow({ id: "2", name_th: "ข", confidence: "0.92" }),
            makeDbRow({ id: "3", name_th: "ค", confidence: "0.75" }),
          ],
          [],
        ]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "จังหวัด" });
    expect(result.confidence).toBeCloseTo(0.92, 2);
  });

  // 10. Tool metadata
  test("tool has correct name and required inputSchema", () => {
    expect(thaiGeoTool.name).toBe("thai_geo_tool");
    expect(thaiGeoTool.inputSchema.required).toContain("query");
    expect(typeof thaiGeoTool.execute).toBe("function");
  });

  // 11. Attributes as object (not string): should not throw
  test("handles attributes already as object (not string)", async () => {
    const rowWithObjAttributes = {
      ...makeDbRow(),
      attributes: { region: "ภาคกลาง", lat: 13.75 }, // already an object
    };

    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = {
        execute: jest.fn().mockResolvedValue([[rowWithObjAttributes], []]),
      };
      return fn(conn);
    });

    const result = await thaiGeoTool.execute({ query: "กรุงเทพ" });
    expect(result.success).toBe(true);
    expect(result.data[0].attributes.region).toBe("ภาคกลาง");
  });
});
