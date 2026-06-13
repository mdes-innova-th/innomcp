<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S063 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":195,"completion_tokens":7000,"total_tokens":7195,"prompt_tokens_details":{"cached_tokens":73,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T11:39:22.503Z -->
The user wants a Jest contract/behavior test for a module called `motherInbox` located at `../src/routes/api/motherInbox`.

The public API surface provided is extremely minimal:
```typescript
interface InboxMessage {
export default router;
```

Wait, that's incomplete. It says `interface InboxMessage {` and then `export default router;`. This implies it's an Express router (or similar) that handles inbox-related routes. Since it's a router exported as default, the contract is likely HTTP endpoints/routes.

Given the name `motherInbox` and the interface `InboxMessage`, I need to infer what this router does. It's likely an Express router that:
- Handles GET / (list messages)
- Handles GET /:id (get specific message)
- Handles POST / (create message)
- Handles PATCH /:id (update/read status)
- Handles DELETE /:id (delete message)

But I must be careful: I only have the public API surface signatures. The user gave:
```typescript
interface InboxMessage {
export default router;
```

This is ambiguous. However, the instruction says: "Test observable behavior/contracts implied by the names+signatures". The name `motherInbox` suggests a central inbox. The export is a default router. So I should test it as an Express router mounted at some path.

But how to test an Express router in Jest without implementation? I need to import the router, mount it in a test app, and make requests using supertest. I need to mock external dependencies like database or network.

Since I don't know the exact routes, I must infer the most logical contract for an inbox API:
- `GET /` -> returns list of `InboxMessage[]`
- `GET /:id` -> returns `InboxMessage` or 404
- `POST /` -> creates a message, returns `InboxMessage` with id
- `PATCH /:id` -> updates (e.g., mark as read), returns updated `InboxMessage`
- `DELETE /:id` -> deletes, returns 204

But wait, the user said "Import EXACTLY: import ... from '../src/routes/api/motherInbox';". So I need to use that exact import path. And I need to mock external deps deterministically.

Also, the user said "Strict TS". So the output must be TypeScript.

Since I don't have the actual implementation, I need to write a test that assumes the router is an Express Router and tests the contract based on the name `motherInbox` and the partial interface `InboxMessage`.

