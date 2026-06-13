<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S043 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":188,"completion_tokens":7000,"total_tokens":7188,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 88s
 generated: 2026-06-13T11:32:59.903Z -->
The user wants a Jest contract/behavior test for a module located at `../src/routes/api/admin/sessions`. The only public API surface given is `export default sessionsRouter;`.

This is an Express router (implied by the name `sessionsRouter` and the path `routes/api/admin/sessions`). Since it's a router, it likely exports an Express Router instance that defines routes for managing admin sessions.

However, I don't have the actual implementation or even the specific route signatures (GET, POST, etc.). I need to infer the contract based on:
1. The module name: `sessions` in `admin` context
2. The export: `sessionsRouter` (default export)
3. Common patterns for admin session management APIs

Since I must test the contract implied by names and signatures, and the only signature is `export default sessionsRouter`, I need to treat this as an Express Router and test its mounted routes behavior.

But wait - the user says "Test observable behavior/contracts implied by the names+signatures". With only `export default sessionsRouter`, I need to make reasonable assumptions about what an admin sessions router would do, while keeping it generic enough that it tests the contract of a router.

Actually, looking more carefully: this is likely an Express Router. The contract would be:
- It's a valid Router instance
- It handles specific HTTP methods/paths
- It interacts with session storage (database)
- It returns proper HTTP status codes and JSON responses

But I need to be careful. The user wants strict TS, deterministic mocks, offline testing, asserting values/state.

Let me think about what routes an admin sessions module would typically have:
- `GET /` - list all active sessions (admin view)
- `GET /:id` - get specific session details
- `DELETE /:id` - terminate/revoke a specific session
- `DELETE /` - bulk terminate sessions or terminate all? Maybe not.

Since I don't know the exact routes, I should test the router as a black box by mounting it in an Express app and using supertest? But the rules say "Mock external deps (db/network/fs/other services) deterministically. Offline."

Wait, if I use supertest, that's more of an integration test. But I can mount the router in a test Express app and make requests to it.

However, the user says "Import EXACTLY: import ... from '../src/routes/api/admin/sessions'". So I need to import the default export.

Let me reconsider. Maybe the module exports an Express Router, and I should test it by:
1. Verifying it's a Router instance
2. Testing the routes it handles by invoking them through a test app

But without knowing the exact routes, I have to infer standard REST conventions for admin sessions.

Actually, looking at the path `routes/api/admin/sessions`, this is almost certainly an Express Router that handles:
- `GET /` → list sessions
- `DELETE /:id` → delete/terminate a session

For an admin sessions endpoint, common behavior:
- Authentication/authorization middleware might be applied, but since it's a router export, maybe that's mounted upstream.
- Returns JSON array of session objects
- Returns 404 for non-existent session IDs
- Returns 204 or 200 on deletion
- Validates UUIDs or numeric IDs

Since I must mock external deps, I'd need to mock the database layer that the router uses. But I don't know what the router imports. However, I can infer it likely uses a database or session store.

Wait, I need to be more careful. The user says "Mock external deps (db/network/fs/other services) deterministically." If I don't know what the router imports, how can I mock it?

In Jest, I can mock modules that are likely imported by the router. But I don't know the exact paths. This is tricky.

Alternative approach: Since the only export is the router, and I need to test it as a black box, perhaps I should:
- Import the router
- Create an Express app in the test
- Mount the router at `/admin/sessions`
- Use supertest to hit endpoints
- Mock the database module that the routes likely import

But I don't know what database module they import. Common patterns in Node apps:
- `import db from '../../../db';`
- `import { pool } from '../../../db';`
- `import Session from '../../../models/Session';`

Since I don't know, I have to make educated guesses or mock at a higher level. But Jest manual mocks require knowing the module path.

Hmm. Let me think differently. Maybe the router is a simple Express Router and I can test it by:
1. Checking it's a function (Express Router is a function)
2. Checking it has the methods of a router (`.get`, `.post`, etc.)
3. But that's testing implementation details (the fact it uses Express), not behavior.

Actually, the best approach for contract testing a router when we don't know the exact routes is to test it as middleware and verify it handles requests appropriately. But I still need to know the routes.

Let me reconsider the problem. The user says "You are given ONLY its public API surface (signatures), NOT the implementation — so you must test the CONTRACT (intended behavior), not echo code."

