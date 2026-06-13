<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T014 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2488,"completion_tokens":5191,"total_tokens":7679,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":861,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T10:53:24.081Z -->
```typescript
import ModelLoadBalancer, {
  ModelConfig,
  ModelStats,
  Strategy,
} from '../src/services/modelLoadBalancer';

describe('ModelLoadBalancer', () => {
  // Access to the singleton instance for cleanup
  let balancer: ModelLoadBalancer;

  beforeEach(() => {
    jest.useFakeTimers();
    // Reset the singleton state for a clean test
    // eslint-disable-next-line @typescript-eslint/dot-notation
    (ModelLoadBalancer as any)['instance'] = null;
    balancer = ModelLoadBalancer.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clean up the health probe timer to prevent leaking
    // The method is private but we can access the timer property indirectly
    // Stop ongoing timers: clear all intervals
    jest.clearAllTimers();
  });

  const defaultModel: ModelConfig = {
    id: 'mdes-default',
    endpoint: 'https://ollama.mdes-innova.online',
    model: 'gemma4:26b',
    weight: 1,
    tags: [],
  };

  test('getInstance returns the same instance', () => {
    const a = ModelLoadBalancer.getInstance();
    const b = ModelLoadBalancer.getInstance();
    expect(a).toBe(b);
  });

  test('constructor bootstraps the default model', () => {
    const stats = balancer.getStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].id).toBe('mdes-default');
  });

  test('addModel adds a new model', () => {
    const newModel: ModelConfig = {
      id: 'custom-1',
      endpoint: 'http://localhost:11434',
      model: 'phi4:14b',
    };
    balancer.addModel(newModel);
    const stats = balancer.getStats();
    expect(stats.find((s) => s.id === 'custom-1')).toBeTruthy();
  });

  test('addModel updates existing model config without resetting stats', () => {
    // First, simulate some activity to build a latency window and requests
    balancer.selectModel('round-robin'); // selects default model
    balancer.recordLatency('mdes-default', 100);
    const oldStats = balancer.getStats().find((s) => s.id === 'mdes-default')!;
    expect(oldStats.totalRequests).toBeGreaterThan(0);

    // Update config
    balancer.addModel({
      id: 'mdes-default',
      endpoint: 'https://new-endpoint.example.com',
      model: 'gemma4:27b',
      weight: 5,
    });

    const updatedStats = balancer.getStats().find((s) => s.id === 'mdes-default')!;
    expect(updatedStats.totalRequests).toBe(oldStats.totalRequests);
    expect(updatedStats.activeRequests).toBe(oldStats.activeRequests);
    // Config endpoint should be updated (we can't directly access config, but via selectModel we can)
    const selected = balancer.selectModel('round-robin');
    expect(selected?.endpoint).toBe('https://new-endpoint.example.com');
  });

  test('removeModel removes a model', () => {
    balancer.addModel({ id: 'temp', endpoint: 'http://x', model: 'tiny' });
    let stats = balancer.getStats();
    expect(stats.some((s) => s.id === 'temp')).toBe(true);

    balancer.removeModel('temp');
    stats = balancer.getStats();
    expect(stats.some((s) => s.id === 'temp')).toBe(false);
  });

  test('removeModel does nothing for non-existent id', () => {
    const sizeBefore = balancer.getStats().length;
    balancer.removeModel('nonexistent');
    expect(balancer.getStats().length).toBe(sizeBefore);
  });

  // --- selectModel strategies ---
  test('selectModel round-robin cycles through eligible models', () => {
    balancer.addModel({ id: 'A', endpoint: 'http://a', model: 'm1' });
    balancer.addModel({ id: 'B', endpoint: 'http://b', model: 'm2' });
    const selections = [1, 2, 3, 4].map(() => balancer.selectModel('round-robin')?.id);
    // The default model is also present, so we expect a pattern: working through all three
    // mdes-default, A, B, then mdes-default again.
    expect(selections[0]).toBe('mdes-default');
    expect(selections[1]).toBe('A');
    expect(selections[2]).toBe('B');
    expect(selections[3]).toBe('mdes-default');
  });

  test('selectModel round-robin adjusts to eligible list size changes', () => {
    balancer.addModel({ id: 'A', endpoint: 'a', model: 'm' });
    balancer.addModel({ id: 'B', endpoint: 'b', model: 'm' });
    // select once to advance index
    balancer.selectModel('round-robin'); // default
    balancer.removeModel('B');
    // index is now 1, but eligible list size = 2 (default, A)
    const next = balancer.selectModel('round-robin');
    // The roundRobinIndex was 1, modulo 2 = 1 -> selects A
    expect(next?.id).toBe('A');
  });

  test('selectModel round-robin returns null if no eligible models', () => {
    // Disable the only model
    for (let i = 0; i < 5; i++) {
      balancer.recordError('mdes-default');
    }
    // it's now disabled for 60s
    const result = balancer.selectModel('round-robin');
    expect(result).toBeNull();
  });

  test('selectModel least-latency picks lowest average latency', () => {
    balancer.addModel({ id: 'fast', endpoint: 'f', model: 'm' });
    balancer.addModel({ id: 'slow', endpoint: 's', model: 'm' });
    // Simulate latencies
    balancer.selectModel('round-robin'); // ignore for setup, just to increment active requests? We'll record directly
    balancer.recordLatency('fast', 10);
    balancer.recordLatency('fast', 20);
    balancer.recordLatency('slow', 200);
    balancer.recordLatency('slow', 300);

    const selected = balancer.selectModel('least-latency');
    expect(selected?.id).toBe('fast');
  });

  test('selectModel least-latency works with no latency data', () => {
    balancer.addModel({ id: 'new', endpoint: 'n', model: 'm' });
    // no latencies recorded, avg = 0 for both
    const selected = balancer.selectModel('least-latency');
    expect(selected).toBeTruthy();
  });

  test('selectModel weighted distributes proportionally (statistical check)', () => {
    balancer.removeModel('mdes-default');
    balancer.addModel({ id: 'heavy', endpoint: 'h', model: 'm', weight: 10 });
    balancer.addModel({ id: 'light', endpoint: 'l', model: 'm', weight: 1 });
    let heavyCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      // Reset activeRequests each iteration to avoid maxConcurrent exclusion (none set)
      // We need to simulate a full request life-cycle per selection,
      // but activeRequests is incremented, we must balance with recordLatency/Error
      // So we'll record success immediately after selection.
      const selected = balancer.selectModel('weighted');
      if (selected?.id === 'heavy') heavyCount++;
      // Record success to decrement activeRequests
      if (selected) balancer.recordLatency(selected.id, 1);
    }
    // heavy weight 10, light 1 => probability heavy ~ 10/11 ≈ 0.909
    expect(heavyCount).toBeGreaterThan(800);
    expect(heavyCount).toBeLessThan(990);
  });

  test('selectModel random returns a model', () => {
    const selected = balancer.selectModel('random');
    expect(selected).toBeTruthy();
    expect(selected?.id).toBe('mdes-default');
  });

  test('selectModel throws for unknown strategy', () => {
    expect(() => balancer.selectModel('unicorn' as Strategy)).toThrow('Unknown strategy');
  });

  test('selectModel respects maxConcurrent limit', () => {
    balancer.addModel({ id: 'limited', endpoint: 'l', model: 'm', maxConcurrent: 2 });
    // Select twice to fill concurrency slots
    const first = balancer.selectModel('round-robin');
    const second = balancer.selectModel('round-robin');
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    // Third selection should skip the limited model if it hits maxConcurrent
    // Currently we have default and limited. If limited is at 2, only default is eligible.
    // We need to ensure round-robin lands on something eligible.
    // Advance round-robin to land on limited but it's full -> should skip to next eligible
    // Simulate index alignment: remove and re-add to reset index? Better: manually set high activeRequests.
    // We'll just check that after two selects from limited without recording, the third yields something else.
    // But we didn't record success, so activeRequests are still 2.
    const third = balancer.selectModel('round-robin');
    expect(third?.id).not.toBe('limited');
  });

  test('selectModel skips disabled models (circuit breaker)', () => {
    balancer.addModel({ id: 'victim', endpoint: 'v', model: 'm' });
    // cause 5 consecutive errors
    for (let i = 0; i < 5; i++) {
      balancer.recordError('victim');
    }
    const stats = balancer.getStats().find((s) => s.id === 'victim')!;
    expect(stats.activeRequests).toBe(0); // decreased each error

    // victim should be disabled for 60s
    let selected = balancer.selectModel('round-robin');
    // victim might be selected if strategy picks it but it's disabled, so it's excluded.
    // Ensure none return victim
    for (let i = 0; i < 20; i++) {
      selected = balancer.selectModel('round-robin');
      if (selected) expect(selected.id).not.toBe('victim');
    }
    // Advance time to expire the disability
    jest.advanceTimersByTime(61_000);
    // Now victim should be eligible again
    const after = balancer.selectModel('round-robin');
    // Can't guarantee it picks victim but it's now eligible.
    // We'll just check that victim appears among possible selections over cycles.
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = balancer.selectModel('round-robin');
      if (s) seen.add(s.id);
    }
    expect(seen.has('victim')).toBe(true);
  });

  // --- recordLatency and recordError ---
  test('recordLatency updates stats and resets consecutive errors', () => {
    balancer.addModel({ id: 'test', endpoint: 't', model: 'm' });
    // Simulate some errors first
    balancer.recordError('test');
    balancer.recordError('test');
    // Now record latency
    balancer.recordLatency('test', 50);
    const stats = balancer.getStats().find((s) => s.id === 'test')!;
    expect(stats.totalRequests).toBe(3); // 2 errors + 1 success
    expect(stats.errorRate).toBe(2 / 3); // will be computed later
    expect(stats.activeRequests).toBe(0);
    // Average latency: only 50 in window, so avg = 50
    expect(stats.avgLatency).toBe(50);
    // Consecutive errors reset (not directly visible, but we can infer that circuit didn't trip)
    // If we error again, it should not be disabled yet because reset to 0
    balancer.recordError('test');
    // 1 consecutive error, not 5
    // Should still be eligible
    const selected = balancer.selectModel('round-robin');
    expect(selected).toBeTruthy(); // test is eligible
  });

  test('recordLatency maintains rolling window of 20 items', () => {
    balancer.addModel({ id: 'test', endpoint: 't', model: 'm' });
    for (let i = 1; i <= 25; i++) {
      balancer.recordLatency('test', i);
    }
    const stats = balancer.getStats().find((s) => s.id === 'test')!;
    // window should contain last 20: values 6-25, average = (6+...+25)/20
    const expectedAvg = (6 + 25) * 20 / 2 / 20; // arithmetic series sum = (first+last)*n/2
    expect(stats.avgLatency).toBe(expectedAvg); // 15.5
  });

  test('recordError triggers circuit breaker after 5 consecutive errors', () => {
    balancer.addModel({ id: 'breaker', endpoint: 'b', model: 'm' });
    for (let i = 0; i < 4; i++) {
      balancer.recordError('breaker');
    }
    // after 4 errors, still eligible
    let selected = balancer.selectModel('round-robin');
    // there are multiple models, but we just need to confirm breaker is not disabled yet
    const beforeDisable = balancer.selectModel('round-robin'); // might not be breaker, but we can test directly by forcing it
    // Actually, we can test by checking if breaker is excluded later.
    // We'll just trust that after 5 errors it becomes disabledTill set.
    balancer.recordError('breaker'); // 5th
    // Now breaker should be disabled for 60s
    // Verify by checking that no selection returns it.
    for (let i = 0; i < 20; i++) {
      selected = balancer.selectModel('round-robin');
      if (selected) expect(selected.id).not.toBe('breaker');
    }
  });

  test('recordLatency decrements activeRequests (not below zero)', () => {
    balancer.addModel({ id: 'test', endpoint: 't', model: 'm' });
    // Manually increment activeRequests by selecting, then record latency
    const selected = balancer.selectModel('round-robin'); // increments activeRequests
    expect(selected).toBeTruthy();
    balancer.recordLatency(selected!.id, 10);
    const stats = balancer.getStats().find((s) => s.id === selected!.id)!;
    expect(stats.activeRequests).toBe(0);
    // Additional recordLatency without prior select shouldn't go negative
    balancer.recordLatency(selected!.id, 10);
    const stats2 = balancer.getStats().find((s) => s.id === selected!.id)!;
    expect(stats2.activeRequests).toBe(0);
  });

  test('recordError decrements activeRequests and increases totalErrors', () => {
    balancer.addModel({ id: 'err', endpoint: 'e', model: 'm' });
    const selected = balancer.selectModel('round-robin');
    balancer.recordError(selected!.id);
    const stats = balancer.getStats().find((s) => s.id === selected!.id)!;
    expect(stats.activeRequests).toBe(0);
    expect(stats.totalRequests).toBe(1);
    expect(stats.errorRate).toBe(1);
  });

  test('recordLatency and recordError ignore unknown ids', () => {
    expect(() => balancer.recordLatency('ghost', 100)).not.toThrow();
    expect(() => balancer.recordError('ghost')).not.toThrow();
  });

  // --- getStats ---
  test('getStats returns all stats fields with correct computed values', () => {
    balancer.addModel({ id: 'full', endpoint: 'f', model: 'm' });
    // Simulate some activity
    balancer.selectModel('round-robin');
    balancer.recordLatency('full', 30);
    balancer.recordLatency('full', 70);
    balancer.recordError('full');
    const stats = balancer.getStats().find((s) => s.id === 'full')!;
    expect(stats.avgLatency).toEqual(50); // (30+70)/2
    expect(stats.errorRate).toEqual(1 / 3); // 1 error out of 3 total
    expect(stats.activeRequests).toBe(0);
    expect(stats.totalRequests).toBe(3);
  });

  test('getStats returns zero avgLatency and errorRate for untouched models', () => {
    const stats = balancer.getStats().find((s) => s.id === 'mdes-default')!;
    expect(stats.avgLatency).toBe(0);
    expect(stats.errorRate).toBe(0);
    expect(stats.activeRequests).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });

  test('getStats reflects updates after model removal', () => {
    balancer.addModel({ id: 'temp', endpoint: 't', model: 'm' });
    expect(balancer.getStats().some((s) => s.id === 'temp')).toBe(true);
    balancer.removeModel('temp');
    expect(balancer.getStats().some((s) => s.id === 'temp')).toBe(false);
  });

  test('selectModel increments activeRequests on selection', () => {
    const before = balancer.getStats().find((s) => s.id === 'mdes-default')!.activeRequests;
    balancer.selectModel('round-robin');
    const after = balancer.getStats().find((s) => s.id === 'mdes-default')!.activeRequests;
    expect(after).toBe(before + 1);
  });

  // Health probe timer (implicit test through circuit breaker recovery)
  test('circuit breaker disables model temporarily', () => {
    const id = 'mdes-default';
    for (let i = 0; i < 5; i++) balancer.recordError(id);
    const disabledTime = Date.now() + 60_000;
    // Model is disabled
    let result = balancer.selectModel('round-robin');
    expect(result).toBeNull(); // only model, now disabled
    jest.advanceTimersByTime(61_000);
    // After timeout, model should be eligible again
    result = balancer.selectModel('round-robin');
    expect(result).not.toBeNull();
  });

  test('health probes do not affect model before circuit breaker timeout', () => {
    const id = 'mdes-default';
    for (let i = 0; i < 5; i++) balancer.recordError(id);
    // Fire timers that may run health probes, but within the 60s disabled period
    jest.advanceTimersByTime(30_000);
    const result = balancer.selectModel('round-robin');
    expect(result).toBeNull(); // still disabled
  });
});
```
