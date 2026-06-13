<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T052 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":764,"completion_tokens":4209,"total_tokens":4973,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3559,"image_tokens":0},"cache_creation_input_tokens":0} | 90s
 generated: 2026-06-13T11:03:06.556Z -->
```typescript
import csrfRouter from '../src/routes/api/csrf';
import { logBoth } from '../src/utils/mcpLogger';
import crypto from 'crypto';

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mocked_random_token')
  })),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked_hashed_token')
  }))
}));

jest.mock('../src/utils/mcpLogger', () => ({
  logBoth: jest.fn()
}));

describe('csrfRouter', () => {
  const mockReq = {} as any;
  let mockRes: any;
  let handler: any;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    const layer = (csrfRouter as any).stack.find((l: any) => l.route && l.route.path === '/');
    handler = layer.route.stack[0].handle;
  });

  beforeEach(() => {
    mockRes = {
      cookie: jest.fn(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('GET / generates CSRF token, sets cookies, and returns hashed token (non-production)', () => {
    process.env.NODE_ENV = 'development';
    
    handler(mockReq, mockRes);

    expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    expect(crypto.createHash).toHaveBeenCalledWith('sha256');

    const expectedCookieOptions = expect.objectContaining({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600 * 1000
    });

    expect(mockRes.cookie).toHaveBeenCalledWith('csrf_token', 'mocked_random_token', expectedCookieOptions);
    expect(mockRes.cookie).toHaveBeenCalledWith('csrf_token_hash', 'mocked_hashed_token', expectedCookieOptions);
    expect(mockRes.json).toHaveBeenCalledWith({ csrfToken: 'mocked_hashed_token' });
    expect(logBoth).toHaveBeenCalledTimes(5);
  });

  test('GET / sets secure flag to true in production', () => {
    process.env.NODE_ENV = 'production';
    
    handler(mockReq, mockRes);

    const expectedCookieOptions = expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600 * 1000
    });

    expect(mockRes.cookie).toHaveBeenCalledWith('csrf_token', 'mocked_random_token', expectedCookieOptions);
    expect(mockRes.cookie).toHaveBeenCalledWith('csrf_token_hash', 'mocked_hashed_token', expectedCookieOptions);
  });
});
```
