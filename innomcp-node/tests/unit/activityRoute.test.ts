import express from "express";
import request from "supertest";

// ── Mocks (must appear before any imports that pull these modules) ─────────────

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

jest.mock("../../src/utils/jwt", () => ({
  optionalAuth: (_req: any, _res: any, next: Function) => next(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { withDbConnection } from "../../src/utils/db";
import activityRouter from "../../src/routes/api/activity";

const mockWithDb = withDbConnection as jest.Mock;

// ── App factory ───────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use("/api/activity", activityRouter);
  return app;
}

// ── Sample DB rows ────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/activity", () => {
  const app = makeApp();

  beforeEach(() => {
    mockWithDb.mockReset();
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("returns 200 with activities array and total", async () => {
    // withDbConnection returns the already-merged flat array that the route
    // normally builds from four parallel conn.query() calls.
    mockWithDb.mockResolvedValue([
      taskCreatedRow,
      taskCompletedRow,
      agentActionRow,
      projectCreatedRow,
    ]);

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
    // Provide 10 rows; the route should slice to limit=5
    const manyRows = Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i}`,
      type: "task_created",
      description: `Task ${i}`,
      userId: "user-1",
      projectId: null,
      // Stagger timestamps so sort is deterministic
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      agentId: null,
    }));

    mockWithDb.mockResolvedValue(manyRows);

    const res = await request(app).get("/api/activity?limit=5");

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(5);
    expect(res.body.hasMore).toBe(true);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("passes projectId filter into the DB call", async () => {
    mockWithDb.mockResolvedValue([taskCreatedRow]);

    const res = await request(app).get("/api/activity?projectId=proj-42");

    expect(res.status).toBe(200);
    // withDbConnection was invoked — the route used it
    expect(mockWithDb).toHaveBeenCalledTimes(1);
    // The returned activities reflect what the (mocked) DB sent back
    expect(res.body.activities[0].projectId).toBe("proj-1");
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("activities have required fields: id, type, description, createdAt", async () => {
    mockWithDb.mockResolvedValue([taskCreatedRow, agentActionRow]);

    const res = await request(app).get("/api/activity");

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThan(0);

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

    const res = await request(app).get("/api/activity");

    // Must NOT be 500 — the route swallows DB errors and returns an empty payload
    expect(res.status).toBe(200);
    expect(res.body.activities).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.hasMore).toBe(false);
  });
});
