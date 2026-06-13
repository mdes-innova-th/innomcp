<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S014 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":222,"completion_tokens":4685,"total_tokens":4907,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1025,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:22:58.811Z -->
```typescript
import ModelLoadBalancer, {
  ModelConfig,
  ModelStats,
  Strategy,
} from '../src/services/modelLoadBalancer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfigs(count: number, baseWeight?: number): ModelConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `model-${i}`,
    weight: baseWeight ?? 1,
    endpoint: `https://model-${i}.example.com`,
  }));
}

function makeConfigsWithWeights(weights: number[]): ModelConfig[] {
  return weights.map((w, i) => ({
    id: `model-${i}`,
    weight: w,
    endpoint: `https://model-${i}.example.com`,
  }));
}

// ─── Constructor contract ────────────────────────────────────────────────────

describe('ModelLoadBalancer — constructor contract', () => {
  it('accepts a non-empty model list and defaults strategy to round-robin', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3));
    // round-robin is the most neutral default; verify via repeated selects
    const ids = Array.from({ length: 6 }, () => lb.select().id);
    expect(ids).toEqual([
      'model-0', 'model-1', 'model-2',
      'model-0', 'model-1', 'model-2',
    ]);
  });

  it('accepts an explicit strategy', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'random');
    // random must still return a valid model id from the pool
    for (let i = 0; i < 20; i++) {
      const selected = lb.select();
      expect(['model-0', 'model-1', 'model-2']).toContain(selected.id);
    }
  });

  it('throws on empty model list', () => {
    expect(() => new ModelLoadBalancer([])).toThrow();
  });

  it('throws on invalid strategy', () => {
    expect(() => new ModelLoadBalancer(makeConfigs(2), 'invalid' as Strategy)).toThrow();
  });

  it('throws on model config missing id', () => {
    expect(() => new ModelLoadBalancer([{ weight: 1 }] as ModelConfig[])).toThrow();
  });

  it('throws on duplicate model ids', () => {
    const configs: ModelConfig[] = [
      { id: 'dup', weight: 1 },
      { id: 'dup', weight: 2 },
    ];
    expect(() => new ModelLoadBalancer(configs)).toThrow();
  });
});

// ─── Round-robin contract ───────────────────────────────────────────────────

describe('ModelLoadBalancer — round-robin strategy', () => {
  it('cycles through models in insertion order', () => {
    const lb = new ModelLoadBalancer(makeConfigs(4), 'round-robin');
    const ids = Array.from({ length: 12 }, () => lb.select().id);
    expect(ids).toEqual([
      'model-0', 'model-1', 'model-2', 'model-3',
      'model-0', 'model-1', 'model-2', 'model-3',
      'model-0', 'model-1', 'model-2', 'model-3',
    ]);
  });

  it('skips removed models and continues cycling remaining ones', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    lb.select(); // model-0
    lb.select(); // model-1
    lb.removeModel('model-2');
    const ids = Array.from({ length: 4 }, () => lb.select().id);
    expect(ids).toEqual(['model-0', 'model-1', 'model-0', 'model-1']);
  });

  it('resets cycle pointer when strategy is changed back', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    lb.select(); // model-0
    lb.setStrategy('random');
    lb.setStrategy('round-robin');
    // cycle should restart from first model
    const ids = Array.from({ length: 3 }, () => lb.select().id);
    expect(ids).toEqual(['model-0', 'model-1', 'model-2']);
  });
});

// ─── Least-latency contract ─────────────────────────────────────────────────

describe('ModelLoadBalancer — least-latency strategy', () => {
  it('selects the model with the lowest average latency', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'least-latency');
    lb.reportLatency('model-0', 200);
    lb.reportLatency('model-1', 50);
    lb.reportLatency('model-2', 150);
    expect(lb.select().id).toBe('model-1');
  });

  it('updates selection after new latency reports', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'least-latency');
    lb.reportLatency('model-0', 100);
    lb.reportLatency('model-1', 300);
    lb.reportLatency('model-2', 500);
    expect(lb.select().id).toBe('model-0');

    // model-2 improves dramatically
    lb.reportLatency('model-2', 10);
    lb.reportLatency('model-2', 10);
    expect(lb.select().id).toBe('model-2');
  });

  it('falls back to round-robin among models with no latency data', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'least-latency');
    // No latency reported yet — should cycle fairly
    const first = lb.select().id;
    const second = lb.select().id;
    expect(first).not.toBe(second);
  });

  it('computes average latency correctly over multiple reports', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'least-latency');
    // model-0 avg = (100 + 300) / 2 = 200
    lb.reportLatency('model-0', 100);
    lb.reportLatency('model-0', 300);
    // model-1 avg = 150
    lb.reportLatency('model-1', 150);
    expect(lb.select().id).toBe('model-1');
  });
});

