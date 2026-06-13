<!-- cc-team deliverable
 group: G4 (Spec/contract-based tests)
 member: S076 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":195,"completion_tokens":3367,"total_tokens":3562,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2316,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T11:44:01.810Z -->
```typescript
import { expressMock, mockRouter } from './__mocks__/express'; // We'll define mocks inline for self-containment

// ---- Mocks ----
jest.mock('express', () => {
  const mockRouterInstance = {
    get: jest.fn(() => mockRouterInstance),
    post: jest.fn(() => mockRouterInstance),
    put: jest.fn(() => mockRouterInstance),
    delete: jest.fn(() => mockRouterInstance),
    use: jest.fn(() => mockRouterInstance),
    all: jest.fn(() => mockRouterInstance),
    options: jest.fn(() => mockRouterInstance),
    head: jest.fn(() => mockRouterInstance),
    patch: jest.fn(() => mockRouterInstance),
    stack: [],
    param: jest.fn(),
  };
  const mockRouter = jest.fn(() => mockRouterInstance);
  const express = jest.fn(() => ({
    // if the module uses express() app, we can add mock methods
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  }));
  express.Router = mockRouter;
  express.static = jest.fn();
  return { default: express, Router: mockRouter };
});

// Mock child_process to prevent actual shell execution
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  spawn: jest.fn(),
  spawnSync: jest.fn(),
}));
// ---- End Mocks ----

import router from '../src/routes/api/shell';

// Recover the real mock references for assertions
const { Router: mockRouterFn } = jest.requireMock('express');

describe('shell router contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should export an object (router) as default', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
    expect(router).not.toBeNull();
  });

  it('should have been created by express.Router() exactly once', () => {
    // The module used express.Router() to create the exported router
    expect(mockRouterFn).toHaveBeenCalledTimes(1);
    // No arguments expected (or we could check for options object if applicable)
    expect(mockRouterFn).toHaveBeenCalledWith(); // or toHaveBeenCalledWith({ strict: true }) etc.
  });

  it('should have the standard Express Router methods', () => {
    // The exported router should behave like an Express Router instance.
    // Even though we mock, the contract is that these methods exist.
    expect(typeof router.get).toBe('function');
    expect(typeof router.post).toBe('function');
    expect(typeof router.put).toBe('function');
    expect(typeof router.delete).toBe('function');
    expect(typeof router.use).toBe('function');
    expect(typeof router.all).toBe('function');
    expect(typeof router.param).toBe('function');
  });

  it('should have at least some routes registered (non-empty stack)', () => {
    // In a typical shell router, routes are added (e.g., POST /execute).
    // The exact number is unknown, but the router should be used to register
    // at least one route handler. We assert that at least one of get/post/etc.
    // was called.
    const routeMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'];
    const calls = routeMethods
      .map((m) => (router as any)[m]?.mock?.calls?.length ?? 0)
      .reduce((a, b) => a + b, 0);
    expect(calls).toBeGreaterThan(0);
    // Additionally, the router's `use` may have been called for middleware.
    expect((router as any).use.mock.calls.length).toBeGreaterThan(0);
  });

  it('should not throw when calling any route method without arguments', () => {
    // Express Router methods should be callable; they return the router for chaining.
    // Check that they don't throw error with no args.
    expect(() => router.get()).not.toThrow();
    expect(() => router.post()).not.toThrow();
    expect(() => router.use()).not.toThrow();
  });

  it('should accept and register a path and handler with get()', () => {
    // Contract: when get() is called with a path and a handler, it stores the route.
    // We can verify through the mocked implementation that it returns the router.
    const handler = jest.fn();
    const returned = router.get('/test', handler);
    expect(returned).toBe(router); // chaining
    // The mock stores calls: we can check the last call arguments
    expect(router.get).toHaveBeenCalledWith('/test', handler);
  });
});
```
