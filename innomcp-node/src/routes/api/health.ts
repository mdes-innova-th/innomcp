/**
 * Health Check API Routes
 * Endpoint สำหรับตรวจสอบสถานะของระบบและ external services
 * 
 * @author MDES Development Team
 * @created 2026-01-11
 */

import { Router, Request, Response } from 'express';
import { createHealthResponse } from '../../utils/monitoring';
import { getSystemMetrics } from '../../utils/monitoring';

const healthRouter = Router();

/**
 * GET /api/health
 * Health check endpoint - แสดงสถานะระบบแบบง่าย
 */
healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const detailed = req.query.detailed === 'true';
    const health = await createHealthResponse(detailed);
    
    // Set appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('[Health] Error checking health:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check system health',
      timestamp: new Date().toISOString(),
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
  try {
    // Lazy require to avoid circular import (chat.ts initialises at startup)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chatModule = require('./chat');
    const mcpClientRef = chatModule?.mcpClient;
    const tools: number = mcpClientRef?.getAvailableTools?.()?.length ?? 0;
    res.status(200).json({ data: { mcpTools: tools }, mcpTools: tools, timestamp: new Date().toISOString() });
  } catch {
    res.status(200).json({ data: { mcpTools: 0 }, mcpTools: 0, timestamp: new Date().toISOString() });
  }
});

export { healthRouter };
