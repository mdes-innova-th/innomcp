/**
 * Health Check API Routes
 * Endpoint สำหรับตรวจสอบสถานะของระบบและ external services
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

import { Router, Request, Response } from 'express';
import { createHealthResponse, createDetailedHealthResponse } from '../../utils/monitoring';
import { getSystemMetrics } from '../../utils/monitoring';
import { getRedisHealthSnapshot } from '../../utils/redis';

/** Unix-ms timestamp captured once when this module is first loaded. */
const startTime = Date.now();

const healthRouter = Router();

function getMcpInventory(chatModule: any) {
  const inventory = chatModule?.mcpClient?.getToolInventory?.();
  if (inventory) {
    return inventory;
  }

  const totalTools = Number(chatModule?.mcpClient?.getAvailableTools?.()?.length ?? 0);
  const connectedClients = Number(chatModule?.mcpClient?.getConnectedClients?.()?.length ?? 0);
  return {
    totalTools,
    localTools: totalTools,
    remoteTools: 0,
    connectedClients,
    remoteReady: false,
  };
}

/**
 * GET /api/health
 * Health check endpoint.
 *
 * ?detailed=true  — returns TICKET-013 dual-check response:
 *   { status, liveness: CheckBundleResult, readiness: CheckBundleResult, metrics, timestamp }
 *   Status is derived from liveness only for the HTTP status code (backward compat).
 *
 * (no query param) — legacy response enriched with mode/redis/mcp fields.
 */
healthRouter.get('/', async (req: Request, res: Response) => {
  // ── ?detailed=true path (TICKET-013) ─────────────────────────────────
  if (req.query.detailed === 'true') {
    try {
      const detailed = await createDetailedHealthResponse();
      // HTTP status: 503 only when liveness is red (unhealthy); degraded → 200
      const statusCode = detailed.status === 'unhealthy' ? 503 : 200;
      res.status(statusCode).json(detailed);
    } catch (error) {
      console.error('[Health] Error in detailed health check:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed',
      });
    }
    return;
  }

  // ── Legacy path (backward compat) ────────────────────────────────────
  try {
    const health = await createHealthResponse(false);
    const redisHealth = getRedisHealthSnapshot();

    // Set appropriate status code
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;

    // Enrich the response with mode fields expected by ModeStatusBar.tsx
    const isOnline = health.status === 'healthy' || health.status === 'degraded';

    // Lazy-require to avoid circular imports
    let aiMode: 'local' | 'remote' = 'local';
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const aiModeModule = require('./aiMode');
      const raw: string = aiModeModule?.getCurrentAIMode?.() ?? 'local';
      aiMode = raw === 'remote' || raw === 'hybrid' ? 'remote' : 'local';
    } catch { /* keep default */ }

    const mcpInventory = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const chatModule = require('./chat');
        return getMcpInventory(chatModule);
      } catch {
        return { totalTools: 0, localTools: 0, remoteTools: 0, connectedClients: 0, remoteReady: false };
      }
    })();

    let mcpStatus: 'connected' | 'local-only' | 'disconnected' = 'disconnected';
    try {
      if (mcpInventory.remoteReady) {
        mcpStatus = 'connected';
      } else if (mcpInventory.localTools > 0) {
        mcpStatus = 'local-only';
      }
    } catch { /* keep default */ }

    const modeReady = isOnline && mcpInventory.remoteReady;
    const notes = !mcpInventory.remoteReady && isOnline
      ? ['remote_mcp_unavailable']
      : [];

    res.status(statusCode).json({
      ...health,
      mode: isOnline ? 'online' : 'offline',
      mode_ready: modeReady,
      ai_mode: aiMode,
      mcp_status: mcpStatus,
      redis_status: redisHealth.status,
      redis_ready: redisHealth.ready,
      redis_configured: redisHealth.configured,
      redis_retry_after_ms: redisHealth.retryAfterMs,
      redis_raw_status: redisHealth.rawStatus,
      local_tools: mcpInventory.localTools,
      remote_tools: mcpInventory.remoteTools,
      total_tools: mcpInventory.totalTools,
      notes,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      providers: {
        configured: {
          mdesOllama: !!process.env.OLLAMA_BASE_URL,
          openai: !!(process.env.OPENAI_API_KEY || process.env.GPT_API_KEY),
          copilot: !!(process.env.GITHUB_COPILOT_TOKEN || process.env.COPILOT_API_KEY),
          thaiLlm: !!process.env.THAI_LLM_MODEL,
        },
        primary: 'mdes-ollama',
      },
      build: {
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        env: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error) {
    console.error('[Health] Error checking health:', error);
    const redisHealth = getRedisHealthSnapshot();
    res.status(500).json({
      status: 'error',
      message: 'Failed to check system health',
      timestamp: new Date().toISOString(),
      mode: 'offline',
      mode_ready: false,
      redis_status: redisHealth.status,
      redis_ready: redisHealth.ready,
      redis_configured: redisHealth.configured,
      redis_retry_after_ms: redisHealth.retryAfterMs,
      redis_raw_status: redisHealth.rawStatus,
    });
  }
});

