/**
 * Metrics API Endpoint
 * Returns p50/p95/p99 latency metrics for endpoints and tools
 */

import { Router, Request, Response } from 'express';
import { getAllMetrics, getLatencyStats, clearMetrics } from '../../metrics/latency';
import { generateMetricsReport } from '../../utils/advancedMetrics';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /api/metrics
 * Returns all performance metrics (today)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();

    // Group by type
    const endpoints: Record<string, any> = {};
    const tools: Record<string, any> = {};
    const websockets: Record<string, any> = {};
    const other: Record<string, any> = {};

    for (const [name, stats] of Object.entries(metrics)) {
      if (name.startsWith('tool:')) {
        tools[name.replace('tool:', '')] = stats;
      } else if (name.startsWith('ws:')) {
        websockets[name.replace('ws:', '')] = stats;
      } else if (name.includes(':')) {
        // HTTP endpoint (GET:/api/chat)
        endpoints[name] = stats;
      } else {
        other[name] = stats;
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      endpoints,
      tools,
      websockets,
      other
    });
  } catch (err: any) {
    logger.error('[Metrics API] Failed to get metrics', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/metrics/performance
 * Returns in-memory per-route call counts, latency stats, and error rates.
 * Must be declared before /:name so Express does not swallow the literal path.
 */
router.get('/performance', (_req, res) => {
  const { getMetrics, getSlowRoutes } = require('../../middleware/performanceTracking');
  res.json({
    routes: getMetrics(),
    slowRoutes: getSlowRoutes(500), // routes with avg > 500 ms
    generatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/metrics/:name
 * Get specific metric by name
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const stats = await getLatencyStats(name);

    if (!stats) {
      return res.status(404).json({ error: 'Metric not found' });
    }

    res.json({
      name,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (err: any) {
    logger.error('[Metrics API] Failed to get metric', { 
      name: req.params.name,
      error: err.message 
    });
    res.status(500).json({ error: 'Failed to retrieve metric' });
  }
});

/**
 * DELETE /api/metrics/:name
 * Clear specific metric (for testing)
 */
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    await clearMetrics(name);

    res.json({
      message: 'Metric cleared',
      name
    });
  } catch (err: any) {
    logger.error('[Metrics API] Failed to clear metric', {
      name: req.params.name,
      error: err.message
    });
    res.status(500).json({ error: 'Failed to clear metric' });
  }
});

/**
 * GET /api/metrics/advanced
 * Returns advanced metrics with per-tool p50/p95/p99 from Redis
 */
router.get('/advanced', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 1;
    const report = await generateMetricsReport(days);
    
    res.json(report);
  } catch (err: any) {
    logger.error('[Metrics API] Failed to generate advanced report', { error: err.message });
    res.status(500).json({ error: 'Failed to generate advanced metrics' });
  }
});

/**
 * GET /api/metrics/summary/overview
 * Returns high-level overview of system performance
 */
router.get('/summary/overview', async (req: Request, res: Response) => {
  try {
    const metrics = await getAllMetrics();
    
    const overview = {
      totalMetrics: Object.keys(metrics).length,
      slowEndpoints: [] as Array<{ name: string; p95: number }>,
      slowTools: [] as Array<{ name: string; p95: number }>,
      healthScore: 100
    };

    // Find slow endpoints (p95 > 2s)
    for (const [name, stats] of Object.entries(metrics)) {
      if (stats.p95 > 2000) {
        if (name.startsWith('tool:')) {
          overview.slowTools.push({ 
            name: name.replace('tool:', ''), 
            p95: stats.p95 
          });
        } else if (name.includes(':')) {
          overview.slowEndpoints.push({ 
            name, 
            p95: stats.p95 
          });
        }
      }
    }

    // Calculate health score
    const slowCount = overview.slowEndpoints.length + overview.slowTools.length;
    overview.healthScore = Math.max(0, 100 - (slowCount * 10));

    res.json(overview);
  } catch (err: any) {
    logger.error('[Metrics API] Failed to get overview', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve overview' });
  }
});

export default router;
