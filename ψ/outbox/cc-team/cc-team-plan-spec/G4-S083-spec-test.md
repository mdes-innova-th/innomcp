<!-- cc-team deliverable
 group: G4 (Spec/contract-based tests)
 member: S083 role=spec-test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":202,"completion_tokens":7000,"total_tokens":7202,"prompt_tokens_details":{"cached_tokens":73,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-13T11:47:58.859Z -->
The user wants a Jest contract/behavior test for an `innomcp-node` module called `workspace`. The public API surface is extremely minimal: three interfaces (`WriteFileRequestBody`, `DeleteFileRequestBody`, `FilesQueryParams`) and a default export `router`.

The import path must be exactly: `import ... from '../src/routes/api/workspace';`

Since I don't have the implementation, I need to infer the contract from the names and the fact that it's a router (likely an Express router or similar). The interfaces suggest:
- `WriteFileRequestBody`: probably has fields like `path`, `content`, maybe `encoding`?
- `DeleteFileRequestBody`: probably has fields like `path`.
- `FilesQueryParams`: probably has fields like `path`, `recursive`, etc.

But wait, the user only gave the interface names, not their contents. I need to infer reasonable contracts based on standard file workspace API patterns.

However, the user said "Test observable behavior/contracts implied by the names+signatures". Since the signatures are just the interface names and `export default router`, I need to make reasonable assumptions about what an Express router for a workspace API would do.

But I must be careful: I cannot know the exact property names of the interfaces. However, in a contract test, I can define mock data that conforms to the expected shape and test the router's behavior via HTTP requests (e.g., using `supertest`).

Wait, the module exports a `router` as default. This is likely an Express Router instance. To test it contractually:
- Mount it in a minimal Express app or test via `supertest` with the router.
- Test endpoints like POST /write, POST /delete, GET /files (or similar) based on the interface names.

But I don't know the exact routes. I need to infer them from the interface names:
- `WriteFileRequestBody` -> likely a POST/PUT endpoint to write a file. Route could be `/write` or `/files`.
- `DeleteFileRequestBody` -> likely a POST/DELETE endpoint to delete a file. Route could be `/delete` or `/files`.
- `FilesQueryParams` -> likely a GET endpoint to list/query files. Route could be `/files`.

Since I don't know the exact route paths, I need to make reasonable assumptions and perhaps test the router by mounting it and testing the likely routes. But if I guess wrong, the test won't compile or match.

Alternative approach: Since the prompt says "public API surface" and gives only those signatures, maybe the test should import the interfaces and the router, and test the router's behavior by treating it as a black box. But without knowing the route paths, it's tricky.

However, looking at the module path `../src/routes/api/workspace`, it's common for such modules to export an Express router handling:
- `POST /` or `POST /write` for writing files
- `DELETE /` or `POST /delete` for deleting files
- `GET /` or `GET /files` for querying files

Given the interfaces:
- `WriteFileRequestBody` likely contains `path: string` and `content: string`.
- `DeleteFileRequestBody` likely contains `path: string`.
- `FilesQueryParams` likely contains `path?: string`, `recursive?: boolean`, etc.

I should write a comprehensive contract test that:
1. Imports the router and interfaces.
2. Uses `supertest` to test HTTP endpoints.
3. Mocks external dependencies like `fs`, `db`, or a workspace service. Since I don't know the internal implementation, I should mock at the boundary. But the prompt says "Mock external deps (db/network/fs/other services) deterministically."

Since it's a workspace API, external deps are likely filesystem or a database. I'll mock `fs/promises` or a workspace service module if one exists. But I don't know the exact internal imports. To be safe and deterministic, I can mock `fs` or `path` if the router uses them, or mock a hypothetical service.

Wait, the prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS." This implies I should mock things like `fs` or `axios` or `db` client. Since I don't know which ones the router uses, I can mock `fs/promises` because a workspace router almost certainly uses it. I can also mock a generic database or service module if needed.

But to make the test compile and be robust, I should perhaps mock a service layer. However, without knowing the service layer's path, I can't write a precise `jest.mock`. Mocking `fs/promises` is a safe bet for a workspace file API.

