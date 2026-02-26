const test = require("node:test");
const assert = require("node:assert/strict");

// NOTE: these tests run against compiled JS output.
const { GeoIntent } = require("../../dist/geo/geo-intent");
const { GeoRouter } = require("../../dist/geo/geo-tool-router");
const { GeoGuard } = require("../../dist/geo/geo-guard");
const { GeoAggregator } = require("../../dist/geo/geo-aggregator");
const { GeoService } = require("../../dist/geo/geo-service");

function makeIntent(msg) {
  const intent = new GeoIntent();
  return intent.analyze(msg);
}

test("1) 24h + coords => nwp_hourly_by_location", () => {
  const intent = makeIntent("พยากรณ์อากาศ 24 ชม ที่พิกัด 14.97,102.09");
  assert.equal(intent.domain, "weather");

  const router = new GeoRouter();
  const plan = router.route(intent);
  assert.ok(plan);
  assert.equal(plan.primary.tool_name, "nwp_hourly_by_location");
  assert.deepEqual(plan.primary.params, { lat: 14.97, lon: 102.09 });
});

test("2) Tomorrow + Korat => daily forecast plan (by place)", () => {
  const intent = makeIntent("พรุ่งนี้ฝนตกไหมที่โคราช");
  assert.equal(intent.domain, "weather");

  const router = new GeoRouter();
  const plan = router.route(intent);
  assert.ok(plan);
  assert.equal(plan.primary.tool_name, "nwp_daily_by_place");
  assert.deepEqual(plan.primary.params, { place: "โคราช" });
});

test("3) 'รายชั่วโมง' keyword => hourly", () => {
  const intent = makeIntent("รายชั่วโมง โคราช");
  assert.equal(intent.subdomain, "nwp_hourly");
});

test("4) '7 วัน' keyword => daily", () => {
  const intent = makeIntent("พยากรณ์อากาศ 7 วัน โคราช");
  assert.equal(intent.subdomain, "nwp_daily");
});

test("5) Tool timeout => retry then degrade", async () => {
  const guard = new GeoGuard(15);

  const neverResolves = () => new Promise(() => {});
  const packet = await guard.executeWithGuard(neverResolves, "fake_tool");

  assert.ok(packet.error);
  assert.ok(packet.fallback_used);
  assert.match(packet.summary, /ขออภัย/);
  assert.equal(packet.source, "fake_tool");
});

test("6) Remote down => local fallback WeatherPacket produced", async () => {
  const dispatch = async () => {
    const err = new Error("ECONNREFUSED");
    throw err;
  };

  const svc = new GeoService(dispatch);
  const packet = await svc.handleRequest("พยากรณ์อากาศ 24 ชม ที่พิกัด 14.97,102.09");

  assert.ok(packet);
  assert.ok(packet.error);
  assert.ok(packet.fallback_used);
  assert.match(packet.error, /ECONNREFUSED|Timeout/);
});

test("7) Language mismatch => normalize summary to Thai when possible", () => {
  const agg = new GeoAggregator();

  const packet = {
    summary: "",
    timestamp: new Date().toISOString(),
    source: "nwp_daily_by_place",
    raw_data: { condition: "Clear", temp: 30, humidity: 60 },
    evidence: { tool: "nwp_daily_by_place", latency_ms: 1, confidence: 1 },
  };

  const out = agg.format(packet);
  assert.match(out.summary, /ท้องฟ้าโปร่ง/);
});

test("8) Ambiguous location => ask follow-up", async () => {
  const dispatch = async () => ({ temp: 30 });
  const svc = new GeoService(dispatch);

  const packet = await svc.handleRequest("พยากรณ์อากาศ");
  assert.match(packet.summary, /กรุณาระบุจังหวัดหรือพิกัด/);
});
