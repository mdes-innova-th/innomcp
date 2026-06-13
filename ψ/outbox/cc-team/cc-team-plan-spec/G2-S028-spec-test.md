<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S028 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":243,"completion_tokens":7000,"total_tokens":7243,"prompt_tokens_details":{"cached_tokens":71,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T11:27:45.620Z -->
The user wants a Jest contract/behavior test for a module called `toolExecutor`. I only have the public API surface (signatures, not implementation). I need to infer the intended behavior from the names and signatures.

Given API surface:
```typescript
export class ToolTimeoutError extends Error {
  constructor() {
export class ToolParamError extends Error {
  constructor() {
export interface ToolDefinition {
export interface ExecOptions {
export interface ToolResult {
export interface ToolDefinitionPublic {
export class ToolExecutor extends EventEmitter {
  async execute(
export default ToolExecutor;
```

From the names:
- `ToolExecutor` extends `EventEmitter`. It likely emits events about tool execution lifecycle.
- `execute` is async. It probably takes a tool name/id, parameters, and options, and returns a `ToolResult`.
- `ToolDefinition` likely defines a tool (name, handler function, parameters schema, timeout, etc.).
- `ExecOptions` likely contains execution options (timeout override, etc.).
- `ToolResult` likely contains the result (content, isError, etc.).
- `ToolDefinitionPublic` is probably a sanitized/public version of ToolDefinition.
- `ToolTimeoutError` and `ToolParamError` are specific error types.

Since I don't have the exact signatures, I need to make reasonable inferences based on standard patterns for such modules and test the CONTRACT.

Key behaviors to test:
1. **Construction/Registration**: ToolExecutor probably accepts a registry of ToolDefinitions or has a method to register them. Wait, the public API only shows `execute` and the class itself. Maybe the constructor takes an array of `ToolDefinition`? Or maybe `execute` takes a `ToolDefinition` directly? Given the name `ToolExecutor`, it likely executes tools by name from a registry provided at construction. Let's assume constructor takes `ToolDefinition[]` or a registry map. But I must be careful: I only have the signatures shown. The prompt says "public API surface (signatures)". The snippet is truncated. I need to infer the most logical contract.

Let's look at the truncated lines:
- `export class ToolTimeoutError extends Error { constructor() {` -> likely no args or specific args.
- `export class ToolParamError extends Error { constructor() {` -> same.
- `export interface ToolDefinition {` -> likely has name, handler, parameters, timeout?
- `export interface ExecOptions {` -> likely timeout, signal?
- `export interface ToolResult {` -> likely content, isError?
- `export interface ToolDefinitionPublic {` -> public view of tool def.
- `export class ToolExecutor extends EventEmitter { async execute(` -> likely `execute(toolName: string, params: object, options?: ExecOptions): Promise<ToolResult>`.

Since I don't know the exact constructor signature, I should infer it. A common pattern is:
`constructor(tools: ToolDefinition[], defaultOptions?: ExecOptions)` or similar.
Alternatively, it could be `constructor(registry: Map<string, ToolDefinition>)`.

But the prompt says "test observable behavior/contracts implied by the names+signatures". I need to write a test that imports exactly `import ... from '../src/services/toolExecutor';`.

I need to decide on a plausible API and test it. The test must compile in strict TS, so I need to define the inferred types in a way that matches the real module. Since I don't have the real module, I must write the test assuming a very standard, logical API derived from the names.

