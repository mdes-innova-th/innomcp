<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S053 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":201,"completion_tokens":7000,"total_tokens":7201,"prompt_tokens_details":{"cached_tokens":73,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:36:02.821Z -->
The user wants a Jest contract/behavior test for a module called `dashboard` from `../src/routes/api/dashboard`.

The public API surface provided is:
1. `type AuthRequest` (a type export)
2. `async function ensureTasksProjectColumn(): Promise<void>` (a named export)
3. `export default router` (a default export)

Wait, the public API surface is quite minimal and a bit ambiguous. Let me parse it carefully.

The module is `dashboard` at `../src/routes/api/dashboard`.

Exports:
- `type AuthRequest` - likely a TypeScript type/interface
- `async function ensureTasksProjectColumn(): Promise<void>` - an async function that returns Promise<void>
- `export default router` - default export is a router (likely Express router)

The user wants a Jest test that tests the CONTRACT/BEHAVIOR based on names and signatures only. I need to infer what these things do based on their names.

`ensureTasksProjectColumn`: The name suggests it ensures that a "Tasks" project column exists somewhere (maybe in a project management tool like GitHub Projects, Notion, or a database). Since it's async and returns void, it likely performs a side effect. It might throw if it fails. Contract: when called, it should ensure the column exists. If external deps fail, it should throw.

`export default router`: This is likely an Express router. The name `dashboard` suggests it handles dashboard routes. Since I don't have the actual routes, I need to infer common dashboard routes. But wait, the user says "Test observable behavior/contracts implied by the names+signatures". For a router, I can test that it's a valid Express router (has use/get/post/etc methods) or test the routes it defines. But without knowing the routes, I need to be careful.

Actually, looking at the minimal API surface, maybe the test should focus on:
1. `ensureTasksProjectColumn` behavior: mocks external deps (db/network), tests success case, tests error case.
2. `router` default export: tests that it's a Router instance, or tests mounting behavior? But "test observable behavior/contracts implied by names+signatures". A router's contract is that it can handle requests. But without knowing specific routes, it's hard.

Wait, maybe the module is small. Let me reconsider. The user might have provided a truncated or simplified API surface. I need to write a complete test file that imports exactly `import ... from '../src/routes/api/dashboard';`.

The import must be exactly that path. The exports I need to import are `AuthRequest` (type), `ensureTasksProjectColumn`, and the default export `router`.

Since I must test contracts, let me think about what `ensureTasksProjectColumn` does:
- "Ensure" implies idempotency: if the column exists, it does nothing (or returns gracefully). If it doesn't exist, it creates it.
- "Tasks Project Column" suggests a column in a project board.
- It interacts with external services (network/db). I need to mock these.
- Contract: Resolves when column is ensured. Rejects if external service is unavailable or returns unexpected data.

For the router:
- It's a dashboard API router. Common routes might include GET / (dashboard data), POST /something, etc. But I don't know the routes. However, the contract of a router is that it's an Express middleware function or Router object. I can test that it has the standard Router methods, or test that it can be mounted in an Express app and handles requests for specific paths inferred from the module name.
- But maybe better: since it's a dashboard API, perhaps it has routes like GET /stats, GET /tasks, etc. But I shouldn't invent too much. However, the user says "test observable behavior/contracts implied by the names+signatures". The signature is `export default router`. The name is `dashboard`. So maybe the contract is that it provides routes under `/api/dashboard`. But I don't know the sub-routes.

Actually, looking at the path `../src/routes/api/dashboard`, this is likely an Express router file that defines routes for `/api/dashboard/*`. The default export is the router.

How to test a router without knowing its routes? I can test that:
1. It is a function (Express middleware) or has router methods.
2. It can be mounted.
3. Maybe infer that a dashboard router should handle GET requests and return dashboard data.

But the user says "correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions". For a router, inputs are HTTP requests. Outputs are HTTP responses.

