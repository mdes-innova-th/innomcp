/**
 * routes/api/motherInbox.ts — Jit inbox: messages FROM innova-bot
 *
 * GET /api/mother/inbox?limit=5&since=ISO_TIMESTAMP
 *
 * Returns recent messages received from innova-bot in Jit's ψ/inbox/.
 * Filters to messages where `from` contains "innova" or "local".
 * Optional `since` param returns only messages newer than that timestamp.
 */

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

const JIT_INBOX = process.env.JIT_INBOX_PATH || path.join(
  process.env.USERPROFILE || process.env.HOME || "C:/Users/USER-NT",
  "Jit/ψ/inbox"
);

interface InboxMessage {
  filename: string;
  from?: string;
  to?: string;
  timestamp?: string;
  subject?: string;
  preview: string;
  modifiedAt: string;
  isNew: boolean;
}

function parseMessage(content: string, filename: string, mtime: Date, since?: Date): InboxMessage | null {
  const lines = content.split("\n");
  let from: string | undefined;
  let to: string | undefined;
  let timestamp: string | undefined;
  let subject: string | undefined;
  let inFm = false;
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFm) { inFm = true; continue; }
      else { bodyStart = i + 1; break; }
    }
    if (inFm) {
      if (line.startsWith("from:")) from = line.replace("from:", "").trim();
      if (line.startsWith("to:")) to = line.replace("to:", "").trim();
      if (line.startsWith("timestamp:")) timestamp = line.replace("timestamp:", "").trim();
      if (line.startsWith("subject:")) subject = line.replace("subject:", "").trim();
    }
  }

  // Filter: only innova-bot messages (from contains "innova" or "local")
  const fromLower = (from ?? "").toLowerCase();
  if (!fromLower.includes("innova") && !fromLower.includes("local")) return null;

  const isNew = since ? mtime > since : false;
  const body = lines.slice(bodyStart).join("\n").trim();
  return {
    filename, from, to, timestamp, subject,
    preview: body.slice(0, 200).replace(/\n/g, " "),
    modifiedAt: mtime.toISOString(),
    isNew,
  };
}

router.get("/", (req: Request, res: Response): void => {
  const raw = parseInt((req.query as { limit?: string }).limit ?? "5", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(raw) ? raw : 5), 20);
  const sinceParam = (req.query as { since?: string }).since;
  const since = sinceParam ? new Date(sinceParam) : undefined;

  try {
    if (!fs.existsSync(JIT_INBOX)) {
      res.json({ messages: [], total: 0, newCount: 0, timestamp: new Date().toISOString() });
      return;
    }

    const files = fs.readdirSync(JIT_INBOX)
      .filter(f => f.endsWith(".md"))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(JIT_INBOX, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, 50);

    const messages: InboxMessage[] = [];
    for (const { name, mtime } of files) {
      if (messages.length >= limit) break;
      try {
        const content = fs.readFileSync(path.join(JIT_INBOX, name), "utf8");
        const msg = parseMessage(content, name, mtime, since);
        if (msg) messages.push(msg);
      } catch { /* skip */ }
    }

    res.json({
      messages,
      total: messages.length,
      newCount: messages.filter(m => m.isNew).length,
      inboxPath: JIT_INBOX,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.json({ messages: [], total: 0, newCount: 0, timestamp: new Date().toISOString() });
  }
});

export default router;