/**
 * GET /api/health/metrics
 * System metrics endpoint
 */
healthRouter.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = getSystemMetrics();
    res.json({
      status: 'success',
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Health] Error fetching metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system metrics',
    });
  }
});

/**
 * GET /api/health/ready
 * Readiness probe - ตรวจสอบว่าระบบพร้อมรับ traffic
 */
healthRouter.get('/ready', async (req: Request, res: Response) => {
  try {
    const health = await createHealthResponse(false);
    
    if (health.status === 'healthy' || health.status === 'degraded') {
      res.status(200).json({
        ready: true,
        status: health.status,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        ready: false,
        status: health.status,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: 'Health check failed',
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe - ตรวจสอบว่าระบบยังมีชีวิต
 */
healthRouter.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/health/keys
 * MCP tools registration count — no auth required (public health check)
 */
healthRouter.get('/keys', (req: Request, res: Response) => {
  const redisHealth = getRedisHealthSnapshot();
  try {
    // Lazy require to avoid circular import (chat.ts initialises at startup)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chatModule = require('./chat');
    const mcpClientRef = chatModule?.mcpClient;
    const inventory = mcpClientRef?.getToolInventory?.() ?? {
      totalTools: Number(mcpClientRef?.getAvailableTools?.()?.length ?? 0),
      localTools: Number(mcpClientRef?.getAvailableTools?.()?.length ?? 0),
      remoteTools: 0,
      connectedClients: Number(mcpClientRef?.getConnectedClients?.()?.length ?? 0),
      remoteReady: false,
    };
    res.status(200).json({
      data: {
        mcpTools: inventory.totalTools,
        localTools: inventory.localTools,
        remoteTools: inventory.remoteTools,
        connectedClients: inventory.connectedClients,
        remoteReady: inventory.remoteReady,
        redisStatus: redisHealth.status,
        redisReady: redisHealth.ready,
        redisConfigured: redisHealth.configured,
        redisRetryAfterMs: redisHealth.retryAfterMs,
      },
      mcpTools: inventory.totalTools,
      localTools: inventory.localTools,
      remoteTools: inventory.remoteTools,
      connectedClients: inventory.connectedClients,
      remoteReady: inventory.remoteReady,
      redisStatus: redisHealth.status,
      redisReady: redisHealth.ready,
      redisConfigured: redisHealth.configured,
      redisRetryAfterMs: redisHealth.retryAfterMs,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(200).json({
      data: {
        mcpTools: 0,
        localTools: 0,
        remoteTools: 0,
        connectedClients: 0,
        remoteReady: false,
        redisStatus: redisHealth.status,
        redisReady: redisHealth.ready,
        redisConfigured: redisHealth.configured,
        redisRetryAfterMs: redisHealth.retryAfterMs,
      },
      mcpTools: 0,
      localTools: 0,
      remoteTools: 0,
      connectedClients: 0,
      remoteReady: false,
      redisStatus: redisHealth.status,
      redisReady: redisHealth.ready,
      redisConfigured: redisHealth.configured,
      redisRetryAfterMs: redisHealth.retryAfterMs,
      timestamp: new Date().toISOString(),
    });
  }
});

export { healthRouter };