However, I need to be careful not to over-specify. But the user wants a complete test file. I should define the `InboxMessage` interface fully in the test (or assume it's imported) and test the router.

Wait, the prompt says: "Module: motherInbox — public API surface: ```typescript interface InboxMessage { export default router; ```". This looks like a truncated snippet. Maybe the actual interface has fields, but it's cut off. I need to infer reasonable fields for an inbox message: `id`, `subject`, `body`, `sender`, `recipient`, `read`, `createdAt`, etc.

Given the strict rules, I should:
1. Import the router exactly as specified.
2. Use `supertest` to test the router.
3. Mock external dependencies (like a DB service) using `jest.mock`.
4. Assert on values/state (status codes, response bodies).
5. Test boundary conditions and error cases.

But there's a problem: if I import the router, and it has external deps, I need to mock them. Since I don't know the exact deps, I should mock common ones like a database module or service that the router likely imports. But I don't know the path. Hmm.

Alternative approach: Since the prompt is a bit of a "creative test" where I must infer the contract from the name and minimal signature, I should write a test that is as generic as possible but still concrete. I can mock a hypothetical service module that the router would use, but I need to pick a plausible path.

Wait, maybe the module is not an Express router but something else? `export default router;` strongly suggests Express Router or similar.

Let me think about how to structure this:

```typescript
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import router from '../src/routes/api/motherInbox';
import type { InboxMessage } from '../src/routes/api/motherInbox'; // but the prompt says import exactly from that path, maybe I can import type separately? Or just import router and define my own type for testing.

// Mock external deps
jest.mock('../src/services/inboxService', () => ({
  getMessages: jest.fn(),
  getMessageById: jest.fn(),
  createMessage: jest.fn(),
  updateMessage: jest.fn(),
  deleteMessage: jest.fn(),
}));
```

But I don't know if `../src/services/inboxService` exists. The prompt says "Mock external deps (db/network/fs/other services) deterministically." Since I don't know the exact paths, I should mock at a level that is plausible. However, to make the test compile and be self-contained, I might need to mock the dependencies that the router imports. But without knowing them, I risk having broken imports.

Another approach: The prompt might be expecting me to treat the router as a black box and mock the underlying database/network using `nock` or by mocking `express`? No, that's not right.

Perhaps the module exports an Express router, and I should test it by mounting it and using supertest. For external deps, since I don't know what they are, I can mock a generic database client or assume the router uses a service that I can mock via a manual mock file or by mocking a specific module path that is conventional.

But the prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline." So I need to show that I'm mocking something.

Given the ambiguity, I will assume the router imports a service from a sibling path like `../../services/motherInboxService` or similar. But to be safe, I can mock `../src/db` or `../src/services/inbox`. However, if the actual implementation doesn't import these, the test might fail at runtime due to jest.mock trying to mock a non-existent module. Jest allows mocking non-existent modules? No, it usually warns or fails if the module cannot be found.

Wait, in Jest, `jest.mock` on a non-existent module might fail. So I need to be careful.

Alternative: I can mock the entire `../src/routes/api/motherInbox` module? No, I'm testing it.

Another idea: Maybe the module is a simple function that returns a router? No, `export default router;`.

Let's reconsider the prompt. It says: "Write a Jest CONTRACT/BEHAVIOR test for an innomcp-node module." "innomcp-node" might be a typo for "npm-node"? Or "innomcp" is a specific project? It might be a hypothetical scenario where I must infer the contract.

Given the extreme minimalism, perhaps the expected answer is to write a test that defines the contract based on the name `motherInbox` and the `InboxMessage` interface, using supertest, and mocking dependencies via a manual injection or by assuming the router uses a database pool that can be mocked.

But to make it compile without knowing the exact dependency paths, I can use a trick: mock `fs` or `http` or create a mock database client that is passed via environment? No.

Actually, I can write the test such that it creates an Express app, mounts the router, and then uses `jest.spyOn` or mocks the global `fetch` if it uses that. But an Express router likely uses a database.

Wait, maybe the router doesn't directly import external deps but uses them via request app locals? That's possible but unlikely.

Let's think about what a "contract test" means in this context. It means testing the behavior that the API promises. Since the only signature is `export default router`, the contract is the HTTP interface. So I should test:
- The router handles certain paths.
- It returns JSON.
- It returns correct status codes.
- It validates input.

To avoid needing to know the exact internal dependency paths, I can mock at the network boundary if the router makes outbound calls, or I can mock the database driver if I assume a standard one. But the safest is to mock a plausible service module and note that it's a mock. However, the prompt requires strict TS and a complete test file.

Perhaps I can structure the test to mock `../src/lib/db` or similar, and if the actual module doesn't use it, the mock is harmless? No, Jest will throw if the module doesn't exist.

But in many Jest setups, you can mock a module that doesn't exist? Let's recall: Jest's module resolution will try to find the module. If it doesn't exist, `jest.mock` might not throw immediately, but the import in the source code would throw if it tried to import it. Wait, the source code imports what it imports. If I mock a module that the source doesn't import, it's irrelevant. If the source imports a module that I don't mock, the test might hit the real implementation.

Since I don't know the source imports, I have to make an educated guess or write the test in a way that doesn't depend on the exact internal paths.

One robust approach: Use `supertest` and test the router as a black box. If the router uses a database, I can mock the database by assuming the router imports a specific service, but I can also just let the test fail if the real database isn't there? No, the prompt says "Offline" and "Mock external deps".

Another robust approach: The prompt might be from a coding interview or exercise where the candidate is expected to know the project structure. The path is `../src/routes/api/motherInbox`. In a typical Node/Express app, routes import controllers or services from `../../services/...` or `../../controllers/...`. I can mock `../../services/motherInboxService` relative to the router file, which would be `../src/services/motherInboxService` from the test file (assuming test is in `tests/` or `__tests__/`). Let's assume the test file is at `tests/routes/api/motherInbox.test.ts` or similar. The import path `../src/routes/api/motherInbox` suggests the test is in `tests/` or `__tests__/` at the project root? Actually, `../src/...` from the test file means the test is in a sibling directory to `src`, maybe `tests/unit/routes/api/motherInbox.test.ts`? No, if the test is at `tests/routes/api/motherInbox.test.ts`, then `../src` would be wrong. It would be `../../src`. So the test is likely at `src/routes/api/__tests__/motherInbox.test.ts` or `test/routes/api/motherInbox.test.ts`? Let's not overthink; the import path is given as a strict rule.

Given the import path `../src/routes/api/motherInbox`, the test file is likely at `__tests__/routes/api/motherInbox.test.ts` or `tests/unit/something.test.ts`. Actually, if the test file is in `tests/unit/routes/api/motherInbox.test.ts`, the relative path to `src/routes/api/motherInbox` would be `../../../src/routes/api/motherInbox`. So `../src/routes/api/motherInbox` implies the test is in a directory like `src/__tests__` or `src/routes/api/__tests__`. Let's assume the test is in `src/routes/api/__tests__/motherInbox.test.ts` or similar. Then external deps from the router's perspective would be relative to `src/routes/api/motherInbox.ts`, e.g., `../../services/inboxService` or `../../db`.

To make the test self-contained and deterministic, I will mock `../../services/motherInboxService` (resolved from the router's location) which from the test file (assuming it's in `src/routes/api/__tests__`) would be `../../../services/motherInboxService`. But wait, from `src/routes/api/__tests__/motherInbox.test.ts`, `../../services/motherInboxService` would be `src/routes/services/motherInboxService` — wrong. It should be `../../../services/motherInboxService` to reach `src/services/motherInboxService`.

This is getting too speculative. Maybe I should mock `../src/services/motherInboxService` from the test file, assuming the test is at the project root level? No.

Let's step back. The user wants a contract test. The exact mock paths might not be as important as the structure and assertions. However, to be safe, I can mock a generic module like `../src/lib/db` or use `jest.mock` on a path that is plausible. But if I'm not sure, maybe I can avoid mocking specific internal paths and instead mock the global `process.env` or use an in-memory SQLite database? The prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline."

I think the best approach is to assume the router uses a service layer at a conventional path. I'll choose `../src/services/inboxService` relative to the test file? No, relative to the source file. Let's assume the source file is `src/routes/api/motherInbox.ts`. It might import from `../../services/inbox`. From the test file, if we follow the import path `../src/routes/api/motherInbox`, the test is likely at `test/unit/motherInbox.test.ts` or similar. Actually, `../src` from `test/unit` works. So the test is in `test/unit/...`. Then the source imports from `../../services/...` relative to `src/routes/api/`, which resolves to `src/services/...`. From the test file at `test/unit/`, the path to `src/services/...` is `../src/services/...`. So I can mock `../src/services/motherInboxService` or `../src/services/inboxService`.

Given the module name is `motherInbox`, I'll mock `../src/services/motherInboxService`. This is a reasonable guess.

Now, what are the methods? Based on the name and `InboxMessage` interface:
- `listMessages(): Promise<InboxMessage[]>`
- `getMessage(id: string): Promise<InboxMessage | null>`
- `createMessage(payload: Omit<InboxMessage, 'id' | 'createdAt'>): Promise<InboxMessage>`
- `updateMessage(id: string, payload: Partial<InboxMessage>): Promise<InboxMessage | null>`
- `deleteMessage(id: string): Promise<boolean>`

I'll define these in the mock.

Now, the test file structure:

```typescript
import request from 'supertest';
import express from 'express';
import router from '../src/routes/api/motherInbox';

// Mock the service layer
jest.mock('../src/services/motherInboxService', () => ({
  __esModule: true,
  default: {
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    createMessage: jest.fn(),
    updateMessage: jest.fn(),
    deleteMessage: jest.fn(),
  },
}));

import MotherInboxService from '../src/services/motherInboxService';

const mockedService = MotherInboxService as jest.Mocked<typeof MotherInboxService>;

describe('motherInbox router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/mother-inbox', router); // or just mount at '/' since router is the route handler
    jest.clearAllMocks();
  });

  // Tests for GET /
  // Tests for GET /:id
  // Tests for POST /
  // Tests for PATCH /:id
  // Tests for DELETE /:id
});
```

Wait, if the router is an Express router, it likely defines routes relative to where it's mounted. So mounting at `/` in the test app is fine.

But what if the router expects to be mounted at a specific path? Usually routers are path-agnostic. So I'll mount at `/`.

Now, contract tests:
1. `GET /` should return `200` and an array of messages.
2. `GET /` when service returns empty array should return `[]`.
3. `GET /:id` with valid id should return the message.
4. `GET /:id` with non-existent id should return `404`.
5. `GET /:id` with invalid id format should return `400` or `404`.
6. `POST /` with valid body should return `201` and the created message (with id and timestamps).
7. `POST /` with invalid body should return `400` (or throw/500 if no validation, but contract implies validation).
8. `PATCH /:id` with valid body should return `200` and updated message.
9. `PATCH /:id` with non-existent id should return `404`.
10. `DELETE /:id` should return `204` and call service.
11. `DELETE /:id` non-existent should return `404`.

Boundary conditions:
- Empty payload
- Very long strings
- Missing required fields

Since I don't know the exact fields of `InboxMessage`, I'll define a reasonable interface in the test for type safety, but I won't import it if it's not exported. The prompt says `interface InboxMessage {` which is incomplete. I'll assume it has at least `id`, `subject`, `body`, `sender`, `read`, `createdAt`.

Actually, to be strict TS, I should define the shape I expect in the test, or cast responses. I can define a test helper type.

Let's draft the code.

```typescript
import request from 'supertest';
import express, { Application } from 'express';
import router from '../src/routes/api/motherInbox';

// Define the expected public shape for contract testing
interface InboxMessage {
  id: string;
  subject: string;
  body: string;
  sender: string;
  read: boolean;
  createdAt: string;
}

jest.mock('../src/services/motherInboxService', () => ({
  __esModule: true,
  default: {
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    createMessage: jest.fn(),
    updateMessage: jest.fn(),
    deleteMessage: jest.fn(),
  },
}));

import MotherInboxService from '../src/services/motherInboxService';

const service = MotherInboxService as jest.Mocked<typeof MotherInboxService>;

describe('motherInbox router contract', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(router);
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns 200 and an array of inbox messages', async () => {
      const messages: InboxMessage[] = [
        { id: '1', subject: 'Hello', body: 'World', sender: 'a@b.com', read: false, createdAt: '2024-01-01T00:00:00Z' },
      ];
      service.listMessages.mockResolvedValue(messages);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(messages);
      expect(service.listMessages).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no messages exist', async () => {
      service.listMessages.mockResolvedValue([]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /:id', () => {
    it('returns the message when found', async () => {
      const message: InboxMessage = { id: 'abc', subject: 'S', body: 'B', sender: 'x@y.com', read: true, createdAt: '2024-01-01T00:00:00Z' };
      service.getMessage.mockResolvedValue(message);

      const res = await request(app).get('/abc');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(message);
      expect(service.getMessage).toHaveBeenCalledWith('abc');
    });

    it('returns 404 when message not found', async () => {
      service.getMessage.mockResolvedValue(null);

      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed id', async () => {
      // Assuming the router validates id format or the service throws
      service.getMessage.mockRejectedValue(new Error('Invalid id'));

      const res = await request(app).get('/bad-id!');

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('POST /', () => {
    it('creates a message and returns 201 with the created object', async () => {
      const payload = { subject: 'New', body: 'Message body', sender: 'me@example.com' };
      const created: InboxMessage = { id: 'msg-1', ...payload, read: false, createdAt: '2024-06-01T12:00:00Z' };
      service.createMessage.mockResolvedValue(created);

      const res = await request(app).post('/').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(created);
      expect(service.createMessage).toHaveBeenCalledWith(expect.objectContaining(payload));
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/').send({ subject: 'Missing body and sender' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /:id', () => {
    it('updates and returns the message', async () => {
      const updated: InboxMessage = { id: '1', subject: 'Updated', body: 'B', sender: 's@r.com', read: true, createdAt: '2024-01-01T00:00:00Z' };
      service.updateMessage.mockResolvedValue(updated);

      const res = await request(app).patch('/1').send({ read: true });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(service.updateMessage).toHaveBeenCalledWith('1', { read: true });
    });

    it('returns 404 for non-existent message', async () => {
      service.updateMessage.mockResolvedValue(null);

      const res = await request(app).patch('/99').send({ read: true });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:id', () => {
    it('deletes the message and returns 204', async () => {
      service.deleteMessage.mockResolvedValue(true);

      const res = await request(app).delete('/1');

      expect(res.status).toBe(204);
      expect(service.deleteMessage).toHaveBeenCalledWith('1');
    });

    it('returns 404 when message does not exist', async () => {
      service.deleteMessage.mockResolvedValue(false);

      const res = await request(app).delete('/99');

      expect(res.status).toBe(404);
    });
  });
});
```

This looks like a solid contract test. But I need to ensure strict TypeScript. I should import `supertest` and `express`. I need to make sure the mock path is correct. I'll use `jest.mock('../src/services/motherInboxService', ...)` because from the test file (assuming it's at `test/unit/...` or similar), `../src/services/...` is plausible. Actually, if the import of the router is `../src/routes/api/motherInbox`, then the test file is in a directory that is a sibling to `src`? No, `../src` means the test is in a child of a sibling? Let's map:

