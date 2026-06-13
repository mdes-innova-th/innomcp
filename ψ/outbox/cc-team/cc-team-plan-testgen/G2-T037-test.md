<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T037 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1941,"completion_tokens":3650,"total_tokens":5591,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2984,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T10:59:53.437Z -->
```typescript
import { GeoIntent } from '../src/geo/geo-intent';

describe('GeoIntent', () => {
  let geo: GeoIntent;

  beforeEach(() => {
    geo = new GeoIntent();
  });

  test('returns unknown domain for non-weather text', () => {
    const result = geo.analyze('hello world');
    expect(result.domain).toBe('unknown');
    expect(result.subdomain).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.raw_input).toBe('hello world');
  });

  test('detects weather domain and defaults to nwp_daily', () => {
    const result = geo.analyze('weather in Bangkok');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_daily');
    expect(result.confidence).toBe(0.75); // 0.7 base + 0.05 location
    expect(result.features.location_terms).toContain('bangkok');
  });

  test('extracts coordinates and boosts confidence', () => {
    const result = geo.analyze('temperature 14.97,102.09');
    expect(result.domain).toBe('weather');
    expect(result.features.has_coords).toBe(true);
    expect(result.features.coords).toEqual({ lat: 14.97, lon: 102.09 });
    expect(result.confidence).toBe(0.8); // 0.7 base + 0.1 coords
  });

  test('classifies nwp_hourly for hourly keywords', () => {
    const result = geo.analyze('hourly rain');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_hourly');
    expect(result.features.wants_hourly).toBe(true);
    expect(result.confidence).toBe(0.8); // 0.7 base + 0.1 hourly
  });

  test('classifies tmd_forecast for TMD keywords', () => {
    const result = geo.analyze('tmd forecast');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('tmd_forecast');
    expect(result.confidence).toBe(0.7);
  });

  test('handles Thai weather keywords and daily intent', () => {
    const result = geo.analyze('พยากรณ์อากาศวันนี้');
    expect(result.domain).toBe('weather');
    expect(result.subdomain).toBe('nwp_daily');
    expect(result.features.wants_daily).toBe(true);
  });

  test('strips noise words and extracts meaningful location terms', () => {
    const result = geo.analyze('ฝนตกที่จังหวัดเชียงใหม่ไหม');
    expect(result.domain).toBe('weather');
    expect(result.features.location_terms).toContain('เชียงใหม่');
    expect(result.features.location_terms).not.toContain('จังหวัด');
    expect(result.features.location_terms).not.toContain('ไหม');
  });
});
```