Given the path `routes/api/admin/sessions` and name `sessionsRouter`, the contract is:
- It's an Express Router handling session administration
- It supports operations on admin sessions resource

Maybe I should assume standard REST routes and test those. If the implementation differs, the contract test would fail, which is the point of contract testing.

But I need to be able to write a test that compiles and makes sense. Let me assume the following REST contract:
- `GET /` returns array of sessions (200)
- `GET /:id` returns a session (200) or 404
- `DELETE /:id` terminates a session (204/200) or 404

For mocking, I'll assume the router imports a database module from a relative path like `../../../db` or similar. But I don't know the exact path.

Wait - maybe I can mock `express` itself? No, that doesn't make sense.

Another idea: Maybe the module doesn't import db directly but uses a repository/service pattern. But again, I don't know the import path.

Perhaps I should write the test using `supertest` and mock the database at a global level, or use jest.mock with a path that is a reasonable guess, OR I can structure the test such that it works regardless by using a test database? No, the rules say "Offline" and "Mock external deps".

Let me look at the import path again: `../src/routes/api/admin/sessions`. The test file would likely be at `__tests__` or similar. The router might import db from `../../../../db` or `../../../services/sessionService`.

Actually, I think the most robust approach is to assume the router uses some external service that I can mock by intercepting at the route level. But that's hard.

Wait - I can test an Express Router without supertest by directly calling the route handlers? No, I don't have access to them.

Let me think about this more carefully. The user wants a "Jest CONTRACT/BEHAVIOR test". In contract testing, especially for a router, we can verify:
1. The exported default is a valid Express Router (has use/get/post/delete methods, is a function)
2. When mounted and requests are made, it produces expected responses

But to make requests, I need an app. I can create an Express app, mount the router, and use node-mocks-http or supertest. Supertest is standard.

For mocking external deps without knowing exact import paths, I have a few options:
- Mock `../../../db` or similar relative path - risky because path might be wrong
- Mock a likely service name

But actually, since this is a hypothetical exercise and I need to output a complete test file, I should make reasonable assumptions about the architecture and mock accordingly. The key is that the test demonstrates contract testing principles.

Let me assume the router imports a session service or database client. A very common pattern is:
```typescript
import { Router } from 'express';
import { getSessions, getSessionById, deleteSession } from '../../../services/sessionService';
// or
import db from '../../../db';
```

I think the safest assumption is that there's a database pool/client imported. But to make the test deterministic and offline, I'll mock it.

Actually, looking at the module path `src/routes/api/admin/sessions`, from the test file at `__tests__/routes/api/admin/sessions.test.ts`, the relative path to src root would be `../../../src/...`. But the import is `../src/routes/api/admin/sessions`.

Wait, the import says `import ... from '../src/routes/api/admin/sessions';`. So the test file is likely at the project root or in a sibling directory. If the test is at `test/file.test.ts`, then `../src/...` goes up one level to project root, then into src.

Given the router is at `src/routes/api/admin/sessions.ts`, it might import:
- `../../../db` (from src/routes/api/admin/ up to src/)
- `../../../services/sessionService`
- `../../../models/Session`

I'll mock `../../../services/sessionService` or similar. But I need to pick something.

Actually, for an admin sessions router, the most likely contract is:
- `GET /` → list all active sessions (returns JSON array)
- `GET /:sessionId` → get session details (returns JSON object or 404)
- `DELETE /:sessionId` → revoke/terminate session (returns 204 or 404)

I'll write the test using supertest, create an express app, mount the router at `/`, and test these endpoints. I'll mock the database/service layer.

Since I must use strict TS, I'll need type annotations.

Let me draft the mock. I'll assume the router imports from `../../../services/sessionService` but that's 4 levels up from `src/routes/api/admin/sessions.ts`? Let's count:
- `src/routes/api/admin/sessions.ts` 
- to `src/` is `../../../`
- So `../../../services/sessionService` would be `src/services/sessionService.ts`.

Yes, that's reasonable.

Actually, to be more generic and avoid wrong path issues in this hypothetical, maybe I should mock `../../../db` or use a more generic mock. But I think `../../../services/sessionService` is a good guess.

Alternatively, I can mock `express`? No.

Let me reconsider whether supertest is the right approach. The user says "Mock external deps (db/network/fs/other services) deterministically. Offline." Supertest doesn't hit the network if used with an express app directly (it just calls the handler), so it's offline.

