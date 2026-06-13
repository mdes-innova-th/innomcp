<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S035 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":368,"completion_tokens":2704,"total_tokens":3072,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-13T11:29:32.703Z -->
```typescript
import { GeoAggregator } from '../src/geo/aggregator';
import type { WeatherPacket } from '../src/geo/aggregator';

const makePacket = (overrides: Partial<WeatherPacket> = {}): WeatherPacket => ({
  id: 'pkt-1',
  source: 'station-A',
  location: { lat: 10, lon: 20 },
  timestamp: 1_700_000_000_000,
  temperature: 20,
  humidity: 50,
  windSpeed: 5,
  windDirection: 180,
  pressure: 1013,
  ...overrides,
});

describe('GeoAggregator', () => {
  let aggregator: GeoAggregator;

  beforeEach(() => {
    aggregator = new GeoAggregator();
  });

  describe('format', () => {
    it('returns a packet with the same id as input', () => {
      const input = makePacket({ id: 'abc-123' });
      const output = aggregator.format(input);
      expect(output.id).toBe('abc-123');
    });

    it('normalizes location latitude into the [-90, 90] range', () => {
      const input = makePacket({ location: { lat: 100, lon: 10 } });
      const output = aggregator.format(input);
      expect(output.location.lat).toBeGreaterThanOrEqual(-90);
      expect(output.location.lat).toBeLessThanOrEqual(90);
    });

    it('normalizes location longitude into the [-180, 180] range', () => {
      const input = makePacket({ location: { lat: 10, lon: 250 } });
      const output = aggregator.format(input);
      expect(output.location.lon).toBeGreaterThanOrEqual(-180);
      expect(output.location.lon).toBeLessThanOrEqual(180);
    });

    it('wraps longitudes > 180 by subtracting 360', () => {
      const input = makePacket({ location: { lat: 0, lon: 200 } });
      const output = aggregator.format(input);
      expect(output.location.lon).toBe(-160);
    });

    it('wraps longitudes < -180 by adding 360', () => {
      const input = makePacket({ location: { lat: 0, lon: -200 } });
      const output = aggregator.format(input);
      expect(output.location.lon).toBe(160);
    });

    it('clamps latitudes > 90 to 90', () => {
      const input = makePacket({ location: { lat: 95, lon: 0 } });
      const output = aggregator.format(input);
      expect(output.location.lat).toBe(90);
    });

    it('clamps latitudes < -90 to -90', () => {
      const input = makePacket({ location: { lat: -95, lon: 0 } });
      const output = aggregator.format(input);
      expect(output.location.lat).toBe(-90);
    });

    it('preserves already-valid coordinates', () => {
      const input = makePacket({ location: { lat: 45.5, lon: -122.25 } });
      const output = aggregator.format(input);
      expect(output.location).toEqual({ lat: 45.5, lon: -122.25 });
    });

    it('preserves numeric telemetry fields (temperature, humidity, etc.)', () => {
      const input = makePacket({
        temperature: 18.4,
        humidity: 72,
        windSpeed: 3.2,
        windDirection: 270,
        pressure: 1005,
      });
      const output = aggregator.format(input);
      expect(output.temperature).toBe(18.4);
      expect(output.humidity).toBe(72);
      expect(output.windSpeed).toBe(3.2);
      expect(output.windDirection).toBe(270);
      expect(output.pressure).toBe(1005);
    });

    it('preserves the source identifier', () => {
      const input = makePacket({ source: 'weather-buoy-7' });
      const output = aggregator.format(input);
      expect(output.source).toBe('weather-buoy-7');
    });

    it('preserves the timestamp', () => {
      const ts = 1_700_000_000_000;
      const input = makePacket({ timestamp: ts });
      const output = aggregator.format(input);
      expect(output.timestamp).toBe(ts);
    });

    it('returns a new object (does not mutate the input)', () => {
      const input = makePacket();
      const snapshot = JSON.parse(JSON.stringify(input));
      const output = aggregator.format(input);
      expect(input).toEqual(snapshot);
      expect(output).not.toBe(input);
    });

    it('does not mutate the input location object', () => {
      const location = { lat: 200, lon: 400 };
      const input = makePacket({ location });
      aggregator.format(input);
      expect(location).toEqual({ lat: 200, lon: 400 });
    });

    it('throws on a packet missing required id', () => {
      const input = { ...makePacket(), id: undefined as unknown as string };
      expect(() => aggregator.format(input)).toThrow();
    });

    it('throws on a packet missing required location', () => {
      const input = { ...makePacket(), location: undefined as unknown as WeatherPacket['location'] };
      expect(() => aggregator.format(input)).toThrow();
    });

    it('throws when location lat is not a finite number', () => {
      const input = makePacket({ location: { lat: Number.NaN, lon: 0 } });
      expect(() => aggregator.format(input)).toThrow();
    });

    it('throws when location lon is not a finite number', () => {
      const input = makePacket({ location: { lat: 0, lon: Number.POSITIVE_INFINITY } });
      expect(() => aggregator.format(input)).toThrow();
    });

    it('throws on missing timestamp', () => {
      const input = { ...makePacket(), timestamp: undefined as unknown as number };
      expect(() => aggregator.format(input)).toThrow();
    });
  });

  describe('merge', () => {
    it('returns a single formatted packet from a single-packet input', () => {
      const packet = makePacket({ id: 'only' });
      const merged = aggregator.merge([packet]);
      expect(merged).toEqual(expect.objectContaining({ id: 'only' }));
    });

    it('returns a packet whose id is stable and non-empty when merging many', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a' }),
        makePacket({ id: 'b' }),
        makePacket({ id: 'c' }),
      ]);
      expect(typeof merged.id).toBe('string');
      expect(merged.id.length).toBeGreaterThan(0);
    });

    it('produces a single packet (not an array)', () => {
      const merged = aggregator.merge([makePacket(), makePacket()]);
      expect(Array.isArray(merged)).toBe(false);
    });

    it('averages the temperature across input packets', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', temperature: 10 }),
        makePacket({ id: 'b', temperature: 20 }),
        makePacket({ id: 'c', temperature: 30 }),
      ]);
      expect(merged.temperature).toBe(20);
    });

    it('averages the humidity across input packets', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', humidity: 40 }),
        makePacket({ id: 'b', humidity: 60 }),
      ]);
      expect(merged.humidity).toBe(50);
    });

    it('averages the pressure across input packets', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', pressure: 1000 }),
        makePacket({ id: 'b', pressure: 1020 }),
      ]);
      expect(merged.pressure).toBe(1010);
    });

    it('produces a location within the valid [-90,90]/[-180,180] range', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', location: { lat: 80, lon: 170 } }),
        makePacket({ id: 'b', location: { lat: -80, lon: -170 } }),
        makePacket({ id: 'c', location: { lat: 0, lon: 0 } }),
      ]);
      expect(merged.location.lat).toBeGreaterThanOrEqual(-90);
      expect(merged.location.lat).toBeLessThanOrEqual(90);
      expect(merged.location.lon).toBeGreaterThanOrEqual(-180);
      expect(merged.location.lon).toBeLessThanOrEqual(180);
    });

    it('uses the latest (max) timestamp among input packets', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', timestamp: 1000 }),
        makePacket({ id: 'b', timestamp: 5000 }),
        makePacket({ id: 'c', timestamp: 3000 }),
      ]);
      expect(merged.timestamp).toBe(5000);
    });

    it('preserves a string source on the merged packet', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', source: 'station-A' }),
        makePacket({ id: 'b', source: 'station-B' }),
      ]);
      expect(typeof merged.source).toBe('string');
      expect(merged.source.length).toBeGreaterThan(0);
    });

    it('does not mutate the input array', () => {
      const packets = [makePacket({ id: 'a' }), makePacket({ id: 'b' })];
      const snapshot = JSON.parse(JSON.stringify(packets));
      aggregator.merge(packets);
      expect(packets).toEqual(snapshot);
    });

    it('does not mutate any input packet objects', () => {
      const a = makePacket({ id: 'a', temperature: 10 });
      const b = makePacket({ id: 'b', temperature: 20 });
      const aSnap = JSON.parse(JSON.stringify(a));
      const bSnap = JSON.parse(JSON.stringify(b));
      aggregator.merge([a, b]);
      expect(a).toEqual(aSnap);
      expect(b).toEqual(bSnap);
    });

    it('throws on an empty input array', () => {
      expect(() => aggregator.merge([])).toThrow();
    });

    it('throws when any input packet is missing an id', () => {
      const bad = { ...makePacket(), id: undefined as unknown as string };
      expect(() => aggregator.merge([makePacket(), bad])).toThrow();
    });

    it('throws when any input packet has invalid coordinates', () => {
      const bad = makePacket({ location: { lat: Number.NaN, lon: 0 } });
      expect(() => aggregator.merge([makePacket(), bad])).toThrow();
    });

    it('formats each input packet before merging (out-of-range coords get normalized in result)', () => {
      const merged = aggregator.merge([
        makePacket({ id: 'a', location: { lat: 95, lon: 200 } }),
        makePacket({ id: 'b', location: { lat: -95, lon: -200 } }),
      ]);
      expect(merged.location.lat).toBeGreaterThanOrEqual(-90);
      expect(merged.location.lat).toBeLessThanOrEqual(90);
      expect(merged.location.lon).toBeGreaterThanOrEqual(-180);
      expect(merged.location.lon).toBeLessThanOrEqual(180);
    });

    it('produces a merged packet equivalent to running format() on a hand-built aggregate', () => {
      const packets = [
        makePacket({ id: 'a', temperature: 10, humidity: 50, pressure: 1000 }),
        makePacket({ id: 'b', temperature: 20, humidity: 70, pressure: 1020 }),
      ];
      const merged = aggregator.merge(packets);
      // Re-run format on the same input set to ensure format/merge agree on shape.
      const reFormatted = aggregator.format(
        makePacket({
          id: merged.id,
          source: merged.source,
          location: merged.location,
          timestamp: merged.timestamp,
          temperature: merged.temperature,
          humidity: merged.humidity,
          windSpeed: merged.windSpeed,
          windDirection: merged.windDirection,
          pressure: merged.pressure,
        }),
      );
      expect(reFormatted).toEqual(merged);
    });
  });
});
```
