import { Router, Request, Response } from 'express';
import { mdesModelCache } from '../cache/mdesModelCache'; // adjust path for innomcp-node

// --- Type Definitions (inline for strict completeness) ---
export interface Model {
  name: string;
  description: string;
  tags: string[];
  size: string;
  modified: string;
  // additional fields as needed
}

export interface HealthStatus {
  status: string;
  models: number;
  memory: string;
  // additional health metrics
}

// --- Route Setup ---
const router = Router();

/**
 * Async wrapper to catch promise rejections and forward to Express error handler.
 */
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * Helper to set Cache-Control headers uniformly.
 */
const setCacheHeader = (res: Response, maxAge: number = 300, staleRevalidate?: number) => {
  const sMaxAge = staleRevalidate ?? maxAge;
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sMaxAge}`);
};

// GET /api/mdes/models – list all models (cached)
router.get(
  '/models',
  asyncHandler(async (req: Request, res: Response) => {
    const models = await mdesModelCache.getAllModels();
    setCacheHeader(res, 300, 600);
    res.json(models);
  })
);

// GET /api/mdes/models/search?q=xxx – search models
router.get(
  '/models/search',
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'กรุณาระบุคำค้นหา (parameter q)' });
    }
    const results = await mdesModelCache.searchModels(query);
    setCacheHeader(res, 300, 600);
    res.json(results);
  })
);

// GET /api/mdes/models/:name – get specific model info
router.get(
  '/models/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name;
    const model = await mdesModelCache.getModel(name);
    if (!model) {
      return res.status(404).json({ error: `ไม่พบโมเดล "${name}"` });
    }
    setCacheHeader(res, 300, 600);
    res.json(model);
  })
);

// GET /api/mdes/health – MDES Ollama health check
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await mdesModelCache.checkHealth();
    res.set('Cache-Control', 'no-cache'); // health is not cacheable
    res.json(health);
  })
);

// POST /api/mdes/warmup – force cache refresh
router.post(
  '/warmup',
  asyncHandler(async (req: Request, res: Response) => {
    await mdesModelCache.warmupCache();
    res.set('Cache-Control', 'no-store'); // do not cache warmup requests
    res.json({ message: 'แคชของโมเดล MDES ได้รับการ refresh แล้ว' });
  })
);

// GET /api/mdes/recommend?task=thai – recommend model for task
router.get(
  '/recommend',
  asyncHandler(async (req: Request, res: Response) => {
    const task = req.query.task as string;
    if (!task) {
      return res.status(400).json({ error: 'กรุณาระบุพารามิเตอร์ task (เช่น task=thai)' });
    }
    const recommendations = await mdesModelCache.recommend(task);
    setCacheHeader(res, 600, 1200); // recommendations change less frequently
    res.json(recommendations);
  })
);

export default router;
