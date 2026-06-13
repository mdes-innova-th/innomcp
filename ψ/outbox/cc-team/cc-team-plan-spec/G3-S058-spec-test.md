<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S058 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":209,"completion_tokens":7000,"total_tokens":7209,"prompt_tokens_details":{"cached_tokens":73,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 64s
 generated: 2026-06-13T11:37:46.865Z -->
The user wants a Jest contract/behavior test for a module called `memories` from `innomcp-node`. The public API surface is very minimal:

1. `async function ensureProjectAccess(projectId: string | undefined, userId: number | null): Promise<boolean>`
2. `export default router;` (which is presumably an Express router or similar)

Wait, the import path is `../src/routes/api/memories`. So this is likely an Express router module that exports a router and also exports `ensureProjectAccess`? Or maybe `ensureProjectAccess` is exported alongside the router? The prompt says "public API surface" includes both.

But the import statement must be EXACTLY: `import ... from '../src/routes/api/memories';`

So I need to figure out what to import. The module exports `ensureProjectAccess` and a default router. So the import might look like:
`import memoriesRouter, { ensureProjectAccess } from '../src/routes/api/memories';`

But wait, the prompt says "Import EXACTLY: import ... from '../src/routes/api/memories';" - the `...` means I should fill in the imports. It must start with `import` and end with `from '../src/routes/api/memories';`.

Now, the challenge: I have only the signatures. I need to infer the contract from names and signatures.

`ensureProjectAccess(projectId: string | undefined, userId: number | null): Promise<boolean>`
- Name implies it checks if a user has access to a project.
- Returns boolean: true if access granted, false otherwise.
- Inputs: projectId can be string or undefined. userId can be number or null.
- Likely throws or returns false on invalid inputs? Need to decide based on contract.
- Boundary conditions: undefined projectId, null userId, empty string projectId, negative userId, etc.

`export default router;`
- This is likely an Express router.
- Since it's a router, it probably defines routes like GET, POST, PUT, DELETE for `/memories` or something.
- But without knowing the routes, how do we test it?
- We can test the router as a middleware/router object using `supertest` or by mounting it in an Express app and testing endpoints.
- However, we don't know the exact routes. But the module is `memories`, so likely REST endpoints for memory resources.
- Common REST contract:
  - GET / -> list memories (maybe with project filter)
  - POST / -> create memory
  - GET /:id -> get memory by id
  - PUT /:id -> update memory
  - DELETE /:id -> delete memory
