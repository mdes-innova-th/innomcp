<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T008 role=test model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":2174,"completion_tokens":7969,"total_tokens":10143,"prompt_tokens_details":{"cached_tokens":70,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6547,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 73s
 generated: 2026-06-13T10:52:29.878Z -->
```typescript
import { trigToDeg, cleanFloat } from '../src/services/fastPathHandler';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('mathjs', () => ({
  evaluate: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../src/utils/fastPathGreeting', () => ({
  maybeFastPath: jest.fn(),
  getFastPathDictInfo: jest.fn(),
}));

jest.mock('../src/fastpath/intentGate', () => ({
  analyzeIntent: jest.fn(),
}));

jest.mock('../src/fastpath/rateLimit', () => ({
  checkRateLimit: jest.fn(),
  buildRateLimitKey: jest.fn(),
}));

describe('fastPathHandler', () => {
  describe('trigToDeg', () => {
    test('returns expr unchanged when it contains deg', () => {
      expect(trigToDeg('sin(90 deg)')).toBe('sin(90 deg)');
    });

    test('returns expr unchanged when it contains rad', () => {
      expect(trigToDeg('sin(pi rad)')).toBe('sin(pi rad)');
    });

    test('returns expr unchanged when it contains pi', () => {
      expect(trigToDeg('sin(pi/2)')).toBe('sin(pi/2)');
    });

    test('converts plain numeric arguments to degrees', () => {
      expect(trigToDeg('sin(90)')).toBe('sin(90 deg)');
      expect(trigToDeg('cos(0)')).toBe('cos(0 deg)');
      expect(trigToDeg('tan(45)')).toBe('tan(45 deg)');
      expect(trigToDeg('asin(1)')).toBe('asin(1 deg)');
      expect(trigToDeg('acos(0)')).toBe('acos(0 deg)');
      expect(trigToDeg('atan(1)')).toBe('atan(1 deg)');
    });

    test('converts negative numbers', () => {
      expect(trigToDeg('sin(-90)')).toBe('sin(-90 deg)');
    });

    test('does not convert non-numeric arguments', () => {
      expect(trigToDeg('sin(x)')).toBe('sin(x)');
      expect(trigToDeg('cos(90 + 1)')).toBe('cos(90 + 1)');
    });

    test('handles multiple occurrences', () => {
      expect(trigToDeg('sin(90) + cos(0)')).toBe('sin(90 deg) + cos(0 deg)');
    });

    test('is case insensitive but preserves function case', () => {
      expect(trigToDeg('SIN(90)')).toBe('SIN(90 deg)');
    });
  });

  describe('cleanFloat', () => {
    test('rounds near-integer floats to whole number strings', () => {
      expect(cleanFloat(0.9999999999999999)).toBe('1');
      expect(cleanFloat(2.0000000000000004)).toBe('2');
    });

    test('returns integer string for exact integers', () => {
      expect(cleanFloat(5)).toBe('5');
      expect(cleanFloat(0)).toBe('0');
      expect(cleanFloat(-3)).toBe('-3');
    });

    test('returns rounded decimal string for non-integer floats', () => {
      expect(cleanFloat(1.234567890123)).toBe('1.2345678901');
    });

    test('handles negative near-integer floats', () => {
      expect(cleanFloat(-0.9999999999999999)).toBe('-1');
    });
  });
});
```