If test file is at `project-root/tests/unit/motherInbox.test.ts`, then `../src/routes/api/motherInbox` resolves to `project-root/src/routes/api/motherInbox`. So the test is in `project-root/tests/unit/`. Then `../src/services/motherInboxService` from the test file would be `project-root/tests/src/services/...` — wrong. It should be `../../src/services/motherInboxService`.

But the prompt strictly says the import must be exactly `import ... from '../src/routes/api/motherInbox';`. It doesn't specify where the test file is, just that this import path is required. So I should stick to that import path. For the mock, I need to pick a path relative to the test file. If the test file is at `tests/unit/routes/api/motherInbox.test.ts`, then `../src/routes/api/motherInbox` is correct (one up to `tests/`, then `../src`). Wait:

- `tests/unit/routes/api/motherInbox.test.ts` -> `../../..` -> `tests/` -> `../src` -> `src/`. Yes! So from `tests/unit/routes/api/motherInbox.test.ts`, `../src/routes/api/motherInbox` is correct:
  - `..` -> `tests/unit/routes/`
  - `../src` -> `tests/unit/src`? No.

Let's do it carefully:
Path: `tests/unit/routes/api/motherInbox.test.ts`
Target: `src/routes/api/motherInbox`

Relative path:
- From `tests/unit/routes/api/` to `src/routes/api/`:
  - `..` -> `tests/unit/routes/`
  - `..` -> `tests/unit/`
  - `..` -> `tests/`
  - `..` -> `project-root/`
  - `src/routes/api/motherInbox` -> target.
