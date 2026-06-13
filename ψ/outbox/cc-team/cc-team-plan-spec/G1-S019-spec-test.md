<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S019 role=spec-test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":293,"completion_tokens":4772,"total_tokens":5065,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3339,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T11:24:45.918Z -->
```typescript
import {
  ProbeStatus,
  ProviderProbeResult,
  probeStatus,
  runSingleProbe,
  runProbe,
  getProbeStatus,
  getAll
} from '../src/services/providerHealthProbe';

// ProbeTarget is not exported, so we define a compatible local interface
interface ProbeTarget {
  providerId: string;
  baseUrl?: string;
  apiKey?: string;
}

// Mock global fetch for deterministic offline testing of network probes
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('providerHealthProbe Contract Tests', () => {
  beforeEach(() => {
    // Clear the shared state map before each test to ensure isolation
    probeStatus.clear();
    mockFetch.mockReset();
  });

  describe('getProbeStatus', () => {
    it('should return a valid ProbeStatus for an unknown provider', () => {
      const status = getProbeStatus('unknown-provider');
      const validStatuses: ProbeStatus[] = ['online', 'offline', 'configured', 'checking'];
      expect(validStatuses).toContain(status);
    });

    it('should return "online" or "offline" for a probed provider based on state', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      await runSingleProbe({ providerId: 'test-provider', baseUrl: 'http://test.local' });
      
      const status = getProbeStatus('test-provider');
      expect(status).toBe('online');
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      await runSingleProbe({ providerId: 'test-provider', baseUrl: 'http://test.local' });
      
      const updatedStatus = getProbeStatus('test-provider');
      expect(updatedStatus).toBe('offline');
    });

    it('should throw a TypeError or Error if providerId is invalid', () => {
      expect(() => getProbeStatus('')).toThrow();
      // @ts-expect-error - Testing contract violation of missing argument
      expect(() => getProbeStatus()).toThrow();
    });
  });

  describe('getAll', () => {
    it('should return an empty array when no probes have been run', () => {
      const results = getAll();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should return an array of ProviderProbeResult matching the probeStatus map', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      
      await runSingleProbe({ providerId: 'provider-1', baseUrl: 'http://test1.local' });
      await runSingleProbe({ providerId: 'provider-2', baseUrl: 'http://test2.local' });

      const results = getAll();
      expect(results.length).toBe(2);
      
      const ids = results.map(r => r.providerId);
      expect(ids).toContain('provider-1');
      expect(ids).toContain('provider-2');
      
      results.forEach(result => {
        expect(result.status).toBe('online');
      });
    });
  });

  describe('runSingleProbe', () => {
    it('should return a ProviderProbeResult with status "online" on successful connection', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      
      const target: ProbeTarget = { providerId: 'ollama', baseUrl: 'http://localhost:11434' };
      const result = await runSingleProbe(target);

      expect(result.providerId).toBe('ollama');
      expect(result.status).toBe('online');
      expect(typeof result.latency).toBe('number');
      expect(result.error).toBeUndefined();
    });

    it('should return a ProviderProbeResult with status "offline" on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      
      const target: ProbeTarget = { providerId: 'openai', baseUrl: 'https://api.openai.com' };
      const result = await runSingleProbe(target);

      expect(result.providerId).toBe('openai');
      expect(result.status).toBe('offline');
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should update the global probeStatus map with the result', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      
      expect(probeStatus.has('anthropic')).toBe(false);
      
      const target: ProbeTarget = { providerId: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'test-key' };
      await runSingleProbe(target);

      expect(probeStatus.has('anthropic')).toBe(true);
      expect(probeStatus.get('anthropic')?.status).toBe('online');
    });

    it('should throw an error if the target is missing a providerId', async () => {
      // @ts-expect-error - Testing contract violation
      const target: ProbeTarget = { baseUrl: 'http://test.local' };
      await expect(runSingleProbe(target)).rejects.toThrow();
    });
  });

  describe('runProbe', () => {
    it('should execute without throwing and update the probeStatus map for configured providers', async () => {
      // runProbe takes no arguments and probes whatever is internally configured.
      // Assuming default configuration might include at least one provider or gracefully handle zero.
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      
      await expect(runProbe()).resolves.toBeUndefined();
      
      // The map should be populated based on internal defaults. 
      // We verify the contract that the map state changes or remains valid.
      const allResults = getAll();
      expect(Array.isArray(allResults)).toBe(true);
      
      if (allResults.length > 0) {
        allResults.forEach(res => {
          expect(res.providerId).toBeTruthy();
          expect(['online', 'offline', 'configured', 'checking']).toContain(res.status);
        });
      }
    });

    it('should handle complete network inaccessibility gracefully without throwing', async () => {
      mockFetch.mockRejectedValue(new Error('No internet'));
      
      await expect(runProbe()).resolves.toBeUndefined();
      
      const allResults = getAll();
      if (allResults.length > 0) {
        allResults.forEach(res => {
          // If providers were configured but unreachable, they must be offline
          expect(res.status).toBe('offline');
        });
      }
    });
  });

  describe('probeStatus Map State', () => {
    it('should reflect the exact state of the last runSingleProbe for a given providerId', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      await runSingleProbe({ providerId: 'state-test', baseUrl: 'http://test.local' });
      expect(probeStatus.get('state-test')?.status).toBe('online');

      mockFetch.mockRejectedValue(new Error('Timeout'));
      await runSingleProbe({ providerId: 'state-test', baseUrl: 'http://test.local' });
      expect(probeStatus.get('state-test')?.status).toBe('offline');
    });
  });
});
```
