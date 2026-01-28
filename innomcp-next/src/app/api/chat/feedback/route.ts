/**
 * TODO #43: API endpoint to store like/dislike feedback
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageIndex, messageText, feedback, timestamp } = body;

    // TODO: Store in database instead of just logging
    console.log("[Feedback API] Received feedback:", {
      messageIndex,
      feedbackType: feedback,
      timestamp: new Date(timestamp).toISOString(),
      preview: messageText.substring(0, 100),
    });

    // For now, just return success
    // In production, save to MariaDB with schema:
    // CREATE TABLE chat_feedback (
    //   id INT AUTO_INCREMENT PRIMARY KEY,
    //   message_index INT NOT NULL,
    //   message_text TEXT NOT NULL,
    //   feedback_type ENUM('like', 'dislike', 'none') NOT NULL,
    //   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //   user_id INT NULL,
    //   session_id VARCHAR(255) NULL
    // );

    return NextResponse.json({
      success: true,
      message: "Feedback recorded successfully",
    });
  } catch (error) {
    console.error("[Feedback API] Error:", error);
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    );
  }
}
