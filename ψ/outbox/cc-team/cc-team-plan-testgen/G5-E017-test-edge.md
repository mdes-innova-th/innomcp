<!-- cc-team deliverable
 group: G5 (Generate jest unit tests for untested innomcp-node modules (batch 5))
 member: E017 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1894,"completion_tokens":7250,"total_tokens":9144,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5076,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T11:15:00.149Z -->
```typescript
import { GeoRouter } from '../src/geo/geo-tool-router';
import type { GeoIntentResult, ToolPlan } from '../src/geo/interfaces';

describe('GeoRouter', () => {
  let router: GeoRouter;

  beforeEach(() => {
    router = new GeoRouter();
  });

  // Helper to build a valid intent with easy overrides
  const makeIntent = (overrides: Partial<GeoIntentResult> = {}): GeoIntentResult => ({
    domain: 'weather',
    confidence: 0.9,
    subdomain: 'nwp_hourly',
    features: {
      has_coords: true,
      coords: { lat: 13.75, lon: 100.5 },
      location_terms: ['Bangkok'],
    },
    ...overrides,
  });

  // ── route() error / edge paths ──────────────────────────────────────

  test('returns null when domain is not "weather"', () => {
    const intent = makeIntent({ domain: 'traffic' });
    expect(router.route(intent)).toBeNull();
  });

  test('returns null when confidence is below 0.6', () => {
    expect(router.route(makeIntent({ confidence: 0.59 }))).toBeNull();
    expect(router.route(makeIntent({ confidence: 0 }))).toBeNull();
    expect(router.route(makeIntent({ confidence: -0.1 }))).toBeNull();
  });

  test('returns a plan when confidence is exactly 0.6 (boundary accepted)', () => {
    const intent = makeIntent({ confidence: 0.6, subdomain: 'nwp_hourly' });
    const plan = router.route(intent);
    expect(plan).not.toBeNull();
    expect(plan!.primary.tool_name).toBe('nwp_hourly_by_location');
  });

  test('returns null when no location info is available (no coords, no place)', () => {
    const intent = makeIntent({
      features: { has_coords: false, location_terms: [] },
    });
    expect(router.route(intent)).toBeNull();
  });

  test('returns null when has_coords is true but coords is undefined and location_terms empty', () => {
    const intent = makeIntent({
      features: {
        has_coords: true,
        coords: undefined,
        location_terms: [],
      },
    } as any);
    expect(router.route(intent)).toBeNull();
  });

  test('throws TypeError when features is null (destructure failure)', () => {
    const intent = {
      domain: 'weather',
      confidence: 0.9,
      subdomain: 'nwp_hourly',
      features: null,
    } as any;
    expect(() => router.route(intent)).toThrow(TypeError);
  });

  // ── Routing for defined subdomains ──────────────────────────────────

  test('nwp_hourly with coords → hourly-by-location primary, daily-by-location fallback', () => {
    const intent = makeIntent({
      subdomain: 'nwp_hourly',
      features: {
        has_coords: true,
        coords: { lat: 13.75, lon: 100.5 },
        location_terms: ['Bangkok'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_hourly_by_location');
    expect(plan.primary.params).toEqual({ lat: 13.75, lon: 100.5 });
    expect(plan.fallbacks).toHaveLength(1);
    expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_location');
    expect(plan.fallbacks[0].params).toEqual({ lat: 13.75, lon: 100.5 });
  });

  test('nwp_hourly with place only → hourly-by-place primary, two fallbacks', () => {
    const intent = makeIntent({
      subdomain: 'nwp_hourly',
      features: {
        has_coords: false,
        location_terms: ['Chiang', 'Mai'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_hourly_by_place');
    expect(plan.primary.params).toEqual({ place: 'Chiang Mai' });
    expect(plan.fallbacks).toHaveLength(2);
    expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_place');
    expect(plan.fallbacks[1].tool_name).toBe('tmd_weather_forecast_7days_by_province');
  });

  test('nwp_daily with coords → daily-by-location primary, hourly-by-location fallback', () => {
    const intent = makeIntent({
      subdomain: 'nwp_daily',
      features: {
        has_coords: true,
        coords: { lat: 15, lon: 102 },
        location_terms: ['Phuket'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_daily_by_location');
    expect(plan.primary.params).toEqual({ lat: 15, lon: 102 });
    expect(plan.fallbacks).toHaveLength(1);
    expect(plan.fallbacks[0].tool_name).toBe('nwp_hourly_by_location');
  });

  test('nwp_daily with place only → daily-by-place primary, TMD fallbacks', () => {
    const intent = makeIntent({
      subdomain: 'nwp_daily',
      features: {
        has_coords: false,
        location_terms: ['Pattaya'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_daily_by_place');
    expect(plan.primary.params).toEqual({ place: 'Pattaya' });
    expect(plan.fallbacks).toHaveLength(2);
    expect(plan.fallbacks[0].tool_name).toBe('tmd_weather_forecast_7days_by_province');
    expect(plan.fallbacks[0].params).toEqual({ province: 'Pattaya' });
    expect(plan.fallbacks[1].tool_name).toBe('tmd_daily_forecast_4_times');
    expect(plan.fallbacks[1].params).toEqual({});
  });

  test('tmd_forecast with coords → TMD 7-day primary, NWP daily-by-location fallback', () => {
    const intent = makeIntent({
      subdomain: 'tmd_forecast',
      features: {
        has_coords: true,
        coords: { lat: 16, lon: 103 },
        location_terms: ['Udon'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('tmd_weather_forecast_7days_by_province');
    expect(plan.primary.params).toEqual({ province: 'Udon' });
    expect(plan.fallbacks).toHaveLength(1);
    expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_location');
    expect(plan.fallbacks[0].params).toEqual({ lat: 16, lon: 103 });
  });

  test('tmd_forecast with place only → TMD 7-day primary, NWP daily-by-place fallback', () => {
    const intent = makeIntent({
      subdomain: 'tmd_forecast',
      features: {
        has_coords: false,
        location_terms: ['Nakhon', 'Ratchasima'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('tmd_weather_forecast_7days_by_province');
    expect(plan.primary.params).toEqual({ province: 'Nakhon Ratchasima' });
    expect(plan.fallbacks).toHaveLength(1);
    expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_place');
    expect(plan.fallbacks[0].params).toEqual({ place: 'Nakhon Ratchasima' });
  });

  // ── Fallback / default subdomain handling ───────────────────────────

  test('undefined subdomain defaults to daily plan (place only)', () => {
    const intent = makeIntent({
      subdomain: undefined as any,
      features: {
        has_coords: false,
        location_terms: ['Surat'],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_daily_by_place');
  });

  test('unknown subdomain defaults to daily plan with coords', () => {
    const intent = makeIntent({
      subdomain: 'bogus' as any,
      features: {
        has_coords: true,
        coords: { lat: 14, lon: 101 },
        location_terms: [],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_daily_by_location');
  });

  test('empty string location_terms still produce a plan with empty place', () => {
    const intent = makeIntent({
      subdomain: 'nwp_hourly',
      features: {
        has_coords: false,
        location_terms: [''],
      },
    });
    const plan = router.route(intent) as ToolPlan;
    expect(plan.primary.tool_name).toBe('nwp_hourly_by_place');
    expect(plan.primary.params).toEqual({ place: '' });
  });
});
```
