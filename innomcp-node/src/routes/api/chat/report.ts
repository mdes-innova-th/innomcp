import { Router } from "express";
import { logBoth } from "../../../utils/mcpLogger";

const router = Router();

/**
 * Report message endpoint
 * POST /api/chat/report
 */
router.post("/report", async (req, res) => {
  try {
    const { messageIndex, messageText, reason, timestamp } = req.body;

    // Log the report
    logBoth("warn", `[CHAT REPORT] User reported message at index ${messageIndex}: ${reason}`);
    logBoth("warn", `[CHAT REPORT] Message content: ${messageText.substring(0, 100)}...`);

    // TODO: Store in database (user_activity_log table)
    // const userId = req.user?.userId || null;
    // await db.query(
    //   "INSERT INTO user_activity_log (user_id, action_type, details, timestamp) VALUES (?, ?, ?, ?)",
    //   [userId, 'report_message', JSON.stringify({ messageText, reason }), timestamp]
    // );

    res.json({ success: true, message: "Report received" });
  } catch (error) {
    logBoth("error", `[CHAT REPORT] Error: ${error}`);
    res.status(500).json({ success: false, error: "Failed to report message" });
  }
});

export default router;
