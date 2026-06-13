<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S048 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":186,"completion_tokens":7000,"total_tokens":7186,"prompt_tokens_details":{"cached_tokens":70,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 71s
 generated: 2026-06-13T11:34:32.465Z -->
The user wants a Jest contract/behavior test for an `innomcp-node` module located at `../src/routes/api/analyze`. The only public API surface given is `export default router;`.

This is a very minimal API surface. It exports a default router. Since it's a router (likely Express or similar), I need to infer the contract from the name "analyze" and the fact it's a router exported from `routes/api/analyze`.

Given it's a router exported as default from a routes file, the contract is likely:
1. It's a valid router object (or middleware function) that can be mounted.
2. It handles specific HTTP routes related to "analysis".
3. But without knowing the specific routes, HTTP methods, or what it does, I have to make reasonable assumptions based on standard Express patterns and the name "analyze".

Wait, the user says "You are given ONLY its public API surface (signatures)". The signature is `export default router;`. This means `router` is the default export. In Express/Node.js, a router is typically an `express.Router()` instance.

However, to write a meaningful contract test, I need to infer what this router does. The path is `routes/api/analyze`. So it's likely an Express router mounted at `/api/analyze` or similar.

But the user says "Test observable behavior/contracts implied by the names+signatures". The name is "analyze" and it's a router. The contract of a router is that it:
- Is a function or object with routing methods (get, post, etc.)? No, that's testing implementation details (Express internals).
- Can be used as middleware by an Express app? Yes, that's a behavior.
- But more importantly, since it's an API route, it probably responds to HTTP requests. However, testing HTTP requests requires supertest or similar.

Wait, the user says "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS." This implies the module might import and use external dependencies that I need to mock. But I don't know what those are.

Since I only know the export is `router`, I need to think about what a contract test looks like for an Express router when we don't know the exact routes.

Actually, looking at the module path `../src/routes/api/analyze`, and the fact it's a default export of a router, in many Node.js/Express setups, this router would be imported by the main app and mounted. The contract test should verify that:
1. The default export is a function (Express middleware/router).
2. It can be mounted in an Express app without error.
3. It handles requests appropriately.

But without knowing the specific endpoints (GET /, POST /, etc.), I have to make educated guesses or test the generic router contract.

However, the user says "correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions". For a router, inputs are HTTP requests. Outputs are HTTP responses.

Given the name "analyze", possible endpoints:
- POST / - submit something to analyze
- GET /:id - get analysis results
- GET / - list analyses or get status

But I don't know. I need to be careful. The user wants a contract test based ONLY on the public API surface. The public API surface is just `export default router;`. So the only contract I can strictly verify is that the module exports something that behaves like an Express router (i.e., it's a function with router methods, or it can handle requests).

Wait, maybe I should interpret "router" more broadly. In some frameworks, a router might just be a function that takes a request and returns a response. But given the file path `routes/api/analyze`, it's almost certainly an Express-style router.

Let me think about what a robust contract test would look like with minimal assumptions:
- Import the module.
- Verify it's a function (since Express routers are functions).
- Verify it has the methods `use`, `get`, `post`, etc. (Express Router API). But is that testing implementation? Yes, somewhat. But it's also testing the contract that it IS a router.
- However, the user wants "correct outputs for valid inputs". For a router, the input is an HTTP request.

