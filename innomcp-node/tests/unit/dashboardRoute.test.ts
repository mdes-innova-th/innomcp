import express from "express";
import request from "supertest";

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

jest.mock("../../src/utils/jwt", () => ({
  authenticateToken: (req: any, _res: any, next: Function) => {
    req.user = { userId: 7 };
    next();
  },
}));

import { withDbConnection } from "../../src/utils/db";

const mockWithDb = withDbConnection as jest.Mock;

function makeApp(router: typeof import("../../src/routes/api/dashboard").default) {
  const app = express();
  app.use("/api/dashboard", router);
  return app;
}

describe("dashboard route project scoping", () => {
  beforeEach(() => {
    mockWithDb.mockReset();
  });

  it("filters summary queries by projectId when provided", async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ status: "completed", count: 3 }]])
      .mockResolvedValueOnce([[{ total: 3 }]])
      .mockResolvedValueOnce([[{ id: "task-1", title: "Scoped Task", intent: "general", status: "completed", elapsed_ms: 1200, created_at: "2026-05-27T00:00:00.000Z", project_id: "proj-1" }]])
      .mockResolvedValueOnce([[{ avg_rating: 4.5, total: 2 }]])
      .mockResolvedValueOnce([[{ count: 1 }]]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: dashboardRouter } = await import("../../src/routes/api/dashboard");
    const response = await request(makeApp(dashboardRouter)).get("/api/dashboard?projectId=proj-1");

    expect(response.status).toBe(200);
    expect(response.body.stats.totalTasks).toBe(3);
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT status, COUNT(*) as count FROM tasks WHERE (? = '' OR project_id = ?) AND status <> 'archived' AND user_id = ? GROUP BY status",
      ["proj-1", "proj-1", 7]
    );
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT COUNT(*) as total FROM tasks WHERE (? = '' OR project_id = ?) AND status <> 'archived' AND user_id = ?",
      ["proj-1", "proj-1", 7]
    );
  });
});
