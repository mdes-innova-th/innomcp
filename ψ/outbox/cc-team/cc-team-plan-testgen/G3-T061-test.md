<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T061 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1737,"completion_tokens":2583,"total_tokens":4320,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":659,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:03:38.595Z -->
```typescript
import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock dependencies before importing the module under test
jest.mock('../../src/services/motherProviderToggle', () => ({
  isProviderEnabled: jest.fn<(...args: any[]) => boolean>(),
  getDisabledProviders: jest.fn<(...args: any[]) => string[]>(),
}));

jest.mock('../../src/utils/errorRecovery', () => ({
  errorRecovery: {
    getCircuitStatus: jest.fn<(...args: any[]) => { state: string }>(),
  },
}));

import motherConfigRouter from '../src/routes/api/motherConfig';
import { isProviderEnabled, getDisabledProviders } from '../src/services/motherProviderToggle';
import { errorRecovery } from '../src/utils/errorRecovery';

// Helper to create an Express app with the router mounted
function createApp() {
  const app = express();
  app.use('/api/mother/config', motherConfigRouter);
  return app;
}

describe('motherConfig router', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    // Set a fixed date for deterministic timestamps
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    // Reset all mocks
    jest.clearAllMocks();

    // Set default environment variables (override any that might be set)
    process.env = {
      ...originalEnv,
      MDES_ONLY: '0',
      MOTHER_DISPATCH: '1',
      PARALLEL_AGENTS: '1',
      REMOTE_OLLAMA_TOKEN: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      GITHUB_COPILOT_TOKEN: '',
      GEMINI_API_KEY: '',
      MISTRAL_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      GROQ_API_KEY: '',
      TOGETHER_API_KEY: '',
    };

    // Default mock implementations
    (isProviderEnabled as jest.Mock).mockImplementation((providerId: string) => {
      // By default all providers are enabled except those in disabled list
      const disabled = (getDisabledProviders as jest.Mock)();
      return !disabled.includes(providerId);
    });
    (getDisabledProviders as jest.Mock).mockReturnValue([]);
    (errorRecovery.getCircuitStatus as jest.Mock).mockImplementation((_key: string) => {
      return { state: 'CLOSED' };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  test('GET / should return 200 and expected structure with default env', async () => {
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalProviders: 14,
      alwaysOnCount: 3,
      enabledCount: 14,
      keyConfiguredCount: 3,
      disabledProviders: [],
      timestamp: '2025-01-01T00:00:00.000Z',
      providers: expect.any(Array),
      featureFlags: expect.any(Object),
    });
    // Check that each provider has the expected fields
    res.body.providers.forEach((p: any) => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('model');
      expect(p).toHaveProperty('kind');
      expect(p).toHaveProperty('alwaysOn');
      expect(p).toHaveProperty('enabled');
      expect(p).toHaveProperty('keyConfigured');
      expect(p).toHaveProperty('circuitState');
      expect(p).toHaveProperty('envKey');
    });
    // Verify alwaysOn providers have keyConfigured true even without env vars
    const alwaysOn = res.body.providers.filter((p: any) => p.alwaysOn);
    alwaysOn.forEach((p: any) => {
      expect(p.keyConfigured).toBe(true);
    });
    // Verify non-alwaysOn providers have keyConfigured false (since env vars are empty)
    const notAlwaysOn = res.body.providers.filter((p: any) => !p.alwaysOn);
    notAlwaysOn.forEach((p: any) => {
      expect(p.keyConfigured).toBe(false);
    });
  });

  test('GET / should reflect disabled providers from getDisabledProviders mock', async () => {
    (getDisabledProviders as jest.Mock).mockReturnValue(['mdes-cloud', 'openai-gpt']);
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    expect(res.body.disabledProviders).toEqual(['mdes-cloud', 'openai-gpt']);
    const mdes = res.body.providers.find((p: any) => p.id === 'mdes-cloud');
    expect(mdes.enabled).toBe(false);
    const gpt = res.body.providers.find((p: any) => p.id === 'openai-gpt');
    expect(gpt.enabled).toBe(false);
    // Other providers remain enabled
    const claude = res.body.providers.find((p: any) => p.id === 'claude-haiku');
    expect(claude.enabled).toBe(true);
  });

  test('GET / should set keyConfigured based on env var presence', async () => {
    // Set a key for one provider
    process.env.OPENAI_API_KEY = 'sk-abc123';
    // Also set a key for a provider that is not alwaysOn but has envKey
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    const openai = res.body.providers.find((p: any) => p.id === 'openai-gpt');
    expect(openai.keyConfigured).toBe(true);
    const claude = res.body.providers.find((p: any) => p.id === 'claude-haiku');
    expect(claude.keyConfigured).toBe(false); // ANTHROPIC_API_KEY not set
  });

  test('GET / should reflect feature flags from environment', async () => {
    process.env.MDES_ONLY = '1';
    process.env.MOTHER_DISPATCH = '0';
    process.env.PARALLEL_AGENTS = '0';
    process.env.MDES_SYNTHESIS_MODEL = 'custom-model';
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    expect(res.body.featureFlags).toEqual({
      mdesOnly: true,
      motherDispatch: false,
      parallelAgents: false,
      synthesisModel: 'custom-model',
      motherTimeout: 20000,
      minAgents: 5,
    });
  });

  test('GET / should return UNKNOWN circuit state when getCircuitStatus returns null/undefined', async () => {
    (errorRecovery.getCircuitStatus as jest.Mock).mockReturnValue(null);
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    res.body.providers.forEach((p: any) => {
      expect(p.circuitState).toBe('UNKNOWN');
    });
  });

  test('GET / should include envKey field (key name, not value) for each provider', async () => {
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    const openai = res.body.providers.find((p: any) => p.id === 'openai-gpt');
    expect(openai.envKey).toBe('OPENAI_API_KEY');
    const local = res.body.providers.find((p: any) => p.id === 'ollama-local');
    expect(local.envKey).toBe('(none)');
  });

  test('GET / should call getCircuitStatus with correct key format', async () => {
    const app = createApp();
    await request(app).get('/api/mother/config');
    expect(errorRecovery.getCircuitStatus).toHaveBeenCalledWith('mother-mdes-cloud');
    expect(errorRecovery.getCircuitStatus).toHaveBeenCalledWith('mother-ollama-local');
    // etc. – we can check a sample
  });

  test('GET / should use fake timers for timestamp', async () => {
    jest.setSystemTime(new Date('2024-06-15T12:30:00Z'));
    const app = createApp();
    const res = await request(app).get('/api/mother/config');
    expect(res.body.timestamp).toBe('2024-06-15T12:30:00.000Z');
  });
});
```
