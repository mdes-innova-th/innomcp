// Geo core (phase 1) — converted from node:test to Jest.
// Tests pure logic: GeoIntent, GeoRouter, GeoGuard, GeoAggregator, GeoService.
// Imports source TypeScript directly (no compile step required).

import { GeoIntent } from "../../src/geo/geo-intent";
import { GeoRouter } from "../../src/geo/geo-tool-router";
import { GeoGuard } from "../../src/geo/geo-guard";
import { GeoAggregator } from "../../src/geo/geo-aggregator";
import { GeoService } from "../../src/geo/geo-service";

function makeIntent(msg: string) {
  const intent = new GeoIntent();
  return intent.analyze(msg);
}

test("1) 24h + coords => nwp_hourly_by_location", () => {
  const intent = makeIntent("พยากรณ์อากาศ 24 ชม ที่พิกัด 14.97,102.09");
  expect(intent.domain).toBe("weather");

  const router = new GeoRouter();
  const plan = router.route(intent);
  expect(plan).toBeTruthy();
  expect(plan!.primary.tool_name).toBe("nwp_hourly_by_location");
  expect(plan!.primary.params).toEqual({ lat: 14.97, lon: 102.09 });
});

test("2) Tomorrow + Korat => daily forecast plan (by place)", () => {
  const intent = makeIntent("พรุ่งนี้ฝนตกไหมที่โคราช");
  expect(intent.domain).toBe("weather");

  const router = new GeoRouter();
  const plan = router.route(intent);
  expect(plan).toBeTruthy();
  expect(plan!.primary.tool_name).toBe("nwp_daily_by_place");
  expect(plan!.primary.params).toEqual({ place: "โคราช" });
});

test("3) 'รายชั่วโมง' keyword => hourly", () => {
  const intent = makeIntent("รายชั่วโมง โคราช");
  expect(intent.subdomain).toBe("nwp_hourly");
});

test("4) '7 วัน' keyword => daily", () => {
  const intent = makeIntent("พยากรณ์อากาศ 7 วัน โคราช");
  expect(intent.subdomain).toBe("nwp_daily");
});

test("5) Tool timeout => retry then degrade", async () => {
  const guard = new GeoGuard(15);

  const neverResolves = () => new Promise<never>(() => {});
  const packet = await guard.executeWithGuard(neverResolves, "fake_tool");

  expect(packet.error).toBeTruthy();
  expect(packet.fallback_used).toBeTruthy();
  expect(packet.summary).toMatch(/ขออภัย/);
  expect(packet.source).toBe("fake_tool");
});

test("6) Remote down => local fallback WeatherPacket produced", async () => {
  const dispatch = async (): Promise<never> => {
    const err = new Error("ECONNREFUSED");
    throw err;
  };

  const svc = new GeoService(dispatch);
  const packet = await svc.handleRequest("พยากรณ์อากาศ 24 ชม ที่พิกัด 14.97,102.09");

  expect(packet).toBeTruthy();
  expect(packet.error).toBeTruthy();
  expect(packet.fallback_used).toBeTruthy();
  expect(packet.error).toMatch(/ECONNREFUSED|Timeout/);
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

  const out = agg.format(packet as Parameters<GeoAggregator["format"]>[0]);
  expect(out.summary).toMatch(/ท้องฟ้าโปร่ง/);
});

test("8) Ambiguous location => ask follow-up", async () => {
  const dispatch = async () => ({ temp: 30 });
  const svc = new GeoService(dispatch);

  const packet = await svc.handleRequest("พยากรณ์อากาศ");
  expect(packet.summary).toMatch(/กรุณาระบุจังหวัดหรือพิกัด/);
});
