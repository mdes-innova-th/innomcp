<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S037 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":210,"completion_tokens":1787,"total_tokens":1997,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":709,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T11:30:16.297Z -->
```typescript
import { GeoIntent } from '../src/geo/geo-intent';

describe('GeoIntent', () => {
  let geoIntent: GeoIntent;

  beforeEach(() => {
    geoIntent = new GeoIntent();
  });

  describe('analyze', () => {
    it('should return a result object for a valid message', () => {
      const result = geoIntent.analyze('What is the weather in Tokyo?');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should detect geographic intent when a location is mentioned', () => {
      const result = geoIntent.analyze('Show me restaurants near Paris');
      expect(result).toHaveProperty('hasGeoIntent');
      expect(result.hasGeoIntent).toBe(true);
    });

    it('should not detect geographic intent for non-geographic messages', () => {
      const result = geoIntent.analyze('Hello, how are you doing today?');
      expect(result).toHaveProperty('hasGeoIntent');
      expect(result.hasGeoIntent).toBe(false);
    });

    it('should extract location entities when geo intent is present', () => {
      const result = geoIntent.analyze('What is the population of Berlin?');
      expect(result.hasGeoIntent).toBe(true);
      expect(result).toHaveProperty('locations');
      expect(Array.isArray(result.locations)).toBe(true);
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should return empty locations array when no geo intent is detected', () => {
      const result = geoIntent.analyze('Tell me a joke');
      expect(result.hasGeoIntent).toBe(false);
      expect(result.locations).toEqual([]);
    });

    it('should handle empty string input without throwing', () => {
      expect(() => geoIntent.analyze('')).not.toThrow();
      const result = geoIntent.analyze('');
      expect(result.hasGeoIntent).toBe(false);
      expect(result.locations).toEqual([]);
    });

    it('should handle messages with multiple locations', () => {
      const result = geoIntent.analyze('Compare the weather in London and New York');
      expect(result.hasGeoIntent).toBe(true);
      expect(result.locations.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle messages with country names', () => {
      const result = geoIntent.analyze('What is the capital of Japan?');
      expect(result.hasGeoIntent).toBe(true);
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should handle messages with coordinates or addresses', () => {
      const result = geoIntent.analyze('Navigate to 123 Main Street, Springfield');
      expect(result.hasGeoIntent).toBe(true);
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should not detect geo intent for ambiguous words that are not locations', () => {
      const result = geoIntent.analyze('I want to book a flight for tomorrow');
      expect(result.hasGeoIntent).toBe(false);
    });

    it('should handle very long messages without throwing', () => {
      const longMessage = 'What is the weather in '.repeat(100) + 'Paris?';
      expect(() => geoIntent.analyze(longMessage)).not.toThrow();
      const result = geoIntent.analyze(longMessage);
      expect(result).toBeDefined();
    });

    it('should handle messages with special characters', () => {
      const result = geoIntent.analyze('Where is São Paulo, Brasil?! @#$%');
      expect(result).toBeDefined();
      expect(typeof result.hasGeoIntent).toBe('boolean');
    });

    it('should handle messages with only whitespace', () => {
      const result = geoIntent.analyze('   \t\n  ');
      expect(result.hasGeoIntent).toBe(false);
      expect(result.locations).toEqual([]);
    });

    it('should return consistent results for the same input', () => {
      const message = 'Find hotels in Amsterdam';
      const result1 = geoIntent.analyze(message);
      const result2 = geoIntent.analyze(message);
      expect(result1.hasGeoIntent).toBe(result2.hasGeoIntent);
      expect(result1.locations).toEqual(result2.locations);
    });

    it('should detect geo intent with directional queries', () => {
      const result = geoIntent.analyze('How do I get to the nearest gas station?');
      expect(result.hasGeoIntent).toBe(true);
    });

    it('should handle case-insensitive location detection', () => {
      const resultLower = geoIntent.analyze('weather in tokyo');
      const resultUpper = geoIntent.analyze('WEATHER IN TOKYO');
      expect(resultLower.hasGeoIntent).toBe(resultUpper.hasGeoIntent);
    });
  });
});
```