- But we don't know the exact paths. However, we can infer from standard REST conventions and the presence of `ensureProjectAccess` that routes are protected by this check.
- Wait, the prompt says "Test observable behavior/contracts implied by the names+signatures". For the router, the signature is just `export default router;`. The contract is that it's a valid Express router object that can handle requests. But without knowing the routes, it's hard to test specific endpoints.
- Maybe the router uses `ensureProjectAccess` as middleware? Or maybe `ensureProjectAccess` is just exported alongside.
- Actually, looking at the module path `../src/routes/api/memories`, in many Node.js projects, this file exports an Express router as default, and may export helper functions. The router likely handles CRUD for "memories" scoped to a project.
- Since we must mock external deps (db/network/fs), we need to mock whatever database client or service the router uses.
- But we don't know the internal implementation or what external deps it uses. However, we can infer it likely uses a database to fetch/store memories and check project access.
- The function `ensureProjectAccess` probably queries a database or service to check access. We need to mock that external dependency. But since we don't know the exact import the module uses internally, we can use `jest.mock` to mock the module's dependencies if we knew them. But we don't.
- Wait, the prompt says "Mock external deps (db/network/fs/other services) deterministically." Since we don't know the internal imports, we might need to mock at a higher level or mock the module itself? No, we are testing the module, so we should mock its dependencies. But we don't know what they are.
- However, we can treat `ensureProjectAccess` as part of the module under test. For the router, we can test it by importing the router, creating an Express app, mounting it, and using supertest. But to make it offline, we need to mock the database layer that the router uses. Since we don't know the exact module names, perhaps we can mock `../src/db` or similar? But that's guessing.
- Alternatively, maybe the router is simple enough that we can test `ensureProjectAccess` directly and test that the router is a valid Router instance? But the prompt says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called."
- Let's reconsider. The user gave ONLY these two lines of public API. Maybe the router is not meant to be tested via HTTP in this context because we don't know the routes. But the prompt says "Test observable behavior/contracts implied by the names+signatures". For a default export of a router, the contract is that it's an Express router. But maybe we can test it by checking it's a function (middleware) or has the Router methods? That seems weak.
- Another interpretation: The module is `memories.ts` which exports `ensureProjectAccess` and a default router. The router likely has routes that use `ensureProjectAccess`. But without knowing the route definitions, we can't test them specifically. However, maybe the contract is just that the router exists and can be mounted.
- Wait, perhaps the prompt expects us to test `ensureProjectAccess` thoroughly and test the router's existence/interface. But "assert values/state" suggests we need to test actual behavior.
- Let's think about what `ensureProjectAccess` does based on name and signature:
  - It takes a projectId (string | undefined) and userId (number | null).
  - It returns Promise<boolean>.
  - Contract: If projectId is undefined, maybe it returns false or throws? If userId is null, maybe returns false.
  - It likely checks in a database if the user is associated with the project.
  - We need to mock the database. Since we don't know the db module, we can mock the entire module's internal db call by using `jest.spyOn` if we knew the method. But we don't.
  - Actually, maybe `ensureProjectAccess` is the only thing we can realistically test because we can call it directly and mock its dependencies if we assume them? No, we don't know its dependencies.
  - But wait: if `ensureProjectAccess` is exported, we can test it as a black box only if we mock the things it calls. But we don't know what it calls. However, we can infer it might call a database function like `getProjectAccess` or similar. But we can't know for sure.
  - Maybe the module `memories` is a very thin wrapper and `ensureProjectAccess` is actually imported from somewhere else? No, it's defined in the module.
  - Hmm. Let's look at the prompt again: "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS."
  - This implies we should mock things like database clients. Since we don't know the exact names, we might need to use a generic mocking approach or assume standard names. But that's risky.
  - Wait, maybe the module uses a global db instance or a known service. But we have no info.
  - Another angle: The prompt might be designed such that we only need to test `ensureProjectAccess` and the router's export, but we can mock dependencies by mocking the module itself? No, that doesn't make sense.
  - Let's reconsider the router. In Express, a router is a function with methods. The contract of `export default router` is that it's a valid Express Router. We can test this by importing it, creating an app, and maybe checking that it handles requests. But without knowing the routes, we can't send requests.
  - Unless... the routes are standard REST and implied by the module name `memories`. But we don't know if it's `/`, `/:id`, etc.
  - Maybe the test should focus almost entirely on `ensureProjectAccess`, and for the router, just verify it's an Express Router instance (using `expect(router).toBeInstanceOf(Function)` or similar). But the prompt says "assert values/state".
  - Actually, `export default router` from an Express routes file typically means the router handles a specific sub-route. The contract is that it can be mounted. But we can test that mounting it doesn't throw and that it's a middleware function.
  - However, the prompt says "Test observable behavior/contracts implied by the names+signatures: correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions."
  - For `ensureProjectAccess`:
    - Valid: string projectId, number userId -> returns true/false based on db.
    - Invalid: undefined projectId -> should return false or throw? Given the type allows undefined, returning false is more likely (or maybe throw TypeError? But async functions usually don't throw on type issues unless explicitly validated).
    - Invalid: null userId -> likely returns false.
    - Boundary: empty string projectId -> likely returns false.
    - Boundary: userId 0 or negative -> returns false.
  - For the router:
    - Since we don't know routes, maybe we can't test it. But the prompt includes it in the API surface, so we must test it.
    - Perhaps we can test that the router has the standard HTTP methods as functions (get, post, put, delete, use, etc.), which is the contract of an Express Router. But that's testing implementation (Express internals), not behavior.
    - Or maybe we can test that when mounted, requests to the base path don't crash? But again, we don't know the base path.
  - Let's think about typical innomcp-node structure. "innomcp" might be a specific project. "memories" route likely handles AI memories for MCP (Model Context Protocol). The router probably has endpoints like GET /, POST /, DELETE /:id, etc. But we can't be sure.
  - Wait, the user might expect us to test the router using supertest and assume standard REST endpoints, mocking the database layer with a generic mock. But without knowing the internal db module name, how to mock?
  - Maybe the module imports a db client from a known relative path like `../../db` or `../db`. But we don't know.
  - Actually, in many Jest contract tests, when you don't know implementation, you mock the dependencies that the module *must* have based on its behavior. But here we don't know the dependency names.
  - However, we can use `jest.mock` on the module itself to mock the default export and named export? No, we are testing the real module.
  - Let's reconsider: Maybe the prompt is a test of our ability to infer contracts and write tests even with limited info, using mocks that we define as if they were the external deps. We can assume the module imports something like `db` or `prisma` and mock that path. But which path?
  - Since the module is at `../src/routes/api/memories`, common patterns would have db at `../../db` or `../../../db` or `../../services/db`. But it's too ambiguous.
  - Alternatively, maybe `ensureProjectAccess` is the only function that interacts with external deps, and we can test it by mocking the module's own internal calls? No.
  - Wait, perhaps `ensureProjectAccess` is exported so that it can be tested, and the router is just an Express router that we can test by verifying it exports the correct middleware structure. But again, weak.
  - Let's look at the exact wording: "Write a Jest CONTRACT/BEHAVIOR test for an innomcp-node module. You are given ONLY its public API surface (signatures), NOT the implementation — so you must test the CONTRACT (intended behavior), not echo code."
  - "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS."
  - This suggests that the module definitely uses external deps, and we need to mock them. Since we don't know the exact import paths, maybe we should mock the most likely ones or use a generic approach.
  - But in Jest, you have to specify the module path to mock. If we guess wrong, the test won't work. However, the user is asking for a code block, not necessarily runnable without knowing the exact deps. They want to see the *style* and *contract* tests.
  - Maybe the module uses a service imported from `./memoriesService` or similar? No, the module is the route file itself.
  - Let's think about what `ensureProjectAccess` likely does: it probably queries a database to check if a user has access to a project. The most common pattern in Node/Express is to import a db pool or ORM. Let's assume it imports `db` from `../../db` or uses a service. But we can't know.
  - Actually, maybe we can avoid mocking specific unknown modules by using `jest.spyOn` on the exported `ensureProjectAccess` itself for the router tests? But if we test the router, it calls `ensureProjectAccess` internally. If we mock `ensureProjectAccess`, we are testing the router in isolation. That could work!
  - Yes! For the router tests, we can mock the module's own `ensureProjectAccess` function by importing it and then using `jest.spyOn` or `jest.mock` on the module? Wait, we can't easily mock a named export of the module under test from within the test file that imports it, unless we use `jest.mock` on the module path with a factory, but then we'd need to provide the mock implementation for the whole module.
  - Actually, we can do:
    ```typescript
    jest.mock('../src/routes/api/memories', () => ({
      __esModule: true,
      default: jest.fn(() => ...), // mock router? hard.
      ensureProjectAccess: jest.fn(),
    }));
    ```
    But then we are mocking the module under test, which means we can't test the real `ensureProjectAccess`. The prompt says test the module, so we need the real implementation for `ensureProjectAccess` but mock its external deps.
  - For `ensureProjectAccess`, if we don't know its deps, we can't test it in isolation without guessing.
  - Unless... `ensureProjectAccess` is a pure function? No, it's async and checks project access, so it must use external deps.
  - Maybe the contract test should treat `ensureProjectAccess` as a black box that *should* call the db, and we mock the db at the global level. But again, unknown path.
  - Let's reconsider the possibility that the module is very simple and `ensureProjectAccess` is the only logic, while the router is just a standard Express router that uses this function. Perhaps the test should focus on `ensureProjectAccess` and just do a minimal sanity check on the router (e.g., it's defined, it's a function).
  - But the prompt says "Test observable behavior/contracts implied by the names+signatures". The signature `export default router` implies it's an Express Router. The observable behavior is that it can be mounted and handle requests. But without routes, we can't send requests.
  - Maybe the contract is simply that `router` is an Express Router instance. We can test:
    - `expect(typeof router).toBe('function')`
    - `expect(router).toHaveProperty('get')`
    - etc.
    But that's checking implementation details of Express, not behavior.
  - Another idea: Perhaps the module is from a known codebase (innomcp-node) and the user expects us to know or infer the standard structure. "memories" API might have routes like:
    - GET /api/memories?projectId=...
    - POST /api/memories
    - etc.
    And `ensureProjectAccess` is used as middleware.
    If we assume standard REST, we could write tests for these endpoints, mocking a database service. But we don't know the exact service.
  - However, maybe we can write the test in a way that mocks a generic "db" module and describes the contract in comments, showing the intent. But the prompt says "Strict TS" and "complete test file".
  - Let's try to infer from the path: `../src/routes/api/memories`. The file is likely `src/routes/api/memories.ts`. It probably imports `Router` from `express`. It probably imports a database client from `../../db` or `../../../lib/db` or similar. But in many projects, there's a `src/db.ts` or `src/database.ts`. Given the file is two levels deep (`routes/api`), `../../db` would point to `src/db`. That's a reasonable guess.
  - Let's assume the module imports a db client from `../../db` (or similar) and uses it to check access. We can mock `../../db`. But wait, the test file is presumably at `__tests__/memories.test.ts` or `test/routes/api/memories.test.ts`. The import is `from '../src/routes/api/memories'`. So the test file is likely at the project root or in a `tests` folder at the same level as `src`. If the test is at `tests/memories.test.ts`, then `../src/routes/api/memories` is correct. The db would be at `../src/db`. So we can mock `../src/db`.
  - But we don't know if the db is default export or named. Let's assume a common pattern: `import db from '../src/db';` or `import { query } from '../src/db';`.
  - Actually, to be safe and generic, maybe we can mock `../src/db` with a default export that has a query method.
  - Alternatively, maybe the module uses a service layer like `../src/services/access`. But `ensureProjectAccess` is defined in the module itself, so it likely contains the db query directly.
  - Let's think about the contract of `ensureProjectAccess` more carefully:
    - `projectId: string | undefined`: If undefined, the function cannot verify access to a specific project. Contract: return `false` (deny by default).
    - `userId: number | null`: If null, no user context. Contract: return `false`.
    - If both are valid, it queries the db. If db says user has access, return true; else false.
    - It should not throw on null/undefined (since types allow them), but should return false.
    - It might throw if db connection fails? Or return false? Contract behavior on external failure: probably throw/reject because it's an unexpected error.
    - Boundary: empty string `""` for projectId. Likely returns false because it's not a valid project ID.
    - Boundary: `NaN`, `Infinity`, negative number for userId. Returns false.
    - Boundary: very long projectId string. Should handle it (return true/false based on db).
  - For the router:
    - Since it's a default export of an Express router, and the module is `memories`, it likely handles CRUD for memories scoped to projects.
    - The router probably uses `ensureProjectAccess` as middleware on all routes.
    - Routes might include:
      - `GET /` - list memories (requires project access)
      - `POST /` - create memory (requires project access)
      - `GET /:memoryId` - get specific memory (requires project access)
      - `DELETE /:memoryId` - delete memory (requires project access)
    - But we don't know for sure.
    - However, we can test the router by mounting it and testing that it responds to requests. But without knowing the exact route handlers, we might get 404s. That's actually fine: if we don't know the routes, we can't test them.
    - Wait, maybe the contract is just that the router is a valid Express Router and that `ensureProjectAccess` is exported. But the prompt asks to test behavior.
  - Let's reconsider the prompt's constraints. It says "OUTPUT CONTRACT: ONE ```typescript block, complete test file, nothing else." So I need to produce a single code block.
  - Given the extreme lack of information, the best approach is to write a comprehensive contract test for `ensureProjectAccess` (since we know its signature) and write a structural/behavioral test for the router that verifies it is an Express Router and can be mounted without error. Additionally, we can test that the router handles requests by assuming standard REST conventions and using supertest, but we must mock the database.
  - Actually, maybe we can avoid assuming routes by testing the router's middleware behavior: mount it, send a request to `/`, and since we don't know what it does, maybe it returns 404 or 401. But that's not a strong contract.
  - Another thought: In many Express apps, the router from `memories.ts` might be mounted at `/api/memories`. The router itself might handle `/`. So if we mount the router at `/` in a test app, a GET to `/` should be handled. But we don't know if it requires auth, what it returns, etc.
  - However, the presence of `ensureProjectAccess` suggests that project access is checked. Maybe the router expects `projectId` in query or body.
  - Let's try to infer a minimal plausible contract:
    - The router provides endpoints for memory management.
    - All endpoints require valid project access (via `ensureProjectAccess`).
    - If access is denied, endpoints return 403.
    - If projectId is missing, return 400 or 403.
    - But this is a lot of assumption.
  - Maybe the prompt is designed to be impossible to fully implement without guessing, and the expected answer is to show the testing *pattern* for the given signature, making reasonable assumptions and using mocks. The key is to demonstrate contract testing: inputs -> outputs, error cases, boundaries.
  - Let's focus on `ensureProjectAccess` as the primary test subject, and for the router, do a minimal mount test and perhaps test that it's a function.
  - But wait, the user might consider the router the main export and `ensureProjectAccess` a helper. The prompt says "Module: memories — public API surface" and lists both. So both need tests.
  - Let's write tests for `ensureProjectAccess` with mocked db. I'll assume the module imports a database client from a relative path. To make it deterministic and offline, I'll mock `../src/db` with a `query` function. But I need to be careful: the test imports the module under test, and Jest hoists `jest.mock`. If the module under test imports `../src/db`, the mock will apply. I'll define the mock accordingly.
  - For the router, I'll create an Express app, mount the router, and test that it accepts requests. But since I don't know the routes, I'll test the contract that it is a valid Router by checking its shape and that mounting it doesn't throw. I can also test that it has standard HTTP method handlers. But that's weak.
  - Actually, maybe I can test the router by using `supertest` and sending a GET to `/` and asserting that it doesn't crash the app (returns some status). But if the route isn't defined, Express returns 404. Is 404 a valid contract? Not really.
  - Let's think differently. Perhaps `export default router` means the router is the main thing, and `ensureProjectAccess` is a middleware exported for testing. The router likely uses `ensureProjectAccess`. So we can test `ensureProjectAccess` directly, and test the router indirectly by testing that it uses the middleware? No, we don't know.
  - Given the strict rules, I think the safest is to write a thorough contract test for `ensureProjectAccess` and a minimal structural test for the router (verifying it's an Express Router instance). But the prompt says "assert values/state". For the router, we can assert that `typeof router === 'function'` and that it has properties like `get`, `post`, etc. But those are implementation details.
  - Wait, maybe we can test the router by mounting it and then verifying that `ensureProjectAccess` is called when hitting a route? But we don't know the routes.
  - Let's look at the signature again: `async function ensureProjectAccess(projectId: string | undefined, userId: number | null): Promise<boolean>`. This is not a middleware signature (middleware is `(req, res, next)`). So it's a utility function, not middleware. The router probably calls it internally with extracted params.
  - Okay, new plan:
    1. Test `ensureProjectAccess` extensively.
    2. Test the router by importing it, creating an Express app, mounting it, and verifying the app can be created and the router is a function. Maybe send a request to a dummy path and expect 404, but that's not useful.
    3. Actually, maybe the router is just a Router instance and the contract is that it can be used as middleware. We can test: `const app = express(); app.use(router); expect(app).toBeDefined();` But that's weak.
  - Let's search my internal knowledge for "innomcp-node". I don't have specific knowledge of this project. It might be a fictional or internal project name.
  - Given the lack of info, I will make reasonable assumptions and write a contract test that is as generic as possible while still being strict TS and Jest.
  - Assumptions to make:
    - The module imports a database/ORM from `../../db` (relative to `src/routes/api/memories.ts` -> `src/db`). So in the test, which is at the same level as `src` (or in `tests/` sibling to `src`), the path would be `../src/db`. Wait, the test imports the module as `../src/routes/api/memories`. So the test is likely in a directory sibling to `src`, e.g., `tests/` or `__tests__/`. Thus `../src/db` would be the correct relative path from the test file to `src/db`. I'll mock `../src/db`.
    - The db module exports a `query` method or an object with `query`. I'll make it flexible.
    - The router is an Express Router. I'll test it by mounting and maybe checking it handles a request. But I won't assume specific routes beyond a health-check or base path. Actually, I can test that mounting the router doesn't throw and that the resulting app is an Express app. But that's testing Express, not the module.
    - Maybe I can test the router by introspecting its stack? Express routers have a `stack` property that contains the layers. But that's implementation detail.
  - Let's reconsider the router test. Perhaps the contract of the router is simply that it is a valid Express Router object. In Jest, we can do:
    ```typescript
    import router from '../src/routes/api/memories';
    import express from 'express';

    describe('memories router', () => {
      it('should export a valid Express Router', () => {
        expect(typeof router).toBe('function');
        expect(router).toHaveProperty('get');
        expect(router).toHaveProperty('post');
        expect(router).toHaveProperty('use');
      });

      it('should be mountable in an Express application', () => {
        const app = express();
        expect(() => app.use(router)).not.toThrow();
      });
    });
    ```
    This tests the contract that it's a router. It's not deep, but it's what we can do with only the signature.
  - For `ensureProjectAccess`, I'll write detailed tests. I'll mock `../src/db` with a default export object that has a `query` method. If the actual module uses a different db import, the test would need adjustment, but this shows the intent.
  - Actually, to be more robust, maybe `ensureProjectAccess` uses a service or a specific function. But I have to guess. Let's assume it uses a SQL query via a `db` object.
  - Let's draft the test structure:

```typescript
import memoriesRouter, { ensureProjectAccess } from '../src/routes/api/memories';
import express from 'express';
import request from 'supertest';

// Mock external deps
jest.mock('../src/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from '../src/db';

describe('memories module contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureProjectAccess', () => {
    it('returns true when the database confirms user access to the project', async () => {
      (db.query as jest.Mock).mockResolvedValue([{ exists: true }]);
      await expect(ensureProjectAccess('proj-123', 1)).resolves.toBe(true);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('project'), ['proj-123', 1]);
    });

    it('returns false when the database denies user access', async () => {
      (db.query as jest.Mock).mockResolvedValue([]);
      await expect(ensureProjectAccess('proj-123', 1)).resolves.toBe(false);
    });

    it('returns false when projectId is undefined', async () => {
      await expect(ensureProjectAccess(undefined, 1)).resolves.toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns false when userId is null', async () => {
      await expect(ensureProjectAccess('proj-123', null)).resolves.toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns false when both projectId and userId are missing', async () => {
      await expect(ensureProjectAccess(undefined, null)).resolves.toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns false for empty string projectId', async () => {
      (db.query as jest.Mock).mockResolvedValue([]);
      await expect(ensureProjectAccess('', 1)).resolves.toBe(false);
    });

    it('rejects when the database throws an unexpected error', async () => {
      (db.query as jest.Mock).mockRejectedValue(new Error('Connection lost'));
      await expect(ensureProjectAccess('proj-123', 1)).rejects.toThrow('Connection lost');
    });
  });

  describe('default router export', () => {
    it('is a valid Express Router function', () => {
      expect(typeof memoriesRouter).toBe('function');
      expect(memoriesRouter).toHaveProperty('get');
      expect(memoriesRouter).toHaveProperty('post');
      expect(memoriesRouter).toHaveProperty('use');
    });

    it('can be mounted in an Express application without error', () => {
      const app = express();
      expect(() => app.use(memoriesRouter)).not.toThrow();
    });
  });
});
```

- But wait, `db.query` call assertion: I don't know the exact SQL or parameters. Asserting on the call might be too specific and "echo code" if I guess wrong. The prompt says "not echo code". So maybe I shouldn't assert the exact query string, but rather assert that `db.query` was called (mock called) or not called. But rule 2 says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So asserting `toHaveBeenCalled` is discouraged. Hmm.
- Actually, rule 2 says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." This means the primary assertions should be on the output/state, not just mock verification. I can still use mock verification as secondary, but the main thing should be the return value.
- For `db.query`, if I mock it, the value returned determines the output. So asserting the output is enough. I can avoid asserting on mock calls entirely, or keep them minimal.
- But if I don't assert that db.query wasn't called for undefined projectId, how do I know it short-circuited? I can check that by ensuring the mock has no calls. But that's "that mocks were called". Maybe I can use a counter or a mock that throws if called, and assert the output is false. That's better: for undefined projectId, I can set up a mock that throws if called, and assert output is false. That proves it didn't call the db without asserting on mock calls.
- Let's refine:
  - For cases where db should not be called: create a mock that throws if invoked, then assert output is false. This tests the contract (short-c