// ─── Weighted contract ───────────────────────────────────────────────────────

describe('ModelLoadBalancer — weighted strategy', () => {
  it('distributes selections proportionally to weights', () => {
    const configs = makeConfigsWithWeights([1, 3]);
    const lb = new ModelLoadBalancer(configs, 'weighted');
    const counts: Record<string, number> = { 'model-0': 0, 'model-1': 0 };
    const N = 4000;
    for (let i = 0; i < N; i++) {
      counts[lb.select().id]++;
    }
    // model-1 should receive ~75% of selections (weight 3 / total 4)
    const ratio = counts['model-1'] / N;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.85);
  });

  it('handles equal weights like round-robin (roughly)', () => {
    const configs = makeConfigsWithWeights([1, 1, 1]);
    const lb = new ModelLoadBalancer(configs, 'weighted');
    const counts: Record<string, number> = { 'model-0': 0, 'model-1': 0, 'model-2': 0 };
    const N = 3000;
    for (let i = 0; i < N; i++) {
      counts[lb.select().id]++;
    }
    // Each should get roughly 1/3
    for (const id of Object.keys(counts)) {
      expect(counts[id]).toBeGreaterThan(N / 3 - 200);
      expect(counts[id]).toBeLessThan(N / 3 + 200);
    }
  });

  it('throws if any model has weight <= 0 when using weighted strategy', () => {
    const configs: ModelConfig[] = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 0 },
    ];
    expect(() => new ModelLoadBalancer(configs, 'weighted')).toThrow();
  });
});

// ─── Random contract ─────────────────────────────────────────────────────────

describe('ModelLoadBalancer — random strategy', () => {
  it('always returns a model from the pool', () => {
    const lb = new ModelLoadBalancer(makeConfigs(5), 'random');
    for (let i = 0; i < 100; i++) {
      const selected = lb.select();
      expect(selected.id).toMatch(/^model-[0-4]$/);
    }
  });

  it('eventually selects every model over many iterations', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'random');
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(lb.select().id);
      if (seen.size === 3) break;
    }
    expect(seen.size).toBe(3);
  });

  it('does not select removed models', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'random');
    lb.removeModel('model-1');
    for (let i = 0; i < 100; i++) {
      expect(lb.select().id).not.toBe('model-1');
    }
  });
});

// ─── addModel / removeModel contract ─────────────────────────────────────────

describe('ModelLoadBalancer — addModel / removeModel', () => {
  it('adds a new model that becomes selectable', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    lb.addModel({ id: 'model-new', weight: 1 });
    const ids = Array.from({ length: 6 }, () => lb.select().id);
    expect(ids).toContain('model-new');
  });

  it('throws when adding a model with duplicate id', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    expect(() => lb.addModel({ id: 'model-0', weight: 1 })).toThrow();
  });

  it('removes a model so it is never selected', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    lb.removeModel('model-1');
    const ids = Array.from({ length: 6 }, () => lb.select().id);
    expect(ids).not.toContain('model-1');
  });

  it('throws when removing a non-existent model', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    expect(() => lb.removeModel('nonexistent')).toThrow();
  });

  it('throws when last model is removed (cannot have empty pool)', () => {
    const lb = new ModelLoadBalancer(makeConfigs(1), 'round-robin');
    expect(() => lb.removeModel('model-0')).toThrow();
  });
});

// ─── reportLatency / getStats contract ───────────────────────────────────────

