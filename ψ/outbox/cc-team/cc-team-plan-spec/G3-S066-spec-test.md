<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S066 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":214,"completion_tokens":3341,"total_tokens":3555,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1834,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:39:55.219Z -->
```typescript
import request from 'supertest';
import express from 'express';
import router from '../src/routes/api/motherStats';

// ---------------------------------------------------------------------------
// Contract: the module exports an Express Router that exposes a GET endpoint
// returning mother statistics conforming to the MotherStatsResponse shape.
// We test the observable behavior: correct outputs for valid inputs,
// error/throw on invalid inputs, and boundary conditions.
// ---------------------------------------------------------------------------

// Mock external data dependency (e.g., database or service layer)
jest.mock('../src/services/motherStatsService', () => ({
  getMotherStats: jest.fn(),
}));
import { getMotherStats } from '../src/services/motherStatsService';

// Expected interface shapes (derived from module's public types)
interface ProviderBreakdownEntry {
  provider: string;
  count: number;
  percentage: number;
}
interface MotherStatsResponse {
  totalProviders: number;
  breakdown: ProviderBreakdownEntry[];
  lastUpdated: string;
}
interface ProviderAccumulator {
  // Internal accumulator not part of response; not tested directly.
}

describe('motherStats router — contract tests', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json()); // if body parsing needed
    app.use('/motherStats', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- SUCCESSFUL REQUEST ---
  it('should return 200 and a MotherStatsResponse for valid date parameter', async () => {
    const mockData: MotherStatsResponse = {
      totalProviders: 120,
      breakdown: [
        { provider: 'Alpha', count: 60, percentage: 0.5 },
        { provider: 'Beta', count: 40, percentage: 0.33333 },
        { provider: 'Gamma', count: 20, percentage: 0.16667 },
      ],
      lastUpdated: '2025-02-10T12:00:00Z',
    };
    (getMotherStats as jest.Mock).mockResolvedValue(mockData);

    const response = await request(app)
      .get('/motherStats')
      .query({ date: '2025-02-10' });

    expect(response.status).toBe(200);
    // Verify the response matches the MotherStatsResponse structure
    expect(response.body).toMatchObject<MotherStatsResponse>({
      totalProviders: expect.any(Number),
      breakdown: expect.arrayContaining([
        expect.objectContaining({
          provider: expect.any(String),
          count: expect.any(Number),
          percentage: expect.any(Number),
        }),
      ]),
      lastUpdated: expect.any(String),
    });
    expect(response.body.totalProviders).toBe(120);
    expect(response.body.breakdown).toHaveLength(3);
    // Exact equality
    expect(response.body).toEqual(mockData);
    expect(getMotherStats).toHaveBeenCalledTimes(1);
    expect(getMotherStats).toHaveBeenCalledWith('2025-02-10');
  });

  // --- MISSING REQUIRED PARAMETER ---
  it('should return 400 when required date query parameter is missing', async () => {
    const response = await request(app).get('/motherStats');
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    // Contract: error should be a descriptive string
    expect(typeof response.body.error).toBe('string');
    expect(getMotherStats).not.toHaveBeenCalled();
  });

  // --- INVALID PARAMETER TYPE ---
  it('should return 400 for malformed date', async () => {
    const response = await request(app)
      .get('/motherStats')
      .query({ date: 'not-a-date' });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(getMotherStats).not.toHaveBeenCalled();
  });

  // --- EMPTY DATA (boundary) ---
  it('should return 200 with empty breakdown and zero totalProviders for valid date with no data', async () => {
    const emptyResponse: MotherStatsResponse = {
      totalProviders: 0,
      breakdown: [],
      lastUpdated: '2025-02-10T00:00:00Z',
    };
    (getMotherStats as jest.Mock).mockResolvedValue(emptyResponse);

    const response = await request(app)
      .get('/motherStats')
      .query({ date: '2025-02-10' });
    expect(response.status).toBe(200);
    expect(response.body.totalProviders).toBe(0);
    expect(response.body.breakdown).toEqual([]);
    expect(response.body.lastUpdated).toBe('2025-02-10T00:00:00Z');
  });

  // --- LARGE NUMBERS (boundary) ---
  it('should handle large numbers correctly', async () => {
    const largeData: MotherStatsResponse = {
      totalProviders: 1_000_000,
      breakdown: [
        { provider: 'BigCo', count: 999_999, percentage: 0.999999 },
        { provider: 'SmallCo', count: 1, percentage: 0.000001 },
      ],
      lastUpdated: '2025-02-10T00:00:00Z',
    };
    (getMotherStats as jest.Mock).mockResolvedValue(largeData);

    const response = await request(app)
      .get('/motherStats')
      .query({ date: '2025-02-10' });
    expect(response.status).toBe(200);
    expect(response.body.totalProviders).toBe(1_000_000);
    expect(response.body.breakdown[0].count).toBe(999_999);
  });

  // --- SERVICE ERROR ---
  it('should return 500 when the underlying service throws an error', async () => {
    (getMotherStats as jest.Mock).mockRejectedValue(new Error('Database timeout'));

    const response = await request(app)
      .get('/motherStats')
      .query({ date: '2025-02-10' });
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
    // Contract: error message should be safe for client, not expose internals
    expect(response.body.error).toBe('Internal Server Error');
  });

  // --- UNEXPECTED SERVICE RETURN (shape contract violation) ---
  it('should return 500 if service returns data not matching MotherStatsResponse', async () => {
    // Service returns a string instead of an object – violates contract
    (getMotherStats as jest.Mock).mockResolvedValue('invalid data');

    const response = await request(app)
      .get('/motherStats')
      .query({ date: '2025-02-10' });
    // The router should detect and handle this gracefully; we expect 500 or 503
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
});
```
