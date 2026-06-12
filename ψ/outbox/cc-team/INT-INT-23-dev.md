<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-23 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":95,"completion_tokens":1700,"total_tokens":1795,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1384,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-12T03:51:23.876Z -->
import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_BACKEND_URL is not defined' }, { status: 500 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend health check failed with status ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    let errorMessage = 'An unknown error occurred while contacting the backend';
    if (error instanceof Error) {
      errorMessage = error.name === 'AbortError' 
        ? 'Request to backend timed out after 5 seconds' 
        : error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
