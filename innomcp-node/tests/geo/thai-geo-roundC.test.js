const test = require("node:test");
const assert = require("node:assert/strict");

// NOTE: tests run against compiled JS output.
const { handleThaiGeoTool, renderThaiGeoAnswerShort } = require("../../dist/utils/mcp/tools/thai_geo_tool");

function noForbiddenChars(s) {
  assert.equal(typeof s, "string");
  assert.ok(!/[{}\\"`]/.test(s), `forbidden chars found in: ${s}`);
}

function countQuestionMarks(s) {
  return (String(s).match(/\?/g) || []).length;
}

test("geo_lookup: empty query => INVALID_QUERY", async () => {
  const out = await handleThaiGeoTool({ action: "geo_lookup", query: "" });
  assert.equal(out.ok, false);
  assert.equal(String(out.code), "INVALID_QUERY");
  noForbiddenChars(String(out.message || ""));
});

test("address_normalize: Bangkok + soi/moo + Thai digits postcode", async () => {
  const out = await handleThaiGeoTool({
    action: "address_normalize",
    address: "เลขที่ 99 หมู่ 5 ซ.สุขุมวิท 50 ถ.สุขุมวิท แขวงพระโขนง เขตคลองเตย กทม ๑๐๑๑๐",
  });
  assert.equal(out.ok, true);
  assert.equal(out.code, "OK");
  assert.equal(out.data.normalized.province, "กรุงเทพมหานคร");
  assert.equal(out.data.normalized.postcode, "10110");
  assert.ok(out.data.normalized.soi);
  assert.ok(out.data.normalized.moo);

  const rendered = renderThaiGeoAnswerShort(out);
  noForbiddenChars(rendered.text);
  assert.match(rendered.text, /จัดรูปแบบที่อยู่/);
});

test("address_normalize: Thai abbreviations จ./อ./ต.", async () => {
  const out = await handleThaiGeoTool({
    action: "address_normalize",
    address: "จ.เชียงใหม่ อ.เมือง ต.สุเทพ 50200",
  });
  assert.equal(out.ok, true);
  assert.equal(out.data.normalized.province, "เชียงใหม่");
  assert.equal(out.data.normalized.district, "เมือง");
  assert.equal(out.data.normalized.subdistrict, "สุเทพ");
  assert.equal(out.data.normalized.postcode, "50200");
});

test("geo_lookup: postcode 10500 => postcode entity", async () => {
  const out = await handleThaiGeoTool({ action: "geo_lookup", query: "10500", topN: 5 });
  assert.equal(out.ok, true);
  assert.equal(out.code, "OK");
  assert.equal(out.data.best.type, "postcode");
  assert.equal(out.data.best.name_th, "10500");
  assert.equal(out.data.best.attributes.province, "กรุงเทพมหานคร");

  const rendered = renderThaiGeoAnswerShort(out);
  noForbiddenChars(rendered.text);
  assert.match(rendered.text, /รหัสไปรษณีย์[:\s]*10500/);
});

test("geo_lookup: Thai digits postcode ๑๐๕๐๐ => postcode entity", async () => {
  const out = await handleThaiGeoTool({ action: "geo_lookup", query: "๑๐๕๐๐", topN: 5 });
  assert.equal(out.ok, true);
  assert.equal(out.data.best.type, "postcode");
  assert.equal(out.data.best.name_th, "10500");
});

test("geo_lookup: subdistrict สีลม => subdistrict entity", async () => {
  const out = await handleThaiGeoTool({ action: "geo_lookup", query: "สีลม", topN: 5 });
  assert.equal(out.ok, true);
  assert.equal(out.data.best.type, "subdistrict");
  assert.equal(out.data.best.attributes.province, "กรุงเทพมหานคร");
  assert.equal(out.data.best.attributes.district, "บางรัก");
});

test("geo_validate: postcode mismatch (10500 but Chiang Mai) => POSTCODE_MISMATCH", async () => {
  const out = await handleThaiGeoTool({
    action: "geo_validate",
    components: { postcode: "10500", province: "เชียงใหม่" },
  });
  assert.equal(out.ok, false);
  assert.equal(out.code, "POSTCODE_MISMATCH");
  noForbiddenChars(String(out.message || ""));
});

test("geo_validate: postcode mismatch (10500 but wrong district) => POSTCODE_MISMATCH", async () => {
  const out = await handleThaiGeoTool({
    action: "geo_validate",
    components: { postcode: "10500", province: "กรุงเทพมหานคร", district: "คลองเตย" },
  });
  assert.equal(out.ok, false);
  assert.equal(out.code, "POSTCODE_MISMATCH");
});

test("geo_validate: subdistrict-district mismatch => SUBDISTRICT_MISMATCH", async () => {
  const out = await handleThaiGeoTool({
    action: "geo_validate",
    components: { province: "กรุงเทพมหานคร", district: "คลองเตย", subdistrict: "สีลม" },
  });
  assert.equal(out.ok, false);
  assert.equal(out.code, "SUBDISTRICT_MISMATCH");
});

test("geo_lookup: ambiguous common name => Top3 + exactly 1 follow-up question", async () => {
  const out = await handleThaiGeoTool({ action: "geo_lookup", query: "บ้านใหม่", topN: 5 });
  assert.equal(out.ok, true);
  assert.equal(out.code, "AMBIGUOUS");
  assert.ok(Array.isArray(out.data.candidates));

  const rendered = renderThaiGeoAnswerShort(out);
  noForbiddenChars(rendered.text);
  assert.match(rendered.text, /1\)/);
  assert.match(rendered.text, /2\)/);
  assert.match(rendered.text, /3\)/);
  assert.equal(countQuestionMarks(rendered.text), 1);
});

