import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { thaiGeoTool, setGeoDb, InMemoryGeoDb, THAI_GEO_SEED, type GeoDbAdapter } from "./thaiGeoTool";
import type { ThaiGeoEntity } from "./thaiGeoTool.types";

beforeEach(() => {
  // Unit tests must not depend on MariaDB availability.
  setGeoDb(new InMemoryGeoDb(THAI_GEO_SEED));
});

function parseToolText(result: any): any {
  assert.ok(result);
  assert.ok(Array.isArray(result.content));
  assert.equal(result.content[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

test("thai_geo_tool: name is stable", () => {
  assert.equal(thaiGeoTool.name, "thai_geo_tool");
});

test("thai_geo_tool: empty query -> INVALID_QUERY", async () => {
  const result = await thaiGeoTool.execute({ query: "" });
  const body = parseToolText(result);
  assert.equal(body.success, false);
  assert.equal(body.error_code, "INVALID_QUERY");
});

test("thai_geo_tool: alias match (โคราช) returns นครราชสีมา", async () => {
  const result = await thaiGeoTool.execute({ query: "โคราช" });
  const body = parseToolText(result);

  assert.equal(body.success, true);
  assert.equal(body.domain, "geo");
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 1);
  assert.equal(body.data[0].name_th, "นครราชสีมา");
  assert.equal(body.data[0].attributes.region, "อีสาน");
  assert.ok(typeof body.confidence === "number");
  assert.ok(body.confidence >= 0.9);
  assert.ok(Array.isArray(body.source));
  assert.ok(body.source.length >= 1);
  assert.equal(body.source[0].name, "DOPA");
});

test("thai_geo_tool: filter_region match returns only requested region", async () => {
  const result = await thaiGeoTool.execute({ query: "จังหวัด", filter_region: "เหนือ" });
  const body = parseToolText(result);

  assert.equal(body.success, true);
  assert.ok(body.data.length >= 1);
  assert.ok(body.data.every((item: any) => item.attributes.region === "เหนือ"));
});

test("thai_geo_tool: confidence_required rejects low confidence result", async () => {
  const lowConfidenceFixture: ThaiGeoEntity[] = [
    {
      id: "PROV-TEST-LOW",
      domain: "geo",
      type: "province",
      name_th: "จังหวัดทดสอบ",
      aliases: [],
      description: "จังหวัดทดสอบสำหรับเช็ค low confidence",
      attributes: { province: "จังหวัดทดสอบ", region: "กลาง" },
      relations: [],
      source: [{ name: "fixture" }],
      confidence: 0.4,
      version: "1.0.0",
      updated_at: new Date().toISOString(),
    },
  ];

  setGeoDb(new InMemoryGeoDb(lowConfidenceFixture));
  const result = await thaiGeoTool.execute({
    query: "จังหวัดทดสอบ",
    context: { confidence_required: 0.8 },
  });
  const body = parseToolText(result);

  assert.equal(body.success, false);
  assert.equal(body.error_code, "LOW_CONFIDENCE");
});

test("thai_geo_tool: unknown query returns NOT_FOUND", async () => {
  const result = await thaiGeoTool.execute({ query: "จังหวัดทดลองไม่มีจริง" });
  const body = parseToolText(result);

  assert.equal(body.success, false);
  assert.equal(body.error_code, "NOT_FOUND");
});

test("thai_geo_tool: DB adapter error triggers fallback to stub", async () => {
  const throwingAdapter: GeoDbAdapter = {
    async search(): Promise<any[]> {
      throw new Error("simulated db error");
    },
  };

  setGeoDb(throwingAdapter);
  const result = await thaiGeoTool.execute({ query: "โคราช" });
  const body = parseToolText(result);

  assert.equal(body.success, true);
  assert.ok(typeof body.note === "string");
  assert.ok(body.note.includes("fallback"));

  setGeoDb(new InMemoryGeoDb(THAI_GEO_SEED));
});