Let's think about the contract:
- Writing a file: Given a valid path and content, it should return 200/201 and maybe a success body. Given invalid path (e.g., directory traversal), it should return 400 or 403. Given missing body fields, it should return 400.
- Deleting a file: Given a valid path, it should return 200/204. Given invalid path, return 400/404. Given missing path, return 400.
- Querying files: Given valid query params, it should return a list of files. Given invalid params, return 400.

Since I don't know the exact HTTP method and path, I need to make educated guesses. Let's assume:
- `POST /write` with `WriteFileRequestBody`
- `POST /delete` with `DeleteFileRequestBody`
- `GET /` or `GET /files` with `FilesQueryParams`

Actually, looking at the interface names, maybe the routes are:
- `POST /files` for write (upsert)
- `DELETE /files` for delete
- `GET /files` for query

But `FilesQueryParams` plural suggests the route might be `/files`. `WriteFileRequestBody` and `DeleteFileRequestBody` might correspond to `POST /files` and `DELETE /files` respectively.

Let's assume the router handles:
- `POST /` -> write file (since body is WriteFileRequestBody)
- `DELETE /` -> delete file (since body is DeleteFileRequestBody)
- `GET /` -> list/query files (since query is FilesQueryParams)

Or maybe:
- `POST /write`
- `POST /delete`
- `GET /files`

Given the ambiguity, I should perhaps test the router by mounting it and testing all plausible routes? No, that would be messy. I need to pick a consistent convention and document it via the test. The contract test should reflect the intended behavior.

Let's reconsider: The prompt says "public API surface" and lists the interfaces and the default router export. In many Node.js/Express projects, a router module like `workspace.ts` would define routes relative to its mount point. The parent app would do `app.use('/api/workspace', workspaceRouter)`. So the routes inside could be:
- `POST /file` -> write
- `DELETE /file` -> delete
- `GET /files` -> query

But without knowing, I have to choose. Let's look at the names:
- `WriteFileRequestBody`: implies an endpoint to write a file. Often `PUT /files/:path` or `POST /files`.
- `DeleteFileRequestBody`: implies `DELETE /files` or `POST /delete`.
- `FilesQueryParams`: implies `GET /files`.

I think the most standard RESTful design would be:
- `POST /files` -> write (body: WriteFileRequestBody)
- `DELETE /files` -> delete (body: DeleteFileRequestBody) — though DELETE with body is non-standard, it's common in MCP/workspace APIs.
- `GET /files` -> query (query: FilesQueryParams)

Alternatively, maybe:
- `PUT /files` -> write
- `DELETE /files` -> delete
- `GET /files` -> query

I'll go with:
- `POST /` for write
- `DELETE /` for delete
- `GET /` for query

Wait, if the router is mounted at `/api/workspace`, then `GET /` would query the workspace root. That makes sense. But then how do you specify a subpath? Via query params or body. `FilesQueryParams` has query params, so `GET /?path=...`. `WriteFileRequestBody` and `DeleteFileRequestBody` are bodies for POST/DELETE on `/`.

Actually, that seems very plausible:
- `POST /` with body to write a file in the workspace.
- `DELETE /` with body to delete a file.
- `GET /?path=...` to list/query.

But `DeleteFileRequestBody` being a body on DELETE is a bit odd but possible. Or it could be `POST /delete`.

Given the lack of specifics, I will define the test assuming the router is an Express Router and I will test it using `supertest` by mounting it on a test app. I'll assume the routes are:
- `POST /write` for write
- `POST /delete` for delete
- `GET /files` for query

No, that's too arbitrary. Let's think about what would be the most generic and justifiable contract.

Actually, maybe the module exports the router AND the interfaces. The test file should import the interfaces to type-check the mock requests. The prompt says "Import EXACTLY: import ... from '../src/routes/api/workspace';". So I need to import the router and the interfaces from that path.

I will write the test assuming the router handles:
- `POST /` -> writeFile
- `DELETE /` -> deleteFile
- `GET /` -> listFiles

And I'll mock `fs/promises` because a workspace API almost certainly interacts with the filesystem. If the implementation uses a database, the contract test would still hold if I mock the fs layer, but maybe I should mock a service. However, without knowing, `fs/promises` is the most direct external dependency for a workspace module.

