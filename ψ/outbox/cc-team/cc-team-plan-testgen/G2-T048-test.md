<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T048 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":629,"completion_tokens":8000,"total_tokens":8629,"prompt_tokens_details":{"cached_tokens":69,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 93s
 generated: 2026-06-13T11:02:37.414Z -->
The user wants a Jest unit test for the `analyze` module in `innomcp-node`. Let me analyze the requirements and the source code carefully.

Source code: `innomcp-node/src/routes/api/analyze.ts`
- It exports a default `Router` from express.
- It uses `analyzeData` from `../../services/dataAnalysisTool`.
- It uses `node:path`.
- The route is `POST /`.
- It reads `req.body` for `csv` and `filePath`.
- It checks if both are missing, returns 400.
- It calls `analyzeData` with either a string (csv) or an object `{ path, workspaceRoot }`.
- It returns JSON result or 400 error.

Requirements:
1. Import EXACTLY as: `import ... from '../src/routes/api/analyze';`
2. Only test public exported API. The export is `default router`.
3. Mock external dependencies: `express`, `../../services/dataAnalysisTool`, `node:path` (maybe not needed if we mock analyzeData), `process.env`? Actually, we should mock the dependencies to keep it deterministic.
4. Use fake timers if there's time/interval logic. There isn't any in this code. But the exemplar shows fake timers. The instructions say "Use fake timers for any time/interval logic." Since there is none, I don't necessarily need them, but I can include them if I want to follow the exemplar style? Actually, the rule says "Use fake timers for any time/interval logic." Since there is none, I don't need fake timers. But the exemplar has them. However, I should not add unnecessary complexity. But wait, the instruction says "Use fake timers for any time/interval logic." This is conditional. No time logic here, so no fake timers needed. But to be safe and follow the "mirror this shape" style? The style exemplar is just an example of shape, not a requirement to use fake timers if not needed. I'll skip fake timers since there's no time logic.
5. Must compile under strict TypeScript and pass without live server or DB.
6. Output: ONE fenced typescript code block containing COMPLETE test file and NOTHING else.

How to test an Express router without a live server?
We can import the router and test it by mocking Express's Router and the dependencies.
Since the export is `default router`, we need to test the router instance. But to test it without a server, we can invoke the route handlers directly if we can extract them, or we can use `supertest`? But supertest would require an app. The instructions say "pass without a live server". We can test by mocking `express.Router` to return an object where we can capture the registered handlers, then invoke them manually with mocked `req` and `res` objects.

Alternatively, we can test by mounting the router in a small app using `express()` in the test, but that might require importing `express` which is fine, but does it count as a live server? No, we don't listen. But the instructions say "offline" and "no live server". Using supertest with an express app that isn't listening is standard. However, supertest is an external dependency that might not be available? The prompt doesn't mention it. Better to mock `express` and call the handler directly to be safe and strictly offline.

Let's mock `express` to capture the route handlers.

