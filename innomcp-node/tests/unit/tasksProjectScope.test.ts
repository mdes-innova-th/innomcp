import express from "express";
import request from "supertest";

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

jest.mock("../../src/services/webhookService", () => ({
  fireWebhook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/middleware/cacheMiddleware", () => ({
  clearCache: jest.fn(),
}));

jest.mock("../../src/agents/parallelDispatch", () => ({
  compressHistory: jest.fn(() => "summary"),
}));

import { withDbConnection } from "../../src/utils/db";

const mockWithDb = withDbConnection as jest.Mock;

function makeApp(router: typeof import("../../src/routes/api/tasks").default) {
  const app = express();
  app.use((req: any, _res, next) => {
    req.user = { id: 7 };
    next();
  });
  app.use("/api/tasks", router);
  return app;
}

describe("tasks route project scoping", () => {
  beforeEach(() => {
    mockWithDb.mockReset();
  });

  it("filters recent tasks by projectId", async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ id: "task-1", title: "Scoped Task", intent: "general", status: "completed", elapsed_ms: 1000, created_at: "2026-05-27T00:00:00.000Z", completed_at: null, project_id: "proj-1" }]]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: tasksRouter } = await import("../../src/routes/api/tasks");
    const response = await request(makeApp(tasksRouter)).get("/api/tasks?projectId=proj-1&limit=5");

    expect(response.status).toBe(200);
    expect(response.body.tasks).toHaveLength(1);
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("AND (? = '' OR project_id = ?)"),
      [7, "proj-1", "proj-1", 0, 5, 0]
    );
  });
});
