/**
 * /api/tasks — Task persistence CRUD for Manus-style task history.
 * Tasks are created when a chat stream starts, updated on completion/failure.
 */

import { Router, Request, Response } from "express";
import * as path from "node:path";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { withDbConnection } from "../../utils/db";
import { fireWebhook } from "../../services/webhookService";
import { clearCache } from "../../middleware/cacheMiddleware";
import { compressHistory } from "../../agents/parallelDispatch";

const router = Router();
let tasksProjectColumnEnsured = false;

async function ensureTasksProjectColumn(): Promise<void> {
  if (tasksProjectColumnEnsured) return;
  await withDbConnection(async (conn) => {
    try {
      await conn.query("ALTER TABLE tasks ADD COLUMN project_id VARCHAR(36) NULL");
    } catch {}
    try {
      await conn.query("CREATE INDEX idx_tasks_project_created ON tasks (project_id, created_at DESC)");
    } catch {}
  });
  tasksProjectColumnEnsured = true;
}

const CONTINUATION_STEP_LIMIT = 12;
const CONTINUATION_ARTIFACT_LIMIT = 6;

type ContinuationTaskRow = {
  title: string;
  intent: string | null;
  final_answer: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
};

type ContinuationStepRow = {
  event_type: string;
  public_summary: string | null;
  agent_id: string | null;
  tool_name: string | null;
  ts: string | null;
};

type ContinuationArtifact = {
  name: string;
  path: string;
};

function resolveTaskUserId(req: Request): string | number | null {
  const authUser = (req as any).user;
  if (authUser?.userId != null) return authUser.userId;
  if (authUser?.id != null) return authUser.id;
  return null;
}

function buildTaskOwnership(userId: string | number | null): {
  clause: string;
  params: Array<string | number>;
} {
  if (userId == null) {
    return { clause: "", params: [] };
  }
  return {
    clause: " AND user_id = ?",
    params: [userId],
  };
}

function resolveWorkspaceRoot(): string {
  return process.env.WORKSPACE_ROOT
    ? path.resolve(process.env.WORKSPACE_ROOT)
    : path.resolve(process.cwd(), "../workspace");
}

function truncateInline(text: string, max = 240): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeSearchTokens(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[^a-z0-9ก-๙]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
    )
  ).slice(0, 8);
}

function formatContinuationStep(step: ContinuationStepRow): string {
  const labels = [step.event_type];
  if (step.agent_id) labels.push(`agent ${step.agent_id}`);
  if (step.tool_name) labels.push(`tool ${step.tool_name}`);
  const summary = truncateInline(step.public_summary ?? "", 180) || "No summary recorded";
  return `- ${labels.join(" / ")}: ${summary}`;
}

async function loadRelevantArtifacts(
  taskId: string,
  taskTitle: string,
  createdAt: string | null,
  completedAt: string | null,
  limit = CONTINUATION_ARTIFACT_LIMIT
): Promise<ContinuationArtifact[]> {
  const workspaceRoot = resolveWorkspaceRoot();
  const artifactsDir = path.join(workspaceRoot, "artifacts");
  const titleTokens = normalizeSearchTokens(taskTitle);
  const taskPrefix = taskId.slice(0, 8).toLowerCase();
  const createdAtMs = createdAt ? Date.parse(createdAt) : Number.NaN;
  const completedAtMs = completedAt ? Date.parse(completedAt) : Number.NaN;

  try {
    const allFiles = await fsp.readdir(artifactsDir, { recursive: true } as any);
    const ranked: Array<ContinuationArtifact & { score: number; mtimeMs: number }> = [];

    for (const relative of allFiles as string[]) {
      const full = path.join(artifactsDir, relative);
      let stat;
      try {
        stat = await fsp.stat(full);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;

      const relativePath = path.relative(workspaceRoot, full).replace(/\\/g, "/");
      const lowerName = path.basename(relative).toLowerCase();
      let score = 0;

      if (lowerName.includes(taskPrefix)) score += 5;
      if (titleTokens.some((token) => lowerName.includes(token))) score += 3;
      if (!Number.isNaN(createdAtMs) && stat.mtimeMs >= createdAtMs - 30 * 60_000) score += 1;
      if (!Number.isNaN(completedAtMs) && stat.mtimeMs <= completedAtMs + 12 * 60 * 60_000) score += 1;

      ranked.push({
        name: path.basename(relative),
        path: relativePath,
        score,
        mtimeMs: stat.mtimeMs,
      });
    }

    const relevant = ranked
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs)
      .slice(0, limit);

    if (relevant.length > 0) {
      return relevant.map(({ name, path: relPath }) => ({ name, path: relPath }));
    }

    return ranked
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, Math.min(limit, 3))
      .map(({ name, path: relPath }) => ({ name, path: relPath }));
  } catch {
    return [];
  }
}

