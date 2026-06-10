// app/api/stats/route.ts

import { NextRequest, NextResponse } from 'next/server'

// ------------------------------------------------------------------
// 1.  Type definitions
// ------------------------------------------------------------------
export interface INNOMCPStats {
  session: {
    activeConnections: number
    messagesThisSession: number
    uptime: number // seconds since server start
  }
  models: {
    totalRequests: number
    byModel: Record<string, number>
  }
  tools: {
    totalCalls: number
    byTool: Record<string, number>
  }
  errors: {
    count: number
    lastError?: string
  }
  timestamp: number
}

// Expected POST body contract
interface IncrementPayload {
  action: 'model_request' | 'tool_call' | 'message' | 'error' | 'connection'
  name?: string // model or tool name (required for model_request, tool_call)
  message?: string // optional error description
  delta?: number // for connection (positive or negative integer)
}

// ------------------------------------------------------------------
// 2.  In‑memory singleton store (module‑level)
// ------------------------------------------------------------------
class StatsStore {
  private startTime: number = Date.now()
  activeConnections: number = 0
  messagesThisSession: number = 0
  private modelRequests: {
    total: number
    byModel: Record<string, number>
  } = { total: 0, byModel: {} }
  private toolCalls: {
    total: number
    byTool: Record<string, number>
  } = { total: 0, byTool: {} }
  private errors: { count: number; lastError?: string } = { count: 0 }

  // ---- public mutators (called by POST handler) ----

  recordModelRequest(modelName: string): void {
    this.modelRequests.total++
    this.modelRequests.byModel[modelName] =
      (this.modelRequests.byModel[modelName] || 0) + 1
  }

  recordToolCall(toolName: string): void {
    this.toolCalls.total++
    this.toolCalls.byTool[toolName] =
      (this.toolCalls.byTool[toolName] || 0) + 1
  }

  recordMessage(): void {
    this.messagesThisSession++
  }

  recordError(message?: string): void {
    this.errors.count++
    if (message) {
      this.errors.lastError = message
    }
  }

  recordConnection(delta: number): void {
    this.activeConnections += delta
    if (this.activeConnections < 0) this.activeConnections = 0
  }

  // ---- snapshot builder for GET ----
  getSnapshot(): INNOMCPStats {
    const now = Date.now()
    return {
      session: {
        activeConnections: this.activeConnections,
        messagesThisSession: this.messagesThisSession,
        uptime: Math.floor((now - this.startTime) / 1000),
      },
      models: {
        totalRequests: this.modelRequests.total,
        byModel: { ...this.modelRequests.byModel },
      },
      tools: {
        totalCalls: this.toolCalls.total,
        byTool: { ...this.toolCalls.byTool },
      },
      errors: {
        count: this.errors.count,
        lastError: this.errors.lastError,
      },
      timestamp: now,
    }
  }
}

const globalStore = new StatsStore()

// ------------------------------------------------------------------
// 3.  CORS & no‑cache helpers
// ------------------------------------------------------------------
function corsHeaders(): Headers {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return headers
}

function noCacheHeaders(headers: Headers): void {
  headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
}

// ------------------------------------------------------------------
// 4.  Route handlers
// ------------------------------------------------------------------

/**
 * GET /api/stats
 * Returns the current analytics snapshot.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const stats = globalStore.getSnapshot()
  const headers = corsHeaders()
  noCacheHeaders(headers)
  headers.set('Content-Type', 'application/json')

  return new NextResponse(JSON.stringify(stats), {
    status: 200,
    headers,
  })
}

/**
 * POST /api/stats
 * Accepts a JSON body to increment internal counters.
 * Example bodies:
 *   { "action": "model_request", "name": "llama3" }
 *   { "action": "tool_call", "name": "search" }
 *   { "action": "message" }
 *   { "action": "error", "message": "Timeout" }
 *   { "action": "connection", "delta": 1 }   // or -1 on disconnect
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = corsHeaders()
  noCacheHeaders(headers)

  // Handle CORS preflight if needed (though Next handles automatically)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers })
  }

  try {
    const body = (await request.json()) as IncrementPayload

    // Basic validation
    const { action, name, message, delta } = body
    if (!action) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing "action" field' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Apply increment based on action type
    switch (action) {
      case 'model_request':
        if (typeof name !== 'string' || name.trim() === '') {
          throw new Error('model_request requires a non‑empty "name"')
        }
        globalStore.recordModelRequest(name.trim())
        break

      case 'tool_call':
        if (typeof name !== 'string' || name.trim() === '') {
          throw new Error('tool_call requires a non‑empty "name"')
        }
        globalStore.recordToolCall(name.trim())
        break

      case 'message':
        globalStore.recordMessage()
        break

      case 'error':
        globalStore.recordError(message ?? undefined)
        break

      case 'connection':
        if (typeof delta !== 'number') {
          throw new Error('connection action requires a numeric "delta"')
        }
        globalStore.recordConnection(delta)
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    // Return success
    return new NextResponse(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new NextResponse(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  }
}