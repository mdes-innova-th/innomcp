<!-- cc-team deliverable
 group: R (Rebuild 3 quarantined REST routes against real service APIs (Express Router, TypeScript))
 member: R3 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":233,"completion_tokens":3287,"total_tokens":3520,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2451,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-11T19:26:51.187Z -->
import { Router, Request, Response } from 'express';
import { thaiNLPService } from '../../services/thaiNLPService';

const router = Router();

router.post('/detect-intent', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    const intent = await thaiNLPService.detectIntent(text);
    res.json({ intent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tokenize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    const tokens = await thaiNLPService.tokenize(text);
    res.json({ tokens });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/entities', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    const entities = await thaiNLPService.extractEntities(text);
    res.json({ entities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/clean', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    const cleaned = await thaiNLPService.clean(text);
    res.json({ cleaned });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/format-gov', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    const formatted = await thaiNLPService.formatGovDoc(text);
    res.json({ formatted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text must be a non-empty string' });
    }
    const [isThai, thaiRatio, intent, suggestedModel] = await Promise.all([
      thaiNLPService.isThai(text),
      thaiNLPService.thaiRatio(text),
      thaiNLPService.detectIntent(text),
      thaiNLPService.suggestModel(text),
    ]);
    res.json({ isThai, thaiRatio, intent, suggestedModel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
