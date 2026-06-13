<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T073 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1327,"completion_tokens":8000,"total_tokens":9327,"prompt_tokens_details":{"cached_tokens":72,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 72s
 generated: 2026-06-13T11:07:18.908Z -->
The user wants a Jest unit test for the `providers` router module in `innomcp-node`.

Key constraints:
1. Import the module under test EXACTLY as: `import ... from '../src/routes/api/providers';`
2. Only test the PUBLIC exported API actually present in the source. The source exports `default router`. So I need to import the default export and test it as an Express router/middleware. Since it's a Router instance, I can test it using `supertest` or by invoking the route handlers directly. However, the instructions say "Only test the PUBLIC exported API actually present in the source". The exported API is the router itself. To test a router properly, we usually mount it in a mini Express app and use supertest, or we can test the route handlers by extracting them, but they are not exported individually. The exported thing is `default router`.
   Wait, can I use supertest? Supertest would make HTTP calls to a live server, but the instructions say "pass without a live server or DB". I can create an Express app in the test, mount the router, and use supertest. Supertest doesn't require a live server (it binds to an ephemeral port or uses `.send()` directly). Actually, supertest works with an app object without starting a server on a real port. This is standard for offline unit tests.
   Alternatively, I can iterate through the router stack and call the handlers directly with mock `req` and `res` objects. This is more "unit test" like and avoids any network stack. But supertest is also common. However, the instructions say "pass without a live server or DB". Supertest with `app` (not a server URL) is fine and doesn't need a live server. But it might be slightly more complex to set up. Let's see if there are any dependencies to mock.
   The module imports `express`, `../../providers/registry`, `../../providers/types`, `../../providers/router`. These need to be mocked.
   If I use supertest, I need `express` to be real or mocked? Usually, we let `express` be real but mock the internal modules. That's fine.
   But the instructions say "Mock external dependencies (db, network, other services, fs) with jest.mock()". `express` is an external dependency, but it's common to use the real `express` in router tests. However, `fetch` is used inside the router for the `/test` endpoint. `fetch` is a global network function. I need to mock it. In Node 18+, `fetch` is global. I should mock `global.fetch`.
   Also, `AbortController` and `setTimeout`/`clearTimeout` are used. The instructions say "Use fake timers for any time/interval logic." So I need `jest.useFakeTimers()`.

Let's analyze the routes:
- `GET /` -> calls `listProviders()`, maps `toPublicView`, returns JSON.
- `POST /` -> calls `createProvider(req.body)`, returns 201 with `toPublicView`, or 400 on error.
- `PATCH /:id` -> calls `updateProvider(id, req.body)`, returns 404 if null, else 200 with `toPublicView`.
- `DELETE /:id` -> calls `deleteProvider(id)`, returns 404 if false, else 204.
- `POST /:id/test` -> calls `getProvider(id)`, if not found 404. Then probes `fetch(probeUrl)`. Uses `AbortController` and `setTimeout`. Then `setHealth(id, ...)`. Then returns `toPublicView(getProvider(id)!)` and probe result.
- `POST /route-preview` -> calls `previewSelection({mode, capabilities, privacyLevel})` and returns JSON.

So I need to mock:
- `../../providers/registry`: `listProviders`, `getProvider`, `createProvider`, `updateProvider`, `deleteProvider`, `setHealth`.
- `../../providers/types`: `toPublicView`.
- `../../providers/router`: `previewSelection`, and types `ChatMode`, `Capability`, `PrivacyLevel` (but types are compile-time only, so the mock only needs the runtime value `previewSelection`).
- `express`: The router itself uses `Router()`. If I import the router and mount it, `express` will be used. I don't necessarily need to mock `express` if I just mount the router in a test app. But is `express` considered an external dependency to mock? The rule says "Mock external dependencies (db, network, other services, fs)". `express` is the framework; usually we don't mock it for router integration tests. However, if I want to be strict, I could mock it, but it's very hard to mock `Router` to behave like real middleware. Better to use real `express` and mock the *data* layers. The network call (`fetch`) must be mocked. `db` would be the registry functions.

Wait, the instruction says "Only test the PUBLIC exported API actually present in the source below. Do not invent methods." The public exported API is `default router`. So I should test the router by making requests against it. Using `supertest` with a small Express app is the best way.

Let's plan the test file structure.

```typescript
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import providersRouter from '../src/routes/api/providers';
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setHealth,
} from '../../providers/registry';
import { toPublicView } from '../../providers/types';
import { previewSelection } from '../../providers/router';
```

Wait, the import path for the module under test is EXACTLY `../src/routes/api/providers`. The mocks for the dependencies should use the paths relative to the test file, which is in `innomcp-node/tests/`. So the source is `../src/...`. The dependencies are `../../providers/...` relative to the source file `src/routes/api/providers.ts`. But in the test file, which is `tests/something.test.ts`, the path to those modules would be `../src/providers/registry`. Wait, let's map:
- Test file: `innomcp-node/tests/providers.test.ts` (assumed)
- Module under test: `../src/routes/api/providers`
- `../../providers/registry` from the source's perspective is `src/providers/registry`.
- From the test file, that would be `../src/providers/registry`.

So the `jest.mock` calls should look like:
```typescript
jest.mock('../src/providers/registry', () => ({ ... }));
jest.mock('../src/providers/types', () => ({ ... }));
jest.mock('../src/providers/router', () => ({ ... }));
```

Wait, is `toPublicView` a pure function? The mock should probably just return a transformed object or a simple passthrough. Since we don't know its implementation, we mock it. Same for `previewSelection`.

Let's define the mocks.

```typescript
jest.mock('../src/providers/registry', () => ({
  listProviders: jest.fn(),
  getProvider: jest.fn(),
  createProvider: jest.fn(),
  updateProvider: jest.fn(),
  deleteProvider: jest.fn(),
  setHealth: jest.fn(),
}));

jest.mock('../src/providers/types', () => ({
  toPublicView: jest.fn((p) => ({ ...p, hasApiKey: true })), // or something simple
}));

jest.mock('../src/providers/router', () => ({
  previewSelection: jest.fn(),
}));
```

I need to import the mocked functions to control them.
```typescript
import { listProviders, getProvider, createProvider, updateProvider, deleteProvider, setHealth } from '../src/providers/registry';
import { toPublicView } from '../src/providers/types';
import { previewSelection } from '../src/providers/router';
```

Wait, the types `ChatMode`, `Capability`, `PrivacyLevel` are imported as `type` only in the source. They don't exist at runtime. So I don't need to mock them from the router module, but if I import the module, TypeScript might complain if the mock doesn't export them? No, `jest.mock` replaces the module. But if I import `type` imports, they are erased. So no issue.

Now, the test setup.

```typescript
describe('providers router', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/ai/providers', providersRouter);
  });

  afterEach(() => {
    jest.useRealTimers();
  });
```

Wait, `providersRouter` is the default export. So `import providersRouter from '../src/routes/api/providers';` is correct.

Now, test cases.

1. `GET /api/ai/providers`
   - Mock `listProviders` to return an array of provider objects.
   - Mock `toPublicView` to return a public view (e.g., add `hasApiKey: true`).
   - Assert 200, `{ items: [...], count: ... }`.

2. `POST /api/ai/providers`
   - Success: mock `createProvider` to return a provider. Assert 201 and `toPublicView` called.
   - Error: mock `createProvider` to throw. Assert 400 and error message.

3. `PATCH /api/ai/providers/:id`
   - Success: mock `updateProvider` to return provider. Assert 200.
   - Not found: mock `updateProvider` to return null/undefined. Assert 404.

4. `DELETE /api/ai/providers/:id`
   - Success: mock `deleteProvider` to return true. Assert 204.
   - Not found: mock `deleteProvider` to return false. Assert 404.

5. `POST /api/ai/providers/:id/test`
   - Provider not found: `getProvider` returns undefined. Assert 404.
   - Success (healthy): `getProvider` returns provider with `baseUrl` and `timeoutMs`. Mock `fetch` to resolve with `{ status: 200 }`. Need to handle async/await with fake timers.
     - The code does `await fetch(...)`. With fake timers, `fetch` is a mock promise. Since `fetch` is mocked, it resolves immediately (or we can control it). The `setTimeout` for abort is inside the route. With fake timers, the `setTimeout` won't fire unless we advance timers. But since `fetch` resolves immediately, the `finally` block clears the timer. So it should be fine. However, if we want to test the abort path, we need to let the timer run while fetch is pending.
     - Let's mock `global.fetch`.
     - Healthy case: `fetch` resolves with status 200. `setHealth` called with "healthy". Response has `probe.ok: true`.
     - Degraded case (HTTP error): `fetch` resolves with status 500. `probe.ok: true` because `r.status >= 200 && r.status < 500` -> 500 is not < 500, so `healthy = false`. Wait, `r.status >= 200 && r.status < 500`. So 500 is false. `healthy = false`. `setHealth` called with "degraded". `detail = "HTTP 500"`.
     - Degraded case (network error): `fetch` rejects. `healthy = false`. `detail = "เชื่อมต่อไม่ได้"`.
     - Timeout case: `fetch` never resolves, timer fires. With fake timers, we can advance time. But `fetch` is a promise. If we use `jest.advanceTimersByTime(3000)`, the `setTimeout` callback runs, calling `controller.abort()`. The `fetch` mock should be configured to reject with `AbortError` when aborted. This is tricky because `AbortController` is real. We can mock `global.fetch` to return a promise that rejects with `AbortError` if the signal is aborted. Or simpler: mock `fetch` to return a promise that never resolves, then advance timers. The `AbortController` will abort, but the mock `fetch` won't know unless we check the signal. A simpler way: mock `fetch` to reject with `{ name: 'AbortError' }` directly. But to test the timer logic, we should let the timer trigger. Let's think.
     - The route uses `const controller = new AbortController();` and passes `controller.signal` to `fetch`. If we mock `fetch` to just hang (return `new Promise(() => {})`), then when the timer fires and `controller.abort()` is called, the mock `fetch` won't react. The `await fetch(...)` will never settle, and the test will hang. So we need the mock `fetch` to listen to the signal or we need to manually trigger the rejection.
     - Actually, we can mock `fetch` like:
       ```typescript
       const fetchMock = jest.fn().mockImplementation(({ signal }) => {
         return new Promise((resolve, reject) => {
           if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
           signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
           // otherwise resolve after some time or immediately
         });
       });
       ```
       But `DOMException` might not be available in Node test environment without jsdom. Node 18+ has `AbortError` for fetch. We can just create an error object: `const err = new Error('Aborted'); err.name = 'AbortError';`.
     - With fake timers, `setTimeout` is mocked. The route does `setTimeout(() => controller.abort(), ...)`. So if we advance timers past the timeout, `controller.abort()` is called. If our mock `fetch` listens to `signal`, it will reject. Then the `await` finishes. This tests the timer logic properly.
     - However, `AbortController` in Node with fake timers: `controller.abort()` is synchronous. The `abort` event on `signal` is dispatched. If we add an event listener in the mock, it should work. But `addEventListener` on `AbortSignal` is standard in Node.
     - Let's try to keep it simple. Maybe test three cases:
       a) Healthy: fetch resolves immediately with status 200. No timer advancement needed.
       b) Unhealthy HTTP: fetch resolves with status 500.
       c) Network error: fetch rejects with generic error.
       d) Timeout: We can specifically test the timer by making fetch hang and advancing timers. But to avoid complexity with `AbortController` signal listeners and potential test hangs, maybe we can just mock `fetch` to reject with `AbortError` and verify `detail` is "หมดเวลา". But that doesn't exercise the `setTimeout`. The instructions say "Use fake timers for any time/interval logic." This implies we should test the time-based logic. So we should test the timeout path by advancing timers.
     - Let's carefully construct the timeout test.
       - `rec.timeoutMs` could be anything. Let's say `timeoutMs: 5000`. The route uses `Math.min(rec.timeoutMs, 3_000)`, so timer is 3000ms.
       - Mock `fetch` to return a promise that never resolves, but listens to signal:
         ```typescript
         global.fetch = jest.fn().mockImplementation((_url, { signal }) => {
           return new Promise((_resolve, reject) => {
             if (signal?.aborted) {
               const err = new Error('Aborted');
               err.name = 'AbortError';
               reject(err);
               return;
             }
             signal?.addEventListener('abort', () => {
               const err = new Error('Aborted');
               err.name = 'AbortError';
               reject(err);
             });
           });
         });
         ```
       - Then in the test:
         ```typescript
         const promise = request(app).post('/api/ai/providers/123/test').send();
         await jest.advanceTimersByTimeAsync(3000); // or runAllTimersAsync
         const res = await promise;
         ```
       - Wait, `request(app).post(...).send()` returns a supertest promise. The route handler is async. With fake timers, supertest might have issues if the promise inside the route doesn't resolve until timers are advanced. We need to use `jest.advanceTimersByTimeAsync` (available in Jest 29+) or `runAllTimersAsync`. The supertest request promise will resolve when the route handler finishes. If the route handler is awaiting a fetch that only rejects after timer advancement, we need to advance timers *while* the request is in flight.
       - Pattern:
         ```typescript
         const reqPromise = request(app).post('/api/ai/providers/123/test');
         await jest.advanceTimersByTimeAsync(3000);
         const res = await reqPromise;
         ```
       - This should work. `advanceTimersByTimeAsync` lets pending microtasks run. The `abort` event listener should fire.
       - But does `AbortSignal` from `AbortController` work with `addEventListener` in Node? Yes, in Node 15+. The test environment is Node.
       - However, `signal?.addEventListener` might not be available if the mock doesn't pass it? No, `fetch` is called with `{ signal: controller.signal }`. The real `controller.signal` is an `AbortSignal`. So `addEventListener` exists.
       - Let's make sure the mock `fetch` is on `global.fetch`.
       - Also, `clearTimeout(timer)` is called in `finally`. With fake timers, this works.

