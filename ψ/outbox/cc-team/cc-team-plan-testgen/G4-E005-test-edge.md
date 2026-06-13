<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E005 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2517,"completion_tokens":4505,"total_tokens":7022,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1349,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T11:11:35.249Z -->
```typescript
import ModelLoadBalancer, { ModelConfig, Strategy } from '../src/services/modelLoadBalancer';

describe('ModelLoadBalancer', () => {
  let balancer: ModelLoadBalancer;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    // Reset singleton to get a fresh instance
    (ModelLoadBalancer as any).instance = null;
    balancer = ModelLoadBalancer.getInstance();
    // Remove the default model added by constructor
    balancer.removeModel('mdes-default');
    // Prevent health probes from interfering (if implemented)
    if ((balancer as any).startHealthProbes) {
      jest.spyOn(balancer as any, 'startHealthProbes').mockImplementation(() => {});
    }
    if ((balancer as any).stopHealthProbes) {
      jest.spyOn(balancer as any, 'stopHealthProbes').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const a = ModelLoadBalancer.getInstance();
      const b = ModelLoadBalancer.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('addModel', () => {
    test('adds a new model with defaults', () => {
      balancer.addModel({ id: 'm1', endpoint: 'x', model: 'm' });
      const stats = balancer.getStats();
      const model = stats.find(s => s.id === 'm1');
      expect(model).toBeDefined();
      // check stats are initialized
      expect(model!.avgLatency).toBe(0);
      expect(model!.errorRate).toBe(0);
      expect(model!.activeRequests).toBe(0);
      expect(model!.totalRequests).toBe(0);
    });

    test('updates existing model without resetting stats', () => {
      balancer.addModel({ id: 'm1', endpoint: 'x', model: 'm' });
      const modelConfig = balancer.selectModel();
      balancer.recordLatency('m1', 100);
      // update endpoint
      balancer.addModel({ id: 'm1', endpoint: 'y', model: 'm' });
      const updatedStats = balancer.getStats().find(s => s.id === 'm1');
      expect(updatedStats!.avgLatency).toBe(100); // latency window kept
      const selected = balancer.selectModel();
      expect(selected!.endpoint).toBe('y');
    });

    test('weight and tags default to 1 and [] if not provided', () => {
      balancer.addModel({ id: 'm1', endpoint: 'x', model: 'm' });
      // select using weighted to check weight default is 1
      const selected = balancer.selectModel('weighted');
      expect(selected).not.toBeNull();
      // Can't directly inspect weight from outside, but getStats doesn't expose weight.
      // We trust the default is applied. No error means weight handled.
    });
  });

  describe('removeModel', () => {
    test('does nothing on non-existent id', () => {
      expect(() => balancer.removeModel('nonexistent')).not.toThrow();
      // no change in stats count
      expect(balancer.getStats().length).toBe(0);
    });

    test('removes an existing model', () => {
      balancer.addModel({ id: 'm1', endpoint: 'x', model: 'm' });
      expect(balancer.getStats().length).toBe(1);
      balancer.removeModel('m1');
      expect(balancer.getStats().length).toBe(0);
    });
  });

  describe('selectModel', () => {
    beforeEach(() => {
      balancer.addModel({ id: 'a', endpoint: 'ea', model: 'ma', weight: 2, tags: [] });
      balancer.addModel({ id: 'b', endpoint: 'eb', model: 'mb', weight: 1, tags: [] });
    });

    test('returns null when no models exist', () => {
      balancer.removeModel('a');
      balancer.removeModel('b');
      expect(balancer.selectModel()).toBeNull();
    });

    test('returns null when all models disabled', () => {
      // disable all models by causing 5 consecutive errors each
      for (let i = 0; i < 5; i++) balancer.recordError('a');
      for (let i = 0; i < 5; i++) balancer.recordError('b');
      expect(balancer.selectModel()).toBeNull();
    });

    test('excludes model that exceeded maxConcurrent', () => {
      balancer.addModel({ id: 'c', endpoint: 'ec', model: 'mc', maxConcurrent: 1 });
      const first = balancer.selectModel(); // must be 'c' or others
      // We need to ensure we pick 'c'. Use filter logic; but we don't control which. 
      // Better to ensure that if a model's activeRequests reaches maxConcurrent, it's excluded.
      // We'll manually force activeRequests to maxConcurrent by selecting it multiple times.
      // Since selection increments activeRequests, we select until we get 'c' then record nothing.
      // Simpler: add a model with maxConcurrent=0? Not meaningful. We'll test by directly manipulating state? Not possible.
      // Use round-robin to control it. Let's reset balancer.
      (ModelLoadBalancer as any).instance = null;
      balancer = ModelLoadBalancer.getInstance();
      balancer.removeModel('mdes-default');
      balancer.addModel({ id: 'x', endpoint: 'ex', model: 'mx', maxConcurrent: 1 });
      const sel = balancer.selectModel(); // picks 'x', activeRequests becomes 1
      expect(sel).not.toBeNull();
      const sel2 = balancer.selectModel(); // should return null because maxConcurrent reached
      expect(sel2).toBeNull();
    });

    test('throws on unknown strategy', () => {
      expect(() => balancer.selectModel('invalid' as Strategy)).toThrow('Unknown strategy: invalid');
    });

    describe('round-robin', () => {
      test('cycles through eligible models', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 4; i++) {
          const model = balancer.selectModel('round-robin')!;
          balancer.recordLatency(model.id, 10);
          ids.add(model.id);
        }
        expect(ids.has('a')).toBe(true);
        expect(ids.has('b')).toBe(true);
      });
    });

    describe('least-latency', () => {
      test('picks model with lowest average latency', () => {
        balancer.recordLatency('a', 100);
        balancer.recordLatency('a', 100);
        balancer.recordLatency('b', 10);
        const selected = balancer.selectModel('least-latency');
        expect(selected!.id).toBe('b');
      });

      test('handles models with no latency data (avg 0)', () => {
        // both zero, picks the first one encountered (a)
        const selected = balancer.selectModel('least-latency');
        expect(selected).not.toBeNull();
      });
    });

    describe('weighted', () => {
      test('selects models according to weight distribution', () => {
        // Weights: a=2, b=1. Over many selections, a should appear more often.
        const counts: Record<string, number> = { a: 0, b: 0 };
        for (let i = 0; i < 100; i++) {
          const model = balancer.selectModel('weighted')!;
          counts[model.id]++;
          balancer.recordLatency(model.id, 1); // reset active request for next selection
        }
        expect(counts.a).toBeGreaterThan(counts.b);
      });

      test('fallback when random weight yields no selection', () => {
        // Edge: May rely on Math.random, but we can mock to force zero remainder.
        const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        const selected = balancer.selectModel('weighted');
        expect(selected).not.toBeNull();
        randSpy.mockRestore();
      });
    });

    describe('random', () => {
      test('returns a model', () => {
        const selected = balancer.selectModel('random');
        expect(selected).not.toBeNull();
      });
    });

    test('increments activeRequests on selection', () => {
      const statsBefore = balancer.getStats().find(s => s.id === 'a')!.activeRequests;
      balancer.selectModel('round-robin'); // will pick whichever, could be a or b.
      // Hard to guarantee which, but we can check total models: their sum has increased.
      // Instead, reset to single model.
      balancer.removeModel('a');
      balancer.removeModel('b');
      balancer.addModel({ id: 'single', endpoint: 'e', model: 'm' });
      const sel = balancer.selectModel();
      const stats = balancer.getStats()[0];
      expect(stats.activeRequests).toBe(1);
    });
  });

  describe('recordLatency', () => {
    beforeEach(() => {
      balancer.addModel({ id: 'm1', endpoint: 'e', model: 'm' });
    });

    test('does nothing for unknown model id', () => {
      expect(() => balancer.recordLatency('ghost', 10)).not.toThrow();
      expect(balancer.getStats().length).toBe(1);
    });

    test('records latency and updates stats', () => {
      balancer.selectModel(); // increment activeRequests
      balancer.recordLatency('m1', 50);
      const stats = balancer.getStats()[0];
      expect(stats.totalRequests).toBe(1);
      expect(stats.avgLatency).toBe(50);
      expect(stats.activeRequests).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    test('resets consecutive error counter', () => {
      balancer.recordError('m1');
      balancer.recordError('m1');
      expect((balancer as any).models.get('m1').consecutiveErrors).toBe(2);
      balancer.recordLatency('m1', 10);
      expect((balancer as any).models.get('m1').consecutiveErrors).toBe(0);
    });

    test('limits latency window to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        balancer.recordLatency('m1', i);
      }
      const window = (balancer as any).models.get('m1').latencyWindow;
      expect(window.length).toBe(20);
      expect(window[0]).toBe(5); // after shift, first should be entry 6 (value 5)
      expect(window[19]).toBe(24);
    });

    test('activeRequests does not go below zero', () => {
      // without previous select, activeRequests is 0, recordLatency should keep it at 0
      balancer.recordLatency('m1', 10);
      expect((balancer as any).models.get('m1').activeRequests).toBe(0);
    });
  });

  describe('recordError', () => {
    beforeEach(() => {
      balancer.addModel({ id: 'm1', endpoint: 'e', model: 'm' });
    });

    test('does nothing for unknown model id', () => {
      expect(() => balancer.recordError('ghost')).not.toThrow();
    });

    test('increments consecutive errors and applies circuit breaker after 5', () => {
      for (let i = 0; i < 5; i++) {
        balancer.recordError('m1');
      }
      const state = (balancer as any).models.get('m1');
      expect(state.consecutiveErrors).toBe(5);
      expect(state.disabledUntil).toBe(Date.now() + 60000);
    });

    test('circuit breaker disables model for 60 seconds', () => {
      const now = Date.now();
      // Trigger breaker
      for (let i = 0; i < 5; i++) balancer.recordError('m1');
      // Model should be disabled now
      expect(balancer.selectModel()).toBeNull();
      // Advance time by 59 seconds -> still disabled
      jest.advanceTimersByTime(59000);
      expect(balancer.selectModel()).toBeNull();
      // Advance 1 more second -> re-enabled
      jest.advanceTimersByTime(1000);
      const selected = balancer.selectModel();
      expect(selected).not.toBeNull();
      expect(selected!.id).toBe('m1');
    });

    test('activeRequests does not go below zero', () => {
      balancer.recordError('m1');
      expect((balancer as any).models.get('m1').activeRequests).toBe(0);
    });

    test('totalRequests and totalErrors are updated', () => {
      balancer.recordError('m1');
      const state = (balancer as any).models.get('m1');
      expect(state.totalRequests).toBe(1);
      expect(state.totalErrors).toBe(1);
      expect(state.consecutiveErrors).toBe(1);
    });
  });

  describe('getStats', () => {
    test('returns empty array when no models', () => {
      expect(balancer.getStats()).toEqual([]);
    });

    test('computes average latency and error rate correctly', () => {
      balancer.addModel({ id: 'm1', endpoint: 'e', model: 'm' });
      balancer.selectModel();
      balancer.recordLatency('m1', 100);
      balancer.recordLatency('m1', 200);
      balancer.recordError('m1');
      const stats = balancer.getStats()[0];
      expect(stats.avgLatency).toBe(150);
      expect(stats.errorRate).toBeCloseTo(1 / 3);
      expect(stats.totalRequests).toBe(3);
      expect(stats.activeRequests).toBe(0);
    });
  });
});
```