Let's define the assumed API:
- `ToolDefinition`: `{ name: string; handler: (params: any) => any | Promise<any>; timeout?: number; parameters?: { type: 'object'; properties: Record<string, any>; required?: string[] } }` (or similar). But maybe simpler: `name`, `description`, `handler`, `schema`.
- `ExecOptions`: `{ timeout?: number; }`
- `ToolResult`: `{ content: any; isError?: boolean }` or `{ type: 'text'; text: string }[]`. Actually, MCP (Model Context Protocol) uses `ToolResult` with `content: Array<{type: 'text' | 'image', ...}>`. The module name is `innomcp-node`, suggesting Model Context Protocol. In MCP, `CallToolResult` has `content: TextContent | ImageContent | ...` and `isError?: boolean`.
- `ToolDefinitionPublic`: `{ name: string; description?: string; inputSchema?: object }` (public schema, no handler).
- `ToolExecutor`: constructor might take `tools: ToolDefinition[]`. It might have a `getPublicDefinitions()` method returning `ToolDefinitionPublic[]`? The API surface doesn't show it, but `ToolDefinitionPublic` implies there's a way to get public definitions. However, the prompt only lists what's shown. I should stick to testing what's implied by the shown signatures plus logical behavior.

Wait, the prompt says "public API surface (signatures)". It lists:
- `ToolTimeoutError`
- `ToolParamError`
- `ToolDefinition`
- `ExecOptions`
- `ToolResult`
- `ToolDefinitionPublic`
- `ToolExecutor` with `async execute`
- `default ToolExecutor`

So the main class is `ToolExecutor` with `execute`. The errors are thrown under specific conditions.

Contract tests:
1. `execute` resolves with `ToolResult` when a valid tool is called with valid params.
2. `execute` throws `ToolParamError` when params are invalid (e.g., missing required, wrong type).
3. `execute` throws `ToolTimeoutError` when the tool exceeds the timeout (from definition or `ExecOptions`).
4. `execute` throws if tool name is not found (maybe generic Error? Not specified, but logical).
5. `ToolExecutor` extends `EventEmitter`, so it should emit events like `start`, `complete`, `error`. Contract: listeners can be attached and are called.
6. Boundary: empty params, zero timeout, long execution.

Since I must mock external deps deterministically, and the tool handler might be an external service or just a function. If `ToolDefinition` includes a `handler`, that's internal logic, not an external dep. But if `ToolExecutor` calls out to network/fs/db, I need to mock. However, the module name suggests it executes tools. The tools themselves might be functions. But to make it a contract test, I can define tools that use mocked external services (e.g., a tool that reads a file using `fs`). But I don't know the exact shape.

Alternative: The `ToolExecutor` might not care about external deps itself; the tool handlers are provided by the user. So the contract is about orchestration: parameter validation, timeout enforcement, error mapping, event emission.

Let's assume the constructor is something like:
```typescript
class ToolExecutor extends EventEmitter {
  constructor(tools: ToolDefinition[]);
  async execute(name: string, params: Record<string, unknown>, options?: ExecOptions): Promise<ToolResult>;
}
```