6. `POST /api/ai/providers/route-preview`
   - Mock `previewSelection` to return some object.
   - Assert 200 and the returned object.
   - Test default parameters: if body is empty, `mode` defaults to "local", `capabilities` defaults to `["thai-naturalness"]`, `privacyLevel` is undefined. We can verify by checking the arguments passed to `previewSelection`.

Let's think about `toPublicView`. Since it's mocked, we can make it return whatever. For simplicity, let's make it return the input object merged with `{ hasApiKey: true }` or just return `{ id: p.id, hasApiKey: true }`. It doesn't matter much, but we should verify it's called.

Let's think about provider objects. They need to have some shape, but since we mock everything, we can use plain objects.

```typescript
const mockProvider = { id: 'p1', name: 'Test', baseUrl: 'http://test', timeoutMs: 5000, apiKey: 'secret' };
```

When `toPublicView` is called, it should be called with this object.

Let's draft the tests.

```typescript
import request from 'supertest';
import express from 'express';
import providersRouter from '../src/routes/api/providers';
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setHealth,
} from '../src/providers/registry';
import { toPublicView } from '../src/providers/types';
import { previewSelection } from '../src/providers/router';

jest.mock('../src/providers/registry', () => ({
  listProviders: jest.fn(),
  getProvider: jest.fn(),
  createProvider: jest.fn(),
  updateProvider: jest.fn(),
  deleteProvider: jest.fn(),
  setHealth: jest.fn(),
}));

jest.mock('../src/providers/types', () => ({
  toPublicView: jest.fn((p: any) => ({ id: p.id, hasApiKey: true })),
}));

jest.mock('../src/providers/router', () => ({
  previewSelection: jest.fn(),
}));
```

