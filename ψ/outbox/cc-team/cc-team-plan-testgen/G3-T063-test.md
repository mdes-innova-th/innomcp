<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T063 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1344,"completion_tokens":8000,"total_tokens":9344,"prompt_tokens_details":{"cached_tokens":69,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 98s
 generated: 2026-06-13T11:05:16.334Z -->
The user wants a Jest unit test for the `motherInbox` module in TypeScript.

Key constraints:
1. Import exactly as: `import ... from '../src/routes/api/motherInbox';`
2. Only test the public exported API. The source exports `default router` (an Express Router). So I need to test the router by mounting it or testing the route handler. Since it's an Express router, I can test it using `supertest` or by directly invoking the route handler. However, the instructions say to mock external dependencies (db, network, other services, fs) and keep tests deterministic and offline. Using supertest might require an Express app, but that's fine as long as we mock fs. Actually, supertest doesn't require a live server, it can work with an Express app. But the prompt says "pass without a live server or DB". So I can create a small Express app in the test and mount the router, then use supertest? Or I can directly test the router by mocking `fs` and invoking the route handlers. But the simplest way is to use `supertest` with an Express app. However, is `supertest` available? The prompt doesn't mention it. But testing an Express router usually requires either supertest or manual invocation of the handler.

Wait, looking at the exemplar, it's very simple. The module under test is a Router. To test it without supertest, I can create a mock Request and Response and call the route handler directly. But the route handler is anonymous inside `router.get("/", ...)`. The router itself is exported. I can access the handler via `(router as any).stack` but that's internal and brittle.

Better approach: Use `supertest`? But the prompt says "mock external dependencies (db, network, other services, fs) with jest.mock()". If I use supertest, I'm not really mocking network, but supertest doesn't bind to a port, it just invokes the app handler directly. However, supertest is an external dependency that might not be installed. The prompt doesn't mention it.

Alternative: Create a test Express app, mount the router, and then manually call the route handler? No, that's what supertest does.

Another alternative: Since the exported API is the router, I can test it by creating an Express app in the test file. But I need to be careful about imports. The prompt says "Only test the PUBLIC exported API actually present in the source below." The public exported API is `default router`. So I should import the router and test it.

But how to test an Express router without supertest? I can do:

```typescript
import request from 'supertest';
import express from 'express';
import motherInbox from '../src/routes/api/motherInbox';
```

But is supertest allowed? The prompt doesn't forbid it, but it says "mock external dependencies (db, network, other services, fs)". It doesn't mention supertest. However, to keep it simple and avoid potential missing dependencies, maybe I should manually invoke the route.

Actually, I can access the route handler from the router stack:

```typescript
const route = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.get);
const handler = route?.route?.stack[0]?.handle;
```

But this relies on Express internals. However, it's deterministic and doesn't require supertest. But is it testing the public API? The router is the public API, and its behavior is to handle GET requests. Using supertest is more standard.

Wait, the prompt says "The test file MUST compile under strict TypeScript and pass without a live server or DB." Using supertest with an Express app doesn't require a live server. It's a common pattern.

But I don't know if supertest is installed in the project. The prompt mentions "innomcp-node package" and "ts-jest". It doesn't mention supertest. To be safe, I should avoid dependencies not mentioned. I can test the router by creating a minimal Express app if `express` is already a dependency of the source (it is, since the source imports express). But testing with supertest requires supertest.

I can manually construct `req` and `res` objects and invoke the handler. But the handler is anonymous. However, I can get it from the router stack. Let's look at the source: `router.get("/", (req, res) => {...})`. The router is an Express Router. In Express, `router.stack` contains layers. Each layer has `route`. `route.stack` contains the handlers.

So:

```typescript
const getHandler = motherInbox.stack.find((layer: any) => layer.route?.path === '/' && layer.route.methods.get)?.route?.stack[0]?.handle;
```

Then I can call `getHandler(mockReq, mockRes, mockNext)`.

This avoids supertest and extra dependencies. But is it too hacky? The prompt says "Only test the PUBLIC exported API". The router itself is public. Testing via its stack is testing internal structure. However, in many Jest tests for Express routers, people do use this approach or supertest.

Alternatively, I can just import the router, create an app with express, mount it, and then use node-mocks-http or manual mocks. But again, extra dependencies.

Wait, I can just create a fake `req` and `res` and call the route handler if I can extract it. Let's think about strict TypeScript. Express types don't expose `stack` easily. I'd need to cast to `any`. That's okay in tests.

But maybe there's a simpler way: The prompt says "mock external dependencies". The main logic is in the route handler. I can test the router by making requests through a lightweight express app. Since `express` is already imported in the source, it's a project dependency. I can do:

```typescript
import express from 'express';
import motherInbox from '../src/routes/api/motherInbox';

const app = express();
app.use('/api/mother/inbox', motherInbox);
```

Then how to test without supertest? I can use `app` as a handler? No, to test HTTP semantics without supertest, I'd need to call `app.handle(req, res)` but that requires actual HTTP objects or mocks.

Actually, I think the best approach is to use `supertest` if it's common, but since it's not mentioned, maybe I should avoid it. Let's look at the exemplar again. It's very simple, no external test helpers. The module under test is a class. Here the module is a Router. I think the intended solution is to extract the handler or use supertest. But given the strict constraints, maybe I should just use `jest.mock('fs')` and mock the request/response objects manually, and invoke the handler directly by accessing the stack.

However, there's another issue: `router.get("/", ...)` registers a route. The exported router is the default export. So in the test, I can do:

```typescript
import motherInbox from '../src/routes/api/motherInbox';
```

Then to get the handler:

```typescript
const route = (motherInbox as any).stack.find(
  (layer: any) => layer.route?.path === '/' && layer.route.methods.get
);
const handler = route.route.stack[0].handle as (req: Request, res: Response) => void;
```

Then create mock req/res.

But `Request` and `Response` from express are complex. I can use `Partial<Request>` and cast, or use `httpMocks` (but that's another dependency). Better to manually create mocks that satisfy the usage in the handler.

Looking at the handler usage:
- `req.query` is cast to `{ limit?: string; since?: string }`.
- `res.json(...)` is called.
- `res` is used to send response and return.

So I can create:

```typescript
const mockRes = {
  json: jest.fn().mockReturnThis(),
} as unknown as Response;
```

And for `req`:

```typescript
const mockReq = {
  query: {},
} as unknown as Request;
```

But wait, the handler uses `(req.query as { limit?: string }).limit`. So `req.query` must exist.

Also, the handler calls `new Date().toISOString()` multiple times. The prompt says "Use fake timers for any time/interval logic." So I should use `jest.useFakeTimers()`.

Now, the handler uses `fs.existsSync`, `fs.readdirSync`, `fs.statSync`, `fs.readFileSync`. I need to mock `fs` with `jest.mock('fs')`.

Also `path.join` is used, but that's deterministic. `process.env` is used for `JIT_INBOX`. I should probably mock `process.env` or just let the path resolve. Since `fs` is mocked, the actual path doesn't matter much, but `JIT_INBOX` is computed at module load time. So if I want to control it, I need to set `process.env.JIT_INBOX_PATH` before importing the module, or use `jest.isolateModules` / reset modules. However, the module computes `JIT_INBOX` at the top level. So to test different paths or ensure consistency, I should use `jest.resetModules()` and set env vars before re-importing. But the prompt says import exactly as specified. So I can only import once at the top? Actually, I can use `jest.isolateModules` for re-import, but the top-level import is fixed.

Wait, the prompt says: "Import the module under test EXACTLY as: import ... from '../src/routes/api/motherInbox'; (do NOT duplicate or re-implement the source)." This likely means the test file should have that import statement at the top. It doesn't necessarily forbid dynamic imports inside tests, but to be safe, maybe I should just import once at the top. The `JIT_INBOX` will be computed based on the environment at the time of import. Since tests run in the test environment, `process.env.USERPROFILE` or `HOME` might be set. To make it deterministic, I can set `process.env.JIT_INBOX_PATH` before the import. But in a test file, imports are hoisted. So I need to set the env var before the import. I can do:

```typescript
process.env.JIT_INBOX_PATH = '/mock/jit/inbox';
import motherInbox from '../src/routes/api/motherInbox';
```

But in TypeScript/ES modules, imports are hoisted. However, in CommonJS (which Jest uses by default even with ts-jest), `import` is transpiled to `require`, and while `jest.mock` is hoisted, normal code isn't necessarily. Actually, `import` statements are hoisted to the top by TypeScript/JavaScript. So setting `process.env` before the import might not work if the import is hoisted above it. But in practice, with ts-jest and the module system, the import is evaluated after the preceding code if it's not at the very top? No, all `import` statements are hoisted to the top of the file. So if I write:

```typescript
process.env.JIT_INBOX_PATH = '/mock/jit/inbox';
import motherInbox from '../src/routes/api/motherInbox';
```

The import will be hoisted above the env assignment. To handle this, I can use `jest.mock` to mock `path` or `fs` in a way that controls the inbox path, or I can rely on the fact that `JIT_INBOX` uses `process.env.JIT_INBOX_PATH` and mock `process.env` using `Object.defineProperty`? No, the module evaluates it at load time.

Better: Use `jest.isolateModules` inside a test to re-import the module with a different env. But the prompt says "Import the module under test EXACTLY as: import ... from '../src/routes/api/motherInbox';". This suggests there should be a top-level import. It doesn't say I can't also import inside tests, but to be safe, maybe I should just mock `fs` and `path` such that the default path works fine.

Actually, looking at the source: `JIT_INBOX` is computed using `process.env.JIT_INBOX_PATH` or a fallback. If I mock `fs.existsSync` to return true/false based on the path, I need to know what path it will use. The fallback uses `process.env.USERPROFILE || process.env.HOME || "C:/Users/USER-NT"`. In a test environment (node), `process.env.HOME` is likely set (on Linux/Mac) or `USERPROFILE` on Windows. To make it deterministic across platforms, I should set `process.env.JIT_INBOX_PATH` before importing. But because of hoisting, I can do this:

```typescript
const mockInboxPath = '/tmp/mock-jit-inbox';
process.env.JIT_INBOX_PATH = mockInboxPath;
```

Then import. But if hoisted, the import happens first. Actually, in Jest with ts-jest, `import` is transpiled to `require`. Jest hoists `jest.mock` calls, but not other code. However, ES module imports are hoisted by the language. TypeScript transpiles them to `require` calls at the top of the file. So the `require` will execute before the env assignment.

To guarantee the env is set before the module is loaded, I can use a `jest.mock` for `path` or `fs`? No, that doesn't help with the env var.

Another approach: Mock `process.env` using `Object.defineProperty(process, 'env', ...)`? No, the module reads it at load time.

Wait, I can just not worry about the exact path. I can mock `fs` methods to track the path argument and respond accordingly. For example, `fs.existsSync` can return `true` for any path ending with `ψ/inbox` or just return `true` always. But the route uses `JIT_INBOX` as the directory path. If I mock `fs.existsSync` to return `true` for any path, that's fine. Then `fs.readdirSync(JIT_INBOX)` will be called with whatever path. I can make `fs.readdirSync` return a fixed array of filenames regardless of path. Similarly for `fs.statSync` and `fs.readFileSync`. I can use `jest.mock('fs')` and then implement the mocks in `beforeEach`.

But `fs.readFileSync(path.join(JIT_INBOX, name), ...)` will be called with a specific path. If I mock `fs.readFileSync` to return content based on the filename (e.g., using `path.basename`), I can avoid caring about the exact directory.

So I don't need to control `JIT_INBOX`. I can just let it resolve to whatever and mock `fs` accordingly.

However, there's a catch: `path.join` is used. I can mock `path` too? Or just let it be. The filenames passed to `fs.readFileSync` will be `path.join(JIT_INBOX, name)`. In my mock, I can ignore the directory part and just return content based on `path.basename(arg)`.

Let's plan the test structure:

```typescript
import motherInbox from '../src/routes/api/motherInbox';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  basename: jest.fn((p: string) => p.split('/').pop() || ''),
}));
```

Wait, if I mock `path`, I need to be careful because `path.join` is used in the source to construct file paths. If I mock it to simply join with `/`, it makes it easier. But is it necessary? Not really. I can just not mock `path` and let it use the real `path.join`. Then in `fs.readFileSync` mock, I can parse the path. But `path.join` on Windows uses backslashes. The test environment is "node", which could be Windows or Linux. To make it deterministic, maybe I should mock `path` to always use forward slashes? Or I can just use `expect.any(String)` when checking arguments? Actually, I don't need to assert on the exact path passed to `fs.readFileSync`. I just need to ensure the route returns the correct JSON.

So I will mock `fs` only.

```typescript
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
}));
```

But the source imports `fs` as a default import? No, `import fs from "fs";` is the default import of the fs module. In CommonJS, `fs` is the whole module. So mocking it as above should work. However, `fs` in Node has both named and default exports? Actually `import fs from "fs"` imports the default export which is the whole `fs` module object. So `jest.mock('fs')` will replace it.

Now, I need to get the route handler. Let's decide on the approach.

Approach 1: Use supertest. I think it's cleaner but I'm not sure if it's installed. Given the prompt doesn't mention it, I'll avoid it.

Approach 2: Extract handler from router stack.

```typescript
const getRoute = (motherInbox as any).stack.find(
  (layer: any) => layer.route?.path === '/' && layer.route.methods.get
);
const handler = getRoute.route.stack[0].handle as (req: Request, res: Response) => void;
```

This is a bit internal, but it works. However, the type of `motherInbox` is `Router`. Express's `Router` doesn't have `stack` in the public types. So I need to cast to `any`. That's acceptable in tests.

Approach 3: Create an Express app and use it. But without supertest, I'd still need to extract the handler or use http mocks.

I think Approach 2 is fine.

Now, constructing mock Request and Response.

For `Request`:
- `req.query` is used. It can be `Record<string, any>`.
- The handler casts `req.query` to `{ limit?: string }` and `{ since?: string }`.

So:

```typescript
const createMockReq = (query: any): Request => {
  return { query } as unknown as Request;
};
```

For `Response`:
- `res.json(obj)` is called. It should be a mock function.
- The handler returns after calling `res.json`. It doesn't call `next`.

So:

```typescript
const createMockRes = (): Response => {
  const json = jest.fn();
  return { json } as unknown as Response;
};
```

But wait, `res.json` in Express returns `Response`. The handler doesn't use the return value, but it's good to have `.mockReturnThis()`.

Now, the logic to test:

1. When `fs.existsSync` returns false, it should return empty messages.
2. When `fs.existsSync` returns true, it reads `.md` files, sorts by mtime descending, parses them, filters by `from` containing "innova" or "local", respects limit, respects `since` param, counts `newCount`, includes `inboxPath`, and includes `timestamp`.

I need to use fake timers because `new Date().toISOString()` is used in the response. So I can set a fake date and assert the timestamp.

Let's outline tests:

- `beforeEach`: `jest.useFakeTimers().setSystemTime(new Date('2024-01-15T12:00:00Z'));`
- `afterEach`: `jest.useRealTimers();`
- Reset mocks.

Now, mocking fs functions:

```typescript
const mockedFs = fs as jest.Mocked<typeof fs>;
```

But since I used `jest.mock('fs')`, the imported `fs` is the mock. However, TypeScript might complain about types. I can cast:

```typescript
const mockedExistsSync = fs.existsSync as jest.Mock;
const mockedReaddirSync = fs.readdirSync as jest.Mock;
const mockedStatSync = fs.statSync as jest.Mock;
const mockedReadFileSync = fs.readFileSync as jest.Mock;
```

Now, test cases:

**Test 1: Empty inbox when directory does not exist**
- `fs.existsSync` returns `false`.
- Call handler with req (no query).
- Expect `res.json` called with `{ messages: [], total: 0, newCount: 0, timestamp: '2024-01-15T12:00:00.000Z' }`.

**Test 2: Returns parsed innova-bot messages up to limit**
- `fs.existsSync` returns `true`.
- `fs.readdirSync` returns `['msg1.md', 'msg2.md', 'note.txt']` (note.txt should be filtered out).
- `fs.statSync` returns objects with `mtime`. Need to define order. Let's say msg2 is newer.
- `fs.readFileSync` returns content for each.
- Content for msg1: from: innova-bot, etc. Content for msg2: from: local-bot, etc. Content for msg3 (if any): from: other, should be filtered by parseMessage.
- Limit default is 5. Let's test with limit=1 via query.
- Also test `since` param.

Wait, `parseMessage` filters by `from` containing "innova" or "local". So I need to craft file contents.

Example content:

```
---
from: innova-bot
to: jit
timestamp: 2024-01-10T10:00:00Z
subject: Hello
---
Body text here
```

For a non-matching one:

```
---
from: someone-else
to: jit
timestamp: 2024-01-10T10:00:00Z
subject: Hello
---
Body text here
```

This should return null from parseMessage and be skipped.

Also, `since` param: if `since` is provided, `isNew` is true if `mtime > since`. Note: `mtime` is from `fs.statSync`, not from the message timestamp header. The `modifiedAt` in response is `mtime.toISOString()`.

So I need to control `mtime` in `fs.statSync` mock.

`fs.readdirSync` returns string[]. Then `.map(f => ({ name: f, mtime: fs.statSync(...).mtime }))`. So `statSync` is called for each file.

`fs.readFileSync` is called inside the loop for each file (up to limit and after filtering). Actually, the loop reads all files in the first 50, but breaks when `messages.length >= limit`. However, it reads files sequentially and tries to parse. If a file is filtered out, it doesn't count toward limit. So if limit=1 and the first file is filtered out, it reads the second.

Let's design the tests carefully.

**Test 2a: Basic success with default limit**
- readdir returns `['a.md', 'b.md']`.
- statSync returns mtime: `a.md` = older, `b.md` = newer. (Sorted descending, so b then a).
- readFileSync for `b.md` returns content with `from: innova-bot`. parseMessage returns object.
- readFileSync for `a.md` returns content with `from: local-agent`. parseMessage returns object.
- limit default is 5, so both included.
- Response: messages array length 2, total 2, newCount 0 (no since), inboxPath present, timestamp present.

**Test 2b: Limit query parameter**
- req.query.limit = '1'.
- readdir returns `['a.md', 'b.md']` with b newer.
- b matches, a matches.
- Only b should be returned because limit=1. But wait, the loop processes b first (sorted), pushes it, then checks `messages.length >= limit` (1 >= 1) and breaks. So a is not read. Good.
- total should be 1.

**Test 2c: Since query parameter**
- req.query.since = '2024-01-14T12:00:00Z'.
- mtime of b.md is `2024-01-15T10:00:00Z` (newer than since). mtime of a.md is `2024-01-13T10:00:00Z` (older).
- b.isNew = true, a.isNew = false.
- newCount = 1.

**Test 2d: Non-matching from filter**
- readdir returns `['bad.md']`.
- content has `from: someone-else`.
- parseMessage returns null.
- messages array empty.

**Test 2e: File read error (catch skip)**
- readdir returns `['good.md', 'bad.md']`.
- readFileSync for 'bad.md' throws.
- Should skip it and continue. If good.md matches, it should be included.

**Test 2f: Invalid limit query**
- req.query.limit = 'abc'. `parseInt('abc', 10)` is NaN. `Number.isFinite(raw)` is false, so limit = 5. But then `Math.min(Math.max(1, 5), 20)` = 5.
- req.query.limit = '100'. `raw` = 100. limit = min(max(1,100),20) = 20.
- req.query.limit = '-3'. raw = -3. `Number.isFinite(-3)` is true. `Math.max(1, -3)` = 1. limit = 1.
- req.query.limit = '0'. raw = 0. `Math.max(1,0)` = 1. limit = 1.

**Test 2g: Invalid since query**
- req.query.since = 'invalid-date'. `new Date('invalid-date')` returns Invalid Date. Then `since` is an Invalid Date object. In parseMessage, `isNew = since ? mtime > since : false`. If `since` is Invalid Date, `mtime > since` is false (any comparison with Invalid Date is false). So isNew is false. But does the route pass `since` to parseMessage? Yes, it passes `since` even if invalid. So isNew will be false. That's fine.

**Test 2h: Catastrophic error (catch block)**
- `fs.existsSync` throws. Then the outer catch block returns empty response.
- Or `fs.readdirSync` throws. Outer catch returns empty.

Wait, the outer try-catch wraps everything. If `fs.existsSync` throws, it goes to catch and returns empty. So we can test that.

But `fs.existsSync` rarely throws in practice, but we can mock it to throw.

Now, about the `fs` mock implementation. Since `fs` is mocked, I need to provide implementations per test.

Let's write the mock setup:

```typescript
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
}));
```

But wait, `fs` module has many members. If I only provide these four, any other usage would fail. The source only uses these four. So it's fine.

However, `import fs from "fs"` expects the default export. The mock above returns an object with these functions. In Jest, `jest.mock('fs')` automatically mocks the entire module. But if I provide a factory, I need to make sure it returns the right shape. Actually, `jest.mock('fs')` without a factory will auto-mock all methods. Then I can cast them to `jest.Mock` and set implementations. That's easier.

So:

```typescript
jest.mock('fs');
import fs from 'fs';
```

Then in tests:

```typescript
(fs.existsSync as jest.Mock).mockReturnValue(true);
```

But TypeScript strict might complain about `fs.existsSync` being a mock. I can use `(fs.existsSync as jest.MockedFunction<typeof fs.existsSync>)` or just `jest.spyOn(fs, 'existsSync')` but since it's already mocked, casting is fine.

Actually, with `jest.mock('fs')`, the imported `fs` is the mock module. TypeScript doesn't know it's mocked. So I need to cast.

Let's define helper functions to reduce boilerplate.

Now, about the route handler extraction. I'll do it in a `beforeAll` or just once at the top after import.

```typescript
const getHandler = () => {
  const stack = (motherInbox as any).stack as any[];
  const layer = stack.find(l => l.route?.path === '/' && l.route.methods.get);
  if (!layer) throw new Error('GET / route not found');
  return layer.route.stack[0].handle as (req: Request, res: Response) => void;
};
```

Then in each test, I call `getHandler()(mockReq, mockRes)`.

Wait, `layer.route.stack[0].handle` is the actual function. I can extract it once.

```typescript
const routeHandler = (() => {
  const layer = (motherInbox as any).stack.find(
    (l: any) => l.route?.path === '/' && l.route.methods.get
  );
  return layer?.route?.stack?.[0]?.handle as (req: Request, res: Response) => void;
})();
```

If `routeHandler` is undefined, the tests will fail. But assuming the source is correct, it will be defined.

Now, constructing mock Request and Response.

For Request, I need to satisfy the type enough for the handler. The handler only accesses `req.query`. So:

```typescript
const createRequest = (query: Record<string, unknown> = {}): Request => {
  return { query } as unknown as Request;
};
```

For Response:

```typescript
const createResponse = (): Response & { json: jest.Mock } => {
  const json = jest.fn();
  return { json } as unknown as Response & { json: jest.Mock };
};
```

Actually, the handler calls `res.json(...)` and returns. It doesn't call `res.status` or anything else.

Now, fake timers:

```typescript
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-06-01T00:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});
```

Wait, `jest.clearAllMocks()` is good. But if I use `jest.mock('fs')`, the mocks persist across tests unless cleared. So `jest.clearAllMocks()` in `afterEach` is important.

Now, let's think about `fs.readdirSync` and `fs.statSync`.

The source does:

```typescript
const files = fs.readdirSync(JIT_INBOX)
  .filter(f => f.endsWith(".md"))
  .map(f => ({ name: f, mtime: fs.statSync(path.join(JIT_INBOX, f)).mtime }))
  .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  .slice(0, 50);
```

So `fs.statSync` is called for each `.md` file. It returns a `Stats` object with `mtime` property (a Date). I need to mock `fs.statSync` to return an object with `mtime`.

```typescript
(fs.statSync as jest.Mock).mockImplementation((filePath: string) => {
  // return based on basename
  const basename = path.basename(filePath);
  if (basename === 'new.md') return { mtime: new Date('2024-05-31T12:00:00Z') };
  if (basename === 'old.md') return { mtime: new Date('2024-05-30T12:00:00Z') };
  return { mtime: new Date('2024-05-29T12:00:00Z') };
});
```

But `path.basename` is not mocked. I can use the real `path.basename`. That's fine.

Similarly, `fs.readFileSync` returns string content.

```typescript
(fs.readFileSync as jest.Mock).mockImplementation((filePath: string, encoding: string) => {
  const basename = path.basename(filePath);
  if (basename === 'new.md') return '---\nfrom: innova-bot\nto: jit\n---\nHello world';
  ...
});
```

Now, `parseMessage` splits by `\n`. So content strings should use `\n`.

Let's craft content:

For a valid innova message:

```
---
from: innova-bot
to: jit
timestamp: 2024-05-31T10:00:00Z
subject: Test
---
This is the body of the message.
```

For a valid local message:

```
---
from: local-agent
to: jit
timestamp: 2024-05-30T10:00:00Z
subject: Local
---
Local body.
```

For an invalid message (filtered out):

```
---
from: other-agent
to: jit
timestamp: 2024-05-29T10:00:00Z
subject: Other
---
Other body.
```

For a file with no frontmatter (edge case):

```
No frontmatter here.
```

`parseMessage` will not find `---` twice? Actually, it looks for `---` to set `inFm`. If no `---`, `inFm` stays false, `bodyStart` stays 0. `from` will be undefined. `fromLower` will be `""`, which doesn't include "innova" or "local". So returns null. Good.

For a file read error: `fs.readFileSync` throws.

Now, the response shape:

```typescript
{
  messages: InboxMessage[],
  total: number,
  newCount: number,
  inboxPath?: string, // only present when exists
  timestamp: string,
}
```

When directory doesn't exist, `inboxPath` is not present. When it exists, it is present.

Let's verify the source:

```typescript
if (!fs.existsSync(JIT_INBOX)) {
  res.json({ messages: [], total: 0, newCount: 0, timestamp: new Date().toISOString() });
  return;
}
```

So no `inboxPath` when missing.

In the success case:

```typescript
res.json({
  messages,
  total: messages.length,
  newCount: messages.filter(m => m.isNew).length,
  inboxPath: JIT_INBOX,
  timestamp: new Date().toISOString(),
});
```

So `inboxPath` is present.

In the catch block:

```typescript
res.json({ messages: [], total: 0, newCount: 0, timestamp: new Date().toISOString() });
```

No `inboxPath`.

Now, `JIT_INBOX` is a constant. I can assert its presence in the response using `expect.objectContaining({ inboxPath: expect.any(String) })` or I can import `path` and compute it? No, because it depends on env. But I can just assert it's a string.

Actually, I can assert the exact value if I know it. But since it's env-dependent, better to use `expect.any(String)`.

Wait, the prompt says "The test file MUST compile under strict TypeScript and pass without a live server or DB." It doesn't say tests must run on any platform. So I can assume the test runs in a specific environment. But to be safe, I'll use `expect.any(String)` for `inboxPath`.

Now, let's write the tests.

**Test 1: returns empty array when inbox directory does not exist**

```typescript
test('returns empty array when inbox directory does not exist', () => {
  (fs.existsSync as jest.Mock).mockReturnValue(false);
  const req = createRequest();
  const res = createResponse();
  routeHandler(req, res);
  expect(res.json).toHaveBeenCalledWith({
    messages: [],
    total: 0,
    newCount: 0,
    timestamp: '2024-06-01T00:00:00.000Z',
  });
});
```

**Test 2: returns messages from innova-bot and local sources**

```typescript
test('returns messages from innova-bot and local sources', () => {
  (fs.existsSync as jest.Mock).mockReturnValue(true);
  (fs.readdirSync as jest.Mock).mockReturnValue(['innova.md', 'other.md', 'local.md']);
  (fs.statSync as jest.Mock).mockImplementation((p: string) => {
    const base = path.basename(p);
    if (base === 'innova.md') return { mtime: new Date('2024-05-31T12:00:00Z') };
    if (base === 'local.md') return { mtime: new Date('2024-05-30T12:00:00Z') };
    return { mtime: new Date('2024-05-29T12:00:00Z') };
  });
  (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
    const base = path.basename(p);
    if (base === 'innova.md') return '---\nfrom: innova-bot\nto: jit\n---\nHello innova';
    if (base === 'local.md') return '---\nfrom: local-agent\nto: jit\n---\nHello local';
    if (base === 'other.md')
