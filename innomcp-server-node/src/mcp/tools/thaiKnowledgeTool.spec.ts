import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import * as db from "../../utils/db";
import { thaiKnowledgeTool } from "./thaiKnowledgeTool";

const originalQuery = db.query;

afterEach(() => {
  (db as any).query = originalQuery;
});

function parseToolText(result: any): any {
  assert.ok(result);
  assert.ok(Array.isArray(result.content));
  assert.equal(result.content[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

function mockDbRows(confidence: number) {
  return [
    {
      id: "geo:test:01",
      domain: "geo",
      name_th: "จังหวัดทดสอบ",
      aliases: JSON.stringify(["ทดสอบ"]),
      description: "ข้อมูลทดสอบสำหรับ threshold",
      attributes: JSON.stringify({ region: "กลาง" }),
      relations: JSON.stringify([]),
      source: JSON.stringify([{ name: "fixture", url: "https://example.test" }]),
      confidence,
      version: "1.0.0",
      updated_at: new Date().toISOString(),
    },
  ];
}

test("thaiKnowledgeTool: default threshold rejects confidence < 0.6", async () => {
  (db as any).query = async () => mockDbRows(0.55);

  const result = await thaiKnowledgeTool.execute({ query: "ทดสอบ" });
  const body = parseToolText(result);

  assert.equal(body.success, false);
  assert.equal(body.error_code, "LOW_CONFIDENCE");
});

test("thaiKnowledgeTool: default threshold accepts confidence >= 0.6", async () => {
  (db as any).query = async () => mockDbRows(0.61);

  const result = await thaiKnowledgeTool.execute({ query: "ทดสอบ" });
  const body = parseToolText(result);

  assert.equal(body.success, true);
  assert.equal(body.domain, "geo");
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data[0].name_th, "จังหวัดทดสอบ");
  assert.ok(body.confidence >= 0.6);
});

test("thaiKnowledgeTool: explicit confidence_required overrides default", async () => {
  (db as any).query = async () => mockDbRows(0.75);

  const result = await thaiKnowledgeTool.execute({
    query: "ทดสอบ",
    context: { confidence_required: 0.8 },
  });
  const body = parseToolText(result);

  assert.equal(body.success, false);
  assert.equal(body.error_code, "LOW_CONFIDENCE");
});