But I still need to mock the database.

Let me think about what the contract of an admin sessions API should be:
1. **List sessions**: `GET /` should return `200 OK` with an array of session objects. Each session should have at least `id`, `userId`, `createdAt`, `expiresAt` or similar fields.
2. **Get session**: `GET /:id` should return `200 OK` with a session object if found, `404 Not Found` if not found.
3. **Delete session**: `DELETE /:id` should return `204 No Content` on success, `404 Not Found` if not found.
4. **Invalid ID format**: Should return `400 Bad Request` or `404` depending on contract.

Since I don't know the exact field names, I should keep it somewhat generic but assert on the structure.

Wait, the user says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So I need to assert the actual response body, status codes, etc.

Let me write a comprehensive test file. I'll assume the router uses a service module. If the actual implementation uses a different import path, this is a contract test so the mock path represents the assumed dependency boundary.

Actually, I just realized: since I don't know the internal imports, maybe I should mock at the level of the router's own module by using jest.mock on a hypothetical dependency, OR I can structure the test to not need to know the exact internal imports by using a more integration-style approach with an in-memory mock database.

But the instructions say "Mock external deps (db/network/fs/other services) deterministically."

I think the best approach is to assume standard Express patterns and mock a session service. I'll make the mock path relative to the test file location. Since the test imports `../src/routes/api/admin/sessions`, and if the test is at `test/unit/sessions.test.ts`, then the router is at `../src/routes/api/admin/sessions.ts`. The router might import db from `../../../db` relative to its own location, which from the test's perspective would be `../../src/db`? No, let's not overcomplicate.

Actually, Jest mocks are resolved relative to the test file. So if I do `jest.mock('../../src/services/sessionService')`, that assumes the test is one level deep. But I don't know the test file location.

Hmm, the import is `import sessionsRouter from '../src/routes/api/admin/sessions';`. This means the test file is in a directory sibling to `src`, or in a subdirectory where `../src/` resolves correctly. For example, if the test is at `tests/admin/sessions.test.ts`, then `../src/` goes up to parent, then into src. Wait:
- `tests/admin/sessions.test.ts` → `../src/routes/api/admin/sessions` = `tests/src/routes...` No.
- If test is at `test/sessions.test.ts` (in a `test` folder at root), then `../src/` goes up to root, then into src. Yes! So test is likely at `<root>/test/*.test.ts` or `<root>/tests/*.test.ts`.

From `src/routes/api/admin/sessions.ts`, a relative import to `src/services/sessionService.ts` would be `../../../services/sessionService`.
From the test file at `<root>/test/sessions.test.ts`, that same module would be at `../src/services/sessionService`, so `jest.mock('../src/services/sessionService')`.

Yes! That makes sense. The test is at `<root>/test/...` and mocks `../src/services/sessionService`.

Let me verify:
- Test file: `/project/test/sessions.test.ts`
- Import target: `/project/src/routes/api/admin/sessions.ts` (via `../src/routes/api/admin/sessions`)
- Mock target: `/project/src/services/sessionService.ts` (via `../src/services/sessionService`)

This is a very reasonable architectural assumption.

Now, what should the session service export? Likely functions like `findSessions`, `findSessionById`, `deleteSession`.

Let me write the test:

