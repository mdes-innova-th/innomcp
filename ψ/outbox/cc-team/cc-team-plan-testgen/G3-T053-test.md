<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T053 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1347,"completion_tokens":8000,"total_tokens":9347,"prompt_tokens_details":{"cached_tokens":72,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 83s
 generated: 2026-06-13T11:02:59.675Z -->
The user wants a Jest unit test for the `dashboard` module in `innomcp-node`.
Strict rules:
1. Import exactly as: `import ... from '../src/routes/api/dashboard';`
2. Only test the PUBLIC exported API. The source exports `router` as default. So I need to test the Express router. Since it's a router, I can test it by mounting it in an Express app or using `supertest`. However, the instructions say "pass without a live server or DB". Using supertest with an Express app instance is standard for testing routers without a live server. I need to check if supertest is implied or if I should just invoke the router handlers. Usually, for Express routers, we use `supertest` or mock the `req`/`res` objects. Given the strict TypeScript and offline requirement, mocking `req`/`res` and calling the route handlers directly might be simpler, but the handlers are anonymous async functions attached to the router. Accessing them from the router stack is possible but brittle.

Wait, the exported API is `router` (default export). The public API is the Express Router instance. To test it, I can create a small Express app, mount the router, and use `supertest` to make requests. However, `supertest` is an external dependency. Is it available? The prompt doesn't mention it. But it's a very common pairing with Jest for Express routes. Alternatively, I can extract the route handler from `router.stack` and test it directly, but that's testing internals.

Let's re-read: "Only test the PUBLIC exported API actually present in the source below."
The public exported API is `default router`. So I should test that router. The best way is to use `supertest` or create a mock app. But if I use supertest, I need to import it. The prompt doesn't say I can't use other imports, but it says "The test file MUST compile under strict TypeScript and pass without a live server or DB." Supertest doesn't require a live server (it binds to the app directly).

However, maybe the user expects me to just test the router by mounting it on an express app and using supertest. Let's assume standard testing libraries like `supertest` are available. If not, I can test by creating an Express app and using its internal `handle` method, but supertest is much cleaner.

Wait, looking at the exemplar, it only imports the module under test. It doesn't show other imports, but that's just an exemplar. I should import `express` and `supertest` if needed. But maybe I should avoid supertest if it's not guaranteed to be in the package. The prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock()". It doesn't mention mocking express or supertest.

Let's think about how to test the router without supertest.
I can do:
```typescript
import request from 'supertest';
import express from 'express';
import dashboardRouter from '../src/routes/api/dashboard';
```
This seems reasonable. But if `supertest` isn't installed, the test won't compile. The prompt says "The test file MUST compile under strict TypeScript". If I import `supertest`, I might need `@types/supertest`. It's likely available in a project using Express+Jest+TS, but not guaranteed.

Alternative: I can test the router by manually invoking the middleware/handler.
```typescript
import dashboardRouter from '../src/routes/api/dashboard';
```
`dashboardRouter` is a `Router`. It has `stack` property.
I can find the GET route handler in `router.stack`.
For example:
```typescript
const layer = dashboardRouter.stack.find((l: any) => l.route?.path === '/' && l.route.methods.get);
const handler = layer.route.stack[0].handle;
```
Then I can create mock `req` and `res` objects and call `handler(req, res, next)`.
This avoids `supertest` and `express` as test dependencies (though `express` is already a dependency of the source, so it's fine to import types if needed, but for mocks I can use `Partial<Request>` etc).

However, the router also has `authenticateToken` middleware applied via `router.use(authenticateToken)`. This means any request to the router goes through that middleware first. The source shows `router.use(authenticateToken);` before defining the route. So the stack will have the middleware first, then the route.

To test the full router behavior including middleware, I'd need to mock `authenticateToken` to call `next()` and attach `req.user`. This is doable.

Let's look at the imports in the source:
- `express`: `Router`, `Response`
- `../../utils/db`: `withDbConnection`
- `../../utils/jwt`: `authenticateToken`, `AuthRequest`

I need to mock `../../utils/db` and `../../utils/jwt`.
Also, the source uses `conn.query` inside `withDbConnection`.
`withDbConnection` takes a callback and returns its result.

Mocking strategy:
1. `jest.mock('../../utils/db', () => ({ withDbConnection: jest.fn() }));`
2. `jest.mock('../../utils/jwt', () => ({ authenticateToken: jest.fn((req, res, next) => next()), AuthRequest: ... }));` Wait, `AuthRequest` is a type-only import. In runtime JS, it disappears. But for TypeScript compilation, I might need to handle it. Since the test file imports the module, the module's own imports are handled by jest.mock. The type `AuthRequest` is not a value, so the mock factory doesn't need to export it, but TypeScript might complain if the mock factory doesn't return an object with the expected shape? Actually, `jest.mock` is hoisted and TypeScript knows it's a mock. The factory should return the exported values. Since `AuthRequest` is a type, it's erased at compile time. The runtime module exports `authenticateToken`. So the mock factory should return `{ authenticateToken: jest.fn(...) }`.

Wait, `import { type AuthRequest }` is TypeScript 4.5+ syntax. The source uses `import { authenticateToken, type AuthRequest } from "../../utils/jwt";`. In the compiled JS, only `authenticateToken` is imported. So the mock factory only needs to provide `authenticateToken`.

However, in the test file, I might need to reference `AuthRequest` type if I create mock requests. But I can type mocks as `any` or `Partial<...>` to avoid importing the type. Or I can import the type from the source if needed, but the prompt says "Only test the PUBLIC exported API actually present in the source below. Do not invent methods." It doesn't say I can't import types from internal modules, but rule 1 says import the module under test exactly as specified. It doesn't forbid other imports. But to be safe and simple, I can use `as any` for mock objects.

Let's plan the test structure:

```typescript
import dashboardRouter from '../src/routes/api/dashboard';
import { withDbConnection } from '../../src/utils/db';
import { authenticateToken } from '../../src/utils/jwt';
import type { Request, Response } from 'express';

jest.mock('../../src/utils/db', () => ({
  withDbConnection: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
  authenticateToken: jest.fn((req, res, next) => next()),
}));
```

Wait, the path for mocking should be relative to the test file location.
Test file: `innomcp-node/tests/dashboard.test.ts` (or similar).
Module under test: `innomcp-node/src/routes/api/dashboard.ts`.
So import is `import dashboardRouter from '../src/routes/api/dashboard';`.
The mocked modules are at `../../src/utils/db` and `../../src/utils/jwt` relative to the test file? No.
Test file is in `innomcp-node/tests/`.
`../src/routes/api/dashboard` goes to `innomcp-node/src/routes/api/dashboard`.
`../../src/utils/db` from `innomcp-node/tests/` goes to `innomcp-node/src/utils/db`. Yes.

Now, how to test the router?
Option A: Use `supertest`.
```typescript
import express from 'express';
import request from 'supertest';
```
But I don't know if `supertest` is installed. The prompt doesn't mention it. However, it's extremely common. But "MUST compile under strict TypeScript" means if `@types/supertest` is missing, it fails. I should probably avoid it to be safe.

Option B: Manually invoke the route handler.
I can extract the handler from the router stack.
```typescript
const getHandler = (router: any) => {
  const route = router.stack.find((layer: any) => layer.route?.path === '/' && layer.route.methods.get);
  return route?.route?.stack?.[route.route.stack.length - 1]?.handle;
};
```
But there's also the `authenticateToken` middleware. If I just call the route handler, I bypass the middleware. However, the middleware is mocked to call `next()`, so if I call the route handler directly, I don't test the middleware integration. But the middleware is not the public API of this module; it's an internal implementation detail. The public API is the router itself. But testing the router usually means ensuring a GET request hits the handler.

Actually, a better way without supertest is to create an Express app in the test and mount the router, then use the app's `handle` method or just call the route handler via the app's internal routing. But that requires `express`.

Wait, I can create an Express app:
```typescript
const app = express();
app.use(express.json());
app.use(dashboardRouter);
```
Then how to make a request without supertest? I can use `node-mocks-http`? That's another dependency.

What if I just test the exported router by checking it's an Express Router? That's trivial and not useful.

The most robust offline approach is to extract the route handler from the stack and test it with mocked `req` and `res`. This is a common pattern when `supertest` is not desired or available.

Let's verify the router stack structure.
`router.use(authenticateToken)` adds a layer with no route.
`router.get("/", ...)` adds a layer with `route.path === '/'`.
`layer.route.stack` contains the middlewares for that route. Since no route-specific middlewares are added, `layer.route.stack` should have one item: the async handler.

So I can do:
```typescript
const routeLayer = (dashboardRouter as any).stack.find(
  (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get
);
const handler = routeLayer.route.stack[0].handle;
```

Then I create mock req and res:
```typescript
const req: any = {
  query: {},
  user: { userId: 'user-123' },
};
const res: any = {
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
};
await handler(req, res);
```

This tests the handler logic directly. Is this testing the "PUBLIC exported API"? The handler is not directly exported, but it's the implementation of the exported router's GET / endpoint. In many unit test contexts, this is acceptable for router files. However, strictly speaking, the public API is the router instance. But testing the router instance usually involves HTTP semantics.

Given the constraints, I think extracting the handler is the most reliable way to ensure compilation and no live server/DB. I will also verify that `authenticateToken` middleware is applied by checking the router stack, or I can test that the router is an instance with the expected stack. But the main logic is in the GET handler.

Wait, the prompt says: "Only test the PUBLIC exported API actually present in the source below. Do not invent methods."
If I extract the handler from the stack, I'm relying on internal Express structure. Is that considered testing the public API? The public API of an Express router is that it can be mounted and handles requests. The internal `stack` is not public API of *this module*, but it is the public API of Express Router objects. However, the prompt might interpret "public exported API" as the exported values/functions/classes. For a default export of a router, the public API is the router object itself.

I think the safest interpretation is: test the router by mounting it in a minimal Express application and using `supertest`. This is the standard way to test Express routers. If the project has Express and Jest, it almost certainly has supertest or it's trivial to add. But the prompt says "The test file MUST compile under strict TypeScript". If I use supertest, I need to assume it's available. The prompt doesn't list it as a dependency.

Let's reconsider. Maybe I can test the router by creating an Express app and using `app.handle(req, res)`? No, that's internal.

Another idea: The prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock(). Keep tests deterministic and offline." It doesn't say "do not use express in tests". Express is a dependency of the source. I can import `express` to create an app. Then I can make requests using a lightweight HTTP client that works with Express apps without a server? That's supertest.

What if I just test the functions that are exported? Only `router` is exported. No other named exports. So I must test the router's behavior.

I will use `supertest`. It's the industry standard. If the user didn't install it, they should. But to be absolutely safe, maybe I can add a comment? No, the output contract says NOTHING else, no prose.

What if I use `node-mocks-http`? Also not guaranteed.

Let's look at the exemplar again. It tests a class `CacheManager` with simple methods. The dashboard module is a router with side effects. The exemplar doesn't help much with Express routers.

I think I should use `supertest` and `express`. If I want to be extra safe with TypeScript compilation, I can import them and if types are missing, I can declare them? No, that's inventing methods.

Actually, I can test the router without supertest by manually constructing request/response objects and calling `router.handle(req, res, next)`? Express routers have a `handle` method (it's how they work as middleware). Yes! `router.handle(req, res, next)` or `router(req, res, next)`. An Express Router is itself a middleware function. So I can do:

```typescript
import dashboardRouter from '../src/routes/api/dashboard';
// ...
const req = { method: 'GET', url: '/', query: {}, headers: {}, user: { userId: '123' } } as any;
const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), setHeader: jest.fn(), end: jest.fn() } as any;
const next = jest.fn();

dashboardRouter(req, res, next);
```

Wait, but `authenticateToken` middleware is applied. The mocked `authenticateToken` calls `next()`. When `dashboardRouter(req, res, next)` is called, Express will iterate through the stack. The first layer is `authenticateToken`. It will call the mocked function, which calls `next()`. Then Express proceeds to the GET route layer. It matches the path `/` and method `GET`. Then it calls the route handler. This should work!

But `req` needs to be a valid enough mock for Express to do path matching. Express uses `req.method` and `req.url` (or `req.path`?). Actually, when a router handles a request, it uses `req.method` and `req.url` (or `req.baseUrl`?). For a top-level router, `req.url` should be `/`. And `req.method` should be `'GET'`.

Let's verify: `router.handle` is indeed a function. `router` is a function with signature `(req, res, next) => void`. So `dashboardRouter(req, res, next)` should trigger the routing.

This is brilliant. No supertest needed. No extra dependencies beyond `express` (which is already used by the source). I just need to mock `authenticateToken` to call `next()` and attach `req.user` if needed.

Wait, `authenticateToken` is a middleware that modifies `req.user`. The mocked version should simulate that. The source's `resolveDashboardUserId` reads `req.user?.userId`. So I need to set `req.user` on the mock request object before passing it to the router. The mocked `authenticateToken` doesn't need to do it; I can set it directly on `req` before calling the router. But if the real `authenticateToken` is supposed to set it, the mock should also set it to be realistic. However, since I'm controlling the test, I can just set `req.user` directly and have the mock `authenticateToken` call `next()` immediately. That works.

But what if `authenticateToken` checks headers and rejects? The mock will just call `next()`. That's fine for testing the dashboard logic.

So the plan:
1. Mock `../../src/utils/db` to provide a mock `withDbConnection`.
2. Mock `../../src/utils/jwt` to provide a mock `authenticateToken` that calls `next()`.
3. Create a helper to invoke the router: `const invoke = (reqOverrides: any) => { const req = { method: 'GET', url: '/', query: {}, headers: {}, ...reqOverrides }; const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), setHeader: jest.fn(), end: jest.fn() }; const next = jest.fn(); dashboardRouter(req as any, res as any, next); return { req, res, next }; };`
Wait, the handlers are async. `router` handles async by catching errors and passing to `next`. But `res.json` is called inside the async handler. Since I'm not using `await` on `dashboardRouter(...)` (because Express middleware signature doesn't return a promise usually, though async handlers do), I need to ensure the async operations complete before assertions.

Actually, `router` itself is not async. It triggers the middleware chain synchronously, but the async handler inside will run asynchronously. If I don't await anything, my assertions might run before `res.json` is called.

How does Express handle this? The router function returns `void`. It doesn't return a promise. So I can't `await dashboardRouter(...)`.

However, I can extract the specific route handler and await it directly. That brings us back to the stack inspection.

Alternatively, I can use `supertest` which handles the async nature of Express apps by wrapping `http.createServer(app)` and making actual HTTP requests over a socket, or by using `Test` class that waits for the response. But again, supertest.

Another option: Since `withDbConnection` is mocked, I can make it resolve synchronously or use `await Promise.resolve()` in the test after calling the router? No, because the route handler is async, but Express doesn't await it. The handler runs, and when it hits `await withDbConnection(...)`, it yields. The test code continues. Then the handler resumes later. To wait for it, I need to know when it's done. One way is to use `setImmediate` or `process.nextTick`, but that's brittle.

Wait, if `withDbConnection` is mocked with `jest.fn()`, I can make the mock implementation return a resolved promise immediately. But the handler is still `async`, so the event loop tick matters. If I use `await Promise.resolve();` or `await new Promise(setImmediate);` it might work, but it's not guaranteed.

Actually, if I mock `withDbConnection` to be synchronous? No, it's `async`.

Let's reconsider stack inspection and direct handler invocation.
If I extract the handler:
```typescript
const layer = (dashboardRouter as any).stack.find((l: any) => l.route?.path === '/' && l.route.methods.get);
const handler = layer.route.stack[0].handle;
```
Then I can `await handler(req, res)` because it's an async function. This is much cleaner for async testing. The only downside is bypassing the `authenticateToken` middleware. But I can test the middleware separately if needed, or I can test that the router stack includes it. But the prompt says "Only test the PUBLIC exported API". Is the stack internal? Yes. But for Express routers, this is a very common unit testing technique when you want to avoid the overhead of supertest.

However, there is a way to test the router functionally without supertest and without relying on stack internals: create an Express app, mount the router, and then use Node's `http` module to make a request to a server that is started and stopped? No, that requires a server.

What if I use `express`'s `app.handle`? No.

Let's think about what the prompt really wants. It wants a test file that compiles and passes. The exemplar is very simple. The module is a router. The most straightforward test is to verify that the default export is a Router instance and maybe has the expected routes. But that doesn't test the logic.

Given the constraints, I think the best approach is:
- Mock dependencies.
- Extract the GET route handler from `router.stack`.
- Test the handler directly with mock `req` and `res`.
- Also test the helper functions? No, they are not exported. Only `router` is exported. So I cannot test `buildDashboardOwnership` or `resolveDashboardUserId` directly. But I can test them indirectly through the handler.

Is extracting the handler from `router.stack` considered "testing the public exported API"? The public exported API is the router. Testing the router's behavior by invoking the handler that processes requests is testing the public API's behavior. The fact that I access the handler via `stack` is a means to an end. I think it's acceptable in this context.

But wait, the prompt says: "do NOT duplicate or re-implement the source". Extracting the handler is not duplicating/re-implementing. It's introspection.

Let's verify the exact shape of `router.stack`.
In Express 4, `router.stack` is an array of `Layer`. Each `Layer` has `route` if it's a route. `layer.route` is a `Route`. `route.stack` is an array of `Layer` for the route handlers. `layer.handle` is the function.

So:
```typescript
const getRoute = (dashboardRouter as any).stack.find(
  (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get
);
const getHandler = getRoute.route.stack[0].handle as (req: any, res: any) => Promise<void>;
```

I need to be careful with TypeScript. `(dashboardRouter as any)` is fine.

Now, what about `authenticateToken`? It's applied via `router.use(authenticateToken)`. This adds a layer to `router.stack` before the route layer. If I bypass the router and call the handler directly, I skip it. That's okay because the mock `authenticateToken` just calls `next()`. The real behavior of `authenticateToken` (auth) is not what I'm testing. I'm testing the dashboard data assembly.

However, `resolveDashboardUserId` reads `req.user`. If I call the handler directly, I need to ensure `req.user` is set. That's easy.

Let's design the tests:

**Test 1: Success path with projectId and userId**
- Mock `withDbConnection` to return arrays of results.
- `req.query = { projectId: 'proj-1' }`
- `req.user = { userId: 'user-1' }`
- Call handler.
- Assert `res.json` called with expected payload.
- Assert `ensureTasksProjectColumn` logic: since `projectId` is present, it should call `withDbConnection` at least once for the column check? Wait, `ensureTasksProjectColumn` uses its own `withDbConnection` call. But `withDbConnection` is mocked. If I mock it globally, it will be called by both `ensureTasksProjectColumn` and the main `withDbConnection`. This is tricky because `ensureTasksProjectColumn` calls `withDbConnection` with a callback that does `conn.query`. The main handler also calls `withDbConnection` with a callback that does `Promise.all([conn.query(...)])`.

If I use a single mock for `withDbConnection`, I need to distinguish between calls or just make it return the right thing based on the callback. Actually, `withDbConnection` is passed a callback. The mock should execute the callback with a mock `conn` and return the result.

Let's define a mock `conn`:
```typescript
const mockConn = {
  query: jest.fn(),
};
```
And `withDbConnection` mock:
```typescript
(withDbConnection as jest.Mock).mockImplementation(async (callback) => {
  return callback(mockConn);
});
```

But `ensureTasksProjectColumn` calls `conn.query("ALTER TABLE...")` and `conn.query("CREATE INDEX...")`. The mock `conn.query` should resolve (or reject) for these. The `try/catch` in `ensureTasksProjectColumn` swallows errors. So `mockConn.query` can just resolve to `[]` for any query.

Then the main `withDbConnection` call executes the callback which calls `conn.query` 5 times in `Promise.all`. So `mockConn.query` will be called 5 times. I can use `mockResolvedValue` or similar.

Wait, `withDbConnection` is called twice: once in `ensureTasksProjectColumn` (if projectId is present) and once in the main handler. The mock implementation will be invoked twice. The first time, the callback runs two `conn.query` calls. The second time, the callback runs five `conn.query` calls in parallel.

I need to make `mockConn.query` return appropriate values for each query.
Since the queries are different strings, I can use `mockImplementation((sql) => { ... })` to return based on the SQL string.

Let's map the queries:
1. `ALTER TABLE tasks ADD COLUMN...` -> return `[]` (or throw, but caught)
2. `CREATE INDEX idx_tasks_project_created...` -> return `[]` (or throw, but caught)
3. `SELECT status, COUNT(*) as count FROM tasks...` -> return `[ [{ status: 'completed', count: 5 }, { status: 'running', count: 2 }] ]` (MySQL query returns an array of rows, and the first element is the rows array? Actually, `mysql2/promise` `query` returns `[rows, fields]`. The code does `conn.query(...)` and then `taskStatsRows[0] as any[]`. So `taskStatsRows` is `[rows, fields]`. Thus `conn.query` should return a tuple/ array where the first element is the rows array.
4. `SELECT COUNT(*) as total FROM tasks...` -> return `[ [{ total: 10 }] ]`
5. `SELECT id, title... FROM tasks...` -> return `[ [{ id: 1, title: 'T1', ... }] ]`
6. `SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM feedback` -> return `[ [{ avg_rating: 4.5, total: 20 }] ]`
7. `SELECT COUNT(*) as count FROM shell_executions...` -> return `[ [{ count: 3 }] ]`

So `mockConn.query` should inspect the SQL string and return the appropriate mock data.

Let's write a helper:
```typescript
const mockConn = {
  query: jest.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('ALTER TABLE')) return [];
    if (sql.includes('CREATE INDEX')) return [];
    if (sql.includes('GROUP BY status')) return [[{ status: 'completed', count: 5 }, { status: 'failed', count: 1 }]];
    if (sql.includes('COUNT(*) as total FROM tasks')) return [[{ total: 6 }]];
    if (sql.includes('recentTasks')) return [[{ id: 't1', title: 'Task 1', intent: 'test', status: 'completed', elapsed_ms: 100, created_at: new Date(), project_id: 'p1' }]];
    if (sql.includes('feedback')) return [[{ avg_rating: 4.2, total: 10 }]];
    if (sql.includes('shell_executions')) return [[{ count: 7 }]];
    return [[]];
  }),
};
```

Wait, the recent tasks query is `SELECT id, title, intent, status, elapsed_ms, created_at, project_id FROM tasks...`. I can match on `SELECT id, title`.

And `withDbConnection` mock:
```typescript
(withDbConnection as jest.Mock).mockImplementation(async (callback) => {
  return callback(mockConn);
});
```

But `ensureTasksProjectColumn` has a module-level state `tasksProjectColumnEnsured`. Once it's set to `true`, subsequent calls skip the column check. I need to reset this state between tests. However, it's module-level state in the source. Since I'm importing the module, the state persists across tests in the same file. I need to reset it. But it's not exported. How can I reset it?

I can use `jest.resetModules()` and re-import, but rule 1 says import exactly as specified. I can do:
```typescript
let dashboardRouter: any;
beforeEach(async () => {
  jest.resetModules();
  dashboardRouter = (await import('../src/routes/api/dashboard')).default;
});
```
This is allowed. It re-imports the module fresh for each test, resetting the module-level state. This is important because `tasksProjectColumnEnsured` is a closure variable.

Alternatively, I can mock the module under test? No, rule 1 says import it, don't re-implement. But `jest.resetModules()` and dynamic import is a standard way to handle module state.

However, the prompt says "Import the module under test EXACTLY as: import ... from '../src/routes/api/dashboard';". This is a static import at the top. If I use dynamic import inside `beforeEach`, I might violate the "EXACTLY" rule? The rule says "Import the module under test EXACTLY as: import ... from '../src/routes/api/dashboard'; (do NOT duplicate or re-implement the source)." It might mean the path must be exact, and I shouldn't avoid importing it. But if I need a fresh instance, dynamic import is the way. However, I can also just accept that the state persists and order tests accordingly, or mock `withDbConnection` to handle the first call being the column ensure. But the tests should be independent.

Actually, I can just not test the `ensureTasksProjectColumn` path more than once, or I can test it in a way that doesn't depend on the state. But if I run two tests with `projectId`, the first one sets `tasksProjectColumnEnsured = true`, and the second one skips it. That's actually fine if I assert the number of `withDbConnection` calls accordingly. But it's better to reset.

Can I reset the state by manipulating the module? Since it's not exported, I can't easily access it. `jest.resetModules()` is the cleanest.

But the exemplar uses a static import. The prompt says "Import the module under test EXACTLY as: import ... from '../src/routes/api/dashboard';". This strongly suggests a top-level static import. If I use dynamic import, I violate the letter of the rule.

What if I just run the tests in an order where the state doesn't matter? Or I can mock `withDbConnection` to track calls and accept that the first test with `projectId` will trigger the ensure, and subsequent ones won't. But that's not ideal.

Wait, is there a way to reset the module state without re-importing? I could mock the entire module? No.

Another thought: I can test the error path first (no projectId), then the success path with projectId. But if I have multiple tests with projectId, the second one won't see the ensure call. I can structure tests to avoid multiple projectId tests, or I can make the mock `withDbConnection` handle both cases gracefully regardless of whether `ensureTasksProjectColumn` is called. Since `withDbConnection` is mocked, the actual SQL won't run. The only difference is an extra call to `withDbConnection` at the beginning. I can assert `withDbConnection` call count loosely or use `expect.anything()`.

But the state `tasksProjectColumnEnsured` is global to the module. If I can't reset it, I should write tests that are tolerant of it. For example:
- Test A: no projectId. `ensureTasksProjectColumn` is not called. `withDbConnection` called once.
- Test B: with projectId. `ensureTasksProjectColumn` may or may not be called depending on order. To make it deterministic, I can run Test B in a separate `describe` block with `jest.isolateModules`? That's dynamic import again.

Actually, `jest.isolateModules` is designed for this:
```typescript
let dashboardRouter: any;
beforeEach(() => {
  jest.isolateModules(() => {
    dashboardRouter = require('../src/routes/api/dashboard').default;
  });
});
```
But this uses `require`, not `import`. And it's inside a callback. TypeScript might complain about `require`. Also, the prompt says "import exactly as".

Hmm. What if I just accept that `tasksProjectColumnEnsured` will be true after the first test with a projectId, and I write only one test with a projectId? I can cover the main logic in one test, and the error path in another without projectId. That's sufficient.

Let's design the tests:

1. **Test: returns dashboard data without projectId and without userId**
   - `req.query = {}`
   - `req.user = undefined`
   - Mock `withDbConnection` to return data.
   - Call handler.
   - Assert `res.json` with correct stats, recentTasks, generatedAt.
   - Assert ownership clause is not applied (user_id = ? missing). How to verify? By checking the SQL parameters passed to `conn.query`. I can inspect `mockConn.query` calls.

2. **Test: returns dashboard data with projectId and userId**
   - `req.query = { projectId: 'proj-1' }`
   - `req.user = { userId: 42 }`
   - Mock `withDbConnection`.
   - Call handler.
   - Assert `res.json` correct.
   - Assert `conn.query` calls include `project_id = ?` and `user_id = ?` with correct params.

3. **Test: handles database errors gracefully**
   - Make `withDbConnection` throw.
   - Assert `res.json` returns zeroed stats and empty recentTasks.

4. **Test: ensureTasksProjectColumn is called when projectId is present**
   - This is implicitly tested in test 2. But because of state, maybe I should just check that `withDbConnection` was called an extra time? Actually, if I can't reset state, and this test runs after test 2, it won't be called. So maybe I should only have one test with projectId.

Let's refine. I'll have:
- Test 1: No projectId, no user. Verifies basic query and response shape.
- Test 2: With projectId and userId. Verifies ownership clause and project filter, and column ensure.
- Test 3: Error fallback.

But if Test 2 runs after Test 1, and Test 1 doesn't set `tasksProjectColumnEnsured`, Test 2 will trigger it. Good. If Test 1 runs after Test 2 (if I had one), it wouldn't. So I'll order them carefully or just not have another projectId test. I'll put the projectId test first if needed? No, `tasksProjectColumnEnsured` starts false. Any test with projectId will trigger it. Only the first such test triggers it. So I can have exactly one test with projectId. That's fine.

Wait, what if I want to test that `ensureTasksProjectColumn` only runs once? I can't easily reset state, so I'll skip that.

Now, about `buildDashboardOwnership` and `resolveDashboardUserId`: they are not exported, but their behavior is tested indirectly.

Let's write the mock for `conn.query` carefully.

The queries use `?` placeholders. The parameters are passed as arrays.
Query 1 (tasks stats): 
`SELECT status, COUNT(*) as count FROM tasks WHERE (? = '' OR project_id = ?) AND status <> 'archived'${ownership.clause} GROUP BY status`
Params: `[projectId, projectId, ...ownership.params]`

If `projectId` is `'proj-1'` and `userId` is `42`:
Params: `['proj-1', 'proj-1', 42]`
Clause: ` AND user_id = ?`

If no userId:
Params: `['proj-1', 'proj-1']`
Clause: ``

If no projectId (empty string):
Params: `['', '', ...]` or just `['', '']` if no user.

I can verify the params by inspecting `mockConn.query.mock.calls`.

Let's define the mock:

```typescript
const mockQuery = jest.fn().mockImplementation(async (sql: string, params: any[]) => {
  if (sql.includes('ALTER TABLE') || sql.includes('CREATE INDEX')) {
    return [];
  }
  if (sql.includes('GROUP BY status')) {
    return [[
      { status: 'completed', count: 3 },
      { status: 'running
