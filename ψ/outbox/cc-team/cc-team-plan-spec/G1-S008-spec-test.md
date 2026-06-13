<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S008 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":343,"completion_tokens":7000,"total_tokens":7343,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 89s
 generated: 2026-06-13T11:22:19.422Z -->
The user wants a Jest contract/behavior test for a module called `fastPathHandler` from `../src/services/fastPathHandler`. I only have the public API surface (signatures), not the implementation. I need to infer behavior from names and signatures.

Public API:
1. `trigToDeg(expr: string): string` - Converts a trigonometric expression to degrees? Or converts trig functions to degrees? Likely takes a string expression and returns a string. Contract: valid string -> string output. Invalid/empty -> maybe throw or return specific value? Given name, probably converts radians to degrees or formats trig expressions.
2. `cleanFloat(val: number): string` - Cleans/formats a float. Contract: number -> string. NaN/Infinity? Probably throw or return something. Let's assume it throws on invalid numbers or returns a specific string. I'll test valid numbers return formatted strings, and edge cases like NaN/Infinity throw.
3. `FastPathMode = "off" | "on"` - Type.
4. `FastPathHandlerOptions` - Interface. Fields unknown. I need to infer likely fields from usage in other functions. `createFastPathExpressMiddleware(opts = {})`, `getExtraPhrases(opts)`, `handleFastPathMessage(...)`, `tryFastPathWebSocket(...)`. Likely includes `mode?: FastPathMode`, `extraFilePath?: string`, `extraUrl?: string`, `responder?: Responder`, etc. But I don't know exact fields. I should define a minimal mock object that satisfies the type. Since TS is strict, I need to be careful. However, since I don't know the exact shape, I might need to cast or use `as any`? No, strict TS. But the prompt says "Strict TS". If I don't know the interface members, I can't create a valid object without TS errors unless I use empty object and cast, or if all members are optional. Given `opts = {}` default, `FastPathHandlerOptions` likely has all optional fields. So `{}` is valid. Good.
5. `FastPathDecision` - Interface. Unknown shape. Probably used as return type or parameter. I might not need to instantiate it directly if functions return it.
6. `Responder = (payload: any) => Promise<void> | void` - Type.
7. `ExtraPhrases` - Type alias (not exported). `type ExtraPhrases = { ... }`. Unknown shape. But `tryReadExtraFromFile`, `tryReadExtraFromUrl`, `getExtraPhrases` return it. Since it's not exported, I can't reference it directly in test assertions unless I infer shape. I'll treat it as an object and check properties if I knew them. Since I don't, I'll assert it's an object or has certain behavior. Wait, contract test should assert values/state. If I don't know the shape of `ExtraPhrases`, I can still assert that `getExtraPhrases` resolves to an object, or that merging happens. But I need to be more concrete. Let's infer `ExtraPhrases` is probably `{ phrases?: string[] }` or similar. Actually, from `tryReadExtraFromFile` and `tryReadExtraFromUrl`, it likely reads some phrase definitions. Maybe it's `{ [key: string]: string }` or `{ phrases: string[] }`. I'll assume it has a `phrases` array or is a record. But I must be careful not to overfit. Let's look at function names:
   - `tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases>`
   - `tryReadExtraFromUrl(url: string): Promise<ExtraPhrases>`
   - `getExtraPhrases(opts: FastPathHandlerOptions): Promise<ExtraPhrases>`
   - `handleFastPathMessage(...)` likely uses these.
   - `tryFastPathWebSocket(...)` likely uses these.

Given the module name `fastPathHandler` and `ExtraPhrases`, this seems like an MCP (Model Context Protocol) or similar "fast path" for handling messages. `ExtraPhrases` likely adds extra trigger phrases.

Since I cannot know the exact shape, I should write tests that assert on the contract implied by the names and the relationships between functions. For example:
- `trigToDeg('sin(90)')` should return something containing degrees or converted value. But I don't know exact algorithm. Hmm. Contract testing with only signatures is tricky. I need to make reasonable assumptions and test boundaries.

