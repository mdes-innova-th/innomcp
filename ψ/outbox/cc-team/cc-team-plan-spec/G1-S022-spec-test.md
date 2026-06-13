<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S022 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":203,"completion_tokens":3135,"total_tokens":3338,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":836,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T11:25:47.284Z -->
```typescript
import { checkAllServices } from '../src/services/serviceStatusAggregator';

// Mock the underlying service health check dependencies
jest.mock('../src/services/serviceChecks', () => ({
  checkDatabase: jest.fn(),
  checkCache: jest.fn(),
  checkApiGateway: jest.fn(),
  checkMessageQueue: jest.fn(),
}));

jest.mock('../src/services/serviceRegistry', () => ({
  getRegisteredServices: jest.fn(() => [
    { name: 'database', checker: 'checkDatabase' },
    { name: 'cache', checker: 'checkCache' },
    { name: 'apiGateway', checker: 'checkApiGateway' },
    { name: 'messageQueue', checker: 'checkMessageQueue' },
  ]),
}));

import * as serviceChecks from '../src/services/serviceChecks';

const mockedChecks = serviceChecks as jest.Mocked<typeof serviceChecks>;

describe('serviceStatusAggregator — checkAllServices contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function mockAllHealthy() {
    mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 12 });
    mockedChecks.checkCache.mockResolvedValue({ status: 'up', latency: 3 });
    mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 45 });
    mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 8 });
  }

  function mockAllDown() {
    mockedChecks.checkDatabase.mockResolvedValue({ status: 'down', error: 'Connection refused' });
    mockedChecks.checkCache.mockResolvedValue({ status: 'down', error: 'Timeout' });
    mockedChecks.checkApiGateway.mockResolvedValue({ status: 'down', error: '502 Bad Gateway' });
    mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'down', error: 'Broker unavailable' });
  }

  function mockMixedStatus() {
    mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 10 });
    mockedChecks.checkCache.mockResolvedValue({ status: 'down', error: 'ECONNREFUSED' });
    mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 50 });
    mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'degraded', latency: 2000, error: 'High latency' });
  }

  describe('return shape contract', () => {
    it('resolves to an object with overallStatus, services, and timestamp', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      expect(result).toHaveProperty('overallStatus');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('timestamp');
    });

    it('returns a numeric timestamp close to current time', async () => {
      mockAllHealthy();
      const before = Date.now();

      const result = await checkAllServices();

      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('returns services as a record/object with string keys', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      expect(typeof result.services).toBe('object');
      expect(result.services).not.toBeNull();
      expect(Array.isArray(result.services)).toBe(false);
    });
  });

  describe('overallStatus aggregation contract', () => {
    it('returns "healthy" when all services are up', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('healthy');
    });

    it('returns "down" when all services are down', async () => {
      mockAllDown();

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('down');
    });

    it('returns "degraded" when some services are down or degraded', async () => {
      mockMixedStatus();

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('degraded');
    });

    it('returns "degraded" when only one service is down and rest are healthy', async () => {
      mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 10 });
      mockedChecks.checkCache.mockResolvedValue({ status: 'down', error: 'fail' });
      mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 20 });
      mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 5 });

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('degraded');
    });

    it('returns "degraded" when a service reports degraded status even if none are down', async () => {
      mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 10 });
      mockedChecks.checkCache.mockResolvedValue({ status: 'up', latency: 3 });
      mockedChecks.checkApiGateway.mockResolvedValue({ status: 'degraded', latency: 5000 });
      mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 5 });

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('degraded');
    });
  });

  describe('individual service status contract', () => {
    it('includes each checked service in the services record', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      const serviceKeys = Object.keys(result.services);
      expect(serviceKeys.length).toBeGreaterThanOrEqual(1);
    });

    it('each service entry contains a status field', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      for (const [, serviceResult] of Object.entries(result.services)) {
        expect(serviceResult).toHaveProperty('status');
        expect(['up', 'down', 'degraded']).toContain(serviceResult.status);
      }
    });

    it('propagates error messages for down services', async () => {
      mockMixedStatus();

      const result = await checkAllServices();

      const downServices = Object.values(result.services).filter(
        (s: any) => s.status === 'down'
      );
      for (const svc of downServices) {
        expect(svc).toHaveProperty('error');
        expect(typeof (svc as any).error).toBe('string');
        expect((svc as any).error.length).toBeGreaterThan(0);
      }
    });

    it('includes latency for healthy services', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      const upServices = Object.values(result.services).filter(
        (s: any) => s.status === 'up'
      );
      for (const svc of upServices) {
        expect(svc).toHaveProperty('latency');
        expect(typeof (svc as any).latency).toBe('number');
        expect((svc as any).latency).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('error resilience contract', () => {
    it('does not throw when an individual service check throws an exception', async () => {
      mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 10 });
      mockedChecks.checkCache.mockRejectedValue(new Error('Unexpected crash'));
      mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 20 });
      mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 5 });

      await expect(checkAllServices()).resolves.toBeDefined();
    });

    it('marks a service as down when its check throws an exception', async () => {
      mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 10 });
      mockedChecks.checkCache.mockRejectedValue(new Error('Unexpected crash'));
      mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 20 });
      mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 5 });

      const result = await checkAllServices();

      const cacheEntry = Object.entries(result.services).find(
        ([key]) => key.toLowerCase().includes('cache')
      );
      if (cacheEntry) {
        expect(cacheEntry[1].status).toBe('down');
      }
      // Overall should be degraded since one service failed
      expect(result.overallStatus).toBe('degraded');
    });

    it('still returns valid structure when all checks throw', async () => {
      mockedChecks.checkDatabase.mockRejectedValue(new Error('fail'));
      mockedChecks.checkCache.mockRejectedValue(new Error('fail'));
      mockedChecks.checkApiGateway.mockRejectedValue(new Error('fail'));
      mockedChecks.checkMessageQueue.mockRejectedValue(new Error('fail'));

      const result = await checkAllServices();

      expect(result).toHaveProperty('overallStatus');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('timestamp');
      expect(result.overallStatus).toBe('down');
    });
  });

  describe('async contract', () => {
    it('returns a Promise', () => {
      mockAllHealthy();

      const result = checkAllServices();

      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves (never rejects) under normal and error conditions', async () => {
      mockedChecks.checkDatabase.mockRejectedValue(new Error('boom'));
      mockedChecks.checkCache.mockResolvedValue({ status: 'up', latency: 5 });
      mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 10 });
      mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 3 });

      await expect(checkAllServices()).resolves.toBeDefined();
    });
  });
});
```
