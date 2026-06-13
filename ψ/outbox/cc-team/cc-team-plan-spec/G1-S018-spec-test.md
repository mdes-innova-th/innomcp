<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S018 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":324,"completion_tokens":7000,"total_tokens":7324,"prompt_tokens_details":{"cached_tokens":71,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:24:37.126Z -->
The user wants a Jest contract/behavior test for a module called `providerFailover`. I only have the public API surface, not the implementation. I need to infer the intended behavior from the names and signatures.

Key observations from the API:
- `ProviderStatus` and `ProviderConfig` are interfaces (not fully shown, but implied).
- `HealthCheckFn` is a function that takes a providerId and returns a promise of `{ healthy: boolean; latencyMs: number }`.
- `ProviderFailover` class with:
  - constructor (signature not fully shown, but likely takes some config or providers?)
  - `setHealthChecker(fn)`: sets the health check function.
  - `selectProvider(_task?: string): Promise<string>`: selects a provider, optionally based on a task. Should return a provider ID. If no healthy providers, probably throws.
  - `markFailed(providerId: string): Promise<void>`: marks a provider as failed/unhealthy.
  - `markHealthy(providerId: string, latencyMs: number): Promise<void>`: marks a provider as healthy with a given latency.
  - `checkProvider(providerId: string): Promise<boolean>`: checks if a provider is healthy. Likely uses the health checker if set, or internal state.
  - `getStats()`: returns some stats object (likely including provider statuses, latencies, etc.).
  - `resetAll(): void`: resets all state.
- `providerFailover` is a singleton instance exported.

Wait, the constructor signature is incomplete: `constructor(` - no parameters shown. But since there's a singleton `providerFailover` exported, and `setHealthChecker` exists, maybe the constructor takes no args or some config. Since I don't know, I should probably instantiate the class directly in tests, or use the singleton? The export includes both the class and a singleton instance. To test properly, I should probably instantiate the class to have isolated state, but if the constructor requires unknown arguments, that's risky. However, the singleton is exported, so I can test that, but tests need isolation. The `resetAll()` method helps with isolation.

Actually, looking at the API: `constructor(` is cut off. It might take `ProviderConfig[]` or something. But since I don't know, I should avoid guessing constructor args if possible. However, the exported singleton `providerFailover` is available. But using a singleton across tests is bad practice unless `resetAll()` truly resets everything. I can test the singleton but call `resetAll()` in `beforeEach`. Or I can try `new ProviderFailover()` with no args if the signature allows. Since it's cut off, maybe it takes no args, or optional args. I'll use the exported singleton to be safe, as it's guaranteed to exist without constructor arguments.

Wait, the import is `import ... from '../src/services/providerFailover';`. I need to import the specific items. I'll import `ProviderFailover`, `providerFailover`, `HealthCheckFn`, etc. as needed.

Let's infer contracts:

1. `setHealthChecker(fn)`:
   - Should set the health checker function used by `checkProvider`.
   - If not set, `checkProvider` might return false or throw? Probably returns false or uses internal state only.
   - Contract: after setting, `checkProvider` should use this function.

2. `selectProvider(_task?)`:
   - Should return a provider ID string.
   - Should prefer healthy providers.
   - If multiple healthy, maybe lowest latency? The existence of `latencyMs` in `markHealthy` and `HealthCheckFn` suggests latency-aware selection.
   - If no providers are known/healthy, should throw an error (no available provider).
   - If called with a task, might select based on task affinity, but since we don't know, we test that it returns a string and throws when none available.