test("render: NOT_FOUND stays fence-free and safe", () => {
  const rendered = renderThaiGeoAnswerShort({ ok: false, code: "NOT_FOUND", message: "ไม่พบข้อมูล" });
  noForbiddenChars(rendered.text);
  assert.match(rendered.trace, /^ERR:/);
});

const naturalAliasQuestionCases = [
  { q: "ปากช่องอยู่จังหวัดอะไร", district: "ปากช่อง", province: "นครราชสีมา" },
  { q: "หัวหินอยู่จังหวัดอะไร", district: "หัวหิน", province: "ประจวบคีรีขันธ์" },
  { q: "แม่สายอยู่จังหวัดอะไร", district: "แม่สาย", province: "เชียงราย" },
];

for (const tc of naturalAliasQuestionCases) {
  test(`geo_lookup natural alias question: ${tc.q}`, async () => {
    const out = await handleThaiGeoTool({ action: "geo_lookup", query: tc.q, topN: 5 });
    assert.equal(out.ok, true);
    assert.equal(out.code, "OK");
    assert.equal(out.data.best.type, "district");
    assert.equal(out.data.best.name_th, tc.district);
    assert.equal(out.data.best.attributes.province, tc.province);

    const rendered = renderThaiGeoAnswerShort(out);
    noForbiddenChars(rendered.text);
    assert.match(rendered.text, new RegExp(`จังหวัด[:\\s]*${tc.province}`));
  });
}

// Additional Thai-real lookups (seed-backed, deterministic)
const lookupCases = [
  { q: "กรุงเทพมหานคร", expect: /(จังหวัด[:\s]*)?กรุงเทพมหานคร/ },
  { q: "กทม", expect: /กรุงเทพมหานคร/ },
  { q: "เชียงใหม่", expect: /จังหวัด[:\s]*เชียงใหม่/ },
  { q: "เชียงราย", expect: /จังหวัด[:\s]*เชียงราย/ },
  { q: "นครราชสีมา", expect: /จังหวัด[:\s]*นครราชสีมา/ },
  { q: "โคราช", expect: /จังหวัด[:\s]*นครราชสีมา/ },
  { q: "ขอนแก่น", expect: /จังหวัด[:\s]*ขอนแก่น/ },
  { q: "เมืองหมอแคน", expect: /จังหวัด[:\s]*ขอนแก่น/ },
  { q: "ชลบุรี", expect: /จังหวัด[:\s]*ชลบุรี/ },
  { q: "บางแสน", expect: /จังหวัด[:\s]*ชลบุรี/ },
  { q: "ภูเก็ต", expect: /จังหวัด[:\s]*ภูเก็ต/ },
  { q: "phuket", expect: /จังหวัด[:\s]*ภูเก็ต/ },
  { q: "สงขลา", expect: /จังหวัด[:\s]*สงขลา/ },
  { q: "นครศรีธรรมราช", expect: /จังหวัด[:\s]*นครศรีธรรมราช/ },
  { q: "เมืองคอน", expect: /จังหวัด[:\s]*นครศรีธรรมราช/ },
  { q: "ปทุมธานี", expect: /จังหวัด[:\s]*ปทุมธานี/ },
  { q: "อยุธยา", expect: /จังหวัด[:\s]*(พระนครศรี)?อยุธยา/ },
  { q: "อุบลราชธานี", expect: /จังหวัด[:\s]*อุบลราชธานี/ },
  { q: "บางรัก", expect: /(เขต|อำเภอ)[:\s]*บางรัก/ },
  { q: "ปทุมวัน", expect: /(เขต|อำเภอ)[:\s]*ปทุมวัน/ },
  { q: "จตุจักร", expect: /(เขต|อำเภอ)[:\s]*จตุจักร/ },
  { q: "ลุมพินี", expect: /(แขวง|ตำบล)[:\s]*ลุมพินี/ },
  { q: "สี่พระยา", expect: /(แขวง|ตำบล)[:\s]*สี่พระยา/ },
  { q: "10500 บางรัก", expect: /รหัสไปรษณีย์[:\s]*10500/ },
  { q: "รหัสไปรษณีย์ 10330", expect: /10330/ },
  { q: "10900", expect: /10900/ },
];

for (const [idx, tc] of lookupCases.entries()) {
  test(`geo_lookup seed case ${idx + 1}: ${tc.q}`, async () => {
    const out = await handleThaiGeoTool({ action: "geo_lookup", query: tc.q, topN: 5 });
    assert.equal(out.ok, true);
    const rendered = renderThaiGeoAnswerShort(out);
    noForbiddenChars(rendered.text);
    assert.match(rendered.text, tc.expect);
  });
}
