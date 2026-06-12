<!-- cc-team deliverable
 group: R (Rebuild 3 quarantined REST routes against real service APIs (Express Router, TypeScript))
 member: R1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":197,"completion_tokens":1489,"total_tokens":1686,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1181,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-11T19:26:21.524Z -->
import { Router, Request, Response } from 'express';
import { analyticsService } from '../../services/analyticsService';

const router = Router();

router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await analyticsService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

router.post('/track', async (req: Request, res: Response): Promise<void> => {
  try {
    const { event } = req.body;
    await analyticsService.track(event);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track event' });
  }
});

router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    await analyticsService.reset();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset analytics' });
  }
});

router.post('/snapshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await analyticsService.saveSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save snapshot' });
  }
});

export default router;