Wait, `jest.mock` is hoisted. The imports of the mocked functions should be after the `jest.mock` calls or before? Usually, we put `jest.mock` at the top, then imports. The imports will get the mocked versions.

Now, the `fetch` mock. Since `fetch` is global, I can set it in `beforeEach`.

```typescript
const mockFetch = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  global.fetch = mockFetch;
  app = express();
  app.use(express.json());
  app.use('/api/ai/providers', providersRouter);
});
afterEach(() => {
  jest.useRealTimers();
  delete (global as any).fetch;
});
```

Wait, `clearAllMocks` will clear `mockFetch` if it's defined outside. But if I define `mockFetch` outside and assign it to `global.fetch`, `clearAllMocks` will clear its calls. That's fine. But if I re-assign `global.fetch` in beforeEach, I need to make sure `mockFetch` is a fresh function each time or I clear it. Let's do:

```typescript
let app: express.Express;
let mockFetch: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFetch = jest.fn();
  global.fetch = mockFetch as any;
  app = express();
  app.use(express.json());
  app.use('/api/ai/providers', providersRouter);
});
```

This is better.

Now, test cases in detail.

**GET /**
```typescript
test('GET / returns list of providers', async () => {
  const providers = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
  (listProviders as jest.Mock).mockReturnValue(providers);
  const res = await request(app).get('/api/ai/providers');
  expect(res.status).toBe(200);
  expect(listProviders).toHaveBeenCalled();
  expect(toPublicView).toHaveBeenCalledTimes(2);
  expect(res.body).toEqual({ items: [{ id: '1', hasApiKey: true }, { id: '2', hasApiKey: true }], count: 2 });
});
```

**POST /**
```typescript
test('POST / creates a provider', async () => {
  const payload = { name: 'New', baseUrl: 'http://new' };
  const created = { id: '3', ...payload };
  (createProvider as jest.Mock).mockReturnValue(created);
  const res = await request(app).post('/api/ai/providers').send(payload);
  expect(res.status).toBe(201);
  expect(createProvider).toHaveBeenCalledWith(payload);
  expect(toPublicView).toHaveBeenCalledWith(created);
  expect(res.body).toEqual({ provider: { id: '3', hasApiKey: true } });
});

test('POST / returns 400 on error', async () => {
  (createProvider as jest.Mock).mockImplementation(() => { throw new Error('bad input'); });
  const res = await request(app).post('/api/ai/providers').send({});
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'bad input' });
});
```

**PATCH /:id**
```typescript
test('PATCH /:id updates a provider', async () => {
  const payload = { name: 'Updated' };
  const updated = { id: '1', name: 'Updated' };
  (updateProvider as jest.Mock).mockReturnValue(updated);
  const res = await request(app).patch('/api/ai/providers/1').send(payload);
  expect(res.status).toBe(200);
  expect(updateProvider).toHaveBeenCalledWith('1', payload);
  expect(res.body).toEqual({ provider: { id: '1', hasApiKey: true } });
});

test('PATCH /:id returns 404 if not found', async () => {
  (updateProvider as jest.Mock).mockReturnValue(null);
  const res = await request(app).patch('/api/ai/providers/99').send({});
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'provider not found' });
});
```

**DELETE /:id**
```typescript
test('DELETE /:id removes a provider', async () => {
  (deleteProvider as jest.Mock).mockReturnValue(true);
  const res = await request(app).delete('/api/ai/providers/1');
  expect(res.status).toBe(204);
  expect(deleteProvider).toHaveBeenCalledWith('1');
});

test('DELETE /:id returns 404 if not found', async () => {
  (deleteProvider as jest.Mock).mockReturnValue(false);
  const res = await request(app).delete('/api/ai/providers/99');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'provider not found' });
});
```

**POST /:id/test**
This is the tricky one.

First, provider not found:
```typescript
test('POST /:id/test returns 404 if provider not found', async () => {
  (getProvider as jest.Mock).mockReturnValue(undefined);
  const res = await request(app).post('/api/ai/providers/1/test').send();
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'provider not found' });
});
```

Healthy case:
```typescript
test('POST /:id/test marks healthy on reachable endpoint', async () => {
  const provider = { id: '1', baseUrl: 'http://test', timeoutMs: 5000 };
  (getProvider as jest.Mock).mockReturnValue(provider);
  mockFetch.mockResolvedValue({ status: 200 });
  const res = await request(app).post('/api/ai/providers/1/test').send();
  expect(res.status).toBe(200);
  expect(mockFetch).toHaveBeenCalledWith('http://test', { method: 'GET', signal: expect.any(AbortSignal) });
  expect(setHealth).toHaveBeenCalledWith('1', 'healthy');
  expect(res.body.probe).toEqual({ ok: true, detail: 'HTTP 200' });
});
```

Wait, `expect.any(AbortSignal)` might not work if `AbortSignal` is not in the global scope or if the test environment doesn't recognize it. In Node, `AbortSignal` is global. But to be safe, maybe `expect.anything()` for signal. Or just check the URL and method. Let's check `expect.any(AbortSignal)`. It should be fine in Node 18+.

Degraded case (HTTP 500):
```typescript
test('POST /:id/test marks degraded on HTTP 500', async () => {
  const provider = { id: '1', baseUrl: 'http://test', timeoutMs: 5000 };
  (getProvider as jest.Mock).mockReturnValue(provider);
  mockFetch.mockResolvedValue({ status: 500 });
  const res = await request(app).post('/api/ai/providers/1/test').send();
  expect(setHealth).toHaveBeenCalledWith('1', 'degraded');
  expect(res.body.probe).toEqual({ ok: false, detail: 'HTTP 500' });
});
```

Network error:
```typescript
test('POST /:id/test marks degraded on network error', async () => {
  const provider = { id: '1', baseUrl: 'http://test', timeoutMs: 5000 };
  (getProvider as jest.Mock).mockReturnValue(provider);
  mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
  const res = await request(app).post('/api/ai/providers/1/test').send();
  expect(setHealth).toHaveBeenCalledWith('1', 'degraded');
  expect(res.body.probe).toEqual({ ok: false, detail: 'เชื่อมต่อไม่ได้' });
});
```

Timeout/Abort case:
```typescript
test('POST /:id/test marks degraded on timeout', async () => {
  const provider = { id: '1', baseUrl: 'http://test', timeoutMs: 5000 };
  (getProvider as jest.Mock).mockReturnValue(provider);
  
  // Mock fetch to hang and reject on abort signal
  mockFetch.mockImplementation((_url: string, { signal }: { signal: AbortSignal }) => {
    return new Promise((_resolve, reject) => {
      if (signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
        return;
      }
      signal.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  });

  const reqPromise = request(app).post('/api/ai/providers/1/test').send();
  // Advance past the 3000ms cap
  await jest.advanceTimersByTimeAsync(3000);
  const res = await reqPromise;

  expect(setHealth).toHaveBeenCalledWith('1', 'degraded');
  expect(res.body.probe).toEqual({ ok: false, detail: 'หมดเวลา' });
});
```

Wait, `jest.advanceTimersByTimeAsync` is available in Jest 29+. If not, we can use `jest.runAllTimersAsync()` or `jest.advanceTimersByTime(3000)` and then `await Promise.resolve()` etc. But `advanceTimersByTimeAsync` is the safest for async code. Let's assume modern Jest. The prompt doesn't specify Jest version, but `ts-jest` is usually used with recent Jest. I'll use `jest.advanceTimersByTimeAsync(3000)`.

One subtlety: The route does `const timer = setTimeout(() => controller.abort(), Math.min(rec.timeoutMs, 3_000));`. If `rec.timeoutMs` is 5000, timer is 3000. If `rec.timeoutMs` is 1000, timer is 1000. Let's test with a provider that has a small timeout to be thorough? Or just use 5000 and advance 3000. That's fine.

Also, `getProvider` is called twice in the success case: once to check existence, and once at the end `getProvider(id)!` for the response. So `getProvider` will be called twice. My mock `mockReturnValue(provider)` will return the same object both times. That's fine.

Wait, in the timeout test, `getProvider` is called at the start. Then after the probe, it's called again in the `res.json(...)`. So `toPublicView` is called with `getProvider(id)!`. Since `getProvider` is mocked, it returns the provider. `toPublicView` returns `{ id: provider.id, hasApiKey: true }`. So `res.body.provider` should be that.

Let's verify the response body for the test endpoint:
```typescript
res.json({
  provider: toPublicView(getProvider(id)!),
  probe: { ok: healthy, detail },
});
```
So `res.body.provider` will be the mocked public view.

**POST /route-preview**
```typescript
test('POST /route-preview returns preview result', async () => {
  const previewResult = { providerId: 'p1', score: 99 };
  (previewSelection as jest.Mock).mockReturnValue(previewResult);
  const res = await request(app).post('/api/ai/providers/route-preview').send({
    mode: 'cloud',
    capabilities: ['speed'],
    privacyLevel: 'strict',
  });
  expect(res.status).toBe(200);
  expect(previewSelection).toHaveBeenCalledWith({
    mode: 'cloud',
    capabilities: ['speed'],
    privacyLevel: 'strict',
  });
  expect(res.body).toEqual(previewResult);
});

test('POST /route-preview uses defaults when body is empty', async () => {
  (previewSelection as jest.Mock).mockReturnValue({});
  const res = await request(app).post('/api/ai/providers/route-preview').send({});
  expect(previewSelection).toHaveBeenCalledWith({
    mode: 'local',
    capabilities: ['thai-naturalness'],
    privacyLevel: undefined,
  });
});
```

Wait, the source code:
```typescript
const body = (req.body || {}) as { ... };
const mode: ChatMode = body.mode || "local";
const capabilities: Capability[] = Array.isArray(body.capabilities) ? body.capabilities : ["thai-naturalness"];
const privacyLevel: PrivacyLevel | undefined = body.privacyLevel;
const result = previewSelection({ mode, capabilities, privacyLevel });
```
Yes, defaults are correct.

One more thing: `express.json()` middleware is needed for POST/PATCH requests to parse JSON bodies. Using `supertest` with `express` app requires this.

Are there any TypeScript strict issues?
- `jest.mock` returns `jest.Mock` but we need to cast when using them, e.g., `(listProviders as jest.Mock)`. Or we can use `jest.mocked(listProviders)`. `jest.mocked` is cleaner and type-safe.
- Since the imports are from mocked modules, TypeScript might infer them as `jest.Mock` automatically if `ts-jest` config is right? Not always. Using `jest.mocked(...)` is best for strict TS.
- Example: `jest.mocked(listProviders).mockReturnValue(...)`.
- Let's use `jest.mocked` for all mocked functions.

Let's refine the imports and mocks.

```typescript
import request from 'supertest';
import express from 'express';
import providersRouter from '../src/routes/api/providers';
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setHealth,
} from '../src/providers/registry';
import { toPublicView } from '../src/providers/types';
import { previewSelection } from '../src/providers/router';

jest.mock('../src/providers/registry');
jest.mock('../src/providers/types');
jest.mock('../src/providers/router');
```

With `jest.mock('...')` without factory, it auto-mocks the modules. Then `jest.mocked` wraps them.

```typescript
const mockedListProviders = jest.mocked(listProviders);
const mockedGetProvider = jest.mocked(getProvider);
...
```

This is very clean and TypeScript strict friendly.

Let's write the full code.

One concern: `supertest` is an external dependency. Is it okay to import? The prompt doesn't say we can't use testing utilities. It says mock external dependencies like db, network, etc. `supertest` is a test helper, not the system under test's dependency. The system under test depends on `express`. We are using real `express` to host the router. Is that allowed? The prompt says "Mock external dependencies (db, network, other services, fs)". `express` is a framework, not a service/db/network. Using real `express` for router tests is standard and acceptable. The tests will still be deterministic and offline.

Another concern: `AbortSignal` in `expect.any(AbortSignal)`. In Node test environment, `AbortSignal` is available globally. So `expect.any(AbortSignal)` should compile and work. If there's any doubt, I can use `expect.anything()` for the `signal` property. Let's use `expect.anything()` to be safe against TS strict issues where `AbortSignal` might not be in the global type namespace in the test context. Actually, in Node 18+, it is. But `expect.any(AbortSignal)` is fine.

Let's check the `fetch` mock signature. The route calls `fetch(probeUrl, { method: "GET", signal: controller.signal })`. So `mockFetch.mock.calls[0][1].signal` should be an `AbortSignal`.

In the timeout test, we need to be careful with `signal.addEventListener`. The `AbortSignal` from Node's `AbortController` does have `addEventListener`. However, if the signal is already aborted when `fetch` is called (which shouldn't happen), the mock handles it. The event listener approach is solid.

Wait, `jest.advanceTimersByTimeAsync` might not be available in all Jest versions. The alternative is:
```typescript
const reqPromise = request(app).post('/api/ai/providers/1/test').send();
jest.advanceTimersByTime(3000);
const res = await reqPromise;
```
But with `supertest`, the request promise might not resolve if the timers are advanced synchronously because the abort event might be processed in a microtask. `advanceTimersByTimeAsync` (or `runAllTimersAsync`) is safer because it yields to the event loop. Let's assume Jest 27+ has `runAllTimersAsync`. Actually, `advanceTimersByTimeAsync` was added in Jest 29.3.0. If we want to be more compatible, we can use `runAllTimersAsync()` since there's only one timer. Or we can do:
```typescript
const reqPromise = request(app).post('/api/ai/providers/1/test').send();
await Promise.resolve(); // let the route handler start
jest.advanceTimersByTime(3000);
await Promise.resolve(); // let the abort event propagate
const res = await reqPromise;
```
This is brittle. Let's stick with `jest.advanceTimersByTimeAsync(3000)` or `jest.runAllTimersAsync()`. I'll use `jest.advanceTimersByTimeAsync(3000)`.

Actually, looking at the Jest docs, `jest.advanceTimersByTimeAsync` is indeed available in recent versions. Given the prompt mentions `ts-jest` and modern setup, it's reasonable.

Let's double check the `fetch` mock for the timeout case. The route does:
```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), Math.min(rec.timeoutMs, 3_000));
let healthy = false;
let detail = "...";
try {
  const r = await fetch(probeUrl, { method: "GET", signal: controller.signal });
  ...
} catch (err: any)
