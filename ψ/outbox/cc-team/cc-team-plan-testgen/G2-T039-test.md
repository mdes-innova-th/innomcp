<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T039 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1865,"completion_tokens":3282,"total_tokens":5147,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1007,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T10:59:24.711Z -->
```typescript
import { GeoRouter } from '../src/geo/geo-tool-router';
import type { GeoIntentResult, ToolPlan } from '../src/geo/interfaces';

describe('GeoRouter', () => {
  let router: GeoRouter;

  beforeEach(() => {
    jest.useFakeTimers();
    router = new GeoRouter();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper to build a base valid GeoIntentResult
  function baseIntent(overrides: Partial<GeoIntentResult> = {}): GeoIntentResult {
    return {
      domain: 'weather',
      confidence: 0.9,
      features: {
        has_coords: false,
        coords: undefined,
        location_terms: [],
      },
      subdomain: 'other_weather',
      ...overrides,
    };
  }

  describe('route()', () => {
    it('returns null when domain is not "weather"', () => {
      const intent = baseIntent({ domain: 'news', confidence: 0.9 });
      expect(router.route(intent)).toBeNull();
    });

    it('returns null when confidence is below 0.6', () => {
      const intent = baseIntent({ confidence: 0.59 });
      expect(router.route(intent)).toBeNull();
    });

    it('returns null when confidence equals exactly 0.6 (rejected because < 0.6)', () => {
      const intent = baseIntent({ confidence: 0.6 });
      expect(router.route(intent)).toBeNull();
    });

    it('returns null when no coords and empty location_terms (no location info)', () => {
      const intent = baseIntent({
        features: { has_coords: false, location_terms: [], coords: undefined },
        subdomain: 'nwp_hourly',
      });
      expect(router.route(intent)).toBeNull();
    });

    describe('NWP hourly subdomain', () => {
      it('with coordinates routes to hourly by location and falls back to daily by location', () => {
        const intent = baseIntent({
          subdomain: 'nwp_hourly',
          features: {
            has_coords: true,
            coords: { lat: 13.756, lon: 100.501 },
            location_terms: [],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan).not.toBeNull();
        expect(plan.primary.tool_name).toBe('nwp_hourly_by_location');
        expect(plan.primary.params).toEqual({ lat: 13.756, lon: 100.501 });
        expect(plan.primary.reason).toContain('24h');
        expect(plan.fallbacks).toHaveLength(1);
        expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_location');
        expect(plan.fallbacks[0].params).toEqual({ lat: 13.756, lon: 100.501 });
      });

      it('without coordinates but with location_terms routes to hourly by place with fallbacks', () => {
        const intent = baseIntent({
          subdomain: 'nwp_hourly',
          features: {
            has_coords: false,
            coords: undefined,
            location_terms: ['Bangkok'],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('nwp_hourly_by_place');
        expect(plan.primary.params).toEqual({ place: 'Bangkok' });
        expect(plan.primary.reason).toBe('hourly + place name');
        expect(plan.fallbacks).toHaveLength(2);
        expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_place');
        expect(plan.fallbacks[0].params).toEqual({ place: 'Bangkok' });
        expect(plan.fallbacks[1].tool_name).toBe('tmd_weather_forecast_7days_by_province');
        expect(plan.fallbacks[1].params).toEqual({ province: 'Bangkok' });
      });

      it('joins multiple location_terms into a single place string', () => {
        const intent = baseIntent({
          subdomain: 'nwp_hourly',
          features: {
            has_coords: false,
            location_terms: ['Chiang', 'Mai'],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.params).toEqual({ place: 'Chiang Mai' });
      });
    });

    describe('NWP daily subdomain', () => {
      it('with coordinates routes to daily by location and hourly fallback', () => {
        const intent = baseIntent({
          subdomain: 'nwp_daily',
          features: {
            has_coords: true,
            coords: { lat: 18.788, lon: 98.985 },
            location_terms: [],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('nwp_daily_by_location');
        expect(plan.primary.params).toEqual({ lat: 18.788, lon: 98.985 });
        expect(plan.fallbacks).toHaveLength(1);
        expect(plan.fallbacks[0].tool_name).toBe('nwp_hourly_by_location');
        expect(plan.fallbacks[0].params).toEqual({ lat: 18.788, lon: 98.985 });
      });

      it('without coordinates routes to daily by place with TMD fallbacks', () => {
        const intent = baseIntent({
          subdomain: 'nwp_daily',
          features: {
            has_coords: false,
            location_terms: ['Phuket'],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('nwp_daily_by_place');
        expect(plan.primary.params).toEqual({ place: 'Phuket' });
        expect(plan.fallbacks).toHaveLength(2);
        expect(plan.fallbacks[0].tool_name).toBe('tmd_weather_forecast_7days_by_province');
        expect(plan.fallbacks[0].params).toEqual({ province: 'Phuket' });
        expect(plan.fallbacks[1].tool_name).toBe('tmd_daily_forecast_4_times');
        expect(plan.fallbacks[1].params).toEqual({});
      });
    });

    describe('TMD forecast subdomain', () => {
      it('with coordinates uses TMD 7-day as primary and NWP daily by location fallback', () => {
        const intent = baseIntent({
          subdomain: 'tmd_forecast',
          features: {
            has_coords: true,
            coords: { lat: 7.880, lon: 98.392 },
            location_terms: ['Phuket'],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('tmd_weather_forecast_7days_by_province');
        expect(plan.primary.params).toEqual({ province: 'Phuket' });
        expect(plan.fallbacks).toHaveLength(1);
        expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_location');
        expect(plan.fallbacks[0].params).toEqual({ lat: 7.880, lon: 98.392 });
      });

      it('without coordinates uses TMD 7-day and falls back to NWP daily by place', () => {
        const intent = baseIntent({
          subdomain: 'tmd_forecast',
          features: {
            has_coords: false,
            location_terms: ['Krabi'],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('tmd_weather_forecast_7days_by_province');
        expect(plan.primary.params).toEqual({ province: 'Krabi' });
        expect(plan.fallbacks).toHaveLength(1);
        expect(plan.fallbacks[0].tool_name).toBe('nwp_daily_by_place');
        expect(plan.fallbacks[0].params).toEqual({ place: 'Krabi' });
      });
    });

    describe('default / other_weather subdomain', () => {
      it('falls back to daily plan with coordinates', () => {
        const intent = baseIntent({
          subdomain: 'other_weather',
          features: {
            has_coords: true,
            coords: { lat: 14.0, lon: 100.5 },
            location_terms: [],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('nwp_daily_by_location');
        expect(plan.primary.params).toEqual({ lat: 14.0, lon: 100.5 });
        expect(plan.fallbacks[0].tool_name).toBe('nwp_hourly_by_location');
      });

      it('falls back to daily plan with place when no coordinates', () => {
        const intent = baseIntent({
          subdomain: undefined, // default case
          features: {
            has_coords: false,
            location_terms: ['Surin'],
          },
        });

        const plan = router.route(intent) as ToolPlan;
        expect(plan.primary.tool_name).toBe('nwp_daily_by_place');
        expect(plan.primary.params).toEqual({ place: 'Surin' });
      });
    });

    it('returns a plan with correctly shaped ToolStep objects', () => {
      const intent = baseIntent({
        subdomain: 'nwp_hourly',
        features: {
          has_coords: false,
          location_terms: ['Rayong'],
        },
      });

      const plan = router.route(intent) as ToolPlan;
      const step = plan.primary;
      expect(step).toHaveProperty('tool_name', expect.any(String));
      expect(step).toHaveProperty('params', expect.any(Object));
      expect(step).toHaveProperty('reason', expect.any(String));
      expect(step.reason.length).toBeGreaterThan(0);
    });
  });
});
```
