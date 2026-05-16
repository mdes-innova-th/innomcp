/**
 * /api/orchestrate — Phase C Multi-Agent Orchestrator HTTP API
 *
 * Exposes the MultiAgentOrchestrator (Brain-1 + Brain-2 + Coordinator)
 * as RESTful endpoints. The orchestrator is a singleton per process.
 */

import { Router, Request, Response } from "express";
import { MultiAgentOrchestrator } from "../../agents/orchestrator";

const orchestratorRouter = Router();

// Singleton orchestrator per process
const orchestrator = new MultiAgentOrchestrator({
  sharedMemoryPath: process.env.ORCHESTRATOR_MEMORY_PATH ?? ".claude/memory",
  enableTmuxSync: process.env.ORCHESTRATOR_TMUX_SYNC === "true",
  enableRemoteSync: process.env.ORCHESTRATOR_REMOTE_SYNC === "true",
});

/**
 * POST /api/orchestrate/tasks
 * Create a new orchestration task and begin the Brain-1 → Brain-2 → Coordinator cycle.
 * Body: { description: string, priority?: "low"|"medium"|"high"|"urgent" }
 */
orchestratorRouter.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { description, priority = "medium" } = req.body as {
      description?: string;
      priority?: "low" | "medium" | "high" | "urgent";
    };

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ error: "description is required" });
    }

    const task = await orchestrator.createTask(description.trim(), priority);
    // Begin execution async (do not block HTTP response)
    orchestrator.executeCycle(task.id).catch((err) => {
      console.error(`[orchestrator] task ${task.id} cycle failed:`, err);
    });

    return res.status(202).json({ taskId: task.id, status: task.status });
  } catch (err) {
    console.error("[orchestrator] POST /tasks error:", err);
    return res.status(500).json({ error: "Internal orchestrator error" });
  }
});

/**
 * GET /api/orchestrate/tasks/:taskId
 * Poll the current status and result of a task.
 */
orchestratorRouter.get("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const task = orchestrator.getTask(req.params.taskId as string);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    return res.json(task);
  } catch (err) {
    console.error("[orchestrator] GET /tasks/:id error:", err);
    return res.status(500).json({ error: "Internal orchestrator error" });
  }
});

/**
 * GET /api/orchestrate/tasks
 * List all tracked tasks (active + completed).
 */
orchestratorRouter.get("/tasks", async (_req: Request, res: Response) => {
  try {
    return res.json({ tasks: orchestrator.listTasks() });
  } catch (err) {
    return res.status(500).json({ error: "Internal orchestrator error" });
  }
});

export default orchestratorRouter;