And `ToolDefinition` is:
```typescript
interface ToolDefinition {
  name: string;
  handler: (params: any) => any | Promise<any>;
  timeout?: number;
  parameters?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

`ExecOptions`:
```typescript
interface ExecOptions {
  timeout?: number;
}
```

`ToolResult`:
```typescript
interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
```

`ToolDefinitionPublic`:
```typescript
interface ToolDefinitionPublic {
  name: string;
  parameters?: object;
}
```

But I need to be careful: if the real module has different property names, the test won't compile. However, the user is asking me to write a test based ONLY on the public API surface. This is a design exercise. I should make the inferred types explicit in the test by using them as imported types, but since I don't know the exact shape, I should use `any` or rely on the imported types where possible? No, strict TS means I need to be type-safe.

Actually, I can import the types and use them. If I write:
```typescript
import ToolExecutor, { ToolDefinition, ExecOptions, ToolResult, ToolTimeoutError, ToolParamError } from '../src/services/toolExecutor';
```
Then I can construct objects that satisfy the interfaces. But I don't know the interface shapes. I can use `as ToolDefinition` or satisfy the minimal inferred shape.

Wait, in TypeScript, if an interface has unknown members, I can't just create an object with guessed members and cast it unless I use `as unknown as ToolDefinition` or the object actually satisfies the interface. But if the interface is empty (`export interface ToolDefinition {}`), any object satisfies it. The snippet shows `export interface ToolDefinition {` with the body cut off. It could be empty or have members.

Given the truncated snippet, the safest assumption is that the interfaces are not empty but I don't know the exact fields. However, for a contract test, I need to use the types. If I use `as any` casts, strict TS might complain if the function expects specific types.

But the prompt says "Strict TS". So I need to write code that would compile against the real module. Since I don't have the real module, I must infer the most standard/common shape for an MCP tool executor and use it.

Let's look at the MCP SDK for reference. In MCP, a tool definition typically looks like:
```typescript
interface Tool {
  name: string;
  description?: string;
  inputSchema: z.Schema | JSONSchema;
  handler: (args: any) => Promise<CallToolResult>;
}
```

And `CallToolResult` is:
```typescript
interface CallToolResult {
  content: (TextContent | ImageContent | EmbeddedResource)[];
  isError?: boolean;
}
```

Given the module name `innomcp-node`, it's likely an internal MCP node implementation. The `ToolExecutor` probably executes tools by name.

Let's assume:
- `ToolDefinition` has at least `name: string` and `handler: (params: any) => Promise<any>` or similar.
- `ToolDefinitionPublic` has `name: string` and maybe `description` and `parameters`.
- `ExecOptions` has `timeout?: number`.
- `ToolResult` has `content: any[]` and `isError?: boolean`.

But to be safe in the test, I can define helper functions that return objects typed as these interfaces using `satisfies` or explicit typing if I know the shape. Since I don't, I should use the minimal possible shape and rely on structural typing. If `ToolDefinition` requires specific fields, my test will fail compilation. So I need to make educated guesses.

Let's reconsider. Maybe the `ToolExecutor` constructor takes no arguments, and tools are registered via a method not shown? No, the API surface only shows `execute`. But the snippet is truncated. It might have more methods. The prompt says "public API surface" and lists what it lists. I should focus on testing `execute` and the errors.

Perhaps `execute` signature is:
`async execute(definition: ToolDefinition, params: object, options?: ExecOptions): Promise<ToolResult>`
or
`async execute(name: string, params: object, options?: ExecOptions): Promise<ToolResult>`

If it takes `ToolDefinition` directly, then `ToolDefinitionPublic` might be what you pass? No, `Public` suggests a sanitized version.

Let's think about the name `ToolExecutor`. It likely executes tools from a registry. The registry is probably passed to the constructor. Let's assume:
```typescript
constructor(tools: ToolDefinition[])
```

And `ToolDefinition` is:
```typescript
interface ToolDefinition {
  name: string;
  handler: (params: any) => Promise<ToolResult>;
  timeout?: number;
  parameters?: object; // JSON schema
}
```

Actually, if the handler returns `ToolResult`, then `execute` just wraps it with validation and timeout. That's a very clean contract.

Let's go with this assumption:
- `ToolDefinition`: `{ name: string; description?: string; parameters?: object; handler: (params: any) => Promise<ToolResult> | ToolResult; timeout?: number; }`
- `ExecOptions`: `{ timeout?: number; }`
- `ToolResult`: `{ content: Array<{ type: 'text'; text: string }>; isError?: boolean; }` (MCP standard)
- `ToolDefinitionPublic`: `{ name: string; description?: string; parameters?: object; }`

But the prompt says "Mock external deps (db/network/fs/other services) deterministically." This implies that the tool handlers might interact with external services, OR `ToolExecutor` itself does. If `ToolExecutor` is just an orchestrator, the external deps are inside the tool handlers. So I should create tool definitions whose handlers use mocked external modules (like `fs` or a `db` service). But since the handlers are provided by me in the test (as part of `ToolDefinition`), I can make them use mocked dependencies. This satisfies the rule.

However, if the module's `ToolExecutor` itself calls external services (e.g., to fetch tool definitions), that's less likely. The more likely scenario is that the tool definitions contain business logic that uses external services. But the contract of `ToolExecutor` is to run the handler, manage timeouts, validate params, and emit events.

Let's design the test file:

**Imports:**
```typescript
import ToolExecutor, {
  ToolDefinition,
  ExecOptions,
  ToolResult,
  ToolTimeoutError,
  ToolParamError,
  ToolDefinitionPublic,
} from '../src/services/toolExecutor';
```

**Mocking external deps:**
We need to mock something like `fs` or a service. Let's mock a service module, e.g., `../src/services/dbClient` or `fs`. Since I don't know the actual external deps, I can mock a generic service that a tool handler would use. But the prompt says "Mock external deps". I should mock something plausible. Let's say we have a tool that reads from a mocked database. I'll use `jest.mock` for a hypothetical `../src/services/dbClient`. But wait, the test is for `toolExecutor`, and I shouldn't assume other internal modules. Better to mock Node.js built-ins like `fs` or `child_process`, or just mock a generic function. Actually, the rule says "Mock external deps (db/network/fs/other services)". So I can mock `fs` to simulate a tool that reads a file.

Let's do:
```typescript
import fs from 'fs/promises';
jest.mock('fs/promises');
```

Then a tool handler uses `fs.readFile`. This is a clean external dep.

**Test Suite Structure:**

1. **Constructor / Registration**
   - Given valid `ToolDefinition[]`, constructs successfully.
   - Maybe exposes public definitions? Not sure if API has that. I'll skip unless implied. But `ToolDefinitionPublic` exists. Maybe `execute` accepts `ToolDefinitionPublic`? No. Maybe the executor maps internal to public. I'll assume there's a method `getPublicTools()`? Not in the API. I won't test it. I'll just use `ToolDefinitionPublic` as the type for the `parameters` schema or something. Actually, I can ignore `ToolDefinitionPublic` in the test body if I don't know how it's used, but I should import it as required by the import rule? The rule says "Import EXACTLY: import ... from '../src/services/toolExecutor';". It doesn't say I must import everything, but "Import EXACTLY" likely means the import path must be exactly that. I can import whatever names I need from it.

2. **execute - success path**
   - Calls a tool by name.
   - Returns a `ToolResult` with correct content.
   - Emits `start` and `complete` events with correct tool name/result.

3. **execute - param validation**
   - Throws `ToolParamError` if params don't match schema (missing required, wrong type). Since we don't know the schema system, we can assume JSON schema or Zod. Let's assume `ToolDefinition` has a `parameters` JSON schema. If I pass invalid params, it should throw `ToolParamError`.

4. **execute - timeout**
   - Tool handler is slow (e.g., `setTimeout` or mocked external dep that hangs).
   - `ToolExecutor` should abort and throw `ToolTimeoutError`.
   - Test with `ExecOptions.timeout` overriding `ToolDefinition.timeout`.

5. **execute - error propagation**
   - If the tool handler throws a generic error, `execute` should probably catch it and return a `ToolResult` with `isError: true`, OR re-throw. Which is more likely? In MCP, tool errors are returned as `isError: true` in the result, not thrown. But the existence of `ToolTimeoutError` and `ToolParamError` suggests these specific errors are thrown, while business errors might be caught and wrapped. However, the contract might be: execute returns `ToolResult` for business errors (setting `isError`), but throws for system/contract errors (timeout, param validation). Let's test both: a throwing handler should result in an error `ToolResult` or rethrow. I think for MCP, `execute` should return `{ content: [{type: 'text', text: 'Error: ...'}], isError: true }`. But the prompt says "error/throw on invalid inputs". So param errors throw. Timeout errors throw. What about unknown tool name? Probably throws generic Error.

6. **Boundary conditions**
   - Empty params object if no parameters required.
   - Timeout of 0 or very small.
   - Concurrent executions? Maybe not necessary, but could test that events are emitted correctly.

Let's refine the assumed signatures to be as standard as possible:

```typescript
interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
  timeout?: number;
}

