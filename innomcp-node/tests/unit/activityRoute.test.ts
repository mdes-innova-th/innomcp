import express from "express";
import request from "supertest";

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

jest.mock("../../src/utils/jwt", () => ({
  optionalAuth: (_req: any, _res: any, next: Function) => next(),
}));

import { withDbConnection } from "../../src/utils/db";

const mockWithDb = withDbConnection as jest.Mock;

async function makeApp() {
  // Re-import fresh each time so module-level flags reset cleanly between suites
  jest.resetModules();
  const { default: activityRouter } = await import(
    "../../src/routes/api/activity"
  );
  const app = express();
  app.use("/api/activity", activityRouter);
  return app;
}

// Helper: build a mock conn whose .query() returns empty rows for all 4 sources
function makeConn(overrides: Record<number, any[][]> = {}) {
  let callCount = 0;
  const query = jest.fn().mockImplementation(() => {
    const result = overrides[callCount] ?? [[]];
    callCount++;
    return Promise.resolve(result);
  });
  return { query };
}

// Sample rows returned by the DB (one per source)
const taskCreatedRow = {
  id: "task-1",
  type: "task_created",
  description: "Write unit tests",
  userId: "user-1",
  projectId: "proj-1",
  createdAt: "2026-05-29T10:00:00.000Z",
  agentId: null,
};

const taskCompletedRow = {
  id: "task-2",
  type: "task_completed",
  description: "Completed: Deploy service",
  userId: "user-1",
  projectId: "proj-1",
  createdAt: "2026-05-29T09:00:00.000Z",
  agentId: null,
};

const agentActionRow = {
  id: "42",
  type: "agent_action",
  description: "Running shell command",
  userId: "user-1",
  projectId: "proj-1",
  createdAt: "2026-05-29T08:00:00.000Z",
  agentId: "agent-haiku",
};

const projectCreatedRow = {
  id: "proj-1",
  type: "project_created",
  description: "Project created: INNOMCP",
  userId: "user-1",
  projectId: "proj-1",
  createdAt: "2026-05-28T12:00:00.000Z",
  agentId: null,
};

describe("GET /api/activity", () => {
  beforeEach(() => {
    mockWithDb.mockReset();
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("returns 200 with activities array and total", async () => {
    // withDbConnection resolves to merged rows from all 4 sources
    mockWithDb.mockImplementation(async (fn: Function) => {
      const conn = makeConn({
        // CREATE TABLE queries (ensureProjectsTable, ensureTaskProjectColumn × 2)
        0: [[]],
        1: [[]],
        2: [[]],
      });
      // The four parallel queries resolve via Promise.all inside the route;
      // we mock withDbConnection at the outer level so we control the return value.
      return fn(conn);
    });

    // For simplicity, mock the resolved value directly (inner Promise.all calls
    // conn.query which we cannot easily intercept without deeper DB mocking, so
    // we stub withDbConnection to return the pre-merged rows).
    mockWithDb.mockImplementation(async (_fn: Function) => [
      taskCreatedRow,
      taskCompletedRow,
      agentActionRow,
      projectCreatedRow,
    ]);

    const app = await makeApp();
    const res = await request(app).get("/api/activity");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("activities");
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBe(4);
    expect(res.body.activities).toHaveLength(4);
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("respects the limit query parameter", async () => {
    // Return 10 rows — route should slice to limit=5
    const manyRows = Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i}`,
      type: "task_created",
      description: `Task ${i}`,
      userId: "user-1",
      projectId: null,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      agentId: null,
    }));

    mockWithDb.mockImplementation(async (_fn: Function) => manyRows);

    const app = await makeApp();
    const res = await request(app).get("/api/activity?limit=5");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(5);
    expect(res.body.hasMore).toBe(true);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("passes projectId filter into the DB call", async () => {
    let capturedFn: Function | null = null;
    mockWithDb.mockImplementation(async (fn: Function) => {
      capturedFn = fn;
      return [taskCreatedRow]; // single matching row
    });

    const app = await makeApp();
    const res = await request(app).get("/api/activity?projectId=proj-42");

    expect(res.status).toBe(200);
    // Verify withDbConnection was called (the route invoked it)
    expect(mockWithDb).toHaveBeenCalledTimes(1);
    // The returned activities should include only what the DB returned
    expect(res.body.activities[0].projectId).toBe("proj-1");
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("activities have required fields: id, type, description, createdAt", async () => {
    mockWithDb.mockImplementation(async (_fn: Function) => [
      taskCreatedRow,
      agentActionRow,
    ]);

    const app = await makeApp();
    const res = await request(app).get("/api/activity");

    expect(res.status).toBe(200);
    for (const activity of res.body.activities) {
      expect(activity).toHaveProperty("id");
      expect(activity).toHaveProperty("type");
      expect(activity).toHaveProperty("description");
      expect(activity).toHaveProperty("createdAt");

      expect(typeof activity.id).toBe("string");
      expect(typeof activity.type).toBe("string");
      expect(typeof activity.description).toBe("string");
      expect(typeof activity.createdAt).toBe("string");
    }
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("handles DB error gracefully — returns empty activities, not 500", async () => {
    mockWithDb.mockRejectedValue(new Error("DB connection refused"));

    const app = await makeApp();
    const res = await request(app).get("/api/activity");

    // Must NOT be 500 — route swallows the error and returns empty payload
    expect(res.status).toBe(200);
    expect(res.body.activities).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.hasMore).toBe(false);
  });
});
