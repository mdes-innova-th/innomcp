<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T022 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":548,"completion_tokens":3153,"total_tokens":3701,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2601,"image_tokens":0},"cache_creation_input_tokens":0} | 64s
 generated: 2026-06-13T10:55:34.160Z -->
```typescript
import { checkAllServices } from '../src/services/serviceStatusAggregator';
import { analyticsService } from '../src/services/analyticsService';
import { mdesModelCache } from '../src/services/mdesModelCache';
import { thaiNLPService } from '../src/services/thaiNLPService';

jest.mock('../src/services/analyticsService', () => ({
  analyticsService: {
    getStats: jest.fn(),
  },
}));

jest.mock('../src/services/mdesModelCache', () => ({
  mdesModelCache: {
    getModels: jest.fn(),
  },
}));

jest.mock('../src/services/thaiNLPService', () => ({
  thaiNLPService: {
    isThai: jest.fn(),
  },
}));

describe('serviceStatusAggregator', () => {
  const mockGetStats = analyticsService.getStats as jest.Mock;
  const mockGetModels = mdesModelCache.getModels as jest.Mock;
  const mockIsThai = thaiNLPService.isThai as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns true for all services when all succeed', async () => {
    mockGetStats.mockResolvedValue({});
    mockGetModels.mockResolvedValue([]);
    mockIsThai.mockResolvedValue(true);

    const result = await checkAllServices();

    expect(result).toEqual({
      analytics: true,
      mdesModels: true,
      thaiNlp: true,
    });
  });

  test('returns false for all services when all fail', async () => {
    mockGetStats.mockRejectedValue(new Error('Analytics failed'));
    mockGetModels.mockRejectedValue(new Error('MDES failed'));
    mockIsThai.mockRejectedValue(new Error('NLP failed'));

    const result = await checkAllServices();

    expect(result).toEqual({
      analytics: false,
      mdesModels: false,
      thaiNlp: false,
    });
  });

  test('returns mixed results when some services fail', async () => {
    mockGetStats.mockResolvedValue({});
    mockGetModels.mockRejectedValue(new Error('MDES failed'));
    mockIsThai.mockResolvedValue(true);

    const result = await checkAllServices();

    expect(result).toEqual({
      analytics: true,
      mdesModels: false,
      thaiNlp: true,
    });
  });
});
```
