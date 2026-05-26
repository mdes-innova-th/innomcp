const express = require("express");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");
require("ts-node/register/transpile-only");

function makeApp(router: any) {
  const app = express();
  app.use(express.json());
  app.use("/api/files", router);
  return app;
}

describe("files pinned artifacts routes", () => {
  const originalWorkspaceRoot = process.env.WORKSPACE_ROOT;

  afterEach(async () => {
    jest.resetModules();
    if (originalWorkspaceRoot === undefined) {
      delete process.env.WORKSPACE_ROOT;
    } else {
      process.env.WORKSPACE_ROOT = originalWorkspaceRoot;
    }
  });

  it("pins a workspace artifact and returns it from pinned listings", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "innomcp-files-"));
    try {
      const artifactPath = path.join(workspaceRoot, "artifacts", "task-1234", "summary.md");
      await fs.mkdir(path.dirname(artifactPath), { recursive: true });
      await fs.writeFile(artifactPath, "# Summary\n", "utf-8");

      process.env.WORKSPACE_ROOT = workspaceRoot;
      const filesRouter = require("../../src/routes/api/files").default;
      const app = makeApp(filesRouter);

      const pinResponse = await request(app)
        .patch("/api/files/YXJ0aWZhY3RzL3Rhc2stMTIzNC9zdW1tYXJ5Lm1k/pin")
        .send({ pinned: true, path: "artifacts/task-1234/summary.md" });

      expect(pinResponse.status).toBe(200);
      expect(pinResponse.body).toMatchObject({
        id: "YXJ0aWZhY3RzL3Rhc2stMTIzNC9zdW1tYXJ5Lm1k",
        path: "artifacts/task-1234/summary.md",
        pinned: true,
      });

      const listResponse = await request(app).get("/api/files?pinned=true&limit=6");

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.files).toEqual([
        expect.objectContaining({
          id: "YXJ0aWZhY3RzL3Rhc2stMTIzNC9zdW1tYXJ5Lm1k",
          name: "summary.md",
          path: "artifacts/task-1234/summary.md",
          type: "markdown",
          taskId: "task-1234",
        }),
      ]);
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
