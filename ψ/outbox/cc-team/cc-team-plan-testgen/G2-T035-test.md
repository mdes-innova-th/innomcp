<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T035 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1833,"completion_tokens":2027,"total_tokens":3860,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T10:58:41.972Z -->
```typescript
import { GeoAggregator } from '../src/geo/geo-aggregator';
import type { WeatherPacket } from '../src/geo/interfaces';

describe('GeoAggregator', () => {
  let aggregator: GeoAggregator;

  const basePacket: WeatherPacket = {
    summary: '',
    timestamp: '2024-01-01T00:00:00.000Z',
    source: 'test-source',
    evidence: { tool: 'test-tool', latency_ms: 10, confidence: 1 },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    aggregator = new GeoAggregator();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── format() ────────────────────────────────────────────────────────

  describe('format()', () => {
    test('returns packet unchanged when error is set', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        error: 'something failed',
        raw_data: { temp: 25 },
      };
      const result = aggregator.format(packet);
      expect(result).toEqual(packet);
    });

    test('returns packet unchanged when raw_data is missing', () => {
      const packet: WeatherPacket = { ...basePacket };
      const result = aggregator.format(packet);
      expect(result).toEqual(packet);
    });

    test('extracts numeric temp from top-level "temp" key', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { temp: 28.5 },
      };
      const result = aggregator.format(packet);
      expect(result.temp).toBe(28.5);
    });

    test('extracts numeric humidity from top-level "humidity" key', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { humidity: 65 },
      };
      const result = aggregator.format(packet);
      expect(result.humidity).toBe(65);
    });

    test('extracts numeric values provided as numeric strings', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { temperature: '30', rh: '70' },
      };
      const result = aggregator.format(packet);
      expect(result.temp).toBe(30);
      expect(result.humidity).toBe(70);
    });

    test('recognizes alternative keys: "tc", "t", "relative_humidity"', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { tc: 22, relative_humidity: 55 },
      };
      const result = aggregator.format(packet);
      expect(result.temp).toBe(22);
      expect(result.humidity).toBe(55);
    });

    test('falls back to nested data[0] when top-level keys absent', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { data: [{ temp: 18, humidity: 80 }] },
      };
      const result = aggregator.format(packet);
      expect(result.temp).toBe(18);
      expect(result.humidity).toBe(80);
    });

    test('returns temp=undefined and humidity=undefined when keys not present', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { something: 'else' },
      };
      const result = aggregator.format(packet);
      expect(result.temp).toBeUndefined();
      expect(result.humidity).toBeUndefined();
    });

    test('builds summary including temp and humidity and source', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        source: 'openweather',
        raw_data: { temp: 30, humidity: 60 },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('30°C');
      expect(result.summary).toContain('60%');
      expect(result.summary).toContain('(openweather)');
    });

    test('normalizes English condition to Thai', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { temp: 25, condition: 'Sunny' },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('ท้องฟ้าโปร่ง');
    });

    test('normalizes "partly cloudy" to Thai', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { description: 'Partly Cloudy' },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('มีเมฆบางส่วน');
    });

    test('normalizes rain condition to Thai', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { weather: 'Light Rain' },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('ฝนตก');
    });

    test('normalizes thunderstorm to Thai', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { summary: 'Thunderstorm' },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('พายุฝนฟ้าคะนอง');
    });

    test('normalizes fog/mist to Thai', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { condition: 'Mist' },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('มีหมอก');
    });

    test('normalizes windy to Thai', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { condition: 'Windy' },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('ลมแรง');
    });

    test('uses default success summary when no temp/humidity/condition found', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { other: 1 },
      };
      const result = aggregator.format(packet);
      expect(result.summary).toContain('ดึงข้อมูลสำเร็จ');
    });

    test('preserves all original packet fields plus added ones', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { temp: 20, humidity: 50 },
      };
      const result = aggregator.format(packet);
      expect(result.timestamp).toBe(basePacket.timestamp);
      expect(result.source).toBe(basePacket.source);
      expect(result.evidence).toEqual(basePacket.evidence);
      expect(result.temp).toBe(20);
      expect(result.humidity).toBe(50);
      expect(result.raw_data).toEqual(packet.raw_data);
    });
  });

  // ── merge() ─────────────────────────────────────────────────────────

  describe('merge()', () => {
    test('returns empty packet when given an empty array', () => {
      const result = aggregator.merge([]);
      expect(result.source).toBe('none');
      expect(result.evidence.tool).toBe('none');
      expect(result.evidence.latency_ms).toBe(0);
      expect(result.evidence.confidence).toBe(0);
      expect(result.summary).toContain('ไม่พบข้อมูลสภาพอากาศ');
    });

    test('returns empty packet with a current ISO timestamp when input is empty', () => {
      const result = aggregator.merge([]);
      expect(result.timestamp).toBe(new Date('2024-01-01T00:00:00.000Z').toISOString());
    });

    test('returns the packet itself when only one valid packet is provided', () => {
      const packet: WeatherPacket = {
        ...basePacket,
        raw_data: { temp: 25 },
      };
      const result = aggregator.merge([packet]);
      expect(result).toEqual(packet);
    });

    test('returns the first error packet when all are errored', () => {
      const first: WeatherPacket = { ...basePacket, error: 'first' };
      const second: WeatherPacket = { ...basePacket, error: 'second' };
      const result = aggregator.merge([first, second]);
      expect(result.error).toBe('first');
    });

    test('skips errored packets and picks first valid one', () => {
      const err: WeatherPacket = { ...basePacket, error: 'boom' };
      const good: WeatherPacket = {
        ...basePacket,
        source: 'good',
        raw_data: { temp: 22 },
      };
      const result = aggregator.merge([err, good]);
      expect(result.source).toBe('good');
      expect(result.error).toBeUndefined();
    });

    test('returns the first valid packet when multiple valid packets given', () => {
      const first: WeatherPacket = {
        ...basePacket,
        source: 'primary',
        raw_data: { temp: 30 },
      };
      const second: WeatherPacket = {
        ...basePacket,
        source: 'fallback',
        raw_data: { temp: 20 },
      };
      const result = aggregator.merge([first, second]);
      expect(result.source).toBe('primary');
      expect(result.raw_data).toEqual({ temp: 30 });
    });
  });
});
```