describe('ModelLoadBalancer — reportLatency / getStats', () => {
  it('tracks request count per model after selects', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    lb.select(); // model-0
    lb.select(); // model-1
    lb.select(); // model-0
    const stats = lb.getStats();
    const s0 = stats.find((s: ModelStats) => s.modelId === 'model-0')!;
    const s1 = stats.find((s: ModelStats) => s.modelId === 'model-1')!;
    expect(s0.requestCount).toBe(2);
    expect(s1.requestCount).toBe(1);
  });

  it('tracks average latency from reports', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'least-latency');
    lb.reportLatency('model-0', 100);
    lb.reportLatency('model-0', 200);
    lb.reportLatency('model-1', 50);
    const stats = lb.getStats();
    const s0 = stats.find((s: ModelStats) => s.modelId === 'model-0')!;
    const s1 = stats.find((s: ModelStats) => s.modelId === 'model-1')!;
    expect(s0.avgLatency).toBe(150);
    expect(s1.avgLatency).toBe(50);
  });

  it('returns stats for a single model by id', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    lb.reportLatency('model-1', 42);
    const stat = lb.getStats('model-1') as ModelStats;
    expect(stat.modelId).toBe('model-1');
    expect(stat.avgLatency).toBe(42);
  });

  it('throws when reporting latency for unknown model', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    expect(() => lb.reportLatency('unknown', 100)).toThrow();
  });

  it('throws when getting stats for unknown model id', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    expect(() => lb.getStats('unknown')).toThrow();
  });

  it('reports 0 requestCount and 0 avgLatency for unselected models', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    const stats = lb.getStats();
    for (const s of stats) {
      expect(s.requestCount).toBe(0);
      expect(s.avgLatency).toBe(0);
    }
  });
});

// ─── setStrategy contract ───────────────────────────────────────────���───────

describe('ModelLoadBalancer — setStrategy', () => {
  it('changes the selection strategy at runtime', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    expect(lb.select().id).toBe('model-0');
    expect(lb.select().id).toBe('model-1');

    lb.setStrategy('least-latency');
    lb.reportLatency('model-2', 1);
    lb.reportLatency('model-0', 100);
    lb.reportLatency('model-1', 100);
    expect(lb.select().id).toBe('model-2');
  });

  it('throws on invalid strategy value', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    expect(() => lb.setStrategy('bad' as Strategy)).toThrow();
  });

  it('returns current strategy from getStrategy', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'weighted');
    expect(lb.getStrategy()).toBe('weighted');
    lb.setStrategy('random');
    expect(lb.getStrategy()).toBe('random');
  });
});

// ─── Boundary / edge-case contracts ──────────────────────────────────────────

describe('ModelLoadBalancer — boundary conditions', () => {
  it('works with a single model across all strategies', () => {
    const strategies: Strategy[] = ['round-robin', 'least-latency', 'weighted', 'random'];
    for (const strategy of strategies) {
      const lb = new ModelLoadBalancer([{ id: 'only', weight: 1 }], strategy);
      for (let i = 0; i < 10; i++) {
        expect(lb.select().id).toBe('only');
      }
    }
  });

  it('handles zero-latency reports without division errors', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'least-latency');
    lb.reportLatency('model-0', 0);
    lb.reportLatency('model-1', 100);
    expect(lb.select().id).toBe('model-0');
  });

  it('handles very large latency values', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'least-latency');
    lb.reportLatency('model-0', Number.MAX_SAFE_INTEGER);
    lb.reportLatency('model-1', 1);
    expect(lb.select().id).toBe('model-1');
  });

  it('weighted strategy with heavily skewed weights still selects minority model occasionally', () => {
    const configs = makeConfigsWithWeights([99, 1]);
    const lb = new ModelLoadBalancer(configs, 'weighted');
    let minoritySelected = false;
    for (let i = 0; i < 5000; i++) {
      if (lb.select().id === 'model-1') {
        minoritySelected = true;
        break;
      }
    }
    expect(minoritySelected).toBe(true);
  });

  it('select throws when all models have been removed (pool empty)', () => {
    const lb = new ModelLoadBalancer(makeConfigs(2), 'round-robin');
    lb.removeModel('model-0');
    lb.removeModel('model-1');
    expect(() => lb.select()).toThrow();
  });
});
```
