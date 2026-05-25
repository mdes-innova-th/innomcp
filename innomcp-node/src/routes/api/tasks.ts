/**
 * /api/tasks — Task persistence CRUD for Manus-style task history.
 * Tasks are created when a chat stream starts, updated on completion/failure.
 */

import { Router, Request, Response } from "express";
import * as path from "node:path";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { withDbConnection } from "../../utils/db";

const router = Router();

// ── List recent tasks (authenticated user or guest by session) ────────────────
router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id ?? null;
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  try {
    const rows = await withDbConnection(async (conn) => {
      if (userId) {
        const [r] = await conn.query(
          `SELECT id, title, intent, status, elapsed_ms, created_at, completed_at
           FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
          [userId, limit]
        );
        return r;
      }
      // Guest: no persistent tasks — return empty
      return [];
    });
    res.json({ tasks: rows });
  } catch (err) {
    console.error("[tasks] list error", err);
    res.json({ tasks: [] });
  }
});

// ── Get single task with steps ────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [task, steps] = await withDbConnection(async (conn) => {
      const [taskRows] = await conn.query(
        `SELECT * FROM tasks WHERE id = ? LIMIT 1`,
        [id]
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

// ── Export task artifacts as ZIP ─────────────────────────────────────────────
router.get("/:id/export", async (req: Request, res: Response) => {
  const { id } = req.params;
  const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
    ? path.resolve(process.env.WORKSPACE_ROOT)
    : path.resolve(process.cwd(), "../workspace");

  try {
    const [rows] = await withDbConnection(async (conn) =>
      conn.query("SELECT title, final_answer FROM tasks WHERE id = ?", [id])
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
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  // Load task context
  let taskContext = "";
  try {
    const [rows] = await withDbConnection(async (conn) =>
      conn.query("SELECT title, intent, final_answer FROM tasks WHERE id = ? LIMIT 1", [id])
    ) as any[];
    if (!rows[0]) return res.status(404).json({ error: "Task not found" });
    const task = rows[0];
    taskContext = `[Continuing task: "${task.title}"]\n`;
    if (task.final_answer) {
      taskContext += `[Previous answer summary: ${String(task.final_answer).slice(0, 300)}]\n`;
    }
  } catch { /* proceed without context */ }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const emit = (ev: import("../../agents/events").AgentEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  try {
    const { runConductor } = await import("../../agents/conductor");
    await runConductor(
      { message: taskContext + message, sessionId: sessionId ?? id },
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

// ── Internal: create task when stream starts ──────────────────────────────────
export async function createTask(params: {
  id: string;
  runId: string;
  userId: number | null;
  title: string;
  intent: string;
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `INSERT IGNORE INTO tasks (id, run_id, user_id, title, intent, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'running', NOW())`,
        [params.id, params.runId, params.userId, params.title.slice(0, 254), params.intent]
      );
    });
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
}): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.query(
        `UPDATE tasks SET status = ?, elapsed_ms = ?, final_answer = ?, completed_at = NOW()
         WHERE id = ?`,
        [params.status, params.elapsedMs ?? null, (params.finalAnswer ?? "").slice(0, 2000), params.id]
      );
    });
  } catch (err) {
    console.error("[tasks] completeTask error", err);
  }
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