So that's `../../../../src/routes/api/motherInbox`. That's not `../src`.

What if the test file is at `src/routes/api/__tests__/motherInbox.test.ts`?
- From `src/routes/api/__tests__/` to `src/routes/api/motherInbox`:
  - `..` -> `src/routes/api/`
  - `motherInbox` -> target.
So that's `../motherInbox`. But the required import is `../src/routes/api/motherInbox`. That doesn't match.

What if the test file is at `__tests__/routes/api/motherInbox.test.ts` relative to project root?
- From `__tests__/routes/api/` to `src/routes/api/`:
  - `..` -> `__tests__/routes/`
  - `..` -> `__tests__/`
  - `..` -> root
  - `src/routes/api/motherInbox`.
So that's `../../../src/routes/api/motherInbox`. Not `../src`.

What if the test file is at `src/__tests__/routes/api/motherInbox.test.ts`?
- From `src/__tests__/routes/api/` to `src/routes/api/`:
  - `..` -> `src/__tests__/routes/`
  - `..` -> `src/__tests__/`
  - `..` -> `src/`
  - `routes/api/motherInbox`.
So that's `../../routes/api/motherInbox`. Not `../src`.

What if the test file is at `routes/api/motherInbox.test.ts` and `src` is at `../src`? That would mean the test is outside `src`, in a `routes` folder at root? Unlikely.