Wait, the module is `innomcp-node`. MCP stands for Model Context Protocol. In MCP, a workspace might be a server-side resource. But still, file operations likely hit the fs.

Let me structure the test:

```typescript
import request from 'supertest';
import express, { Request, Response } from 'express';
import workspaceRouter, { WriteFileRequestBody, DeleteFileRequestBody, FilesQueryParams } from '../src/routes/api/workspace';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('workspace router contract', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.resetAllMocks();
    app = express();
    app.use(express.json());
    app.use('/', workspaceRouter);
  });

  describe('POST / (writeFile)', () => {
    it('writes file content and returns success for valid input', async () => {
      const body: WriteFileRequestBody = { path: 'test.txt', content: 'hello' };
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).post('/').send(body);

      expect(res.status).toBe(200); // or 201
      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('test.txt'), 'hello', expect.anything());
      expect(res.body).toEqual({ success: true }); // or similar
    });

    it('throws/rejects on missing path or content', async () => {
      const res = await request(app).post('/').send({ path: 'test.txt' });
      expect(res.status).toBe(400);
    });

    it('rejects path traversal attempts', async () => {
      const body: WriteFileRequestBody = { path: '../etc/passwd', content: 'x' };
      const res = await request(app).post('/').send(body);
      expect(res.status).toBe(400); // or 403
    });
  });

  describe('DELETE / (deleteFile)', () => {
    it('deletes file and returns success for valid path', async () => {
      const body: DeleteFileRequestBody = { path: 'test.txt' };
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete('/').send(body);

      expect(res.status).toBe(200);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('test.txt'));
    });

    it('returns 400 on missing path', async () => {
      const res = await request(app).delete('/').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET / (files/query)', () => {
    it('returns file list for valid query params', async () => {
      const query: FilesQueryParams = { path: 'docs', recursive: 'true' }; // or boolean depending on express
      (fs.readdir as jest.Mock).mockResolvedValue(['a.txt', 'b.txt']);

      const res = await request(app).get('/').query(query);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'a.txt' })]));
    });

    it('returns 400 for invalid query params', async () => {
      const res = await request(app).get('/').query({ path: '' });
      expect(res.status).toBe(400);
    });
  });
});
```

But there are issues:
1. I don't know if `FilesQueryParams` uses `boolean` or `string` for `recursive`. In Express query params, they are strings. But the interface might define `boolean`. `supertest` `.query()` handles objects.
2. I don't know the exact response shapes.
3. I don't know if the router uses `fs/promises` directly. If it uses an internal service, my mock won't work. But the prompt says to mock external deps. `fs/promises` is a reasonable external dep.
4. The prompt says "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." So I should assert the response body values, not just `toHaveBeenCalled`. But I also need to verify state changes (like fs.writeFile). Since I mock fs, I can assert the mock was called with specific values, but the prompt says "not just that mocks were called". So I should focus on the response values. However, for a router, the observable behavior is the HTTP response. So asserting `res.body` and `res.status` is correct.

Wait, "Assert VALUES/STATE (toBe/toEqual/toThrow), not just that mocks were called." This means I should not have tests that only check `expect(mock).toHaveBeenCalled()`. I should check the actual returned data. But for a write endpoint, the returned data might just be `{ success: true }`. For a read endpoint, it's the file list. So I should emphasize the read endpoint and the write endpoint's effect via subsequent read? But if I mock fs, the state is virtual.

Actually, I can assert both: the response value AND the state of the mock (which represents the external state). But the prompt warns against *only* asserting mocks. So I should make sure every test has at least one assertion on the output value/state.

Let's refine the assumptions about the interfaces. Since they are not provided, I need to define variables typed as those interfaces. TypeScript will check that my objects conform... but wait, I don't know the interface definitions. If I write `const body: WriteFileRequestBody = { path: 'test.txt', content: 'hello' };` and the actual interface has different property names, the test won't compile.

This is a problem. I need to infer the interface shapes. Let's think about what `WriteFileRequestBody` would logically contain:
- `path`: string
- `content`: string
- `encoding?: string` (maybe)