Maybe I should use `supertest` to test the router by mounting it in a test Express app. Since I don't know the exact routes, I can test that:
- The router is mountable.
- It responds to requests (maybe 404 for unknown paths, but that's Express default).

But the user wants me to assert VALUES/STATE. If I don't know the routes, I can't assert specific values.

Let me reconsider. Perhaps the module name "innomcp-node" and the route "analyze" give a clue. "innomcp" might be a specific project. But I don't have context on that.

Alternatively, maybe the router is expected to expose specific analysis endpoints. But without signatures, I can't know.

Wait, the prompt says: "Test observable behavior/contracts implied by the names+signatures: correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions."

Given ONLY `export default router;`, the contract is:
1. The module has a default export.
2. The default export is a router (middleware function).
3. As a router mounted in an Express app, it will handle requests for the "analyze" API.

But to write a concrete test with values, I need to assume some standard REST conventions for an "analyze" resource. I think the best approach is to assume it's an Express Router and test it via HTTP using supertest, making reasonable assumptions about endpoints based on RESTful conventions for an analysis service, while mocking external deps.

However, the user said "Mock external deps (db/network/fs/other services) deterministically." This suggests the router likely uses a database or external service. Since I don't know which, I should mock common ones or mock the module's potential dependencies. But I don't know what it imports.

Actually, in a strict contract test with only the export signature known, I can only test the integration contract: that it's valid Express middleware. But the user explicitly asks for "correct outputs for valid inputs" and "boundary conditions".

Let me think differently. Maybe `router` is not an Express router but something else? No, the file is in `routes/api/analyze`, so it's definitely an Express router.

Perhaps the intended answer is to test the router as middleware and assume standard CRUD endpoints for an analysis API. I'll make reasonable assumptions:
- `POST /` - creates an analysis job. Input: analysis payload. Output: job ID or result.
- `GET /:id` - retrieves analysis status/result. Input: ID. Output: analysis object.
- Invalid inputs: malformed JSON, missing fields, invalid ID format.

But I need to mock external dependencies. Since I don't know them, I'll mock things that an analysis route typically uses: maybe a database client, an AI service, or a file system. I'll use jest.mock with generic names? No, I need to know what to mock.

Wait, I can mock the module's internal imports by placing mocks at the appropriate paths, but I don't know what it imports. This is a problem.

Unless... the prompt expects me to infer likely dependencies from the module name and path. An "analyze" route in an MCP (Model Context Protocol?) node module might call external analysis services.

Actually, "innomcp-node" - maybe it's related to MCP (Model Context Protocol). The "analyze" route might analyze something using an LLM or local tool.

Given the constraints, I think the best strategy is:
1. Treat the default export as an Express Router.
2. Create a test Express app, mount the router at `/api/analyze`.
3. Use supertest to make requests.
4. Mock external dependencies at likely import paths, OR mock them generically if I can infer them.

But I don't know the import paths. Hmm.

Wait, maybe I should mock `express` itself? No, that's not an external dep in the sense of db/network/fs.

Another approach: Since I only have the signature `export default router;`, maybe the contract is simply about the export itself. But the user wants "correct outputs for valid inputs" which implies the router processes inputs.

Let me look at the prompt again: "Module: analyze — public API surface: `export default router;`"

This is extremely minimal. In such cases, the contract test should verify:
- The module exports a default.
- The exported value is a function (middleware).
- The function accepts `(req, res, next)` correctly.
- It can be mounted in Express.

But that's not very deep. However, for a router, the "inputs" are the HTTP requests. The "outputs" are responses. Without knowing routes, I can still test that:
- Mounting the router doesn't throw.
- Making a request to the mounted router returns a response (maybe 404 if no routes match, but that's still a behavior).

But the user wants boundary conditions and error on invalid inputs. For a generic router, invalid input might be calling it without proper Express context? No, that's not typical.

I think I need to make reasonable assumptions about the REST API contract for an `analyze` resource. I'll assume:
- `POST /api/analyze` - accepts a body, returns 202/200 with analysis result.
- `GET /api/analyze/:id` - returns analysis by ID.
- It uses some external service that I will mock.

For the mock, since I don't know the exact module paths, I'll create a mock for a hypothetical `AnalysisService` or similar. But I need to import from the actual module paths. Since I don't know them, I have two options:
1. Mock nothing and just test the router interface (but user said to mock external deps).
2. Assume common patterns and mock likely dependencies.

Actually, looking at the import path `../src/routes/api/analyze`, the module might import services from `../../services/analyze` or similar. But I can't know.

Wait, maybe the test should mock the dependencies that the router is likely to have based on the domain. But without knowing the import paths, I can't write `jest.mock('../../services/...')` because it might be wrong.

However, the user said "Mock external deps (db/network/fs/other services) deterministically." This is a requirement. So I must include mocks. I'll have to make educated guesses about what an analyze route in this context would use.

Given "innomcp-node", maybe it's an MCP server. The analyze route might interact with:
- A database (SQLite/PostgreSQL) via some db module.
- A filesystem to read files to analyze.
- An external AI API.

But I don't know the exact import paths. Maybe I can mock `fs`, `path`, and generic network modules? Or maybe the module doesn't import anything and I just need to show the pattern.

Actually, I can write the test such that it mocks dependencies at plausible relative paths, or I can mock Node.js built-ins like `fs` and `http` if the router is expected to use them. But that's speculative.

Let me reconsider the problem. The user might be testing my ability to infer contracts from minimal signatures. The signature `export default router;` tells us it's a router. The contract of a router is that it's an Express middleware. The test should verify that when used as middleware, it routes requests correctly.

But to make it a "contract/behavior" test with values, I'll assume the router implements a standard REST API for analysis:
- `POST /` with valid payload returns analysis result.
- `POST /` with invalid payload returns 400.
- `GET /:id` with valid ID returns result.
- `GET /:id` with invalid ID returns 404 or 400.

For mocks, I'll mock a service module at a likely path. Since the router is at `src/routes/api/analyze.ts`, it might import from `src/services/analyze.ts` or `src/lib/analyzer.ts`. I'll pick a plausible path like `../../services/analyzeService` or similar. But I need to be careful with the relative path from the test file.

Where is the test file? Usually tests are in `__tests__` or `test` folder. The import is `from '../src/routes/api/analyze'`. If the test is at `test/routes/api/analyze.test.ts`, then `../src/routes/api/analyze` is correct. So the test is likely at `test/unit/analyze.test.ts` or similar.

From `test/unit/analyze.test.ts`, `../src/routes/api/analyze` means the test is in `test/unit/`. Then `../../services/...` from the module would be `src/services/...`. But I don't know.

Maybe I should mock dependencies by placing them in the test file and assuming the module imports them. But without knowing the names, this is impossible.

Wait, perhaps the module uses no external deps that need mocking beyond what I can infer. Or perhaps I should mock `express`? No.

Another idea: Maybe the router is a pure middleware that doesn't depend on db/network/fs, but the prompt says to mock them. So I should include mocks for common things even if speculative? That seems wrong.

Let me look at the prompt once more: "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS."

This is a general instruction. If I don't know the deps, I should mock the ones that are most likely used. But I need exact import paths for `jest.mock`.

Actually, I can use `jest.mock` with module names if they are npm packages, e.g., `jest.mock('fs')` or `jest.mock('axios')`. For an analysis route, maybe it uses `fs` to read files, or `openai` to analyze. But I don't know.

Given the extreme lack of information, I think the best approach is to write a test that:
1. Imports the router.
2. Verifies it is a function.
3. Mounts it in a test Express app.
4. Tests that it handles HTTP requests appropriately by assuming standard REST endpoints for an "analyze" resource.
5. Mocks external dependencies using plausible module names or by mocking the global `fs`/`http` if needed.

But I want to be as accurate as possible. Let me think about what `innomcp-node` might be. "innomcp" could be "Inno MCP" - an innovative MCP server. MCP servers expose tools and resources. But this is a "route" in a node module, so it's likely an Express server providing HTTP endpoints for analysis.

Maybe the router handles:
- `POST /api/analyze` - analyze text/code.
- Body: `{ content: string, type: string }`.
- Response: `{ result: string, score: number }`.

I'll go with this assumption and write a comprehensive contract test. I'll mock a service at `../../services/analysis` or similar. Actually, to avoid guessing wrong paths, I can mock a generic package like `axios` or `node-fetch` if it makes network calls, or `fs/promises` if it reads files. But I don't know.

Alternatively, I can structure the test to mock dependencies that are passed via some mechanism I can't see... No.

Let me try a different angle. The user says "Write a Jest CONTRACT/BEHAVIOR test for an innomcp-node module." and gives ONLY `export default router;`. Maybe the test should be extremely generic and only test that the export is a valid router object/function, and that it can be mounted. But then how to satisfy "correct outputs for valid inputs"?

For an Express Router, valid input is an Express app instance to `app.use()`. Output is that the app now has those routes. But testing app.routes is internal.

Actually, with supertest, I can test the HTTP interface. The contract is the HTTP interface. Even though I don't know the exact routes, I can test the router by mounting it and probing it. But I need to know routes to assert values.

Hmm. What if the router is the default export and the contract is simply that it's an Express middleware function? Then:
- Valid input: `(req, res, next)` objects.
- Output: it calls `next()` or modifies `res`.
- Invalid input: calling without proper arguments might throw? No, Express middleware doesn't throw on invalid args usually.

This seems too weak.

Let me reconsider whether there are standard conventions for `routes/api/analyze` in Express apps. Often, such a file would export a router that handles:
- `GET /` -> list analyses
- `POST /` -> create analysis
- `GET /:id` -> get analysis
- `DELETE /:id` -> delete analysis

Given the name "analyze" (verb/noun), it's likely a resource endpoint. I'll assume RESTful CRUD.

For the mocks, since I must mock external deps, and I don't know the exact imports, I'll mock `fs` and a hypothetical database module. But I need the import path. If the module imports `fs`, I can mock `fs`. If it imports `../../db`, I can't know.

Wait, I can use `jest.mock` for built-in modules like `fs` without paths. I'll assume the analyze route reads files or uses a database. But that's a big assumption.

Maybe the prompt is designed such that the module has no other public API, and the test should focus on the fact that it's a router. The "external deps" to mock might be `express` itself? No, that's not external in the db/network/fs sense.

Another thought: Perhaps the module imports `Router` from express and exports the instance. The "external deps" might be none. But the prompt says to mock them. I could mock `express` to return a fake router, but then I'm testing implementation details (that it uses express).

Actually, if I mock `express`, I can verify that the module creates a router and sets up routes. But that's testing implementation, not behavior. The user said "not echo code" and "test observable behavior/contracts".

I think the most defensible approach is:
1. Assume it's an Express Router.
2. Use `supertest` to test it via HTTP.
3. Assume standard REST endpoints for an `analyze` resource.
4. Mock external services using plausible names, or if I must guess paths, I'll use generic service names that are commonly used.

But I really don't know the import paths. Let me think... In many TypeScript projects, routes import services from `src/services`. From `src/routes/api/analyze.ts`, a service might be at `src/services/analyzeService.ts`, imported as `../../services/analyzeService`. So from the test at `test/routes/api/analyze.test.ts`, the mock path would be `../../src/services/analyzeService`? No, `jest.mock` paths are relative to the test file.

If test is at `test/unit/routes/api/analyze.test.ts`, then:
- Module under test: `../../../src/routes/api/analyze`
- Service import from module: `../../services/analyzeService` (from src/routes/api/analyze.ts)
- So from test file, that resolves to `../../../src/services/analyzeService`.

This is too speculative.

Maybe I should write the test without mocking specific unknown modules, but instead mock the global `fs` and `http` modules, and use a generic in-memory database mock. But that's still speculative.

Wait, the user might not care about the exact mock paths and just wants to see the pattern. But strict TS and offline means I need to provide working code.

Let me try to write a test that is as generic as possible while still being a valid contract test for an Express Router default export. I'll assume the router handles `POST /` and `GET /:id`, and I'll mock a service at `../src/services/analyzer` (relative to test file? No, relative to test file would be from test location).

Actually, I can place the test file at `__tests__/routes/api/analyze.test.ts`. Then `../src/routes/api/analyze` is wrong. The import says `from '../src/routes/api/analyze'`. This means the test file is in a directory that is sibling to `src/`, e.g., `tests/` or `test/`. So if the test is at `test/analyze.test.ts`, then `../src/routes/api/analyze` is correct. Then from the module's perspective, imports to services would be like `../../services/...`. From the test file, to mock that, I'd use `../src/services/...`.

Okay, I'll assume the module imports an analysis service from `../src/services/analysisService` (from test perspective) or similar. Actually, from the module `src/routes/api/analyze.ts`, `../../services/analysis` resolves to `src/services/analysis.ts`. From the test file `test/analyze.test.ts`, the path to that service is `../src/services/analysis`. So `jest.mock('../src/services/analysis')` would work if that's what the module imports.

But I don't know if it imports that. However, I have to make some assumption to satisfy the mock requirement. I'll assume it imports a service called `analysisService` from `../src/services/analysisService` (relative to test). Wait, no: from `test/analyze.test.ts`, `../src/services/analysisService` is correct for `src/services/analysisService.ts`.

Alternatively, maybe the route uses a database client imported from `../src/db` or similar.

Given the lack of info, I'll create a mock for a generic `AnalysisService` and comment that it represents the external dependency boundary. But the user wants strict TS and complete code, no comments explaining assumptions? The user said "OUTPUT CONTRACT: ONE ```typescript block, complete test file, nothing else." So no extra comments outside the code block, but comments in code are okay if needed.

Actually, I can avoid guessing specific service paths by mocking built-in Node.js modules that are commonly used. For example, an analyze route might:
- Use `fs` to read files.
- Use `child_process` to run analysis tools.
- Use `https` to call external APIs.

But I don't know which.

Let me reconsider the problem statement. It says "Mock external deps (db/network/fs/other services) deterministically." This might be a general rule, but if there are no external deps in the module, I don't need to mock them. But likely there are.

Given the module is `analyze` and it's a router, I'll assume it performs analysis by calling an external service or using a local analyzer. I'll mock `axios` or `node-fetch` for network, and `fs` for file system. But again, I don't know if it uses them.

Perhaps the best way is to write a test that uses `jest.mock` on a plausible service path, and if the actual module doesn't import it, the mock is harmless? No, `jest.mock` on a path not imported will still create a module in the registry but won't affect the test. But it's misleading.

Wait, I can write the test such that it doesn't need to know internal imports by using `jest.spyOn` or by providing mocks via `__mocks__` directory? No, I need to put it in the test file.

Another idea: Maybe the router is from a framework like Fastify or Koa, not Express. But `router` is a generic term. However, in Node.js with file paths like `routes/api/analyze`, Express is the most common.

Let's assume Express. I'll write a contract test using `supertest` and `express`. I'll mount the router. I'll assume it has a `POST /` endpoint that accepts `{ target: string }` and returns `{ id: string, status: string }`. I'll also assume a `GET /:id` endpoint.

For mocks, I'll mock `fs/promises` and a hypothetical `../src/lib/analyzer` module. But to make it more likely to be correct, I'll mock `fs` since analyzing often involves reading files. And I'll mock `../src/services/analysis` as a generic service.

Actually, I just realized: if the prompt is from a coding interview or test, the expected answer might be to recognize that with only `export default router;`, you can only test that it's a valid Express Router instance. But the prompt explicitly asks for "correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions". This suggests there IS expected behavior to infer.

Maybe the module is not Express but something else? `export default router;` could be a function that takes routing configuration. But no, `router` implies Express.

Let me search my internal knowledge for "innomcp-node". I don't have specific knowledge of this package. It might be a fictional or internal module name. "innomcp" could be "inno mcp" (innovation MCP). MCP (Model Context Protocol) is a protocol by Anthropic. An MCP node module might expose routes for analysis.

In an MCP server, routes might not be Express but HTTP routes handled by the MCP SDK. But the prompt says "router", which is generic.

Given all this, I think I should write a comprehensive Express router contract test with the following assumptions clearly implemented:
- It's an Express Router.
- It exposes `POST /` to create an analysis.
- It exposes `GET /:id` to retrieve results.
- It validates input (returns 400 for bad input).
- It returns 404 for unknown IDs.
- It uses external services that I mock.

To handle the mock path issue, I'll mock a service at a path relative to the module under test. Since the module is at `../src/routes/api/analyze`, I'll assume it imports `../../services/analyzeEngine` which from test perspective is `../src/services/analyzeEngine`. I'll create that mock.

Wait, but if I mock `../src/services/analyzeEngine`, and the module doesn't import it, the test will still run but the mock won't be used. That's fine, it just means I mocked a potential dependency. But the user said "Mock external deps". If the module has no external deps, mocking is unnecessary. But to satisfy the prompt, I'll include mocks for commonly expected deps.

Actually, I can write the test to be robust by mocking the module's entire environment. But that's overkill.

Let me try to write the test with the following structure:
1. Mock external deps (fs, a service module).
2. Import router.
3. Create Express app, mount router at `/api/analyze`.
4. Test `POST /api/analyze`:
   - Valid input: returns 200/201 with analysis result.
   - Invalid input (missing body): returns 400.
   - Boundary: empty body, large payload.
5. Test `GET /api/analyze/:id`:
   - Valid ID: returns result.
   - Invalid ID: returns 404.
6. Test that router is a function.

For TypeScript strictness, I'll need types. I'll use `@types/jest`, `@types/express`, `@types/supertest`.

Here's the plan for the code:

```typescript
import request from 'supertest';
import express, { Application } from 'express';
import router from '../src/routes/api/analyze';

// Mock external deps
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('mocked file content'),
    access: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/analyzeEngine', () => ({
  analyze: jest.fn().mockResolvedValue({ score: 95, findings: [] }),
  getAnalysis: jest.fn().mockResolvedValue({ id: 'abc-123', status: 'complete', result: { score: 95 } }),
}));

// Import mocked modules to control them
import { analyze, getAnalysis } from '../src/services/analyzeEngine';
import fs from 'fs';

describe('analyze router contract', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analyze', router);
    jest.clearAllMocks();
  });

  describe('default export', () => {
    it('should be a function (middleware/router)', () => {
      expect(typeof router).toBe('function');
    });
  });

  describe('POST /api/analyze', () => {
    it('should accept valid payload and return analysis result', async () => {
      const payload = { target: 'codebase', rules: ['security'] };
      (analyze as jest.Mock).mockResolvedValue({ id: 'uuid-1', status: 'pending', result: { score: 95 } });

      const res = await request(app)
        .post('/api/analyze')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(202); // or 201

      expect(res.body).toEqual({ id: 'uuid-1', status: 'pending', result: { score: 95 } });
      expect(analyze).toHaveBeenCalledWith(expect.objectContaining(payload));
    });

    it('should reject invalid payload with 400', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(400);

      expect(res.body).toEqual(expect.objectContaining({
        error: expect.any(String),
      }));
    });

    it('should throw/return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ rules: [] })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('should handle boundary maximum payload size gracefully', async () => {
      const hugePayload = { target: 'x'.repeat(10 * 1024 * 1024) };
      const res = await request(app)
        .post('/api/analyze')
        .send(hugePayload)
        .expect(413); // Payload Too Large - or whatever the contract is
      // Actually, Express default body parser might handle this. But contract might specify.
      // I'll assert that it doesn't crash and returns an error status.
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/analyze/:id', () => {
    it('should return analysis for valid ID', async () => {
      (getAnalysis as jest.Mock).mockResolvedValue({ id: 'abc-123', status: 'complete', result: { score: 95 } });

      const res = await request(app)
        .get('/api/analyze/abc-123')
        .expect(200);

      expect(res.body).toEqual({ id: 'abc-123', status: 'complete', result: { score: 95 } });
      expect(getAnalysis).toHaveBeenCalledWith('abc-123');
    });

    it('should return 404 for non-existent ID', async () => {
      (getAnalysis as jest.Mock).mockRejectedValue(new Error('Not found'));

      const res = await request(app)
        .get('/api/analyze/missing-id')
        .expect(404);

      expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await request(app)
        .get('/api/analyze/invalid%20id%20with%20spaces')
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('mounting contract', () => {
    it('should not throw when mounted in an Express app', () => {
      const testApp = express();
      expect(() => testApp.use('/api/analyze', router)).not.toThrow();
    });
  });
});
```

But I need to make sure the TypeScript is strict. I should avoid `any` where possible. Also, I need to ensure the mock paths are correct.

Wait, the user said "Import EXACTLY: import ... from '../src/routes/api/analyze';". So I must use that exact import line. I can import `router` as default.

Also, "OUTPUT CONTRACT: ONE ```typescript block, complete test file, nothing else."

So I should output only the code block.

Let me refine the mocks. Since I don't know the actual service names, maybe I should mock `fs` and `path` which are built-in and commonly used. But will the test still be meaningful? If the router doesn't use `fs`, the mocks are unused but harmless.

However, to make the test actually test behavior, I need the mocks to affect the module. If I mock the wrong thing, the module will use the real implementation and the test might fail or be non-deterministic.

Given the constraints, I think the best approach is to assume the module uses a service layer pattern common in Express apps. I'll mock a service at `../src/services/analyze` (relative to test file). This is a reasonable guess.

But actually, from `src/routes/api/analyze.ts`, to reach `src/services/analyze.ts`, the import is `../../services/analyze`. From the test file (let's say `test/analyze.test.ts`), the path is `../src/services/analyze`. So `jest.mock('../src/services/analyze')` is correct.

I'll
