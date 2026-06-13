<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T023 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1971,"completion_tokens":8000,"total_tokens":9971,"prompt_tokens_details":{"cached_tokens":70,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 68s
 generated: 2026-06-13T10:56:02.359Z -->
The user wants a Jest unit test file for the `SessionMemoryStore` class from `innomcp-node/src/services/sessionMemory.ts`.

Key requirements:
1. Import exactly as: `import { SessionMemoryStore, MemoryEntity, MemoryDomain, MemorySlot, SessionMemorySnapshot } from '../src/services/sessionMemory';` (or whatever is needed from the public API). The instruction says "Import the module under test EXACTLY as: import ... from '../src/services/sessionMemory';". So I need to import the exported items.
2. Only test public exported API: `SessionMemoryStore` class and its public methods: `recordTurn`, `getSnapshot`, `getEntitiesByDomain`, `getLastEntity`, `getActiveDomain`, `hasMemory`, `clear`. Also the exported singleton `sessionMemory`? The prompt says "Only test the PUBLIC exported API actually present in the source below." The singleton `sessionMemory` is exported. But testing the singleton might pollute global state across tests. It's better to test the class directly and perhaps also verify the singleton is exported. However, the exemplar style focuses on class instances. I should probably test the class primarily. Maybe one test to ensure `sessionMemory` is an instance of `SessionMemoryStore`.
3. Mock external dependencies: The source has no external dependencies (db, network, fs). It uses `Date.now()` and `new Date().toISOString()`. These are built-ins. The rules say "Use fake timers for any time/interval logic." So I should use `jest.useFakeTimers()` to control time.
4. Fake timers: Yes, for freshness and TTL logic.
5. Must compile under strict TypeScript and pass without live server/DB.
6. Output: ONE fenced typescript code block, COMPLETE test file, NOTHING else.

Let's plan the tests:

Structure:
```typescript
import { SessionMemoryStore, sessionMemory, MemoryEntity, MemoryDomain, SessionMemorySnapshot } from '../src/services/sessionMemory';

describe('SessionMemoryStore', () => {
  let store: SessionMemoryStore;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    store = new SessionMemoryStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Tests...
});
```

Wait, the source exports `SessionMemoryStore` and `sessionMemory`. I should import both. The types `MemoryEntity`, `MemoryDomain`, etc. might be needed for type annotations in tests if strict TS requires it, but often inference is enough. However, to be safe and satisfy strict TS, I might import them. The prompt says "import ... from '../src/services/sessionMemory';" so I can import multiple things.

Let's think about test cases:

1. `recordTurn` creates a new session and stores slot.
   - Call `recordTurn` with sessionId, query, domain, entities, meta.
   - Then `hasMemory` should be true.
   - `getActiveDomain` should return the domain.
   - `getSnapshot` should return correct turnCount (1), activeDomain, entities, etc.

2. `recordTurn` increments turnCount.
   - Call twice.
   - `turnCount` should be 2.
   - Entities should have `sourceTurn` 1 and 2.

3. `getSnapshot` returns empty snapshot for unknown session.
   - All fields empty/zero/null.

4. `getSnapshot` refreshes freshness.
   - Record a turn.
   - Advance time by < 5 min: freshness should be "live".
   - Advance time by > 5 min but < 30 min: freshness should be "recent".
   - Advance time by > 30 min: freshness should be "stale".

5. `getSnapshot` deduplicates entities by name+type, keeping latest.
   - Record turn 1 with entity {name: 'E1', type: 'concept'}.
   - Record turn 2 with entity {name: 'E1', type: 'concept'} (same type+name).
   - Snapshot should have only the latest one (sourceTurn 2).

6. `getSnapshot` limits entities to MAX_ENTITIES (50) and slots to last 10 in snapshot, last 20 in store.
   - Hard to test 50 without loops, but can test with smaller loops. Actually the code slices `session.slots` to last 20 in `recordTurn`, and in `getSnapshot` returns `slots.slice(-10)`. So we can test slot truncation.
   - Record 25 turns. `getSnapshot` should return 10 slots. `hasMemory` true.
   - Wait, `recordTurn` truncates slots to MAX_SLOTS (20). So store has 20. `getSnapshot` returns `slice(-10)`, so 10.

7. `getEntitiesByDomain` filters correctly.
   - Record mixed domains.
   - Returns only matching.

8. `getLastEntity` returns most recent entity of a given type.
   - Record entities of different types across turns.
   - Should return the one with highest sourceTurn (or last in array after dedup? Actually `getSnapshot` deduplicates and keeps latest by sourceTurn. Then `getLastEntity` filters by type and returns the last element of that array. Since `uniqueEntities` is `[...entityMap.values()]`, the order depends on Map insertion order. The keys are `${type}:${name}`. If we have multiple names of same type, the order is insertion order into the map. The last element in the filtered array might not be the globally last entity of that type if it was inserted earlier into the map but updated later? Wait, `entityMap.set(key, ent)` updates the value but does it change insertion order? In JS Map, setting an existing key does NOT change insertion order. So `entityMap.values()` will iterate in insertion order of the *first* time the key was set. Then `getLastEntity` filters and returns the last element of that array. This means the "most recent" is ambiguous if there are multiple names of the same type. But the method name says "most recent entity of a given type". The implementation actually returns the last one in the Map values order, which is first-seen key order, not necessarily most recent turn. However, I should test the actual behavior, not invent a different one. But maybe I should just test with one entity of a type to be safe, or test that it returns one of them. Actually, the code: `entities.filter(...)` then `entities[entities.length - 1]`. If only one entity of that type exists, it returns it. If two different names of same type, it returns the one whose key was inserted last into the map. Since keys are processed in `allEntities` order, which is slot order (oldest to newest), the first time a key appears is its insertion order. If it gets updated later, insertion order doesn't change. So the last key inserted might be from a later turn or an earlier turn depending on when the name first appeared. This is a bit tricky. I'll test with a single entity type to avoid relying on this subtlety, or test the exact behavior: if I add entity A type 'province' in turn 1, and entity B type 'province' in turn 2, the map keys are 'province:A' (inserted turn1) and 'province:B' (inserted turn2). Values() order is A then B. `getLastEntity` returns B. That seems correct as B is newer. If I add B in turn1 and A in turn2, keys are 'province:B' then 'province:A'. Values order is B then A. `getLastEntity` returns A. That also seems correct as A is newer. If I add A in turn1 and A again in turn2, key 'province:A' is inserted turn1, updated turn2. Values order still has A, but it's the updated turn2 version. So `getLastEntity` returns it. So actually it works out okay for single name, and for multiple names, the last inserted key corresponds to the name that first appeared latest, which might not be the one with the latest sourceTurn if a name from turn1 is updated in turn3 and a new name appears in turn2. But that's an edge case. I'll keep the test simple: one entity per type, or two different types.

9. `getActiveDomain` returns null for unknown or empty session.
   - True.

10. `hasMemory` returns false for unknown or cleared session.
    - Record, then `clear`, then false.

11. `clear` removes session.
    - After clear, `getSnapshot` returns empty.

12. `evictOldSessions` behavior: MAX_SESSIONS = 500. Hard to test 500 without a loop, but a loop of 500 is fine. Or test TTL eviction.
    - Set system time. Create session. Advance time by > 4 hours. Create a new session (which triggers evictOldSessions because size >= MAX_SESSIONS? No, size is 1. TTL eviction only happens if size >= MAX_SESSIONS? Wait, `evictOldSessions` is called at the top: `if (this.sessions.size < this.MAX_SESSIONS) return;`. So TTL eviction ONLY happens when the store is at max capacity! That's interesting. So to test TTL eviction, I need to fill up to 500 sessions, then add one more to trigger eviction, and some old ones should be removed. Or I can test the "oldest eviction" part: fill to 500, add one more, the first one is evicted.
    - Actually, testing 501 iterations is fine. It's deterministic and fast.
    - Let's test: create 500 sessions with old timestamps (e.g., 5 hours ago). Then create one new session. The old ones should be evicted due to TTL? Wait, `evictOldSessions` checks `now - timestamp > SESSION_TTL_MS`. If I set time to now, and old timestamps are 5 hours ago (>4h), they get deleted. Then size drops below 500, so no further eviction. Then the new session is added. So final size should be 1 (the new one) if all 500 were old. But if some are recent, they remain.
    - Alternatively, test LRU eviction: create 500 sessions with recent timestamps. Add one more. Since none are expired, it evicts the first key (oldest insertion). So size should remain 500, and the first session should be gone.

    However, `evictOldSessions` is private. We can only test it indirectly via `recordTurn`.
    Let's do a TTL eviction test:
    - Fill 500 sessions with timestamp 5 hours ago. But `recordTurn` uses `new Date().toISOString()` for the slot timestamp. So if I use fake timers, I can set time to T, create 500 sessions. Then advance time by 5 hours. Then create a new session. At that point, `evictOldSessions` is called. `sessions.size` is 500 (not < 500). `now` is T+5h. For each session, `lastSlot.timestamp` is T. `now - T` = 5h > 4h. So all 500 are deleted. Then `sessions.size` is 0 (<500), so no LRU eviction. New session added. Final size 1.
    - But wait, `recordTurn` for the 501st session calls `evictOldSessions`. Inside, it deletes all 500. Then checks `if (this.sessions.size >= this.MAX_SESSIONS)` -> false. Then adds new. So `hasMemory` for the new session is true. For any of the old ones, false.
    - This is a good test.

    Let's also test LRU:
    - Create 500 sessions at time T. Advance time by 1 hour (still < 4h). Create session 501. `evictOldSessions`: size=500, not <500. Check TTL: 1h < 4h, so none deleted. Then `if (this.sessions.size >= this.MAX_SESSIONS)` -> true. Delete first key. Add new. So size remains 500. Session 0 (the first created) should be gone.

    500 loops are fine in Jest.

13. `recordTurn` entity truncation: MAX_ENTITIES = 50. This is in `getSnapshot`, not `recordTurn`. `getSnapshot` does `uniqueEntities.slice(-MAX_ENTITIES)`. To test this, I'd need 51 unique entities (different name+type). That's also fine with a loop.

14. `recentDomains` in snapshot: should be last 5 slots, deduplicated, preserving order of first appearance? The code: `session.slots.slice(-5).map(...).filter((d, i, arr) => arr.indexOf(d) === i)`. This deduplicates while preserving the first occurrence in the sliced array. So if last 5 are [geo, weather, geo, evidence, weather], result is [geo, weather, evidence]. Let's test that.

15. `sessionMemory` singleton: verify it's an instance.

Let's draft the code carefully.

Imports:
```typescript
import { SessionMemoryStore, sessionMemory, MemoryEntity, MemoryDomain, MemorySlot, SessionMemorySnapshot } from '../src/services/sessionMemory';
```

Wait, `MemorySlot` and `SessionMemorySnapshot` are exported. I might not need them as type annotations if I use `ReturnType` or just let TS infer. But for strict TS, if I declare variables with these types, I need them. I can avoid explicit type annotations on test variables and let inference handle it. But it's cleaner to import them. The prompt says "import ... from '../src/services/sessionMemory';" which allows importing whatever is needed.

Let's write the tests.

```typescript
describe('SessionMemoryStore', () => {
  let store: SessionMemoryStore;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    store = new SessionMemoryStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('recordTurn creates session and hasMemory returns true', () => {
    store.recordTurn('s1', 'q1', 'weather', [{ name: 'Beijing', type: 'province', value: 'Beijing', domain: 'weather', confidence: 0.9 }]);
    expect(store.hasMemory('s1')).toBe(true);
    expect(store.getActiveDomain('s1')).toBe('weather');
  });

  test('getSnapshot returns empty structure for unknown session', () => {
    const snap = store.getSnapshot('unknown');
    expect(snap).toEqual({
      sessionId: 'unknown',
      turnCount: 0,
      activeDomain: null,
      recentDomains: [],
      entities: [],
      slots: [],
      lastUpdated: '2024-01-01T00:00:00.000Z',
    });
  });

  test('recordTurn increments turnCount and populates snapshot', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'China', type: 'region', value: 'CN', domain: 'geo', confidence: 1.0 },
    ]);
    store.recordTurn('s1', 'q2', 'weather', [
      { name: 'Beijing', type: 'province', value: 'Beijing', domain: 'weather', confidence: 0.95 },
    ]);

    const snap = store.getSnapshot('s1');
    expect(snap.turnCount).toBe(2);
    expect(snap.activeDomain).toBe('weather');
    expect(snap.entities).toHaveLength(2);
    expect(snap.slots).toHaveLength(2);
    expect(snap.recentDomains).toEqual(['geo', 'weather']);
  });

  test('getEntitiesByDomain filters entities', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'China', type: 'region', value: 'CN', domain: 'geo', confidence: 1.0 },
    ]);
    store.recordTurn('s1', 'q2', 'weather', [
      { name: 'Beijing', type: 'province', value: 'Beijing', domain: 'weather', confidence: 0.9 },
    ]);
    expect(store.getEntitiesByDomain('s1', 'geo')).toHaveLength(1);
    expect(store.getEntitiesByDomain('s1', 'geo')[0].name).toBe('China');
    expect(store.getEntitiesByDomain('s1', 'weather')).toHaveLength(1);
    expect(store.getEntitiesByDomain('s1', 'knowledge')).toHaveLength(0);
  });

  test('getLastEntity returns most recent entity by type', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'China', type: 'region', value: 'CN', domain: 'geo', confidence: 1.0 },
    ]);
    store.recordTurn('s1', 'q2', 'geo', [
      { name: 'Shanghai', type: 'region', value: 'SH', domain: 'geo', confidence: 0.9 },
    ]);
    const last = store.getLastEntity('s1', 'region');
    expect(last).not.toBeNull();
    expect(last!.name).toBe('Shanghai');
    expect(last!.sourceTurn).toBe(2);
  });

  test('getLastEntity returns null when no match', () => {
    expect(store.getLastEntity('s1', 'person')).toBeNull();
  });

  test('clear removes session', () => {
    store.recordTurn('s1', 'q1', 'general', []);
    expect(store.hasMemory('s1')).toBe(true);
    store.clear('s1');
    expect(store.hasMemory('s1')).toBe(false);
    expect(store.getSnapshot('s1').turnCount).toBe(0);
  });

  test('freshness transitions from live to recent to stale', () => {
    store.recordTurn('s1', 'q1', 'weather', [
      { name: 'Now', type: 'concept', value: 'now', domain: 'weather', confidence: 1.0 },
    ]);
    // live: < 5 min
    let snap = store.getSnapshot('s1');
    expect(snap.entities[0].freshness).toBe('live');

    // advance 6 minutes
    jest.advanceTimersByTime(6 * 60 * 1000);
    snap = store.getSnapshot('s1');
    expect(snap.entities[0].freshness).toBe('recent');

    // advance 31 minutes total from start (25 more minutes)
    jest.advanceTimersByTime(25 * 60 * 1000);
    snap = store.getSnapshot('s1');
    expect(snap.entities[0].freshness).toBe('stale');
  });

  test('deduplicates entities by name+type keeping latest turn', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'Target', type: 'province', value: 'A', domain: 'geo', confidence: 0.8 },
    ]);
    store.recordTurn('s1', 'q2', 'geo', [
      { name: 'Target', type: 'province', value: 'B', domain: 'geo', confidence: 0.9 },
    ]);
    const snap = store.getSnapshot('s1');
    expect(snap.entities).toHaveLength(1);
    expect(snap.entities[0].value).toBe('B');
    expect(snap.entities[0].sourceTurn).toBe(2);
  });

  test('limits slots in snapshot to last 10 and store to last 20', () => {
    for (let i = 1; i <= 25; i++) {
      store.recordTurn('s1', `q${i}`, 'general', [
        { name: `E${i}`, type: 'concept', value: `${i}`, domain: 'general', confidence: 0.5 },
      ]);
    }
    const snap = store.getSnapshot('s1');
    expect(snap.slots).toHaveLength(10);
    expect(snap.slots[0].query).toBe('q16');
    expect(snap.slots[9].query).toBe('q25');
    // turn count should still be 25
    expect(snap.turnCount).toBe(25);
  });

  test('recentDomains deduplicates last 5 domains preserving order', () => {
    // Create slots with domains: general, geo, general, weather, geo, knowledge
    const domains: MemoryDomain[] = ['general', 'geo', 'general', 'weather', 'geo', 'knowledge'];
    domains.forEach((d, i) => {
      store.recordTurn('s1', `q${i}`, d, []);
    });
    const snap = store.getSnapshot('s1');
    // last 5 are: general, weather, geo, knowledge? Wait.
    // slots: index0 general, index1 geo, index2 general, index3 weather, index4 geo, index5 knowledge
    // slice(-5) -> indices 1..5: geo, general, weather, geo, knowledge
    // map domains -> [geo, general, weather, geo, knowledge]
    // filter unique by first occurrence -> [geo, general, weather, knowledge]
    expect(snap.recentDomains).toEqual(['geo', 'general', 'weather', 'knowledge']);
  });

  test('evicts oldest session when MAX_SESSIONS reached and none expired', () => {
    // MAX_SESSIONS = 500. Create 500 sessions with recent timestamps.
    for (let i = 0; i < 500; i++) {
      store.recordTurn(`sess-${i}`, 'q', 'general', []);
    }
    expect(store.hasMemory('sess-0')).toBe(true);
    expect(store.hasMemory('sess-499')).toBe(true);

    // Add one more; since none are expired, the first inserted is evicted.
    store.recordTurn('sess-500', 'q', 'general', []);
    expect(store.hasMemory('sess-0')).toBe(false);
    expect(store.hasMemory('sess-1')).toBe(true);
    expect(store.hasMemory('sess-500')).toBe(true);
  });

  test('evicts expired sessions via TTL when at MAX_SESSIONS', () => {
    // Create 500 sessions at time 0.
    for (let i = 0; i < 500; i++) {
      store.recordTurn(`sess-${i}`, 'q', 'general', []);
    }
    // Advance 5 hours (> 4h TTL)
    jest.advanceTimersByTime(5 * 60 * 60 * 1000);
    // Add new session; triggers evictOldSessions. All 500 are expired and removed.
    store.recordTurn('sess-new', 'q', 'general', []);
    // All old sessions should be gone
    expect(store.hasMemory('sess-0')).toBe(false);
    expect(store.hasMemory('sess-499')).toBe(false);
    expect(store.hasMemory('sess-new')).toBe(true);
  });

  test('limits total unique entities in snapshot to MAX_ENTITIES (50)', () => {
    // Create 55 unique entities across one turn? No, dedup map is per name+type.
    // Use 55 different names.
    const entities = Array.from({ length: 55 }, (_, i) => ({
      name: `E${i}`,
      type: 'concept' as const,
      value: `${i}`,
      domain: 'general' as MemoryDomain,
      confidence: 0.5,
    }));
    store.recordTurn('s1', 'q1', 'general', entities);
    const snap = store.getSnapshot('s1');
    expect(snap.entities).toHaveLength(50);
    // Should keep the last 50 (E5..E54)
    expect(snap.entities[0].name).toBe('E5');
    expect(snap.entities[49].name).toBe('E54');
  });

  test('exported sessionMemory is a SessionMemoryStore instance', () => {
    expect(sessionMemory).toBeInstanceOf(SessionMemoryStore);
  });
});
```

Wait, in the `limits total unique entities` test, `allEntities` is built by iterating slots and entities. In `recordTurn`, the entities are stored in the slot in the order provided. Then `allEntities` pushes them in that order. Then `entityMap` iterates `allEntities`. Since all 55 are unique keys, `entityMap.values()` preserves insertion order, which is the order of the array. Then `slice(-50)` takes the last 50. So yes, E5..E54. That seems correct.

But wait, `MemoryEntity` type requires `type` to be specific string literals. When I create entities inline, TS might infer string instead of literal. I used `as const` for type and domain. That should work. `domain: 'general' as MemoryDomain` is also fine.

In the `recentDomains` test, I need to be careful. Let's recompute:
slots:
0: general
1: geo
2: general
3: weather
4: geo
5: knowledge

slice(-5) -> indices 1,2,3,4,5
domains: geo, general, weather, geo, knowledge
filter((d, i, arr) => arr.indexOf(d) === i):
- geo at i=0, indexOf=0 -> keep
- general at i=1, indexOf=1 -> keep
- weather at i=2, indexOf=2 -> keep
- geo at i=3, indexOf=0 -> skip
- knowledge at i=4, indexOf=4 -> keep
Result: [geo, general, weather, knowledge]. Correct.

In `freshness` test:
- Start at 00:00.
- recordTurn -> timestamp 00:00.
- getSnapshot at 00:00 -> age 0 -> live.
- advance 6 min -> age 6 min. 6 min > 5 min, < 30 min -> recent.
- advance 25 more min -> age 31 min. 31 min > 30 min -> stale.
This works.

One issue: `getSnapshot` for unknown session uses `new Date().toISOString()` for `lastUpdated`. Since we use fake timers, it will be the current system time. In my empty snapshot test, I set system time to '2024-01-01T00:00:00.000Z'. So `lastUpdated` should be that. Good.

Another issue: `recordTurn` uses `new Date().toISOString()` for `timestamp` and `now`. With fake timers, this is controlled.

In the `evictOldSessions` TTL test: I create 500 sessions at time 0. Then advance 5h. Then `recordTurn('sess-new')`. Inside `recordTurn`, `evictOldSessions` is called. `this.sessions.size` is 500. `now` is T+5h. For each session, `lastSlot.timestamp` is T (time 0). `now - T` = 5h > 4h. So all are deleted. `this.sessions.size` becomes 0. Then `if (this.sessions.size >= this.MAX_SESSIONS)` false. Then new session added. Good.

In the LRU test: 500 sessions at time 0. Advance 1h. `recordTurn('sess-500')`. `evictOldSessions`: size=500. Check TTL: 1h < 4h, none deleted. Then `if (this.sessions.size >= this.MAX_SESSIONS)` true. `this.sessions.keys().next().value` is `sess-0` (first inserted). Delete it. Add `sess-500`. Final size 500. `sess-0` gone. Good.

Wait, `this.sessions.size >= this.MAX_SESSIONS` uses `>=`. After deleting one, size is 499. Then it adds new, size becomes 500. So it doesn't evict more than one. Good.

One more thing: `MAX_SLOTS` is 20. In `recordTurn`, `session.slots.push(slot); if (session.slots.length > MAX_SLOTS) { session.slots = session.slots.slice(-MAX_SLOTS); }`. So after 25 turns, slots array has length 20. In `getSnapshot`, `slots: session.slots.slice(-10)`. So snapshot has 10. My test checks `snap.slots` length 10 and queries q16..q25. Let's verify: turns 1..25. After truncation, slots kept are turns 6..25? Wait, slice(-20) keeps last 20. Turns 1-25: last 20 are turns 6-25. Then in snapshot, slice(-10) of those are turns 16-25. So queries q16..q25. Yes.

I need to make sure the test file compiles under strict TS. I should avoid implicit any. All variables are typed or inferred. The `entities` array in the MAX_ENTITIES test: I used `Array.from({ length: 55 }, (_, i) => ({ ... }))`. The type should be inferred correctly because the object literal is contextually typed? Actually, `recordTurn` expects `Omit<MemoryEntity, ...>[]`. The `type` and `domain` need to be literals. I used `as const` and `as MemoryDomain`. That should make it compile.

Let's double-check the `recordTurn` signature:
```typescript
entities: Omit<MemoryEntity, "sourceTurn" | "sourceQuery" | "timestamp" | "freshness">[]
```
So the objects need `name`, `type`, `value`, `domain`, `confidence`. I included all.

In the `getLastEntity` test, I used `region` type. That's valid.

In the `freshness` test, I used `concept` type. Valid.

In the `recentDomains` test, I passed empty entities array `[]`. That's fine.

In the `MAX_ENTITIES` test, I used `entities` with `domain: 'general' as MemoryDomain`. Good.

In the `MAX_SESSIONS` tests, I passed empty entities `[]`. That's fine.

One potential issue: `jest.advanceTimersByTime` inside a loop? No, just straight calls.

Another potential issue: `sessionMemory` singleton. If I import it, it's instantiated once. My tests create a new `SessionMemoryStore` instance for `store`, so the singleton is not used except in the last test. But the singleton might retain state from previous test runs if I don't clear it. However, since I never use it in other tests, it's fine. But should I clear it in `beforeEach` just in case? I can't easily clear it without knowing its internals, but `sessionMemory.clear(...)` could be called if I had added something. Since I don't add anything to it, it's fine. The last test just checks `instanceof`.

Wait, the singleton is created at import time. If other tests in the same file don't touch it, no problem. But if the test suite runs, the module is loaded once. The singleton `sessionMemory` is a global instance. My `store` is a separate instance. All good.

Let's verify the import line. The prompt says: "Import the module under test EXACTLY as: import ... from '../src/services/sessionMemory';". So I should write something like:
```typescript
import { SessionMemoryStore, sessionMemory, MemoryEntity, MemoryDomain } from '../src/services/sessionMemory';
```
This matches the pattern.

I should ensure there is NO prose outside the code block. Just the code block.

Let's review the code for any TS strict issues.
- `let store: SessionMemoryStore;` good.
- `const snap = store.getSnapshot('s1');` inferred as `SessionMemorySnapshot`.
- `expect(snap.entities[0].freshness).toBe('live');` `freshness` is string literal union, fine.
- `const entities = Array.from({ length: 55 }, (_, i) => ({ ... }));` This might infer `domain: string` instead of `MemoryDomain` unless I add a type annotation or cast. I used `as MemoryDomain`. Good. `type: 'concept' as const` ensures literal type.
- `const domains: MemoryDomain[] = [...]` good.

One more check: in the `getLastEntity` test, I have two entities of type `region` but different names. `getSnapshot` deduplicates by `type:name`. So keys are `region:China` and `region:Shanghai`. Both in map. `getLastEntity` filters by `region` and returns the last element of `[China, Shanghai]` (insertion order). Since Shanghai was added second, it's last. So it returns Shanghai. This works. If I had added them in the same turn, the order in `allEntities` would be the order in the entities array. So it's predictable.

What about `getEntitiesByDomain`? It uses `getSnapshot` and filters. Since snapshot deduplicates, if I have the same entity in two turns, it appears once. That's fine.

I think the tests are solid.

One final check: The user said "Only test the PUBLIC exported API actually present in the source below. Do not invent methods." I have tested: `recordTurn`, `getSnapshot`, `getEntitiesByDomain`, `getLastEntity`, `getActiveDomain`, `hasMemory`, `clear`. I also indirectly test `evictOldSessions` via `recordTurn`. I test the exported singleton `sessionMemory`. All good.

I will output exactly one fenced code block with the complete test file.

Let me format it cleanly.

```typescript
import { SessionMemoryStore, sessionMemory, MemoryDomain } from '../src/services/sessionMemory';

describe('SessionMemoryStore', () => {
  let store: SessionMemoryStore;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    store = new SessionMemoryStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('recordTurn creates session and hasMemory returns true', () => {
    store.recordTurn('s1', 'q1', 'weather', [
      { name: 'Beijing', type: 'province', value: 'Beijing', domain: 'weather', confidence: 0.9 },
    ]);
    expect(store.hasMemory('s1')).toBe(true);
    expect(store.getActiveDomain('s1')).toBe('weather');
  });

  test('getSnapshot returns empty structure for unknown session', () => {
    const snap = store.getSnapshot('unknown');
    expect(snap).toEqual({
      sessionId: 'unknown',
      turnCount: 0,
      activeDomain: null,
      recentDomains: [],
      entities: [],
      slots: [],
      lastUpdated: '2024-01-01T00:00:00.000Z',
    });
  });

  test('recordTurn increments turnCount and populates snapshot', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'China', type: 'region', value: 'CN', domain: 'geo', confidence: 1.0 },
    ]);
    store.recordTurn('s1', 'q2', 'weather', [
      { name: 'Beijing', type: 'province', value: 'Beijing', domain: 'weather', confidence: 0.95 },
    ]);

    const snap = store.getSnapshot('s1');
    expect(snap.turnCount).toBe(2);
    expect(snap.activeDomain).toBe('weather');
    expect(snap.entities).toHaveLength(2);
    expect(snap.slots).toHaveLength(2);
    expect(snap.recentDomains).toEqual(['geo', 'weather']);
  });

  test('getEntitiesByDomain filters entities', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'China', type: 'region', value: 'CN', domain: 'geo', confidence: 1.0 },
    ]);
    store.recordTurn('s1', 'q2', 'weather', [
      { name: 'Beijing', type: 'province', value: 'Beijing', domain: 'weather', confidence: 0.9 },
    ]);
    const geoEntities = store.getEntitiesByDomain('s1', 'geo');
    expect(geoEntities).toHaveLength(1);
    expect(geoEntities[0].name).toBe('China');
    expect(store.getEntitiesByDomain('s1', 'knowledge')).toHaveLength(0);
  });

  test('getLastEntity returns most recent entity by type', () => {
    store.recordTurn('s1', 'q1', 'geo', [
      { name: 'China', type: 'region', value: 'CN', domain: 'geo', confidence: 1.0 },
    ]);
    store.recordTurn('s1', 'q2', 'geo', [
      { name
