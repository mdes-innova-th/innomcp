/**
 * Phase 5: LLM Feedback storage endpoint
 * Stores like/dislike feedback to daily JSONL log in logs/feedback/
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtMiddleware } from "@/jwtmiddleware";
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { withDbConnection } from "@/app/lib/db";
import type { ResultSetHeader } from "mysql2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messageIndex?: unknown;
      messageText?: unknown;
      feedback?: unknown;
      timestamp?: unknown;
      messageId?: unknown;
      sessionId?: unknown;
      query?: unknown;
      route?: unknown;
      toolsUsed?: unknown;
    };
    const {
      messageIndex,
      messageText,
      feedback,
      timestamp,
      messageId,
      sessionId,
      query,
      route,
      toolsUsed,
    } = body;

    // Extract user ID from JWT (optional — guest feedback is still accepted)
    const jwtResult = jwtMiddleware(req);
    const userId =
      jwtResult instanceof NextResponse
        ? null
        : (jwtResult.decoded as { user_id?: number })?.user_id ?? null;

    // Validate feedback type
    const validFeedback = ["like", "dislike", "none"] as const;
    type FeedbackType = typeof validFeedback[number];
    const feedbackType: FeedbackType = validFeedback.includes(feedback as FeedbackType)
      ? (feedback as FeedbackType)
      : "none";

    const entry = {
      messageIndex: typeof messageIndex === "number" ? messageIndex : undefined,
      feedbackType,
      userId,
      timestamp: new Date(typeof timestamp === "number" ? timestamp : Date.now()).toISOString(),
      preview:
        typeof messageText === "string" ? messageText.substring(0, 200) : "",
    };

    // Write to daily JSONL log
    const logsDir = join(process.cwd(), "logs", "feedback");
    const dateSuffix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFile = join(logsDir, `feedback-${dateSuffix}.jsonl`);

    await mkdir(logsDir, { recursive: true });
    await appendFile(logFile, JSON.stringify(entry) + "\n", "utf-8");

    // Phase 5 Step 1+2: also persist to chat_feedback table for admin dashboard.
    // Only "like"/"dislike" are recorded — "none" (un-rate) leaves the JSONL trail only.
    if (feedbackType !== "none") {
      const dbRating: "up" | "down" = feedbackType === "like" ? "up" : "down";
      const responseSummary =
        typeof messageText === "string" ? messageText.slice(0, 500) : null;
      const queryStr = typeof query === "string" ? query.slice(0, 1000) : null;
      const messageIdStr =
        typeof messageId === "string" ? messageId.slice(0, 64) : null;
      const sessionIdStr =
        typeof sessionId === "string" ? sessionId.slice(0, 64) : null;
      const routeStr = typeof route === "string" ? route.slice(0, 64) : null;
      const toolsUsedStr = Array.isArray(toolsUsed)
        ? toolsUsed.filter((t) => typeof t === "string").join(",").slice(0, 255)
        : typeof toolsUsed === "string"
        ? toolsUsed.slice(0, 255)
        : null;

      try {
        await withDbConnection(async (conn) => {
          await conn.execute<ResultSetHeader>(
            `INSERT INTO chat_feedback
               (message_id, session_id, rating, user_id, query, response_summary, route, tools_used)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              messageIdStr,
              sessionIdStr,
              dbRating,
              userId,
              queryStr,
              responseSummary,
              routeStr,
              toolsUsedStr,
            ]
          );
        });
      } catch (dbError) {
        // DB outage must not break the user-facing endpoint —
        // JSONL is already written, so the data is recoverable.
        console.error("[Feedback API] DB insert failed (JSONL already written):", dbError);
      }
    }

    return NextResponse.json({ success: true, message: "Feedback recorded" });
  } catch (error) {
    console.error("[Feedback API] Error:", error);
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    );
  }
}
