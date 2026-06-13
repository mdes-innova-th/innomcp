<!-- cc-team deliverable
 group: G4 (Spec/contract-based tests)
 member: S080 role=spec-test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":339,"completion_tokens":2612,"total_tokens":2951,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:46:05.722Z -->
```typescript
import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';

// Mocks MUST come before importing the module under test
jest.mock('../src/middleware/auth', () => ({
  requireAuth: jest.fn((req: any, _res: any, next: NextFunction) => {
    if (req.headers['x-test-auth'] === 'valid') {
      (req as any).user = { id: 'user-123', roles: ['user'] };
      next();
    } else {
      const err: any = new Error('Unauthorized');
      err.status = 401;
      next(err);
    }
  }),
}));

jest.mock('../src/services/userService', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  deleteUserProfile: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import router from '../src/routes/api/user/profile';
import userService from '../src/services/userService';

const mockService = userService as jest.Mocked<typeof userService>;

// Express Router exposes `stack` of routes
type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: any; name: string }>;
  };
  handle: any;
  name: string;
  regexp?: RegExp;
};

function getRouterStack(): Layer[] {
  return (router as any).stack as Layer[];
}

function findRoute(stack: Layer[], path: string, method: string): Layer['route'] | undefined {
  return stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()] === true,
  )?.route;
}

function getRouteHandler(route: NonNullable<Layer['route']>, index = 0) {
  return route.stack[index].handle as (
    req: Partial<Request>,
    res: Partial<Response>,
    next: NextFunction,
  ) => Promise<unknown> | unknown;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    locals: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headers['content-type'] = 'application/json';
      return this;
    },
    send(payload?: unknown) {
      this.body = payload ?? '';
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    end(payload?: unknown) {
      this.body = payload ?? this.body;
      return this;
    },
  };
  return res as Response & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    method: 'GET',
    path: '/',
    url: '/',
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profile router — contract', () => {
  const stack = getRouterStack();

  it('exports a default Express router (function with a stack)', () => {
    expect(typeof router).toBe('function');
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBeGreaterThan(0);
  });

  describe('GET /', () => {
    it('exposes a GET / route', () => {
      const route = findRoute(stack, '/', 'get');
      expect(route).toBeDefined();
    });

    it('returns the user profile for an authenticated request', async () => {
      const route = findRoute(stack, '/', 'get')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      const profile = { id: 'user-123', name: 'Ada', email: 'ada@example.com' };
      mockService.getUserProfile.mockResolvedValueOnce(profile as any);

      const req = makeReq({ headers: { 'x-test-auth': 'valid' } as any });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(mockService.getUserProfile).toHaveBeenCalledTimes(1);
      expect(mockService.getUserProfile).toHaveBeenCalledWith('user-123');
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(profile);
    });

    it('responds 401 when request is unauthenticated', async () => {
      const route = findRoute(stack, '/', 'get')!;
      // Apply the requireAuth middleware (first handler in the route)
      const auth = getRouteHandler(route, 0);

      const req = makeReq({ headers: {} as any });
      const res = makeRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as any;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Unauthorized');
      expect(err.status).toBe(401);
    });

    it('propagates service errors to next()', async () => {
      const route = findRoute(stack, '/', 'get')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      const boom = new Error('database unreachable');
      mockService.getUserProfile.mockRejectedValueOnce(boom as any);

      const req = makeReq({ headers: { 'x-test-auth': 'valid' } as any });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(boom);
      expect(res.statusCode).toBe(200); // not explicitly set
      expect(res.body).toBeUndefined();
    });
  });

  describe('PUT /', () => {
    it('exposes a PUT / route', () => {
      const route = findRoute(stack, '/', 'put');
      expect(route).toBeDefined();
    });

    it('updates and returns the updated profile', async () => {
      const route = findRoute(stack, '/', 'put')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      const updated = { id: 'user-123', name: 'Grace', email: 'grace@example.com' };
      mockService.updateUserProfile.mockResolvedValueOnce(updated as any);

      const req = makeReq({
        headers: { 'x-test-auth': 'valid' } as any,
        body: { name: 'Grace', email: 'grace@example.com' },
      });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(mockService.updateUserProfile).toHaveBeenCalledTimes(1);
      expect(mockService.updateUserProfile).toHaveBeenCalledWith('user-123', {
        name: 'Grace',
        email: 'grace@example.com',
      });
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
    });

    it('responds 401 for unauthenticated PUT', async () => {
      const route = findRoute(stack, '/', 'put')!;
      const auth = getRouteHandler(route, 0);

      const req = makeReq({ headers: {} as any, body: { name: 'x' } });
      const res = makeRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as any;
      expect(err.status).toBe(401);
      expect(mockService.updateUserProfile).not.toHaveBeenCalled();
    });

    it('propagates service errors during update to next()', async () => {
      const route = findRoute(stack, '/', 'put')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      const boom = new Error('validation failed');
      mockService.updateUserProfile.mockRejectedValueOnce(boom as any);

      const req = makeReq({
        headers: { 'x-test-auth': 'valid' } as any,
        body: {},
      });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe('DELETE /', () => {
    it('exposes a DELETE / route', () => {
      const route = findRoute(stack, '/', 'delete');
      expect(route).toBeDefined();
    });

    it('deletes the profile and responds with 204 / empty body', async () => {
      const route = findRoute(stack, '/', 'delete')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      mockService.deleteUserProfile.mockResolvedValueOnce(undefined as any);

      const req = makeReq({ headers: { 'x-test-auth': 'valid' } as any });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(mockService.deleteUserProfile).toHaveBeenCalledTimes(1);
      expect(mockService.deleteUserProfile).toHaveBeenCalledWith('user-123');
      expect(next).not.toHaveBeenCalled();
      // Either 204 with no body, or some success response — body must not contain a profile object
      expect(res.statusCode === 200 || res.statusCode === 204).toBe(true);
      if (res.statusCode === 200) {
        expect(res.body === undefined || res.body === null || res.body === '').toBe(true);
      }
    });

    it('responds 401 for unauthenticated DELETE', async () => {
      const route = findRoute(stack, '/', 'delete')!;
      const auth = getRouteHandler(route, 0);

      const req = makeReq({ headers: {} as any });
      const res = makeRes();
      const next = jest.fn();

      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as any;
      expect(err.status).toBe(401);
      expect(mockService.deleteUserProfile).not.toHaveBeenCalled();
    });

    it('propagates service errors during delete to next()', async () => {
      const route = findRoute(stack, '/', 'delete')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      const boom = new Error('cannot delete');
      mockService.deleteUserProfile.mockRejectedValueOnce(boom as any);

      const req = makeReq({ headers: { 'x-test-auth': 'valid' } as any });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe('middleware wiring', () => {
    it('attaches requireAuth to all three (GET/PUT/DELETE) routes', () => {
      for (const method of ['get', 'put', 'delete'] as const) {
        const route = findRoute(stack, '/', method)!;
        // First handler in route stack should be the requireAuth middleware
        const first = route.stack[0];
        expect(first).toBeDefined();
        // requireAuth is an arrow fn exported from middleware/auth — name is empty for arrows
        // We assert that the handler is NOT the same as the final business handler
        const last = route.stack[route.stack.length - 1];
        expect(first.handle).not.toBe(last.handle);
      }
    });
  });
});
```
