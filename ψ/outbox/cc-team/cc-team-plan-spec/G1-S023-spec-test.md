<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S023 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":252,"completion_tokens":7000,"total_tokens":7252,"prompt_tokens_details":{"cached_tokens":71,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T11:26:13.369Z -->
The user wants a Jest contract/behavior test for a module called `sessionMemory`. I only have the public API surface (signatures/names), not the implementation. I need to infer the intended behavior from the names and signatures.

Given exports:
- `MemoryEntity` interface
- `MemoryDomain` type (union of specific strings)
- `MemorySlot` interface
- `SessionMemorySnapshot` interface
- `SessionMemoryStore` class
- `sessionMemory` singleton instance

From the names:
- `SessionMemoryStore` likely manages memory/entities for a session.
- `MemoryDomain` suggests categorization.
- `MemorySlot` probably holds a domain and entities or data.
- `SessionMemorySnapshot` probably represents a point-in-time capture of the store's state.
- Methods I'd expect on `SessionMemoryStore` based on typical patterns for a memory store:
  - `add(domain, entity)` or `remember(domain, entity)`
  - `get(domain)` or `recall(domain)`
  - `getSnapshot()` or `snapshot()`
  - `clear()` or `reset()`
  - `merge(snapshot)` or `restore(snapshot)`
  - `has(domain)`
  - `domains()`
  - `size` or `count`

But wait, the user only provided the export list, not the actual method signatures. They said "public API surface (signatures)" but only listed the exported symbols. I need to infer the most likely signatures based on the names and typical behavior of such a store.

Let me think about what a `SessionMemoryStore` would logically do:
- It stores memories per domain.
- `MemoryEntity` is probably the item being stored.
- `MemorySlot` probably groups entities by domain.
- `SessionMemorySnapshot` probably contains slots or a map of domain to entities.

Likely methods on `SessionMemoryStore`:
- `remember(domain: MemoryDomain, entity: MemoryEntity): void` - adds an entity to a domain
- `recall(domain: MemoryDomain): MemoryEntity[]` - retrieves entities for a domain
- `has(domain: MemoryDomain): boolean` - checks if domain has entries
- `snapshot(): SessionMemorySnapshot` - captures current state
- `restore(snapshot: SessionMemorySnapshot): void` - restores state
- `clear(domain?: MemoryDomain): void` - clears all or specific domain
- `domains(): MemoryDomain[]` - lists active domains
- `size(domain?: MemoryDomain): number` - counts entities

But since I don't have exact signatures, I need to make reasonable inferences that are consistent with the names and write tests that assert on the contract. However, the user said "You are given ONLY its public API surface (signatures)". Maybe they expect me to infer the methods from the class name and interfaces?

Actually, looking at the prompt again, they listed:
```typescript
export interface MemoryEntity {
export type MemoryDomain = "weather" | "evidence" | "geo" | "knowledge" | "calculator" | "datetime" | "general" | "mixed";
export interface MemorySlot {
export interface SessionMemorySnapshot {
export class SessionMemoryStore {
export const sessionMemory = new SessionMemoryStore();
```

The `{` suggests there might be contents, but they were omitted. I need to infer the most logical API.

Let me reconstruct likely interfaces:

```typescript
export interface MemoryEntity {
  id?: string;
  content: string;
  timestamp?: number;
  // maybe metadata?
}

export interface MemorySlot {
  domain: MemoryDomain;
  entities: MemoryEntity[];
}

export interface SessionMemorySnapshot {
  slots: MemorySlot[];
  // or maybe timestamp?
  createdAt: number;
}

export class SessionMemoryStore {
  remember(domain: MemoryDomain, entity: MemoryEntity): void;
  recall(domain: MemoryDomain): MemoryEntity[];
  has(domain: MemoryDomain): boolean;
  snapshot(): SessionMemorySnapshot;
  restore(snapshot: SessionMemorySnapshot): void;
  clear(domain?: MemoryDomain): void;
  domains(): MemoryDomain[];
  count(domain?: MemoryDomain): number;
}
```

Wait, but I need to be careful. The test must import exactly `import ... from '../src/services/sessionMemory';`. The test must compile in strict TS. If I guess wrong about methods, the test won't compile against the real module. But since I don't have the real module, I must define the contract I'm testing against. The user wants me to test the contract implied by names+signatures.

