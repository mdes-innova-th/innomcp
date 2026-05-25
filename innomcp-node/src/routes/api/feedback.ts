/**
 * /api/chat/feedback — Save star ratings for chat messages to DB.
 * Fire-and-forget DB insert; always returns 200 to the client immediately.
 */

import { Router, Request, Response } from "express";
import { withDbConnection } from "../../utils/db";

const router = Router();

// POST /api/chat/feedback  { messageId, rating, sessionId? }
// Also accepts snake_case aliases for backwards compatibility.
router.post("/", async (req: Request, res: Response) => {
  const body = req.body as {
    messageId?: string;
    message_id?: string;
    rating?: number;
    sessionId?: string;
    session_id?: string;
  };

  // Accept both camelCase (frontend) and snake_case (legacy)
  const message_id = body.messageId ?? body.message_id;
  const session_id = body.sessionId ?? body.session_id;
  const { rating } = body;

  // Validate input — return 400 on bad data so callers can detect misuse
  if (!message_id || typeof message_id !== "string") {
    return res.status(400).json({ error: "Invalid messageId" });
  }
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "Invalid rating: must be integer 1–5" });
  }

  // Respond immediately — don't block on DB
  res.json({ ok: true });

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
