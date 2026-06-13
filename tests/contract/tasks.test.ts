import { test } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE = process.env.API_BASE || "http://localhost:3015";

test('GET /api/tasks returns 200 with tasks array or 401 for guest', async (t) => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/tasks`);
  } catch (err: any) {
    t.skip(`Server at ${API_BASE} is unreachable: ${err.message}`);
    return;
  }

  if (response.status === 200) {
    const body = await response.json();
    assert.ok(body.tasks, 'Response should have a "tasks" property');
    assert.ok(Array.isArray(body.tasks), '"tasks" should be an array');
  } else if (response.status === 401) {
    // allowed for guest – test passes
  } else {
    assert.fail(`Unexpected status ${response.status}`);
  }
});
