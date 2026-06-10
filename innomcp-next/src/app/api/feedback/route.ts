// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// In-memory rate limiter: sessionId -> count
const rateLimitMap = new Map<string, number>();
const MAX_FEEDBACK_PER_SESSION = 100;

// Path to feedback.jsonl
const FEEDBACK_LOG_PATH = path.join(process.cwd(), 'logs', 'feedback.jsonl');

// Ensure logs directory exists
function ensureLogFile() {
  const dir = path.dirname(FEEDBACK_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FEEDBACK_LOG_PATH)) {
    fs.writeFileSync(FEEDBACK_LOG_PATH, '', 'utf-8');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse body
    const body = await request.json();
    const { messageId, rating, comment, sessionId } = body as {
      messageId?: string;
      rating?: string;
      comment?: string;
      sessionId?: string;
    };

    // Validate
    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing messageId', success: false },
        { status: 400 }
      );
    }
    if (!rating || !['good', 'bad'].includes(rating)) {
      return NextResponse.json(
        { error: 'Invalid or missing rating, must be "good" or "bad"', success: false },
        { status: 400 }
      );
    }
    if (comment !== undefined && typeof comment !== 'string') {
      return NextResponse.json(
        { error: 'Comment must be a string', success: false },
        { status: 400 }
      );
    }
    if (sessionId !== undefined && typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'SessionId must be a string', success: false },
        { status: 400 }
      );
    }

    // Rate limit if sessionId provided
    if (sessionId) {
      const currentCount = rateLimitMap.get(sessionId) || 0;
      if (currentCount >= MAX_FEEDBACK_PER_SESSION) {
        return NextResponse.json(
          { error: 'Rate limit exceeded: max 100 feedbacks per session', success: false },
          { status: 429 }
        );
      }
      rateLimitMap.set(sessionId, currentCount + 1);
    }

    // Generate unique feedbackId
    const feedbackId = crypto.randomUUID();

    // Build log entry
    const logEntry = {
      feedbackId,
      messageId,
      rating,
      comment: comment || '',
      sessionId: sessionId || '',
      timestamp: new Date().toISOString(),
    };

    // Append to JSONL file
    ensureLogFile();
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(FEEDBACK_LOG_PATH, logLine, 'utf-8');

    // Return success
    return NextResponse.json({ success: true, feedbackId }, { status: 201 });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}