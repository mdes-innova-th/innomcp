<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S013 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":295,"completion_tokens":7000,"total_tokens":7295,"prompt_tokens_details":{"cached_tokens":71,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 96s
 generated: 2026-06-13T11:23:55.794Z -->
The user wants a Jest contract/behavior test for a module called `memoryRagHook`. I only have the public API surface (signatures), not the implementation. I need to write tests that assert on the contract implied by the names and signatures.

Key rules:
1. Import EXACTLY: `import ... from '../src/services/memoryRagHook';`
2. Test observable behavior/contracts: correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions. Assert VALUES/STATE, not just mocks.
3. Mock external deps deterministically. Offline. Strict TS.
4. Output exactly one typescript block, complete test file, nothing else.

Let's analyze the signatures:

```typescript
export async function initMemoryRag(): Promise<{ docCount: number; chunkCount: number }> {
export interface MemoryRagMeta {
export function recordTurnAndGetMeta(
export function enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void {
export function queryColdRag(query: string, domain?: string): { context: string; docCount: number; sources: string[] } {
export function getMemoryDebugData(sessionId: string) {
export function disambiguateWithSessionMemory(
```

Wait, some signatures are incomplete in the prompt. I need to infer reasonable contracts based on the names and what I can see.

Let's infer:

1. `initMemoryRag(): Promise<{ docCount: number; chunkCount: number }>`
   - Initializes the memory RAG system.
   - Returns a promise resolving to an object with `docCount` and `chunkCount` (non-negative integers?).
   - Should probably throw if called twice or if initialization fails? Contract: returns stats. Maybe idempotent or throws on re-init? I'll test that it returns the expected shape and non-negative numbers.

2. `interface MemoryRagMeta`
   - Likely contains metadata about RAG context. Probably fields like `sources`, `chunkCount`, `domain`, etc. Since it's an interface used by other functions, I need to define a mock object that satisfies it for testing functions that depend on it. I don't know exact fields, but I can create a mock that seems reasonable and test that functions accepting it work. However, since I don't know the exact shape, I should be careful. The contract tests should probably test that `recordTurnAndGetMeta` returns something assignable to `MemoryRagMeta`, and `enrichGroundedContract` accepts it. But without knowing the shape, I can use `as MemoryRagMeta` or create a minimal object. Actually, since I don't have the implementation, I need to infer the minimal contract. Maybe `MemoryRagMeta` is just an opaque object or has specific fields. I'll assume it has at least `sessionId` or `turnCount`? No, let's look at the function names.
   - `recordTurnAndGetMeta` - likely takes some turn data and returns `MemoryRagMeta`.
   - `enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void` - mutates or enriches `structuredContent` using `ragMeta`. Since it returns void, it likely mutates the input object or the contract is that it performs side effects. But the prompt says "Assert VALUES/STATE". If it mutates `structuredContent`, I can assert on the mutated object. If it's purely side-effect based on external deps, I mock those. The name "enrich... void" suggests mutation of the first argument. I'll test that `structuredContent` is modified.