I should write the test assuming the most natural API derived from the names, and perhaps include type declarations in the test file? No, the test file should import from the module. But if the module doesn't export those methods, it won't work. However, the prompt says "You are given ONLY its public API surface (signatures)". This implies I should infer the methods.

Let me think of a minimal but complete API that makes sense:

`MemoryEntity`: likely has some content, maybe an id.
`MemorySlot`: { domain: MemoryDomain; entities: MemoryEntity[]; }
`SessionMemorySnapshot`: { slots: MemorySlot[]; capturedAt?: number; }

`SessionMemoryStore`:
- `remember(domain, entity)` - store entity under domain
- `recall(domain)` - get entities for domain (returns array, empty if none)
- `snapshot()` - returns current state
- `restore(snapshot)` - replaces current state with snapshot
- `clear()` - wipes everything
- `clearDomain(domain)` - wipes specific domain
- `domains()` - returns list of domains with data

Alternatively, maybe:
- `add(slot: MemorySlot): void`
- `get(domain: MemoryDomain): MemorySlot | undefined`
- `snapshot(): SessionMemorySnapshot`
- `restore(snapshot: SessionMemorySnapshot): void`
- `clear(): void`

But `remember`/`recall` is more semantic for "memory".

Since the user said "test the CONTRACT (intended behavior), not echo code", I should focus on behaviors like:
- Storing and retrieving entities by domain
- Snapshot immutability (snapshot shouldn't change when store changes)
- Restore replaces state
- Invalid inputs throw (e.g., invalid domain, invalid snapshot)
- Boundary conditions: empty store, multiple domains, duplicate entities

Also, rule 3 says "Mock external deps (db/network/fs/other services) deterministically." But this module seems like an in-memory store with no external deps. So maybe no mocks needed, or if there are external deps implied (like persistence), I should mock them. But the name `SessionMemoryStore` suggests in-memory session storage. If it persists to disk or DB, that would be an external dep. However, without signatures, it's safer to assume it's pure in-memory unless there's a hint. But the rule says to mock external deps. If there are none, then none to mock.

Wait, maybe `SessionMemoryStore` has methods like `load()` or `save()`? Or maybe it takes a storage adapter in constructor? The exported singleton `sessionMemory` suggests it's ready to use, so likely no external deps in constructor, or it manages its own internal state.

Given the strict requirement for ONE typescript block, complete test file, nothing else, I need to produce a single ````typescript` block.

Let me draft the test file structure:

```typescript
import { SessionMemoryStore, sessionMemory, MemoryDomain, MemoryEntity, MemorySlot, SessionMemorySnapshot } from '../src/services/sessionMemory';

describe('SessionMemoryStore', () => {
  let store: SessionMemoryStore;

  beforeEach(() => {
    store = new SessionMemoryStore();
  });

  describe('remember', () => {
    it('stores an entity under the specified domain', () => {
      const entity: MemoryEntity = { id: '1', content: 'sunny' };
      store.remember('weather', entity);
      expect(store.recall('weather')).toEqual([entity]);
    });

    it('appends multiple entities for the same domain', () => {
      const e1: MemoryEntity = { id: '1', content: 'a' };
      const e2: MemoryEntity = { id: '2', content: 'b' };
      store.remember('weather', e1);
      store.remember('weather', e2);
      expect(store.recall('weather')).toEqual([e1, e2]);
    });

    it('throws for invalid domain', () => {
      expect(() => store.remember('invalid' as MemoryDomain, { content: 'x' })).toThrow();
    });

    it('throws for invalid entity', () => {
      expect(() => store.remember('weather', null as unknown as MemoryEntity)).toThrow();
    });
  });

  describe('recall', () => {
    it('returns empty array for unknown domain', () => {
      expect(store.recall('geo')).toEqual([]);
    });

    it('isolates domains', () => {
      store.remember('weather', { content: 'hot' });
      expect(store.recall('evidence')).toEqual([]);
    });
  });

  describe('snapshot', () => {
    it('captures all domains and entities', () => {
      store.remember('weather', { content: 'rain' });
      store.remember('geo', { content: 'NYC' });
      const snap = store.snapshot();
      expect(snap.slots).toEqual([
        { domain: 'weather', entities: [{ content: 'rain' }] },
        { domain: 'geo', entities: [{ content: 'NYC' }] },
      ]);
    });

    it('returns immutable capture (modifying snapshot does not affect store)', () => {
      store.remember('weather', { content: 'rain' });
      const snap = store.snapshot();
      snap.slots[0].entities.push({ content: 'snow' });
      expect(store.recall('weather')).toEqual([{ content: 'rain' }]);
    });
  });

  describe('restore', () => {
    it('replaces current state with snapshot', () => {
      store.remember('weather', { content: 'old' });
      const snap: SessionMemorySnapshot = {
        slots: [{ domain: 'knowledge', entities: [{ content: 'new' }] }],
      };
      store.restore(snap);
      expect(store.recall('weather')).toEqual([]);
      expect(store.recall('knowledge')).toEqual([{ content: 'new' }]);
    });

    it('throws on malformed snapshot', () => {
      expect(() => store.restore(null as unknown as SessionMemorySnapshot)).toThrow();
      expect(() => store.restore({ slots: null } as unknown as SessionMemorySnapshot)).toThrow();
    });
  });

  describe('clear', () => {
    it('removes all entities when called without argument', () => {
      store.remember('weather', { content: 'a' });
      store.remember('geo', { content: 'b' });
      store.clear();
      expect(store.recall('weather')).toEqual([]);
      expect(store.recall('geo')).toEqual([]);
    });

    it('removes only specified domain when provided', () => {
      store.remember('weather', { content: 'a' });
      store.remember('geo', { content: 'b' });
      store.clear('weather');
      expect(store.recall('weather')).toEqual([]);
      expect(store.recall('geo')).toEqual([{ content: 'b' }]);
    });
  });

  describe('domains', () => {
    it('returns only domains with stored entities', () => {
      store.remember('datetime', { content: 'now' });
      store.remember('calculator', { content: '2+2' });
      const d = store.domains();
      expect(d).toContain('datetime');
      expect(d).toContain('calculator');
      expect(d).not.toContain('weather');
    });

    it('returns empty array for empty store', () => {
      expect(store.domains()).toEqual([]);
    });
  });
});

describe('sessionMemory singleton', () => {
  it('is a SessionMemoryStore instance', () => {
    expect(sessionMemory).toBeInstanceOf(SessionMemoryStore);
  });

  it('maintains independent state from new instances', () => {
    const other = new SessionMemoryStore();
    sessionMemory.remember('general', { content: 'singleton' });
    expect(other.recall('general')).toEqual([]);
  });
});
```

But I need to make sure the inferred signatures are plausible. The user might have a different API. Let me reconsider.

Alternative API design:
Maybe `SessionMemoryStore` has:
- `add(slot: MemorySlot): void`
- `get(domain: MemoryDomain): MemorySlot | undefined`
- `snapshot(): SessionMemorySnapshot`
- `restore(snapshot: SessionMemorySnapshot): void`
- `clear(): void`

But `remember`/`recall` is more standard for "memory". However, `MemorySlot` interface exists, which suggests the store might deal in slots. If `remember` takes a `MemorySlot`, then `MemorySlot` would be the unit of storage.

Let's look at the names again:
- `MemoryEntity`: an item of memory.
- `MemoryDomain`: category.
- `MemorySlot`: a "slot" in memory, likely a container for a domain+entities.
- `SessionMemorySnapshot`: a snapshot of the whole store.

So likely:
- `remember(domain: MemoryDomain, entity: MemoryEntity)` OR `remember(slot: MemorySlot)`
- `recall(domain: MemoryDomain): MemorySlot` OR `recall(domain: MemoryDomain): MemoryEntity[]`

Given `MemorySlot` is exported, it's probably used in the snapshot and maybe as return type. But if `recall` returns `MemorySlot`, then it would be `{ domain, entities }`. That makes sense.

Let's assume:
```typescript
interface MemoryEntity {
  id: string;
  content: unknown;
  timestamp?: Date;
}

interface MemorySlot {
  domain: MemoryDomain;
  entities: MemoryEntity[];
}

interface SessionMemorySnapshot {
  slots: MemorySlot[];
  version?: number;
}

class SessionMemoryStore {
  remember(domain: MemoryDomain, entity: MemoryEntity): void;
  recall(domain: MemoryDomain): MemorySlot;
  has(domain: MemoryDomain): boolean;
  snapshot(): SessionMemorySnapshot;
  restore(snapshot: SessionMemorySnapshot): void;
  clear(domain?: MemoryDomain): void;
  domains(): MemoryDomain[];
}
```

This is consistent. I'll write tests based on this.

But wait, the user said "Mock external deps (db/network/fs/other services) deterministically." If `SessionMemoryStore` is purely in-memory, there are no external deps. But maybe the singleton `sessionMemory` or the class constructor interacts with something? The prompt says to mock external deps. If I don't mock anything, I might violate rule 3. However, if there truly are no external deps, then no mocks are needed. But to be safe, maybe I should assume that `SessionMemoryStore` might use some external time source or ID generator? Or maybe it persists? No, "session memory" implies ephemeral.

Actually, looking at the module name `innomcp-node` and `sessionMemory`, this might be part of an MCP (Model Context Protocol) server. Session memory might store context. It's likely pure in-memory.

Rule 3 might be a general rule for all such exercises, but if there are no external deps, then there are none to mock. I'll proceed without mocks but if I can identify any external dep like `Date`, I can mock it? No, Jest doesn't require mocking Date unless specified.

Wait, maybe `MemoryEntity` has a `createdAt` or `timestamp` that defaults to `Date.now()`? That would be an external dependency (system clock). I could mock `Date.now` to make it deterministic. That's a good idea. Let's assume entities get a timestamp automatically, or snapshot has a timestamp. I'll mock `Date.now` to be deterministic.

Let's refine the assumed API to be as natural as possible:

```typescript
// ../src/services/sessionMemory
export interface MemoryEntity {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export type MemoryDomain = "weather" | "evidence" | "geo" | "knowledge" | "calculator" | "datetime" | "general" | "mixed";

export interface MemorySlot {
  domain: MemoryDomain;
  entities: MemoryEntity[];
}

export interface SessionMemorySnapshot {
  slots: MemorySlot[];
  capturedAt: number;
}

export class SessionMemoryStore {
  remember(domain: MemoryDomain, entity: MemoryEntity): void;
  recall(domain: MemoryDomain): MemorySlot;
  has(domain: MemoryDomain): boolean;
  snapshot(): SessionMemorySnapshot;
  restore(snapshot: SessionMemorySnapshot): void;
  clear(domain?: MemoryDomain): void;
  domains(): MemoryDomain[];
}
```

If `recall` returns `MemorySlot`, then for an empty domain it might return `{ domain, entities: [] }` or `undefined`. Given the contract "correct outputs for valid inputs", returning a slot with empty entities is nice because it guarantees the domain field. But `has` would be useful to check existence.

Alternatively, `recall` could return `MemoryEntity[]`. But then why export `MemorySlot`? It would mainly be for `SessionMemorySnapshot`. That's also fine.

Let's go with:
- `remember(domain, entity): void`
- `recall(domain): MemoryEntity[]` (empty array if none)
- `has(domain): boolean`
- `snapshot(): SessionMemorySnapshot` (contains slots)
- `restore(snapshot): void`
- `clear(domain?): void`
- `domains(): MemoryDomain[]`

This is simple and covers the exported types.

Now, about the singleton: `export const sessionMemory = new SessionMemoryStore();`
Tests should verify it's an instance and that it's a shared singleton (state persists across references? Actually in tests, importing it once means it's module-level state. I should test that it is an instance, but be careful not to pollute other tests. I can clear it in beforeEach if the API supports it.

But wait, if I use the singleton in tests, and the test file runs with other test files, it could leak state. However, the contract test should verify the singleton's behavior. I'll test it in a separate describe block and clear it.

Let's write the test file.

One concern: The user wants strict TS. I need to make sure the test code is valid TypeScript. Since I don't have the actual module, I must assume the API. But the prompt asks me to write the test. So I will write it as if the module exports exactly what I inferred.

To make it robust, I should perhaps define the expected shape in comments? No, the output must be only the code block.

Let me think about edge cases and contracts:

1. **Domain validation**: Since `MemoryDomain` is a union, passing an invalid string at runtime should throw (contract behavior).
2. **Entity validation**: Passing null/undefined entity should throw.
3. **Recall isolation**: Entities stored in one domain must not appear in another.
4. **Snapshot contract**:
   - Must contain all current slots.
   - Must be a deep copy (immutability) — modifying snapshot must not affect store.
   - Must have deterministic structure (e.g., `slots` array).
5. **Restore contract**:
   - Must replace entire state.
   - Must validate snapshot structure (throw if invalid).
   - Must deep copy restored data (modifying restored entities later must not affect store? Or maybe it should clone on restore to prevent external mutation).
6. **Clear contract**:
   - No arg: removes all.
   - With domain: removes only that domain.
7. **Singleton contract**:
   - Is instance of class.
   - State is independent of new instances.

I should also mock `Date.now` if snapshot includes `capturedAt`. Let's assume `snapshot()` includes `capturedAt: number`. I'll mock Date.now to be deterministic.

Actually, to avoid assuming too much about `MemoryEntity` fields, I can use minimal objects. But TS strict mode will complain if I don't match the interface. Since I don't know the exact fields, I should use `as MemoryEntity` or define variables typed as `MemoryEntity` with plausible fields. But if the real interface has required fields I don't know, my test might not compile. However, given the prompt constraints, I have to make reasonable assumptions.

Let's assume `MemoryEntity` is something like:
```typescript
export interface MemoryEntity {
  id?: string;
  content: unknown;
}
```
Or maybe it's an empty interface? No, it's likely to have some fields. But to be safe, I can cast: `{ content: 'foo' } as MemoryEntity`. But in strict TS, casting might be okay if I use `as MemoryEntity`. However, if the interface has required fields that I omit, the cast will silence the error but it's risky. Better to assume minimal fields or use `unknown as MemoryEntity`? No, that's bad practice.

Wait, maybe `MemoryEntity` is a generic or has only optional fields? Given it's a memory entity in an MCP context, it might just be:
```typescript
export interface MemoryEntity {
  [key: string]: unknown;
}
```
Or maybe:
```typescript
export interface MemoryEntity {
  type: string;
  data: unknown;
}
```
I don't know.

To make the test compile regardless, I can use `as unknown as MemoryEntity` for all entity literals. That bypasses strict checking. But the user said "Strict TS". Using `as unknown as` is a TS escape hatch, but it's valid strict TS. However, it might be considered cheating. But given I don't have the interface definition, it's the only way to ensure the test file compiles against unknown fields.

Alternatively, I can declare the expected shape in the test file via module augmentation? No, that might conflict.

Actually, the best approach is to assume `MemoryEntity` has at least an optional `id` and `content` or is an empty interface. Most likely it has `content: string` or similar. I'll use simple objects and cast them if necessary. But to keep it clean, I'll just use `//` to note? No, code only.

Let me reconsider: maybe the exported API includes methods that use `MemorySlot` directly, like:
- `insert(slot: MemorySlot): void`
- `fetch(domain: MemoryDomain): MemorySlot | undefined`

But the names `SessionMemoryStore` and `sessionMemory` singleton strongly suggest methods like `remember` and `recall`. I'll stick with that.

What about `MemorySlot`? If `recall` returns `MemoryEntity[]`, then `MemorySlot` is only used in `SessionMemorySnapshot`. That's plausible.

Let's write the code.

```typescript
import { SessionMemoryStore, sessionMemory, MemoryDomain, MemoryEntity, MemorySlot, SessionMemorySnapshot } from '../src/services/sessionMemory';

describe('SessionMemoryStore contract', () => {
  let store: SessionMemoryStore;

  beforeEach(() => {
    store = new SessionMemoryStore();
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const makeEntity = (content: string): MemoryEntity => ({ content } as MemoryEntity);

  describe('remember', () => {
    it('stores an entity under the specified domain', () => {
      const entity = makeEntity('sunny');
      store.remember('weather', entity);
      expect(store.recall('weather')).toEqual([entity]);
    });

    it('accumulates entities in insertion order for the same domain', () => {
      const e1 = makeEntity('a');
      const e2 = makeEntity('b');
      store.remember('weather', e1);
      store.remember('weather', e2);
      expect(store.recall('weather')).toEqual([e1, e2]);
    });

    it('isolates entities by domain', () => {
      store.remember('weather', makeEntity('rain'));
      store.remember('geo', makeEntity('NYC'));
      expect(store.recall('weather')).toEqual([makeEntity('rain')]);
      expect(store.recall('geo')).toEqual([makeEntity('NYC')]);
    });

    it('throws when domain is not a valid MemoryDomain', () => {
      expect(() => store.remember('invalid' as MemoryDomain, makeEntity('x'))).toThrow();
    });

    it('throws when entity is null or undefined', () => {
      expect(() => store.remember('general', null as unknown as MemoryEntity)).toThrow();
      expect(() => store.remember('general', undefined as unknown as MemoryEntity)).toThrow();
    });
  });

  describe('recall', () => {
    it('returns an empty array for a domain with no remembered entities', () => {
      expect(store.recall('knowledge')).toEqual([]);
    });

    it('returns only entities belonging to the requested domain', () => {
      store.remember('evidence', makeEntity('proof'));
      store.remember('calculator', makeEntity('42'));
      expect(store.recall('evidence')).toEqual([makeEntity('proof')]);
      expect(store.recall('calculator')).toEqual([makeEntity('42')]);
    });
  });

  describe('has', () => {
    it('returns false when domain has no entities', () => {
      expect(store.has('datetime')).toBe(false);
    });

    it('returns true when domain has at least one entity', () => {
      store.remember('datetime', makeEntity('now'));
      expect(store.has('datetime')).toBe(true);
    });
  });

  describe('domains', () => {
    it('returns an empty array for a fresh store', () => {
      expect(store.domains()).toEqual([]);
    });

    it('returns only domains that contain at least one entity', () => {
      store.remember('weather', makeEntity('hot'));
      store.remember('geo', makeEntity('Berlin'));
      const result = store.domains();
      expect(result).toContain('weather');
      expect(result).toContain('geo');
      expect(result).not.toContain('general');
      expect(result).toHaveLength(2);
    });
  });

  describe('snapshot', () => {
    it('captures all current slots and metadata', () => {
      store.remember('weather', makeEntity('cloudy'));
      const snap = store.snapshot();
      expect(snap.slots).toEqual(expect.arrayContaining([
        expect.objectContaining<MemorySlot>({
          domain: 'weather',
          entities: [makeEntity('cloudy')],
        }),
      ]));
      expect(snap.capturedAt).toBe(Date.now());
    });

    it('produces a deep copy; mutating the snapshot does not affect the store', () => {
      store.remember('weather', makeEntity('snow'));
      const snap = store.snapshot();
      snap.slots[0].entities.push(makeEntity('blizzard'));
      expect(store.recall('weather')).toEqual([makeEntity('snow')]);
    });
  });

  describe('restore', () => {
    it('replaces the entire store state with the provided snapshot', () => {
      store.remember('weather', makeEntity('old'));
      const snap: SessionMemorySnapshot = {
        slots: [{ domain: 'knowledge', entities: [makeEntity('restored')] }],
        capturedAt: 0,
      };
      store.restore(snap);
      expect(store.recall('weather')).toEqual([]);
      expect(store.recall('knowledge')).toEqual([makeEntity('restored')]);
    });

    it('deep copies restored data so external mutation does not affect the store', () => {
      const snap: SessionMemorySnapshot = {
        slots: [{ domain: 'general', entities: [makeEntity('original')] }],
        capturedAt: 0,
      };
      store.restore(snap);
      snap.slots[0].entities[0] = makeEntity('tampered');
      expect(store.recall('general')).toEqual([makeEntity('original')]);
    });

    it('throws on a malformed snapshot (null, missing slots, or invalid domain)', () => {
      expect(() => store.restore(null as unknown as SessionMemorySnapshot)).toThrow();
      expect(() => store.restore({ capturedAt: 0 } as unknown as SessionMemorySnapshot)).toThrow();
      expect(() =>
        store.restore({
          slots: [{ domain: 'bad-domain' as MemoryDomain, entities: [] }],
          capturedAt: 0,
        }),
      ).toThrow();
    });
  });

  describe('clear', () => {
    it('removes all domains and entities when called without a domain', () => {
      store.remember('weather', makeEntity('a'));
      store.remember('geo', makeEntity('b'));
      store.clear();
      expect(store.domains()).toEqual([]);
      expect(store.recall('weather')).toEqual([]);
      expect(store.recall('geo')).toEqual([]);
    });

    it('removes only the specified domain when a domain is provided', () => {
      store.remember('weather', makeEntity('a'));
      store.remember('geo', makeEntity('b'));
      store.clear('weather');
      expect(store.recall('weather')).toEqual([]);
      expect(store.recall('geo')).toEqual([makeEntity('b')]);
      expect(store.domains()).toEqual(['geo']);
    });

    it('throws when clearing an invalid domain', () => {
      expect(() => store.clear('invalid' as MemoryDomain)).toThrow();
    });
  });
});

describe('sessionMemory singleton contract', () => {
  beforeEach(() => {
    sessionMemory.clear();
  });

  it('is an instance of SessionMemoryStore', () => {
    expect(sessionMemory).toBeInstanceOf(SessionMemoryStore);
  });

  it('maintains state independently from other SessionMemoryStore instances', () => {
    const isolated = new SessionMemoryStore();
    sessionMemory.remember('mixed', { content: 'singleton' } as MemoryEntity);
    expect(isolated.recall('mixed')).toEqual([]);
    expect(sessionMemory.recall('mixed')).toEqual([{ content: 'singleton' } as MemoryEntity]);
  });
});
```

Wait, I used `makeEntity` with `as MemoryEntity`. This is necessary because I don't know the exact shape. But in strict TS, if `MemoryEntity` is an empty interface, `{ content }` is assignable. If it has required fields, the cast is needed. This is acceptable.

However, I used `expect(snap.capturedAt).toBe(Date.now())`. If the snapshot doesn't have `capturedAt`, this fails. I assumed it. Maybe I should not assume `capturedAt` and instead just assert on `slots`. To be safer, I'll remove the `capturedAt` assertion or make it optional. But if I don't know the snapshot shape, I should focus on `slots`. Let me remove `capturedAt` from my assumptions. I'll define `SessionMemorySnapshot` as having `slots: MemorySlot[]` and nothing else. But I used `capturedAt: 0` in my manual snapshots. If the real interface doesn't have it, my test will have excess property warning in strict TS. Actually, in TS, excess properties in object literals are allowed when assigned to a variable of the type if the type has an index signature, but if it's a defined interface without index signature, it's an error. To avoid this, I should not include unknown properties. So I'll remove `capturedAt` from my manual snapshots and just use `{ slots: [...] }`.

Let me revise the snapshot interface assumption: just `{ slots: MemorySlot[] }`.

Revised test:

```typescript
import { SessionMemoryStore, sessionMemory, MemoryDomain, MemoryEntity, MemorySlot, SessionMemorySnapshot } from '../src/services/sessionMemory';

describe('SessionMemoryStore contract', () => {
  let store: SessionMemoryStore;

  beforeEach(() => {
    store = new SessionMemoryStore();
  });

  const entity = (content: string): MemoryEntity => ({ content } as MemoryEntity);

  describe('remember', () => {
    it('stores an entity under the specified domain', () => {
      const e = entity('sunny');
      store.remember('weather', e);
      expect(store.recall('weather')).toEqual([e]);
    });

    it('accumulates entities in insertion order within a domain', () => {
      const e1 = entity('a');
      const e2 = entity('b');
      store.remember('weather', e1);
      store.remember('weather', e2);
      expect(store.recall('weather')).toEqual([e1, e2]);
    });

    it('isolates storage by domain', () => {
      store.remember('weather', entity('rain'));
      store.remember('geo', entity('NYC'));
      expect(store.recall('weather')).toEqual([entity('rain')]);
      expect(store.recall('geo')).toEqual([entity('NYC')]);
    });

    it('throws for an invalid domain string', () => {
      expect(() => store.remember
