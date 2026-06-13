<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T064 role=test model=zai-org/GLM-5.1
 finish_reason: length | tokens: {"prompt_tokens":1527,"completion_tokens":8000,"total_tokens":9527,"prompt_tokens_details":{"cached_tokens":1504,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6795,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 72s
 generated: 2026-06-13T11:06:23.025Z -->
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/motherProviders';
import {
  isProviderEnabled,
  enableProvider,
  disableProvider,
  toggleProvider,
} from '../../services/motherProviderToggle';
import {
  getProviderStats,
  getSparklineData,
} from '../../services/leaderboardMetrics';
import { getHistory } from '../../services/motherHistory';

jest.mock('../../services/motherProviderToggle', () => ({
  isProviderEnabled: jest.fn(),
  enableProvider: jest.fn(),
  disableProvider: jest.fn(),
  toggleProvider: jest.fn(),
  getDisabledProviders: jest.fn(),
}));

jest.mock('../../services/leaderboardMetrics', () => ({
  getProviderStats: jest.fn(),
  getSparklineData: jest.fn(),
}));

jest.mock('../../services/motherHistory', () => ({
  getHistory: jest.fn(),
}));

describe('motherProviders router', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    app = express();
    app.use(express.json());
    app.use('/api/mother/providers', router);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('GET / - lists all providers with enabled state', async () => {
    (isProviderEnabled as jest.Mock).mockImplementation((id: string) => id === 'openai-gpt');
    const res = await request(app).get('/api/mother/providers');
    expect(res.status).toBe(200);
    expect(res.body.totalProviders).toBe(14);
    expect(res.body.enabledCount).toBe(1);
    expect(res.body.providers[0]).toEqual({ providerId: 'mdes-cloud', enabled: false });
    expect(res.body.providers[3]).toEqual({ providerId: 'openai-gpt', enabled: true });
  });

  test('POST /:providerId/enable - enables a known provider', async () => {
    const res = await request(app).post('/api/mother/providers/openai-gpt/enable');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, providerId: 'openai-gpt', enabled: true });
    expect(enableProvider).toHaveBeenCalledWith('openai-gpt');
  });

  test('POST /:providerId/enable - returns 404 for unknown provider', async () => {
    const res = await request(app).post('/api/mother/providers/unknown/enable');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Unknown provider' });
    expect(enableProvider).not.toHaveBeenCalled();
  });

  test('POST /:providerId/disable - disables a known provider', async () => {
    const res = await request(app).post('/api/mother/providers/ollama-local/disable');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, providerId: 'ollama-local', enabled: false });
    expect(disableProvider).toHaveBeenCalledWith('ollama-local');
  });

  test('POST /:providerId/disable - returns 404 for unknown provider', async () => {
    const res = await request(app).post('/api/mother/providers/unknown/disable');
    expect(res.status).toBe(404);
    expect(disableProvider).not.toHaveBeenCalled();
  });

  test('POST /:providerId/toggle - toggles a known provider', async () => {
    (toggleProvider as jest.Mock).mockReturnValue(true);
    const res = await request(app).post('/api/mother/providers/claude-haiku/toggle');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, providerId: 'claude-haiku', enabled: true });
    expect(toggleProvider).toHaveBeenCalledWith('claude-haiku');
  });

  test('POST /:providerId/toggle - returns 404 for unknown provider', async () => {
    const res = await request(app).post('/api/mother/providers/unknown/toggle');
    expect(res.status).toBe(404);
    expect(toggleProvider).not.toHaveBeenCalled();
  });

  test('GET /:providerId/stats - returns stats for a known provider', async () => {
    const statsMap = new Map([
      ['gemini-pro', { requests: 10, avgLatency: 50, p95Latency: 80, successRate: 0.9, wins: 5, winRate: 0.5, avgResponseLength: 100, avgQuality: 0.8, topIntent: 'chat' }]
    ]);
    (getProviderStats as jest.Mock).mockReturnValue(statsMap);
    (getSparklineData as jest.Mock).mockReturnValue([1, 2, 3]);
    (isProviderEnabled as jest.Mock).mockReturnValue(true);

    const res = await request(app).get('/api/mother/providers/gemini-pro/stats');
    expect(res.status).toBe(200);
    expect(res.body.providerId).toBe('gemini-pro');
    expect(res.body.enabled).toBe(true);
    expect(res.body.stats).toEqual({
      requests: 
