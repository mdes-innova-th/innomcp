/**
 * TODO #42: API endpoint to store message reports with categories
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageIndex, messageText, categories, timestamp } = body;

    console.log("[Report API] Received report:", {
      messageIndex,
      categories,
      timestamp: new Date(timestamp).toISOString(),
      preview: messageText.substring(0, 100),
    });

    // TODO: Store in database with categories
    // CREATE TABLE chat_reports (
    //   id INT AUTO_INCREMENT PRIMARY KEY,
    //   message_index INT NOT NULL,
    //   message_text TEXT NOT NULL,
    //   categories JSON NOT NULL,
    //   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //   user_id INT NULL,
    //   session_id VARCHAR(255) NULL,
    //   status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending'
    // );

    return NextResponse.json({
      success: true,
      message: "Report submitted successfully",
    });
  } catch (error) {
    console.error("[Report API] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 }
    );
  }
}
