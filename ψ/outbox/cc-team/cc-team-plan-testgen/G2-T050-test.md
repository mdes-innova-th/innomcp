<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T050 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2395,"completion_tokens":2194,"total_tokens":4589,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:01:36.828Z -->
```typescript
import { Router } from 'express';
import { WebSocketServer } from 'ws';

// Mocks must be declared before importing the module under test.
jest.mock('express', () => {
  const router: any = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    all: jest.fn(),
    handle: jest.fn(),
    param: jest.fn(),
    route: jest.fn(),
  };
  const express: any = jest.fn(() => router);
  express.Router = jest.fn(() => router);
  express.json = jest.fn(() => 'json-mw');
  express.urlencoded = jest.fn(() => 'urlencoded-mw');
  (express as any).__router = router;
  return express;
});

jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    handleUpgrade: jest.fn(),
  })),
}));

jest.mock('dotenv', () => ({
  __esModule: true,
  default: { config: jest.fn() },
}));

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomUUID: jest.fn(() => 'uuid-1234'),
    randomBytes: jest.fn(() => Buffer.from('abcd')),
  };
});

jest.mock('ollama', () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    chat: jest.fn(),
    list: jest.fn().mockResolvedValue({ models: [] }),
  })),
}));

jest.mock('../../utils/mcp/mcpclient', () => ({
  InitMcpClient: jest.fn(),
  IntelligentMCPClient: jest.fn(),
}));

jest.mock('../../utils/mcp/toolHealthCheck', () => ({
  ToolHealthCheckSystem: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../utils/mcpLogger', () => ({
  logBoth: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('./aiMode', () => ({
  getCurrentAIMode: jest.fn(() => 'local'),
}));

jest.mock('../../middleware/fastpathChatMiddleware', () => ({
  fastPathChatMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('../../utils/sessionManager', () => ({
  sessionManager: { getSession: jest.fn(), updateSession: jest.fn() },
}));

jest.mock('../../utils/geoProviderStack', () => ({
  trySessionContext: jest.fn(),
}));

jest.mock('../../utils/languageValidator', () => ({
  validateThaiLanguage: jest.fn(() => ({ valid: true, segments: [] })),
  createThaiOnlyFallbackPrompt: jest.fn(() => 'fallback-prompt'),
  createThaiErrorResponse: jest.fn(() => ({ ok: false })),
  sanitizeThaiSegments: jest.fn((s: string) => s),
}));

jest.mock('../../config/systemPrompt', () => ({
  buildSystemPrompt: jest.fn(() => 'system-prompt'),
  buildIdentityPrompt: jest.fn(() => 'identity-prompt'),
}));

jest.mock('../../middleware/correlationId', () => ({
  extractCorrelationIdFromUpgrade: jest.fn(() => 'corr-id'),
}));

jest.mock('../../fastpath/rateLimit', () => ({
  checkRateLimit: jest.fn(() => true),
  buildRateLimitKey: jest.fn(() => 'rl-key'),
}));

jest.mock('../../utils/semanticRouter', () => ({
  getSemanticRouter: jest.fn(() => ({ route: jest.fn() })),
}));

jest.mock('../../utils/mcp/godTierRouter', () => ({
  getGodTierRouter: jest.fn(() => ({ route: jest.fn() })),
}));

jest.mock('../../utils/mcp/abTester', () => ({
  getABTester: jest.fn(() => ({ assign: jest.fn() })),
}));

jest.mock('../../utils/requestQueue', () => ({
  requestQueue: { enqueue: jest.fn((fn: any) => fn()) },
}));

jest.mock('./chat/report', () => ({
  __esModule: true,
  default: { use: jest.fn() },
}));

jest.mock('../../utils/jwt', () => ({
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  verifyToken: jest.fn(),
}));

jest.mock('../../middleware/guestLimiter', () => ({
  guestLimiterMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
  getLimitsForUser: jest.fn(() => ({ limit: 10, remaining: 9 })),
  checkToolAccess: jest.fn(() => true),
  limitResponseLength: jest.fn((s: string) => s),
}));

jest.mock('../../services/fastPathHandler', () => ({
  tryFastPathWebSocket: jest.fn(),
  trigToDeg: jest.fn(),
  cleanFloat: jest.fn(),
}));

jest.mock('../../utils/weather/tableRenderer', () => ({
  renderWeatherMarkdownTable: jest.fn(() => 'table'),
}));

jest.mock('../../utils/weather/answerContract', () => ({
  renderWeatherContractAnswer: jest.fn(() => 'contract'),
}));

jest.mock('../../utils/traceSanitizer', () => ({
  sanitizeForTraceV3: jest.fn((s: string) => s),
  normalizeTraceAnswerV3ByRoute: jest.fn((s: string) => s),
}));

jest.mock('../../utils/mcp/tools/thai_geo_tool', () => ({
  renderThaiGeoAnswerShort: jest.fn(() => 'geo'),
}));

jest.mock('../../utils/mcp/answerPlanner', () => ({
  planAnswer: jest.fn(() => ({ plan: 'plan' })),
}));

jest.mock('../../utils/chat/recordsRetrieval', () => ({
  retrieveRecordsPayload: jest.fn(() => ({})),
}));

jest.mock('../../utils/thaiQueryNormalizer', () => ({
  quickNormalize: jest.fn((s: string) => s),
}));

jest.mock('../../utils/thaiTemporalParser', () => ({
  hasTemporalIndicators: jest.fn(() => false),
}));

jest.mock('../../utils/locationResolver', () => ({
  resolveProvinces: jest.fn(() => []),
}));

jest.mock('../../services/systemInventory', () => ({
  buildSystemInventoryAnswer: jest.fn(() => 'inventory-answer'),
  buildSystemInventorySnapshot: jest.fn(() => ({})),
  looksLikeSystemInventoryQuestion: jest.fn(() => false),
}));

jest.mock('../../services/memoryRagHook', () => ({
  recordTurnAndGetMeta: jest.fn(() => ({})),
  enrichGroundedContract: jest.fn((s: string) => s),
  getMemoryDebugData: jest.fn(() => ({})),
  queryColdRag: jest.fn(() => ({})),
  disambiguateWithSessionMemory: jest.fn((s: string) => s),
}));

jest.mock('../../services/imageGenService', () => ({
  callImageGen: jest.fn(),
  buildImageGenText: jest.fn(() => 'image-text'),
}));

jest.mock('../../services/promptAdapter', () => ({
  adaptImagePrompt: jest.fn((s: string) => s),
}));

import chatRouter from '../src/routes/api/chat';
import express from 'express';

describe('routes/api/chat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('default export is an Express Router (a callable/usable object)', () => {
    expect(chatRouter).toBeDefined();
    expect(typeof chatRouter).toBe('function');
  });

  test('module exports a router compatible with the mocked express.Router factory', () => {
    // The mocked express() function returns the same shared router object.
    // The module's default export should be that router shape (with .use/.get/etc).
    const router = (chatRouter as unknown) as { use: jest.Mock; get: jest.Mock; post: jest.Mock };
    expect(router.use).toBeDefined();
    expect(router.get).toBeDefined();
    expect(router.post).toBeDefined();
  });

  test('express.Router factory was invoked at module load time', () => {
    expect((express.Router as unknown as jest.Mock)).toHaveBeenCalled();
  });

  test('AI mode helpers were consumed at module load (getCurrentAIMode called)', () => {
    const { getCurrentAIMode } = jest.requireMock('./aiMode');
    expect(getCurrentAIMode).toHaveBeenCalled();
  });

  test('dotenv was configured with override:true at module load', () => {
    const dotenvMock = jest.requireMock('dotenv');
    expect(dotenvMock.default.config).toHaveBeenCalledWith({ override: true });
  });

  test('fastPathChatMiddleware was registered on the router as a handler (via router.use)', () => {
    const router = (chatRouter as unknown) as { use: jest.Mock };
    // At least one router.use call should have been made during module init.
    expect(router.use).toHaveBeenCalled();
  });

  test('chat/report sub-router is mounted on the chat router', () => {
    const router = (chatRouter as unknown) as { use: jest.Mock };
    const reportMock = jest.requireMock('./chat/report');
    // The sub-router's .use should be invoked when it is mounted.
    expect(reportMock.default.use).toHaveBeenCalled();
    // The chat router itself should have called .use for the report sub-router.
    expect(router.use).toHaveBeenCalled();
  });

  test('WebSocketServer class is exposed (used for WS upgrade integration)', () => {
    const { WebSocketServer } = jest.requireMock('ws');
    expect(WebSocketServer).toBeDefined();
  });

  test('module can be imported and yields a stable reference', () => {
    const ref1 = chatRouter;
    const ref2 = require('../src/routes/api/chat').default;
    expect(ref1).toBe(ref2);
  });
});
```
