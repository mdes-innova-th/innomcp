/**
 * routes/api/motherBusLog.ts — Jit↔innova-bot message bus log
 *
 * GET /api/mother/bus-log?limit=10
 *
 * Returns recent messages from the Jit ψ/inbox/ directory.
 * These are messages sent/received via the organ message bus.
 */

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

// Jit oracle inbox — messages from innova-bot arrive here
const JIT_INBOX = process.env.JIT_INBOX_PATH || path.join(
  process.env.USERPROFILE || process.env.HOME || "C:/Users/USER-NT",
  "Jit/ψ/inbox"
);

interface BusMessage {
  filename: string;
  from?: string;
  to?: string;
  timestamp?: string;
  subject?: string;
  preview: string;
  modifiedAt: string;
}

function parseMessage(content: string, filename: string, mtime: Date): BusMessage {
  const lines = content.split("\n");
  let from: string | undefined;
  let to: string | undefined;
  let timestamp: string | undefined;
  let subject: string | undefined;
  let inFrontmatter = false;
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) { inFrontmatter = true; continue; }
      else { bodyStart = i + 1; break; }
    }
    if (inFrontmatter) {
      if (line.startsWith("from:")) from = line.replace("from:", "").trim();
      if (line.startsWith("to:")) to = line.replace("to:", "").trim();
      if (line.startsWith("timestamp:")) timestamp = line.replace("timestamp:", "").trim();
      if (line.startsWith("subject:")) subject = line.replace("subject:", "").trim();
    }
  }

  const body = lines.slice(bodyStart).join("\n").trim();
  const preview = body.slice(0, 150).replace(/\n/g, " ");

  return {
    filename,
    from, to, timestamp, subject,
    preview,
    modifiedAt: mtime.toISOString(),
  };
}

router.get("/", (_req: Request, res: Response): void => {
  const raw = parseInt((_req.query as { limit?: string }).limit ?? "10", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(raw) ? raw : 10), 50);

  try {
    if (!fs.existsSync(JIT_INBOX)) {
      res.json({ messages: [], total: 0, inboxPath: JIT_INBOX, timestamp: new Date().toISOString() });
      return;
    }

    const files = fs.readdirSync(JIT_INBOX)
      .filter(f => f.endsWith(".md"))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(JIT_INBOX, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit);

    const messages: BusMessage[] = [];
    for (const { name, mtime } of files) {
      try {
        const content = fs.readFileSync(path.join(JIT_INBOX, name), "utf8");
        messages.push(parseMessage(content, name, mtime));
      } catch {
        // Skip unreadable files
      }
    }

    res.json({
      messages,
      total: messages.length,
      inboxPath: JIT_INBOX,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.json({ messages: [], total: 0, error: "inbox not accessible", timestamp: new Date().toISOString() });
  }
});

export default router;
