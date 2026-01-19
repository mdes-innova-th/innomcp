// innomcp-next/src/app/api/logs/user-actions/route.ts
// API endpoint to receive user action logs from client

import { NextRequest, NextResponse } from 'next/server';
import { logUserActions } from '@/utils/serverLogger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actions } = body;

    if (!Array.isArray(actions)) {
      return NextResponse.json(
        { error: 'Invalid request: actions must be an array' },
        { status: 400 }
      );
    }

    // Log user actions to file
    logUserActions(actions);

    return NextResponse.json({ success: true, logged: actions.length });
  } catch (error) {
    console.error('[UserActionsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log user actions' },
      { status: 500 }
    );
  }
}