interface ExecOptions {
  timeout?: number;
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

interface ToolDefinitionPublic {
  name: string;
  description?: string;
  parameters?: object;
}
```

And `ToolExecutor`:
```typescript
class ToolExecutor extends EventEmitter {
  constructor(tools: ToolDefinition[]);
  async execute(name: string, params: Record<string, unknown>, options?: ExecOptions): Promise<ToolResult>;
}
```

This is a very reasonable assumption.

Now, writing the test.

**Mocking fs/promises:**
```typescript
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));
```

**Helpers:**
```typescript
const makeTextResult = (text: string): ToolResult => ({
  content: [{ type: 'text', text }],
});
```

**Tests:**

```typescript
describe('ToolExecutor', () => {
  const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('construction', () => {
    it('accepts a registry of tool definitions and exposes no public definitions method (contract by type)', () => {
      const def: ToolDefinition = {
        name: 'readFile',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        handler: async ({ path }) => {
          const data = await fs.readFile(path as string, 'utf-8');
          return { content: [{ type: 'text', text: data }] };
        },
      };
      const executor = new ToolExecutor([def]);
      expect(executor).toBeInstanceOf(ToolExecutor);
      expect(executor).toBeInstanceOf(EventEmitter);
    });
  });

  describe('execute', () => {
    const echoDef: ToolDefinition = {
      name: 'echo',
      parameters: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
      handler: (params) => ({ content: [{ type: 'text', text: String(params.msg) }] }),
    };

    const slowDef: ToolDefinition = {
      name: 'slow',
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return { content: [{ type: 'text', text: 'done' }] };
      },
      timeout: 50,
    };

    const fileDef: ToolDefinition = {
      name: 'fileTool',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async (params) => {
        const data = await fs.readFile(params.path as string, 'utf-8');
        return { content: [{ type: 'text', text: data }] };
      },
    };

    it('resolves with ToolResult when a valid tool is called with valid params', async () => {
      const executor = new ToolExecutor([echoDef]);
      const result = await executor.execute('echo', { msg: 'hello' });
      expect(result).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    });

    it('emits start and complete events around execution', async () => {
      const executor = new ToolExecutor([echoDef]);
      const startListener = jest.fn();
      const completeListener = jest.fn();
      executor.on('start', startListener);
      executor.on('complete', completeListener);

      await executor.execute('echo', { msg: 'world' });

      expect(startListener).toHaveBeenCalledTimes(1);
      expect(startListener).toHaveBeenCalledWith(expect.objectContaining({ name: 'echo', params: { msg: 'world' } }));
      expect(completeListener).toHaveBeenCalledTimes(1);
      expect(completeListener).toHaveBeenCalledWith(expect.objectContaining({ name: 'echo', result: expect.any(Object) }));
    });

    it('throws ToolParamError when required parameters are missing', async () => {
      const executor = new ToolExecutor([echoDef]);
      await expect(executor.execute('echo', {})).rejects.toThrow(ToolParamError);
    });

    it('throws ToolParamError when parameter types are invalid', async () => {
      const executor = new ToolExecutor([echoDef]);
      // Assuming schema validation rejects non-string msg
      await expect(executor.execute('echo', { msg: 123 })).rejects.toThrow(ToolParamError);
    });

    it('throws ToolTimeoutError when handler exceeds definition timeout', async () => {
      const executor = new ToolExecutor([slowDef]);
      await expect(executor.execute('slow', {})).rejects.toThrow(ToolTimeoutError);
    });

    it('throws ToolTimeoutError when handler exceeds ExecOptions timeout override', async () => {
      const executor = new ToolExecutor([slowDef]);
      // Override with even shorter timeout
      await expect(executor.execute('slow', {}, { timeout: 1 })).rejects.toThrow(ToolTimeoutError);
    });

    it('returns error ToolResult (isError=true) when handler throws a business error', async () => {
      const errorDef: ToolDefinition = {
        name: 'fail',
        handler: () => {
          throw new Error('business logic failed');
        },
      };
      const executor = new ToolExecutor([errorDef]);
      const result = await executor.execute('fail', {});
      expect(result.isError).toBe(true);
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'text', text: expect.stringContaining('business logic failed') }),
        ])
      );
    });

    it('throws generic Error when tool name is not found', async () => {
      const executor = new ToolExecutor([echoDef]);
      await expect(executor.execute('nonexistent', {})).rejects.toThrow(Error);
    });

    it('deterministically mocks external fs dependency and returns its content', async () => {
      mockReadFile.mockResolvedValue('mocked file content');
      const executor = new ToolExecutor([fileDef]);
      const result = await executor.execute('fileTool', { path: '/tmp/test.txt' });
      expect(result).toEqual({ content: [{ type: 'text', text: 'mocked file content' }] });
      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.txt', 'utf-8');
    });

    it('propagates param validation errors before invoking handler or external deps', async () => {
      const executor = new ToolExecutor([fileDef]);
      await expect(executor.execute('fileTool', {})).rejects.toThrow(ToolParamError);
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });
});
```

Wait, the `start` and `complete` event payloads are inferred. I should make sure the contract asserts values/state. The event payloads might be different. To be safe, I can assert that the listeners are called with objects containing the tool name, rather than specific payload shapes. But the rule says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." For events, asserting the payload values is good. I'll assume the payload includes `name` and `params` for start, and `name` and `result` for complete. If the real module emits differently, this is a reasonable contract assumption. Alternatively, I can just assert that the event is emitted with the correct tool name using `expect.objectContaining`.

Also, for the timeout test, using `setTimeout` in the handler is okay, but Jest fake timers might be needed. However, real timers with a 50ms timeout are acceptable in Jest if not too many, but can be flaky. Better to use `jest.useFakeTimers()`. But with fake timers, `setTimeout` in the handler won't advance unless we use `jest.advanceTimersByTime`. However, `execute` likely uses its own timer (e.g., `Promise.race` with a timeout promise). If the executor uses `setTimeout` internally, fake timers will work. If the handler uses `setTimeout` and we advance timers, the handler will resolve, but we want it to timeout. So we need to advance timers past the timeout threshold without letting the handler complete? Actually, if the handler is `await new Promise(r => setTimeout(r, 10000))`, and we use fake timers, the executor's timeout race might also use `setTimeout`. If we advance by 100ms, both the executor's timeout and the handler's timer might fire. The executor's timeout should fire first if it's shorter. This is tricky.

Simpler: use a handler that never resolves, and advance timers just past the executor's timeout. Or use `jest.useFakeTimers({ legacyFakeTimers: false })` and `jest.advanceTimersByTimeAsync` (in Jest 29+). But to keep it robust and simple, I can use a real timer with a small value (50ms) and expect it to timeout. 50ms is acceptable.

Alternatively, mock the handler to be a hanging promise:
```typescript
handler: () => new Promise(() => {}),
```
Then with fake timers, if the executor uses `setTimeout` for timeout, we can advance by timeout+1 and the rejection should happen. This is cleaner.

Let's do that.

```typescript
const hangingDef: ToolDefinition = {
  name: 'hang',
  handler: () => new Promise(() => {}),
  timeout: 50,
};
```

Then in test:
```typescript
jest.useFakeTimers();
const executor = new ToolExecutor([hangingDef]);
const promise = executor.execute('hang', {});
jest.advanceTimersByTime(100);
await expect(promise).rejects.toThrow(ToolTimeoutError);
jest.useRealTimers();
```

But `advanceTimersByTime` is synchronous. If the executor's timeout promise is created inside `execute`, advancing timers should reject the internal promise and thus reject `execute`. However, if `execute` uses `await Promise.race([handlerPromise, timeoutPromise])`, and `timeoutPromise` rejects, `execute` will throw. This works with fake timers if the timeout is implemented with `setTimeout`. This is a reasonable assumption.

Let's incorporate fake timers for timeout tests.

Also, for the `ToolParamError` type validation: if the schema is JSON schema, passing `123` instead of string might or might not throw depending on the validator. To be safe, I can test missing required params (definitely a contract) and maybe wrong type if the module does strict validation. I'll include both but make the type one a bit generic.

Actually, to avoid over-specifying the schema validation mechanism, I can just test missing required params. That's a clear contract. And maybe an extra param if the schema is strict. But I'll stick to missing required.

Let's refine the test to be as contract-focused as possible and minimize assumptions about payload shapes.

**Revised Plan:**

- Import everything from the exact path.
- Mock `fs/promises` for external dep.
- Define tool definitions inline with minimal inferred shapes.
- Test construction (instanceof EventEmitter).
- Test successful execution returns correct `ToolResult` value.
- Test event emission: `start` and `end` (or `complete`). I'll use `start` and `complete` as logical names. If the real names differ, it's a risk. Maybe safer to test that `execute` triggers listeners attached via `on` for events that are part of the contract. But I don't know the event names. Common EventEmitter patterns for executors: `start`, `success`, `error`. I'll assert on `start` and `complete` but note they are inferred. Actually, to be safer, I can just test that the executor is an EventEmitter and can emit/relay events, but that's testing Node.js, not the module. Better to omit specific event names if unsure. But the contract likely includes lifecycle events. Let's include them but with a comment? No, the output must be just the code block.

Alternative: I can test that `execute` emits an event named `execute` or `tool:start`. Hmm.

Given the name `ToolExecutor` and that it extends `EventEmitter`, it's highly likely it emits `start` and `complete` or `before` and `after`. Let's go with `start` and `complete` and assert the payload contains the tool name and the result. This is a standard pattern.

But wait, the user might have a specific event name like `tool:execute`. Without knowing, I'm guessing. However, the prompt says "test observable behavior/contracts implied by the names+signatures". The signature doesn't list event names. So maybe I shouldn't test specific event names, but rather that it *is* an EventEmitter and that execution can be observed. But how? I can test that I can attach an `on('error')` listener and it catches emitted errors? No, `execute` is async.

Actually, a safer contract test: since it extends `EventEmitter`, it should allow adding listeners. But that's trivial. The real contract is probably that it emits lifecycle events. I'll include them with generic names but make the assertions flexible with `expect.objectContaining`.

Let's think about the `ToolDefinitionPublic`. How is it used? Maybe the constructor or a method accepts it? Or maybe `execute` returns it? No. Perhaps `ToolExecutor` has a method to list public tools, but it's not in the snippet. Since it's exported, I should probably reference it in the test to show it's part of the API, maybe by constructing an object that satisfies it and using it as a tool definition if the types align. But `ToolDefinition` and `ToolDefinitionPublic` are separate. `Public` likely lacks the `handler`. So I can't use it as a definition for execution.

I will import `ToolDefinitionPublic` but maybe not use it directly, or use it to type a variable that represents the public view if I test a listing method. But I don't have a listing method. I'll just import it and maybe use it in a type assertion if needed. Actually, I can just import it and not use it; TypeScript won't complain. But it's better to use it. Maybe I can define a `publicView` object typed as `ToolDefinitionPublic` and assert that the executor's constructor accepts `ToolDefinition[]` which is a different type. That's fine.

Let's write the code.

One concern: the `execute` method signature in the snippet is `async execute(`. It might be `async execute<T>(...)` or something. I'll assume the standard.

Let's write the complete TypeScript test file.

```typescript
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import ToolExecutor, {
  ToolDefinition,
  ExecOptions,
  ToolResult,
  ToolTimeoutError,
  ToolParamError,
  ToolDefinitionPublic,
} from '../src/services/toolExecutor';

jest.mock('fs