3. `markFailed(providerId)`:
   - Should mark the provider as unhealthy/failed.
   - After marking, `selectProvider` should not return this provider (unless it's the only one? No, probably excludes it).
   - `getStats()` should reflect the failed status.

4. `markHealthy(providerId, latencyMs)`:
   - Should mark the provider as healthy with given latency.
   - `selectProvider` should consider this provider.
   - `getStats()` should reflect health and latency.

5. `checkProvider(providerId)`:
   - Should return a boolean indicating health.
   - If health checker is set, it should call it and return its result.
   - If health checker throws, it should probably return false or throw? Contractually, it returns boolean, so likely catches errors and returns false.
   - Should update internal state? Probably yes.

6. `getStats()`:
   - Should return an object with provider statistics.
   - Should include all known providers or configured ones.
   - Values should reflect current state.

7. `resetAll()`:
   - Should reset all internal state to initial.
   - After reset, `getStats()` should return empty/default state.
   - `selectProvider` should throw (no providers).

Since I don't know the exact shape of `ProviderStatus` or `ProviderConfig`, I need to infer from usage or keep assertions generic where possible. But the user wants strict TS and asserting values. I need to make reasonable assumptions about the structure.

Assumptions:
- `ProviderStatus` likely has fields like `providerId`, `healthy`, `latencyMs`, `failCount`, etc.
- `getStats()` likely returns `{ providers: ProviderStatus[] }` or a map. I'll assume it returns an object with provider statuses keyed by ID or in an array. To be safe, I'll assert on the structure partially.

Wait, the prompt says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So I need to be specific.

Let's think about how the module might be used. It's a failover provider selector. You have multiple providers. You mark them healthy or failed. You select one for a task. You can check them via an external health check function.

Since the constructor is unknown, maybe the class is meant to be used with the singleton, or maybe it takes an array of provider IDs. But since we don't know, and there's a singleton, I'll test the singleton `providerFailover` and rely on `resetAll()` for isolation. However, if the singleton is imported and used, its state persists. So `beforeEach(() => providerFailover.resetAll())` is essential.

But what if the singleton is pre-configured with some providers? We don't know. Maybe `getStats()` returns empty initially. Let's assume that.

Let's draft the test structure:

```typescript
import { ProviderFailover, providerFailover, HealthCheckFn } from '../src/services/providerFailover';

describe('ProviderFailover', () => {
  beforeEach(() => {
    providerFailover.resetAll();
  });

  describe('selectProvider', () => {
    it('should throw when no providers are healthy/available', async () => {
      await expect(providerFailover.selectProvider()).rejects.toThrow();
    });

    it('should return the only healthy provider', async () => {
      await providerFailover.markHealthy('provider-a', 100);
      const id = await providerFailover.selectProvider();
      expect(id).toBe('provider-a');
    });

    it('should return the provider with lowest latency when multiple are healthy', async () => {
      await providerFailover.markHealthy('provider-a', 200);
      await providerFailover.markHealthy('provider-b', 50);
      const id = await providerFailover.selectProvider();
      expect(id).toBe('provider-b');
    });

    it('should not return a failed provider', async () => {
      await providerFailover.markHealthy('provider-a', 100);
      await providerFailover.markFailed('provider-a');
      await expect(providerFailover.selectProvider()).rejects.toThrow();
    });
  });

  describe('markFailed', () => {
    it('should mark a provider as failed and reflect in stats', async () => {
      await providerFailover.markHealthy('p1', 100);
      await providerFailover.markFailed('p1');
      const stats = providerFailover.getStats();
      // Assuming stats.providers is an array or map
      expect(stats.providers['p1'].healthy).toBe(false);
    });
  });

  describe('markHealthy', () => {
    it('should mark a provider as healthy with given latency', async () => {
      await providerFailover.markHealthy('p1', 150);
      const stats = providerFailover.getStats();
      expect(stats.providers['p1'].healthy).toBe(true);
      expect(stats.providers['p1'].latencyMs).toBe(150);
    });
  });

  describe('checkProvider', () => {
    it('should return false for unknown/uninitialized provider when no health checker set', async () => {
      const result = await providerFailover.checkProvider('unknown');
      expect(result).toBe(false);
    });

    it('should use the configured health checker and return its healthy status', async () => {
      const mockChecker: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: true, latencyMs: 80 });
      providerFailover.setHealthChecker(mockChecker);
      const result = await providerFailover.checkProvider('p1');
      expect(result).toBe(true);
      expect(mockChecker).toHaveBeenCalledWith('p1');
    });

    it('should return false and mark provider failed when health checker throws', async () => {
      const mockChecker: HealthCheckFn = jest.fn().mockRejectedValue(new Error('Network timeout'));
      providerFailover.setHealthChecker(mockChecker);
      const result = await providerFailover.checkProvider('p1');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return empty/default stats after reset', () => {
      providerFailover.resetAll();
      const stats = providerFailover.getStats();
      expect(stats).toEqual({ providers: {} }); // or whatever structure
    });
  });

  describe('resetAll', () => {
    it('should clear all provider state', async () => {
      await providerFailover.markHealthy('p1', 100);
      providerFailover.resetAll();
      await expect(providerFailover.selectProvider()).rejects.toThrow();
      const stats = providerFailover.getStats();
      expect(stats).toEqual({ providers: {} });
    });
  });
});
```

But I need to be careful: I don't know the exact shape of `getStats()` return. The signature is `public getStats(): {` which is cut off. It likely returns an object. I should make assertions that are robust but still value-based.

Maybe `getStats()` returns something like:
```typescript
{
  providers: Record<string, ProviderStatus>;
}
```
Or maybe it returns `ProviderStatus[]`.

Given the method name `getStats` and the class name `ProviderFailover`, it's likely an object containing provider statuses. I'll assume a structure, but to be safe, I can assert on specific properties if I know them, or use `toMatchObject` which is a bit flexible.

Wait, the prompt says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So `toMatchObject` is acceptable? It's still asserting values. I'll use `toEqual` where possible.

However, since I don't know the exact internal structure, I need to infer from standard patterns. Let's look at the names:
- `ProviderStatus` interface: likely has `healthy: boolean`, `latencyMs: number`, maybe `lastChecked: number`, `failCount: number`.
- `ProviderConfig` interface: maybe used in constructor, but we don't see constructor args.

Since the constructor is not fully visible, and we have a singleton, I'll test the singleton. But what if the singleton is already configured with providers? Then `selectProvider` might not throw initially. But `resetAll()` should clear everything. So after `resetAll()`, it should throw.

Let's refine the contracts:

**Contract for `resetAll`**:
- After `resetAll()`, `getStats()` returns an empty/default state.
- `selectProvider()` throws because no providers are available.

**Contract for `markHealthy(providerId, latencyMs)`**:
- Provider becomes available for selection.
- `getStats()` reflects `healthy: true` and the exact `latencyMs`.
- If called multiple times, updates latency.

**Contract for `markFailed(providerId)`**:
- Provider becomes unavailable for selection.
- `getStats()` reflects `healthy: false`.
- If provider was previously unknown, it becomes known but failed.

**Contract for `selectProvider(task?)`**:
- Returns a `string` (providerId).
- If no healthy providers exist, throws an Error.
- If multiple healthy providers exist, selects the one with lowest latency (implied by the presence of latency in health checks and markHealthy).
- Ignores failed/unhealthy providers.
- Optional `_task` parameter doesn't change the fundamental contract that it returns a string or throws.

**Contract for `checkProvider(providerId)`**:
- Returns `boolean`.
- If no `HealthCheckFn` is set, returns based on last known state? Or false? Likely false for unknown, true for recently marked healthy? But the presence of `setHealthChecker` suggests that without it, `checkProvider` might just return the cached state. If no state, false.
- If `HealthCheckFn` is set, it calls it. If the checker returns `healthy: true`, returns true and likely updates internal latency. If checker returns `healthy: false`, returns false. If checker throws, returns false (graceful degradation).

**Contract for `setHealthChecker(fn)`**:
- Sets the function to be used by `checkProvider`.
- Future calls to `checkProvider` invoke this function.
- The function receives the `providerId` string.

**Contract for `getStats()`**:
- Returns an object describing current state.
- Contains information about all known providers.
- Reflects changes made via `markHealthy`, `markFailed`, `checkProvider`.

Given the strict TS requirement, I need to type the mocks and variables.

Let's assume `getStats()` returns `{ providers: Record<string, ProviderStatus> }` where `ProviderStatus` has at least `healthy` and `latencyMs`. This is a reasonable assumption for a failover module.

Alternatively, `getStats()` might return `Map<string, ProviderStatus>` or an array. I'll go with `Record<string, ProviderStatus>` as it's most common for stats objects.

Wait, what if `ProviderStatus` is something like:
```typescript
interface ProviderStatus {
  id: string;
  healthy: boolean;
  latencyMs: number;
  failCount: number;
}
```
And `getStats()` returns `{ providers: ProviderStatus[] }`? I'll write tests that are somewhat agnostic but still assert values. I can use `expect.objectContaining`? The prompt says "Assert VALUES/STATE (toBe/toEqual/toThrow)". `toEqual` with `expect.objectContaining` is still asserting values. But to be strict, maybe I should assert the whole object.

Actually, since I don't know the exact shape, I should focus on the relationships between operations rather than the exact schema. For example:
- After `markHealthy('p1', 100)`, `selectProvider()` returns `'p1'`.
- After `markFailed('p1')`, `selectProvider()` throws.
- `checkProvider('p1')` returns true after `markHealthy`, false after `markFailed`.

This avoids guessing the stats shape too much. But `getStats()` is part of the public API, so I must test it. I'll assert that `getStats()` returns an object that contains the provider data. I'll assume `getStats().providers` is a record.

Let's write the test file carefully.

One issue: using the singleton `providerFailover` across tests. If tests run in parallel, they might interfere. Jest runs tests in a single file serially by default, so `beforeEach` with `resetAll()` is safe.

Another issue: the constructor. If I want to test the class directly, I might need to pass arguments. Since I don't know them, I'll stick to the singleton. But the class is exported. I could test that `new ProviderFailover()` works if constructor takes no args. But I don't know. I'll avoid instantiating the class directly and test the singleton, which is part of the public API.

Wait, the prompt says "Import EXACTLY: import ... from '../src/services/providerFailover';". It doesn't say I must use the singleton. I can import both. I'll use the singleton for simplicity.

Let's think about edge cases:
- `markHealthy` with `latencyMs = 0`: should be valid.
- `markHealthy` with negative `latencyMs`? Probably still sets it, or maybe throws? The signature doesn't suggest validation, but contractually it should store the value. I'll test that it stores exactly.
- `markFailed` on unknown provider: should probably register it as failed.
- `selectProvider` with task string: should still return a string. I'll test that it accepts the argument and returns a provider.

Let's draft the code:

```typescript
import { ProviderFailover, providerFailover, HealthCheckFn } from '../src/services/providerFailover';

describe('ProviderFailover contract', () => {
  beforeEach(() => {
    providerFailover.resetAll();
  });

  describe('resetAll', () => {
    it('should return empty stats and no selectable providers after reset', async () => {
      await providerFailover.markHealthy('p1', 100);
      providerFailover.resetAll();
      const stats = providerFailover.getStats();
      expect(stats).toEqual({ providers: {} });
      await expect(providerFailover.selectProvider()).rejects.toThrow();
    });
  });

  describe('markHealthy', () => {
    it('should register a provider as healthy with exact latency', () => {
      // Actually markHealthy is async
    });
  });
});
```

Wait, `markHealthy` is async. So I need `await`.

Let's write it out fully.

```typescript
import { ProviderFailover, providerFailover, HealthCheckFn } from '../src/services/providerFailover';

describe('ProviderFailover', () => {
  beforeEach(async () => {
    providerFailover.resetAll();
  });

  describe('selectProvider', () => {
    it('throws when no providers are healthy', async () => {
      await expect(providerFailover.selectProvider()).rejects.toThrow();
      await expect(providerFailover.selectProvider('task-1')).rejects.toThrow();
    });

    it('returns the only healthy provider', async () => {
      await providerFailover.markHealthy('alpha', 100);
      await expect(providerFailover.selectProvider()).resolves.toBe('alpha');
    });

    it('selects the provider with lowest latency among healthy ones', async () => {
      await providerFailover.markHealthy('slow', 500);
      await providerFailover.markHealthy('fast', 10);
      await providerFailover.markHealthy('medium', 100);
      const id = await providerFailover.selectProvider();
      expect(id).toBe('fast');
    });

    it('excludes providers marked as failed', async () => {
      await providerFailover.markHealthy('good', 50);
      await providerFailover.markHealthy('bad', 20);
      await providerFailover.markFailed('bad');
      const id = await providerFailover.selectProvider();
      expect(id).toBe('good');
    });

    it('throws when all known providers have been marked failed', async () => {
      await providerFailover.markHealthy('p1', 50);
      await providerFailover.markFailed('p1');
      await expect(providerFailover.selectProvider()).rejects.toThrow();
    });
  });

  describe('markHealthy', () => {
    it('reflects exact latency and health in stats', async () => {
      await providerFailover.markHealthy('p1', 123);
      const stats = providerFailover.getStats();
      expect(stats.providers['p1']).toEqual(expect.objectContaining({
        healthy: true,
        latencyMs: 123,
      }));
    });

    it('updates latency on subsequent calls', async () => {
      await providerFailover.markHealthy('p1', 100);
      await providerFailover.markHealthy('p1', 200);
      const stats = providerFailover.getStats();
      expect(stats.providers['p1'].latencyMs).toBe(200);
    });
  });

  describe('markFailed', () => {
    it('marks a previously healthy provider as unhealthy in stats', async () => {
      await providerFailover.markHealthy('p1', 100);
      await providerFailover.markFailed('p1');
      const stats = providerFailover.getStats();
      expect(stats.providers['p1']).toEqual(expect.objectContaining({
        healthy: false,
      }));
    });

    it('registers an unknown provider as failed', async () => {
      await providerFailover.markFailed('unknown-p');
      const stats = providerFailover.getStats();
      expect(stats.providers['unknown-p']).toEqual(expect.objectContaining({
        healthy: false,
      }));
    });
  });

  describe('checkProvider', () => {
    it('returns false for unknown provider when no health checker is set', async () => {
      const result = await providerFailover.checkProvider('unknown');
      expect(result).toBe(false);
    });

    it('returns true when health checker reports healthy', async () => {
      const checker: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: true, latencyMs: 42 });
      providerFailover.setHealthChecker(checker);
      const result = await providerFailover.checkProvider('p1');
      expect(result).toBe(true);
      expect(checker).toHaveBeenCalledWith('p1');
    });

    it('returns false when health checker reports unhealthy', async () => {
      const checker: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: false, latencyMs: 999 });
      providerFailover.setHealthChecker(checker);
      const result = await providerFailover.checkProvider('p1');
      expect(result).toBe(false);
    });

    it('returns false when health checker throws', async () => {
      const checker: HealthCheckFn = jest.fn().mockRejectedValue(new Error('timeout'));
      providerFailover.setHealthChecker(checker);
      const result = await providerFailover.checkProvider('p1');
      expect(result).toBe(false);
    });

    it('updates stats with latency from successful health check', async () => {
      const checker: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: true, latencyMs: 77 });
      providerFailover.setHealthChecker(checker);
      await providerFailover.checkProvider('p1');
      const stats = providerFailover.getStats();
      expect(stats.providers['p1']).toEqual(expect.objectContaining({
        healthy: true,
        latencyMs: 77,
      }));
    });
  });

  describe('setHealthChecker', () => {
    it('replaces previous health checker behavior', async () => {
      const first: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: true, latencyMs: 1 });
      const second: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: false, latencyMs: 2 });
      providerFailover.setHealthChecker(first);
      await providerFailover.checkProvider('p1');
      providerFailover.setHealthChecker(second);
      const result = await providerFailover.checkProvider('p1');
      expect(result).toBe(false);
      expect(second).toHaveBeenCalledWith('p1');
      expect(first).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('returns consistent snapshot of all known providers', async () => {
      await providerFailover.markHealthy('a', 10);
      await providerFailover.markFailed('b');
      const stats = providerFailover.getStats();
      expect(Object.keys(stats.providers)).toHaveLength(2);
      expect(stats.providers['a'].healthy).toBe(true);
      expect(stats.providers['b'].healthy).toBe(false);
    });
  });
});
```

This looks solid. But I need to ensure TypeScript strictness. `stats.providers['p1']` assumes `providers` is a Record. If it's an array, this will fail. But given the API, a Record keyed by providerId is standard. Alternatively, I could avoid deep property access on `stats` and instead test `getStats()` indirectly via `selectProvider` and `checkProvider`. However, `getStats()` is a public method, so it must be tested directly.

To mitigate the risk of wrong shape assumption, I can use a helper or type assertion? No, I should just write the test as if `getStats()` returns `{ providers: Record<string, ProviderStatus> }`. If the actual implementation differs, the test would fail, but that's the point of contract testing — we define the expected contract. The user asked for a contract test based on signatures and names.

Wait, the prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS." The only external dep here is the `HealthCheckFn` which we mock via Jest. That's fine.

One more thing: `ProviderStatus` and `ProviderConfig` are exported interfaces. I might need to import them for typing, but not necessarily. The prompt says import exactly from that path. I can import them if needed.

Let's check if `beforeEach` should be async. `resetAll` is sync (`void`). So `beforeEach(() => providerFailover.resetAll())` is fine.

Also, `markHealthy` and `markFailed` are async. I need to await them.

Let's refine the `getStats` assertions to be more robust. Instead of `stats.providers['p1']`, maybe the return type is `Map<string, ProviderStatus>`? Unlikely for a plain JS/TS API, usually plain objects. I'll stick with record.

What about `ProviderConfig`? It's exported but not used in any method signature shown (except maybe constructor). Since constructor is cut off, I won't use it.

Let's consider if `selectProvider` should throw a specific error type or message. We don't know, so `.rejects.toThrow()` is sufficient (any error).

Should I test boundary condition `latencyMs = 0`? Yes.

```typescript
it('handles zero latency', async () => {
  await providerFailover.markHealthy('zero', 0);
  const stats = providerFailover.getStats();
  expect(stats.providers['zero'].latencyMs).toBe(0);
  expect(await providerFailover.selectProvider()).toBe('zero');
});
```

Also test that `markFailed` on an already failed provider doesn't break anything.

```typescript
it('idempotently marks failed', async () => {
  await providerFailover.markFailed('p1');
  await providerFailover.markFailed('p1');
  const stats = providerFailover.getStats();
  expect(stats.providers['p1'].healthy).toBe(false);
});
```

And `selectProvider` after `checkProvider` with a healthy result should make it selectable.

```typescript
it('can select provider after checkProvider marks it healthy', async () => {
  const checker: HealthCheckFn = jest.fn().mockResolvedValue({ healthy: true, latencyMs: 10 });
  providerFailover.setHealthChecker(checker);
  await providerFailover.checkProvider('p1');
  const id = await providerFailover.selectProvider();
  expect(id).toBe('p1');
});
```

This is a good contract test.

Now, about the import: `import { ProviderFailover, providerFailover, HealthCheckFn } from '../src/services/providerFailover';`. I should include `ProviderStatus` or `ProviderConfig` only if needed for typing. Since I don't know their shape, I might not need to import them. But to be thorough, I can import `ProviderStatus` to type the stats variable if I destructure. Actually, I can just let TS infer.

Let's write the final code. I need to ensure it's a single typescript block and nothing else.

One concern: if `getStats()` returns something like `{ total: number, healthy: number, providers: ProviderStatus[] }`, my `stats.providers['p1']` would fail. How to make it more generic? I could assert using `toMatchObject` on the whole stats, but I still need to know the shape.

Given the name `ProviderStatus` (singular) and `getStats` (plural), it's likely `getStats()` returns an aggregate. But without knowing, I'll assume `providers` is a record. This is the best I can do.

Alternatively, I can avoid deep `getStats` structure assertions and instead use `getStats()` to verify counts or presence, but still assert values. For example:
```typescript
const stats = providerFailover.getStats();
const p1 = Object.values(stats.providers).find(p => p.id === 'p1');
expect(p1).toBeDefined();
expect(p1!.healthy).toBe(true);
```
But if it's a record, `Object.values` works. If it's an array, `find` works. This is more robust! I can write:
```typescript
const stats = providerFailover.getStats();
const providers = Array.isArray(stats.providers) 
  ? stats.providers 
  : Object.values(stats.providers);
const p1 = providers.find((p: any) => p.id === 'p1' || p.providerId === 'p1');
```
But that's too loose and not strict TS. Better to assume a shape. The prompt says "Strict TS". So I should type it.

Let's assume:
```typescript
interface ProviderStatus {
  providerId: string;
  healthy: boolean;
  latencyMs: number;
}
```
And `getStats()` returns `{ providers: Record<string, ProviderStatus> }`.

Actually, looking at the API again:
```typescript
export interface ProviderStatus {
interface ProviderConfig {
export type HealthCheckFn = ...
export class ProviderFailover {
  constructor(
  public setHealthChecker(fn: HealthCheckFn): void {
  public async selectProvider(_task?: string): Promise<string> {
  public async markFailed(providerId: string): Promise<void> {
  public async markHealthy(providerId: string, latencyMs: number): Promise<void> {
  public async checkProvider(providerId: string): Promise<boolean> {
  public getStats(): {
  public resetAll(): void {
export const providerFailover = new ProviderFailover();
```

The `getStats(): {` suggests the return type is an inline type literal, not a named interface. It might be something like:
```typescript
public getStats(): { providers: ProviderStatus[] } {
```
or
```typescript
public getStats(): Record<string, ProviderStatus> {
```
or
```typescript
public getStats(): { [id: string]: ProviderStatus } {
```

Given the opening brace `{`, it's likely an object literal type. I'll assume `{ providers: ProviderStatus[] }` or `{ providers: Record<string, ProviderStatus> }`. The array form is more likely if it's a list of statuses. But the record form is easier to test.

If it's an array:
```typescript
const stats = providerFailover.getStats();
const p1 = stats.providers.find(p => p.providerId === 'p1');
expect(p1).toBeDefined();
expect(p1!.healthy).toBe(true);
```

This is safer and works for both array and record if I use `find`, but `find` doesn't exist on Record values. However, I can normalize:
```typescript
const providers = Array.isArray(stats.providers) ? stats.providers : Object.values(stats.providers);
const p1 = providers.find((p: ProviderStatus) => p.providerId === 'p1');
```
But `ProviderStatus` interface is empty in the prompt (just `export interface ProviderStatus {`). So I don't know if it has `providerId`. It might just be the status without ID, and the key is the ID in a record.

Given `export interface ProviderStatus {` with no content shown, it's likely the content was cut off. But the name implies it represents the status of a provider. If `getStats()` returns a collection, the ID could be inside `ProviderStatus` or the key.

I think the most standard pattern is:
```typescript
getStats(): { providers: Map<string, ProviderStatus> } // no, Map is less common in plain objects
```
or
```typescript
getStats(): ProviderStatus[] // but the `{` suggests object
```
or
```typescript
getStats(): { [providerId: string]: ProviderStatus }
```

I'll go with `Record<string, ProviderStatus>` and assume `ProviderStatus` has `healthy` and `latencyMs`. If the test fails due to shape mismatch, that's acceptable because this is a contract test — the contract I'm specifying is that `getStats()` returns an object with provider IDs as keys and status objects containing `healthy` and `latencyMs`. This is a reasonable contract inferred from the API.

Let's
