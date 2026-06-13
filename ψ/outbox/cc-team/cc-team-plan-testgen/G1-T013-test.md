<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T013 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2357,"completion_tokens":8000,"total_tokens":10357,"prompt_tokens_details":{"cached_tokens":70,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T10:53:34.558Z -->
The user wants a Jest unit test for a TypeScript module `memoryRagHook` in the `innomcp-node` package.

Key requirements:
1. Import EXACTLY as: `import ... from '../src/services/memoryRagHook';`
2. Only test PUBLIC exported API: `initMemoryRag`, `recordTurnAndGetMeta`, `enrichGroundedContract`, `MemoryRagMeta` (interface, but we test functions that use it). Also `extractEntities` and `routeToDomain` are NOT exported (private), so I must NOT test them directly. Wait, looking at the source, `extractEntities` and `routeToDomain` are not exported. So I should only test `initMemoryRag`, `recordTurnAndGetMeta`, and `enrichGroundedContract`.
3. Mock external dependencies with `jest.mock()`. External deps are: `sessionMemory`, `coldRetriever`, `retrievalOrchestrator`, `hotRetriever`, `answerContract`, `path`. Since `path` is a Node built-in, I might not need to mock it, but the instructions say mock external dependencies. `path` is used in `initMemoryRag`. I can mock `path` or mock `coldRetriever`. The main external dependencies are the other services from `../src/services/...`.
4. Use fake timers for any time/interval logic. Looking at the source, there doesn't seem to be explicit time/interval logic in the exported functions. However, `sessionMemory.recordTurn` might use timestamps. But the instructions say "Use fake timers for any time/interval logic." Since the source doesn't have explicit timers, but `sessionMemory` might internally, it's safer to use fake timers in `beforeEach` just in case, or if the module uses `Date.now()` indirectly. Actually, looking at the source, `recordTurnAndGetMeta` calls `sessionMemory.recordTurn` which might use timestamps. But since we mock `sessionMemory`, we control that. However, the exemplar uses fake timers. I should probably include `jest.useFakeTimers()` to be safe and follow the style exemplar, but the source doesn't seem to have timer logic. Wait, the instruction says "Use fake timers for any time/interval logic." If there is none in the public API code paths we test, maybe it's optional, but the exemplar shows it. I'll include it to be safe and consistent with the exemplar style.
5. Must compile under strict TypeScript and pass without live server/DB. So mocking is essential.
6. Output: ONE fenced typescript code block, COMPLETE test file, NOTHING else.

Let's analyze the source code more carefully.

Source exports:
- `initMemoryRag(): Promise<{ docCount: number; chunkCount: number }>`
- `recordTurnAndGetMeta(sessionId, query, route, toolsUsed, toolResult?): MemoryRagMeta`
- `enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void`
- Interface `MemoryRagMeta`

Dependencies to mock:
- `../src/services/sessionMemory`
- `../src/services/coldRetriever`
- `../src/services/retrievalOrchestrator`
- `../src/services/hotRetriever`
- `../src/services/answerContract`

Wait, the import path in the test is `../src/services/memoryRagHook`. So the module under test is at `innomcp-node/tests/../src/services/memoryRagHook` which is correct.

The mocks should be at the top level using `jest.mock('../src/services/sessionMemory', () => ({ ... }))` etc.

Let's look at what each dependency provides and how it's used:

1. `sessionMemory`:
   - `sessionMemory` is imported as a namespace? No, `import { sessionMemory, MemoryDomain, MemoryEntity } from "./sessionMemory";`. It seems `sessionMemory` is an object with methods.
   - Methods used: `recordTurn`, `getSnapshot`.
   - `getSnapshot` returns something with: `entities: Array<{ type: string; name: string }>`, `turnCount: number`, `activeDomain: MemoryDomain | null`.
   - `recordTurn` takes `(sessionId, query, domain, entities, { route, toolsUsed })`.

2. `coldRetriever`:
   - `coldRetriever` is an object with methods.
   - Methods used: `getDocumentCount()`, `loadCorpus(corpusDir)`.
   - `loadCorpus` returns `Promise<{ docCount: number; chunkCount: number }>`.

3. `retrievalOrchestrator`:
   - Imports: `planRetrieval`, `executeColdRetrieval`, `buildRetrievalResult`, `RetrievalResult`.
   - Used: `planRetrieval(query, route, snapshot)` returns `{ decision: "cold" | "hot+cold" | "none" | string, reason: string }`.
   - Used: `executeColdRetrieval(plan)` returns `Array<{ document: { title: string }, chunk: { content: string } }>`.
   - `buildRetrievalResult` and `RetrievalResult` are imported but not used in the shown source? Wait, the source might be truncated but we only test what's there. Actually, looking at the source, `buildRetrievalResult` and `RetrievalResult` are imported but not used in the visible portion. However, we don't need to mock them if they aren't called, but for completeness and to avoid "cannot read property of undefined" if the module initialization touches them, we should mock them. Actually, the module just imports them. If we mock the module, we need to provide exports for everything imported. But `jest.mock` will auto-mock if we don't provide a factory. If we provide a factory, we need to provide the named exports that the module uses. If we use `jest.mock` without factory, it replaces with undefined for named exports? No, `jest.mock` on a module with `__esModule` might need care. Better to use `jest.mock` with a factory returning the named exports.

Wait, `jest.mock` is hoisted. The paths should be relative to the test file. The test file is in `innomcp-node/tests/`. So the module under test is `../src/services/memoryRagHook`. The dependencies of `memoryRagHook` are in `../src/services/...`. So from the test file, the dependencies are at `../src/services/sessionMemory`, etc.

Let's draft the mocks:

```typescript
jest.mock('../src/services/sessionMemory', () => ({
  sessionMemory: {
    recordTurn: jest.fn(),
    getSnapshot: jest.fn(),
  },
  MemoryDomain: {}, // Type only? Actually it's a type or enum. If it's used as a value, we might need it. But in the test we might not need it. However, the module imports it. If we mock the module and don't export it, TypeScript might complain if the module tries to import it? No, runtime doesn't care about types. But if `MemoryDomain` is used as a value (e.g., `typeof MemoryDomain`), we need it. Looking at the source, `MemoryDomain` is used as a type annotation for `activeDomain`. So it's likely a type-only import or an enum. If it's an enum, we need to export it. But we don't know. Let's assume it's a type. Actually, `routeToDomain` returns `MemoryDomain`, and `snapshot.activeDomain` is `MemoryDomain | null`. If it's an enum, the runtime value matters. But since we mock `sessionMemory.getSnapshot`, we return `activeDomain` as a string. If `MemoryDomain` is an enum, returning a string might be okay if it's a string enum. To be safe, we can export `MemoryDomain` as an object or just as strings. But we don't know its definition. However, the test file must compile. If `MemoryDomain` is a type, we can import it as a type. But the source imports it as a value `{ sessionMemory, MemoryDomain, MemoryEntity }`. If it's only used as a type in the source, TypeScript erases it. But if the test imports the module, we don't need to import `MemoryDomain` unless we use it. We can import types from the mocked module? Actually, we can import from the real module path and jest will give us the mock. But if `MemoryDomain` is not exported by the mock, and we try to import it, it will be undefined. We might not need to import it directly in the test. We can just import the functions under test.

Actually, looking at the source, `MemoryRagMeta` is exported. We might want to import it for typing. But we can also just use the functions.

Let's plan the test imports:
```typescript
import { initMemoryRag, recordTurnAndGetMeta, enrichGroundedContract, MemoryRagMeta } from '../src/services/memoryRagHook';
```

Now mocks:

```typescript
jest.mock('../src/services/sessionMemory', () => ({
  sessionMemory: {
    recordTurn: jest.fn(),
    getSnapshot: jest.fn(),
  },
}));

jest.mock('../src/services/coldRetriever', () => ({
  coldRetriever: {
    getDocumentCount: jest.fn().mockReturnValue(0),
    loadCorpus: jest.fn().mockResolvedValue({ docCount: 5, chunkCount: 10 }),
  },
}));

jest.mock('../src/services/retrievalOrchestrator', () => ({
  planRetrieval: jest.fn(),
  executeColdRetrieval: jest.fn(),
  buildRetrievalResult: jest.fn(),
  RetrievalResult: jest.fn(), // If it's a class or interface. Actually if it's an interface, this is unnecessary but harmless.
}));

jest.mock('../src/services/hotRetriever', () => ({
  normalizeWeatherFacts: jest.fn(),
  normalizeEvidenceFacts: jest.fn(),
  normalizeDeterministicFact: jest.fn(),
  RetrievalFact: jest.fn(), // interface/class
}));

jest.mock('../src/services/answerContract', () => ({
  buildAnswerContract: jest.fn(),
  AnswerContract: jest.fn(),
  AnswerMode: jest.fn(),
  RetrievalMode: jest.fn(), // If enum or type. The source uses RetrievalMode as a type. But `recordTurnAndGetMeta` returns `RetrievalMode`. If it's a string literal type, no runtime value needed. The code does `plan.decision as RetrievalMode`. So it's just a type cast.
}));
```

Wait, `path` is also imported. Should we mock `path`? The source uses `path.resolve(__dirname, "../../data/knowledge-base")`. If we don't mock `path`, it will use the real `path`. That's fine, it's deterministic and offline. But `__dirname` in the test context might be different. However, `initMemoryRag` calls `path.resolve` and then `coldRetriever.loadCorpus(corpusDir)`. Since we mock `coldRetriever.loadCorpus`, the actual path string passed to it doesn't matter for the return value. But we might want to assert that `loadCorpus` was called with a string containing `knowledge-base`. We don't need to mock `path`.

However, there is a subtlety: `__dirname` in the source module will be the directory where the compiled source lives. In ts-jest, it might be the src directory or a temp directory. But since we mock `loadCorpus`, we don't care. We can just assert it was called with `expect.any(String)`.

Now, the source has a module-level state: `let initialized = false;`. This is tricky because tests share the module state. We need to reset it between tests. But the source doesn't export a way to reset it. We can use `jest.resetModules()` or manipulate the module's internal state. However, the instructions say "do NOT duplicate or re-implement the source" and "Only test the PUBLIC exported API". We cannot easily reset `initialized` without mocking the module or using `jest.isolateModules`. Actually, we can use `jest.resetModules()` in `beforeEach` and then re-require the module. But since we are using ES modules imports (TypeScript with `import`), `jest.resetModules()` works with `require`. For ES modules, we might need to use `jest.isolateModules`. However, ts-jest can handle this.

Alternatively, we can structure the tests so that the `initialized` state doesn't matter, or we can mock `coldRetriever` to return consistent values.

Test cases for `initMemoryRag`:
1. First call: should call `coldRetriever.loadCorpus` and return its result, then set `initialized = true`.
2. Second call: should NOT call `coldRetriever.loadCorpus` again, should return `{ docCount: coldRetriever.getDocumentCount(), chunkCount: 0 }`.

But because `initialized` persists across tests, if we run test 1 then test 2 in the same file, test 2 might see `initialized = true` from test 1. To handle this, we need to reset the module state. We can use `jest.isolateModules` for each test, or we can use a dirty trick: since we know the module path, we can access the internal state via `require`? No, with ES modules it's hard.

Better approach: Use `jest.resetModules()` and dynamic imports inside each test or `beforeEach`. But the exemplar uses static imports. However, for strict isolation, dynamic import is safer.

Wait, the exemplar shows static import. But the exemplar doesn't have module-level state. We need to handle this.

Option A: Use `jest.isolateModules` in each test.
Option B: Mock the entire module? No, we must test the real module.
Option C: Since `initialized` is internal, we can use `jest.doMock`? No.

Actually, we can reset the module registry with `jest.resetModules()` and then re-import using `require` inside `beforeEach`. But we are using TypeScript and ES module syntax. In ts-jest, you can do:

```typescript
beforeEach(() => {
  jest.resetModules();
});
```

And then in each test:
```typescript
const { initMemoryRag } = require('../src/services/memoryRagHook');
```

But `require` returns `any`, and we lose type safety. We can cast it.

Alternatively, we can accept that `initialized` persists and order the tests accordingly: first test the uninitialized state, then the initialized state. But that's brittle. If tests run in parallel or out of order, it fails. Jest runs tests in a file sequentially by default, so ordering works, but it's bad practice.

However, there's another way: we can mock `coldRetriever` and then just verify behavior. For the first call, we expect `loadCorpus` to be called. For the second call, we expect it not to be called. We can do both in a single test to avoid state leakage between tests. That might be the cleanest approach given the constraints.

Test 1: `initMemoryRag` - first call initializes and returns docCount/chunkCount; second call returns cached counts without reloading.
But if we do this in one test, and then other tests also call `initMemoryRag`, it will remain initialized. So we should group all `initMemoryRag` tests together and accept the state, or use `jest.isolateModules`.

Let's use `jest.isolateModules` for `initMemoryRag` tests. In isolateModules, the module state is fresh.

```typescript
test('initMemoryRag first call loads corpus', async () => {
  let result: { docCount: number; chunkCount: number };
  jest.isolateModules(async () => {
    const { initMemoryRag } = require('../src/services/memoryRagHook') as typeof import('../src/services/memoryRagHook');
    result = await initMemoryRag();
  });
  expect(coldRetriever.loadCorpus).toHaveBeenCalledTimes(1);
  expect(result!).toEqual({ docCount: 5, chunkCount: 10 });
});
```

Wait, `jest.isolateModules` takes a callback that runs synchronously? Actually, `jest.isolateModules` is synchronous: `jest.isolateModules(fn)`. It doesn't support async callbacks directly. But we can do:

```typescript
test('initMemoryRag first call loads corpus', () => {
  jest.isolateModules(() => {
    const { initMemoryRag } = require('../src/services/memoryRagHook') as typeof import('../src/services/memoryRagHook');
    // ... but we need to handle the promise.
    initMemoryRag().then(result => {
      expect(result).toEqual(...);
    });
  });
});
```

This is messy because the test might finish before the promise resolves. We can return the promise from inside the isolateModules, but `isolateModules` doesn't return the callback's return value. Actually, looking at Jest docs: `jest.isolateModules(fn)` runs `fn` and returns nothing. The callback is synchronous. So we need to do the async work inside the test but use a dynamic import that bypasses the module cache? `jest.resetModules()` + `require` inside an async function works because `require` is synchronous and `jest.resetModules()` clears the cache. Then we can do:

```typescript
beforeEach(() => {
  jest.resetModules();
});

test('initMemoryRag first call', async () => {
  const { initMemoryRag } = await import('../src/services/memoryRagHook');
  // ...
});
```

`jest.resetModules()` clears the module registry, and dynamic `import()` in ts-jest will re-evaluate the module. This is the best approach. However, the static import at the top will still hold the old module. But we can just use the dynamically imported one for `initMemoryRag` tests. For `recordTurnAndGetMeta` tests, the `initialized` state doesn't matter, so we can use the statically imported one. But wait, `recordTurnAndGetMeta` doesn't depend on `initialized`. So it's fine.

Actually, `recordTurnAndGetMeta` is stateless regarding `initialized`. So we can use the static import for it. For `initMemoryRag`, we need a fresh module. We can just do `jest.resetModules()` before the `initMemoryRag` tests and re-import.

But `jest.resetModules()` also clears the mocks? No, it clears the module registry, not the mock state. `jest.clearAllMocks()` clears mock state. So we can do:

```typescript
describe('initMemoryRag', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('first call loads corpus and returns counts', async () => {
    const { initMemoryRag } = await import('../src/services/memoryRagHook');
    const result = await initMemoryRag();
    expect(coldRetriever.loadCorpus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ docCount: 5, chunkCount: 10 });
  });

  test('subsequent call returns cached counts without reloading', async () => {
    // First import and call to set initialized = true
    const { initMemoryRag: init1 } = await import('../src/services/memoryRagHook');
    await init1();
    jest.clearAllMocks();
    // Second call on same module instance
    const result = await init1();
    expect(coldRetriever.loadCorpus).not.toHaveBeenCalled();
    expect(result).toEqual({ docCount: 0, chunkCount: 0 }); // getDocumentCount mock returns 0
  });
});
```

Wait, in the second test, after `jest.resetModules()`, the first `await import` gets a fresh module. Then `init1()` sets its `initialized = true`. Then calling `init1()` again should use the cached state. That works.

But we also need to make sure the mocks are set up before the module is imported, because the module imports dependencies at load time. Since we have `jest.mock` at the top, they are hoisted and applied before any import. So when we dynamically import `memoryRagHook`, it will use the mocked dependencies. Good.

Now for `recordTurnAndGetMeta`:

We need to mock `sessionMemory.getSnapshot` to return a snapshot object.
We need to mock `planRetrieval` to return a plan object.
We need to mock `executeColdRetrieval` to return cold results.

Let's define the mock return values.

`snapshot`:
```typescript
{
  entities: [
    { type: 'province', name: 'กรุงเทพ' },
    { type: 'region', name: 'ภาคกลาง' },
  ],
  turnCount: 3,
  activeDomain: 'general', // or 'weather', etc.
}
```

`plan`:
```typescript
{
  decision: 'cold', // or 'hot+cold', 'none'
  reason: 'memory-empty',
}
```

`coldResults`:
```typescript
[
  { document: { title: 'Doc1' }, chunk: { content: 'Chunk1' } },
  { document: { title: 'Doc2' }, chunk: { content: 'Chunk2' } },
]
```

Test cases for `recordTurnAndGetMeta`:
1. Empty sessionId: returns the degenerate meta with `memoryUsed: false`, `retrievalReason: 'no-session-id'`, etc. No calls to sessionMemory.
2. Normal session, plan decision 'none': no cold retrieval executed. `coldDocHits: 0`, `coldContext: ''`. `memoryUsed` depends on snapshot entities.
3. Normal session, plan decision 'cold': cold retrieval executed. `coldDocHits` set to results length, `coldContext` built from results.
4. Normal session, plan decision 'hot+cold': cold retrieval executed. `retrievalMode` should be 'both'.
5. `toolsUsed` length > 0: `hotFactCount` should be 1.
6. `toolsUsed` empty: `hotFactCount` should be 0.
7. Entities extraction: Since `extractEntities` is internal and uses regex on the query, we can test that the entities are passed to `sessionMemory.recordTurn`. But we don't have direct access to `extractEntities`. However, we can inspect the call to `sessionMemory.recordTurn` to see what entities were passed. The entities are generated based on the query. For example, if query contains 'กรุงเทพ', the entities array passed to `recordTurn` should include a province entity. This tests the internal logic indirectly, which is fine because we are testing the public API's behavior.

Wait, the instructions say "Only test the PUBLIC exported API actually present in the source below. Do not invent methods." Testing the public API's behavior includes verifying it calls dependencies correctly and returns correct values based on inputs. So checking the arguments passed to mocked `sessionMemory.recordTurn` is valid.

Let's plan the tests:

Test 2.1: empty sessionId
```typescript
test('returns no-session meta when sessionId is empty', () => {
  const meta = recordTurnAndGetMeta('', 'query', 'general', []);
  expect(meta.memoryUsed).toBe(false);
  expect(meta.retrievalReason).toBe('no-session-id');
  expect(sessionMemory.recordTurn).not.toHaveBeenCalled();
});
```

Test 2.2: normal flow, plan decision 'none'
```typescript
test('returns meta with no retrieval when plan decides none', () => {
  (sessionMemory.getSnapshot as jest.Mock).mockReturnValue({
    entities: [],
    turnCount: 1,
    activeDomain: 'general',
  });
  (planRetrieval as jest.Mock).mockReturnValue({ decision: 'none', reason: 'recent-turn' });

  const meta = recordTurnAndGetMeta('sess1', 'hello', 'general', []);
  expect(sessionMemory.recordTurn).toHaveBeenCalledWith('sess1', 'hello', 'general', expect.any(Array), { route: 'general', toolsUsed: [] });
  expect(meta.retrievalMode).toBe('none');
  expect(meta.coldDocHits).toBe(0);
  expect(meta.coldContext).toBe('');
  expect(meta.hotFactCount).toBe(0);
  expect(meta.sessionTurnCount).toBe(1);
});
```

Test 2.3: normal flow, plan decision 'cold' with results
```typescript
test('executes cold retrieval and builds context when plan decides cold', () => {
  (sessionMemory.getSnapshot as jest.Mock).mockReturnValue({
    entities: [{ type: 'province', name: 'กรุงเทพ' }],
    turnCount: 2,
    activeDomain: 'geo',
  });
  (planRetrieval as jest.Mock).mockReturnValue({ decision: 'cold', reason: 'no-memory' });
  (executeColdRetrieval as jest.Mock).mockReturnValue([
    { document: { title: 'T1' }, chunk: { content: 'C1' } },
    { document: { title: 'T2' }, chunk: { content: 'C2' } },
  ]);

  const meta = recordTurnAndGetMeta('sess2', 'ข้อมูลกรุงเทพ', 'geo', ['tool1']);
  expect(executeColdRetrieval).toHaveBeenCalledWith({ decision: 'cold', reason: 'no-memory' });
  expect(meta.coldDocHits).toBe(2);
  expect(meta.coldContext).toBe('[T1] C1\n\n---\n\n[T2] C2');
  expect(meta.retrievalMode).toBe('cold');
  expect(meta.hotFactCount).toBe(1);
});
```

Test 2.4: plan decision 'hot+cold'
```typescript
test('sets retrievalMode to both when plan decides hot+cold', () => {
  (sessionMemory.getSnapshot as jest.Mock).mockReturnValue({
    entities: [],
    turnCount: 1,
    activeDomain: null,
  });
  (planRetrieval as jest.Mock).mockReturnValue({ decision: 'hot+cold', reason: 'mixed' });
  (executeColdRetrieval as jest.Mock).mockReturnValue([]);

  const meta = recordTurnAndGetMeta('sess3', 'query', 'weather', []);
  expect(meta.retrievalMode).toBe('both');
  expect(meta.coldDocHits).toBe(0);
});
```

Test 2.5: entity extraction via recordTurn args
We can test that given a query with Thai provinces, the entities passed to `recordTurn` contain the province.
```typescript
test('extracts provinces from query and passes to sessionMemory', () => {
  (sessionMemory.getSnapshot as jest.Mock).mockReturnValue({
    entities: [{ type: 'province', name: 'เชียงใหม่' }],
    turnCount: 1,
    activeDomain: 'general',
  });
  (planRetrieval as jest.Mock).mockReturnValue({ decision: 'none', reason: 'test' });

  recordTurnAndGetMeta('sess4', 'ข้อมูลเชียงใหม่', 'general', []);
  const passedEntities = (sessionMemory.recordTurn as jest.Mock).mock.calls[0][3];
  expect(passedEntities).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'เชียงใหม่', type: 'province', domain: 'general', confidence: 0.9 }),
    ])
  );
});
```

Similarly for regions, ISPs, concepts. But maybe one test for entities is enough to show it works. Or we can do a few.

Test 2.6: `memoryEntities` mapping
```typescript
test('maps snapshot entities to memoryEntities strings', () => {
  (sessionMemory.getSnapshot as jest.Mock).mockReturnValue({
    entities: [
      { type: 'province', name: 'กรุงเทพ' },
      { type: 'region', name: 'ภาคกลาง' },
    ],
    turnCount: 5,
    activeDomain: 'weather',
  });
  (planRetrieval as jest.Mock).mockReturnValue({ decision: 'none', reason: 'test' });

  const meta = recordTurnAndGetMeta('sess5', 'query', 'weather', []);
  expect(meta.memoryEntities).toEqual(['province:กรุงเทพ', 'region:ภาคกลาง']);
  expect(meta.memoryUsed).toBe(true);
  expect(meta.sessionTurnCount).toBe(5);
  expect(meta.activeDomain).toBe('weather');
});
```

Now for `enrichGroundedContract`:

Source:
```typescript
export function enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void {
  if (!structuredContent || typeof structuredContent !== "object") return;
  const gc = structuredContent.__groundedContract;
  if (!gc || typeof gc !== "object") return;

  gc.memoryRag = 
/* …truncated… */
```

The source is truncated at `gc.memoryRag =`. We don't know exactly what it assigns. But we can infer it assigns `ragMeta` or some subset. Wait, the truncation makes it impossible to know the exact behavior. However, we must test the public API as present. Since the source is truncated, we have to make reasonable assumptions based on the function signature and name. It likely assigns `ragMeta` to `gc.memoryRag`. Or maybe it spreads it. Let's look at the context: "Enrich a __groundedContract object with memory/RAG metadata." So it probably does `gc.memoryRag = ragMeta;` or `gc.memoryRag = { ...ragMeta };`. Given the truncation, we can test that it mutates `gc.memoryRag` to be the provided `ragMeta` object. If the actual source does something slightly different, the test might fail, but we have to write based on what's visible.

Wait, the source is truncated. The user provided it. We must work with what we have. The function is supposed to attach metadata. The most logical implementation is `gc.memoryRag = ragMeta;`. Let's assume that. If it's more complex, we can't know. But we can test the guard clauses and the mutation.

Test cases for `enrichGroundedContract`:
1. Null/undefined `structuredContent`: does nothing, no throw.
2. `structuredContent` without `__groundedContract`: does nothing.
3. `__groundedContract` present but not object: does nothing.
4. Valid object: mutates `__groundedContract.memoryRag` to the provided meta.

```typescript
test('does nothing when structuredContent is null', () => {
  const meta: MemoryRagMeta = { /* ... */ };
  expect(() => enrichGroundedContract(null, meta)).not.toThrow();
});

test('does nothing when __groundedContract is missing', () => {
  const content = { other: true };
  enrichGroundedContract(content, {} as MemoryRagMeta);
  expect(content).not.toHaveProperty('__groundedContract.memoryRag');
});

test('attaches ragMeta to __groundedContract.memoryRag', () => {
  const meta: MemoryRagMeta = {
    memoryUsed: true,
    memoryEntities: ['e1'],
    retrievalMode: 'cold',
    retrievalReason: 'r1',
    coldDocHits: 2,
    coldContext: 'ctx',
    hotFactCount: 1,
    sessionTurnCount: 3,
    activeDomain: 'weather',
  };
  const content = { __groundedContract: {} };
  enrichGroundedContract(content, meta);
  expect(content.__groundedContract.memoryRag).toBe(meta); // or toEqual(meta)
});
```

Wait, if the actual code does `gc.memoryRag = { ... }` with some transformation, `toBe` might fail. `toEqual` is safer. But if it assigns exactly `ragMeta`, `toBe` works. Let's use `toEqual` to be safe.

Actually, since the source is truncated, maybe we should avoid asserting the exact value of `memoryRag` and just assert that it was set? But the function's purpose is to enrich it. We should assert something. Let's use `toEqual(meta)` which will pass if it's a copy or the same object (if properties match). Actually, `toEqual` does deep equality. If the source adds extra fields or removes some, it might fail. But we have no choice. Let's assume it assigns `ragMeta` directly.

Now, about `MemoryRagMeta` interface: we need to create objects of this type. We imported it.

Let's write the complete test file.

One issue: `jest.mock` factories. If we use `jest.mock` with a factory, we need to make sure the exports match. Since we don't know the exact structure of `MemoryDomain` etc., and they might be types, we can just export the values that are used.

Actually, `jest.mock` is hoisted. If we use `jest.mock('../src/services/sessionMemory')` without a factory, Jest will auto-mock the module. For ES modules with named exports, auto-mock replaces all exports with `undefined` unless we use `__esModule`? No, `jest.mock` with no factory generates a mock where all named exports are undefined? Actually, for ES modules, `jest.mock` generates a mock module where named exports are mock functions if they were functions? No, `jest.mock` does "automatic mocking" which replaces exports with mock functions for functions, but for objects it might be tricky. It's safer to provide explicit factories for the modules that export objects we call methods on.

Let's write explicit factories for the modules that export objects:

```typescript
jest.mock('../src/services/sessionMemory', () => ({
  sessionMemory: {
    recordTurn: jest.fn(),
    getSnapshot: jest.fn(),
  },
}));

jest.mock('../src/services/coldRetriever', () => ({
  coldRetriever: {
    getDocumentCount: jest.fn().mockReturnValue(0),
    loadCorpus: jest.fn().mockResolvedValue({ docCount: 5, chunkCount: 10 }),
  },
}));

jest.mock('../src/services/retrievalOrchestrator', () => ({
  planRetrieval: jest.fn(),
  executeColdRetrieval: jest.fn(),
  buildRetrievalResult: jest.fn(),
}));

jest.mock('../src/services/hotRetriever', () => ({
  normalizeWeatherFacts: jest.fn(),
  normalizeEvidenceFacts: jest.fn(),
  normalizeDeterministicFact: jest.fn(),
}));

jest.mock('../src/services/answerContract', () => ({
  buildAnswerContract: jest.fn(),
}));
```

Wait, `RetrievalResult`, `RetrievalFact`, `AnswerContract`, `AnswerMode`, `RetrievalMode` are imported as types/values. If they are only used as types, they are erased and don't need to be in the mock. If they are used as values (e.g., `new RetrievalResult()` or `AnswerMode.Something`), the module would crash. Looking at the source, they are imported but not used in the visible portion. However, to be safe, we can include them in the mock as `jest.fn()` or dummy objects. But if they are enums and used as types, it's fine. Let's not include them to keep it clean, but if TypeScript complains about missing exports when the test imports from the mocked module? The test doesn't import from those modules directly (except maybe types). Actually, the test doesn't import them at all. The module under test imports them. When the module is loaded, it tries to import these names. If they are not exported by the mock, they will be `undefined`. If the module only uses them as types, that's fine at runtime (TypeScript erases types). If it uses them as values, it will get `undefined` and potentially crash. But the visible source doesn't use `RetrievalResult`, `RetrievalFact`, `AnswerContract`, `AnswerMode` as values. It does use `RetrievalMode` as a type cast: `plan.decision as RetrievalMode`. That's a compile-time only construct; at runtime it's just the string value. So we don't need to export `RetrievalMode` from the mock. Good.

However, `buildRetrievalResult` is imported but not used in the visible source. If the source file continues and uses it, our mock should include it. We included it. `normalizeWeatherFacts` etc. are imported but not used in visible source. We included them.

Now, `path` is used. We don't need to mock it.

Let's refine the `recordTurnAndGetMeta` tests.

We need to be careful about the `entities` passed to `sessionMemory.recordTurn`. The `extractEntities` function is internal and uses regex. We can test it indirectly by inspecting the call.

For example, query 'ข้อมูลกรุงเทพ' should produce an entity with name 'กรุงเทพ', type 'province', domain 'general' (since route 'general'), confidence 0.9.

Query 'ภาคเหนือ' should produce region entity.
Query 'AIS' should produce ISP entity with domain 'evidence' regardless of route? Wait, the `extractEntities` function sets `domain = routeToDomain(route)`, but for ISPs it forces `domain: "evidence"`. So if route is 'general', ISP entities will have domain 'evidence'.
Query 'NIP' with route 'knowledge' should produce concept entity.

Let's write a comprehensive entity extraction test:

```typescript
test('extracts and records entities from query', () => {
  (session
