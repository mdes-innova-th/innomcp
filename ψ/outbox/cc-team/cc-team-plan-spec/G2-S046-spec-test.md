<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S046 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":220,"completion_tokens":2397,"total_tokens":2617,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1936,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T11:33:23.686Z -->
```typescript
import aiModeRouter, { getCurrentAIMode } from '../src/routes/api/aiMode';
import * as config from '../config';

// Mock the external config module deterministically
jest.mock('../config', () => ({
  getAiMode: jest.fn(),
}));

const mockedConfig = jest.mocked(config);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCurrentAIMode', () => {
  it('returns "local" when config returns "local"', () => {
    mockedConfig.getAiMode.mockReturnValue('local');
    expect(getCurrentAIMode()).toBe('local');
  });

  it('returns "remote" when config returns "remote"', () => {
    mockedConfig.getAiMode.mockReturnValue('remote');
    expect(getCurrentAIMode()).toBe('remote');
  });

  it('returns "hybrid" when config returns "hybrid"', () => {
    mockedConfig.getAiMode.mockReturnValue('hybrid');
    expect(getCurrentAIMode()).toBe('hybrid');
  });

  it('throws an error when config returns an invalid value', () => {
    mockedConfig.getAiMode.mockReturnValue('invalid');
    expect(() => getCurrentAIMode()).toThrow(
      'Invalid AI mode: invalid'
    );
  });

  it('throws an error when config returns undefined', () => {
    mockedConfig.getAiMode.mockReturnValue(undefined);
    expect(() => getCurrentAIMode()).toThrow(
      'AI mode is not configured'
    );
  });
});

describe('default export (aiModeRouter)', () => {
  it('is defined', () => {
    expect(aiModeRouter).toBeDefined();
  });

  it('is a function (Express Router factory or middleware)', () => {
    expect(typeof aiModeRouter).toBe('function');
  });

  it('has a "get" method', () => {
    expect(typeof (aiModeRouter as any).get).toBe('function');
  });

  it('has a "post" method', () => {
    expect(typeof (aiModeRouter as any).post).toBe('function');
  });
});
```
