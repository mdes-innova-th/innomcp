<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T058 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1663,"completion_tokens":8000,"total_tokens":9663,"prompt_tokens_details":{"cached_tokens":72,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 82s
 generated: 2026-06-13T11:04:15.018Z -->
The user wants a Jest unit test file for the `memories` router module in `innomcp-node`.

Key requirements:
1. Import EXACTLY as: `import ... from '../src/routes/api/memories';`
2. Only test the PUBLIC exported API. The exported thing is `default router`. Since it's an Express router, I need to test it via an Express app or using `supertest`. However, the instructions say "Only test the PUBLIC exported API actually present in the source below." The source exports `default router`. So I should test the router by mounting it in an Express app and using supertest, or by directly invoking the router? Usually, for Express routers, we use `supertest` with a small Express app. But supertest is an external dependency. Is it available? The prompt doesn't mention it, but it's standard for testing Express routes. However, I can also test by creating an Express app and using `request(app)...` if supertest is implied. Wait, the prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock(). Keep tests deterministic and offline." It doesn't explicitly say I must use supertest. I can create an Express app and use `supertest` if I assume it's installed. But to be safe and strictly offline without extra network, I can test the router by mounting it and using `supertest`. Actually, supertest makes HTTP calls to the app without hitting the network (it intercepts them). That's standard.

But wait, the prompt says "The test file MUST compile under strict TypeScript and pass without a live server or DB." Using supertest is fine because it doesn't need a live server (it binds to the app directly). However, is supertest part of the project's dependencies? I don't know. The prompt doesn't mention it. Maybe I should avoid supertest if not mentioned? But how else do you test an Express router? You can manually invoke the route handlers by mocking `req` and `res`. That's also valid and doesn't require supertest. Given the strict rules and the exemplar style (which is very unit-testy, not integration-testy), maybe manually invoking the handlers is safer, or mounting the router in an app and using supertest. Let's think.

Actually, looking at the exemplar: it's a simple class unit test. The module under test here is an Express router. The "public exported API" is the router object, which has route handlers attached. Testing an Express router typically involves HTTP-level assertions. But without supertest, I can create a mini Express app in the test and use `supertest`. If I don't know if supertest is installed, I might be inventing a dependency. However, the prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock()." It doesn't say I can't use other test helpers. But to be absolutely safe and self-contained, I can test the router by creating an Express application in the test file and using `supertest`. But if supertest isn't available, the test file won't compile. Hmm.

Alternative: I can import `router` and then test the route handlers by extracting them? No, they are anonymous functions attached to the router. I could iterate over `router.stack` to get the handlers, but that's brittle and not testing the public API (which is the router itself).

Another alternative: Use `jest.mock` on `express`? No, that would be messy.

Wait, maybe I can just use `supertest`. It's extremely common in Node/Express projects. The prompt mentions "testEnvironment node" and "ts-jest". It's reasonable to assume supertest is available. But the prompt also says "Only test the PUBLIC exported API actually present in the source below." The source exports `default router`. So I will test the router using supertest.

However, I need to mock `../../utils/db` and `../../utils/jwt`. The `withDbConnection` is used in the module. I need to mock it to return a `conn` object with a `query` method. Also `optionalAuth` is a middleware from `../../utils/jwt`. I need to mock it so it just calls `next()` (or sets `req.user`).

Let's plan the mocks:

1. `jest.mock('../../utils/db', () => ({ withDbConnection: jest.fn() }));`
2. `jest.mock('../../utils/jwt', () => ({ optionalAuth: jest.fn((req, res, next) => next()), AuthRequest: {} }));` Wait, `AuthRequest` is a type. In TS, types are erased. But the import `type AuthRequest` might cause issues if the mock doesn't export it? Actually, since it's `import { optionalAuth, type AuthRequest }`, the type import is erased at runtime. So the mock only needs to export `optionalAuth`. But the module under test imports `type AuthRequest` from the same path. Since it's a type-only import, it's fine.

Wait, the import in the source is:
`import { optionalAuth, type AuthRequest } from "../../utils/jwt";`

So the mock factory for `../../utils/jwt` must return an object with `optionalAuth`. The `type AuthRequest` is compile-time only.

For `withDbConnection`, it's used as:
`await withDbConnection(async (conn) => { ... })`
So `withDbConnection` should be a mock that takes a callback and invokes it with a mocked `conn`.

Mocked `conn.query` should be a jest.fn() that returns a Promise resolving to `[rows]` or whatever.

Also, `ensureProjectAccess` is an internal function, not exported. So I cannot test it directly. I must test it indirectly via the routes.

Routes to test:
- GET /
- GET /search
- POST /
- DELETE /:id

I need to create an Express app, mount the router, and use supertest.

Wait, but does the prompt allow supertest? It says "OUTPUT CONTRACT: respond with ONE fenced typescript code block containing the COMPLETE test file and NOTHING else". It doesn't forbid supertest. But if supertest is not installed, the test won't compile. However, in the context of an innomcp-node package, it's highly likely they have supertest. But to be 100% safe, maybe I can avoid supertest and instead manually construct req/res objects and call `router.handle`? Express router has an internal `handle` method but it's not public API. Better to use supertest.

Actually, I can create an Express app in the test and use `supertest`. Let's assume supertest is available. If not, I could just use `import request from 'supertest';`. But if the package doesn't have it, the import would fail. Hmm.

Another thought: The prompt says "Only test the PUBLIC exported API actually present in the source below." The exported API is an Express Router. The standard way to test an Express Router is to mount it in an Express app and use supertest. I think that's the intended approach.

Let's design the tests:

Mock `withDbConnection`:
```typescript
import { withDbConnection } from '../../utils/db';
jest.mock('../../utils/db', () => ({
  withDbConnection: jest.fn(async (cb) => cb(mockConn)),
}));
```

Where `mockConn` is `{ query: jest.fn() }`.

Mock `optionalAuth`:
```typescript
jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((req, res, next) => {
    // optionally set req.user based on headers if we want
    next();
  }),
}));
```

But wait, `optionalAuth` is a middleware. If we mock it as a jest.fn that calls next, it will just pass through. To test authenticated vs unauthenticated, we can have the mock inspect `req.headers['x-test-auth']` or something and set `req.user`. But the mock is defined once at module load time. We can make the mock implementation dynamic using `jest.fn()` and then change its behavior in tests? Actually, since `optionalAuth` is imported by the module under test at load time, and the module under test does `router.use(optionalAuth)`, the mock function reference is captured. If we change `optionalAuth.mockImplementation` later, it will affect subsequent requests because the router calls the same function reference. So we can do:

```typescript
let mockUser: { userId: number } | null = null;
jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((req: any, res: any, next: any) => {
    if (mockUser) req.user = mockUser;
    next();
  }),
}));
```

But `mockUser` is defined in the test scope, and the factory function runs at module load time (before tests). To make it dynamic, we can store the user in a global or use a mutable object. However, in Jest, `jest.mock` hoisting means the factory cannot reference variables from the outer scope unless they are also hoisted or defined in a separate module. Actually, Jest docs say: "The mock factory cannot reference variables defined outside the factory." So I can't reference `mockUser` directly. But I can use a mutable object defined in a separate file, or I can mock the module with a function that reads from `process.env` or a global variable. Or simpler: I can just not mock `optionalAuth` and instead mock the `jwt` module's `optionalAuth` to just call next, and then manually set `req.user` in a preceding middleware when setting up the app. Wait, the router is imported and already has `optionalAuth` baked in. But if I mount a middleware *before* the router in my test app, `req.user` will be set before `optionalAuth` runs. Then `optionalAuth` runs and might overwrite it? Let's check the source: `router.use(optionalAuth);`. If `optionalAuth` just calls `next()` without touching `req.user`, then any `req.user` set before will remain. So I can just mock `optionalAuth` to call `next()` and in the test app, do:

```typescript
app.use((req, res, next) => {
  req.user = currentUser;
  next();
});
app.use(router);
```

That works! And `optionalAuth` mock is simple.

So:

```typescript
jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((req, res, next) => next()),
}));
```

This is clean.

Now, `withDbConnection` mock. We need to mock it to call the callback with `mockConn`. But we also need to be able to verify calls or control results per test.

```typescript
const mockQuery = jest.fn();
const mockConn = { query: mockQuery };

jest.mock('../../utils/db', () => ({
  withDbConnection: jest.fn(async (cb: any) => cb(mockConn)),
}));
```

But again, `mockConn` is defined in the test scope. The factory cannot reference it. However, we can define `mockQuery` inside the factory and export it? No, the factory returns the module exports. We can have the factory return a `withDbConnection` that calls a global mutable `mockConn`. But we can't reference `mockConn` from the outer scope.

Alternative: Use `jest.mock` with a factory that creates its own internal mock, and then use `jest.requireMock` to access it in tests.

```typescript
jest.mock('../../utils/db', () => {
  const mockQuery = jest.fn();
  const mockConn = { query: mockQuery };
  return {
    withDbConnection: jest.fn(async (cb: any) => cb(mockConn)),
    __mockQuery: mockQuery,
    __mockConn: mockConn,
  };
});
```

Then in tests:
```typescript
const { withDbConnection, __mockQuery } = jest.requireMock('../../utils/db');
```

But the module under test only imports `withDbConnection`. The extra exports are fine. However, `__mockQuery` is a bit ugly but acceptable. Actually, we can just mock `withDbConnection` as a jest.fn, and then in each test, set its implementation to call the callback with a conn that has a query mock we control.

```typescript
jest.mock('../../utils/db', () => ({
  withDbConnection: jest.fn(),
}));
```

Then in tests:
```typescript
const mockQuery = jest.fn();
(withDbConnection as jest.Mock).mockImplementation(async (cb) => cb({ query: mockQuery }));
```

This is cleaner. `withDbConnection` is imported from the mocked module. Since `jest.mock` is hoisted, the import will get the mocked version. We can cast it to `jest.Mock` and set implementations per test. This is standard.

Similarly for `optionalAuth`:
```typescript
jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((req, res, next) => next()),
}));
```

This is fine.

Now, the test structure:

```typescript
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import memoriesRouter from '../src/routes/api/memories';
import { withDbConnection } from '../../utils/db';
```

Wait, import path: `from '../src/routes/api/memories';` relative to `innomcp-node/tests/`. So the test file is in `innomcp-node/tests/something.test.ts`. The import `../src/routes/api/memories` is correct.

Also import `withDbConnection` from `../../utils/db`? Wait, from `tests/` to `utils/db` is `../src/utils/db`? No, the module under test imports `../../utils/db` relative to `src/routes/api/`. In the test file, which is in `tests/`, the path to `utils/db` would be `../src/utils/db`. But the prompt says to mock external dependencies. I should mock `../src/utils/db` and `../src/utils/jwt` from the test's perspective? Wait, the test file is in `innomcp-node/tests/`. The module under test is in `innomcp-node/src/routes/api/memories.ts`. The module under test imports `../../utils/db` which resolves to `innomcp-node/src/utils/db`. When Jest resolves mocks, it mocks the module by its path as resolved from the test file. So from `tests/`, the path to `src/utils/db` is `../src/utils/db`. However, `jest.mock` paths are relative to the test file. So I should use `jest.mock('../src/utils/db', ...)`. Wait, but the module under test uses `../../utils/db`. Jest's module resolution will resolve that to the same file. The mock path in `jest.mock` must be the path as imported in the test file or the resolved module path. Actually, `jest.mock` uses the same resolution algorithm as `require/import`, relative to the file where `jest.mock` is called. So from `tests/memories.test.ts`, `../src/utils/db` resolves to `src/utils/db`. The module under test imports `../../utils/db` from `src/routes/api/`, which also resolves to `src/utils/db`. So mocking `../src/utils/db` should work.

But wait, the prompt says: "Import the module under test EXACTLY as: import ... from '../src/routes/api/memories';". It doesn't specify how to mock dependencies. I should use paths relative to the test file.

So:
```typescript
jest.mock('../src/utils/db', () => ({
  withDbConnection: jest.fn(),
}));

jest.mock('../src/utils/jwt', () => ({
  optionalAuth: jest.fn((req: any, res: any, next: any) => next()),
}));
```

And import them to cast:
```typescript
import { withDbConnection } from '../src/utils/db';
```

Wait, but `withDbConnection` is not exported from the module under test. It's an external dependency. The prompt says "Mock external dependencies". So importing it in the test to get the mocked version is fine.

Now, let's write the tests.

Setup:
```typescript
import request from 'supertest';
import express from 'express';
import memoriesRouter from '../src/routes/api/memories';
import { withDbConnection } from '../src/utils/db';

jest.mock('../src/utils/db', () => ({
  withDbConnection: jest.fn(),
}));

jest.mock('../src/utils/jwt', () => ({
  optionalAuth: jest.fn((req: any, res: any, next: any) => next()),
}));

describe('memories router', () => {
  let app: express.Application;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockQuery = jest.fn();
    (withDbConnection as jest.Mock).mockImplementation(async (cb: any) => {
      return cb({ query: mockQuery });
    });
    app.use((req: any, res, next) => {
      // default unauthenticated
      next();
    });
    app.use(memoriesRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
```

Wait, `app.use(memoriesRouter)` will apply `optionalAuth` which is mocked to call next. Then the route handlers.

But I need to be able to set `req.user` for authenticated tests. I can add a middleware before the router:

```typescript
let currentUser: any = null;
beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use((req: any, res, next) => {
    if (currentUser) req.user = currentUser;
    next();
  });
  app.use(memoriesRouter);
});
```

And set `currentUser` in each test as needed.

Now, tests for GET /:

1. Unauthenticated, no projectId, returns memories.
   - Query: `?scope=session&sessionId=abc`
   - `withDbConnection` callback builds query with `user_id`? Wait, `userId = req.user?.userId ?? null`. If unauthenticated, `userId` is null, so no `user_id` filter.
   - `mockQuery` resolves to `[ [ { id: 1, ... } ] ]` (since `conn.query` returns `[result]` and `result` is the rows).
   - Actually, in the source: `const [r] = await conn.query(query, params) as any[]; return r;`. So `conn.query` returns an array where the first element is the rows. So `mockQuery` should return a promise resolving to `[ [row1, row2] ]`.
   - Then `res.json({ memories: rows })` where rows is `[row1, row2]`.

2. Authenticated with projectId, access granted.
   - `req.user = { userId: 1 }`.
   - `projectId = 1`.
   - `ensureProjectAccess` queries projects. It calls `withDbConnection` again! Wait, `ensureProjectAccess` is called inside the route handler, and it calls `withDbConnection`. So `withDbConnection` will be called twice: once for access check, once for fetching memories.
   - We need to handle multiple calls to `withDbConnection` with different callbacks. This is tricky. `withDbConnection` mock implementation receives a callback. We need to distinguish between the access check callback and the main query callback.
   - The access check callback does: `conn.query("SELECT id FROM projects...", [projectId, userId])`. Then returns `result`.
   - The main callback does the memory query.
   - Since `withDbConnection` is a generic mock, we can inspect the callback or the query string. But the callback is a function. We can make `mockQuery` behave differently based on the query string it receives.
   - Let's make `mockQuery` a mock that inspects its first argument (the SQL string) and returns appropriate results.
   - For `ensureProjectAccess`: if query includes `SELECT id FROM projects`, return `[ [ { id: 1 } ] ]`.
   - For memory queries: return `[ [ { id: 1, scope: 'session', key_name: 'k', value: 'v', created_at: new Date(), updated_at: new Date() } ] ]`.

   Since `withDbConnection` passes the same `mockConn` object, `mockQuery` will be called with different SQL strings. We can use `mockQuery.mockImplementation((sql) => { ... })`.

   Example:
   ```typescript
   mockQuery.mockImplementation(async (sql: string) => {
     if (sql.includes('FROM projects')) {
       return [ [ { id: 1 } ] ];
     }
     if (sql.includes('FROM memories')) {
       return [ [ { id: 1, scope: 'session', key_name: 'k', value: 'v', created_at: '2024-01-01', updated_at: '2024-01-01' } ] ];
     }
     return [ [] ];
   });
   ```

   This is clean and handles multiple calls.

3. Authenticated with projectId, access denied.
   - `mockQuery` for projects returns `[ [] ]`.
   - Expect 403.

4. GET / with DB error in main query.
   - `mockQuery` rejects for memory query.
   - Expect `{ memories: [] }`.

Wait, the route has `try/catch` around the main query. If `withDbConnection` itself throws, or the callback throws, it catches. Our `withDbConnection` mock calls the callback. If the callback throws, `withDbConnection` mock will throw (since we didn't catch inside the mock). But the route catches errors inside the try/catch. So if `mockQuery` rejects, the `await conn.query(...)` inside the callback rejects, which causes the callback to reject, which causes `withDbConnection` to reject, which is caught by the route's catch block. So that's fine.

But for `ensureProjectAccess`, it has `.catch(() => false)`. So if `withDbConnection` rejects there, it returns false. So if we want to test that, we can make `withDbConnection` reject when called with the projects query. But our mock implementation for `withDbConnection` is `async (cb) => cb({ query: mockQuery })`. If `cb` rejects, `withDbConnection` rejects. That's fine.

However, we need to be careful: `withDbConnection` is shared. If we want to test a case where `ensureProjectAccess`'s `withDbConnection` call rejects, we can make `mockQuery` reject for the projects query. But `ensureProjectAccess` does `.catch(() => false)`, so it will handle it.

Now, GET /search:

1. Missing `q` -> 400.
2. With `q`, unauthenticated, no projectId -> returns search results.
   - `mockQuery` for memories returns rows.
   - Note the query uses `key_name LIKE ? OR value LIKE ?`.
   - The route returns `{ memories: rows ?? [] }`.

3. With projectId, access denied -> 403.

POST /:

1. Missing keyName -> 400.
2. Missing value -> 400. (value === undefined). If value is null, it's not undefined, so it should proceed? The check is `if (!keyName || value === undefined)`. So `value = null` is allowed? Actually `null` is not undefined, so it passes. But `String(null)` is `"null"`. That's fine.
3. Success -> 200, `{ success: true }`.
   - `mockQuery` for INSERT resolves.
   - Need to check that `ensureProjectAccess` is called for projectId.
4. Project access denied -> 403.
5. DB error -> 500.

DELETE /:id:

1. Success -> 200, `{ success: true }`.
2. DB error -> 500.

Also, need to test the `ensureProjectAccess` when `projectId` is undefined -> returns true (no check). So a request with no projectId should skip the access check.

Let's structure the tests.

One issue: `jest.useFakeTimers()`? The prompt says "Use fake timers for any time/interval logic." There is no time/interval logic in this module. But the prompt says "Use fake timers for any time/interval logic." Since there is none, we don't need fake timers. But should we include them just in case? The exemplar uses them because CacheManager had TTL. Here there are no timers. So we can omit `jest.useFakeTimers()`.

Wait, the source uses `NOW()` in SQL, but that's DB-side, not JS timers. So no fake timers needed.

Let's draft the code.

```typescript
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import memoriesRouter from '../src/routes/api/memories';
import { withDbConnection } from '../src/utils/db';

jest.mock('../src/utils/db', () => ({
  withDbConnection: jest.fn(),
}));

jest.mock('../src/utils/jwt', () => ({
  optionalAuth: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

describe('memories router', () => {
  let app: express.Application;
  let mockQuery: jest.Mock;
  let currentUser: { userId: number } | null;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    currentUser = null;
    app.use((req: any, res: Response, next: NextFunction) => {
      if (currentUser) {
        req.user = currentUser;
      }
      next();
    });
    mockQuery = jest.fn();
    (withDbConnection as jest.Mock).mockImplementation(async (callback: any) => {
      return callback({ query: mockQuery });
    });
    app.use(memoriesRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    test('returns memories for unauthenticated user without user_id filter', async () => {
      mockQuery.mockResolvedValueOnce([[]]); // no project access check because no projectId
      mockQuery.mockResolvedValueOnce([[{ id: 1, scope: 'session', key_name: 'k', value: 'v', created_at: '2024-01-01', updated_at: '2024-01-01' }]]);

      const res = await request(app).get('/?scope=session&sessionId=s1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ memories: [{ id: 1, scope: 'session', key_name: 'k', value: 'v', created_at: '2024-01-01', updated_at: '2024-01-01' }] });
      expect(mockQuery).toHaveBeenCalledTimes(1); // Wait, no projectId, so ensureProjectAccess not called. Only 1 call.
    });
  });
});
```

Wait, `ensureProjectAccess` is called regardless? Let's check the source:

```typescript
router.get("/", async (req: AuthRequest, res: Response) => {
  const { scope, sessionId, projectId } = req.query as Record<string, string>;
  const hasProjectAccess = await ensureProjectAccess(projectId, req.user?.userId ?? null).catch(() => false);
  if (projectId && !hasProjectAccess) {
    return res.status(403).json({ error: "Project access denied" });
  }
  // ...
});
```

`ensureProjectAccess` is called even if `projectId` is undefined. Inside `ensureProjectAccess`, if `projectId` is undefined, it returns `true` immediately (no DB call). So `withDbConnection` is NOT called for access check when projectId is absent. Good.

So for GET / without projectId, `withDbConnection` is called only once (for the main query).

For GET / with projectId, `ensureProjectAccess` calls `withDbConnection` (1st time), then main query calls it again (2nd time). So `withDbConnection` is called twice.

Our `withDbConnection` mock implementation calls `callback({ query: mockQuery })`. So each time, `mockQuery` is invoked. We can use `mockQuery.mockResolvedValueOnce` in order.

But careful: `ensureProjectAccess` does:
```typescript
const rows = await withDbConnection(async (conn) => {
    const [result] = await conn.query(...) as any[];
    return result as any[];
});
```

So `conn.query` returns `[ [rows] ]`. The callback then returns `result` (which is `rows`). Then `ensureProjectAccess` checks `Array.isArray(rows) && rows.length > 0`.

So for access granted: `mockQuery` for projects should resolve to `[ [ { id: 1 } ] ]`. Then `result` is `[ { id: 1 } ]`, which is an array with length > 0 -> true.

For access denied: `mockQuery` for projects resolves to `[ [] ]`. Then `result` is `[]`, length 0 -> false.

For the main query: `mockQuery` resolves to `[ [ memoryRows ] ]`. The callback does `const [r] = await conn.query(...) as any[]; return r;`. So `r` is the memoryRows array. Then `res.json({ memories: rows })` where rows is memoryRows.

So `mockQuery.mockResolvedValueOnce([ [ { id: 1 } ] ])` for projects.
Then `mockQuery.mockResolvedValueOnce([ [ { id: 2, ... } ] ])` for memories.

Let's write the tests.

Test 1: GET / unauthenticated, no projectId.
- `mockQuery.mockResolvedValueOnce([[]])`? Wait, no projectId means no access check, so `withDbConnection` is called only once. We need to set up `mockQuery` to return memories.
- `mockQuery.mockResolvedValueOnce([ [ { id: 1, scope: 'session', key_name: 'k1', value: 'v1', created_at: '2024-01-01', updated_at: '2024-01-01' } ] ])`.
- Request: `GET /?scope=session&sessionId=s1`.
- Expect 200, body `{ memories: [ ... ] }`.
- Check `mockQuery` was called with query string containing `FROM memories` and params `[ 'session', 's1' ]`? Actually, the query is built dynamically. Let's check the query for unauthenticated:
  - `userId` is null, so no `AND user_id = ?`.
  - `scope` is present, so `AND scope = ?` param `session`.
  - `sessionId` present, so `AND session_id = ?` param `s1`.
  - `projectId` absent.
  - Final query: `SELECT ... FROM memories WHERE 1=1 AND scope = ? AND session_id = ? ORDER BY updated_at DESC LIMIT 50`.
  - Params: `['session', 's1']`.
- We can assert `mockQuery` call args.

Test 2: GET / authenticated, with projectId, access granted.
- Set `currentUser = { userId: 1 }`.
- `mockQuery` 1st call (projects): `sql` includes `FROM projects`, params `[projectId, 1]`. Resolve `[ [ { id: 1 } ] ]`.
- `mockQuery` 2nd call (memories): `sql` includes `FROM memories`, params `[1, 'session', 's1', 'p1']`? Wait, userId is 1, scope is session, sessionId is s1, projectId is p1.
  - Query: `... WHERE 1=1 AND user_id = ? AND scope = ? AND session_id = ? AND project_id = ? ...`
  - Params: `[1, 'session', 's1', 'p1']`.
- Resolve with some rows.
- Expect 200.

Test 3: GET / authenticated, with projectId, access denied.
- Set `currentUser = { userId: 1 }`.
- `mockQuery` 1st call (projects): resolve `[ [] ]`.
- Expect 403. `mockQuery` should be called once (access check), and the main query should not be called.

Test 4: GET / with DB error in main query.
- No projectId.
- `mockQuery.mockRejectedValueOnce(new Error('DB error'))`.
- Expect 200 with `{ memories: [] }`.

Test 5: GET /search without `q`.
- Request `GET /search?scope=session`.
- Expect 400, `{ error: 'q required' }`.
- No DB calls.

Test 6: GET /search with `q`, unauthenticated.
- `mockQuery.mockResolvedValueOnce([[]])`? Wait, search route:
  - `hasProjectAccess` is called only if `projectId` is present. If no projectId, no access check.
  - Then main query.
- So `withDbConnection` called once.
- `mockQuery.mockResolvedValueOnce([ [ { id: 1, keyName: 'k', value: 'v', createdAt: '...', updatedAt: '...', scope: 'session', tag: null } ] ])`.
- Note the search query selects `key_name AS keyName`, etc.
- Request: `GET /search?q=test&scope=session&sessionId=s1`.
- Expect 200, body `{ memories: [ ... ] }`.
- Check query includes `LIKE ?` and params `['%test%', '%test%', 'session', 's1']`. Also `searchUserId` is null, so no user_id filter.

Test 7: GET /search with projectId, access denied.
- Set `currentUser = { userId: 1 }`.
- `mockQuery` 1st call (projects): resolve `[ [] ]`.
- Expect 403.

Test 8: POST / missing keyName.
- Request `POST /` with `{ value: 'v' }`.
- Expect 400, `{ error: 'keyName and value required' }`.

Test 9: POST / missing value (undefined).
- Request `POST /` with `{ keyName: 'k' }`.
- Expect 400.

Test 10: POST / success, unauthenticated, no projectId.
- Request `POST /` with `{ scope: 'session', keyName: 'k', value: 'v', sessionId: 's1' }`.
- `mockQuery.mockResolvedValueOnce([[]])`? No projectId, so no access check. `withDbConnection` called once.
- `mockQuery.mockResolvedValueOnce([ { insertId: 1 } ])`? Actually the query is INSERT ... ON DUPLICATE KEY UPDATE. The result of this query is an OkPacket, but the code doesn't use the result. It just awaits it. So any resolution is fine.
- Expect 200, `{ success: true }`.
- Check `mockQuery` called with SQL containing `INSERT INTO memories` and params `['session', 'k', 'v', 's1', null, null]`. Wait, `String(value)` is used. So if value is 'v', param is 'v'. `sessionId ?? null` -> 's1'. `projectId ?? null` -> null. `tag ?? null` -> null.

Test 11: POST / with projectId, access denied.
- Set `currentUser = { userId: 1 }`.
- `mockQuery` 1st call (projects): resolve `[ [] ]`.
- Expect 403.

Test 12: POST / DB error.
- No projectId.
- `mockQuery.mockRejectedValueOnce(new Error('DB error'))`.
- Expect 500, `{ error: 'Could not save memory' }`.

Test 13: DELETE /:id success.
- `DELETE /123`.
- `mockQuery.mockResolvedValueOnce([ { affectedRows: 1 } ])`.
- Expect 200, `{ success: true }`.

Test 14: DELETE /:id DB error.
- `mockQuery.mockRejectedValueOnce(new Error('DB error'))`.
- Expect 500, `{ error: 'Could not delete' }`.

Wait, for DELETE, `withDbConnection` is called once. The callback does `conn.query("DELETE FROM memories WHERE id = ?", [req.params.id])`. The result is not used. So any resolution is fine.

Now, about TypeScript strictness:
- Need to type things properly.
- `withDbConnection` is imported from mocked module. Its type is probably `(cb: (conn: any) => Promise<any>) => Promise<any>`. We cast to `jest.Mock`.
- `mockQuery` is `jest.Mock`.
- `currentUser` type: `{ userId: number } | null`.
- The middleware that sets `req.user` needs to be typed. We can use `any` for req to avoid issues, or extend the Request type. Since it's a test, using `any` is pragmatic but strict TypeScript might complain with `noImplicitAny`? Actually, if we type the middleware as `(req: any, res: Response, next: NextFunction)`, that's fine because `any` is explicit.

Wait, `Request` and `Response` from express. We need to import them.

Let's check if `supertest` types need to be imported. Usually `import request from 'supertest';` works if `@types/supertest` is installed. If not, we might get compilation errors. But assuming standard setup.

Alternatively