Wait, maybe the test file is at `test/routes/api/motherInbox.test.ts` and the project structure is:
```
project/
  src/
    routes/
      api/
        motherInbox.ts
  test/
    routes/
      api/
        motherInbox.test.ts
```
Then from `test/routes/api/motherInbox.test.ts`, `../src/routes/api/motherInbox` would be:
- `..` -> `test/routes/`
- `../src` -> `test/src`? No.

Actually, `../src` from `test/routes/api/` goes to `test/routes/src`. Wrong.

What if the test file is at `src/routes/api/motherInbox.test.ts` (same directory)?
- Import would be `./motherInbox`. Not `../src`.

What if the test file is at `tests/api/motherInbox.test.ts`?
- `..` -> `tests/`
- `../src` -> `src/`. Yes! Because from `tests/api/`, `..` is `tests/`, and `../src` is `src/`? Wait:
  - `tests/api/motherInbox.test.ts`
  - `..` -> `tests/`
  - `../src` -> `src/`? No, `..` from `tests/api/` is `tests/`. Then `../src` from `tests/` is `src/`. But the path string would be `../../src/routes/api/motherInbox`. Because you need two `..` to get to root.

Unless the test file is at `src/../tests/...`? No.

Actually, the only way `../src/X` works is if the test file is in a directory that is a sibling to `src`. For example:
```
project/
  src/
  test/
    unit/
      motherInbox.test.ts
```
From `test/unit/motherInbox.test.ts`:
- `..` -> `test/`
- `../src` -> `src/`. Yes! Because `..` from `test/unit/` is `test/`. Then `../src` from `test/` is `src/`. Wait, no: the path is `../src/routes/api/motherInbox`. Let's resolve:
- Start: `project/test/unit/motherInbox.test.ts`
- `..` -> `project/test/`
- `src` -> `project/test/src`? No, `../src` means go up one level (to `project/test/`) then into `src`? No, `..` goes to `project/test/`. Then `src` would be `project/test/src`. That's not right.