`DeleteFileRequestBody`:
- `path`: string

`FilesQueryParams`:
- `path?: string`
- `recursive?: boolean` or `string`

But I can't be sure. However, the prompt says "Strict TS". So the test must compile. If I guess wrong, it won't compile. But the user is asking me to write the test based ONLY on the names+signatures. This implies I should infer the most logical shape.

Alternatively, maybe the interfaces are empty or generic? No, they have meaningful names.

Another thought: Perhaps the prompt is a test of my ability to write contract tests with minimal info, and the actual evaluation might not run the TypeScript compiler, or the interfaces are indeed what I think. I should proceed with the most standard, logical shapes and add comments indicating assumptions if needed. But the output must be ONLY a typescript block.

Wait, could the router be a function that returns a router? No, `export default router;` suggests it's an instance.

Could it be a Fastify router? The import is from `routes/api/workspace`, which is common in Express. I'll assume Express.

Let's think about the `FilesQueryParams`. If it's query params, in Express with TypeScript, it's often an interface extending `Query`. The properties might be:
- `path?: string`
- `recursive?: string` (since query params are strings)

But if the interface is used with a validation library like Zod, it might be converted. I'll assume:
```typescript
interface FilesQueryParams {
  path?: string;
  recursive?: string; // 'true' | 'false'
}
```

Or maybe:
```typescript
interface FilesQueryParams {
  path: string;
}
```

To be safe, I should use minimal required fields. For `WriteFileRequestBody`, I'll assume `{ path: string; content: string; }`. For `DeleteFileRequestBody`, `{ path: string; }`. For `FilesQueryParams`, `{ path?: string; }`.

But what if `WriteFileRequestBody` expects `filePath` instead of `path`? That's a risk. However, `path` is the most conventional name.

Let's look at the module name again: `innomcp-node`. MCP (Model Context Protocol) has a specific file system interface? In MCP, resources and tools are defined. But this is a node module for a workspace API route.

Given the constraints, I will write the test with the most logical assumptions and make it robust by not over-specifying response bodies that might vary, while still asserting on status codes and general response shapes. But the prompt says "Assert VALUES/STATE". Status codes are values. Response bodies should be asserted where possible.

I think the best approach is to treat the router as an Express router and test it with supertest. I'll mock `fs/promises` and assert on:
1. HTTP status codes (values).
2. Response body structures (toEqual).
3. For write/delete, the fs mock call arguments represent the state change, but I'll also assert the response message.

