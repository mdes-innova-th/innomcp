<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T043 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1447,"completion_tokens":8000,"total_tokens":9447,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T11:01:07.142Z -->
The user wants a Jest unit test for the `sessions` router module in an innomcp-node package.

Key requirements:
1. Import exactly as: `import ... from '../src/routes/api/admin/sessions';`
2. Only test the public exported API (which is `sessionsRouter` - an Express Router).
3. Mock external dependencies: `sessionRegistry`, `adminAuditLog` (logAdminAction), `express` (maybe not needed if testing router directly via request mocking or route handlers).
4. Use fake timers for any time/interval logic (though there isn't explicit time logic in the source, but `logAdminAction` is async, so maybe not strictly needed, but I should include fake timers setup as per rules).
5. Must compile under strict TypeScript and pass without live server/DB.
6. Output: ONE fenced typescript code block containing the COMPLETE test file and NOTHING else.

Wait, how to test an Express Router without a live server? Typically, we can use `supertest` with the router, or we can invoke the route handlers directly. But the instructions say "pass without a live server". Supertest doesn't strictly need a live server (it binds to the app directly), but it might be considered a network dependency? Actually supertest works without network. However, the instructions say "Mock external dependencies (db, network, other services, fs) with jest.mock()". Express Router itself is not external? It's a framework. But to test the router, we need to either:
- Use supertest (which is a common testing utility for HTTP, not exactly an external service dependency like db/network).
- Or extract the route handlers and test them directly.

But the exported API is the router itself. The best way is to mount it in a mini Express app and use supertest, or use `supertest` directly on the router. However, supertest requires the `http` module but doesn't actually open a network port if used with `.get()` etc. (it uses superagent). Wait, actually supertest does create a server internally but doesn't necessarily need a live external server. The prompt says "pass without a live server or DB". Using supertest is standard.

But is supertest available? The prompt doesn't mention it. I should probably avoid introducing new dependencies if not mentioned. However, testing Express routers without supertest is tricky but possible by invoking the handlers directly.

Alternative: Since the exported API is `sessionsRouter` (Router), we can test it by creating a mock request and response and calling the route handlers. But the handlers are anonymous functions attached to the router. Express Router stores them in a stack. We can access `sessionsRouter.stack` to get the route layers, then extract the handle functions. But that's brittle and relies on internal Express structure.

Better approach: Use `supertest`. The prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock()". It doesn't say we cannot use supertest. But to be safe and self-contained, maybe I should create a small express app in the test, import the router, and use supertest. But if supertest is not installed, the test won't compile. The prompt doesn't guarantee supertest is available.

Another approach: Test the router by directly invoking the registered handlers. Since the handlers are closures inside the module, we can't easily export them. But we can spy on `Router()` methods? No, the module creates the router and attaches handlers. We can test the router by treating it as middleware: create a mock app or use `router.handle(req, res, next)`? Express router has an internal `handle` method, but it's not public API.

Actually, the most robust way without supertest is to create an Express app in the test file, mount the router, and then use the app with `supertest`. But again, supertest availability.

Wait, the prompt says "The test file MUST compile under strict TypeScript and pass without a live server or DB." It doesn't say "without additional test dependencies". But usually in these prompts, we should assume standard Jest + ts-jest. Supertest is common but not guaranteed. However, the user didn't mention it. Let's think if we can test it purely with Jest by mocking Express itself.

If we mock `express`, we can capture the route handlers as they are registered. For example:

```typescript
jest.mock('express', () => ({
  Router: jest.fn(() => ({
    get: jest.fn(),
    delete: jest.fn(),
  })),
}));
```

Then after importing the module, we can inspect the mock router's `get` and `delete` calls to get the handler functions. Then we can call those handler functions directly with mock `req`, `res`, and `next`. This is a very common pattern for unit testing Express routers without integration testing.

Let's verify if this satisfies all rules:
1. Import exactly as required.
2. Only test public exported API: The exported API is `sessionsRouter`. We can assert that it's the mock router returned by `Router()`. But more importantly, we test the behavior of the handlers that were registered on it. Since the handlers are the actual public behavior exposed via HTTP, testing them by extracting from the mock router is acceptable and doesn't invent methods.
3. Mock external dependencies: We mock `express`, `sessionRegistry`, `adminAuditLog`. We also need to mock `../../../utils/jwt` for `AuthRequest` type? Actually `AuthRequest` is just a type import, so it disappears at runtime. But if the module imports it, we might need to mock the module if it has runtime values? Looking at the source: `import { AuthRequest } from '../../../utils/jwt';` - this is a type-only import (TypeScript interface/type). At runtime it's erased. So no need to mock unless `jwt` module has side effects. But to be safe, we can mock it. However, `AuthRequest` is used as a type annotation on `req`, so it's purely compile-time. No runtime import. So we don't need to mock `jwt` for that. But the module doesn't import anything else from jwt. So fine.

Wait, the source imports `logAdminAction` from `../../../utils/adminAuditLog`. We need to mock that.

Also imports `* as sessionRegistry` from `../../../services/sessionRegistry`. We need to mock that.

We need to mock `express` to capture handlers.

Let's design the mock for `express`:

```typescript
jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});
```

But we need to import `Router` from express in the source. The source does `import { Router, Response } from 'express';`. So `express` module exports `Router` and `Response`. `Response` is also a type (mostly), but used as a type annotation. At runtime, `Response` might be undefined or a function. But since it's only used as a type, it's erased. However, the import statement itself will be converted by TypeScript. Since `isolatedModules` or `ts-jest` might handle it, but `Response` is likely a type-only import that gets erased. But to be safe, we can include `Response` in the mock or just let it be undefined. Actually, in ts-jest, type-only imports are erased. But `import { Router, Response }` is not explicitly marked `type`, so if `preserveValueImports` and `isolatedModules` are on, TypeScript might keep it if it thinks it's a value. But `Response` is an interface in express. In TypeScript with `esModuleInterop`, importing an interface from a module that doesn't export a value named `Response` at runtime could cause issues if not erased. However, ts-jest usually handles this because TypeScript strips type-only imports even without `type` keyword if it can determine they are types. But to be absolutely safe, we can provide a mock `Response` object (e.g., a jest.fn()).

Actually, looking at the source, `Response` is used only as a type annotation: `(req: AuthRequest, res: Response) =>`. So it's purely a type. TypeScript will erase it. So we don't need to mock `Response` as a value. But the import statement will be compiled away. So no issue.

Now, the test structure:

```typescript
import sessionsRouter from '../src/routes/api/admin/sessions';
import * as sessionRegistry from '../src/services/sessionRegistry';
import { logAdminAction } from '../src/utils/adminAuditLog';
import { Router } from 'express';
```

Wait, we need to mock `express` before importing the module. In Jest, `jest.mock` is hoisted, so if we write `jest.mock('express', ...)` in the test file, it will be hoisted above the imports. However, the import of `sessionsRouter` will use the mocked `express`. But if we also import `Router` from express in the test file, it will also be mocked. That's fine.

But we also need to mock the other modules. `jest.mock` for `../src/services/sessionRegistry` and `../src/utils/adminAuditLog`. Since the test file is at `innomcp-node/tests/`, the relative path to `src/services/sessionRegistry` from `tests/` would be `../src/services/sessionRegistry`. Wait, the import in the source is `../../../services/sessionRegistry` because the source is at `src/routes/api/admin/sessions.ts`. From `tests/`, the import of the module under test is `../src/routes/api/admin/sessions`. So for mocking dependencies, we need to use the same relative paths as the test file? No, `jest.mock` paths are relative to the test file. So to mock `../../../services/sessionRegistry` as imported by the source, we need to figure out what that resolves to from the test file.

Let's map:
- Source file: `src/routes/api/admin/sessions.ts`
- Source imports: `../../../services/sessionRegistry` -> `src/services/sessionRegistry`
- Test file: `tests/something.test.ts` (or `tests/admin/sessions.test.ts`? The prompt says tests live in `innomcp-node/tests/`. So test file is inside `tests/`.
- From `tests/`, `../src/services/sessionRegistry` points to `src/services/sessionRegistry`.

So in the test file, we should mock `../src/services/sessionRegistry` and `../src/utils/adminAuditLog`.

Wait, but the source imports `../../../utils/adminAuditLog`. That resolves to `src/utils/adminAuditLog`. So from `tests/`, it's `../src/utils/adminAuditLog`.

So:

```typescript
jest.mock('../src/services/sessionRegistry', () => ({
  listAll: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
}));

jest.mock('../src/utils/adminAuditLog', () => ({
  logAdminAction: jest.fn(),
}));
```

But we need to be careful: `jest.mock` is hoisted, but the factory function can reference variables from the outer scope only if they are also hoisted or globally available. It's safer to define the mocks inside the factory or use `jest.spyOn` after import. However, with `jest.mock`, the module is replaced. If we want to manipulate the mock functions in tests, we can import the mocked module after the jest.mock declarations.

Example:

```typescript
jest.mock('../src/services/sessionRegistry', () => ({
  listAll: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
}));

jest.mock('../src/utils/adminAuditLog', () => ({
  logAdminAction: jest.fn(),
}));

jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});
```

Then import:

```typescript
import sessionsRouter from '../src/routes/api/admin/sessions';
import { listAll, revoke, revokeAllForUser } from '../src/services/sessionRegistry';
import { logAdminAction } from '../src/utils/adminAuditLog';
```

Wait, the source imports `* as sessionRegistry`, so it gets an object with those functions. If we mock the module to export those functions, then `import * as sessionRegistry` will get the mock object. But in the test, if we import named exports, we need to ensure the mock module exports them as named exports. The factory above returns an object with `listAll`, etc. That works for `import * as sessionRegistry` because the module's exports are those properties. But for `import { listAll }`, it also works if they are named exports. However, in ES modules, `import * as ns` imports the module namespace object, which for CommonJS mocks might be the entire module.exports. With ts-jest and esModuleInterop, this can be tricky.

Alternative: Use `jest.spyOn` on the actual imported module after mocking. But if we use `jest.mock` with a factory, the imported module is the mock. Let's keep it simple: import the mocked modules and cast to jest.Mock.

```typescript
import * as sessionRegistry from '../src/services/sessionRegistry';
import { logAdminAction } from '../src/utils/adminAuditLog';
```

Then in tests:
`(sessionRegistry.listAll as jest.Mock).mockReturnValue(...)` etc.

But we need to make sure the mock factory sets them up as jest.fn().

Actually, if we use `jest.mock` without a factory, and then `jest.spyOn` on the imported module, it might try to call the real implementation. Since we don't want that, using a factory that returns `jest.fn()` is better.

However, there's a subtlety: the source does `import * as sessionRegistry`. If the mock factory returns `{ listAll: jest.fn(), revoke: jest.fn(), revokeAllForUser: jest.fn() }`, then `sessionRegistry.listAll` will be the mock. Good.

Now, for `express` mock. We need to capture the router instance so we can inspect the handlers. The `Router` mock should return the same object each time? The module calls `Router()` once. So we can have:

```typescript
const mockRouter = {
  get: jest.fn(),
  delete: jest.fn(),
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}));
```

But `mockRouter` is defined outside the factory. Jest hoists `jest.mock`, but the factory function is executed later. However, if the factory references `mockRouter` which is defined in the top-level of the module, it might be okay because the variable is in scope, but due to hoisting, the variable declaration might not be initialized when the factory runs? Actually, `jest.mock` hoists the entire call, but the factory function is executed when the module is imported, which happens after the test file's top-level code has run (since imports are hoisted too, but execution order is tricky). To be safe, it's better to define the mock state inside the factory or use a variable that is initialized before any import of the mocked module. But since `jest.mock` is hoisted above imports, the factory might run before `mockRouter` is initialized if `mockRouter` is defined below the `jest.mock` call. Wait, `jest.mock` is hoisted to the top, but the factory function is not executed immediately at hoisting time; it's registered and executed when the module is required. The module is required when the test file imports it (or when the source imports it). Since the test file's imports are also hoisted, they run after the jest.mock registration but before the test file's top-level statements? Actually, in Jest, the test file is transformed and executed. `jest.mock` calls are hoisted to the top of the file. Then the imports are executed. When the import for `../src/routes/api/admin/sessions` is encountered, it loads that module, which in turn imports `express`. At that point, the mock factory for `express` is executed. If the factory references a variable `mockRouter` defined later in the file, it might be `undefined` at that point because the variable declaration hasn't been executed yet (only hoisted declarations, not initializations). So we should avoid referencing outer-scope variables in the factory.

Instead, we can do:

```typescript
jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});
```

But then we lose the reference to `mockRouter` in our tests. However, we can get it via `Router.mock.results` or by importing `Router` from express and calling it? But `Router` is mocked, so calling it returns the mock router. But the module under test already called it. We can do:

```typescript
import { Router } from 'express';
const mockRouter = (Router as jest.Mock).mock.results[0].value;
```

But `Router` might have been called multiple times? In our module, it's called once. So `mock.results[0].value` should be the mock router. However, `mock.results` is available on jest mocks. This is a bit indirect but works.

Alternatively, we can avoid mocking `express` entirely and instead test the router using a real Express app with `supertest`. But we don't know if supertest is installed. Let's reconsider.

If we use a real Express app, we don't need to mock `express`. We just import `express` for real, create an app, mount `sessionsRouter`, and then use `supertest` or manually call `app.handle(req, res)`? Actually, we can use `app` as middleware and call `app(req, res)`? No, Express app is a function. We can create mock req/res and call `app(mockReq, mockRes, mockNext)`. But that requires a real Express app, which means we need `express` as a real dependency. That's fine because it's a project dependency. The prompt says "Mock external dependencies (db, network, other services, fs)". Express is not external in the sense of "other services"? It's a framework. But the prompt might consider it acceptable to use real Express. However, using real Express means we're doing integration-style testing. But the prompt says "unit test". Unit tests should isolate the module. Mocking Express is more unit-test-like.

But there's a problem: if we mock `express`, the `sessionsRouter` export is the mock router object. The test can verify that `get` and `delete` were called with the correct paths and that the handlers behave correctly. We can extract the handler from the mock call:

```typescript
const getHandler = (Router as jest.Mock).mock.results[0].value.get.mock.calls[0][1];
```

Wait, `sessionsRouter.get` was called with `'/'` and the handler. So:

```typescript
const [getPath, getHandler] = mockRouter.get.mock.calls[0];
```

Similarly for delete.

Then we can call `getHandler(req, res)` directly.

This is a very clean unit test approach. Let's verify the paths:

- `sessionsRouter.get('/', ...)` -> `mockRouter.get` called with `'/'`, handler.
- `sessionsRouter.delete('/:jti', ...)` -> `mockRouter.delete` called with `'/:jti'`, handler.
- `sessionsRouter.delete('/user/:userId', ...)` -> `mockRouter.delete` called with `'/user/:userId'`, handler.

But note: Express routers process routes in order. The `delete('/user/:userId')` is registered before `delete('/:jti')` in the source. So `mockRouter.delete` will be called twice. The first call is `/user/:userId`, the second is `/:jti`.

So we can get handlers:

```typescript
const [, listHandler] = mockRouter.get.mock.calls.find(call => call[0] === '/') as [string, Function];
const [, revokeUserHandler] = mockRouter.delete.mock.calls.find(call => call[0] === '/user/:userId') as [string, Function];
const [, revokeJtiHandler] = mockRouter.delete.mock.calls.find(call => call[0] === '/:jti') as [string, Function];
```

Then we create mock req/res objects.

Mock `req`: needs `params` (for jti and userId), `user` (for admin user info).
Mock `res`: needs `json()`, `status()` methods that return `res` for chaining.

We need to handle async handlers. Since they are route handlers, they might not call `next`. We can just await the handler call.

Let's draft the test file.

```typescript
import sessionsRouter from '../src/routes/api/admin/sessions';
import * as sessionRegistry from '../src/services/sessionRegistry';
import { logAdminAction } from '../src/utils/adminAuditLog';
import { Router } from 'express';

jest.mock('../src/services/sessionRegistry', () => ({
  listAll: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
}));

jest.mock('../src/utils/adminAuditLog', () => ({
  logAdminAction: jest.fn(),
}));

jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});

describe('sessions router', () => {
  let mockRouter: { get: jest.Mock; delete: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRouter = (Router as jest.Mock).mock.results[0]?.value ?? {
      get: jest.fn(),
      delete: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper to create mock res
  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('should export the router', () => {
    expect(sessionsRouter).toBeDefined();
    expect(Router).toHaveBeenCalled();
  });

  describe('GET /', () => {
    let handler: Function;

    beforeEach(() => {
      const call = mockRouter.get.mock.calls.find((c: any[]) => c[0] === '/');
      handler = call ? call[1] : undefined;
    });

    test('lists all sessions successfully', () => {
      const sessions = [{ jti: 'abc', userId: 1, email: 'a@b.com' }];
      (sessionRegistry.listAll as jest.Mock).mockReturnValue(sessions);

      const req: any = {};
      const res = mockResponse();

      handler(req, res);

      expect(sessionRegistry.listAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: sessions,
      });
    });

    test('handles error from listAll', () => {
      const error = new Error('db fail');
      (sessionRegistry.listAll as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const req: any = {};
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to list sessions',
      });
    });
  });

  describe('DELETE /:jti', () => {
    let handler: Function;

    beforeEach(() => {
      const call = mockRouter.delete.mock.calls.find((c: any[]) => c[0] === '/:jti');
      handler = call ? call[1] : undefined;
    });

    test('returns 400 if jti is missing or invalid', () => {
      const req: any = { params: {} };
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid jti parameter',
      });
    });

    test('returns 404 if session not found', () => {
      (sessionRegistry.listAll as jest.Mock).mockReturnValue([]);

      const req: any = { params: { jti: 'missing' }, user: { userId: 1 } };
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found or already revoked',
      });
    });

    test('returns 400 if admin tries to revoke own session', () => {
      const target = { jti: 'self', userId: 1, email: 'admin@test.com' };
      (sessionRegistry.listAll as jest.Mock).mockReturnValue([target]);

      const req: any = { params: { jti: 'self' }, user: { userId: 1 } };
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot revoke your own session via admin endpoint. Use /api/auth/logout instead.',
      });
      expect(sessionRegistry.revoke).not.toHaveBeenCalled();
    });

    test('revokes session and logs action for other user', async () => {
      const target = { jti: 'abc', userId: 2, email: 'user@test.com' };
      (sessionRegistry.listAll as jest.Mock).mockReturnValue([target]);
      (sessionRegistry.revoke as jest.Mock).mockReturnValue(true);

      const req: any = { params: { jti: 'abc' }, user: { userId: 1 } };
      const res = mockResponse();

      await handler(req, res);

      expect(sessionRegistry.revoke).toHaveBeenCalledWith('abc');
      expect(logAdminAction).toHaveBeenCalledWith({
        adminUserId: 1,
        action: 'session_revoke',
        targetUserId: 2,
        meta: { jti: 'abc', email: 'user@test.com' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Session abc revoked',
        data: { jti: 'abc', userId: 2, email: 'user@test.com' },
      });
    });

    test('handles errors during revoke', async () => {
      const error = new Error('fail');
      (sessionRegistry.listAll as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const req: any = { params: { jti: 'abc' }, user: { userId: 1 } };
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke session',
      });
    });
  });

  describe('DELETE /user/:userId', () => {
    let handler: Function;

    beforeEach(() => {
      const call = mockRouter.delete.mock.calls.find((c: any[]) => c[0] === '/user/:userId');
      handler = call ? call[1] : undefined;
    });

    test('returns 400 for invalid userId', () => {
      const req: any = { params: { userId: 'not-a-number' }, user: { userId: 1 } };
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid userId parameter',
      });
    });

    test('returns 400 if admin tries to revoke own sessions', () => {
      const req: any = { params: { userId: '1' }, user: { userId: 1 } };
      const res = mockResponse();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot revoke all your own sessions via admin endpoint. Use /api/auth/logout instead.',
      });
      expect(sessionRegistry.revokeAllForUser).not.toHaveBeenCalled();
    });

    test('revokes all sessions for user and logs action', async () => {
      (sessionRegistry.revokeAllForUser as jest.Mock).mockReturnValue(3);

      const req: any = { params: { userId: '2' }, user: { userId: 1 } };
      const res = mockResponse();

      await handler(req, res);

      expect(sessionRegistry.revokeAllForUser).toHaveBeenCalledWith(2);
      expect(logAdminAction).toHaveBeenCalledWith({
        adminUserId: 1,
        action: 'session_revoke_all_for_user',
        targetUserId: 2,
        meta: { sessionsRevoked: 3 },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Revoked 3 session(s) for user 2',
        data: { userId: 2, sessionsRevoked: 3 },
      });
    });

    test('handles errors during bulk revoke', async () => {
      const error = new Error('fail');
      (sessionRegistry.revokeAllForUser as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const req: any = { params: { userId: '2' }, user: { userId: 1 } };
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to revoke user sessions',
      });
    });
  });
});
```

Wait, there are some issues.

1. `mockRouter` retrieval: `(Router as jest.Mock).mock.results[0]?.value`. If `Router` was called before in another test or module, `mock.results` might have previous values. But since we `clearAllMocks` in beforeEach, `mock.results` is cleared? Actually `clearAllMocks` clears call counts but not `mock.results`? Wait, `jest.clearAllMocks()` clears mock call counts, instances, contexts, and results. Yes, it clears results. So in beforeEach, after `clearAllMocks`, `mock.results` is empty. But then how do we get the router? The module under test was imported at the top, which triggered `Router()` call during module evaluation. That happened before `beforeEach`. So `mock.results` for `Router` will have that result from the import. But `clearAllMocks` in `beforeEach` will clear it! That's a problem. We need to capture the mock router once at module load time, not in beforeEach.

So we should do:

```typescript
const mockRouter = (Router as jest.Mock).mock.results[0].value;
```

Right after imports, before any `clearAllMocks`. But `jest.clearAllMocks()` in `beforeEach` will clear the `get` and `delete` mocks on `mockRouter`, but not the `mockRouter` reference itself. That's fine. We just need to capture the reference to the router object once.

But wait, `Router` is imported from the mocked `express`. When the test file is loaded, the imports are executed. The `jest.mock` for express is hoisted, so when `import { Router } from 'express'` is executed, it gets the mock. Then `import sessionsRouter from '../src/routes/api/admin/sessions'` is executed, which loads the source, which calls `Router()`, which adds a result to `(Router as jest.Mock).mock.results`. So after all imports, we can safely read `(Router as jest.Mock).mock.results[0].value`.

However, if we call `jest.clearAllMocks()` in `beforeEach`, it will reset the `get` and `delete` mocks on `mockRouter`, which is what we want. It will also clear `Router`'s mock results, but we already captured the reference.

So:

```typescript
import { Router } from 'express';
// ... other imports

const mockRouter = (Router as jest.Mock).mock.results[0].value as {
  get: jest.Mock;
  delete: jest.Mock;
};
```

But we need to be careful: if `Router` mock is defined as `jest.fn(() => mockRouter)`, then calling `Router()` returns `mockRouter`. The `mock.results` will contain `{ type: 'return', value: mockRouter }`. So this works.

However, there is a subtle TypeScript issue: `(Router as jest.Mock).mock` might not be recognized by TypeScript if `Router` is typed as the real Express Router constructor. But since we mocked it, the type from `express` might still be there. We can cast to `jest.MockedFunction<typeof Router>` or just `any`. But to satisfy strict TypeScript, we might need to be careful.

Actually, `import { Router } from 'express'` will get the mocked export. The type is still the original `typeof Router` from express. Casting to `jest.Mock` is acceptable in tests.

Let's write:

```typescript
const mockRouter = (Router as unknown as jest.Mock).mock.results[0].value as {
  get: jest.Mock;
  delete: jest.Mock;
};
```

Or we can avoid importing `Router` altogether and just get the router from the module export? The module exports `sessionsRouter`, which is the mock router. So we can just use `sessionsRouter` directly! Because `sessionsRouter` is the object returned by `Router()`. Wait, is it? Yes, the source does `const sessionsRouter = Router();` and exports it. So `sessionsRouter` IS the mock router object. That's much simpler!

So we don't need to import `Router` at all. We can just use `sessionsRouter` as the mock router. But we need to type it properly for TypeScript. The imported type is `Router` from express. We can cast it in tests:

```typescript
const mockRouter = sessionsRouter as unknown as { get: jest.Mock; delete: jest.Mock };
```

But we need to be careful: the source exports it as `Router`. TypeScript sees it as `Router`. We can cast to `any` or a custom interface. Since it's a test file, casting is fine.

Let's verify: `sessionsRouter.get` is a jest mock. `sessionsRouter.delete` is a jest mock. So we can do:

```typescript
import sessionsRouter from '../src/routes/api/admin/sessions';
// ...
const mockGet = (sessionsRouter as any).get as jest.Mock;
const mockDelete = (sessionsRouter as any).delete as jest.Mock;
```

This is simpler and avoids the `Router` import issue.

But wait: the prompt says "Import the module under test EXACTLY as: import ... from '../src/routes/api/admin/sessions';". It doesn't say we can't import other things. So we can import `sessionsRouter` and use it.

Let's refine the test file using this approach.

One more thing: `logAdminAction` is async. In the source, it's awaited. Our mock should return a resolved promise by default. `jest.fn()` returns `undefined` by default, which is fine for `await` (it resolves immediately). But if we want to test error cases where `logAdminAction` throws, we might need to mock it. However, the source catches errors at the top level of the route handler, so if `logAdminAction` throws, it would be caught by the catch block. But the catch block logs and returns 500. We might want to test that. But the prompt says "Only test the PUBLIC exported API actually present in the source below. Do not invent methods." The public API is the router. Testing error handling is part of it.

But there is a potential issue: in the `DELETE /:jti` handler, after `sessionRegistry.revoke(jti)`, it checks `if (revoked && req.user)` and then `await logAdminAction(...)`. If `logAdminAction` throws, the catch block catches it and returns 500. We could test that. But it's not strictly necessary. The main paths are enough.

However, we need to ensure TypeScript strictness. The mock `req` and `res` objects need to be typed sufficiently to pass strict checks when passed to the handlers. Since the handlers are extracted from `jest.Mock` calls, their types are `any`, so we can pass `any` typed req/res. That's fine.

Let's write the complete test file.

Wait, one more check: The source uses `req.user` which comes from `AuthRequest`. The `AuthRequest` type likely extends `Request` and adds `user`. Our mock req should have `user` property.

Also, `req.params` is used. For `/:jti`, `req.params.jti`. For `/user/:userId`, `req.params.userId`.

In the `GET /` handler, `req` is not used except implicitly.

Now, about fake timers: The prompt says "Use fake timers for any time/interval logic." There is no time/interval logic in the source. But we should still set up `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `
