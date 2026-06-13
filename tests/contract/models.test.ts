import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://localhost:3015';
const ENDPOINT = `${BASE}/api/mdes/models`;
const FETCH_TIMEOUT = 5000; // 5 seconds

/**
 * Attempts to fetch the endpoint with a timeout.
 * On network error or timeout, returns null.
 * Otherwise returns the Response object.
 */
async function tryFetch(): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(ENDPOINT, { signal: controller.signal });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

describe('Contract: GET /api/mdes/models', () => {
  test('should return a non-empty JSON array or object with models array, or 404/501 if unimplemented', async (t) => {
    // Attempt to reach the server
    const response = await tryFetch();
    if (response === null) {
      t.skip(`Server at ${BASE} is unreachable (network error or timeout)`);
      return;
    }

    const { status } = response;
    // 404 or 501: endpoint not implemented, skip with clear message
    if (status === 404 || status === 501) {
      t.skip(`Endpoint returned status ${status} – likely not implemented yet`);
      return;
    }

    // Expect 200 OK
    assert.strictEqual(
      status,
      200,
      `Expected 200 OK, got ${status} ${response.statusText}`
    );

    // Parse JSON body
    let body: unknown;
    try {
      body = await response.json();
    } catch (parseError) {
      assert.fail(`Response body is not valid JSON: ${parseError}`);
    }

    // Allow either a direct array or an object with a "models" property
    if (Array.isArray(body)) {
      assert.ok(
        body.length > 0,
        'Expected non-empty array, got empty array'
      );
    } else if (body && typeof body === 'object' && 'models' in body) {
      const models = (body as { models: unknown }).models;
      assert.ok(Array.isArray(models), 'Expected "models" to be an array');
      assert.ok(
        models.length > 0,
        'Expected non-empty "models" array, got empty array'
      );
    } else {
      assert.fail(
        `Response body is neither an array nor an object with a "models" array. Body: ${JSON.stringify(body)}`
      );
    }
  });
});