Maybe I should test the router by mounting it and making requests using `supertest` or just invoking the router? But I don't know the exact routes.

Alternatively, perhaps the prompt expects me to focus mainly on `ensureTasksProjectColumn` and treat the router as a secondary export that I verify is an Express Router. But that feels weak.

Let me think about what a "dashboard" route typically does. It might serve dashboard configuration, widgets, or task columns. Given the presence of `ensureTasksProjectColumn`, maybe the router has a route that triggers this or related functionality.

Wait, maybe the module exports:
- `AuthRequest` type (used in the router handlers)
- `ensureTasksProjectColumn` (a utility function used by the router or externally)
- `router` (the Express router)

I should write tests for `ensureTasksProjectColumn` as a pure contract test, and for the router, I should test that it is a valid Router and perhaps test its middleware behavior if I can infer it.

But the user says "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS." So I need to use `jest.mock` or manual mocks.

Let me structure the test file:

```typescript
import { Request, Response } from 'express';
import dashboardRouter, { AuthRequest, ensureTasksProjectColumn } from '../src/routes/api/dashboard';
```

Wait, the import rule says: "Import EXACTLY: import ... from '../src/routes/api/dashboard';". This means the import statement must use that exact path. It doesn't specify the exact binding names, but I should import the named exports and default export.

Now, for `ensureTasksProjectColumn`:
- It likely interacts with a project management API or database.
- I'll mock the external client/service.
- Test 1: When the column already exists, it resolves without creating (idempotent).
- Test 2: When the column does not exist, it creates it and resolves.
- Test 3: When the external service fails, it throws/rejects.

For the router:
- Since it's a dashboard router, maybe it has a GET endpoint that returns dashboard data.
- But I don't know the paths. However, maybe I can test that the router exports an Express Router instance. But that's testing implementation (instanceof), not behavior.
- Better: mount it on an Express app and test that it handles requests. But without knowing routes, I might assume standard REST conventions. For example, a dashboard router might have a GET `/` route.
- Actually, looking at the function `ensureTasksProjectColumn`, maybe there's a POST /ensure-column or something. But that's speculation.

Wait, the prompt says "You are given ONLY its public API surface (signatures), NOT the implementation — so you must test the CONTRACT (intended behavior), not echo code." So I must infer from names. The name `dashboard` for a router in `routes/api/dashboard` strongly suggests it handles API requests for the dashboard. The function `ensureTasksProjectColumn` suggests it ensures a project column for tasks.

Maybe the router uses `ensureTasksProjectColumn` internally, or maybe they are separate. I should test them separately.

For the router, since I don't know the exact routes, I can test its contract as middleware: it should be a function that accepts `(req, res, next)` or an object with route methods. But in Express, a router is both. However, testing HTTP behavior without route paths is tricky.

Perhaps the prompt expects me to test the router by verifying it responds to specific HTTP methods on paths that are semantically implied. For example:
- `GET /` returns dashboard configuration.
- `POST /ensure-tasks-column` calls `ensureTasksProjectColumn` and returns 204.

But inventing too much might be wrong. However, the user wants a complete test file. I need to make reasonable inferences based on the name and signature.

Let me reconsider the API surface. It might be that `ensureTasksProjectColumn` is the only real function to test, and the router is just there as a default export. But the user said "Module: dashboard — public API surface" and listed all three.

Maybe `AuthRequest` is an interface extending Request with a user property. The router might use it. But I can't test a type at runtime easily in Jest unless I use `tsd` or check that objects conform. But I can test that functions accept/return the right shapes.

Actually, I can test `AuthRequest` by creating a mock request that satisfies the contract and passing it to middleware if needed. But without middleware signatures, it's hard.

Let me think about what would be a solid, defensible contract test:

1. **ensureTasksProjectColumn**:
   - Contract: After successful execution, a "Tasks" column exists in the project.
   - If the column already exists, it resolves without error (idempotent).
   - If the project service is unavailable, it rejects with an error.
   - It does not return any value (`Promise<void>`).

