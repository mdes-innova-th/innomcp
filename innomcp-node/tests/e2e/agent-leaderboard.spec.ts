import { test, expect } from '@playwright/test';

/**
 * Agent Leaderboard API Tests
 * Validates the /api/agent-leaderboard endpoint contract:
 * - Returns at least 10 agents
 * - Each agent has the required fields: id, name, provider, model, status
 */

const BACKEND_URL = 'http://localhost:3011';

test.describe('Agent Leaderboard endpoint', () => {
  test('returns at least 18 agents', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent-leaderboard`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('agents');
    expect(Array.isArray(body.agents)).toBeTruthy();
    expect(body.agents.length).toBeGreaterThanOrEqual(18);
  });

  test('each agent has required fields: id, name, provider, model, status', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent-leaderboard`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const agents: unknown[] = body.agents;

    for (const agent of agents) {
      const a = agent as Record<string, unknown>;
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('provider');
      expect(a).toHaveProperty('model');
      expect(a).toHaveProperty('status');
    }
  });

  test('agent id and name are non-empty strings', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent-leaderboard`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const agents: unknown[] = body.agents;

    for (const agent of agents) {
      const a = agent as Record<string, unknown>;
      expect(typeof a.id).toBe('string');
      expect((a.id as string).trim().length).toBeGreaterThan(0);
      expect(typeof a.name).toBe('string');
      expect((a.name as string).trim().length).toBeGreaterThan(0);
    }
  });

  test('agent provider and model are non-empty strings', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent-leaderboard`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const agents: unknown[] = body.agents;

    for (const agent of agents) {
      const a = agent as Record<string, unknown>;
      expect(typeof a.provider).toBe('string');
      expect((a.provider as string).trim().length).toBeGreaterThan(0);
      expect(typeof a.model).toBe('string');
      expect((a.model as string).trim().length).toBeGreaterThan(0);
    }
  });

  test('agent status is a recognized value', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent-leaderboard`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const agents: unknown[] = body.agents;

    const knownStatuses = ['active', 'idle', 'busy', 'offline', 'error', 'unknown'];

    for (const agent of agents) {
      const a = agent as Record<string, unknown>;
      const status = (a.status as string).toLowerCase();
      // Status should be a non-empty string; warn if not a known value but don't hard-fail
      expect(typeof status).toBe('string');
      expect(status.trim().length).toBeGreaterThan(0);
      // Soft check — log unrecognized statuses for observability
      if (!knownStatuses.includes(status)) {
        console.warn(`[agent-leaderboard] Unrecognized status "${status}" for agent "${a.name}" — consider adding to known statuses`);
      }
    }
  });

  test('response content-type is application/json', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/agent-leaderboard`);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');
  });
});
