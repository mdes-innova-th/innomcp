import test from "node:test";
import assert from "node:assert/strict";
import { thaiGeoTool, setGeoDb, MariaDbGeoDb, type GeoDbAdapter } from "./thaiGeoTool";

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
});

test("thai_geo_tool: confidence_required gates low confidence", async () => {
  const result = await thaiGeoTool.execute({ query: "โคร", context: { confidence_required: 0.9 } });
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
  assert.ok(body.note.includes("fallback to stub"));

  setGeoDb(new MariaDbGeoDb());
});
