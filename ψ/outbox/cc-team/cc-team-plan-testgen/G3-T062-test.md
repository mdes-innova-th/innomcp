<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T062 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":991,"completion_tokens":4762,"total_tokens":5753,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3547,"image_tokens":0},"cache_creation_input_tokens":0} | 88s
 generated: 2026-06-13T11:05:02.044Z -->
```typescript
import router from '../src/routes/api/motherHandoff';
import { getHistory } from '../src/services/motherHistory';
import { getProviderStats } from '../src/services/leaderboardMetrics';
import { getDisabledProviders } from '../src/services/motherProviderToggle';
import { Request, Response } from 'express';

jest.mock('../src/services/motherHistory', () => ({
  getHistory: jest.fn(),
}));

jest.mock('../src/services/leaderboardMetrics', () => ({
  getProviderStats: jest.fn(),
}));

jest.mock('../src/services/motherProviderToggle', () => ({
  getDisabledProviders: jest.fn(),
}));

describe('motherHandoff Router', () => {
  const mockGetHistory = getHistory as jest.MockedFunction<typeof getHistory>;
  const mockGetProviderStats = getProviderStats as jest.MockedFunction<typeof getProviderStats>;
  const mockGetDisabledProviders = getDisabledProviders as jest.MockedFunction<typeof getDisabledProviders>;

  let handler: (req: Request, res: Response) => void;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeAll(() => {
    const layer = (router as any).stack.find((l: any) => l.route && l.route.path === '/');
    handler = layer.route.stack[0].handle;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    mockReq = {};
    mockRes = {
      send: sendMock,
      setHeader: setHeaderMock,
    };

    mockGetHistory.mockReturnValue([]);
    mockGetProviderStats.mockReturnValue(new Map());
    mockGetDisabledProviders.mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('generates correct markdown with populated data', () => {
    mockGetHistory.mockReturnValue([
      { timestamp: '2024-01-01T12:00:00.000Z', fastestProvider: 'ProviderA', successCount: 3, totalProviders: 5, query: 'Hello world query' } as any,
      { timestamp: '2024-01-01T12:05:00.000Z', fastestProvider: 'ProviderB', successCount: 2, totalProviders: 4, query: 'Another query' } as any,
    ]);

    mockGetProviderStats.mockReturnValue(new Map([
      ['ProviderA', { requests: 10, wins: 5, successRate: 80, avgLatency: 150 }],
      ['ProviderB', { requests: 8, wins: 2, successRate: 60, avgLatency: 200 }],
    ]));

    mockGetDisabledProviders.mockReturnValue(['ProviderC']);

    handler(mockReq as Request, mockRes as Response);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(sendMock).toHaveBeenCalledTimes(1);

    const markdown = sendMock.mock.calls[0][0] as string;
    expect(markdown).toContain('# Mother Dispatch Session Handoff');
    expect(markdown).toContain('Generated: 2024-01-01T00:00:00.000Z');
    expect(markdown).toContain('Total dispatches this session: 2');
    expect(markdown).toContain('Total provider wins: 7');
    expect(markdown).toContain('Top provider: ProviderA (5 wins)');
    expect(markdown).toContain('Disabled providers: ProviderC');
    expect(markdown).toContain('Active providers with data: 2/14');
    expect(markdown).toContain('- 2024-01-01T12:00:00 | ProviderA won | 3/5 responded | query: "Hello world query"');
    expect(markdown).toContain('- ProviderA: 10 req, 5 wins, 80% success, 150ms avg');
    expect(markdown).toContain('Push recent commits to remote');
  });

  test('generates correct markdown with empty data', () => {
    handler(mockReq as Request, mockRes as Response);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(sendMock).toHaveBeenCalledTimes(1);

    const markdown = sendMock.mock.calls[0][0] as string;
    expect(markdown).toContain('Total dispatches this session: 0');
    expect(markdown).toContain('Total provider wins: 0');
    expect(markdown).toContain('Top provider: none yet');
    expect(markdown).toContain('Disabled providers: none');
    expect(markdown).toContain('Active providers with data: 0/14');
    expect(markdown).toContain('No runs yet');
    expect(markdown).toContain('No provider data yet');
    expect(markdown).toContain('Push pending commits to remote');
  });
});
```