Mocking strategy:
- `jest.mock('express', ...)` to return a mock where `Router` returns a mock router object with `.post()` etc.
- `jest.mock('../../services/dataAnalysisTool', ...)` to mock `analyzeData`.
- `jest.mock('node:path', ...)` maybe not needed if we mock analyzeData and the path logic is inside the module initialization. But `WORKSPACE_ROOT` is evaluated at module load time. It uses `process.env.WORKSPACE_ROOT` and `path.resolve`. To make it deterministic, we should control `process.env.WORKSPACE_ROOT` or mock `path`. However, since the module is imported at test time, the module-level code runs. If we mock `path`, we can control `path.resolve`. But actually, the `analyzeData` mock will just ignore the workspaceRoot passed to it? No, the code passes `WORKSPACE_ROOT` to `analyzeData`. We don't need to assert on the exact value of `WORKSPACE_ROOT` if we mock `analyzeData` and just check that it was called with the right arguments. But the module-level `WORKSPACE_ROOT` is computed at import time. If we don't mock `path`, it will use the real `path.resolve` with `process.cwd()`, which is deterministic enough (it's just a string path). However, to be fully deterministic and offline, maybe we should mock `node:path` to return predictable strings.

Wait, the code does:
```typescript
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");
```

If we don't set `process.env.WORKSPACE_ROOT`, it will resolve to something based on `process.cwd()`. That's fine, it's deterministic in the test environment. But we might want to avoid side effects. Let's just set `process.env.WORKSPACE_ROOT` in the test or mock `path`. Actually, mocking `node:path` might be tricky because `path.resolve` is used. Let's just mock `path` to return predictable paths.

But there's a catch: the module under test is imported exactly as `import analyzeRouter from '../src/routes/api/analyze';`. Since the module runs top-level code immediately upon import, if we want to mock dependencies before the module loads, we need to use `jest.mock` before the import. In Jest, `jest.mock` calls are hoisted, so that's fine.

Let's design the test:

```typescript
import analyzeRouter from '../src/routes/api/analyze';
```

But `analyzeRouter` is the default export, which is the router instance. Since we mock `express.Router`, it will be a mock object.

Let's mock express:

```typescript
jest.mock('express', () => ({
  Router: jest.fn(() => ({
    post: jest.fn((path, handler) => {
      // store handler
      routerHandlers.post = handler;
    }),
    // other methods if needed
  })),
}));
```

But we need to access the handler. Let's create a helper.

Actually, a cleaner pattern:

```typescript
const mockPostHandler = jest.fn();
jest.mock('express', () => ({
  Router: jest.fn(() => ({
    post: mockPostHandler,
    get: jest.fn(),
    // ...
  })),
}));
```

Wait, `mockPostHandler` defined before `jest.mock` might not work because of hoisting? Actually, variables used in `jest.mock` factory must be prefixed with `mock` to be accessible. So:

```typescript
const mockRouter = {
  post: jest.fn(),
  get: jest.fn(),
  use: jest.fn(),
};
jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}));
```

But `mockRouter` is defined outside and referenced inside the factory. Jest allows this if the variable starts with `mock`. Yes, that's a Jest convention.

Then after importing the module, `mockRouter.post` will have been called with `('/', handler)`. We can extract the handler:

```typescript
const postHandler = mockRouter.post.mock.calls[0][1] as (req: any, res: any) => Promise<void>;
```

Wait, `router.post("/", async (req, res) => {...})`. So `mockRouter.post` is called with `"/"` and the async handler.

Let's mock `node:path` to control `path.resolve`:

```typescript
jest.mock('node:path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
}));
```

But `path.resolve` is used in the module top-level. With this mock, `WORKSPACE_ROOT` will be something predictable if `process.env.WORKSPACE_ROOT` is set, or `process.cwd() + '/../workspace'`. That's fine.

Let's mock `analyzeData`:

```typescript
const mockAnalyzeData = jest.fn();
jest.mock('../../services/dataAnalysisTool', () => ({
  analyzeData: mockAnalyzeData,
}));
```

Wait, the import path in the source is `../../services/dataAnalysisTool`. The test is in `innomcp-node/tests/`. So from `tests/`, `../../services/dataAnalysisTool` would be wrong? Wait, the test file is in `innomcp-node/tests/`. The module under test is imported as `../src/routes/api/analyze`. So the test file path relative to the module is `../../tests/something`. But for mocking, Jest resolves modules relative to the test file. The test file is at `<root>/tests/analyze.test.ts` (assuming). The source is at `<root>/src/routes/api/analyze.ts`. The import inside the source is `../../services/dataAnalysisTool` which from `src/routes/api/` goes to `src/services/dataAnalysisTool`.

From the test file at `tests/analyze.test.ts`, to mock the module imported by the source, we need to use the same path relative to the test file? No, Jest's `jest.mock` paths are relative to the file calling `jest.mock`. Actually, Jest module resolution for mocks is based on the test file location. So if the test is at `tests/analyze.test.ts`, and the source imports `../../services/dataAnalysisTool`, from the test's perspective, that module would be at `../src/services/dataAnalysisTool`? Let's check:

- Source file: `src/routes/api/analyze.ts`
- Source import: `../../services/dataAnalysisTool` -> `src/services/dataAnalysisTool`
- Test file: `tests/analyze.test.ts` (or similar)
- Relative from test to service: `../src/services/dataAnalysisTool`

But wait, the prompt says "Mock external dependencies ... with jest.mock()". It doesn't specify the exact mock path. I need to figure out the correct path.

Actually, in Jest, when you mock a module, you use the path as it would be imported from the test file. However, if the module is a transitive dependency, you can mock it by its absolute or relative path from the test file. But there's a catch: if the source imports `../../services/dataAnalysisTool`, and the test is in `tests/`, the test would need to mock `../src/services/dataAnalysisTool` because from `tests/`, `../src/services/dataAnalysisTool` resolves to the same file. But does Jest's module registry key match? Yes, because Node module resolution resolves to the same file path.

Alternatively, we can mock `../../services/dataAnalysisTool` from the test file? Let's see: from `tests/analyze.test.ts`, `../../services/dataAnalysisTool` would go to `services/dataAnalysisTool` at the project root? No, `tests/` is one directory. `../../` goes above the project root. That's wrong.

So the correct mock path from the test file is `../src/services/dataAnalysisTool`.

Wait, but some Jest setups allow mocking by the path as imported in the source? No, `jest.mock` uses the same resolution algorithm as `require`/`import` from the test file. So yes, from `tests/`, the service module is at `../src/services/dataAnalysisTool`.

Similarly, `node:path` is a built-in, so `jest.mock('node:path')` works from anywhere.

And `express` is `express`.

Let me double-check the directory structure:
- `innomcp-node/src/routes/api/analyze.ts`
- `innomcp-node/tests/` (test file here)

So from `innomcp-node/tests/`, `../src/routes/api/analyze` is correct.
From `innomcp-node/tests/`, `../src/services/dataAnalysisTool` is the correct path to the service.

Now, what about `process.env.WORKSPACE_ROOT`? The module evaluates it at load time. To make it deterministic, we can set `process.env.WORKSPACE_ROOT` before importing the module. But since the import is at the top, we need to set it before the import. However, in TypeScript with Jest, imports are hoisted. We can set `process.env.WORKSPACE_ROOT` in a `beforeAll`? No, the module is loaded when imported. So we need to set it before the import statement. But the import statement is at the top. We can do:

```typescript
process.env.WORKSPACE_ROOT = '/fake/workspace';
import analyzeRouter from '../src/routes/api/analyze';
```

But in TypeScript/ES modules, imports are hoisted and evaluated before other code. However, setting `process.env` before the import in the same file might work because the code runs top-to-bottom, but imports are hoisted by the transpiler? Actually, in CommonJS (which ts-jest typically transpiles to), `require` calls are not hoisted. But with `import` syntax, TS transpiles them. In ts-jest with default settings, it might preserve `import` statements or transpile to `require`. If it transpiles to `require`, the `process.env` line runs before the `require` if it's placed above it. But if it's below, it's hoisted? No, `require` is not hoisted. But `import` statements in TS are sometimes moved to the top by the transpiler. Actually, TypeScript does not hoist imports to the top in the emitted JS when targeting CommonJS? Let me recall: TypeScript converts ES modules to CommonJS by placing `require` calls at the location of the import in the source, but sometimes it moves them? I think it preserves order. However, to be safe, we can mock `node:path` so that `path.resolve` returns a fixed value regardless of `process.env`. That way we don't need to worry about `process.env` timing.

Let's mock `node:path`:

```typescript
jest.mock('node:path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
  sep: '/',
}));
```

But `path.resolve` is used with `process.env.WORKSPACE_ROOT` and `process.cwd()`. If we mock it, we control the output.

Actually, we can also just not mock `node:path` and let it compute a path. The test doesn't need to assert the exact path string if we mock `analyzeData` and just verify it was called with an object containing `workspaceRoot` that matches whatever `WORKSPACE_ROOT` was. But `WORKSPACE_ROOT` is computed at module load and we can't easily access it. However, we can compute the expected path in the test using the same logic? That would couple the test to the implementation. Better to mock `path` or `process.env`.

Alternatively, we can avoid asserting the exact value of `workspaceRoot` by using `expect.any(String)` or by capturing it. But the code passes `WORKSPACE_ROOT` which is a module-level constant. We could spy on `analyzeData` and just check that the second argument is `{ workspaceRoot: expect.any(String) }`. That's loose but acceptable.

But the prompt says "Keep tests deterministic and offline." Using `expect.any(String)` is fine. However, to be thorough, maybe we should assert the exact behavior.

Let's think about the test cases:

1. Missing both `csv` and `filePath`: should return 400 with `{ error: "csv content or filePath required" }`.
2. With `csv`: should call `analyzeData(csv, { workspaceRoot: ... })` and return 200 with result.
3. With `filePath`: should call `analyzeData({ path: filePath, workspaceRoot: ... }, { workspaceRoot: ... })` and return 200 with result.
4. With `analyzeData` throwing an Error: should return 400 with `{ error: error.message }`.
5. With `analyzeData` throwing a non-Error: should return 400 with `{ error: "Analysis failed" }`.

To test these, we need to extract the route handler.

Let's write the mock setup:

```typescript
const mockPostHandler = jest.fn();
const mockRouter = {
  post: mockPostHandler,
  get: jest.fn(),
  use: jest.fn(),
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}));

const mockAnalyzeData = jest.fn();
jest.mock('../src/services/dataAnalysisTool', () => ({
  analyzeData: mockAnalyzeData,
}));
```

Wait, the path for the mock: from `tests/analyze.test.ts`, the service is at `../src/services/dataAnalysisTool`. Let's verify:
- `tests/` -> `../` is `innomcp-node/`.
- `innomcp-node/src/services/dataAnalysisTool` -> yes, `../src/services/dataAnalysisTool`.

But the source imports from `../../services/dataAnalysisTool`. Since `src/routes/api/` is two levels deep into `src/`, `../../` goes to `src/`. So `src/services/dataAnalysisTool`. From `tests/`, that's `../src/services/dataAnalysisTool`. So the mock path is correct.

Now, the import:

```typescript
import analyzeRouter from '../src/routes/api/analyze';
```

After this import, `mockPostHandler` should have been called. We can get the handler:

```typescript
const routeHandler = mockPostHandler.mock.calls.find(
  (call: any) => call[0] === '/'
)?.[1] as (req: any, res: any) => Promise<void>;
```

Wait, `mockPostHandler` is called with `('/', async (req, res) => {...})`. So `call[0]` is `'/'`, `call[1]` is the handler.

But we need to be careful: the import of the module triggers the top-level code, which calls `router.post(...)`. So yes, `mockPostHandler` will have a call.

Let's define a helper to create mock req/res:

```typescript
const createMockReq = (body: any) => ({ body });
const createMockRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
```

Then test cases:

```typescript
describe('analyze router', () => {
  let handler: (req: any, res: any) => Promise<void>;

  beforeAll(() => {
    // The module is already imported, extract handler
    const call = mockPostHandler.mock.calls.find((c: any) => c[0] === '/');
    handler = call?.[1];
  });

  beforeEach(() => {
    mockAnalyzeData.mockReset();
  });

  test('returns 400 when both csv and filePath are missing', async () => {
    const req = createMockReq({});
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'csv content or filePath required' });
  });

  test('analyzes csv string and returns result', async () => {
    const result = { rowCount: 1, colCount: 2, columns: ['a'], summary: {} };
    mockAnalyzeData.mockResolvedValue(result);
    const req = createMockReq({ csv: 'a,b\n1,2' });
    const res = createMockRes();
    await handler(req, res);
    expect(mockAnalyzeData).toHaveBeenCalledWith('a,b\n1,2', { workspaceRoot: expect.any(String) });
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('analyzes filePath and returns result', async () => {
    const result = { rowCount: 5, colCount: 3, columns: ['x'], summary: {} };
    mockAnalyzeData.mockResolvedValue(result);
    const req = createMockReq({ filePath: 'data.csv' });
    const res = createMockRes();
    await handler(req, res);
    expect(mockAnalyzeData).toHaveBeenCalledWith(
      { path: 'data.csv', workspaceRoot: expect.any(String) },
      { workspaceRoot: expect.any(String) }
    );
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('returns 400 with error message when analyzeData throws Error', async () => {
    mockAnalyzeData.mockRejectedValue(new Error('Bad CSV'));
    const req = createMockReq({ csv: 'x' });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad CSV' });
  });

  test('returns 400 with generic message when analyzeData throws non-Error', async () => {
    mockAnalyzeData.mockRejectedValue('oops');
    const req = createMockReq({ csv: 'x' });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Analysis failed' });
  });
});
```

Wait, there is a subtlety: `analyzeData` is imported and called. The mock needs to be set up before the module import. Since `jest.mock` is hoisted, that's fine. But `mockAnalyzeData` is defined as a variable before `jest.mock`. Jest's hoisting will move `jest.mock` to the top, but the variable `mockAnalyzeData` is not hoisted. However, the factory function in `jest.mock` references `mockAnalyzeData`. Jest allows referencing variables prefixed with `mock` from the top level of the module in `jest.mock` factories. This is a documented feature: "The factory parameter needs to be defined before the import of the module under test, but since hoisting moves `jest.mock` to the top, you need to declare the variables before any imports. However, variables that start with `mock` are allowed to be referenced." Actually, the rule is: variables declared with `const` at the top level can be referenced in `jest.mock` factories if they start with `mock`. But they must be declared before the `jest.mock` call in the source file? No, because of hoisting, the `jest.mock` call runs before the variable declaration if it's not also hoisted. Wait, `const` declarations are not hoisted in the same way. But Jest's transform handles this: it hoists `jest.mock` calls, but if the factory references a variable starting with `mock`, it will also hoist the variable declaration? Actually, Babel/Jest plugin ensures that `mock` prefixed variables are hoisted along with `jest.mock`. So this is safe.

Alternatively, to avoid any hoisting issues, we can define the mock inside the factory:

```typescript
jest.mock('../src/services/dataAnalysisTool', () => ({
  analyzeData: jest.fn(),
}));
```

Then to access it, we can import the module and use `jest.mocked` or require it. But since we need to set up mock implementations per test, we can do:

```typescript
import { analyzeData } from '../src/services/dataAnalysisTool';
const mockAnalyzeData = analyzeData as jest.MockedFunction<typeof analyzeData>;
```

But wait, the source imports from `../../services/dataAnalysisTool`. The test imports from `../src/services/dataAnalysisTool`. They resolve to the same module. So we can import it in the test and cast it. However, the prompt says "Only test the PUBLIC exported API actually present in the source below. Do not invent methods." Importing the mocked dependency to get the mock function is fine.

But the prompt also says "Import the module under test EXACTLY as: import ... from '../src/routes/api/analyze';". It doesn't say we can't import other things.

Let's consider if we should mock `express` by returning a real router? No, we want offline and deterministic.

Another approach: instead of mocking `express` and extracting the handler, we could use `supertest` with a real express app. But that requires `express` to work, and we need to create an app. The prompt says "pass without a live server". Using `supertest` doesn't start a live server (it just uses the app). But it requires the `express` module to be fully functional. Is that allowed? It's deterministic and offline. However, the prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock(). Keep tests deterministic and offline." It doesn't explicitly say we must mock express. But express is an external dependency. To be safe and follow the "mock external dependencies" rule, we should mock express or at least not rely on its full implementation. The handler extraction approach is cleaner and doesn't require supertest.

But there is a problem: if we mock `express` entirely, the module does `import { Router } from "express"; const router = Router();`. If our mock returns a plain object, that's fine. But what if the module uses other express features? It only uses `Router` and `router.post`. So mocking is fine.

However, we need to be careful with TypeScript types. The test must compile under strict TypeScript.

Let's draft the code with proper types.

```typescript
import analyzeRouter from '../src/routes/api/analyze';

// Need to type the mock router
const mockPost = jest.fn();
const mockRouter = {
  post: mockPost,
  get: jest.fn(),
  use: jest.fn(),
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}));

jest.mock('../src/services/dataAnalysisTool', () => ({
  analyzeData: jest.fn(),
}));

import { analyzeData } from '../src/services/dataAnalysisTool';
const mockAnalyzeData = analyzeData as jest.MockedFunction<typeof analyzeData>;
```

Wait, the import of `analyzeData` from `../src/services/dataAnalysisTool` will get the mocked function. That's good.

But we need to make sure `jest.mock('express', ...)` referencing `mockRouter` works. `mockRouter` is defined before `jest.mock`. Since it starts with `mock`, Jest's hoisting should handle it. But to be extra safe, we can define the mock inside the factory and then spy on the calls after import.

Actually, we can avoid the external variable reference by doing:

```typescript
jest.mock('express', () => {
  const mockPost = jest.fn();
  const mockRouter = { post: mockPost, get: jest.fn(), use: jest.fn() };
  return { Router: jest.fn(() => mockRouter) };
});
```

But then we lose the reference to `mockPost` to extract the handler later. We could store it on a global or export it, but that's messy.

Alternatively, we can use `jest.spyOn` after the fact? No, because `router` is created inside the module and we don't export it.

Wait, we can do this:

```typescript
const mockHandlers: Record<string, any> = {};

jest.mock('express', () => ({
  Router: jest.fn(() => ({
    post: jest.fn((path: string, handler: any) => {
      mockHandlers[path] = handler;
    }),
    get: jest.fn(),
    use: jest.fn(),
  })),
}));
```

Here, `mockHandlers` is defined before `jest.mock` and starts with `mock`. This should be safe.

Let's refine:

```typescript
const mockRouteHandlers: Record<string, (req: any, res: any) => Promise<void>> = {};

jest.mock('express', () => ({
  Router: jest.fn(() => ({
    post: jest.fn((path: string, handler: any) => {
      mockRouteHandlers[path] = handler;
    }),
    get: jest.fn(),
    use: jest.fn(),
  })),
}));
```

Then after importing the module, `mockRouteHandlers['/']` will be the handler.

Now for `node:path`, do we need to mock it? The code uses `path.resolve`. If we don't mock it, `WORKSPACE_ROOT` will be some path. We can just assert `expect.any(String)` for `workspaceRoot`. That avoids needing to mock `path`. But is `path` considered an external dependency? Yes. Should we mock it? The prompt says "Mock external dependencies (db, network, other services, fs) with jest.mock()." `path` is an fs-related built-in. To be strict, maybe we should mock it. But it's deterministic. However, `process.cwd()` could vary. To make the test fully deterministic, let's mock `node:path`.

```typescript
jest.mock('node:path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
  sep: '/',
}));
```

But `path.resolve` in the code is called with `process.env.WORKSPACE_ROOT` or `process.cwd(), "../workspace"`. If we mock it, we don't care about the inputs. The mock just returns `args.join('/')`. Then `WORKSPACE_ROOT` will be something like `process.env.WORKSPACE_ROOT` or `process.cwd()/../workspace`. That's fine.

Actually, we might not even need to assert the exact value of `workspaceRoot`. We can use `expect.any(String)`. But if we want to be precise, we can compute it. Let's just use `expect.any(String)` to keep it simple and robust.

Wait, the prompt says "Keep tests deterministic and offline." Using `expect.any(String)` is deterministic. So maybe we don't need to mock `path`. But to be safe and follow the rule "Mock external dependencies", I'll mock `node:path` and `express` and `dataAnalysisTool`.

Let's write the full test file.

One more thing: the module default exports `router`. Since we mock `express`, the default export is our mock router object. We import it but don't necessarily need to use it directly if we extract the handler. But the test should probably reference `analyzeRouter` to satisfy the import requirement and maybe assert it's the mock router.

Actually, the prompt says "Import the module under test EXACTLY as: import ... from '../src/routes/api/analyze';". So we must have that import. We can use `analyzeRouter` in a test to verify it's the router, but it's optional. The important thing is the import is present.

Let's write the code:

```typescript
const mockRouteHandlers: Record<string, any> = {};

jest.mock('express', () => ({
  Router: jest.fn(() => ({
    post: jest.fn((path: string, handler: any) => {
      mockRouteHandlers[path] = handler;
    }),
    get: jest.fn(),
    use: jest.fn(),
  })),
}));

jest.mock('../src/services/dataAnalysisTool', () => ({
  analyzeData: jest.fn(),
}));

jest.mock('node:path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
  sep: '/',
}));

import analyzeRouter from '../src/routes/api/analyze';
import { analyzeData } from '../src/services/dataAnalysisTool';

const mockAnalyzeData = analyzeData as jest.MockedFunction<typeof analyzeData>;

describe('analyze router', () => {
  let handler: (req: any, res: any) => Promise<void>;

  beforeAll(() => {
    handler = mockRouteHandlers['/'];
  });

  beforeEach(() => {
    mockAnalyzeData.mockReset();
  });

  const mockReq = (body: any) => ({ body });
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('exports router', () => {
    expect(analyzeRouter).toBeDefined();
    expect(analyzeRouter.post).toBeDefined();
  });

  test('returns 400 if csv and filePath are both missing', async () => {
    const req = mockReq({});
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'csv content or filePath required' });
  });

  test('analyzes csv string and returns json result', async () => {
    const result = { rowCount: 2, colCount: 3, columns: ['a', 'b'], summary: {} };
    mockAnalyzeData.mockResolvedValue(result);
    const req = mockReq({ csv: 'a,b\n1,2' });
    const res = mockRes();
    await handler(req, res);
    expect(mockAnalyzeData).toHaveBeenCalledWith('a,b\n1,2', { workspaceRoot: expect.any(String) });
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('analyzes filePath and returns json result', async () => {
    const result = { rowCount: 5, colCount: 1, columns: ['x'], summary: {} };
    mockAnalyzeData.mockResolvedValue(result);
    const req = mockReq({ filePath: 'data.csv' });
    const res = mockRes();
    await handler(req, res);
    expect(mockAnalyzeData).toHaveBeenCalledWith(
      { path: 'data.csv', workspaceRoot: expect.any(String) },
      { workspaceRoot: expect.any(String) }
    );
    expect(res.json).toHaveBeenCalledWith(result);
  });

  test('returns 400 with error message when analyzeData throws an Error', async () => {
    mockAnalyzeData.mockRejectedValue(new Error('Invalid format'));
    const req = mockReq({ csv: 'x' });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid format' });
  });

  test('returns 400 with generic message when analyzeData throws a non-Error', async () => {
    mockAnalyzeData.mockRejectedValue('some string error');
    const req = mockReq({ csv: 'x' });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Analysis failed' });
  });
});
```

Wait, there is a potential issue: `jest.mock('node:path', ...)` might affect other things? No, it's fine.

But is `expect.any(String)` available in Jest? Yes, it's `expect.any(String)`.

One more check: the module uses `process.env.WORKSPACE_ROOT`. If we don't set it, and we mock `path.resolve`, then `path.resolve(process.cwd(), "../workspace")` will be called. Our mock returns `process.cwd()/../workspace` (joined with `/`). That's fine.

However, there is a subtle TypeScript issue: `mockRouteHandlers` is typed as `Record<string, any>`. The handler is `async (req, res) => void`. In the test, we call `await handler(req, res)`. TypeScript strict mode might complain about `any`. But since it's a test file, `any` is acceptable. We could define more precise types:

```typescript
type Handler = (req: any, res: any) => Promise<void>;
const mockRouteHandlers: Record<string, Handler> = {};
```

But then the assignment inside the jest.mock factory might have type issues because the factory returns `jest.fn()` which is `Mock<any, any>`. It's fine.

Actually, the `jest.mock` factory function is inside a call that expects a specific return type. The return type is `typeof import('express')` roughly. But since it's a mock, returning an object with `Router` is fine.

Let's consider if we need to use fake timers. The prompt says "Use fake timers for any time/interval logic." There is none. So we don't need them.

Let's double-check the import path for the mock of `dataAnalysisTool`. The test file is in `innomcp-node/tests/`. The source is in `innomcp-node/src/routes/api/analyze.ts`. The source imports `../../services/dataAnalysisTool`. From `tests/`, the correct path to mock is `../src/services/dataAnalysisTool`. Yes.

But wait, what if the test file is named `analyze.test.ts` and located in `tests/routes/api/analyze.test.ts`? The prompt says "tests live in innomcp-node/tests/". It doesn't specify subdirectories. The import of the module under test is `../src/routes/api/analyze`. So the test file must be directly in `tests/` (e.g., `tests/analyze.test.ts`) or in a subdirectory where `../src/...` still works? If it's in `tests/routes/api/analyze.test.ts`, then `../src/routes/api/analyze` would be `tests/routes/api/../src/routes/api/analyze` -> `tests/routes/src/routes/api/analyze` which is wrong. So the test file is likely at `tests/analyze.test.ts` or similar. Thus `../src/services/dataAnalysisTool` is correct.

Alternatively, if the test is in `tests/routes/api/analyze.test.ts`, the import would need to be `../../../src/routes/api/analyze`. But the prompt explicitly says to import exactly as `import ... from '../src/routes/api/analyze';`. So the test file must be at `tests/<name>.test.ts`. Therefore, mocking `../src/services/dataAnalysisTool` is correct.

Let's verify the `node:path` mock. The source does `import *
