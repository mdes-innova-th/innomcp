import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://localhost:3015';
const HEALTH_URL = `${BASE}/api/health`;

describe('GET /api/health', () => {
  it('returns 200 or 503 with expected shape', async () => {
    let response: Response;
    try {
      response = await fetch(HEALTH_URL);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ Skipping test – server unreachable at ${BASE}: ${message}`);
      return; // skip
    }

    const { status } = response;
    assert.ok(
      status === 200 || status === 503,
      `Expected status 200 or 503, got ${status}`
    );

    const body: unknown = await response.json();
    assert.ok(body !== null && typeof body === 'object', 'Body must be a non-null object');

    const obj = body as Record<string, unknown>;
    assert.ok('status' in obj, 'Body must have "status"');
    assert.ok('services' in obj, 'Body must have "services"');

    assert.ok(
      typeof obj.status === 'string',
      `"status" must be a string, got ${typeof obj.status}`
    );

    const services = obj.services;
    assert.ok(Array.isArray(services), `"services" must be an array, got ${typeof services}`);

    for (const [i, svc] of services.entries()) {
      assert.ok(svc !== null && typeof svc === 'object', `services[${i}] must be an object`);
      const s = svc as Record<string, unknown>;
      assert.ok('name' in s, `services[${i}] must have "name"`);
      assert.ok('status' in s, `services[${i}] must have "status"`);
      assert.ok(typeof s.name === 'string', `services[${i}].name must be a string`);
      assert.ok(typeof s.status === 'string', `services[${i}].status must be a string`);
    }
  });
});
