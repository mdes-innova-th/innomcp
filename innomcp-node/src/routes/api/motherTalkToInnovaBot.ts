/**
 * routes/api/motherTalkToInnovaBot.ts — Send message to innova-bot via bus
 *
 * POST /api/mother/talk-to-innova-bot
 * Body: { message: string; from?: string }
 *
 * Writes a message file to the innova-bot's message bus inbox.
 * Returns the file path written.
 */

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

const INNOVA_BUS = process.env.INNOVA_BUS_PATH || path.join(
  process.env.USERPROFILE || process.env.HOME || "C:/Users/USER-NT",
  "Jit/ψ/outbox"
);

router.post("/", (req: Request, res: Response): void => {
  const { message, from = "innomcp" } = req.body as { message?: string; from?: string };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ ok: false, error: "message is required" });
    return;
  }

  const slug = message.trim().slice(0, 40).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
  const ts = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
  const filename = `innomcp-to-innova-${ts}-${slug}.md`;
  const filepath = path.join(INNOVA_BUS, filename);

  const content = `---
from: ${from}
to: innova-bot
timestamp: ${new Date().toISOString()}
subject: message-from-innomcp
---

${message.trim()}
`;

  try {
    fs.mkdirSync(INNOVA_BUS, { recursive: true });
    fs.writeFileSync(filepath, content, "utf8");
    res.json({ ok: true, filename, filepath, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
