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
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId: 42 };
    next();
  });
  app.use("/api/tasks", router);
  return app;
}

describe("tasks route ownership scoping", () => {
  beforeEach(() => {
    mockWithDb.mockReset();
  });

  it("scopes task detail fetches to the authenticated user", async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: tasksRouter } = await import("../../src/routes/api/tasks");
    const response = await request(makeApp(tasksRouter)).get("/api/tasks/task-404");

    expect(response.status).toBe(404);
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      "SELECT *, COALESCE(tags, '[]') as tags FROM tasks WHERE id = ? AND user_id = ? LIMIT 1",
      ["task-404", 42]
    );
  });

  it("scopes archive operations to the authenticated user", async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([[]]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: tasksRouter } = await import("../../src/routes/api/tasks");
    const response = await request(makeApp(tasksRouter)).post("/api/tasks/task-404/archive");

    expect(response.status).toBe(404);
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE id = ? AND user_id = ? AND status <> 'archived'"),
      ["task-404", 42]
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("WHERE id = ? AND user_id = ?"),
      ["task-404", 42]
    );
  });

  it("scopes task search to the authenticated user", async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[{ id: "task-1", title: "Scoped Task", intent: "Scoped Task", status: "completed", created_at: "2026-05-27T00:00:00.000Z", result_type: "task" }]]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: tasksRouter } = await import("../../src/routes/api/tasks");
    const response = await request(makeApp(tasksRouter)).get("/api/tasks/search?q=Scoped");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ?"),
      [42, "%Scoped%", "%Scoped%", 0, 10]
    );
  });
});
