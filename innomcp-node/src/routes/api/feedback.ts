/**
 * /api/chat/feedback — Save star ratings for chat messages to DB.
 * Fire-and-forget DB insert; always returns 200 to the client immediately.
 */

import { Router, Request, Response } from "express";
import { withDbConnection } from "../../utils/db";

const router = Router();

// POST /api/chat/feedback  { message_id, rating, session_id? }
router.post("/", async (req: Request, res: Response) => {
  const { message_id, rating, session_id } = req.body as {
    message_id?: string;
    rating?: number;
    session_id?: string;
  };

  // Respond immediately — don't block on DB
  res.json({ ok: true });

  // Validate before writing
  if (!message_id || typeof message_id !== "string") return;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return;

  // Fire-and-forget insert
  withDbConnection(async (conn) => {
    await conn.query(
      `INSERT INTO feedback (message_id, rating, session_id) VALUES (?, ?, ?)`,
      [message_id.slice(0, 64), r, session_id ? String(session_id).slice(0, 64) : null]
    );
  }).catch((err) => {
    console.error("[feedback] DB insert error", err);
  });
});

export default router;
