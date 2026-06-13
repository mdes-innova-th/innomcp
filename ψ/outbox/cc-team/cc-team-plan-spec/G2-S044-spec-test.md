<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S044 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":198,"completion_tokens":6150,"total_tokens":6348,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5632,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-13T11:32:32.694Z -->
```typescript
import router, { AgentEntry, fetchLiveStats } from '../src/routes/api/agentLeaderboard';

// Deterministic offline mocks for external dependencies (DB / Network)
const mockDbQuery = jest.fn();
jest.mock('../src/db', () => ({
  db: {
    query: mockDbQuery,
  },
}));

const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

describe('agentLeaderboard Module Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchLiveStats()', () => {
    const validAgentEntries: AgentEntry[] = [
      { id: 'agent-1', name: 'Alpha', score: 1500, rank: 1 },
      { id: 'agent-2', name: 'Beta', score: 1400, rank: 2 },
    ];

    it('should resolve with an array of AgentEntry objects when data is available', async () => {
      // Mock both potential data sources (DB and Network) to ensure offline determinism
      mockDbQuery.mockResolvedValue({ rows: validAgentEntries });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validAgentEntries),
      });

      const result = await fetchLiveStats();

      // Assert VALUE: Must return an array matching the AgentEntry contract
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(validAgentEntries.length);
      expect(result).toEqual(validAgentEntries);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'agent-1',
        name: 'Alpha',
        score: 1500,
        rank: 1,
      }));
    });

    it('should resolve with an empty array when no stats are available', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await fetchLiveStats();

      // Assert STATE: Must resolve cleanly with an empty array, not null or undefined
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it('should reject with an error if the data source fails', async () => {
      const dbError = new Error('Database connection failed');
      const networkError = new Error('Network request failed');
      
      mockDbQuery.mockRejectedValue(dbError);
      mockFetch.mockRejectedValue(networkError);

      // Assert THROW: Must reject the promise rather than returning a fallback error state
      await expect(fetchLiveStats()).rejects.toThrow();
    });

    it('should reject if the external API responds with a non-ok status', async () => {
      mockDbQuery.mockRejectedValue(new Error('DB not used'));
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Assert THROW: Must reject on HTTP errors
      await expect(fetchLiveStats()).rejects.toThrow();
    });
  });

  describe('default export (router)', () => {
    it('should export a valid router object with HTTP method handlers', () => {
      expect(router).toBeDefined();
      
      // Assert STATE: Router must conform to standard Express/Next.js router contract
      expect(typeof router).toBe('function');
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.use).toBe('function');
    });
  });
});
```
