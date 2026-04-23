/**
 * Phase 5: LLM Feedback storage endpoint
 * Stores like/dislike feedback to daily JSONL log in logs/feedback/
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtMiddleware } from "@/jwtmiddleware";
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messageIndex?: unknown;
      messageText?: unknown;
      feedback?: unknown;
      timestamp?: unknown;
    };
    const { messageIndex, messageText, feedback, timestamp } = body;

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

    return NextResponse.json({ success: true, message: "Feedback recorded" });
  } catch (error) {
    console.error("[Feedback API] Error:", error);
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    );
  }
}
