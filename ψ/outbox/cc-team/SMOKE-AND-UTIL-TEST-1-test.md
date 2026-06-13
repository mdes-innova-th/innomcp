<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: TEST-1 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":63,"completion_tokens":3000,"total_tokens":3063,"prompt_tokens_details":{"cached_tokens":4,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T05:29:11.195Z -->
The user wants a Node.js test file for `httpClient.ts` located at `innomcp-node/src/utils/httpClient.ts`. 

Requirements:
1. Test `get()` method - should return `{status, data}`
2. Test `get()` method - should handle 404 with status 404
3. Test `post()` method - should send body
4. Mock `https` with `nock` or inline mock
5. Output ONLY `.js` code, no markdown fences

Since the user mentioned `node:test`, they want the native Node.js test runner (`node:test` and `node:assert`), not Jest or Mocha.

I need to infer the API of `httpClient.ts`. Since it's a utility file in a Node project, it likely wraps `https` or `http` module. Common patterns:
- `get(url)` returns Promise<{status: number, data: any}>
- `post(url, body)` returns Promise<{status: number, data: any}>

Since the user says "Mock https with nock or inline mock", and nock is a popular HTTP mocking library, but they also allow inline mock. However, using `nock` is cleaner. But since I don't know if nock is installed, and the user said "Mock https with nock or inline mock", I can choose either. I'll use `nock` because it's standard, but I need to make sure the test file is `.js` and imports the compiled `httpClient.js` or uses a dynamic import / require for the TS? Wait, Node test runner runs JS. If the source is TS, typically tests import from the compiled JS or use a loader. But the user asked for `.js` test file. It should probably import `httpClient.js` (assuming TS is compiled) or use `ts-node`? The user said "Write node:test for httpClient.ts". This implies the test is for the TS file, but the output should be `.js`. Usually, the test file would import from the relative path `../../src/utils/httpClient.js` (if compiled) or just `../../src/utils/httpClient.js`. But maybe the project uses tsx or ts-node to run tests. However, the safest assumption is that the test file imports from the compiled JS path or uses a `.js` extension if it's ESM with TS. Actually, in many Node projects with TS, tests are written in TS too. But the user explicitly asked for "Output ONLY .js". So I'll write a `.js` file that imports `httpClient.js` (assuming compilation). Or maybe it uses dynamic import. Let's assume CommonJS or ESM? `node:test` works with both. I'll use ESM because it's modern and `node:test` is native. But if the project uses CommonJS, it might be different. Let's use ESM (`import`) since `node:test` is commonly used with ESM in modern Node. However, if the httpClient uses `https` module, nock works well with it.

Wait, the user said "Mock https with nock or inline mock". If I use nock, I need to import `nock`. But if I want to avoid external dependencies (since the user might not have nock), an inline mock of the `https` module might be more self-contained. But nock is much cleaner. Let's use `nock` but I'll add a comment? No, output ONLY .js, no fences, no extra text. So just code. If nock is not available, the test fails. But the user explicitly mentioned nock as an option. Let's use `nock`.

Actually, looking at the path `innomcp-node/src/utils/httpClient.ts`, this seems like a specific project. The httpClient likely has a simple interface. Let's assume:

```ts
// httpClient.ts
import https from 'https';

export function get(url: string): Promise<{status: number, data: string}> { ... }
export function post(url: string, body: object): Promise<{status: number, data: string}> { ... }
```

Or maybe it exports a class. But the user said `get()` and `post()`, so likely functions.

Let's design the test file:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import nock from 'nock';
import { get, post } from '../../src/utils/httpClient.js';

describe('httpClient', () => {
  test('get() returns {status, data}', async () => {
    nock('https://example.com')
      .get('/test')
      .reply(200, { success: true });

    const result = await get('https://example.com/test');
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.data, { success: true });
  });

  test('get() handles 404 with status 404', async () => {
    nock('https://example.com')
      .get('/missing')
      .reply(404, 'Not Found');

    const result = await get('https://example.com/missing');
    assert.strictEqual(result.status, 404);
  });

  test('post() sends body', async () => {
    nock('https://example.com')
      .post('/submit', { name: 'test' })
      .reply(201, { id: 1 });

    const result = await post('https://example.com/submit', { name: 'test' });
    assert.strictEqual(result.status, 201);
    assert.deepStrictEqual(result.data, { id: 1 });
  });
});
```

But wait, if `httpClient` uses the `https` module directly with `request`, nock intercepts `http` and `https` by overriding the modules. So it should work.

However, there are some details:
- `node:test` uses `describe` and `it` or `test`. Native `node:test` supports `describe` in newer versions (Node 18+). `it` is also supported as an alias for `test`. I'll use `describe` and `test`.
- Need to make sure nock is imported. If the project uses ESM, `import nock from 'nock'` works. If CommonJS, `const nock = require('nock')`. Since the user asked for `.js` without specifying module type, I'll assume ESM because it's cleaner with top-level await and modern Node. But many projects still use CJS. Hmm. Let's provide ESM. If they need CJS they can convert. Actually, to be safe and maximally compatible, maybe use CJS? No, `node:test` works fine with both. Let's use ESM because the `.js` extension with `import` is valid in ESM. But if the package.json doesn't have `"type": "module"`, it won't work. Alternatively, I can write it in a way that doesn't rely on ESM vs CJS? No, you have to choose one. I'll choose ESM as it's the standard going forward.

Wait, the user said "Output ONLY .js, no fences". This means I should not wrap the code in markdown code blocks. Just raw text of the JS file.

Let's refine the mock. If the httpClient parses JSON automatically, `data` might be an object. If not, it might be a string. The user said `get() returns {status,data}`. So `data` could be anything. I'll assume JSON parsing is done, so `data` is an object. But to be safe, maybe the httpClient returns string? The user didn't specify. Let's assume it returns parsed JSON if content-type is JSON, otherwise string. In the test, I'll make nock return JSON and assert `deepStrictEqual` on the parsed object.

Also, need to handle nock clean-up. `nock.cleanAll()` after each test? Good practice. But `node:test` doesn't have built-in `afterEach` in the same way? Actually, `node:test` has `beforeEach`/`afterEach` when using `describe`. Yes, in Node 18.8.0+, `describe` supports hooks. I can use `afterEach(() => nock.cleanAll())`.

Let's write it:

```js
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import nock from 'nock';
import { get, post } from '../../src/utils/httpClient.js';

