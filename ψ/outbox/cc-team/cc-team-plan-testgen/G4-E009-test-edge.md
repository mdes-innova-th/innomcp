<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E009 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1492,"completion_tokens":5575,"total_tokens":7067,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4113,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:12:48.955Z -->
```typescript
import { ThaiIntentRouter, thaiIntentRouter } from '../src/services/thaiIntentRouter';
import { ThaiNLPService } from '../src/services/thaiNLPService';

jest.mock('../src/services/thaiNLPService', () => ({
  ThaiNLPService: jest.fn().mockImplementation(() => ({
    detectIntent: jest.fn(),
  })),
}));

describe('ThaiIntentRouter', () => {
  let router: ThaiIntentRouter;
  let mockDetectIntent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new ThaiIntentRouter();
    mockDetectIntent = (ThaiNLPService as jest.Mock).mock.instances[0].detectIntent as jest.Mock;
  });

  describe('selectModelForDomain', () => {
    test('returns preferred model for known domain when available', () => {
      const models = ['gemma4:26b', 'qwen2.5:7b', 'deepseek-r1:32b'];
      const chosen = router.selectModelForDomain('code', models);
      expect(chosen).toBe('deepseek-r1:32b');
    });

    test('falls back to second preferred when first not available', () => {
      const models = ['qwen2.5-coder:7b', 'gemma4:26b'];
      const chosen = router.selectModelForDomain('code', models);
      expect(chosen).toBe('qwen2.5-coder:7b');
    });

    test('returns general preferred for unknown domain', () => {
      const models = ['gemma4:26b', 'qwen2.5:7b'];
      const chosen = router.selectModelForDomain('alien', models);
      expect(chosen).toBe('gemma4:26b');
    });

    test('falls back to MDES order when no preferred available', () => {
      const models = ['llama3.2:3b', 'some-model'];
      const chosen = router.selectModelForDomain('code', models);
      expect(chosen).toBe('llama3.2:3b');
    });

    test('returns empty string if models array is empty', () => {
      const chosen = router.selectModelForDomain('weather', []);
      expect(chosen).toBe('');
    });

    test('handles domain being empty string', () => {
      const models = ['gemma4:26b'];
      const chosen = router.selectModelForDomain('', models);
      expect(chosen).toBe('gemma4:26b');
    });
  });

  describe('route', () => {
    test('returns empty decision with zero confidence when availableModels is empty', async () => {
      const result = await router.route('hello', []);
      expect(result).toEqual({
        model: '',
        reason: 'ไม่มีโมเดลที่พร้อมใช้งาน (ไม่มีโมเดลในระบบ)',
        confidence: 0,
      });
    });

    test('selects preferred model based on intent domain', async () => {
      mockDetectIntent.mockReturnValue({ domain: 'code' });
      const models = ['deepseek-r1:32b', 'gemma4:26b'];
      const result = await router.route('write a function', models);
      expect(result.model).toBe('deepseek-r1:32b');
      expect(result.confidence).toBe(0.7);
      expect(result.fallback).toBeUndefined();
      expect(result.reason).toContain('deepseek-r1:32b');
      expect(result.reason).toContain('code');
    });

    test('falls back to general if domain is undefined', async () => {
      mockDetectIntent.mockReturnValue({});
      const models = ['gemma4:26b'];
      const result = await router.route('some text', models);
      expect(result.model).toBe('gemma4:26b');
      expect(result.confidence).toBe(0.7);
      expect(result.fallback).toBeUndefined();
    });

    test('uses general domain if domain is null', async () => {
      mockDetectIntent.mockReturnValue({ domain: null });
      const models = ['gemma4:26b'];
      const result = await router.route('null domain', models);
      expect(result.model).toBe('gemma4:26b');
    });

    test('reduces confidence when using fallback model', async () => {
      mockDetectIntent.mockReturnValue({ domain: 'code' });
      const models = ['llama3.2:3b'];
      const result = await router.route('program', models);
      expect(result.model).toBe('llama3.2:3b');
      expect(result.confidence).toBeCloseTo(0.56);
      expect(result.fallback).toBe('llama3.2:3b');
      expect(result.reason).toContain('สำรอง');
    });

    test('propagates error from detectIntent', async () => {
      mockDetectIntent.mockImplementation(() => {
        throw new Error('NLP failure');
      });
      await expect(router.route('text', ['gemma4:26b'])).rejects.toThrow('NLP failure');
    });

    test('handles text being empty string', async () => {
      mockDetectIntent.mockReturnValue({ domain: 'general' });
      const models = ['gemma4:26b'];
      const result = await router.route('', models);
      expect(result.model).toBe('gemma4:26b');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('routeToMDES', () => {
    test('routes to MDES_OLLAMA_MODELS list', async () => {
      mockDetectIntent.mockReturnValue({ domain: 'general' });
      const spy = jest.spyOn(router, 'route');
      await router.routeToMDES('hello');
      expect(spy).toHaveBeenCalledWith('hello', [
        'gemma4:26b',
        'qwen2.5:7b',
        'deepseek-r1:32b',
        'qwen2.5-coder:7b',
        'llama3.2:3b',
      ]);
      spy.mockRestore();
    });

    test('returns routing decision for MDES models', async () => {
      mockDetectIntent.mockReturnValue({ domain: 'thai' });
      const result = await router.routeToMDES('สวัสดี');
      expect(result.model).toBe('gemma4:26b');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('thaiIntentRouter singleton', () => {
    test('is an instance of ThaiIntentRouter', () => {
      expect(thaiIntentRouter).toBeInstanceOf(ThaiIntentRouter);
    });
  });
});
```
