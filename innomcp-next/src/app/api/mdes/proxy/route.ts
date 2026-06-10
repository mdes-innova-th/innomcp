// app/api/mdes/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

const UPSTREAM_URL = 'https://ollama.mdes-innova.online/v1/chat/completions';
const TIMEOUT_MS = 120_000; // 120 seconds

export async function POST(request: NextRequest) {
  let body: ProxyRequest;
  try {
    body = (await request.json()) as ProxyRequest;
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.model || !body.messages || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: 'Missing required fields: model and messages array' },
      { status: 400 }
    );
  }

  const { model, messages, stream = false, max_tokens, temperature } = body;

  // Log metadata for analytics (no content)
  console.log(
    `[MDES Proxy] Request: model=${model}, stream=${stream}, max_tokens=${max_tokens ?? 'default'}, temperature=${temperature ?? 'default'}, timestamp=${new Date().toISOString()}`
  );

  // Build upstream request body
  const upstreamBody = {
    model,
    messages,
    stream,
    ...(max_tokens !== undefined && { max_tokens }),
    ...(temperature !== undefined && { temperature }),
  };

  // Headers for upstream request
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add MDES auth header if environment variable is set
  const apiKey = process.env.MDES_OLLAMA_API_KEY;
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Create abort controller with timeout and client disconnect handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (request.signal) {
    request.signal.addEventListener('abort', () => {
      controller.abort();
      clearTimeout(timeoutId);
    });
  }

  try {
    const upstreamResponse = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });

    // Clear timeout as we received response headers
    clearTimeout(timeoutId);

    // Handle non-stream error responses (status >= 400)
    if (!upstreamResponse.ok) {
      let errorDetail = '';
      try {
        errorDetail = await upstreamResponse.text();
      } catch {
        errorDetail = 'Unable to read error response';
      }
      console.error(
        `[MDES Proxy] Upstream error: status=${upstreamResponse.status}, body=${errorDetail.substring(0, 200)}`
      );
      return new NextResponse(
        JSON.stringify({
          error: `Upstream service returned ${upstreamResponse.status}`,
          detail: errorDetail,
        }),
        {
          status: upstreamResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // For streaming requests
    if (stream) {
      // Ensure the response body is a readable stream
      if (!upstreamResponse.body) {
        return new NextResponse(
          JSON.stringify({ error: 'Empty response body from upstream' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Return a streaming response
      return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming: parse and return JSON
    const data = await upstreamResponse.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle AbortError (timeout or client disconnect)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[MDES Proxy] Request aborted due to timeout or client disconnect');
      return NextResponse.json(
        { error: 'Request timed out or was cancelled' },
        { status: 504 }
      );
    }

    // Generic error
    console.error('[MDES Proxy] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to upstream service' },
      { status: 502 }
    );
  }
}