Wait, I'm confusing myself. In relative paths:
- `../` means parent directory.
- `../src` means parent directory, then `src`.

So if the test file is at `project/test/unit/motherInbox.test.ts`, its parent is `project/test/unit/`. `../src` would be `project/test/src`. Wrong.

If the test file is at `project/src/routes/api/__tests__/motherInbox.test.ts`, its parent is `project/src/routes/api/__tests__/`. `../src` would be `project/src/routes/api/src`. Wrong.

If the test file is at `project/e2e/motherInbox.test.ts`, parent is `project/e2e/`. `../src` is `project/src`. That works! Because `..` goes to `project/`, then `src` is `project/src`. So the test file is at `project/e2e/motherInbox.test.ts` or `project/integration/motherInbox.test.ts` or any folder directly under project root.

But the path `../src/routes/api/motherInbox` implies the test is in a directory at the same level as `src`. For example:
```
project/
  src/
  tests/
    motherInbox.test.ts
```
From `project/tests/motherInbox.test.ts`, `..` is `project/`, then `src/...` is correct. So the test file is directly under a top-level folder like `tests/`, `test/`, `spec/`, etc., but not in a subfolder. Or it could be in `project/test/unit/motherInbox.test.ts`? No, that would need `../../src`.

So likely the test file is at `tests/motherInbox.test.ts` or similar. Then mocking `../src/services/motherInboxService` would also be correct because `..` from `tests/` is root, then `src/services/...`.

Yes! So the test file is at `tests/motherInbox.test.ts` (or `test/motherInbox.test.ts`). Then:
- `../src/routes/api/motherInbox` -> correct.
- `../src/services/motherInboxService` -> correct.

Great
