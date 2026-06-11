import express from "express";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";

const runConductorMock = jest.fn();

jest.mock("../../src/agents/conductor", () => ({
  runConductor: runConductorMock,
}));

jest.mock("../../src/utils/db", () => ({
  withDbConnection: jest.fn(),
}));

import { withDbConnection } from "../../src/utils/db";

const mockWithDb = withDbConnection as jest.Mock;

function makeApp(router: typeof import("../../src/routes/api/tasks").default) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { userId: 7 };
    next();
  });
  app.use("/api/tasks", router);
  return app;
}

describe("tasks continuation route", () => {
  const originalWorkspaceRoot = process.env.WORKSPACE_ROOT;

  beforeEach(() => {
    runConductorMock.mockReset();
    mockWithDb.mockReset();
  });

  afterEach(async () => {
    if (originalWorkspaceRoot === undefined) {
      delete process.env.WORKSPACE_ROOT;
    } else {
      process.env.WORKSPACE_ROOT = originalWorkspaceRoot;
    }
  });

  it("loads prior task context, recent steps, and artifact hints before continuing", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "innomcp-task-"));
    try {
      await fs.mkdir(path.join(workspaceRoot, "artifacts"), { recursive: true });
      await fs.writeFile(
        path.join(workspaceRoot, "artifacts", "python-migration-notes.md"),
        "# Python migration notes\n\nartifact body",
        "utf-8"
      );
      process.env.WORKSPACE_ROOT = workspaceRoot;

      const queryMock = jest
        .fn()
        .mockResolvedValueOnce([
          [
            {
              title: "Python migration",
              intent: "Build a Python version of the service",
              final_answer: "Created a Python prototype and documented the migration plan.",
              status: "completed",
              created_at: "2026-05-24T10:00:00.000Z",
              completed_at: "2026-05-24T10:30:00.000Z",
            },
          ],
        ])
        .mockResolvedValueOnce([
          [
            {
              event_type: "tool_call_finished",
              public_summary: "Generated python migration notes artifact",
              agent_id: "tool-scout",
              tool_name: "workspace_write",
              ts: "2026-05-24T10:15:00.000Z",
            },
          ],
        ])
        .mockResolvedValue([{}]);

      mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

      runConductorMock.mockImplementation(async (_input, emit) => {
        emit({
          type: "agent_started",
          runId: "run-1",
          messageId: "msg-1",
          publicSummary: "critic is checking continuation context",
          agentId: "critic",
          isSafeForUser: true,
          timestamp: "2026-05-26T00:00:00.000Z",
        });
        emit({
          type: "fact_found",
          runId: "run-1",
          messageId: "msg-1",
          publicSummary: "artifact and prior final answer merged before synthesis",
          agentId: "conductor",
          isSafeForUser: true,
          timestamp: "2026-05-26T00:00:01.000Z",
        });
        emit({
          type: "final_answer",
          runId: "run-1",
          messageId: "msg-1",
          publicSummary: "done",
          finalText: "typescript upgrade ready",
          isSafeForUser: true,
          timestamp: "2026-05-26T00:00:00.000Z",
        });
      });

      const { default: tasksRouter } = await import("../../src/routes/api/tasks");
      const response = await request(makeApp(tasksRouter))
        .post("/api/tasks/task-1234/messages")
        .send({ message: "now make it a TypeScript version", sessionId: "   " });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(runConductorMock).toHaveBeenCalledTimes(1);

      const conductorInput = runConductorMock.mock.calls[0][0];
      expect(conductorInput.sessionId).toBe("task-1234");
      expect(conductorInput.message).toContain('[Continuing task "Python migration"]');
      expect(conductorInput.message).toContain("now make it a TypeScript version");
      expect(conductorInput.message).toContain("python-migration-notes.md");

      const historyText = (conductorInput.history as Array<{ text: string }>)
        .map((item) => item.text)
        .join("\n");
      expect(historyText).toContain("Original task request");
      expect(historyText).toContain("Previous final answer summary");
      expect(historyText).toContain("Generated python migration notes artifact");
      expect(historyText).toContain("python-migration-notes.md");

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tasks"),
        ["task-1234", 7]
      );
      expect(response.text).toContain('"type":"fact_found"');
      expect(response.text).toContain('"type":"final_answer"');

      const events = response.text
        .split(/\n\n+/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.startsWith("data: "))
        .map((chunk) => JSON.parse(chunk.slice("data: ".length)));
      const eventTypes = events.map((event) => event.type);
      const finalIndex = eventTypes.indexOf("final_answer");
      expect(finalIndex).toBeGreaterThan(-1);
      expect(eventTypes.slice(0, finalIndex)).toEqual(
        expect.arrayContaining(["fact_found", "agent_started"])
      );
      expect(eventTypes.slice(finalIndex + 1)).not.toContain("fact_found");
      expect(eventTypes.slice(finalIndex + 1)).not.toContain("agent_started");
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects archived tasks before opening an SSE stream", async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([
        [
          {
            title: "Archived task",
            intent: "old task",
            final_answer: "done",
            status: "archived",
            created_at: "2026-05-20T10:00:00.000Z",
            completed_at: "2026-05-20T10:30:00.000Z",
          },
        ],
      ])
      .mockResolvedValueOnce([[]]);

    mockWithDb.mockImplementation(async (fn: Function) => fn({ query: queryMock }));

    const { default: tasksRouter } = await import("../../src/routes/api/tasks");
    const response = await request(makeApp(tasksRouter))
      .post("/api/tasks/task-archived/messages")
      .send({ message: "continue this" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Task is archived" });
    expect(runConductorMock).not.toHaveBeenCalled();
  });
});