3. `recordTurnAndGetMeta(` - signature incomplete. Likely takes something like `(sessionId: string, userText: string, assistantText: string)` or similar. I'll infer it takes parameters related to a turn and returns `MemoryRagMeta`. Since I don't know the exact params, I need to make a reasonable assumption. Wait, the prompt says "You are given ONLY its public API surface (signatures)". The signature is literally `export function recordTurnAndGetMeta(`. It's cut off. I have to infer the most logical signature based on context. Given `getMemoryDebugData(sessionId: string)` and `disambiguateWithSessionMemory(`, and `recordTurnAndGetMeta`, it's likely:
   `export function recordTurnAndGetMeta(sessionId: string, turn: { role: string; content: string }): MemoryRagMeta`
   Or maybe it returns `Promise<MemoryRagMeta>`? The prompt doesn't show return type explicitly but it's on the line after the interface. Actually:
   ```
   export interface MemoryRagMeta {
   export function recordTurnAndGetMeta(
   ```
   It might return `MemoryRagMeta`. Let's assume it returns `MemoryRagMeta` (not async, or maybe async? The init is async, others aren't specified except init). Let's assume sync for now unless implied otherwise. But `recordTurnAndGetMeta` sounds like it might interact with storage. However, `queryColdRag` is sync according to signature (no async). `getMemoryDebugData` has no return type shown. `disambiguateWithSessionMemory` is cut off.

   Hmm. This is tricky. I need to write a test file that imports these and tests them. If my assumed signatures are wrong, the test won't compile. But the user wants me to test the contract based on names+signatures. I should define the signatures as I understand them and test them. But wait, I cannot redefine them; I'm importing from the module. So my test must use the actual exported signatures. Since I don't have the implementation, I must make educated guesses that are plausible and write tests that would compile against reasonable implementations of those names.

   Let's look at the names again:
   - `initMemoryRag`: async, returns docCount/chunkCount.
   - `MemoryRagMeta`: interface.
   - `recordTurnAndGetMeta`: likely takes a session identifier and turn content, returns meta. Let's assume signature: `(sessionId: string, query: string, response: string) => MemoryRagMeta` or maybe `(turn: Turn) => MemoryRagMeta`. Given `disambiguateWithSessionMemory` and `getMemoryDebugData(sessionId)`, `sessionId` is a key concept. So `recordTurnAndGetMeta` probably takes `sessionId`. Let's assume: `export function recordTurnAndGetMeta(sessionId: string, userQuery: string, assistantResponse: string): MemoryRagMeta;` This is a guess but reasonable.
   - `enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void`. This is clear.
   - `queryColdRag(query: string, domain?: string): { context: string; docCount: number; sources: string[] }`. Clear.
   - `getMemoryDebugData(sessionId: string)` - return type unknown. Probably returns some debug object. Let's assume it returns an object with session info. I'll test that it returns an object containing `sessionId` or similar, or throw on invalid input.
   - `disambiguateWithSessionMemory(` - likely takes `sessionId` and `candidates` or `query`. Let's assume: `export function disambiguateWithSessionMemory(sessionId: string, ambiguousQuery: string, candidates: string[]): string;` or maybe it returns `string`. Another possibility: `(sessionId: string, query: string): string[]`. I'll assume it takes `sessionId` and an array of options, and returns the disambiguated result (string or array). Hmm.

   Wait, maybe I should look at the pattern. The user might have truncated the signatures accidentally. I need to infer the most standard contract.

   Alternative approach: Since I don't know exact param types for the incomplete signatures, I can write tests that are slightly generic but still compile if my assumptions are correct. However, TypeScript is strict. If I call `recordTurnAndGetMeta('sid', 'user', 'assistant')` and the actual function takes 4 args, it won't compile. But I have no choice; I must infer.

   Let's think about what makes sense for a "memoryRagHook":
   - `initMemoryRag()`: initializes vector store or memory. Returns counts.
   - `recordTurnAndGetMeta(sessionId: string, turnText: string): MemoryRagMeta`? Or maybe `(sessionId: string, role: 'user'|'assistant', content: string): MemoryRagMeta`.
   - `enrichGroundedContract`: takes some structured content (like a JSON/schema object) and enriches it with RAG metadata (e.g., adds citations, context). Returns void -> mutates first arg.
   - `queryColdRag`: queries the "cold" RAG (static knowledge base). Returns context string, doc count, sources.
   - `getMemoryDebugData(sessionId: string)`: returns debug info for a session. Probably `{ sessionId: string; turns: number; lastQuery: string }` or similar.
   - `disambiguateWithSessionMemory(sessionId: string, query: string, candidates: string[]): string`? Or maybe `(sessionId: string, rawQuery: string): string`. The name suggests it uses session memory to disambiguate something. Maybe it takes an ambiguous term and returns the resolved term.

   Let's reconsider. Maybe the signature for `recordTurnAndGetMeta` is actually shown on the next line but got merged. The user wrote:
   ```
   export interface MemoryRagMeta {
   export function recordTurnAndGetMeta(
   export function enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void {
   export function queryColdRag(query: string, domain?: string): { context: string; docCount: number; sources: string[] } {
   export function getMemoryDebugData(sessionId: string) {
   export function disambiguateWithSessionMemory(
   ```
   So the line breaks are intentional truncations. I need to infer.

   Perhaps `recordTurnAndGetMeta` takes no args? No, "recordTurn" implies it records something. "AndGetMeta" implies it returns MemoryRagMeta. Maybe it's `recordTurnAndGetMeta(turn: Turn): MemoryRagMeta`.
   And `disambiguateWithSessionMemory(sessionId: string, query: string, options: string[]): string`.

   To make the test robust and plausible, I should pick signatures that are very likely and document them via usage. But I cannot change the import. The test file will be compiled against the actual source. If my guesses are wrong, the test is broken. But the user is asking me to generate the test based on the API surface. This is a creative exercise where I must assume the signatures.

   Let's assume the following complete signatures based on typical RAG memory hooks:
   ```typescript
   export interface MemoryRagMeta {
     sessionId: string;
     turnIndex: number;
     sources: string[];
     chunkCount: number;
   }

   export function recordTurnAndGetMeta(sessionId: string, query: string, response: string): MemoryRagMeta;

   export function disambiguateWithSessionMemory(sessionId: string, ambiguousPhrase: string, candidates: string[]): string;
   ```

   But wait, `getMemoryDebugData(sessionId: string)` has no return type. Could be `any` or implicit. I'll assume it returns `{ sessionId: string; turns: MemoryRagMeta[]; summary: string }` or similar.

   Actually, looking at the prompt again, maybe the signatures are meant to be exactly as written and the missing parts are to be inferred by me. The safest approach is to infer minimal, common-sense signatures and write tests that focus on the contract: input validation, output shapes, state changes, and error handling.

   Let's decide on concrete inferred signatures:

   1. `initMemoryRag(): Promise<{ docCount: number; chunkCount: number }>`
   2. `MemoryRagMeta` - I'll define a mock object that satisfies the interface. Since I don't know fields, I can use `as any as MemoryRagMeta` or just mock the interface? No, I can't define the interface in the test file if it's imported. I have to import it. So I can do: `import { MemoryRagMeta, ... } from '...'`. Then to create one, I need to know its shape. If I don't know the shape, I can't construct it. This is a problem.

   Wait, maybe `MemoryRagMeta` is an empty interface or has optional fields? Or maybe it's a type that I can satisfy with an object literal that has plausible fields. But TypeScript will error if I add unknown fields to a non-empty interface? Actually, excess property checks happen on object literals assigned to the interface. If I do `const meta: MemoryRagMeta = { sessionId: 's1', turnIndex: 0, sources: [], chunkCount: 0 };` and the interface doesn't have those fields, it fails. If the interface is empty `{}`, it fails due to excess properties. If I cast `as MemoryRagMeta`, it works. So I can create mock meta objects by casting `as unknown as MemoryRagMeta` to be safe. But that feels like cheating the "strict TS" rule. However, since I don't know the shape, casting is the only way to remain type-safe without knowing the definition.

   But maybe I can avoid constructing `MemoryRagMeta` manually by using the output of `recordTurnAndGetMeta` in tests for `enrichGroundedContract`. That way I don't need to know the exact shape. That's brilliant. The contract test can chain them: call `recordTurnAndGetMeta` to get a `MemoryRagMeta`, then pass it to `enrichGroundedContract`. This tests the integration contract between them.

   So for `recordTurnAndGetMeta`, I need to call it. Let's assume it takes `(sessionId: string, userQuery: string, assistantResponse: string)` and returns `MemoryRagMeta`. This is a reasonable assumption.

   For `disambiguateWithSessionMemory`, let's assume it takes `(sessionId: string, query: string, candidates: string[])` and returns `string`. Or maybe it returns `string[]`. The name "disambiguate... with session memory" suggests it takes something ambiguous and uses memory to resolve. Maybe signature: `(sessionId: string, rawQuery: string): string`. But I need to pick one. Let's assume `(sessionId: string, query: string, candidates: string[]): string` because disambiguation usually involves candidates.

   For `getMemoryDebugData(sessionId: string)`, I'll assume it returns `object` (maybe `{ sessionId: string; memory: any[] }`). I'll assert on the presence of `sessionId` in the returned object.

   Now, external dependencies to mock: The module likely interacts with a database, vector store, or file system. Since I don't know the implementation, I should mock at the module level or global level? The prompt says "Mock external deps (db/network/fs/other services) deterministically." Since I don't know what external deps the module uses, I need to make reasonable assumptions. It might use `fs` to load documents, or a `fetch` call, or some other service module. But without knowing the implementation, I can't know what to mock.

   However, the instruction is to mock external deps. In contract testing, if the module is a pure logic module, maybe it doesn't need mocks. But `initMemoryRag` is async, `queryColdRag` is sync (maybe reads from mocked fs), `recordTurnAndGetMeta` might write to memory. Since I don't know, I can mock things that are commonly used: `fs`, or perhaps a sub-service. But I don't know the import paths of the module's internal deps.

   Wait, maybe the module is self-contained and I don't need to mock anything except perhaps global `fetch` if it calls out. But the prompt says "Mock external deps deterministically." I can mock `fs` or `fetch` just in case, but if the module doesn't use them, the mocks are harmless. However, in Jest, mocking unused modules might be okay but could be confusing. Alternatively, I can mock a hypothetical dependency by mocking the module itself? No, I'm testing the module.

   Another interpretation: The module might depend on other modules in the project, e.g., `vectorStore`, `sessionManager`. Since I don't know, I can't mock them by path. But I can use `jest.mock` on common Node.js modules like `fs` or `path`. Or I can set up a mock for `fetch` using `jest-fetch-mock` or just mock global `fetch`. But the prompt says "offline", so maybe `initMemoryRag` fetches something.

   Let's think differently. The user wants a *contract* test. In many cases, contract tests for a module with unknown internals but known API can be written by assuming the module maintains internal state (like a memory store) and testing that state transitions are observable through the API. For example:
   - After `initMemoryRag`, `queryColdRag` should work.
   - After `recordTurnAndGetMeta`, `getMemoryDebugData` should reflect the turn.
   - `disambiguateWithSessionMemory` should use recorded session memory.

   This is behavior-driven. I don't need to know the internal external deps if I treat the module as a black box and mock only truly external things like `fs`/`fetch` which might be needed for `initMemoryRag` to load a corpus.

   Let's assume `initMemoryRag` reads from a JSON file or fetches a manifest. I'll mock `fs.promises.readFile` to return a deterministic corpus manifest. Or mock `fetch`. But to be safe and generic, maybe I should mock `fs` since it's a common dependency for "cold RAG" (loading documents).

   Actually, looking at the function `queryColdRag(query: string, domain?: string): ...`, it's synchronous. That suggests it operates on an in-memory index that was loaded during `initMemoryRag`. So `initMemoryRag` probably loads files into memory. Mocking `fs` makes sense.

   Let's design the test suite:

   **Assumed complete signatures:**
   ```typescript
   export async function initMemoryRag(): Promise<{ docCount: number; chunkCount: number }>;
   export interface MemoryRagMeta { /* opaque */ }
   export function recordTurnAndGetMeta(sessionId: string, query: string, response: string): MemoryRagMeta;
   export function enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void;
   export function queryColdRag(query: string, domain?: string): { context: string; docCount: number; sources: string[] };
   export function getMemoryDebugData(sessionId: string): { sessionId: string; turns: number; lastQuery?: string };
   export function disambiguateWithSessionMemory(sessionId: string, query: string, candidates: string[]): string;
   ```

   Wait, `getMemoryDebugData` return type is missing in the prompt. I'll assume it returns `any` or a debug object. I'll just assert it returns an object.

   Let's refine assumptions to be more conservative:
   - `recordTurnAndGetMeta(sessionId: string, query: string, response: string): MemoryRagMeta` (sync, returns meta)
   - `disambiguateWithSessionMemory(sessionId: string, query: string, candidates: string[]): string` (sync, returns one candidate)
   - `getMemoryDebugData(sessionId: string): any` (returns debug info)

   If these assumptions are too specific, the test might not compile. But I have to make the test file complete. I will add comments indicating these are inferred, but the prompt says "nothing else" and just the code block. So no comments explaining assumptions? I can add comments in the code, that's fine.

   Let's think about boundary conditions and contracts:

   **initMemoryRag:**
   - Should return an object with `docCount` and `chunkCount`.
   - Both should be non-negative integers.
   - Should be callable once and return consistent results (idempotent or stateful). If called twice, maybe throws or returns same. I'll test it returns correct shape and counts >= 0.
   - Since it's async, should reject if underlying fs fails. I'll mock `fs` to simulate failure and assert rejection.

   **recordTurnAndGetMeta:**
   - Should throw if `sessionId` is empty/null.
   - Should throw if `query` is missing.
   - Should return a `MemoryRagMeta` object.
   - Should be pure-ish or record state such that `getMemoryDebugData` changes.

   **enrichGroundedContract:**
   - Should throw if `structuredContent` is null/undefined? Or handle it? Contract: enrich the object. If first arg is `any`, maybe it should throw on null. I'll test that it mutates the object (e.g., adds `_rag` field or similar). But I don't know what it adds. Hmm. The contract is that it enriches. I can assert that the object is modified: `expect(structuredContent).not.toEqual(original)` or check that some property is added. But I don't know the property name. Maybe it adds a `ragMeta` property? Or `grounding`? I can assert that the function does not throw on valid input and that the object is strictly not the same reference? No, mutation keeps same reference. I need to know what changes.
   - Alternative: Since `ragMeta` is passed, maybe it attaches `ragMeta` to `structuredContent`. I can test that `structuredContent.ragMeta === ragMeta` after call? But I don't know if that's the property name.
   - Safer: Test that it throws on invalid `ragMeta` (e.g., null) and runs without error on valid meta. But the contract might not throw on null if `ragMeta` is required. I'll test that it throws when `ragMeta` is missing/invalid.

   **queryColdRag:**
   - Should throw on empty/null query.
   - Should return `{ context: string; docCount: number; sources: string[] }`.
   - `docCount` should be >= 0.
   - `sources` should be an array.
   - With `domain` filter, should return subset (docCount <= unfiltered). I'll test that domain filtering reduces or maintains docCount.
   - Without `domain`, should return all relevant.

   **getMemoryDebugData:**
   - Should throw on empty `sessionId`.
   - Should return debug data for a session after recording turns.
   - Should return object with session info.

   **disambiguateWithSessionMemory:**
   - Should throw on empty `sessionId`.
   - Should throw if `candidates` is empty.
   - Should return a string that is one of the candidates (contract of disambiguation).
   - Should use session memory to influence result (observable by recording a turn then disambiguating). For example, if session memory contains "apple" (fruit), disambiguating "apple" with candidates ["fruit", "company"] should return "fruit". This is a strong contract test.

   **Mocking strategy:**
   - Mock `fs` to provide deterministic documents for `initMemoryRag`.
   - Mock `fetch` if needed, but `fs` is more likely for offline cold RAG.
   - Since `queryColdRag` is sync, the corpus must be loaded into memory during `init`. So `initMemoryRag` likely reads files. I'll mock `fs.readdirSync` or `fs.readFileSync` / `fs.promises.readFile`.

   Let's write the mock:
   ```typescript
   jest.mock('fs', () => ({
     ...jest.requireActual('fs'),
     promises: {
       readFile: jest.fn().mockResolvedValue(JSON.stringify([
         { id: 'doc1', content: 'Apple is a fruit.', domain: 'agriculture' },
         { id: 'doc2', content: 'Apple Inc. makes iPhones.', domain: 'tech' }
       ])),
     },
     readdirSync: jest.fn().mockReturnValue(['corpus.json']),
   }));
   ```
   But I don't know if the module uses `fs` directly. This is a guess. However, the prompt says "Mock external deps (db/network/fs/other services) deterministically." So mocking `fs` is explicitly encouraged.

   Wait, if I mock `fs` and the module doesn't use it, the tests might still pass but the mock is unnecessary. That's acceptable.

   But there's a problem: If the module uses a different external service, say a vector DB client, I don't know its name. Mocking `fs` is a safe generic choice for an offline deterministic test.

   Let's structure the test file:

   ```typescript
   import {
     initMemoryRag,
     MemoryRagMeta,
     recordTurnAndGetMeta,
     enrichGroundedContract,
     queryColdRag,
     getMemoryDebugData,
     disambiguateWithSessionMemory,
   } from '../src/services/memoryRagHook';
   import fs from 'fs';

   jest.mock('fs', () => {
     const actual = jest.requireActual('fs');
     return {
       ...actual,
       promises: {
         ...actual.promises,
         readFile: jest.fn(),
       },
       readdirSync: jest.fn(),
     };
   });

   describe('memoryRagHook contract', () => {
     beforeEach(() => {
       jest.clearAllMocks();
       (fs.promises.readFile as jest.Mock).mockResolvedValue(
         JSON.stringify([
           { id: 'doc1', text: 'Apple is a fruit rich in fiber.', domain: 'agriculture', chunks: ['Apple is a fruit rich in fiber.'] },
           { id: 'doc2', text: 'Apple Inc. designs consumer electronics.', domain: 'tech', chunks: ['Apple Inc. designs consumer electronics.'] },
           { id: 'doc3', text: 'Banana is a tropical fruit.', domain: 'agriculture', chunks: ['Banana is a tropical fruit.'] },
         ])
       );
       (fs.readdirSync as jest.Mock).mockReturnValue(['corpus.json']);
     });

     describe('initMemoryRag', () => {
       it('resolves with non-negative docCount and chunkCount', async () => {
         const result = await initMemoryRag();
         expect(result).toEqual(expect.objectContaining({
           docCount: expect.any(Number),
           chunkCount: expect.any(Number),
         }));
         expect(result.docCount).toBeGreaterThanOrEqual(0);
         expect(result.chunkCount).toBeGreaterThanOrEqual(0);
       });

       it('rejects when external corpus is unreadable', async () => {
         (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
         await expect(initMemoryRag()).rejects.toThrow();
       });
     });

     describe('queryColdRag', () => {
       beforeEach(async () => {
         await initMemoryRag();
       });

       it('throws on empty or non-string query', () => {
         expect(() => queryColdRag('')).toThrow();
         expect(() => queryColdRag(null as any)).toThrow();
       });

       it('returns context, docCount, and sources array for valid query', () => {
         const result = queryColdRag('apple');
         expect(result).toEqual(expect.objectContaining({
           context: expect.any(String),
           docCount: expect.any(Number),
           sources: expect.any(Array),
         }));
         expect(result.docCount).toBeGreaterThanOrEqual(0);
         expect(Array.isArray(result.sources)).toBe(true);
       });

       it('filters by domain when provided, returning equal or fewer docs', () => {
         const unfiltered = queryColdRag('apple');
         const filtered = queryColdRag('apple', 'tech');
         expect(filtered.docCount).toBeLessThanOrEqual(unfiltered.docCount);
         // All sources should belong to the domain (if domain is tracked)
         // Since we don't know exact source shape, we at least assert count contract.
       });
     });

     describe('recordTurnAndGetMeta', () => {
       it('throws on invalid sessionId or missing query/response', () => {
         expect(() => recordTurnAndGetMeta('', 'q', 'r')).toThrow();
         expect(() => recordTurnAndGetMeta('sid', '', 'r')).toThrow();
         expect(() => recordTurnAndGetMeta('sid', 'q', '')).toThrow();
       });

       it('returns a MemoryRagMeta object for valid inputs', () => {
         const meta = recordTurnAndGetMeta('sid-1', 'What is Apple?', 'A fruit.');
         expect(meta).toBeDefined();
         // We cannot assert exact shape without knowing interface, but we can use it downstream.
       });
     });

     describe('enrichGroundedContract', () => {
       it('throws when structuredContent is null or ragMeta is invalid', () => {
         expect(() => enrichGroundedContract(null, {} as MemoryRagMeta)).toThrow();
         expect(() => enrichGroundedContract({}, null as any)).toThrow();
       });

       it('mutates structuredContent by enriching it with ragMeta', () => {
         const content: any = { title: 'Test' };
         const meta = recordTurnAndGetMeta('sid-2', 'Q', 'A');
         enrichGroundedContract(content, meta);
         // Contract: object should be enriched (not deep equal to original)
         expect(content).not.toStrictEqual({ title: 'Test' });
         // Or at least it should have more keys or a specific marker.
         // Since we don't know the exact enrichment, we assert it changed.
         const keys = Object.keys(content);
         expect(keys.length).toBeGreaterThan(1);
       });
     });

     describe('getMemoryDebugData', () => {
       it('throws on empty sessionId', () => {
         expect(() => getMemoryDebugData('')).toThrow();
       });

       it('returns debug data reflecting recorded turns', () => {
         recordTurnAndGetMeta('sid-3', 'Hello', 'Hi');
         recordTurnAndGetMeta('sid-3', 'Bye', 'See ya');
         const debug = getMemoryDebugData('sid-3');
         expect(debug).toBeDefined();
         expect(typeof debug).toBe('object');
         // Contract: should contain session identifier or turn count >= 2
         // We assert on a plausible property or just that it's truthy and an object.
         expect(debug).not.toBeNull();
       });

       it('returns distinct data for distinct sessions', () => {
         recordTurnAndGetMeta('sid-a', 'Q1', 'A1');
         recordTurnAndGetMeta('sid-b', 'Q2', 'A2');
         const debugA = getMemoryDebugData('sid-a');
         const debugB = getMemoryDebugData('sid-b');
         expect(debugA).not.toStrictEqual(debugB);
       });
     });

     describe('disambiguateWithSessionMemory', () => {
       it('throws on empty sessionId, query, or empty candidates', () => {
         expect(() => disambiguateWithSessionMemory('', 'q', ['a'])).toThrow();
         expect(() => disambiguateWithSessionMemory('sid', '', ['a'])).toThrow();
         expect(() => disambiguateWithSessionMemory('sid', 'q', [])).toThrow();
       });

       it('returns one of the provided candidates', () => {
         const candidates = ['fruit', 'company', 'band'];
         const result = disambiguateWithSessionMemory('sid-4', 'apple', candidates);
         expect(candidates).toContain(result);
       });

       it('uses session memory to bias disambiguation', () => {
         // Record turn about agriculture
         recordTurnAndGetMeta('sid-5', 'Tell me about fruits', 'Apple is a fruit.');
         const candidates = ['fruit', 'company'];
         const result = disambiguateWithSessionMemory('sid-5', 'apple', candidates);
         // Contract: session memory about fruit should bias toward 'fruit'
         expect(result).toBe('fruit');
       });
     });
   });
   ```

   Issues with this draft:
   - `recordTurnAndGetMeta` signature assumption: `(sessionId: string, query: string, response: string)`. If the real signature is different, this breaks. But I have to assume.
   - `disambiguateWithSessionMemory` signature assumption: `(sessionId: string, query: string, candidates: string[])`. Same.
   - `getMemoryDebugData` return type: I used it as returning an object. Fine.
   - `enrichGroundedContract`: I asserted `content`
