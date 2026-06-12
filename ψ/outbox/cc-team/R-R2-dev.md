<!-- cc-team deliverable
 group: R (Rebuild 3 quarantined REST routes against real service APIs (Express Router, TypeScript))
 member: R2 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":235,"completion_tokens":3459,"total_tokens":3694,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2789,"image_tokens":0},"cache_creation_input_tokens":0} | 65s
 generated: 2026-06-11T19:27:11.710Z -->
import { Router, Request, Response } from 'express';
import { mdesModelCache } from '../../services/mdesModelCache';

const router = Router();

router.get('/models', async (req: Request, res: Response): Promise<void | Response> => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    const models = await mdesModelCache.getModels();
    return res.json(models);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/models/:name', async (req: Request, res: Response): Promise<void | Response> => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    const model = await mdesModelCache.getModel(req.params.name);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    return res.json(model);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/families', async (req: Request, res: Response): Promise<void | Response> => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    const families = await mdesModelCache.getModelFamilies();
    return res.json(families);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/best', async (req: Request, res: Response): Promise<void | Response> => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    const task = req.query.task as string;
    const bestModel = await mdesModelCache.getBestModelForTask(task);
    return res.json(bestModel);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/warmup', async (req: Request, res: Response): Promise<void | Response> => {
  try {
    const result = await mdesModelCache.warmUp();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', async (req: Request, res: Response): Promise<void | Response> => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    const stats = await mdesModelCache.getStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
