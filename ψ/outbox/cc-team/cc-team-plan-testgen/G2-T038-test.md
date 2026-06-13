<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T038 role=test model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1072,"completion_tokens":8000,"total_tokens":9072,"prompt_tokens_details":{"cached_tokens":69,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 85s
 generated: 2026-06-13T11:00:09.881Z -->
The user wants a Jest unit test for the `GeoService` class in `innomcp-node/src/geo/geo-service.ts`.

Key requirements:
1. Import EXACTLY as: `import { GeoService } from '../src/geo/geo-service';` (or whatever is exported, but the instruction says import the module under test EXACTLY as: `import ... from '../src/geo/geo-service';`). Looking at the source, it exports `GeoService` and `ToolDispatcher`. So I should import `GeoService` and possibly `ToolDispatcher` if needed for typing.
2. Only test the PUBLIC exported API actually present in the source. The public API is the `GeoService` class and its constructor and `handleRequest` method. `ToolDispatcher` is a type export, not a runtime value to test directly, but useful for typing mocks.
3. Mock external dependencies (db, network, other services, fs) with `jest.mock()`. The external dependencies imported are `GeoIntent`, `GeoRouter`, `GeoGuard`, `GeoAggregator`. These are internal modules but they are dependencies of the unit under test. The instruction says "Mock external dependencies (db, network, other services, fs)". The imported classes `GeoIntent`, `GeoRouter`, `GeoGuard`, `GeoAggregator` are other services/modules. To make the test deterministic and offline, and since the instruction says "Mock external dependencies... with jest.mock()", I should mock these internal imports. However, `jest.mock` is typically used for module paths. Since they are in the same directory or subdirectories, I can mock them.
   Wait, the instruction says "Mock external dependencies (db, network, other services, fs)". The classes `GeoIntent`, `GeoRouter`, `GeoGuard`, `GeoAggregator` are other services. I should mock them using `jest.mock('../src/geo/geo-intent')` etc. Or perhaps mock the methods by spying on them after import? But `jest.mock` is explicitly requested.
   Let's look at the style exemplar. It doesn't show `jest.mock`. But the rules say "Mock external dependencies (db, network, other services, fs) with jest.mock()."
   So I need to mock the modules `../src/geo/geo-intent`, `../src/geo/geo-tool-router`, `../src/geo/geo-guard`, `../src/geo/geo-aggregator`.
   However, the paths in the source are relative: `./geo-intent`, `./geo-tool-router`, etc. In the test file, which is in `innomcp-node/tests/`, the import for the module under test is `../src/geo/geo-service`. To mock the dependencies, I need to use the path relative to the test file, or use `jest.mock` with the module path. Since the test is in `tests/`, the relative path to `src/geo/geo-intent` would be `../src/geo/geo-intent`.
   Let's verify: `tests/some-test.ts` -> `../src/geo/geo-service` (correct). So `../src/geo/geo-intent` would be the path for `GeoIntent`.
   But wait, `GeoService` imports them using `./geo-intent`. When Jest resolves modules, it resolves relative to the importing file. So `jest.mock('../src/geo/geo-intent')` from the test file should work because it resolves to the same file on disk.
   Actually, `jest.mock` paths are relative to the *test file*. So yes, `jest.mock('../src/geo/geo-intent')` is correct.

   Let's think about how to mock these. Since they are classes, `jest.mock` will automatically mock the module, making the exported classes mock constructors. I can then use `mockImplementation` or just let Jest provide automocked versions. But I need to control the return values of `analyze`, `route`, `executeWithGuard`, and `format`.
   So:
   ```typescript
   jest.mock('../src/geo/geo-intent', () => {
     return {
       GeoIntent: jest.fn().mockImplementation(() => ({
         analyze: jest.fn(),
       })),
     };
   });
   ```
   Similarly for the others.
   Or, I can import the actual modules (which will be mocked) and set up mocks in `beforeEach`. A common pattern with `jest.mock` is:
   ```typescript
   import { GeoIntent } from '../src/geo/geo-intent';
   jest.mock('../src/geo/geo-intent');
   ```
   Then in beforeEach:
   ```typescript
   (GeoIntent as jest.MockedClass<typeof GeoIntent>).mockImplementation(() => ({
     analyze: jest.fn().mockReturnValue(...),
   }));
   ```
   Wait, if I use `jest.mock` at the top, the imports become mocked. But `GeoIntent` is a class. If I mock the module, `GeoIntent` becomes a mock function (constructor). I can instantiate it and mock its methods.
   Let's do it cleanly.

   Actually, to avoid potential issues with hoisting and manual mocks, I'll use `jest.mock` for each module and then in `beforeEach`, instantiate or set up the mock instances. But `GeoService` instantiates them internally in its constructor:
   ```typescript
   private intent = new GeoIntent();
   private router = new GeoRouter();
   private guard = new GeoGuard();
   private aggregator = new GeoAggregator();
   ```
   So when I create `new GeoService(dispatch)`, it will call `new GeoIntent()` etc. If `GeoIntent` is a mock constructor, it will return an object. I need that object to have an `analyze` method that I can control.
   So the mock should be:
   ```typescript
   jest.mock('../src/geo/geo-intent', () => {
     return {
       GeoIntent: jest.fn().mockImplementation(() => ({
         analyze: jest.fn(),
       })),
     };
   });
   ```
   Then in the test, I can get the instance's method? No, I don't have access to the private instance variables directly. But I can mock the constructor implementation in `beforeEach` so that when `GeoService` constructs it, the returned object has methods whose implementations I can set via the mock function references.
   Wait, if I do:
   ```typescript
   const mockAnalyze = jest.fn();
   jest.mock('../src/geo/geo-intent', () => ({
     GeoIntent: jest.fn().mockImplementation(() => ({
       analyze: mockAnalyze,
     })),
   }));
   ```
   This won't work because `mockAnalyze` is defined outside and `jest.mock` is hoisted, but the variable might not be initialized yet due to hoisting. Better to use `mockImplementation` on the imported mock class itself.
   Pattern:
   ```typescript
   import { GeoIntent } from '../src/geo/geo-intent';
   jest.mock('../src/geo/geo-intent');

   // Then in beforeEach or test:
   const mockAnalyze = jest.fn();
   (GeoIntent as jest.MockedClass<typeof GeoIntent>).mockImplementation(() => {
     return { analyze: mockAnalyze } as any;
   });
   ```
   But `GeoIntent` is imported from a mocked module. The type might be tricky. Let's use a simpler approach: define the mock implementations inside the factory so they are stable, and then if I need to change behavior per test, I can use `mockReturnValue` on the methods... but I don't have a reference to the methods because they are created inside the factory.
   Alternative: Use `jest.spyOn` or manual mock objects? No, `jest.mock` is required.
   Another approach: mock the module with a factory that returns a class whose methods are jest.fn() that are exported or accessible? No.
   Actually, the easiest way is to mock the module and then in the test, spy on the prototype of the mocked class? But if the class is already a mock function, its prototype might not have the methods.
   Let's reconsider. `jest.mock('../src/geo/geo-intent')` without a factory will replace all exports with mock functions. So `GeoIntent` will be a `jest.fn()`. When `new GeoIntent()` is called inside `GeoService`, it returns `undefined` by default (or an empty object if using `new` on a mock? Actually `new jest.fn()` returns an empty object `{}`). Then `this.intent.analyze` will be undefined.
   So I need to provide a factory or mock the implementation.
   Let's use the factory approach but define the mock functions at module level in a way that works.
   Actually, a very clean pattern:
   ```typescript
   const mockAnalyze = jest.fn();
   jest.mock('../src/geo/geo-intent', () => ({
     GeoIntent: jest.fn().mockImplementation(() => ({
       analyze: mockAnalyze,
     })),
   }));
   ```
   Despite hoisting, `jest.mock` factory functions are executed lazily when the module is imported, so `mockAnalyze` should be defined by then (it's declared at the top level of the test file). This is a common pattern and works in Jest.
   Let's do this for all four dependencies.

   Wait, I also need to mock `console.log` and `console.error`? The source uses them. The tests shouldn't fail due to console output, but it's not strictly necessary unless asserting. However, to keep output clean, I might spy on console. But the rules don't explicitly require suppressing console. I'll leave it unless needed.

   Let's plan the test cases:
   The public API is `constructor(dispatch: ToolDispatcher)` and `handleRequest(userMessage: string): Promise<WeatherPacket>`.

   Test cases:
   1. `handleRequest` returns a "not understood" packet when intent domain is not weather or confidence < 0.5.
   2. `handleRequest` returns a "cannot identify location" packet when router returns null/undefined plan.
   3. `handleRequest` returns formatted packet when primary tool succeeds.
   4. `handleRequest` tries fallback and returns fallback formatted packet when primary fails but fallback succeeds.
   5. `handleRequest` returns degraded packet (rawPacket from primary) when all tools fail.
   6. Need to verify `dispatch` callback is called with correct tool name and params for primary and fallbacks.

   Let's define the types/interfaces needed for mocks.
   The source imports `WeatherPacket` from `./interfaces` as a type. I might need to import it for typing assertions, but since it's a type-only import in the source, the actual file might export the interface. I can import it as a type if needed. But the rule says "Only test the PUBLIC exported API actually present in the source below." `WeatherPacket` is not exported from `geo-service.ts`, it's imported. The test file can import it from the source file if it's re-exported? No, it's not re-exported. I should define my own local interface or import from the interfaces file if needed. But to be safe and strictly follow "do not invent methods", I can just use `as any` or define the shape inline, or import from `../src/geo/interfaces`. The rule says "Only test the PUBLIC exported API actually present in the source below" meaning don't test things not in the source. Importing a type from a dependency file is fine. Let's import `WeatherPacket` from `../src/geo/interfaces` if needed, or just use object shapes that satisfy the compiler. Since TypeScript is strict, I need to type things.
   Actually, `handleRequest` returns `Promise<WeatherPacket>`. If I want to assert on the return value, I need to know the shape. I can import the type from the interfaces file: `import type { WeatherPacket } from '../src/geo/interfaces';` This is fine, it's not testing an invented API.

   Let's set up the mocks.

   ```typescript
   import { GeoService, ToolDispatcher } from '../src/geo/geo-service';
   import type { WeatherPacket } from '../src/geo/interfaces';

   const mockAnalyze = jest.fn();
   const mockRoute = jest.fn();
   const mockExecuteWithGuard = jest.fn();
   const mockFormat = jest.fn();

   jest.mock('../src/geo/geo-intent', () => ({
     GeoIntent: jest.fn().mockImplementation(() => ({
       analyze: mockAnalyze,
     })),
   }));

   jest.mock('../src/geo/geo-tool-router', () => ({
     GeoRouter: jest.fn().mockImplementation(() => ({
       route: mockRoute,
     })),
   }));

   jest.mock('../src/geo/geo-guard', () => ({
     GeoGuard: jest.fn().mockImplementation(() => ({
       executeWithGuard: mockExecuteWithGuard,
     })),
   }));

   jest.mock('../src/geo/geo-aggregator', () => ({
     GeoAggregator: jest.fn().mockImplementation(() => ({
       format: mockFormat,
     })),
   }));
   ```

   Wait, `jest.mock` is hoisted, but the factory function references `mockAnalyze` etc. which are declared at the top level. This should work because by the time the factory is executed (during module loading), the variables are declared. However, if they are `const`, they must be initialized. They are initialized to `jest.fn()`. This is fine.

   But there's a subtle issue: `jest.mock` calls are hoisted to the top of the file. The `const mockAnalyze = jest.fn()` is also at the top, but is it initialized before the factory runs? In Jest, `jest.mock` hoisting puts the mock calls above imports, but variable declarations are in place. Actually, Babel/Jest hoisting ensures `jest.mock` is executed before the code in the module, but `import` statements are also hoisted. The `const` declarations are not hoisted above the `jest.mock` calls if they appear after them in the source. But in the transpiled code, `jest.mock` is moved to the very top. However, the factory function is a closure over `mockAnalyze`. When the factory is *called* during module initialization, `mockAnalyze` must be initialized.
   If I write:
   ```typescript
   const mockAnalyze = jest.fn();
   jest.mock(...);
   ```
   After hoisting, `jest.mock` might be called before `mockAnalyze` is initialized if the hoister moves it above the const declaration. This is a known issue. To avoid this, some people put `jest.mock` above the imports/declarations, or use a different pattern.
   A safer pattern is to put the `jest.mock` calls at the very top, and inside the factory, create the mock functions, and then export them so the test can reference them? No, the factory returns the module exports.
   Another safer pattern: Use `jest.spyOn` or manual mocks in a `__mocks__` directory? No, the instruction says use `jest.mock()`.
   Another pattern: Define the mock functions inside the factory and assign them to global variables? Messy.
   Another pattern: Use `jest.mock` without a factory (auto-mock), then import the mocked class and use `mockImplementation` on it in `beforeEach`. But as noted, auto-mock of a class gives a jest.fn() that returns undefined when instantiated.
   Wait, if I do:
   ```typescript
   import { GeoIntent } from '../src/geo/geo-intent';
   jest.mock('../src/geo/geo-intent');
   ```
   Then `GeoIntent` is a `jest.MockedClass<typeof GeoIntent>`. I can do:
   ```typescript
   beforeEach(() => {
     (GeoIntent as jest.MockedClass<typeof GeoIntent>).mockImplementation(() => ({
       analyze: jest.fn().mockReturnValue({ domain: 'weather', confidence: 0.9 }),
     }));
   });
   ```
   This works! Because `GeoIntent` is the mock constructor function itself. When `GeoService` does `new GeoIntent()`, it calls this mock implementation and gets the object with `analyze`. And I can control `analyze` per test by setting up the mockImplementation in `beforeEach` or even per test.
   This is much cleaner and avoids the hoisting closure issue.
   Let's use this pattern.

   ```typescript
   import { GeoService, ToolDispatcher } from '../src/geo/geo-service';
   import { GeoIntent } from '../src/geo/geo-intent';
   import { GeoRouter } from '../src/geo/geo-tool-router';
   import { GeoGuard } from '../src/geo/geo-guard';
   import { GeoAggregator } from '../src/geo/geo-aggregator';
   import type { WeatherPacket } from '../src/geo/interfaces';

   jest.mock('../src/geo/geo-intent');
   jest.mock('../src/geo/geo-tool-router');
   jest.mock('../src/geo/geo-guard');
   jest.mock('../src/geo/geo-aggregator');
   ```

   Then in `beforeEach`:
   ```typescript
   let mockAnalyze: jest.Mock;
   let mockRoute: jest.Mock;
   let mockExecuteWithGuard: jest.Mock;
   let mockFormat: jest.Mock;
   let dispatch: jest.MockedFunction<ToolDispatcher>;

   beforeEach(() => {
     jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
     jest.clearAllMocks();

     mockAnalyze = jest.fn();
     mockRoute = jest.fn();
     mockExecuteWithGuard = jest.fn();
     mockFormat = jest.fn();
     dispatch = jest.fn();

     (GeoIntent as jest.MockedClass<typeof GeoIntent>).mockImplementation(() => ({
       analyze: mockAnalyze,
     }));

     (GeoRouter as jest.MockedClass<typeof GeoRouter>).mockImplementation(() => ({
       route: mockRoute,
     }));

     (GeoGuard as jest.MockedClass<typeof GeoGuard>).mockImplementation(() => ({
       executeWithGuard: mockExecuteWithGuard,
     }));

     (GeoAggregator as jest.MockedClass<typeof GeoAggregator>).mockImplementation(() => ({
       format: mockFormat,
     }));
   });

   afterEach(() => {
     jest.useRealTimers();
   });
   ```

   Wait, `GeoIntent` etc. are classes. When imported from a `jest.mock`'ed module, they are mock functions. `jest.MockedClass` is the correct type helper.
   However, `GeoIntent` might not be exported as default. The source says `import { GeoIntent } from "./geo-intent";`. So it's a named export. `jest.mock` will replace it with a mock function. This is fine.

   Now, what about the types of the mock implementations? The methods have specific signatures.
   - `GeoIntent.analyze(userMessage: string)` returns something like `{ domain: string, confidence: number, ... }`.
   - `GeoRouter.route(intentResult)` returns something like `{ primary: { tool_name: string, params: Record<string, unknown> }, fallbacks: Array<{ tool_name: string, params: Record<string, unknown>, reason: string }> } | null | undefined`.
   - `GeoGuard.executeWithGuard(fn, toolName)` returns a `WeatherPacket` (or something with `error` field and other fields). Looking at the source, `rawPacket` is used directly if `error` is present, and passed to `aggregator.format(rawPacket)` if no error. Also if all fail, `rawPacket` is returned. So `executeWithGuard` returns something that matches `WeatherPacket` shape but might have an `error` field. Let's call it `GuardResult`.
   - `GeoAggregator.format(rawPacket)` returns `WeatherPacket`.

   For strict TypeScript, the mock implementations should return objects that satisfy the expected shapes. Since these are private internal details, I can cast with `as any` or `as unknown as WeatherPacket` to keep it simple, or define minimal objects. The compiler won't check the mock implementation return types strictly unless I type them. `jest.MockedClass` might complain if the returned object doesn't match the class shape. But since the original class shape is unknown to the test (we don't have the source of `GeoIntent`), TypeScript might not know the constructor signature or instance methods. Wait, we are importing them. If the actual modules exist, TypeScript knows their types. But in a test environment, the modules are mocked. However, `ts-jest` still type-checks against the real modules. So the mock implementation must return an object that is structurally compatible with `GeoIntent` instance? Not necessarily, because `mockImplementation` takes a function returning `any` effectively for the constructor return.
   Actually, `jest.MockedClass<typeof GeoIntent>.mockImplementation` expects a function that returns an instance of `GeoIntent` or compatible. If `GeoIntent` has methods other than `analyze`, returning an object with only `analyze` might cause a type error if strict. But usually, for tests, we can use `as any`.
   Let's use `as any` on the returned object to be safe and avoid needing the exact full class shape.

   Example:
   ```typescript
   (GeoIntent as jest.MockedClass<typeof GeoIntent>).mockImplementation(() => ({
     analyze: mockAnalyze,
   } as any));
   ```

   Now, let's think about the `WeatherPacket` shape. The source shows it's used as a return type. The shape is:
   ```typescript
   {
     summary: string;
     timestamp: string;
     source: string;
     evidence: { tool: string; latency_ms: number; confidence: number; };
     // possibly fallback_used?: boolean;
   }
   ```
   I imported the type from `../src/geo/interfaces`. I'll use that.

   Let's draft the test cases.

   **Test 1: Low confidence / wrong domain**
   ```typescript
   test('returns not-understood packet when intent is not weather or confidence is low', async () => {
     mockAnalyze.mockReturnValue({ domain: 'greeting', confidence: 0.2 });
     const service = new GeoService(dispatch);
     const result = await service.handleRequest('hello');
     expect(result.summary).toBe('ไม่เข้าใจคำถามเกี่ยวกับสภาพอากาศ');
     expect(result.source).toBe('none');
     expect(result.evidence.confidence).toBe(0);
     expect(dispatch).not.toHaveBeenCalled();
   });
   ```
   Need to check timestamp. Since we use fake timers set to a specific date, `new Date().toISOString()` will be deterministic.
   Also test domain weather but confidence < 0.5.

   **Test 2: Router returns null/undefined**
   ```typescript
   test('returns location-not-found packet when router cannot plan', async () => {
     mockAnalyze.mockReturnValue({ domain: 'weather', confidence: 0.8 });
     mockRoute.mockReturnValue(null);
     const service = new GeoService(dispatch);
     const result = await service.handleRequest('weather in nowhere');
     expect(result.summary).toBe('ไม่สามารถระบุตำแหน่งหรือเครื่องมือที่เหมาะสมได้ กรุณาระบุจังหวัดหรือพิกัด');
     expect(result.source).toBe('none');
     expect(dispatch).not.toHaveBeenCalled();
   });
   ```

   **Test 3: Primary succeeds**
   ```typescript
   test('returns formatted packet when primary tool succeeds', async () => {
     const intent = { domain: 'weather', confidence: 0.9 };
     const plan = {
       primary: { tool_name: 'get_weather', params: { city: 'Bangkok' } },
       fallbacks: [],
     };
     const rawPacket = { summary: 'Sunny', source: 'tool', evidence: { tool: 'get_weather', latency_ms: 100, confidence: 0.9 } };
     const formattedPacket: WeatherPacket = { summary: 'Sunny!', timestamp: '2024-01-01T00:00:00.000Z', source: 'tool', evidence: { tool: 'get_weather', latency_ms: 100, confidence: 0.9 } };

     mockAnalyze.mockReturnValue(intent);
     mockRoute.mockReturnValue(plan);
     mockExecuteWithGuard.mockResolvedValue(rawPacket);
     mockFormat.mockReturnValue(formattedPacket);

     const service = new GeoService(dispatch);
     const result = await service.handleRequest('weather in Bangkok');

     expect(dispatch).toHaveBeenCalledTimes(1);
     expect(dispatch).toHaveBeenCalledWith('get_weather', { city: 'Bangkok' });
     expect(mockExecuteWithGuard).toHaveBeenCalledWith(expect.any(Function), 'get_weather');
     // We can also verify the function passed to executeWithGuard calls dispatch
     const guardFn = mockExecuteWithGuard.mock.calls[0][0] as () => Promise<unknown>;
     await guardFn(); // should trigger dispatch again? Wait, executeWithGuard receives a function. In the source, it calls it. But we mocked executeWithGuard, so it won't actually call the inner function unless we make it do so. Hmm.
   });
   ```
   Wait, this is important. `guard.executeWithGuard` is mocked. In the real code, `executeWithGuard` receives a callback `() => this.dispatch(...)`. The mock won't call this callback automatically. So `dispatch` won't be called unless the mock calls the callback.
   But the source expects `executeWithGuard` to call the callback and return its result (or wrap it). Since we are mocking `GeoGuard`, we need to simulate its behavior. If we just mock `executeWithGuard` to return a resolved value, `dispatch` is never called by `GeoService`'s logic directly; it's only inside the callback passed to `executeWithGuard`.
   However, the test wants to verify `dispatch` is called with correct params. If `executeWithGuard` is mocked and doesn't call the callback, `dispatch` won't be called.
   So I have two options:
   a) Make the mock of `executeWithGuard` actually invoke the callback it receives.
   b) Assert that `executeWithGuard` was called with a function, and separately test the callback by calling it.
   c) Don't assert `dispatch` was called, just assert the final result. But the logic depends on `executeWithGuard` calling dispatch.

   Option (a) is best for integration-style unit testing:
   ```typescript
   mockExecuteWithGuard.mockImplementation(async (fn) => {
     return await fn();
   });
   ```
   But then we need to simulate error cases too. For error cases, we can make it return an object with `error` property without calling `fn`, or call `fn` and add error. Let's look at the source: `const rawPacket = await this.guard.executeWithGuard(() => this.dispatch(...), ...)`. If `rawPacket.error` is falsy, it's treated as success. If `rawPacket.error` is truthy, it goes to fallback.
   So `executeWithGuard` likely catches errors or wraps results. For our mock, we can simply make it call `fn` and return whatever `fn` returns, or return a specified error object.
   Let's make `mockExecuteWithGuard` a generic mock that, by default, calls the function and returns the result. Then for error cases, we override it.
   ```typescript
   mockExecuteWithGuard.mockImplementation(async (fn: () => Promise<unknown>) => {
     try {
       return await fn();
     } catch (e) {
       return { error: true, message: String(e) };
     }
   });
   ```
   But wait, the return type needs to be compatible. The source checks `rawPacket.error`. So the return should be an object. If `dispatch` resolves to something, that something is returned. If `dispatch` is mocked to return a WeatherPacket-like object without `error`, then `rawPacket.error` is undefined (falsy), and it's treated as success.
   So for success cases:
   - `dispatch` resolves to some tool result (e.g., `{ temp: 30 }`).
   - `executeWithGuard` mock calls `fn` and returns that tool result.
   - Then `aggregator.format(rawPacket)` is called with that tool result.
   - `format` returns the final `WeatherPacket`.

   For failure cases:
   - We can make `executeWithGuard` return `{ error: 'some error', ... }` directly without calling `fn`, or make `dispatch` reject and `executeWithGuard` catch it and return error object. Let's just have the mock return an error object directly for simplicity.
   ```typescript
   mockExecuteWithGuard.mockResolvedValue({ error: 'failed', summary: 'fail', timestamp: '...', source: 'none', evidence: { tool: 'none', latency_ms: 0, confidence: 0 } });
   ```

   But if `executeWithGuard` doesn't call `fn`, then `dispatch` is not called. Is that okay? The test rules say "Mock external dependencies... Keep tests deterministic". `GeoGuard` is an external dependency (other service). Mocking it to not call the callback is a valid unit test approach. We can then assert that `executeWithGuard` was called with the correct arguments (including the callback). We don't strictly need to assert `dispatch` was called if we trust the callback is correct. But it's better to verify the callback works if invoked.
   Actually, to be thorough, I can extract the callback from `executeWithGuard` mock calls and invoke it to verify it calls `dispatch` with right args. This is a good pattern.
   ```typescript
   expect(mockExecuteWithGuard).toHaveBeenCalledWith(expect.any(Function), 'get_weather');
   const callback = mockExecuteWithGuard.mock.calls[0][0] as () => Promise<unknown>;
   // We can call it separately to verify dispatch
   await callback();
   expect(dispatch).toHaveBeenCalledWith('get_weather', { city: 'Bangkok' });
   ```
   But note: if we call `callback()` separately, `dispatch` will be called. In the actual flow, `executeWithGuard` is mocked so it won't call `callback`, so `dispatch` count in the main `handleRequest` flow will be 0. That's fine. We just verify the callback is correct.

   However, if `executeWithGuard` is mocked to NOT call the callback, then the primary success path in the source (`if (!rawPacket.error)`) depends on `rawPacket` returned by the mock. So we can just set `mockExecuteWithGuard.mockResolvedValue({ ...success shape... })` and then `mockFormat.mockReturnValue(formatted)`. We don't need `dispatch` to be called in the flow for the test to pass. But verifying the callback is a nice touch.

   Let's decide: I'll mock `executeWithGuard` to simply return whatever I tell it to return. I'll verify it was called with the correct `toolName` and a function. And I'll optionally verify the callback calls dispatch.

   Let's refine the test cases.

   **Test 3: Primary success**
   ```typescript
   test('returns formatted packet when primary tool succeeds', async () => {
     const intent = { domain: 'weather', confidence: 0.9 };
     const plan = {
       primary: { tool_name: 'get_weather', params: { city: 'Bangkok' } },
       fallbacks: [],
     };
     const rawSuccess = { summary: 'Hot', source: 'api', evidence: { tool: 'get_weather', latency_ms: 50, confidence: 0.95 } };
     const formatted: WeatherPacket = { summary: 'Hot 35C', timestamp: '2024-01-01T00:00:00.000Z', source: 'api', evidence: { tool: 'get_weather', latency_ms: 50, confidence: 0.95 } };

     mockAnalyze.mockReturnValue(intent);
     mockRoute.mockReturnValue(plan);
     mockExecuteWithGuard.mockResolvedValue(rawSuccess);
     mockFormat.mockReturnValue(formatted);

     const service = new GeoService(dispatch);
     const result = await service.handleRequest('Bangkok weather');

     expect(mockAnalyze).toHaveBeenCalledWith('Bangkok weather');
     expect(mockRoute).toHaveBeenCalledWith(intent);
     expect(mockExecuteWithGuard).toHaveBeenCalledTimes(1);
     expect(mockExecuteWithGuard).toHaveBeenCalledWith(expect.any(Function), 'get_weather');
     expect(mockFormat).toHaveBeenCalledWith(rawSuccess);
     expect(result).toBe(formatted);
   });
   ```

   **Test 4: Fallback success**
   ```typescript
   test('uses fallback and marks fallback_used when primary fails and fallback succeeds', async () => {
     const intent = { domain: 'weather', confidence: 0.9 };
     const plan = {
       primary: { tool_name: 'primary_tool', params: { q: 'x' } },
       fallbacks: [
         { tool_name: 'fallback_tool', params: { q: 'y' }, reason: 'primary down' },
       ],
     };
     const rawError = { error: 'Primary failed', summary: 'err', timestamp: '2024-01-01T00:00:00.000Z', source: 'none', evidence: { tool: 'none', latency_ms: 0, confidence: 0 } };
     const rawFbSuccess = { summary: 'Cloudy', source: 'fb', evidence: { tool: 'fallback_tool', latency_ms: 80, confidence: 0.8 } };
     const formatted: WeatherPacket = { summary: 'Cloudy', timestamp: '2024-01-01T00:00:00.000Z', source: 'fb', evidence: { tool: 'fallback_tool', latency_ms: 80, confidence: 0.8 } };

     mockAnalyze.mockReturnValue(intent);
     mockRoute.mockReturnValue(plan);
     // First call (primary) returns error; second call (fallback) returns success
     mockExecuteWithGuard
       .mockResolvedValueOnce(rawError)
       .mockResolvedValueOnce(rawFbSuccess);
     mockFormat.mockReturnValue(formatted);

     const service = new GeoService(dispatch);
     const result = await service.handleRequest('weather');

     expect(mockExecuteWithGuard).toHaveBeenCalledTimes(2);
     expect(mockExecuteWithGuard).toHaveBeenNthCalledWith(1, expect.any(Function), 'primary_tool');
     expect(mockExecuteWithGuard).toHaveBeenNthCalledWith(2, expect.any(Function), 'fallback_tool');
     expect(mockFormat).toHaveBeenCalledWith(rawFbSuccess);
     expect(result).toBe(formatted);
     // Note: the source sets `fbPacket.fallback_used = true` BEFORE calling aggregator.format.
     // But our mock of `format` just returns `formatted`. We don't have a way to verify `fallback_used` was set on the packet passed to format unless we inspect the call argument.
     // Since `rawFbSuccess` is an object, the source mutates it: `fbPacket.fallback_used = true;`. So when `mockFormat` is called, the argument should have `fallback_used: true`.
     expect(mockFormat).toHaveBeenCalledWith(expect.objectContaining({ fallback_used: true }));
   });
   ```

   **Test 5: All fail**
   ```typescript
   test('returns degraded packet from guard when all tools fail', async () => {
     const intent = { domain: 'weather', confidence: 0.9 };
     const plan = {
       primary: { tool_name: 't1', params: {} },
       fallbacks: [
         { tool_name: 't2', params: {}, reason: 'r1' },
         { tool_name: 't3', params: {}, reason: 'r2' },
       ],
     };
     const rawError = { error: 'All failed', summary: 'degraded', timestamp: '2024-01-01T00:00:00.000Z', source: 'none', evidence: { tool: 'none', latency_ms: 0, confidence: 0 } };

     mockAnalyze.mockReturnValue(intent);
     mockRoute.mockReturnValue(plan);
     mockExecuteWithGuard.mockResolvedValue(rawError);
     // format should NOT be called because all failed and rawPacket is returned directly

     const service = new GeoService(dispatch);
     const result = await service.handleRequest('weather');

     expect(mockExecuteWithGuard).toHaveBeenCalledTimes(3); // primary + 2 fallbacks
     expect(mockFormat).not.toHaveBeenCalled();
     expect(result).toEqual(rawError);
   });
   ```

   **Test 6: Verify dispatch callback (optional but good)**
   Actually, I can combine this into test 3 or make a separate test. Let's make a separate test to verify the callback invokes dispatch correctly.
   ```typescript
   test('dispatch callback passed to guard invokes the injected dispatcher', async () => {
     const intent = { domain: 'weather', confidence: 0.9 };
     const plan = {
       primary: { tool_name: 'tool_a', params: { lat: 1, lon: 2 } },
       fallbacks: [],
     };
     const rawSuccess = { summary: 'OK', source: 's', evidence: { tool: 'tool_a', latency_ms: 10, confidence: 1 } };
     const formatted: WeatherPacket = { summary: 'OK', timestamp: '2024-01-01T00:00:00.000Z', source: 's', evidence: { tool: 'tool_a', latency_ms: 10, confidence: 1 } };

     mockAnalyze.mockReturnValue(intent);
     mockRoute.mockReturnValue(plan);
     mockExecuteWithGuard.mockImplementation(async (fn) => {
       // simulate guard calling the function
       const result = await fn();