describe('httpClient', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test('get() returns {status,data}', async () => {
    const scope = nock('https://api.example.com')
      .get('/data')
      .reply(200, { message: 'ok' }, { 'Content-Type': 'application/json' });

    const result = await get('https://api.example.com/data');
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.data, { message: 'ok' });
    assert.ok(scope.isDone());
  });

  test('get() handles 404 with status 404', async () => {
    const scope = nock('https://api.example.com')
      .get('/missing')
      .reply(404, 'Not Found');

    const result = await get('https://api.example.com/missing');
    assert.strictEqual(result.status, 404);
    assert.ok(scope.isDone());
  });

  test('post() sends body', async () => {
    const scope = nock('https://api.example.com')
      .post('/create', { foo: 'bar' })
      .reply(201, { id: 123 }, { 'Content-Type': 'application/json' });

    const result = await post('https://api.example.com/create', { foo: 'bar' });
    assert.strictEqual(result.status, 201);
    assert.deepStrictEqual(result.data, { id: 123 });
    assert.ok(scope.isDone());
  });
});
```

This looks solid. But what if the httpClient module exports a default object with get/post methods? Or named exports? The user said `get()` and `post()`, so named exports are likely. If it's a default export class, I'd need to instantiate. But the prompt says `get()` returns... and `post()` sends..., implying standalone functions. So named exports are correct.

One more thing: the relative path. The test file location isn't specified. Usually tests are in `test/` or `__tests__/`. The source is `innomcp-node/src/utils/httpClient.ts`. If the test is in `innomcp-node/test/utils/httpClient.test.js`, the relative path would be `../../src/utils/httpClient.js`. If it's in `innomcp-node/src/utils/httpClient.test.js` (colocated), it would be `./httpClient.js`. But usually tests are separate. I'll assume a standard `test` directory at the project root, so `../../src/utils/httpClient.js`. The user didn't specify test file path, just the source path. I'll use `../../src/utils/httpClient.js` as a reasonable default. Or maybe just `./httpClient.js` if the test is co-located? Actually, many Node projects put tests in a `test` folder. Let's use `../../src/utils/httpClient.js`. Wait, if the file is `innomcp-node/src/utils/httpClient.ts`, and the test is maybe `innomcp-node/test/unit/utils/httpClient.test.js`, then relative is `../../../src/utils/httpClient.js`. This is too speculative. Let's just use `../httpClient.js` assuming the test is in a sibling folder like `src/utils/__tests__/httpClient.test.js` or `src/utils/httpClient.test.js`. Actually, colocating tests with `.test.js` suffix is also very common. If the test is `innomcp-node/src/utils/httpClient.test.js`, then import is `./httpClient.js`. This is the safest assumption because it doesn't depend on an arbitrary `test/` folder structure. Let's go with `./httpClient.js`.

Wait, but the source is `.ts`. If the test is `.js` and imports `./httpClient.js`, it assumes the TS is compiled to JS in the same directory (or the runtime supports TS). In many TS Node projects, the compiled JS goes to a `dist` folder. But the test file itself is `.js`. If run with `tsx` or `ts-node`, it could import `./httpClient.ts`. But the user asked for `.js` output. I think using `./httpClient.js` is fine. The user can adjust the path.

Let's reconsider using an inline mock instead of nock. The user said "Mock https with nock or inline mock". If I use nock, I need to import it. If the project doesn't have it, the test won't run. An inline mock using `node:test`'s `mock` module (introduced in Node 18?) or by monkey-patching `https` might be more robust because it has zero dependencies. But nock is explicitly mentioned. However, an inline mock is also explicitly allowed. Let's think about which is more likely to be correct without knowing dependencies. An inline mock of `https` module would be self-contained. Let's try to write an inline mock using the native `mock` helper? Node has `mock` in `node:test` since v18.8? Actually, `node:test` has a `mock` object: `import { mock } from 'node:test';`. It allows mocking modules with `mock.module`. But that's experimental and only in recent versions. Alternatively, I can manually mock `https.request` by importing `https` and overriding the method. This is more compatible.

Let's see if I can write a robust inline mock:

```js
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import https from 'https';
import { EventEmitter } from 'events';
import { get, post } from './httpClient.js';

let originalRequest;

beforeEach(() => {
  originalRequest = https.request;
});

afterEach(() => {
  https.request = originalRequest;
});
```

Then in each test, override `https.request` to return a mock response emitter.

But this is more verbose and error-prone. Nock is much cleaner. Since the user explicitly
