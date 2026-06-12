import { Router, Request, Response } from 'express';
import { thaiNLPService } from '../../services/thaiNLPService';

const router = Router();

// POST /api/thai/detect — ตรวจจับ intent ของข้อความภาษาไทย
// Body: { text: string }
router.post('/detect', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'กรุณาระบุข้อความภาษาไทยในฟิลด์ "text"' });
    return;
  }
  try {
    const result = thaiNLPService.detectIntent(text);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

// POST /api/thai/tokenize — แบ่งคำภาษาไทย
// Body: { text: string }
router.post('/tokenize', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'กรุณาระบุ "text"' });
    return;
  }
  try {
    const tokens = thaiNLPService.tokenize(text);
    res.json({ success: true, tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

// POST /api/thai/entities — สกัด entities จากข้อความ
// Body: { text: string }
router.post('/entities', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'กรุณาระบุ "text"' });
    return;
  }
  try {
    const entities = thaiNLPService.extractEntities(text);
    res.json({ success: true, entities });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

// GET /api/thai/check?text=... — ตรวจว่าเป็นภาษาไทยหรือเปล่า
router.get('/check', (req: Request, res: Response) => {
  const text = req.query.text as string;
  if (!text) {
    res.status(400).json({ error: 'กรุณาระบุ query param "text"' });
    return;
  }
  try {
    res.json({
      isThai: thaiNLPService.isThai(text),
      thaiRatio: thaiNLPService.thaiRatio(text),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

export default router;
