import express from "express";
import request from "supertest";

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

import { withDbConnection } from "../../src/utils/db";
import { generateAccessToken } from "../../src/utils/jwt";

const mockWithDb = withDbConnection as jest.Mock;

function makeApp(router: typeof import("../../src/routes/api/memories").default) {
  const app = express();
  app.use(express.json());
  app.use("/api/memories", router);
  return app;
}

describe("memories route project access", () => {
  beforeEach(() => {
    mockWithDb.mockReset();
  });

  it("rejects project-scoped reads without a matching authenticated project owner", async () => {
    const { default: memoriesRouter } = await import("../../src/routes/api/memories");
    const response = await request(makeApp(memoriesRouter)).get(
      "/api/memories?scope=project&projectId=proj-1"
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Project access denied" });
  });

  it("allows project-scoped writes when the project belongs to the current user", async () => {
    const token = generateAccessToken({
      userId: 99,
      userEmail: "owner@example.com",
      userRoleId: 2,
      userDispName: "Owner",
    });

    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[{ id: "proj-1" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: memoriesRouter } = await import("../../src/routes/api/memories");
    const response = await request(makeApp(memoriesRouter))
      .post("/api/memories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        scope: "project",
        projectId: "proj-1",
        keyName: "phase7-goal",
        value: "Bind tasks to projects",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM projects WHERE id = ? AND user_id = ? AND archived_at IS NULL LIMIT 1",
      ["proj-1", 99]
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO memories"),
      ["project", "phase7-goal", "Bind tasks to projects", null, "proj-1", null]
    );
  });
});
