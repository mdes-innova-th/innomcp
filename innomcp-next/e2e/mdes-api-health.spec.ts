import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('INNOMCP API Health Endpoints', () => {
  test('GET /api/health returns 200 with status field', async ({ request }) => {
    const response = await request.get(`${BASE}/api/health`);
    const body = await response.text();
    try {
      expect(response.status()).toBe(200);
      const json = JSON.parse(body);
      expect(json).toHaveProperty('status');
    } catch (e) {
      await test.info().attach('response body', { body });
      throw e;
    }
  });

  test('GET /api/mdes/health returns 200 or 503 without crashing', async ({ request }) => {
    const response = await request.get(`${BASE}/api/mdes/health`);
    const body = await response.text();
    try {
      expect([200, 503]).toContain(response.status());
    } catch (e) {
      await test.info().attach('response body', { body });
      throw e;
    }
  });

  test('GET /api/mdes/models returns 200 with models array', async ({ request }) => {
    const response = await request.get(`${BASE}/api/mdes/models`);
    const body = await response.text();
    try {
      expect(response.status()).toBe(200);
      const json = JSON.parse(body);
      expect(json).toHaveProperty('models');
      expect(Array.isArray(json.models)).toBe(true);
    } catch (e) {
      await test.info().attach('response body', { body });
      throw e;
    }
  });

  test('POST /api/feedback with valid body returns 200 or 201', async ({ request }) => {
    const response = await request.post(`${BASE}/api/feedback`, {
      data: {
        rating: 5,
        comment: 'E2E test feedback',
      },
    });
    const body = await response.text();
    try {
      expect([200, 201]).toContain(response.status());
    } catch (e) {
      await test.info().attach('response body', { body });
      throw e;
    }
  });

  test('GET /api/stats returns 200 with session field', async ({ request }) => {
    const response = await request.get(`${BASE}/api/stats`);
    const body = await response.text();
    try {
      expect(response.status()).toBe(200);
      const json = JSON.parse(body);
      expect(json).toHaveProperty('session');
    } catch (e) {
      await test.info().attach('response body', { body });
      throw e;
    }
  });
});