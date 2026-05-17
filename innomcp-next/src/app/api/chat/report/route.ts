/**
 * Chat message report endpoint — Phase C.16
 * Stores user-submitted message reports (harmful content, wrong answer, etc.)
 * Primary: JSONL file log. Secondary: chat_reports DB table (graceful fallback).
 *
 * DB schema (create if missing):
 *   CREATE TABLE IF NOT EXISTS chat_reports (
 *     id INT AUTO_INCREMENT PRIMARY KEY,
 *     message_id VARCHAR(128) NULL,
 *     session_id VARCHAR(128) NULL,
 *     message_index INT NULL,
 *     message_preview TEXT NULL,
 *     categories JSON NOT NULL,
 *     user_id INT NULL,
 *     status ENUM('pending','reviewed','resolved') DEFAULT 'pending',
 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *   );
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
      messageId?: unknown;
      sessionId?: unknown;
      categories?: unknown;
      timestamp?: unknown;
    };
    const { messageIndex, messageText, messageId, sessionId, categories, timestamp } = body;

    const jwtResult = jwtMiddleware(req);
    const userId =
      jwtResult instanceof NextResponse
        ? null
        : (jwtResult.decoded as { user_id?: number })?.user_id ?? null;

    const categoryList: string[] = Array.isArray(categories)
      ? categories.filter((c): c is string => typeof c === "string").slice(0, 20)
      : [];

    const entry = {
      messageIndex: typeof messageIndex === "number" ? messageIndex : null,
      messageId: typeof messageId === "string" ? messageId.slice(0, 128) : null,
      sessionId: typeof sessionId === "string" ? sessionId.slice(0, 128) : null,
      categories: categoryList,
      userId,
      timestamp: new Date(typeof timestamp === "number" ? timestamp : Date.now()).toISOString(),
      preview: typeof messageText === "string" ? messageText.substring(0, 200) : "",
    };

    // Primary: JSONL file (always written, survives DB outage)
    const logsDir = join(process.cwd(), "logs", "reports");
    const dateSuffix = new Date().toISOString().slice(0, 10);
    await mkdir(logsDir, { recursive: true });
    await appendFile(join(logsDir, `reports-${dateSuffix}.jsonl`), JSON.stringify(entry) + "\n", "utf-8");

    // Secondary: DB persist (non-blocking fallback)
    try {
      await withDbConnection(async (conn) => {
        await conn.execute<ResultSetHeader>(
          `INSERT IGNORE INTO chat_reports
             (message_id, session_id, message_index, message_preview, categories, user_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            entry.messageId,
            entry.sessionId,
            entry.messageIndex,
            entry.preview,
            JSON.stringify(categoryList),
            userId,
          ]
        );
      });
    } catch (dbError) {
      console.error("[Report API] DB insert failed (JSONL written):", dbError);
    }

    return NextResponse.json({ success: true, message: "Report submitted successfully" });
  } catch (error) {
    console.error("[Report API] Error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