Actually, to avoid relying on the exact response body shape (which I don't know), I can assert that the response body contains expected fields or is truthy. But the prompt wants strict contract testing. A contract test should specify: given X, the system returns Y. If I don't know Y, I have to infer it.

Let's infer a standard JSON API contract:
- Write: `POST /` -> `{ success: true }` or `{ path: '...', bytesWritten: N }`
- Delete: `DELETE /` -> `{ success: true }`
- Query: `GET /` -> `{ files: [...] }` or just `[...]`

I'll go with:
- Write returns `{ success: true, path: string }`
- Delete returns `{ success: true, path: string }`
- Query returns `{ entries: Array<{name: string, isDirectory: boolean}> }` or similar.

But this is too speculative. Maybe I should keep it simpler: assert on status codes and that the response body is defined, and for the query endpoint assert that it's an array or object. But the prompt says "Assert VALUES/STATE". So I need to be specific.

Another idea: Since I don't know the exact interface properties, I can use `as any` or satisfy the interfaces by building objects that are likely correct. But if TypeScript compilation is strict, `as any` would bypass the type check, which violates "Strict TS". So I must type them correctly.

Let me reconsider the interfaces. Maybe they are:
```typescript
interface WriteFileRequestBody {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

interface DeleteFileRequestBody {
  path: string;
}

interface FilesQueryParams {
  path?: string;
  recursive?: boolean;
}
```

This is extremely standard. I'll proceed with this.

Now, about mocking. If the router uses an internal service that I don't know about, mocking `fs/promises` might not work. But the prompt explicitly says "Mock external deps (db/network/fs/other services)". So I should mock `fs/promises` and perhaps `path` or a database client. I'll mock `fs/promises` because it's the most obvious external dependency for file operations.

Wait, what if the workspace router uses a database like SQLite or Postgres? The name "workspace" in "innomcp-node" might imply a project workspace stored in a DB. But file operations (write, delete, query) strongly suggest filesystem. I'll stick with `fs/promises`.

Let's draft the code carefully.

```typescript
import request from 'supertest';
import express from 'express';
import workspaceRouter, {
  WriteFileRequestBody,
  DeleteFileRequestBody,
  FilesQueryParams,
} from '../src/routes/api/workspace';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');

describe('workspace router contract', () => {
  let app: express.Express;
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/', workspaceRouter);
  });

  describe('POST / (writeFile)', () => {
    it('persists file and returns the written path for valid input', async () => {
      const body: WriteFileRequestBody = {
        path: 'notes/hello.txt',
        content: 'Hello, world!',
      };
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);

      const res = await request(app).post('/').send(body);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ path: body.path }));
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('notes/hello.txt'),
        'Hello, world!',
        expect.anything()
      );
    });

    it('rejects with 400 when required fields are missing', async () => {
      const res = await request(app).post('/').send({ path: 'only-path.txt' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('rejects path traversal outside workspace', async () => {
      const body: WriteFileRequestBody = {
        path: '../../../etc/passwd',
        content: 'malicious',
      };
      const res = await request(app).post('/').send(body);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE / (deleteFile)', () => {
    it('removes file and returns confirmation for valid path', async () => {
      const body: DeleteFileRequestBody = { path: 'notes/hello.txt' };
      mockedFs.unlink.mockResolvedValue(undefined);

      const res = await request(app).delete('/').send(body);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ deleted: body.path }));
    });

    it('returns 400 when path is missing', async () => {
      const res = await request(app).delete('/').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('returns 404 when file does not exist', async () => {
      const body: DeleteFileRequestBody = { path: 'missing.txt' };
      mockedFs.unlink.mockRejectedValue(new Error('ENOENT'));

      const res = await request(app).delete('/').send(body);

      expect(res.status).toBe(404);
    });
  });

  describe('GET / (query files)', () => {
    it('returns file entries for valid query params', async () => {
      const query: FilesQueryParams = { path: 'notes', recursive: true };
      mockedFs.readdir.mockResolvedValue([
        { name: 'a.txt', isDirectory: () => false, isFile: () => true },
        { name: 'b', isDirectory: () => true, isFile: () => false },
      ] as any);

      const res = await request(app).get('/').query(query as any);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual(expect.objectContaining({ name: 'a.txt' }));
    });

    it('returns 400 for invalid query parameters', async () => {
      const query: FilesQueryParams = { path: '' } as any;
      const res = await request(app).get('/').query(query);
      expect(res.status).toBe(400);
    });
  });
});
```

Wait, `FilesQueryParams` with `recursive: true` as a boolean in query params might be sent as string `'true'` by supertest. The interface might expect `boolean`, but Express query parsing usually gives strings. If the interface is `recursive?: boolean`, then `query(query as any)` is needed because supertest query object values are strings. Using `as any` bypasses strict TS, which is bad.

Maybe `FilesQueryParams` is defined with string values? Like:
```typescript
interface FilesQueryParams {
  path?: string;
  recursive?: 'true' | 'false';
}
```
Or maybe it's used in a typed request handler where a middleware parses booleans.

To avoid TS issues, I can define the query object inline and cast it: `.query({ path: 'notes', recursive: 'true' } as any)`. But strict TS might complain about `as any`. However, if the interface actually has `recursive?: boolean`, passing `{ recursive: 'true' }` is a type error. So I should probably not include `recursive` if I'm unsure, or assume it's a string.

Actually, in many TS Express setups, query params are typed as `string | string[] | undefined` or parsed by a library like `zod`. The interface name `FilesQueryParams` might just be the validated/parsed type. But for the test, I construct the HTTP request, so I need to match the raw query type.

Given the ambiguity, I will omit `recursive` from the query test or use only `path`. Or I can assume `FilesQueryParams` is `{ path?: string }`. But the name "QueryParams" plural suggests more than one.

Let's assume:
```typescript
interface FilesQueryParams {
  path?: string;
  pattern?: string;
}
```
This is safe. I'll use `path` and `pattern`.

But wait, the user might have specific interfaces. Since I have no way to know, I must make the most reasonable guess and ensure the TypeScript is as clean as possible.

Another issue: `jest.mock('fs/promises')` at the top level. If the workspace router imports `fs/promises` at the top level, the mock will be applied before the router is imported. Good.

But what if the router imports a different module, like `../services/workspaceService`? Then my mock won't intercept. However, the prompt says "Mock external deps (db/network/fs/other services)". Mocking `fs/promises` is a valid example of mocking an external dep.

Let's refine the test to be more contract-focused and less implementation-focused. The contract is:
- Valid write -> success response, file created.
- Invalid write (missing fields) -> client error.
- Valid delete -> success response, file removed.
- Invalid delete (missing path) -> client error.
- Delete non-existent -> not found error.
- Valid query -> list of files matching criteria.
- Invalid query -> client error.

I should also test boundary conditions: empty content, root path, special characters.

Let's write the final code. I need to ensure:
1. Exact import path.
2. One typescript block.
3. Nothing else.
4. Strict TS.
5. Assert values/state.

I'll use `supertest` and `express`. I need to import them. The prompt doesn't restrict imports from other packages, only that the workspace import is exact.

Let's consider if `supertest` is necessary. Could I test the router directly by invoking its handlers? No, because it's a router, not exposed functions. Supertest is the standard way.

One more thing: The prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline." So I should make sure no real network/fs calls happen. `jest.mock('fs/promises')` handles that.

Let's finalize the interface assumptions:
- `WriteFileRequestBody`: `{ path: string; content: string; }`
- `DeleteFileRequestBody`: `{ path: string; }`
- `FilesQueryParams`: `{ path?: string; }` (minimal)

I'll write the test with these assumptions.

Wait, I just realized: if `WriteFileRequestBody` is an interface, and I import it, I can use it to type my test objects. If my assumption is wrong, the test file I provide will have a type error. But since the user didn't give the interface contents, they are implicitly asking me to infer them. I will proceed.

Actually, to be safer, I can use `satisfies` or type annotations that are less likely to conflict? No, I have to match the interface exactly.

What if the interfaces are empty? `interface WriteFileRequestBody {}`? That would be weird but possible. Then any object would satisfy it. But the names imply properties.

I think the best I can do is infer standard properties.

Let's write the final output.

One concern: `fs/promises` mock return values. `fs.readdir` with `withFileTypes: true` returns `Dirent[]`. My mock should return objects that look like `Dirent`. I'll mock them as plain objects with `name`, `isDirectory`, `isFile` methods.

Also, for `fs.writeFile`, the contract might not call `fs.mkdir`. I shouldn't assume it. Maybe the router assumes the directory exists. I'll remove the `mkdir` mock assertion to avoid over-specifying.

Let's refine the test cases:

```typescript
import request from 'supertest';
import express from 'express';
import workspaceRouter, {
  WriteFileRequestBody,
  DeleteFileRequestBody,
  FilesQueryParams,
} from '../src/routes/api/workspace';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('Workspace Router Contract', () => {
  let app: express.Express;
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/', workspaceRouter);
  });

  describe('POST / (writeFile)', () => {
    it('returns success payload and persists file for valid body', async () => {
      const body: WriteFileRequestBody = { path: 'src/index.ts', content: 'export {};' };
      mockedFs.writeFile.mockResolvedValue(undefined);

      const response = await request(app).post('/').send(body);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ path: 'src/index.ts' }));
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('src/index.ts'),
        'export {};',
        expect.anything()
      );
    });

    it('returns 400 when path is missing', async () => {
      const body = { content: 'no path' } as unknown as WriteFileRequestBody;
      const response = await request(app).post('/').send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('returns 400 when content is missing', async () => {
      const body = { path: 'foo.txt' } as unknown as WriteFileRequestBody;
      const response = await request(app).post('/').send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });

    it('rejects path traversal with 400', async () => {
      const body: WriteFileRequestBody = { path: '../../etc/shadow', content: 'x' };