Let's think about each function's likely contract:

**`trigToDeg(expr: string): string`**
- Input: string representing a trigonometric expression (e.g., "sin(PI/2)").
- Output: string with radians converted to degrees, or trig func names modified? Actually `trigToDeg` likely replaces `sin`, `cos`, `tan` with versions that interpret arguments as degrees, or converts the expression. A common utility in calculators: `trigToDeg("sin(90)")` -> maybe `"sin(deg2rad(90))"` or just computes it? But signature is string->string, not number. So it's a transformation of the expression string.
- Contract: non-empty string -> string. Empty string -> throw or return empty? Invalid expression -> throw? Let's assume it throws on empty or non-string. But signature says string. In TS, runtime could get non-string. Contract: if not string, throw TypeError. If empty, maybe return empty or throw. I'll test: valid expr returns string; empty string throws or returns empty; non-string throws.

**`cleanFloat(val: number): string`**
- Input: number.
- Output: string representation, cleaned (e.g., removes trailing zeros, handles -0).
- Contract: finite number -> string. NaN/Infinity -> throw. Non-number -> throw.
- I'll assert: `cleanFloat(1.23000)` returns `'1.23'` (or similar). `cleanFloat(0)` returns `'0'`. `cleanFloat(NaN)` throws. `cleanFloat(Infinity)` throws.