function buildContinuationHistory(
  task: ContinuationTaskRow,
  steps: ContinuationStepRow[],
  artifacts: ContinuationArtifact[]
): Array<{ sender: "user" | "ai"; text: string }> {
  const history: Array<{ sender: "user" | "ai"; text: string }> = [];

  if (task.intent?.trim()) {
    history.push({
      sender: "user",
      text: `Original task request: ${truncateInline(task.intent, 700)}`,
    });
  }

  if (task.final_answer?.trim()) {
    history.push({
      sender: "ai",
      text: `Previous final answer summary: ${truncateInline(task.final_answer, 900)}`,
    });
  }

  if (steps.length > 0) {
    history.push({
      sender: "ai",
      text: `Recent execution timeline:\n${steps.map(formatContinuationStep).join("\n")}`,
    });
  }

  if (artifacts.length > 0) {
    history.push({
      sender: "ai",
      text: `Available artifacts in workspace:\n${artifacts
        .map((artifact) => `- ${artifact.name} (${artifact.path})`)
        .join("\n")}`,
    });
  }

  if (history.length <= 4) return history;

  return [
    {
      sender: "ai",
      text: `Earlier context summary:\n${compressHistory(history, 3)}`,
    },
    ...history.slice(-3),
  ];
}

// ── List recent tasks (authenticated user or guest by session) ────────────────
router.get("/", async (req: Request, res: Response) => {
  const userId = resolveTaskUserId(req);
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const includeArchived = String(req.query.includeArchived || "").toLowerCase() === "true";
  const projectId = String(req.query.projectId || req.query.project_id || "").trim();

  try {
    if (projectId) {
      await ensureTasksProjectColumn();
    }
    const rows = await withDbConnection(async (conn) => {
      if (userId) {
        const [r] = await conn.query(
          `SELECT id, title, intent, status, elapsed_ms, created_at, completed_at, project_id
           FROM tasks
           WHERE user_id = ?
             AND (? = '' OR project_id = ?)
             AND (? = 1 OR status <> 'archived')
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, projectId, projectId, includeArchived ? 1 : 0, limit, offset]
        );
        return r;
      }
      // Guest: no persistent tasks — return empty
      return [];
    });
    const hasMore = (rows as any[]).length === limit;
    res.json({ tasks: rows, hasMore, offset, limit });
  } catch (err) {
    console.error("[tasks] list error", err);
    res.json({ tasks: [], hasMore: false, offset, limit });
  }
});

// ── Full-text search across tasks ────────────────────────────────────────────
router.get("/search", async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) return res.json({ results: [] });
  const userId = resolveTaskUserId(req);
  if (userId == null) return res.json({ results: [], query: q, total: 0 });

  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const type = String(req.query.type || "all");
  const includeArchived = String(req.query.includeArchived || "").toLowerCase() === "true";

  try {
    const results = await withDbConnection(async (conn) => {
      const items: any[] = [];

      // Search tasks by title + intent
      if (type === "tasks" || type === "all") {
        const [rows] = await conn.query(
          `SELECT id, title, intent, status, created_at, 'task' as result_type
           FROM tasks
           WHERE user_id = ?
             AND (title LIKE ? OR intent LIKE ?)
             AND (? = 1 OR status <> 'archived')
           ORDER BY created_at DESC LIMIT ?`,
          [userId, `%${q}%`, `%${q}%`, includeArchived ? 1 : 0, limit]
        ) as any[];
        items.push(...(rows as any[] || []));
      }

      return items;
    });

    res.json({ results, query: q, total: results.length });
  } catch (err) {
    console.error("[tasks] search error", err);
    res.json({ results: [], query: q, total: 0 });
  }
});

// ── Get single task with steps ────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownership = buildTaskOwnership(resolveTaskUserId(req));
  try {
    const [task, steps] = await withDbConnection(async (conn) => {
      const [taskRows] = await conn.query(
        `SELECT *, COALESCE(tags, '[]') as tags FROM tasks WHERE id = ?${ownership.clause} LIMIT 1`,
        [id, ...ownership.params]
      );
      const [stepRows] = await conn.query(
        `SELECT event_type, public_summary, agent_id, tool_name, ts FROM task_steps WHERE task_id = ? ORDER BY id ASC`,
        [id]
      );
      return [taskRows, stepRows];
    });
    const taskArr = task as any[];
    if (taskArr.length === 0) {
      return res.status(404).json({ error: "task not found" });
    }
    res.json({ task: taskArr[0], steps });
  } catch (err) {
    console.error("[tasks] get error", err);
    res.status(500).json({ error: "internal" });
  }
});

// ── Update task tags ──────────────────────────────────────────────────────────
router.patch("/:id/tags", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tags } = req.body as { tags: string[] };
  const ownership = buildTaskOwnership(resolveTaskUserId(req));
  if (!Array.isArray(tags)) return res.status(400).json({ error: "tags must be array" });

  try {
    const updated = await withDbConnection(async (conn) => {
      const [existsRows] = await conn.query(
        `SELECT id FROM tasks WHERE id = ?${ownership.clause} LIMIT 1`,
        [id, ...ownership.params]
      ) as any[];
      if (!(existsRows as any[])?.length) return 0;

      const [result] = await conn.query(
        `UPDATE tasks SET tags = ? WHERE id = ?${ownership.clause}`,
        [JSON.stringify(tags), id, ...ownership.params]
      ) as any[];
      return Number(result?.affectedRows ?? 0);
    });
    if (updated === 0) {
      return res.status(404).json({ error: "task not found" });
    }
    res.json({ id, tags });
  } catch (err: any) {
    // tags column might not exist yet — return graceful response
    res.json({ id, tags, note: "tags column not yet migrated" });
  }
});

// ── Export task artifacts as ZIP ─────────────────────────────────────────────
router.get("/:id/export", async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownership = buildTaskOwnership(resolveTaskUserId(req));
  const WORKSPACE_ROOT = resolveWorkspaceRoot();

  try {
    const [rows] = await withDbConnection(async (conn) =>
      conn.query(
        `SELECT title, final_answer FROM tasks WHERE id = ?${ownership.clause}`,
        [id, ...ownership.params]
      )
    ) as any[];
    if (!rows[0]) return res.status(404).json({ error: "Task not found" });
    const task = rows[0];

    const artifactsDir = path.join(WORKSPACE_ROOT, "artifacts");
    let files: string[] = [];
    try {
      const allFiles = await fsp.readdir(artifactsDir, { recursive: true } as any);
      for (const f of allFiles as string[]) {
        const full = path.join(artifactsDir, f);
        try {
          const stat = await fsp.stat(full);
          if (stat.isFile()) files.push(full);
        } catch {}
      }
      const cutoff = Date.now() - 3_600_000;
      files = files.filter(f => f.includes(id.slice(0, 8)) || fs.statSync(f).mtimeMs > cutoff);
    } catch { files = []; }

    const safeName = (task.title as string).replace(/[^a-zA-Z0-9ก-๙\s]/g, "_").slice(0, 40).trim() || "task";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-${id.slice(0, 8)}.zip"`);

    const { PassThrough } = require("stream");
    const pt = new PassThrough();
    pt.pipe(res);

    const centralDirs: Buffer[] = [];
    let offset = 0;

    const filesToAdd: Array<{ name: string; data: Buffer }> = [];
    if (task.final_answer) {
      filesToAdd.push({ name: "final-answer.md", data: Buffer.from(`# ${task.title}\n\n${task.final_answer}`, "utf-8") });
    }
    for (const f of files.slice(0, 20)) {
      try {
        const data = await fsp.readFile(f);
        filesToAdd.push({ name: path.basename(f), data });
      } catch {}
    }
    if (filesToAdd.length === 0) {
      filesToAdd.push({ name: "README.txt", data: Buffer.from(`Task: ${task.title}\nID: ${id}\nNo artifacts found.`) });
    }

    function simpleCRC32(buf: Buffer): number {
      let crc = 0xFFFFFFFF;
      const table = new Uint32Array(256).map((_, i) => {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        return c;
      });
      for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function writeZipEntry(name: string, data: Buffer): Buffer {
      const nameB = Buffer.from(name, "utf-8");
      const crc = simpleCRC32(data);
      const local = Buffer.alloc(30 + nameB.length);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
      local.writeUInt16LE(0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
      local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameB.length, 26); local.writeUInt16LE(0, 28);
      nameB.copy(local, 30);
      const cd = Buffer.alloc(46 + nameB.length);
      cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
      cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
      cd.writeUInt16LE(nameB.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
      cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
      nameB.copy(cd, 46);
      centralDirs.push(cd);
      offset += local.length + data.length;
      return Buffer.concat([local, data]);
    }

    for (const { name, data } of filesToAdd) { pt.write(writeZipEntry(name, data)); }
    const cdBuf = Buffer.concat(centralDirs);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(filesToAdd.length, 8); eocd.writeUInt16LE(filesToAdd.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
    pt.write(cdBuf); pt.end(eocd);
  } catch (err: any) { if (!res.headersSent) res.status(500).json({ error: err?.message }); }
});

// ── Continue a task with a follow-up message (SSE stream) ────────────────────
router.post("/:id/messages", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message, sessionId } = req.body as { message: string; sessionId?: string };
  const ownership = buildTaskOwnership(resolveTaskUserId(req));
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  let continuationMessage = message.trim();
  let continuationHistory: Array<{ sender: "user" | "ai"; text: string }> = [];
  let resumedSummary = "";
  try {
    const { task, steps } = await withDbConnection(async (conn) => {
      const [taskRows] = await conn.query(
        `SELECT title, intent, final_answer, status, created_at, completed_at
         FROM tasks WHERE id = ?${ownership.clause} LIMIT 1`,
        [id, ...ownership.params]
      );
      const taskRow = (taskRows as ContinuationTaskRow[])[0];
      if (!taskRow) return { task: null, steps: [] as ContinuationStepRow[] };

      const [stepRows] = await conn.query(
        `SELECT event_type, public_summary, agent_id, tool_name, ts
         FROM task_steps WHERE task_id = ? ORDER BY id DESC LIMIT ?`,
        [id, CONTINUATION_STEP_LIMIT]
      );
      const recentSteps = (stepRows as ContinuationStepRow[]).slice().reverse();

      if (taskRow.status === "archived") {
        return { task: taskRow, steps: recentSteps };
      }

      if (taskRow.status !== "running") {
        await conn.query(
          `UPDATE tasks
           SET status = 'running', completed_at = NULL
           WHERE id = ?${ownership.clause}`,
          [id, ...ownership.params]
        );
      }

      return { task: taskRow, steps: recentSteps };
    }) as { task: ContinuationTaskRow | null; steps: ContinuationStepRow[] };

    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.status === "archived") {
      return res.status(409).json({ error: "Task is archived" });
    }

    const artifacts = await loadRelevantArtifacts(
      id,
      task.title,
      task.created_at,
      task.completed_at
    );
    continuationHistory = buildContinuationHistory(task, steps, artifacts);
    const artifactHint =
      artifacts.length > 0
        ? `[Prefer reusing artifacts: ${artifacts.map((artifact) => artifact.name).join(", ")}]\n`
        : "";
    continuationMessage = `[Continuing task "${task.title}"]\n${artifactHint}${message.trim()}`;
    resumedSummary = `Resuming "${task.title}" with ${steps.length} recent steps and ${artifacts.length} related artifacts`;
  } catch {
    // Best effort: continue even when context loading fails.
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const emit = (ev: import("../../agents/events").AgentEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  try {
    if (resumedSummary) {
      const { newEnvelope } = await import("../../agents/events");
      emit(
        newEnvelope({
          type: "fact_found",
          runId: id,
          messageId: id,
          publicSummary: resumedSummary,
          agentId: "conductor",
        })
      );
      void appendTaskStep({
        taskId: id,
        eventType: "task_resumed",
        publicSummary: resumedSummary,
        agentId: "conductor",
      });
    }

    const { runConductor } = await import("../../agents/conductor");
    await runConductor(
      {
        message: continuationMessage,
        history: continuationHistory,
        sessionId: sessionId ?? id,
      },
      emit
    );
  } catch (err: any) {
    const { newEnvelope } = await import("../../agents/events");
    const errEv = newEnvelope({ type: "error", runId: id, messageId: id, publicSummary: err?.message ?? "Continuation failed" });
    emit(errEv);
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// ── Archive a task without deleting its history or artifacts ──────────────────
router.post("/:id/archive", async (req: Request, res: Response) => {
  const { id } = req.params;
  const ownership = buildTaskOwnership(resolveTaskUserId(req));

  try {
    const rows = await withDbConnection(async (conn) => {
      const [result] = await conn.query(
        `UPDATE tasks
         SET status = 'archived', completed_at = COALESCE(completed_at, NOW())
         WHERE id = ?${ownership.clause} AND status <> 'archived'`,
        [id, ...ownership.params]
      ) as any[];

      const [taskRows] = await conn.query(
        `SELECT id, status, completed_at
         FROM tasks
         WHERE id = ?${ownership.clause}
         LIMIT 1`,
        [id, ...ownership.params]
      ) as any[];

      return {
        updated: Number(result?.affectedRows ?? 0),
        task: (taskRows as any[])[0] ?? null,
      };
    }) as { updated: number; task: { id: string; status: string; completed_at: string | null } | null };

    if (!rows.task) {
      return res.status(404).json({ error: "Task not found" });
    }

    clearCache("/api/dashboard");
    clearCache("/api/stats");
    return res.json({
      success: true,
      archived: rows.task.status === "archived",
      alreadyArchived: rows.updated === 0,
      task: rows.task,
    });
  } catch (err) {
    console.error("[tasks] archive error", err);
    return res.status(500).json({ error: "Could not archive task" });
  }
});

// ── Internal: create task when stream starts ──────────────────────────────────
export async function createTask(params: {
  id: string;
  runId: string;
  userId: number | null;
  title: string;
  intent: string;
  projectId?: string | null;
}): Promise<void> {
  try {
    if (params.projectId) {
      await ensureTasksProjectColumn();
    }
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT IGNORE INTO tasks (id, run_id, user_id, project_id, title, intent, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'running', NOW())`,
        [params.id, params.runId, params.userId, params.projectId ?? null, params.title.slice(0, 254), params.intent]
      );
    });
    clearCache("/api/dashboard");
    clearCache("/api/stats");
  } catch (err) {
    console.error("[tasks] createTask error", err);
  }
}

// ── Internal: update task on completion or failure ────────────────────────────
export async function completeTask(params: {
  id: string;
  status: "completed" | "failed";
  elapsedMs?: number;
  finalAnswer?: string;
  title?: string;
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `UPDATE tasks SET status = ?, elapsed_ms = ?, final_answer = ?, completed_at = NOW()
         WHERE id = ?`,
        [params.status, params.elapsedMs ?? null, (params.finalAnswer ?? "").slice(0, 2000), params.id]
      );
    });
    clearCache("/api/dashboard");
    clearCache("/api/stats");
  } catch (err) {
    console.error("[tasks] completeTask error", err);
  }

  // Fire webhook for task.completed or task.failed (fire-and-forget)
  const webhookEvent = params.status === "completed" ? "task.completed" : "task.failed";
  fireWebhook(webhookEvent, {
    taskId: params.id,
    title: params.title ?? "",
    elapsedMs: params.elapsedMs ?? null,
  }).catch(() => {/* non-critical */});
}

// ── Internal: append a step ───────────────────────────────────────────────────
export async function appendTaskStep(params: {
  taskId: string;
  eventType: string;
  publicSummary: string;
  agentId?: string;
  toolName?: string;
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO task_steps (task_id, event_type, public_summary, agent_id, tool_name, ts)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [params.taskId, params.eventType, params.publicSummary.slice(0, 500), params.agentId ?? null, params.toolName ?? null]
      );
    });
  } catch (err) {
    // non-critical — don't spam logs
  }
}

export default router;