```typescript
import request from 'supertest';
import express, { Application } from 'express';
import sessionsRouter from '../src/routes/api/admin/sessions';

// Mock the session service
jest.mock('../src/services/sessionService', () => ({
  findSessions: jest.fn(),
  findSessionById: jest.fn(),
  deleteSession: jest.fn(),
}));

import * as sessionService from '../src/services/sessionService';

const mockedFindSessions = sessionService.findSessions as jest.MockedFunction<typeof sessionService.findSessions>;
const mockedFindSessionById = sessionService.findSessionById as jest.MockedFunction<typeof sessionService.findSessionById>;
const mockedDeleteSession = sessionService.deleteSession as jest.MockedFunction<typeof sessionService.deleteSession>;

describe('sessionsRouter', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/admin/sessions', sessionsRouter);
    jest.clearAllMocks();
  });

  describe('GET /admin/sessions', () => {
    it('returns 200 and an array of sessions on success', async () => {
      const mockSessions = [
        { id: 'sess-1', userId: 'user-1', createdAt: '2024-01-01T00:00:00Z', expiresAt: '2024-01-02T00:00:00Z' },
        { id: 'sess-2', userId: 'user-2', createdAt: '2024-01-01T12:00:00Z', expiresAt: '2024-01-02T12:00:00Z' },
      ];
      mockedFindSessions.mockResolvedValue(mockSessions);

      const response = await request(app).get('/admin/sessions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSessions);
      expect(mockedFindSessions).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when the service throws', async () => {
      mockedFindSessions.mockRejectedValue(new Error('DB failure'));

      const response = await request(app).get('/admin/sessions');

      expect(response.status).toBe(500);
      // Or whatever the contract is - maybe 500, maybe the error propagates
    });
  });

  describe('GET /admin/sessions/:id', () => {
    it('returns 200 and the session when found', async () => {
      const mockSession = { id: 'sess-1', userId: 'user-1', createdAt: '2024-01-01T00:00:00Z', expiresAt: '2024-01-02T00:00:00Z' };
      mockedFindSessionById.mockResolvedValue(mockSession);

      const response = await request(app).get('/admin/sessions/sess-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSession);
      expect(mockedFindSessionById).toHaveBeenCalledWith('sess-1');
    });

    it('returns 404 when session is not found', async () => {
      mockedFindSessionById.mockResolvedValue(null);

      const response = await request(app).get('/admin/sessions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Session not found' }); // or whatever contract
    });
  });

  describe('DELETE /admin/sessions/:id', () => {
    it('returns 204 when session is deleted', async () => {
      mockedDeleteSession.mockResolvedValue(true); // or undefined

      const response = await request(app).delete('/admin/sessions/sess-1');

      expect(response.status).toBe(204);
      expect(mockedDeleteSession).toHaveBeenCalledWith('sess-1');
    });

    it('returns 404 when session to delete is not found', async () => {
      mockedDeleteSession.mockResolvedValue(false); // or throws

      const response = await request(app).delete('/admin/sessions/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});
```

Wait, I need to be careful. The user said "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So asserting `toHaveBeenCalledTimes` is mock assertion. I should minimize that and focus on response values. But verifying that the service was called with the correct ID is actually part of the contract (the router must pass the ID through). However, the user said "not just that mocks were called", so I should primarily assert on the output state/values.

Also, I need to consider: does the router have authentication middleware? Since it's an admin router, probably, but that might be mounted upstream. The contract of this specific router might just be the resource management.

But I have a problem: I don't actually know if the routes are `/`, `/:id`, etc. Since it's a router exported to be mounted, the paths inside the router are likely relative. If mounted at `/api/admin/sessions`, then inside the router:
- `GET /` lists sessions
- `GET /:id` gets one
- `DELETE /:id` deletes one

In my test, I mounted it at `/admin/sessions`, so the paths would be `/admin/sessions` and `/admin/sessions/:id`. But if the router itself defines `/api/admin/sessions` paths internally, that would be wrong. Usually routers define relative paths.

Actually, looking at the file path `routes/api/admin/sessions.ts`, this is likely the router that IS mounted at `/api/admin/sessions`, so inside it should use `/` for list and `/:id` for individual. So in my test, if I mount it at `/`, then `/` should list, and `/:id` should get one. But wait, if I mount it at `/`, I'm not testing how it's actually mounted in the real app.

Better approach: mount it at `/` since it's a router, and test `/` and `/:id`. That tests the router's internal contract regardless of where it's mounted.

```typescript
app.use('/', sessionsRouter);
// then GET / and GET /:id
```

Yes, that's cleaner.

Now, what about the service mock? I need to make sure the TypeScript types work. Since I'm mocking `../src/services/sessionService`, I need to define what it exports.

Let me refine the mock to be type-safe. I'll define a mock module.

Actually, for strict TS, I should probably define the mock in a way that TypeScript understands. Using `jest.mock` with a factory function is good, but the imported types might be tricky.

Let me write a cleaner version:

```typescript
import request from 'supertest';
import express, { Application } from 'express';
import sessionsRouter from '../src/routes/api/admin/sessions';

jest.mock('../src/services/sessionService');

import {
  findSessions,
  findSessionById,
  deleteSession,
} from '../src/services/sessionService';

const mockedFindSessions = findSessions as jest.Mock;
const mockedFindSessionById = findSessionById as jest.Mock;
const mockedDeleteSession = deleteSession as jest.Mock;
```