**`tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases>`**
- Not exported! Wait, the signature shows `async function tryReadExtraFromFile...` without `export`. But in the list, it's shown as part of public API surface? The user says "public API surface" but some are not exported. Actually the prompt says:
  `async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {`
  It doesn't have `export`. But then later:
  `export async function handleFastPathMessage(...`
  `export function createFastPathExpressMiddleware(...`
  `export async function tryFastPathWebSocket(...`
  So `tryReadExtraFromFile`, `tryReadExtraFromUrl`, `getExtraPhrases` might be internal but still listed. The prompt says "Module: fastPathHandler — public API surface". Maybe they are exported but the `export` keyword was omitted in the snippet? Or maybe they are truly internal. However, the import is `import ... from '../src/services/fastPathHandler';`. If they are not exported, I cannot import them. The prompt lists them, so I should probably test the exported ones. But `getExtraPhrases` also lacks `export` in the snippet. Hmm.
  Let's re-read carefully:
  ```
  export function trigToDeg(expr: string): string {
  export function cleanFloat(val: number): string {
  export type FastPathMode = "off" | "on";
  export interface FastPathHandlerOptions {
  export interface FastPathDecision {
  export type Responder = (payload: any) => Promise<void> | void;
  type ExtraPhrases = {
  async function tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases> {
  async function tryReadExtraFromUrl(url: string): Promise<ExtraPhrases> {
  async function getExtraPhrases(opts: FastPathHandlerOptions): Promise<ExtraPhrases> {
  export async function handleFastPathMessage(
  export function createFastPathExpressMiddleware(opts: FastPathHandlerOptions = {}) {
  export async function tryFastPathWebSocket(
  ```
  Only some have `export`. The ones without `export` are internal. But the prompt says "public API surface". This is ambiguous. Maybe the user copy-pasted and missed exports. Or maybe they want me to test only exported ones. But they listed them. If I can't import them, I can't test them directly. However, I can test them indirectly through the exported functions that use them (like `handleFastPathMessage`, `getExtraPhrases`? wait `getExtraPhrases` is not exported). Actually, `handleFastPathMessage` and `tryFastPathWebSocket` likely call `getExtraPhrases` internally.
  
  Given the instruction "Import EXACTLY: import ... from '../src/services/fastPathHandler';", I should import the exported symbols. I will only import the exported functions/types. For internal ones, if they are not exported, I cannot test them directly. But maybe I should assume they ARE exported because they are listed in the API surface. The prompt might have a typo. Let's assume the async functions are also exported, or at least `getExtraPhrases` is. But `type ExtraPhrases` is not exported either. This makes it hard.
  
  Actually, looking at the pattern, maybe the user wants me to test ALL of these as if they are the public API. The missing `export` keywords might be a formatting issue. I will import and test all functions listed, assuming they are exported. But wait, `type ExtraPhrases` is not exported, so I can't import it. I can just import the functions. I'll use `any` or infer the return type.
  
  Let's decide: I will import all named exports that appear exported. For the ones without `export` keyword in the snippet, I will assume they are exported for the purpose of the test, OR I will test them indirectly. But the prompt says "public API surface". I'll include them in the import list. If they are not exported, TS will complain. To be safe, I should only import what is explicitly marked `export`. Those are:
  - `trigToDeg`
  - `cleanFloat`
  - `FastPathMode`
  - `FastPathHandlerOptions`
  - `FastPathDecision`
  - `Responder`
  - `handleFastPathMessage`
  - `createFastPathExpressMiddleware`
  - `tryFastPathWebSocket`
  
  The ones NOT exported:
  - `ExtraPhrases`
  - `tryReadExtraFromFile`
  - `tryReadExtraFromUrl`
  - `getExtraPhrases`
  
  Since `ExtraPhrases` is not exported, I can't reference it as a type. But `tryReadExtraFromFile` etc. return it. If they are not exported, I can't test them. However, `handleFastPathMessage` likely uses `getExtraPhrases` internally. So I can mock `fs` and `fetch` to control the behavior of the internal functions, and then test the exported functions' contracts.
  
  But the prompt says "Mock external deps (db/network/fs/other services) deterministically." So I should mock `fs` for file reading and `fetch` or `http` for URL reading. This implies the internal functions `tryReadExtraFromFile` and `tryReadExtraFromUrl` use `fs` and `fetch`. By mocking these, I can test the exported functions that depend on them.
  
  However, the prompt also says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." and "Test observable behavior/contracts implied by the names+signatures".
  
  Let's plan the test file structure:
  
  **Imports:**
  ```typescript
  import {
    trigToDeg,
    cleanFloat,
    handleFastPathMessage,
    createFastPathExpressMiddleware,
    tryFastPathWebSocket,
    type FastPathHandlerOptions,
    type FastPathDecision,
    type Responder,
    type FastPathMode,
  } from '../src/services/fastPathHandler';
  ```
  Note: `type` imports for types.
  
  **Mocks:**
  - Mock `fs/promises` for file reading.
  - Mock `node-fetch` or global `fetch` for URL reading. Since it's Node, maybe `fetch` is global in newer versions, or `axios`. I'll mock `fs` and global `fetch`.
  
  **Tests for `trigToDeg`:**
  - Contract: transforms trigonometric expression string to degree equivalent.
  - Valid: `trigToDeg('sin(90)')` returns a string. Maybe it wraps args? Let's assume it converts radian values to degrees inside the expression. For example `trigToDeg('sin(PI/2)')` -> `'sin(90)'`? Or `trigToDeg('sin(90)')` -> `'sin(deg2rad(90))'`? The name is `trigToDeg`, suggesting "trig to degrees". Maybe it converts an expression assuming radians to degrees. E.g., `trigToDeg('sin(1.5708)')` -> `'sin(90deg)'`. This is too speculative.
  
  Wait, maybe `trigToDeg` is simpler: it takes a string like `"sin"` and returns `"sind"` (degree version). Or it takes an expression and replaces `sin(` with `sinD(`.
  Actually, in many engineering apps, `trigToDeg` might mean: given a trig function name/expression, return the degree variant. But without implementation, I need to define the contract based on what is OBSERVABLE.
  
  The key insight for contract testing with only signatures: I should test the shape of the contract, not the exact business logic. For example:
  - `trigToDeg` accepts a string and returns a string.
  - It should throw if given a non-string (but TS prevents this, runtime contract).
  - It should handle empty string gracefully or throw.
  - The returned string should be different from input if input contains trig functions? No, that's too specific.
  
  Actually, the user says "correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions." So I need to guess what "correct output" means based on the name.
  
  Let's think about `trigToDeg`:
  - If input is `"sin(90)"`, maybe output is `"sin(90 * PI / 180)"` or something. But that's rad to deg conversion of the argument.
  - Another interpretation: `trigToDeg` converts a result from radians to degrees, but input/output are strings? Unlikely.
  - Maybe it's a formatting utility for calculator displays: `trigToDeg('0.7071')` -> `'45°'`? No, `expr` suggests expression.
  - Let's search my internal knowledge: Is there a known module `innomcp-node`? No.
  - Maybe `trigToDeg` replaces all occurrences of `sin`, `cos`, `tan` with `sinDeg`, `cosDeg`, `tanDeg` or wraps arguments. Let's assume it converts the arguments of trig functions from radians to degrees by multiplying by `PI/180`. But that's `degToRad`. `trigToDeg` would convert the trig function to accept degrees. So `sin(x)` becomes `sin(x * PI / 180)`. Wait, if you want to compute `sin` of an angle given in degrees, you convert degrees to radians: `sin(deg * PI/180)`. So `trigToDeg` might transform the expression so that trig functions treat the input as degrees. E.g., `trigToDeg('sin(90)')` -> `'sin(90 * Math.PI / 180)'`.
  - Or it could be simpler: `trigToDeg('90')` -> `'90°'`. But `expr` is expression.
  
  Given the ambiguity, I should write tests that are somewhat generic but assert on plausible behavior. However, if my guess is wrong, the test is useless. But the user explicitly asks to test the contract implied by names+signatures. So I must make reasonable inferences.
  
  Let's infer:
  - `trigToDeg(expr: string): string`: Converts a trigonometric expression to use degrees. So if expr is `"sin(90)"`, it returns `"sin(90 * PI / 180)"`? No, that would be `trigToRad`. Actually, standard math: `sin` takes radians. To make it take degrees, you write `sin(deg * PI/180)`. So `trigToDeg` likely inserts `* PI/180` inside trig function arguments. Or maybe it just appends `deg` unit.
  - `cleanFloat(val: number): string`: Formats a float nicely, e.g., removes trailing zeros and unnecessary decimals. `1.0` -> `'1'`, `1.23000` -> `'1.23'`.
  
  Let's look at the other functions for context. `fastPathHandler` seems to be part of a message handling system (MCP). `handleFastPathMessage` likely checks if a message matches "fast path" criteria (extra phrases) and decides to handle it. `createFastPathExpressMiddleware` creates Express middleware. `tryFastPathWebSocket` handles WebSocket.
  
  `FastPathHandlerOptions` likely has:
  - `mode?: FastPathMode` ('on' or 'off')
  - `extraFilePath?: string`
  - `extraUrl?: string`
  - `responder?: Responder`
  - `decisionCallback?: (decision: FastPathDecision) => void`? Not sure.
  
  `FastPathDecision` likely has:
  - `handled: boolean`
  - `mode: FastPathMode`
  - maybe `reason?: string`
  
  Since I don't know, I'll define tests that assert on the existence of properties and the general flow.
  
  Actually, maybe I should focus on testing the functions whose contracts are clearer from signatures alone, and for the complex ones, test integration with mocks.
  
  **Strategy:**
  1. Mock `fs/promises` and global `fetch`.
  2. Test `trigToDeg`:
     - Returns string for valid expr.
     - Throws for empty string.
     - Throws for non-string (but in TS tests, we can pass `null as any`).
  3. Test `cleanFloat`:
     - Returns string for valid number.
     - Cleans trailing zeros (e.g., `1.23000` -> `'1.23'`).
     - Returns `'0'` for `0`.
     - Throws for `NaN`, `Infinity`.
     - Throws for non-number.
  4. Test `createFastPathExpressMiddleware`:
     - Returns a function `(req, res, next) => ...` (Express middleware signature).
     - When `mode` is `"off"`, calls `next()` immediately (or doesn't handle).
     - When `mode` is `"on"`, it might try to read extra phrases and handle messages.
     - But without knowing `req/res` shape, it's hard. However, Express middleware contract is clear: it's a function with `(req, res, next)` arguments.
     - I can assert the returned value is a function.
     - I can call it with mock `req`, `res`, `next` and assert `next` is called under certain conditions.
  5. Test `handleFastPathMessage`:
     - Signature is incomplete in prompt: `export async function handleFastPathMessage(`. I need to infer parameters. Likely `(message: string, opts: FastPathHandlerOptions)` or `(req: any, res: any, opts: FastPathHandlerOptions)`. Actually, looking at the middleware, `handleFastPathMessage` probably takes a message payload and options.
     - Wait, the signature is cut off. I have to guess. Maybe it's `handleFastPathMessage(payload: any, opts: FastPathHandlerOptions): Promise<FastPathDecision>`.
     - Or `handleFastPathMessage(message: string, opts: FastPathHandlerOptions): Promise<boolean>`.
     - Given `Responder = (payload: any) => Promise<void> | void;`, maybe `handleFastPathMessage` takes a `payload` and `responder`.
     - Let's assume: `handleFastPathMessage(payload: any, opts: FastPathHandlerOptions): Promise<FastPathDecision>`.
     - Contract: if mode is off, returns decision with handled=false.
     - if mode is on and payload matches, returns handled=true and calls responder.
     - But I don't know the matching logic. Maybe it uses `getExtraPhrases` to load phrases and checks if payload contains them.
     - I can mock `fs` to return extra phrases, then test that it handles based on those phrases.
  6. Test `tryFastPathWebSocket`:
     - Likely takes a WebSocket or connection and opts. Signature cut off. Maybe `(ws: WebSocket, opts: FastPathHandlerOptions): Promise<void>`.
     - Hard to test without signature.
  
  Given the incomplete signatures, I need to be very careful. The prompt shows:
  `export async function handleFastPathMessage(`
  `export function createFastPathExpressMiddleware(opts: FastPathHandlerOptions = {}) {`
  `export async function tryFastPathWebSocket(`
  The signatures are incomplete. I must infer the parameters.
  
  Let's think about typical MCP (Model Context Protocol) fast path. In MCP, a "fast path" might bypass normal routing. `handleFastPathMessage` probably takes a message object. `tryFastPathWebSocket` probably takes a socket and opts.
  
  However, the user might have intentionally given incomplete signatures to see if I can write contract tests based purely on names and partial signatures. The key is to test the CONTRACT, not the implementation.
  
  Maybe I should write tests that are as generic as possible while still being meaningful. For example:
  - For `trigToDeg`: test that it returns a string, and that the output for a known trig expression is mathematically correct (e.g., `trigToDeg('sin(90)')` results in a string that evaluates to the sin of 90 degrees). But evaluating is too much.
  - Actually, maybe `trigToDeg` simply converts a numeric string from radians to degrees? Like `trigToDeg('1.5708')` -> `'90'`? No, `expr` suggests expression.
  
  Let's reconsider. Maybe `trigToDeg` and `cleanFloat` are pure utility functions with clear contracts:
  - `trigToDeg(expr)`: Replaces all trig function calls `sin(x)`, `cos(x)`, `tan(x)` with degree versions. A common pattern in expression parsers: `trigToDeg("sin(90)")` -> `"sin(90 * PI / 180)"`. But that changes the value. Wait, if the original expression is meant to be in degrees (e.g., user writes `sin(90)` meaning 90 degrees), converting to radians for JS Math would be `sin(90 * PI/180)`. So `trigToDeg` likely means "convert an expression written with degrees to a radian-compatible expression". So `trigToDeg('sin(90)')` -> `'sin(90 * Math.PI / 180)'`. That makes sense: "trig to deg" might be a misnomer, or it means "adapt trig expression for degree input". Actually, the name `trigToDeg` could mean "convert trig result to degrees", but input is string.
  
  Another possibility: `trigToDeg` converts an angle expression to degrees. E.g., `trigToDeg('PI/2')` -> `'90'`. But then why `expr`?
  
  Let's look at `cleanFloat`. This is likely formatting: `cleanFloat(1.0)` -> `'1'`, `cleanFloat(1.2300)` -> `'1.23'`, `cleanFloat(-0.0)` -> `'0'`. It might also limit precision.
  
  For the async functions, the contract is about reading extra phrases from file/URL and handling messages.
  - `getExtraPhrases(opts)`: If `opts.extraFilePath` provided, reads file; if `opts.extraUrl` provided, fetches URL; merges them; returns phrases.
  - `handleFastPathMessage(payload, opts)`: Uses `getExtraPhrases` to decide if payload is a fast path. If yes, calls `responder` and returns decision.
  - `createFastPathExpressMiddleware(opts)`: Returns Express middleware that calls `handleFastPathMessage` on request body.
  - `tryFastPathWebSocket(ws, opts)`: Attaches listener to WebSocket messages and calls `handleFastPathMessage`.
  
  This is a plausible architecture. I will write tests based on this architecture.
  
  **Detailed Plan:**
  
  *Mocks:*
  - `jest.mock('fs/promises', () => ({ readFile: jest.fn() }));`
  - Mock global `fetch` or `node-fetch`.
  
  *Tests for `trigToDeg`:*
  - `it('returns a string for a valid trigonometric expression', () => { expect(typeof trigToDeg('sin(90)')).toBe('string'); })` -> But user wants assert VALUES, not just type. So I need to assert a value. Let's assume it converts degree inputs to radian expressions. `expect(trigToDeg('sin(90)')).toBe('sin(90 * PI / 180)')`? That's too specific. What if it uses `Math.PI`?
  - Maybe it converts the result: `trigToDeg('1.5708')` -> `'90.000...'`. But `expr` is expression.
  - Let's assume it wraps trig arguments: `trigToDeg('sin(90) + cos(180)')` returns something like `'sin(90 * PI / 180) + cos(180 * PI / 180)'`. I'll assert that the output contains `* PI / 180` or `Math.PI`. But if implementation differs, test fails. However, as a contract test based on name, this is a reasonable inference.
  - Alternative: Maybe `trigToDeg` takes a result of a trig function (in radians) and converts to degrees string. E.g., `trigToDeg(String(Math.asin(1)))` -> `'90'`. But input is `expr`, not `value`.
  - I think the safest is to test that for an input containing a trig function and a number, the output is a transformed string that is different and longer (or contains specific substring). But the user wants exact values. Hmm.
  - Let's pivot: maybe `trigToDeg` simply appends a degree symbol or converts a numeric string to degrees. But `expr` strongly suggests expression.
  - Another idea: In some geometry libs, `trigToDeg('N 45 E')` -> bearing. No.
  - Let's look at the module name again: `innomcp-node`. "inno" might be "innovation". Not helpful.
  - Maybe `trigToDeg` is a utility to convert a string like `"asin(1)"` to `"90"`. No, that would be `evalTrigToDeg`.
  
  I think I need to make a strong, plausible assumption and document it via test description. The contract is: given a trigonometric expression where angles are in degrees, return an equivalent expression where angles are in radians (so JS Math can evaluate it). Or vice versa.
  
  Actually, `trigToDeg` could mean: convert the argument of trig functions from radians to degrees. So `sin(PI/2)` becomes `sin(90)`. That is more literally "trig to degrees". It transforms the expression so that angles are expressed in degrees. So `trigToDeg('sin(Math.PI / 2)')` -> `'sin(90)'`. This is a very literal interpretation.
  
  Let's go with: `trigToDeg` takes an expression with radians and converts the numeric angle parts to degrees. But parsing that is complex.
  
  Maybe it's simpler: `trigToDeg` just converts a single number string from radians to degrees. `trigToDeg('1.5708')` -> `'90.0002...'`. But why `expr`?
  
  Let's reconsider `cleanFloat`. This is definitely a formatter. `cleanFloat(1.23000)` -> `'1.23'`. `cleanFloat(0)` -> `'0'`. `cleanFloat(-0)` -> `'0'`. `cleanFloat(1e-10)` -> `'0.0000000001'` or `'1e-10'`? Probably removes scientific notation? Not sure.
  
  For `cleanFloat`, I can test:
  - `cleanFloat(1.0)` returns `'1'` (or `'1.0'`?). If it cleans trailing zeros, `'1'`.
  - `cleanFloat(1.23000)` returns `'1.23'`.
  - `cleanFloat(0)` returns `'0'`.
  - `cleanFloat(NaN)` throws.
  - `cleanFloat(Infinity)` throws.
  
  These are solid contract tests.
  
  For `trigToDeg`, maybe I can test similarly:
  - `trigToDeg('0')` returns `'0'`.
  - `trigToDeg('90')` returns `'90'`.
  - `trigToDeg('sin(90)')` returns a string. But what value?
  
  Wait, maybe `trigToDeg` converts a string representation of a number (in radians) to degrees. Like `trigToDeg(String(Math.PI/2))` -> `'90'`. But then it would be `radToDeg`. The name is `trigToDeg`. Maybe it converts a trig ratio to degrees? Like `trigToDeg('1')` (asin) -> `'90'`. No.
  
  Let's search for similar function names. In some codebases, `trigToDeg` is a function that takes an expression and converts all `sin`, `cos`, `tan` to `sinD`, `cosD`, `tanD` (degree versions). So `trigToDeg('sin(90)')` -> `'sinD(90)'`. This is plausible. The contract would be: replaces trig function names with their degree counterparts. I can test that the output contains `sinD` instead of `sin`. But I don't know if it uses `sinD` or `sind` or `sin_deg`.
  
  Another common pattern: `trigToDeg` converts angles inside an expression from radians to degrees. For example, in a CAD program, you might have `sin(PI/2)` and want `sin(90)`. It finds numbers and multiplies by `180/PI`. But that's hard.
  
  Given the difficulty, maybe I should test `trigToDeg` with very loose assertions but still value-based? The user said "Assert VALUES/STATE (toBe/toEqual/toThrow)". So `toBe` with an exact string. If I guess wrong, it's bad. But maybe the function is actually very simple: it just evaluates the expression and converts the result? No, it's string->string.
  
  Let's think about the context: `fastPathHandler` for an MCP node module. `trigToDeg` and `cleanFloat` seem like random utility functions included in the same file. They might be used to format numbers in messages. `cleanFloat` cleans a float. `trigToDeg` might convert a float value (as string) to degrees. Wait, what if `expr` is actually a number passed as string? Like `trigToDeg('1.5708')` -> `'90.000...'`. It converts radians to degrees. The name `trigToDeg` is weird but could mean "trigonometric value to degrees". For example, you have an angle in radians as a string, convert to degrees string. But then `parseFloat` + `*180/PI` would do it.
  
  Let's assume `trigToDeg` converts a numeric string (angle in radians) to a degree string.
  - `trigToDeg('0')` -> `'0'`
  - `trigToDeg('3.141592653589793')` -> `'180'`
  - `trigToDeg('1.5707963267948966')` -> `'90'`
  This is a very clear contract and fits the name somewhat (trig context, degrees). But the param name `expr` suggests expression, not just a number. However, maybe it's a loose name.
  
  Actually, if `expr` is an expression, `trigToDeg('Math.PI / 2')
