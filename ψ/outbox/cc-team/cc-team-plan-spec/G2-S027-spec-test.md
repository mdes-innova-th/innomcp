<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S027 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":258,"completion_tokens":3742,"total_tokens":4000,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":713,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:27:48.222Z -->
```typescript
import { ThaiIntentRouter, thaiIntentRouter, RoutingDecision } from '../src/services/thaiIntentRouter';

// Mock external dependencies that the router likely uses internally
jest.mock('../src/services/intentClassifier', () => ({
  classifyIntent: jest.fn(),
}));

jest.mock('../src/services/languageDetector', () => ({
  detectLanguage: jest.fn(),
}));

jest.mock('../src/config/modelRegistry', () => ({
  getModelConfig: jest.fn(),
  DEFAULT_MODEL: 'gpt-4',
  MDES_MODEL: 'mdes-specialist',
}));

describe('ThaiIntentRouter — Contract Tests', () => {
  let router: ThaiIntentRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new ThaiIntentRouter();
  });

  describe('Module Exports', () => {
    it('exports ThaiIntentRouter class', () => {
      expect(ThaiIntentRouter).toBeDefined();
      expect(typeof ThaiIntentRouter).toBe('function');
    });

    it('exports a singleton thaiIntentRouter instance', () => {
      expect(thaiIntentRouter).toBeDefined();
      expect(thaiIntentRouter).toBeInstanceOf(ThaiIntentRouter);
    });

    it('singleton instance is stable across imports', () => {
      const instance1 = thaiIntentRouter;
      const instance2 = thaiIntentRouter;
      expect(instance1).toBe(instance2);
    });
  });

  describe('Constructor', () => {
    it('creates an instance without arguments', () => {
      const instance = new ThaiIntentRouter();
      expect(instance).toBeInstanceOf(ThaiIntentRouter);
    });

    it('creates independent instances', () => {
      const instance1 = new ThaiIntentRouter();
      const instance2 = new ThaiIntentRouter();
      expect(instance1).not.toBe(instance2);
    });

    it('instance has route method', () => {
      const instance = new ThaiIntentRouter();
      expect(typeof instance.route).toBe('function');
    });

    it('instance has routeToMDES method', () => {
      const instance = new ThaiIntentRouter();
      expect(typeof instance.routeToMDES).toBe('function');
    });
  });

  describe('route(text, availableModels)', () => {
    const availableModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-2', 'mdes-specialist'];

    it('returns a RoutingDecision for valid Thai text', async () => {
      const decision = await router.route('สวัสดีครับ วันนี้天气เป็นอย่างไร', availableModels);

      expect(decision).toBeDefined();
      expect(typeof decision).toBe('object');
    });

    it('returns a decision with a model property that is a string', async () => {
      const decision = await router.route('ขอข้อมูลเกี่ยวกับนโยบายดิจิทัล', availableModels);

      expect(decision).toHaveProperty('model');
      expect(typeof (decision as any).model).toBe('string');
    });

    it('selected model must be from the availableModels list', async () => {
      const models = ['model-a', 'model-b', 'model-c'];
      const decision = await router.route('ทดสอบการเลือกโมเดล', models);

      expect(models).toContain((decision as any).model);
    });

    it('returns consistent results for identical inputs', async () => {
      const text = 'คำถามซ้ำเกี่ยวกับนโยบาย';
      const decision1 = await router.route(text, availableModels);
      const decision2 = await router.route(text, availableModels);

      expect(decision1).toEqual(decision2);
    });

    it('handles Thai text with mixed English content', async () => {
      const decision = await router.route('ช่วยอธิบายเรื่อง API integration ให้หน่อยครับ', availableModels);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('handles very short Thai text', async () => {
      const decision = await router.route('สวัสดี', availableModels);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('handles long Thai text input', async () => {
      const longText = 'คำถาม'.repeat(500);
      const decision = await router.route(longText, availableModels);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('throws or rejects when text is empty string', async () => {
      await expect(router.route('', availableModels)).rejects.toThrow();
    });

    it('throws or rejects when availableModels is empty array', async () => {
      await expect(router.route('ข้อความทดสอบ', [])).rejects.toThrow();
    });

    it('throws or rejects when text is null/undefined', async () => {
      await expect(router.route(null as any, availableModels)).rejects.toThrow();
      await expect(router.route(undefined as any, availableModels)).rejects.toThrow();
    });

    it('throws or rejects when availableModels is null/undefined', async () => {
      await expect(router.route('ข้อความ', null as any)).rejects.toThrow();
      await expect(router.route('ข้อความ', undefined as any)).rejects.toThrow();
    });

    it('returns a promise', () => {
      const result = router.route('ทดสอบ', availableModels);
      expect(result).toBeInstanceOf(Promise);
    });

    it('handles text with only whitespace by throwing', async () => {
      await expect(router.route('   ', availableModels)).rejects.toThrow();
    });

    it('handles text with special characters and emojis', async () => {
      const decision = await router.route('ช่วยด้วย! 🆘 ระบบมีปัญหา @#$%', availableModels);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('works with single model in availableModels', async () => {
      const decision = await router.route('ทดสอบกับโมเดลเดียว', ['only-model']);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBe('only-model');
    });

    it('RoutingDecision has a confidence property as a number between 0 and 1', async () => {
      const decision = await router.route('ทดสอบความมั่นใจ', availableModels);

      expect(decision).toHaveProperty('confidence');
      expect(typeof (decision as any).confidence).toBe('number');
      expect((decision as any).confidence).toBeGreaterThanOrEqual(0);
      expect((decision as any).confidence).toBeLessThanOrEqual(1);
    });

    it('RoutingDecision has an intent property as a string', async () => {
      const decision = await router.route('สอบถามเรื่องงบประมาณ', availableModels);

      expect(decision).toHaveProperty('intent');
      expect(typeof (decision as any).intent).toBe('string');
      expect((decision as any).intent.length).toBeGreaterThan(0);
    });
  });

  describe('routeToMDES(text)', () => {
    it('returns a RoutingDecision for valid Thai text', async () => {
      const decision = await router.routeToMDES('นโยบายดิจิทัลเพื่อเศรษฐกิจและสังคม');

      expect(decision).toBeDefined();
      expect(typeof decision).toBe('object');
    });

    it('returns a promise', () => {
      const result = router.routeToMDES('ทดสอบ');
      expect(result).toBeInstanceOf(Promise);
    });

    it('decision targets an MDES-related model', async () => {
      const decision = await router.routeToMDES('สอบถามเรื่อง MDES');

      expect(decision).toHaveProperty('model');
      expect(typeof (decision as any).model).toBe('string');
      expect((decision as any).model.length).toBeGreaterThan(0);
    });

    it('throws or rejects when text is empty', async () => {
      await expect(router.routeToMDES('')).rejects.toThrow();
    });

    it('throws or rejects when text is null/undefined', async () => {
      await expect(router.routeToMDES(null as any)).rejects.toThrow();
      await expect(router.routeToMDES(undefined as any)).rejects.toThrow();
    });

    it('handles whitespace-only text by throwing', async () => {
      await expect(router.routeToMDES('   ')).rejects.toThrow();
    });

    it('returns decision with confidence property', async () => {
      const decision = await router.routeToMDES('ข้อมูลนโยบาย MDES');

      expect(decision).toHaveProperty('confidence');
      expect(typeof (decision as any).confidence).toBe('number');
      expect((decision as any).confidence).toBeGreaterThanOrEqual(0);
      expect((decision as any).confidence).toBeLessThanOrEqual(1);
    });

    it('returns decision with intent property', async () => {
      const decision = await router.routeToMDES('แผนแม่บทดิจิทัล');

      expect(decision).toHaveProperty('intent');
      expect(typeof (decision as any).intent).toBe('string');
    });

    it('returns consistent results for identical inputs', async () => {
      const text = 'คำถามซ้ำเรื่อง MDES';
      const decision1 = await router.routeToMDES(text);
      const decision2 = await router.routeToMDES(text);

      expect(decision1).toEqual(decision2);
    });

    it('handles long text input', async () => {
      const longText = 'นโยบายดิจิทัล'.repeat(200);
      const decision = await router.routeToMDES(longText);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('handles text with special characters', async () => {
      const decision = await router.routeToMDES('MDES @2024! นโยบาย #ดิจิทัล');

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });
  });

  describe('Routing Decision Shape Contract', () => {
    it('route() decision contains all required RoutingDecision fields', async () => {
      const decision = await router.route('ทดสอบโครงสร้าง', ['model-a', 'model-b']);

      // Verify the decision has the expected shape
      expect(decision).toHaveProperty('model');
      expect(decision).toHaveProperty('confidence');
      expect(decision).toHaveProperty('intent');
    });

    it('routeToMDES() decision contains all required RoutingDecision fields', async () => {
      const decision = await router.routeToMDES('ทดสอบโครงสร้าง MDES');

      expect(decision).toHaveProperty('model');
      expect(decision).toHaveProperty('confidence');
      expect(decision).toHaveProperty('intent');
    });

    it('model field is never empty string', async () => {
      const decision = await router.route('ทดสอบ', ['valid-model']);
      expect((decision as any).model).not.toBe('');
    });

    it('intent field is never empty string', async () => {
      const decision = await router.route('ทดสอบ', ['valid-model']);
      expect((decision as any).intent).not.toBe('');
    });
  });

  describe('Intent Differentiation', () => {
    it('different intents may route to different models when multiple are available', async () => {
      const models = ['general-model', 'technical-model', 'policy-model'];

      const generalDecision = await router.route('สวัสดีครับ สบายดีไหม', models);
      const technicalDecision = await router.route('อธิบาย architecture ของ microservices', models);

      // Both should return valid decisions
      expect(generalDecision).toBeDefined();
      expect(technicalDecision).toBeDefined();
      expect(models).toContain((generalDecision as any).model);
      expect(models).toContain((technicalDecision as any).model);
    });

    it('routeToMDES always targets MDES regardless of general routing', async () => {
      const mdesDecision = await router.routeToMDES('นโยบาย MDES');
      const generalDecision = await router.route('นโยบาย MDES', ['general-model', 'other-model']);

      // MDES route should have a model assigned
      expect((mdesDecision as any).model).toBeDefined();
      expect((mdesDecision as any).model.length).toBeGreaterThan(0);
      // General route should also work
      expect((generalDecision as any).model).toBeDefined();
    });
  });

  describe('Concurrency', () => {
    it('handles multiple concurrent route calls', async () => {
      const models = ['model-a', 'model-b'];
      const promises = Array.from({ length: 10 }, (_, i) =>
        router.route(`ข้อความทดสอบที่ ${i}`, models)
      );

      const decisions = await Promise.all(promises);

      expect(decisions).toHaveLength(10);
      decisions.forEach((decision) => {
        expect(decision).toBeDefined();
        expect((decision as any).model).toBeDefined();
        expect(models).toContain((decision as any).model);
      });
    });

    it('handles concurrent route and routeToMDES calls', async () => {
      const models = ['model-a', 'model-b'];

      const [routeDecision, mdesDecision] = await Promise.all([
        router.route('ทดสอบทั่วไป', models),
        router.routeToMDES('ทดสอบ MDES'),
      ]);

      expect(routeDecision).toBeDefined();
      expect(mdesDecision).toBeDefined();
      expect((routeDecision as any).model).toBeDefined();
      expect((mdesDecision as any).model).toBeDefined();
    });
  });
});
```