Wait, `jest.Mock` is generic. Better to use `jest.MockedFunction`.

Actually, since I don't know the actual types of the service functions, I should define them inline in the mock or cast carefully.

Let me think about the contract more carefully. An admin sessions router should:
1. Export a valid Express Router (middleware function)
2. Handle GET / by returning all sessions
3. Handle GET /:id by returning a specific session or 404
4. Handle DELETE /:id by removing a session or returning 404
5. Handle invalid inputs appropriately (malformed IDs should probably 400 or 404)

For boundary conditions:
- Empty array should return 200 [] (not 404)
- Very long ID should still work
- Special characters in ID should be handled (URL encoded)

Let me also consider that the router might use `req.params.id` and pass it to the service.

One issue: I don't know if the router sends 404 as JSON `{ error: 'Not found' }` or just empty body. In contract testing, I should probably assert the status and a reasonable body structure, or at least the status. But the user wants to assert values.

Maybe I should keep the response body assertions somewhat generic but strict about status, and for the body assert it's an array/object of expected shape.

Actually, since this is a contract test and I don't know the exact shape, I should define the expected contract explicitly in the test. The contract is: the router returns HTTP responses consistent with REST semantics.

Let me reconsider whether supertest is necessary. Could I test the router directly as middleware?

```typescript
import sessionsRouter from '../src/routes/api/admin/sessions';
import { Router } from 'express';

it('should be an Express Router', () => {
  expect(typeof sessionsRouter).toBe('function');
  expect(sessionsRouter).toHaveProperty('get');
  expect(sessionsRouter).toHaveProperty('post');
});
```

But that's testing implementation (that it uses Express), not behavior. The behavior is about handling HTTP requests.

So supertest approach is better.

Now, let me think about what dependencies to mock. Since I don't know the exact imports, maybe I should mock a database module at `../src/db` or `../src/lib/db`. But `services/sessionService` is more likely to be the direct dependency.

Actually, to make this robust and not depend on guessing the exact service name, I could mock `../src/db` which is more likely to be a generic database module. But a router importing db directly is less common than importing a service.

Hmm. Another option: I can write the test assuming the router uses a repository pattern, and I'll mock `../src/repositories/sessionRepository`. But again, it's a guess.

I think `../src/services/sessionService` is the most standard name. I'll go with that.

Wait, I should also consider that the module might not use supertest-friendly patterns. But supertest is the standard for testing Express routers.

Let me draft the complete file:

```typescript
import request from 'supertest';
import express, { Application } from 'express';
import sessionsRouter from '../src/routes/api/admin/sessions';

jest.mock('../src/services/sessionService', () => ({
  findSessions: jest.fn(),
  findSessionById: jest.fn(),
  deleteSession: jest.fn(),
}));

import {
  findSessions,
  findSessionById,
  deleteSession,
} from '../src/services/sessionService';

const mockedFindSessions = findSessions as jest.MockedFunction<typeof findSessions>;
const mockedFindSessionById = findSessionById as jest.MockedFunction<typeof findSessionById>;
const mockedDeleteSession = deleteSession as jest.MockedFunction<typeof deleteSession>;

describe('sessionsRouter contract', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', sessionsRouter);
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns 200 and an empty array when no sessions exist', async () => {
      mockedFindSessions.mockResolvedValue([]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 200 and an array of session objects for valid data', async () => {
      const sessions = [
        { id: 'abc-123', userId: 'user-1', ip: '127.0.0.1', createdAt: '2024-01-15T10:00:00Z' },
        { id: 'def-456', userId: 'user-2', ip: '127.0.0.1', createdAt: '2024-01-15T11:00:00Z' },
      ];
      mockedFindSessions.mockResolvedValue(sessions);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(sessions);
    });

    it('returns 500 when the service throws an unexpected error', async () => {
      mockedFindSessions.mockRejectedValue(new Error('database unavailable'));

      const res = await request(app).get('/');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /:id', () => {
    it('returns 200 and the session object for an existing id', async () => {
      const session = { id: 'abc-123', userId: 'admin-1', ip: '192.168.1.1', createdAt: '2024-01-15T10:00:00Z' };
      mockedFindSessionById.mockResolvedValue(session);

      const res = await request(app).get('/abc-123');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(session);
    });

    it('returns 404 when the session does not exist', async () => {
      mockedFindSessionById.mockResolvedValue(null);

      const res = await request(app).get('/missing-id');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('returns 204 when the session is successfully terminated', async () => {
      mockedDeleteSession.mockResolvedValue(true);

      const res = await request(app).delete('/abc-123');

      expect(res.status).toBe(204);
    });

    it('returns 404 when attempting to terminate a non-existent session', async () => {
      mockedDeleteSession.mockResolvedValue(false);

      const res = await request(app).delete('/missing-id');

      expect(res.status).toBe(404);
    });
  });
});
```