2. **router (default export)**:
   - Contract: It is an Express-compatible middleware/router.
   - It can be mounted at a path.
   - It handles requests (maybe I can test that it doesn't crash when mounted and a request is made, but I need a route).

Actually, maybe I should test the router's integration with `ensureTasksProjectColumn`. Perhaps the router exposes an endpoint that calls this function. For example, maybe `POST /setup` or `PUT /tasks-column`. But I don't know.

Given the strictness, maybe I should write a test that:
- Imports the module.
- Tests `ensureTasksProjectColumn` with mocked external deps (e.g., a project service client).
- Tests that `dashboardRouter` is truthy and is a function (Express router).
- Tests that `AuthRequest` can be used to type a request object (compile-time only, but at runtime I can just verify the module exports it, though types are erased).

Wait, TypeScript types are erased at runtime. I cannot test `AuthRequest` as a value in Jest. But the user listed it as part of the public API surface. Maybe I should import it as a type and use it in my test code to type mock requests, demonstrating the contract. That would satisfy "strict TS" and acknowledge the export.

So plan:
- Import `dashboardRouter`, `{ AuthRequest, ensureTasksProjectColumn }`.
- Mock external dependencies: e.g., `../src/services/projectService` or `../src/lib/db`. Since I don't know the exact deps, I should mock a plausible dependency based on the function name. But the user says "Mock external deps (db/network/fs/other services) deterministically." I need to mock whatever the module imports. But I don't know what it imports.

This is a challenge. In a true black-box contract test, I should mock the module's dependencies without knowing the implementation. But I don't know the import paths. However, I can make reasonable assumptions or mock at the network level (e.g., mock `axios` or `node-fetch`), or mock a generic database module.

But the user wants a complete test file. I need to decide on plausible dependency names. Since the module is `../src/routes/api/dashboard`, it might import from `../../services/projectClient` or similar. But I don't know.

Alternatively, I can use `jest.mock` with a generic name and assume the module imports it. But if I guess wrong, the test is invalid.

Wait, maybe the function `ensureTasksProjectColumn` is self-contained in the module and doesn't import anything? No, it likely does.

Another approach: I can mock `fetch` or `axios` globally, or mock a database pool. But without knowing the exact import, I might mock the wrong thing.

However, the prompt says "Mock external deps (db/network/fs/other services) deterministically." This implies I should identify external deps from the context. The function name suggests a project column, maybe in a database table `project_columns`. I can mock a db module.

But to be safe, I should mock dependencies using module names that are semantically appropriate and comment that these are the external dependencies. Or, I can use `jest.spyOn(global, 'fetch')` if it's a network call.

Actually, looking at the module path `routes/api/dashboard`, it's an API route. It likely uses a service layer. But since I don't know, I'll mock a hypothetical service `projectService` imported by the module. But if the actual module imports something else, the test won't compile or run correctly.

Wait, the user says "You are given ONLY its public API surface (signatures), NOT the implementation". This means I should write the test as if I only know the public API, and mock the dependencies that the contract implies. In a real-world scenario, I would look at the module's imports. But here I can't. So I must infer the dependencies from the function's purpose.

`ensureTasksProjectColumn` implies it needs to:
- Check if a "Tasks" column exists in a project.
- Create it if missing.
This suggests dependencies on a project/column repository or service.

I'll create mocks for:
- `../src/services/projectService` with methods `getColumn` and `createColumn`.
Or maybe `../src/db` with a query function.

But to make the test compile and be realistic, I'll define mocks for a plausible service and then use `jest.mock` on a plausible path. However, since the prompt is a creative exercise, the exact mock path might not matter as long as it's consistent and demonstrates the pattern. But the user wants strict TS and a complete file.

Let me think about how to handle this elegantly. I can mock a generic `db` module at `../src/db` or `../src/lib/db`. Or I can mock `axios` for network calls.

Actually, maybe the module uses `fetch` or an HTTP client to talk to a project management API. I'll mock `axios` or `node-fetch`. But `node-fetch` is less common now with global fetch.

Alternatively, I can avoid guessing specific internal import paths by mocking at the system boundary: e.g., mock `fs` if it reads config, mock `pg` if it uses postgres, etc. But that's too broad.

Given the constraints, I think the best approach is to mock a service module with a name that clearly indicates it's an external dependency, and import the mocked functions into the test to configure them. A common pattern is `../src/services/projectService`.

Let me draft the test file:

```typescript
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import express from 'express';
import dashboardRouter, { AuthRequest, ensureTasksProjectColumn } from '../src/routes/api/dashboard';
import { getProjectColumn, createProjectColumn } from '../src/services/projectService';

jest.mock('../src/services/projectService');

const mockedGetProjectColumn = jest.mocked(getProjectColumn);
const mockedCreateProjectColumn = jest.mocked(createProjectColumn);

describe('dashboard module', () => {
  describe('ensureTasksProjectColumn', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should resolve without creating when the Tasks column already exists', async () => {
      mockedGetProjectColumn.mockResolvedValue({ id: 'col-1', name: 'Tasks' });
      await expect(ensureTasksProjectColumn()).resolves.toBeUndefined();
      expect(mockedCreateProjectColumn).not.toHaveBeenCalled();
    });

    it('should create the Tasks column when it does not exist', async () => {
      mockedGetProjectColumn.mockResolvedValue(null);
      mockedCreateProjectColumn.mockResolvedValue({ id: 'col-2', name: 'Tasks' });
      await expect(ensureTasksProjectColumn()).resolves.toBeUndefined();
      expect(mockedCreateProjectColumn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tasks' }));
    });

    it('should reject when the project service fails to check existence', async () => {
      const error = new Error('Service unavailable');
      mockedGetProjectColumn.mockRejectedValue(error);
      await expect(ensureTasksProjectColumn()).rejects.toThrow('Service unavailable');
    });

    it('should reject when creation fails', async () => {
      mockedGetProjectColumn.mockResolvedValue(null);
      mockedCreateProjectColumn.mockRejectedValue(new Error('Creation failed'));
      await expect(ensureTasksProjectColumn()).rejects.toThrow('Creation failed');
    });
  });

  describe('default router', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use('/api/dashboard', dashboardRouter);
    });

    it('should be mountable as Express middleware', () => {
      expect(() => app.use(dashboardRouter)).not.toThrow();
    });

    // Since exact routes are not part of the public signature, we test the contract
    // that it handles HTTP requests without crashing and respects AuthRequest shape.
    it('should respond to requests at the mounted path', async () => {
      // We don't know the exact sub-routes, but a dashboard router should at least
      // not crash on a GET request. If no route matches, Express returns 404.
      const response = await request(app).get('/api/dashboard');
      // Contract: the router is a valid Express router; 404 is acceptable if no root route.
      expect(response.status).not.toBe(500);
    });
  });

  describe('AuthRequest type contract', () => {
    it('should accept a request object with an authenticated user property', () => {
      const mockReq = {
        user: { id: 'user-1', roles: ['admin'] },
        headers: { authorization: 'Bearer token' },
      } as unknown as AuthRequest;

      // Runtime check that the shaped object can be passed where AuthRequest is expected
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-1');
    });
  });
});
```

Wait, but I imported `getProjectColumn` and `createProjectColumn` from `../src/services/projectService`. If the actual module doesn't import from there, the test is wrong. But I have no choice; I must infer.

However, maybe I can avoid importing the mocked functions and instead use `jest.mock` on a plausible path, and then not import them? No, I need to type the mocks.

Actually, I can use a more generic approach: mock `../src/db` and use a query function. But same issue.

Alternatively, I can mock `axios` or `fetch` which are standard network boundaries. If `ensureTasksProjectColumn` talks to an external project management API, mocking `axios` is reasonable.

Let me revise to mock `axios`:

```typescript
import axios from 'axios';
jest.mock('axios');
const mockedAxios = jest.mocked(axios);
```

But if the module uses `fetch`, mocking axios won't help.

Given the ambiguity, I think the best is to mock a service layer with a clear name. I'll add a comment indicating these are the implied external dependencies.

But wait, the user said "Mock external deps (db/network/fs/other services) deterministically." So I should probably mock multiple layers or use a generic mocking strategy.

Another idea: Since I don't know the internal imports, I can mock the module itself using `jest.spyOn` on the exported function? No, I need to test the function, so I can't mock it.

I think I have to make a reasonable assumption. The function `ensureTasksProjectColumn` strongly implies it ensures a column named "Tasks" in a project. This is likely a database operation. I'll mock a `db` module.

Let me try this:

```typescript
jest.mock('../src/db', () => ({
  query: jest.fn(),
}));
import db from '../src/db';
const mockedDb = jest.mocked(db);
```

Then in tests:
- `mockedDb.query.mockResolvedValue({ rows: [{ id: 1, name: 'Tasks' }] })` for exists.
- `mockedDb.query.mockResolvedValue({ rows: [] })` for not exists, then creation.
- etc.

This is plausible because many Node apps have a `../src/db` module.

But the path is `../src/routes/api/dashboard`. So `../src/db` would be `../../db` from the module's perspective? No, `../src/db` from the test file perspective. If the test file is in `__tests__` or similar, `../src/routes/api/dashboard` is the module under test. The test file might be at `test/routes/api/dashboard.test.ts` or `src/routes/api/dashboard.test.ts`. The import `../src/routes/api/dashboard` suggests the test is in a sibling directory like `test/...` or `__tests__/...`. Actually, if the test imports `../src/routes/api/dashboard`, the test file is likely at `src/routes/api/dashboard.test.ts` (same dir) or `test/routes/api/dashboard.test.ts` (where `../src` goes to `src`). Wait, if test is at `test/routes/api/dashboard.test.ts`, then `../src/routes/api/dashboard` would be `test/../src/routes/api/dashboard` = `src/routes/api/dashboard`. So the test is likely in a `test` directory parallel to `src`.

From there, `../src/db` would be `src/db`. That's a plausible path.

Okay, I'll go with mocking `../src/db` or `../src/services/projectService`. I think `../src/services/projectService` is more descriptive of the domain. But `../src/db` is more generic.

Actually, to be safe and avoid inventing too many specific method names, I can mock `../src/lib/projectClient` or similar. But I need to pick something.

Let me reconsider the router. Maybe I should not use `supertest` because I don't know if Express is the framework. But `AuthRequest` strongly suggests Express (extends `Request`). So using `express` and `supertest` is reasonable.

However, the user might not have `supertest` installed. But they asked for a Jest test. I can use `supertest` or just invoke the router directly. Invoking directly is harder.

Actually, I can test the router by checking its stack if it's an Express router. But that's implementation detail.

Maybe the router has a specific route that is implied by the function: perhaps `POST /ensure-tasks-project-column` or similar. But I don't know.

Given the difficulty, I will write a test that:
1. Tests `ensureTasksProjectColumn` with a mocked `db` or `projectService`.
2. Tests the default router by mounting it and verifying it behaves as Express middleware.
3. Uses `AuthRequest` to type a mock request for a hypothetical route handler, demonstrating the type contract.

But I need to make sure the test file is complete and compiles.

Let me refine the mock. I'll mock `../src/services/taskProjectService`? No, too specific.

Let's look at the name again: `ensureTasksProjectColumn`. It might be a standalone utility that ensures a column in a project board. I'll assume it imports a `projectApi` from `../src/services/projectApi`.

```typescript
import { projectApi } from '../src/services/projectApi';

jest.mock('../src/services/projectApi', () => ({
  projectApi: {
    getColumns: jest.fn(),
    createColumn: jest.fn(),
  },
}));
```

This is clean. I'll use this.

Now for the router: Since it's a dashboard router, I'll assume it has at least a health check or a route that uses `AuthRequest`. But I don't know the paths. However, I can test that the router is an Express Router by checking its properties, or test mounting.

Actually, maybe the router is the main export and the function is used by it. The contract test for the router could verify that it accepts `AuthRequest` typed requests. But without a route, I can't send a request.

Wait, maybe I can test the router's default export by asserting it's a function with `use`, `get`, `post`, etc. methods. That's a valid contract test for an Express router: it must conform to the Router interface.

```typescript
it('should expose standard Express Router methods', () => {
  expect(typeof dashboardRouter).toBe('function');
  expect(typeof dashboardRouter.get).toBe('function');
  expect(typeof dashboardRouter.post).toBe('function');
  expect(typeof dashboardRouter.use).toBe('function');
});
```

This tests the contract that it's an Express router without knowing the routes.

But the user said "correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions." For a router, valid input could be an HTTP request. But I don't know the endpoints.

I think combining:
- Router is mountable and has Express Router methods.
- Router handles requests without internal server errors (if we assume a root route exists, but we don't know).

Actually, maybe I should just test the router's mountability and that it's not undefined. And focus heavily on `ensureTasksProjectColumn`.

For `AuthRequest`, since it's a type, I'll use it in a test to type a mock object, showing that the contract expects a `user` property or similar on the request. The name `AuthRequest` implies an authenticated request, so it likely extends `Request` with `user: { id: string; ... }` or similar. I'll create a mock object that satisfies this inferred contract and assert its shape.

Let me draft the full file:

```typescript
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import request from 'supertest';
import dashboardRouter, { AuthRequest, ensureTasksProjectColumn } from '../src/routes/api/dashboard';
import { projectApi } from '../src/services/projectApi';

jest.mock('../src/services/projectApi');

const mockedProjectApi = jest.mocked(projectApi);

describe('dashboard module contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureTasksProjectColumn', () => {
    it('should resolve void when the Tasks column already exists (idempotent)', async () => {
      mockedProjectApi.getColumns.mockResolvedValue([{ id: 'c1', name: 'Tasks' }]);
      const result = ensureTasksProjectColumn();
      await expect(result).resolves.toBeUndefined();
      expect(mockedProjectApi.createColumn).not.toHaveBeenCalled();
    });

    it('should create the Tasks column and resolve void when it is missing', async () => {
      mockedProjectApi.getColumns.mockResolvedValue([{ id: 'c1', name: 'Backlog' }]);
      mockedProjectApi.createColumn.mockResolvedValue({ id: 'c2', name: 'Tasks' });
      await expect(ensureTasksProjectColumn()).resolves.toBeUndefined();
      expect(mockedProjectApi.createColumn).toHaveBeenCalledTimes(1);
      expect(mockedProjectApi.createColumn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tasks' }));
    });

    it('should create the Tasks column when no columns exist', async () => {
      mockedProjectApi.getColumns.mockResolvedValue([]);
      mockedProjectApi.createColumn.mockResolvedValue({ id: 'c2', name: 'Tasks' });
      await expect(ensureTasksProjectColumn()).resolves.toBeUndefined();
      expect(mockedProjectApi.createColumn).toHaveBeenCalledTimes(1);
    });

    it('should reject when the project API fails to list columns', async () => {
      mockedProjectApi.getColumns.mockRejectedValue(new Error('Network error'));
      await expect(ensureTasksProjectColumn()).rejects.toThrow('Network error');
    });

    it('should reject when column creation fails', async () => {
      mockedProjectApi.getColumns.mockResolvedValue([]);
      mockedProjectApi.createColumn.mockRejectedValue(new Error('Forbidden'));
      await expect(ensureTasksProjectColumn()).rejects.toThrow('Forbidden');
    });
  });

  describe('default router', () => {
    it('should export a valid Express Router (middleware function with routing methods)', () => {
      expect(dashboardRouter).toBeDefined();
      expect(typeof dashboardRouter).toBe('function');
      expect(typeof dashboardRouter.get).toBe('function');
      expect(typeof dashboardRouter.post).toBe('function');
      expect(typeof dashboardRouter.use).toBe('function');
    });

    it('should be mountable in an Express application without throwing', () => {
      const app = express();
      expect(() => app.use('/api/dashboard', dashboardRouter)).not.toThrow();
    });

    it('should handle requests without unhandled errors when mounted', async () => {
      const app = express();
      app.use('/api/dashboard', dashboardRouter);
      const res = await request(app).get('/api/dashboard');
      // Contract: a valid router may 404 on unknown paths, but must not 500.
      expect(res.status).not.toBe(500);
    });
  });

  describe('AuthRequest type contract', () => {
    it('should represent an authenticated Express request with a user property', () => {
      const mockUser = { id: 'u-123', email: 'test@example.com' };
      const mockReq = {
        user: mockUser,
        headers: { authorization: 'Bearer valid-token' },
        params: {},
        query: {},
        body: {},
      } as unknown as AuthRequest;

      // Runtime contract: the request carries an authenticated user context.
      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.user.id).toBe('u-123');
    });
  });
});
```

This looks solid. It tests:
- `ensureTasksProjectColumn`: idempotency, creation when missing, empty list, API failures.
- `dashboardRouter`: it's a valid Express router, mountable, handles requests without 500.
- `AuthRequest`: type contract via runtime object shape.

I used `../src/services/projectApi` as the mocked dependency. I need to make sure the import path is consistent. The test imports from `../src/routes/api/dashboard`, so `../src/services/projectApi` is a sibling to `routes`. That's plausible.

One issue: `jest.mock('../src/services/projectApi')` must be at the top level. The import of `projectApi` must come after the mock. In the code above, I have `jest.mock` before the import, which is correct for hoisting, but actually in ESM-like TS with jest, `jest.mock` is hoisted, so the order doesn't matter, but it's conventional to put it before.

Wait, in my draft, I wrote:
```typescript
import { projectApi } from '../src/services/projectApi';
jest.mock('../src/services/projectApi');
```
Because of hoisting, `jest.mock` runs before imports, so it's fine. But to be safe and clear, I'll put `jest.mock` above the import of the mocked module, or just rely on hoisting. Actually, the standard pattern is:
```typescript
jest.mock('../src/services/projectApi');
import { projectApi } from '../src/services/projectApi';
```
But TypeScript might complain about imports after statements if not using `esModuleInterop` in a certain way? No, jest hoists `jest.mock` calls, but the import statement is still written before. Actually, it's common to write:
```typescript
import { projectApi } from '../src/services/projectApi';
jest.mock('../src/services/projectApi');
```
This works because jest hoists `jest.mock` to the top. So it's fine.

However, I need to ensure the mock factory returns the right shape. `jest.mock` without a factory will auto-mock the module. Since I'm using `jest.mocked(projectApi)`, auto-mock should replace methods with `jest.fn()`. That works.

But wait, `projectApi` might be an object with methods. Auto-mock will mock them. So `mockedProjectApi.getColumns` etc. will be mock functions.

One more thing: the user said "Strict TS". I should make sure the test file has proper types. I'll need to import types from express.

Also, `supertest` types: `import request from 'supertest';` requires `@types/supertest`. I'll assume it's available.

Let me double-check the contract tests for `ensureTasksProjectColumn`:
- It returns `Promise<void>`. I assert `resolves.toBeUndefined()`. Good.
- It should throw on invalid inputs? The signature takes no arguments: `async function ensureTasksProjectColumn(): Promise<void>`. So there are no input arguments to validate. The "invalid inputs" in the rules might apply to other functions, but here there are none. The boundary conditions are external service states (empty list, missing column, API errors). Good.

For the router:
