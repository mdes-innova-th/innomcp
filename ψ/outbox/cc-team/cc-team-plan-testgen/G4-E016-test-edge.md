<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E016 role=test-edge model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2237,"completion_tokens":3039,"total_tokens":5276,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1318,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:14:15.998Z -->
```typescript
import { GeoIntent } from '../src/geo/geo-intent';

describe('GeoIntent', () => {
  let geoIntent: GeoIntent;

  beforeEach(() => {
    geoIntent = new GeoIntent();
  });

  // ── Edge Cases: empty/malformed inputs ──

  test('analyze() with empty string returns unknown domain', () => {
    const result = geoIntent.analyze('');
    expect(result.domain).toBe('unknown');
    expect(result.subdomain).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.raw_input).toBe('');
    expect(result.features.has_coords).toBe(false);
    expect(result.features.location_terms).toEqual([]);
  });

  test('analyze() with only whitespace returns unknown domain', () => {
    const result = geoIntent.analyze('   ');
    expect(result.domain).toBe('unknown');
    expect(result.raw_input).toBe('   ');
  });

  test('analyze() with only noise words returns unknown domain', () => {
    const result = geoIntent.analyze('ครับ ที่ จังหวัด');
    expect(result.domain).toBe('unknown');
    expect(result.features.location_terms).toEqual([]);
  });

  test('analyze() with null input throws TypeError', () => {
    // Simulate runtime null input (bypass TypeScript strict checks)
    expect(() => geoIntent.analyze(null as any)).toThrow(TypeError);
  });

  test('analyze() with undefined input throws TypeError', () => {
    expect(() => geoIntent.analyze(undefined as any)).toThrow(TypeError);
  });

  // ── Edge Cases: coordinate extraction ──

  test('analyze() with only valid coordinates returns unknown domain but coords extracted', () => {
    const result = geoIntent.analyze('14.97,102.09');
    expect(result.domain).toBe('unknown');
    expect(result.features.has_coords).toBe(true);
    expect(result.features.coords).toEqual({ lat: 14.97, lon: 102.09 });
  });

  test('analyze() with coordinates using space separator', () => {
    const result = geoIntent.analyze('14.97 102.09');
    expect(result.features.has_coords).toBe(true);
    expect(result.features.coords).toEqual({ lat: 14.97, lon: 102.09 });
  });

  test('analyze() with malformed coordinates (missing decimal) does not match', () => {
    const result = geoIntent.analyze('14.97,102');
    expect(result.features.has_coords).toBe(false);
    expect(result.features.coords).toBeUndefined();
  });

  test('analyze() with coordinates having only one digit after decimal does not match', () => {
    const result = geoIntent.analyze('14.97,102.0');
    expect(result.features.has_coords).toBe(false);
  });

  // ── Weather domain detection ──

  test('analyze() with weather keyword alone triggers weather domain', () => {
    const result = geoIntent.analyze('weather');
    expect(result.domain).toBe('weather');
    expect(result.confidence).toBe(0.7);
    expect(result.subdomain).toBe('nwp_daily');
  });

  test('analyze() with TMD keyword triggers TMD subdomain', () => {
    const result = geoIntent.analyze('กรมอุตุ Bangkok');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('tmd_forecast');
  });

  test('analyze() with hourly signal and location triggers nwp_hourly subdomain', () => {
    const result = geoIntent.analyze('hourly weather in Tokyo');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_hourly');
  });

  test('analyze() with daily signal and location triggers nwp_daily subdomain', () => {
    const result = geoIntent.analyze('daily forecast London');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_daily');
  });

  test('analyze() with both hourly and daily signals and no coords defaults to nwp_daily', () => {
    const result = geoIntent.analyze('hourly daily weather');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_daily');
  });

  test('analyze() with both hourly and daily signals and coords defaults to nwp_hourly', () => {
    const result = geoIntent.analyze('hourly daily weather at 14.97,102.09');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_hourly');
  });

  test('analyze() with hourly signal but no location returns unknown domain', () => {
    // isWeather requires either weather keyword OR TMD OR (time && location_terms)
    const result = geoIntent.analyze('hourly');
    expect(result.domain).toBe('unknown');
  });

  // ── Confidence scoring ──

  test('analyze() confidence increases with coords and location and time signals', () => {
    const result = geoIntent.analyze('forecast rain at 13.73,100.52 hourly');
    expect(result.domain).toBe('weather');
    expect(result.confidence).toBeCloseTo(0.95, 2); // 0.7 + 0.1 (coords) + 0.05 (location) + 0.1 (hourly)
  });

  test('analyze() confidence does not exceed 1', () => {
    const result = geoIntent.analyze('weather rain forecast at 13.73,100.52 hourly daily Bangkok');
    // base 0.7 + 0.1 (coords) + 0.05 (location) + 0.1 (hourly) = 0.95, but also wants_daily? Actually both, but only one +0.1? The code: if (features.wants_hourly || features.wants_daily) confidence += 0.1; So only one boost. So 0.95. But if we add another location term? No additional boost. So max 0.95. Could we make 1.0? Only if we had multiple boosts? No. Actually confidence capped at 1. So test that confidence is <=1.
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  // ── Location terms extraction ──

  test('analyze() extracts location terms and filters noise', () => {
    const result = geoIntent.analyze('weather in chiang mai ครับ');
    expect(result.features.location_terms).toContain('chiang');
    expect(result.features.location_terms).toContain('mai');
    expect(result.features.location_terms).not.toContain('in');
    expect(result.features.location_terms).not.toContain('ครับ');
  });

  test('analyze() removes coordinates from location terms', () => {
    const result = geoIntent.analyze('weather at 14.97,102.09 bangkok');
    expect(result.features.location_terms).not.toContain('14.97,102.09');
    expect(result.features.location_terms).toContain('bangkok');
  });

  test('analyze() returns empty location terms when only noise/keywords present', () => {
    const result = geoIntent.analyze('weather forecast daily');
    expect(result.features.location_terms).toEqual([]);
  });

  // ── raw_input preservation ──

  test('analyze() preserves original raw_input unchanged', () => {
    const raw = '  Weather at 13.73,100.52  ';
    const result = geoIntent.analyze(raw);
    expect(result.raw_input).toBe(raw);
  });
});
```
