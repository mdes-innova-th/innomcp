import { analyzeData } from "../../src/services/dataAnalysisTool";
import { describe, it, expect } from "@jest/globals";
import * as os from "os";

const WS = os.tmpdir();
const CSV_NUM = "name,score,age\nAlice,85,25\nBob,92,30\nCarol,78,22\nDave,95,28";
const CSV_CAT = "city,sales\nBangkok,1000\nChiang Mai,750\nPhuket,500\nHat Yai,600";

describe("dataAnalysisTool", () => {
  it("parses row/col counts", async () => {
    const r = await analyzeData(CSV_NUM, { workspaceRoot: WS });
    expect(r.rowCount).toBe(4);
    expect(r.colCount).toBe(3);
  });
  it("detects numeric columns", async () => {
    const r = await analyzeData(CSV_NUM, { workspaceRoot: WS });
    const score = r.columns.find(c => c.name === "score");
    expect(score?.type).toBe("number");
    expect(score?.min).toBe(78);
    expect(score?.max).toBe(95);
  });
  it("computes correct mean", async () => {
    const r = await analyzeData(CSV_NUM, { workspaceRoot: WS });
    const score = r.columns.find(c => c.name === "score")!;
    expect(score.mean).toBeCloseTo(87.5, 1);
  });
  it("detects categorical columns", async () => {
    const r = await analyzeData(CSV_CAT, { workspaceRoot: WS });
    const city = r.columns.find(c => c.name === "city");
    expect(city?.type).toBe("string");
    expect(city?.unique).toBe(4);
  });
  it("generates bar chart SVG", async () => {
    const r = await analyzeData(CSV_CAT, { workspaceRoot: WS });
    expect(r.chartSvg).toContain("<svg");
    expect(r.chartSvg).toContain("Bangkok");
  });
  it("produces summary string", async () => {
    const r = await analyzeData(CSV_NUM, { workspaceRoot: WS });
    expect(r.summary).toContain("4 rows");
    expect(r.summary).toContain("score");
  });
  it("handles empty CSV gracefully", async () => {
    const r = await analyzeData("", { workspaceRoot: WS });
    expect(r.rowCount).toBe(0);
  });
});
