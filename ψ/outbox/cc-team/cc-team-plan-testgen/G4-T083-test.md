<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: T083 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2474,"completion_tokens":8000,"total_tokens":10474,"prompt_tokens_details":{"cached_tokens":72,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 102s
 generated: 2026-06-13T11:10:07.435Z -->
The user wants a Jest unit test file for the workspace router module in innomcp-node.

Key requirements:
1. Import exactly as: `import ... from '../src/routes/api/workspace';`
2. Only test the public exported API actually present in the source. The source exports `router` as default (implied by `const router = Router();` and then presumably exported at the end, though the snippet is truncated. But typically Express routers are exported as default or named export. Looking at the source, it doesn't show the export statement because it's truncated, but the instruction says to import from that path. I should import the router and test it as an Express router.
3. Mock external dependencies: express, multer, jsonwebtoken, workspaceService, path. Actually, since we're testing the router, we need to import it. But the router is created at module load time. We need to mock the dependencies before importing.
4. Use fake timers for any time/interval logic. There doesn't seem to be any time logic in the source, but I should include `jest.useFakeTimers()` in beforeEach to be safe? Actually the exemplar shows fake timers. But the source has no timers. I can still set it up or skip if not needed. The rule says "Use fake timers for any time/interval logic." Since there is none, maybe not strictly necessary, but it's safe to include if there are async operations. However, fake timers can interfere with async/await if not advanced. Since the code uses async/await with workspaceService promises, using fake timers might require `jest.advanceTimersByTimeAsync` or `runAllTimersAsync`. Actually, modern fake timers with `legacyFakeTimers: false` might not interfere with promises, but it's safer to not use fake timers unless needed. The rule says "Use fake timers for any time/interval logic." There is none. So I won't use them to avoid breaking async tests. Wait, the exemplar uses them but that's for CacheManager which presumably has TTL logic. Here there is no timer logic. I'll skip fake timers to keep async tests working, unless I use `jest.useFakeTimers({ doNotFake: [...] })`? No, better to just not use them since there are no timers. But the user said "Use fake timers for any time/interval logic." Since there is none, it's fine not to use them.
5. Must compile under strict TypeScript and pass without live server/DB.
6. Output: ONE fenced typescript code block, complete test file, nothing else.

The source exports a router. To test an Express router without a live server, we can use `supertest` or manually invoke the route handlers. However, supertest requires an app instance. Since we only have a router, we can mount it on a temporary Express app in the test, or we can extract the route handlers. But the instruction says "Only test the PUBLIC exported API actually present in the source below." The public exported API is the `router` object. We can test it by mounting it on an Express app and using supertest, or by directly calling the route handlers if we can access them. But the handlers are anonymous functions passed to `router.get/post/delete`. They are not exported individually. So the best way is to create an Express app in the test, mount the router, and use supertest (or manually invoke). However, supertest is an external dependency. The user didn't mention it, but it's common. Alternatively, we can mock Express's Router to capture the registered handlers and test them directly. That might be cleaner and doesn't require supertest.

Let's think about mocking strategy:

We need to mock:
- `express` (to capture router methods)
- `multer` (to avoid actual file upload middleware)
- `jsonwebtoken` (to control JWT verification)
- `../../services/workspaceService` (to mock DB/service calls)
- `path` (maybe not necessary if we rely on its actual behavior, but path.normalize/isAbsolute are deterministic and don't touch FS. The rule says mock external dependencies (db, network, other services, fs). `path` is a core module but doesn't touch FS for normalize/isAbsolute? Actually `path.isAbsolute` doesn't touch FS. But to be safe and deterministic, we could mock it. However, mocking `path` might be tricky because the module uses it at load time. If we mock path before importing, we can control `normalize` and `isAbsolute`. But the logic is simple enough that real path module is fine and deterministic offline. The rule says "Mock external dependencies (db, network, other services, fs)". `path` is not fs/db/network. I'll leave it unmocked or mock it if needed. Actually, `path.normalize` behavior is platform-dependent (Windows vs POSIX). In Jest testEnvironment "node", it will use the platform's path implementation. To make tests deterministic across platforms, it's safer to mock `path`. But the test file must compile under strict TS. Mocking `path` is doable.

Wait, the import path is `import ... from '../src/routes/api/workspace';`. The test lives in `innomcp-node/tests/`. So the relative path `../src/routes/api/workspace` is correct.

The source file uses `import { Router, Request, Response } from 'express';`. So the exported thing is likely `router` (maybe default export or named export). Since the snippet is truncated at the bottom, I need to infer the export. Usually it's `export default router;` or `export { router };` or `module.exports = router;`. Given it's TypeScript with ES modules style imports, likely `export default router;` or `export { router };`. The instruction says "Import the module under test EXACTLY as: import ... from '../src/routes/api/workspace';". So I need to use that syntax. I'll import `router` as default: `import router from '../src/routes/api/workspace';`. Or maybe `import workspaceRouter from '../src/routes/api/workspace';`. The exact syntax in the instruction uses `...` so I can fill in the name. I'll use `import workspaceRouter from '../src/routes/api/workspace';`.

To test the router without supertest, I can mock `express` to return a router that records routes, and then call the registered handlers directly with mocked `req` and `res` objects. This is a common pattern for unit testing Express routers.

Mocking express:
```typescript
jest.mock('express', () => {
  const actual = jest.requireActual('express');
  return {
    ...actual,
    Router: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    })),
  };
});
```

But wait, if I mock `express` entirely, the module under test imports `Router` from it. If `Router` returns a mock object, then `router.get('/files', async (req, res) => {...})` will call `mockRouter.get` with the path and handler. I can capture the handler and test it.

However, the module also imports `Request` and `Response` types. If I mock express, I need to make sure `Request` and `Response` are still available as types (or values if used). In the source, they are used only as type annotations, which are erased at runtime. So no issue.

But `multer` is used at module load time: `const upload = multer({...})`. If I mock multer, I need to return a function that returns an object with the expected properties (like `single` or whatever, though the source doesn't use `upload` in the shown routes; it's truncated but likely used later. Actually the source shows `upload` is defined but not used in the shown routes. The truncation is at the bottom. I should mock multer anyway.

Mocking `jsonwebtoken`: `jwt.verify` is used in `getSessionId`. I need to mock it.

Mocking `workspaceService`: The module imports it. I need to mock the methods: `listFiles`, `writeFile`, `deleteFile`, `getStats`.

Mocking `multer`: It returns a function that returns a middleware object. Since the shown code doesn't use `upload` in the routes shown, but it might be used in truncated part. However, the instruction says "Only test the PUBLIC exported API actually present in the source below." The source below shows four routes: GET /files, POST /files, DELETE /files, GET /stats. It also defines `upload` but doesn't use it in these routes. I should mock multer to avoid any issues.

Let's design the test:

1. Mock dependencies before importing the module.
2. Capture the route handlers from the mock router.
3. For each route, create mock Request and Response objects.
4. Invoke the handler with `await handler(req, res, next)` because they are async.
5. Assert on `res.json`, `res.status`, etc.

Wait, the handlers are async functions. When calling them directly, we need to await them.

Mock Request/Response:
```typescript
const mockRes = () => {
  const res: any = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res as Response;
};
```

But TypeScript strict mode will complain if we just cast `as Response` because Response has many required properties. We can cast `as unknown as Response` or use a partial type. Better to define a helper that returns a mocked Response with the methods we need, typed properly.

Actually, since the source uses `res.json(...)` and `res.status(...).json(...)`, we need:
- `res.json` returns `res` (for chaining, though in the source `sendError` does `res.status(...).json(...)` and `sendSuccess` does `res.json(...)`).
- `res.status` returns `res`.

So:
```typescript
function createMockRes(): Response {
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}
```

Similarly for Request:
```typescript
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    query: {},
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}
```

But we need to be careful: the handlers access `req.query.sessionId`, `req.headers.authorization`, `req.body.path`, etc.

Now, the tricky part: mocking `express` such that the router instance captures the handlers.

```typescript
jest.mock('express', () => {
  return {
    Router: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      use: jest.fn(),
    })),
  };
});
```

But the module also imports `Request` and `Response` as named exports. If we mock express like this, those won't exist. However, since they are only used as types, at runtime they are not accessed. But TypeScript compilation might complain if the mock doesn't export them? Actually, `jest.mock` is processed by Jest before TypeScript? No, ts-jest compiles the test file. The `jest.mock` call is in the test file. TypeScript sees `jest.mock('express', () => { ... })`. The return object doesn't need to have `Request` and `Response` because the test file doesn't import them from express (only the source does, but the source is compiled separately; its types are checked at compile time of the source, not the test). Wait, the test file imports the source module. When TypeScript compiles the test file, it also type-checks the imported module. The imported module's types depend on express. But since express is installed and has types, it should be fine. The mock doesn't affect compile-time types.

However, if we mock `express` entirely, the source module at runtime will get our mock. The source does `import { Router, Request, Response } from 'express';`. At runtime, `Request` and `Response` will be undefined from our mock, but they are only used as type annotations, so they are erased and not used at runtime. Good.

But `Router` must be a function that returns an object with `get`, `post`, `delete`. The source calls `Router()` and then uses the returned object.

So we can do:

```typescript
const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}));
```

But `mockRouter` is defined before `jest.mock`. That's okay because `jest.mock` hoisting will move it, but referencing `mockRouter` from the factory might be tricky due to hoisting. Better to define the mock inside the factory or use `jest.doMock`. Actually, `jest.mock` is hoisted, so variables defined outside might not be accessible if they are also hoisted? No, `const mockRouter` is not hoisted. The factory function is hoisted along with `jest.mock`, but the factory references `mockRouter` which is defined later in the file. This can be problematic. To avoid this, we can use a variable that we assign after, or use `jest.doMock` (not hoisted). But `jest.doMock` must be called before the import.

Alternative: Use a manual mock by setting up the mock inside the factory without external references, and then after import, access the calls.

```typescript
jest.mock('express', () => {
  const router = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => router),
    __router: router, // export it so we can access? No, express doesn't have __router.
  };
});
```

But we can't easily get the `router` instance because it's created inside the module under test when it calls `Router()`. However, we can spy on `Router` and get the return value from the mock function.

```typescript
import { Router } from 'express';
jest.mock('express', () => ({
  Router: jest.fn(),
}));
const mockedRouter = Router as jest.Mock;
// After importing workspace module, Router() was called.
const routerInstance = mockedRouter.mock.results[0].value;
```

But we need to set up the mock return value. We can do:

```typescript
jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});
```

Then after importing the workspace module, `Router` was called once. We can get the returned mock router by looking at `mockedRouter.mock.results`. But `mockedRouter` is the `Router` export from the mock. Since `jest.mock` hoists, we can do:

```typescript
import { Router } from 'express';
jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});
```

Wait, if we import `Router` from express, and express is mocked, then `Router` is the mock function. Then after `import workspaceRouter from '../src/routes/api/workspace';`, the module under test is loaded, which calls `Router()` and gets the mockRouter. But how do we access that mockRouter in the test? We can access `Router.mock.results[0].value` if we set it up as a spy that returns a value. Actually, `jest.fn(() => mockRouter)` will record the return value in `mock.results`. So:

```typescript
const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}));
```

But again, `mockRouter` is defined in the test file scope. `jest.mock` is hoisted, but the factory function is executed later when the module is required. By that time, `mockRouter` is initialized. Is that safe? Yes, because `jest.mock` hoists the call, but the factory function is not executed until the module is imported. The test file's top-level code runs before the imports? Actually, in Jest, `jest.mock` is hoisted above imports. But the factory function references `mockRouter` which is defined at the top level of the test file. Since the test file's top-level code runs after imports (except hoisted mocks), there might be a temporal dead zone issue if `mockRouter` is declared with `const` after the imports. Wait, the order in the test file would be:

```typescript
import { Router } from 'express';
import workspaceRouter from '../src/routes/api/workspace';
// ... other imports

const mockRouter = { ... };
jest.mock('express', () => ({ Router: jest.fn(() => mockRouter) }));
```

But `jest.mock` is hoisted to the top, above imports. However, the factory function references `mockRouter`. When the factory runs (during the import of express), `mockRouter` has not been initialized yet because its declaration is below the imports. This is a known issue: referencing variables in a `jest.mock` factory that are defined in the module scope can fail because of hoisting. The solution is to use `jest.doMock` (which is not hoisted) and place it before the dynamic import, or to define the mock object inside the factory and then access it via the mock function's results.

Better approach: Use `jest.mock('express')` without factory, then use `mocked(Router).mockReturnValue(mockRouter)` after defining `mockRouter`. But `jest.mock('express')` will auto-mock the module, replacing `Router` with a jest.fn(). Then we can set its return value.

```typescript
import { Router } from 'express';
jest.mock('express');
const mockedRouter = jest.mocked(Router);
const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};
mockedRouter.mockReturnValue(mockRouter as any);
```

But we need to import the workspace module AFTER setting up the mock return value. If we use a static import, the workspace module will be imported and evaluated before we set `mockReturnValue`, because static imports are hoisted and evaluated first. So we need to use a dynamic import for the workspace module.

```typescript
import { Router } from 'express';
jest.mock('express');
const mockedRouter = jest.mocked(Router);
const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};
mockedRouter.mockReturnValue(mockRouter as any);

// Now import workspace dynamically
const { default: workspaceRouter } = await import('../src/routes/api/workspace');
```

But the test file needs to be synchronous? No, top-level await is allowed in TypeScript with certain module settings, but in Jest with ts-jest, it might be okay if the test file is treated as a module. However, the exemplar shows synchronous code. To be safe, we can use `jest.doMock` and a dynamic import inside a `beforeAll` or similar. But the test structure might become more complex.

Alternative: Use a static import for workspace, but mock express with a factory that doesn't rely on external variables. We can create the mock router inside the factory and attach it to the mock function so we can retrieve it later.

```typescript
jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  const Router = jest.fn(() => mockRouter);
  // Attach for retrieval
  (Router as any).__mockRouter = mockRouter;
  return { Router };
});
```

Then after import:

```typescript
import { Router } from 'express';
import workspaceRouter from '../src/routes/api/workspace';
const mockRouter = (Router as any).__mockRouter;
```

This works because the factory doesn't reference external variables. The factory creates `mockRouter` internally. We attach it to the `Router` function. Since `jest.mock` is hoisted, the factory runs during import of express (which is a dependency of workspace). By the time we execute the line `const mockRouter = (Router as any).__mockRouter;`, the factory has already run and attached the property. This is safe.

But TypeScript might complain about `__mockRouter` not being a property. We can cast to `any`.

Similarly, we need to mock `multer`, `jsonwebtoken`, and `workspaceService`.

Mocking `multer`:
```typescript
jest.mock('multer', () => {
  return jest.fn(() => ({
    single: jest.fn(),
    array: jest.fn(),
    // whatever
  }));
});
```

Mocking `jsonwebtoken`:
```typescript
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));
```

Mocking `workspaceService`:
```typescript
jest.mock('../../services/workspaceService', () => ({
  workspaceService: {
    listFiles: jest.fn(),
    writeFile: jest.fn(),
    deleteFile: jest.fn(),
    getStats: jest.fn(),
  },
}));
```

Wait, the import path in the source is `../../services/workspaceService`. In the test file, the mock path should be relative to the test file? No, `jest.mock` paths are relative to the file being mocked, but actually in Jest, `jest.mock` paths are resolved relative to the test file? Let's recall: `jest.mock` uses the same module resolution as `require`/`import`, so the path should be the same as what the source file uses, or relative to the test file? Actually, `jest.mock` is hoisted and the path is resolved from the test file's location? No, it's resolved from the module that calls it, which is the test file. But the source file imports from `../../services/workspaceService`. The test file is in `tests/`. The source file is in `src/routes/api/`. So from the test file (`tests/`), `../../services/workspaceService` would resolve to `services/workspaceService` at the project root? Wait:

Project structure:
- innomcp-node/
  - src/
    - routes/
      - api/
        - workspace.ts
    - services/
      - workspaceService.ts
  - tests/
    - workspace.test.ts (our file)

From `src/routes/api/workspace.ts`, `../../services/workspaceService` goes up to `src/`, then to `services/workspaceService`. Correct.

From `tests/workspace.test.ts`, to mock the same module, we can use `jest.mock('../../src/services/workspaceService')`? No, `jest.mock` uses the module path as seen from the test file? Actually, `jest.mock` uses the module path string exactly as you provide it, and Jest resolves it relative to the test file. So if we write `jest.mock('../../src/services/workspaceService')` from `tests/workspace.test.ts`, that goes up to `innomcp-node/`, then to `src/services/workspaceService`. That works.

But if we write `jest.mock('../../services/workspaceService')` from the test file, that goes up to `innomcp-node/` (from `tests/`), then `services/workspaceService` which doesn't exist. So we must be careful with paths.

However, there is a Jest feature: `jest.mock` can use the same path as the source file if we use a module name mapper or if the path happens to resolve from the test file. But it's safer to use the path relative to the test file.

Wait, actually, `jest.mock` resolution is based on the test file's location. So from `tests/`, to reach `src/services/workspaceService`, we need `../src/services/workspaceService` (up to innomcp-node, then src/services...). Let's check:

- `tests/` -> `../` -> `innomcp-node/` -> `src/services/workspaceService`. So `../src/services/workspaceService`.

But the source uses `../../services/workspaceService`. If we use that in the test file, it would resolve to `innomcp-node/services/workspaceService` (since `../../` from `tests/` goes to parent of innomcp-node? No:

Path resolution:
- `tests/workspace.test.ts`
- `../../services/workspaceService` from `tests/`:
  - `..` -> `innomcp-node/`
  - `..` -> parent of `innomcp-node/` (e.g., `projects/`)
  - `services/workspaceService` -> `projects/services/workspaceService`. Wrong.

So we need `jest.mock('../src/services/workspaceService')`? Wait:
- `tests/` is at `innomcp-node/tests/`.
- `../src/services/workspaceService` -> `innomcp-node/src/services/workspaceService`. Yes, that's correct.

But the source imports from `../../services/workspaceService`. Jest's module registry keys modules by their resolved absolute path. So if we mock `../src/services/workspaceService`, will it intercept the import inside `src/routes/api/workspace.ts` which uses `../../services/workspaceService`? Yes, because both resolve to the same absolute file. Jest intercepts based on the absolute path.

So we should use `jest.mock('../src/services/workspaceService')`.

Similarly, for `express`, `multer`, `jsonwebtoken`, we can use the package names directly.

Now, the workspace module also uses `path`. Should we mock it? The `isPathTraversalSafe` function uses `path.normalize` and `path.isAbsolute`. These are deterministic and don't require FS. But on Windows, `path.normalize` behaves differently than on POSIX. Since tests might run on different platforms, mocking `path` to ensure deterministic behavior is a good idea. However, the function also checks `normalized.startsWith('/')` or `startsWith('\\')`. On Windows, `path.normalize('foo/bar')` returns `foo\bar`, which doesn't start with `/` or `\` (unless absolute). `path.isAbsolute('foo/bar')` is false on Windows too? Actually on Windows, `path.isAbsolute('foo/bar')` is false. So the logic might still work. But to be strictly deterministic and offline, we can mock `path` to return POSIX-like results.

But mocking `path` might be overkill. The user said "Mock external dependencies (db, network, other services, fs)". `path` is not fs. I'll leave it unmocked.

Now, let's plan the tests.

We need to test the four routes. Since the handlers are not exported, we extract them from the mock router.

Setup:
```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { workspaceService } from '../src/services/workspaceService';
import workspaceRouter from '../src/routes/api/workspace';

jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});

jest.mock('multer', () => jest.fn(() => ({})));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../src/services/workspaceService', () => ({
  workspaceService: {
    listFiles: jest.fn(),
    writeFile: jest.fn(),
    deleteFile: jest.fn(),
    getStats: jest.fn(),
  },
}));
```

Wait, we need to be able to access `mockRouter` to get the handlers. Since `Router` is mocked, we can get the returned mock router by looking at `Router.mock.results`. But `Router` is imported from the mocked express. However, `jest.mock('express')` with a factory that returns `Router: jest.fn(() => mockRouter)`. The `Router` function is a jest mock. When the workspace module is imported, it calls `Router()`. We can then inspect `Router.mock.results`.

But `Router` is imported as a named export. In the mocked module, `Router` is the jest.fn. So:

```typescript
const mockedRouterFn = jest.mocked(Router);
// After import, the workspace module called Router() once.
const [routerInstance] = mockedRouterFn.mock.results[0].value;
```

Wait, `mock.results` contains the return values of each call. Since `Router()` was called once during module initialization, `mockedRouterFn.mock.results[0].value` is the mockRouter object.

But we need to be careful: `jest.mocked(Router)` might not work if `Router` is a function and we imported it. Actually `jest.mocked` is for modules, but we can just cast it: `const mockedRouterFn = Router as jest.Mock;`.

Then:
```typescript
const mockRouter = mockedRouterFn.mock.results[0].value as { get: jest.Mock, post: jest.Mock, delete: jest.Mock };
```

But is `mock.results` populated immediately after the static import? Yes, because the module evaluation happens during import.

However, there is a subtlety: `jest.mock` with a factory runs when the module is first required. The workspace module is imported statically. The express mock factory runs when express is required (which is when workspace is imported). So after the import statement, `Router` (the mock function) will have a result.

Let's verify the order:
1. Test file starts.
2. `jest.mock` hoisted to top.
3. `import { Router } from 'express'` -> requires express, runs factory, gets mock `Router`.
4. `import workspaceRouter from '../src/routes/api/workspace'` -> requires workspace, which requires express again (cached), gets same mock `Router`. It calls `Router()`. So `Router` mock gets a call.
5. We can then access `Router.mock.results`.

This should work.

But we also need to import `jwt` and `workspaceService` to mock their methods and assert on them.

Wait, if we mock `jsonwebtoken` with a factory that returns `{ verify: jest.fn() }`, then `import jwt from 'jsonwebtoken'` gives us that object. But the source uses `jwt.verify`. So we can cast `jwt.verify` as jest.Mock and set its return value.

Similarly, `workspaceService` is imported as a named export from the mock. We can cast its methods.

Now, writing tests for each route:

**GET /files**
- Handler is the second argument to `mockRouter.get('/files', ...)`.
- We can get it: `const getFilesHandler = mockRouter.get.mock.calls.find(call => call[0] === '/files')?.[1] as (req: Request, res: Response) => Promise<void>;`
- But TypeScript strict might complain about undefined. We can use non-null assertion or check.

Test cases for GET /files:
1. Missing sessionId -> 401 error.
   - req: `query: {}`, `headers: {}`
   - res: expect `status(401)`, `json` with error.
2. Invalid path -> 400 error.
   - req: `query: { sessionId: 'sess1', path: '../etc/passwd' }`
   - res: expect `status(400)`.
3. Success -> calls workspaceService.listFiles and returns 200.
   - req: `query: { sessionId: 'sess1', path: 'foo' }`
   - mock `workspaceService.listFiles` to resolve to `[{ name: 'a.txt' }]`
   - res: expect `json` with success true and data.

**POST /files**
- Handler from `mockRouter.post('/files', ...)`.
Test cases:
1. Missing sessionId -> 401.
2. Missing path -> 400.
3. Content undefined -> 400.
4. Invalid path -> 400.
5. Content too large -> 413. We need to create a large string. But we can mock `Buffer.byteLength`? Actually, `Buffer.byteLength` is a static method. We can rely on it. To avoid creating a huge string, we can mock `Buffer.byteLength` to return a large number. But `Buffer` is global. We can do `jest.spyOn(Buffer, 'byteLength').mockReturnValue(10 * 1024 * 1024 + 1)`. But the rule says "Use fake timers for any time/interval logic." Not relevant. Mocking Buffer is okay. Or we can just create a string of length > 10MB? That's memory heavy. Better to mock `Buffer.byteLength`.
   - However, the user said "Mock external dependencies (db, network, other services, fs)". Buffer is a core Node API, not external. But to keep tests fast, mocking is fine. Alternatively, we can pass a small string and mock `Buffer.byteLength`.
6. Success -> calls workspaceService.writeFile and returns 200.

**DELETE /files**
- Handler from `mockRouter.delete('/files', ...)`.
Test cases:
1. Missing sessionId -> 401.
2. Missing path -> 400.
3. Invalid path -> 400.
4. Success -> calls workspaceService.deleteFile and returns 200.

**GET /stats**
- Handler from `mockRouter.get('/stats', ...)`.
Test cases:
1. Missing sessionId -> 401.
2. Success -> calls workspaceService.getStats and returns 200.

**Session ID extraction via JWT**
- We should test that `getSessionId` works with JWT. But `getSessionId` is not exported. However, we can test it indirectly via the routes.
- For example, in GET /files, provide `headers: { authorization: 'Bearer validtoken' }` and mock `jwt.verify` to return `{ sessionId: 'jwt-session' }`. Then the route should proceed.

But wait, `jwt.verify` is called inside `getSessionId`. If we mock it to return `{ sessionId: 'jwt-session' }`, then the route will get that sessionId.

Let's also test path traversal safety indirectly.

Now, about `multer`: The source defines `upload` but doesn't use it in the shown routes. Since we don't test the truncated part, we don't need to worry about it. But the module initialization calls `multer({...})`. If we mock multer as `jest.fn(() => ({}))`, that will work.

Let's draft the code.

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { workspaceService } from '../src/services/workspaceService';
import workspaceRouter from '../src/routes/api/workspace';

jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return {
    Router: jest.fn(() => mockRouter),
  };
});

jest.mock('multer', () => jest.fn(() => ({})));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../src/services/workspaceService', () => ({
  workspaceService: {
    listFiles: jest.fn(),
    writeFile: jest.fn(),
    deleteFile: jest.fn(),
    getStats: jest.fn(),
  },
}));

const mockedRouterFn = Router as unknown as jest.Mock;
const mockRouter = mockedRouterFn.mock.results[0].value as {
  get: jest.Mock;
  post: jest.Mock;
  delete: jest.Mock;
};

function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    query: {},
    headers: {},
    body: {},
    ...overrides,
  };
}

function createMockRes(): any {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
}

function getHandler(method: 'get' | 'post' | 'delete', path: string) {
  const calls = mockRouter[method].mock.calls as Array<[string, Function]>;
  const found = calls.find(call => call[0] === path);
  if (!found) throw new Error(`Handler ${method} ${path} not found`);
  return found[1];
}

describe('workspace router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /files', () => {
    const handler = getHandler('get', '/files');

    test('returns 401 when sessionId is missing', async () => {
      const req = createMockReq();
      const res = createMockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'SESSION_MISSING' }));
    });

    test('returns 400 when path is traversal unsafe', async () => {
      const req = createMockReq({ query: { sessionId: 's1', path: '../secret' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'INVALID_PATH' }));
    });

    test('returns 500 when workspaceService.listFiles throws', async () => {
      const req = createMockReq({ query: { sessionId: 's1', path: 'foo' } });
      const res = createMockRes();
      (workspaceService.listFiles as jest.Mock).mockRejectedValue(new Error('disk full'));
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false,