This looks pretty good. But I need to make sure TypeScript is happy. The `jest.MockedFunction` requires knowing the function signatures. Since I'm defining the mock factory, TypeScript might infer `findSessions` as `jest.Mock<any, any>`.

Actually, when using `jest.mock` with a factory, the imported functions will have type `jest.Mock<any, any>` if not properly typed. To make it strict, I should define interfaces.

Let me add explicit typing:

```typescript
interface Session {
  id: string;
  userId: string;
  ip: string;
  createdAt: string;
}

// In the mock factory, type the functions
jest.mock('../src/services/sessionService', () => ({
  findSessions: jest.fn<Promise<Session[]>, []>(),
  findSessionById: jest.fn<Promise<Session | null>, [string]>(),
  deleteSession: jest.fn<Promise<boolean>, [string]>(),
}));
```

Wait, `jest.mock` hoisting can be tricky with TypeScript. The factory function runs before imports. But since I'm importing after jest.mock, it should be fine.

Actually, a cleaner pattern for strict TS is:

```typescript
jest.mock('../src/services/sessionService');

const mockedFindSessions = findSessions as unknown as jest.MockedFunction<() => Promise<Session[]>>;
```

But that's ugly.

Alternatively, I can define the mock module interface:

```typescript
const mockFindSessions = jest.fn<Promise<any[]>, []>();
const mockFindSessionById = jest.fn<Promise<any | null>, [string]>();
const mockDeleteSession = jest.fn<Promise<boolean>, [string]>();

jest.mock('../src/services/sessionService', () => ({
  findSessions: (...args: any[]) => mockFindSessions(...args),
  findSessionById: (...args: any[]) => mockFindSessionById(...args),
  deleteSession: (...args: any[]) => mockDeleteSession(...args),
}));
```

But `jest.mock` is hoisted, so `mockFindSessions` would not be in scope if defined before it? Actually variables declared with `const` in the module scope are in scope for the hoisted `jest.mock` factory? No, `jest.mock` factories can reference variables in the outer scope ONLY if they are declared with `var` or function declarations, because of hoisting. `const` and `let` are not hoisted and will be in the temporal dead zone.

So this pattern won't work well.

Better approach: Use `jest.mock` with a simple factory, then cast the imported functions.

```typescript
jest.mock('../src/services/sessionService', () => ({
  findSessions: jest.fn(),
  findSessionById: jest.fn(),
  deleteSession: jest.fn(),
}));

import * as sessionService from '../src/services/sessionService';

const mockedFindSessions = sessionService.findSessions as jest.MockedFunction<() => Promise<any[]>>;
const mockedFindSessionById = sessionService.findSessionById as jest.MockedFunction<(id: string) => Promise<any | null>>;
const mockedDeleteSession = sessionService.deleteSession as jest.MockedFunction<(id: string) => Promise<boolean>>;
```

This is clean and type-safe enough.

Now, one more consideration: the user said "Test observable behavior/contracts implied by the names+signatures: correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions."

I should add tests for boundary conditions:
- Invalid ID formats (if the contract includes validation)
- Empty string ID
- Very large payload? Not applicable for GET/DELETE.

For an admin sessions router, invalid inputs might include:
- `GET /` with query params? Maybe not.
- `DELETE /` (without ID) - should return 404 because no route matches, or maybe the router handles it differently.

Actually, if the router only has `DELETE /:id`, then `DELETE /` would return 404 by Express default. That's a boundary condition worth testing? Maybe not, since it's more Express behavior than the router's contract.

But testing `GET /:id` with empty string might be good: `GET /` is the list route, so `GET /%20` or similar.

Let me add a test for invalid/malformed ID if the contract implies validation. But I don't know if it does. I'll keep it simple and focus on the core contract.

Wait, I should also consider that the router might handle `POST` or `PUT` to create/update sessions. But "sessions" are usually created by login (auth router
