import express from "express";
import request from "supertest";

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

jest.mock("../../src/middleware/cacheMiddleware", () => ({
  clearCache: jest.fn(),
}));

import { withDbConnection } from "../../src/utils/db";
import { generateAccessToken } from "../../src/utils/jwt";

const mockWithDb = withDbConnection as jest.Mock;

function makeApp(router: typeof import("../../src/routes/api/projects").default) {
  const app = express();
  app.use(express.json());
  app.use("/api/projects", router);
  return app;
}

describe("projects route authentication and scoping", () => {
  beforeEach(() => {
    mockWithDb.mockReset();
  });

  it("requires authentication for project routes", async () => {
    const { default: projectsRouter } = await import("../../src/routes/api/projects");
    const response = await request(makeApp(projectsRouter)).get("/api/projects");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required");
  });

  it("scopes project fetches to req.user.userId", async () => {
    const token = generateAccessToken({
      userId: 42,
      userEmail: "owner@example.com",
      userRoleId: 2,
      userDispName: "Owner",
    });
    const queryMock = jest.fn().mockResolvedValueOnce([
      [
        {
          id: "project-1",
          user_id: 42,
          name: "Scoped Project",
        },
      ],
    ]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: projectsRouter } = await import("../../src/routes/api/projects");
    const response = await request(makeApp(projectsRouter))
      .get("/api/projects/project-1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.project.name).toBe("Scoped Project");
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT * FROM projects WHERE id = ? AND user_id = ? AND archived_at IS NULL LIMIT 1",
      ["project-1", 42]
    );
  });

  it("returns 404 when updating a project outside the current user scope", async () => {
    const token = generateAccessToken({
      userId: 55,
      userEmail: "editor@example.com",
      userRoleId: 2,
      userDispName: "Editor",
    });
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: projectsRouter } = await import("../../src/routes/api/projects");
    const response = await request(makeApp(projectsRouter))
      .patch("/api/projects/project-2")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Project not found" });
    expect(queryMock).toHaveBeenCalledWith(
      "UPDATE projects SET name = ? WHERE id = ? AND user_id = ?",
      ["Renamed", "project-2", 55]
    );
  });
});
