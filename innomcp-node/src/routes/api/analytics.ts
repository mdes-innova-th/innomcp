import { Router, Request, Response } from 'express';
import { analyticsService } from '../../services/analyticsService';

const router = Router();

// GET /api/analytics/stats — ดึงสถิติรวมของระบบ
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = analyticsService.getStats();
    res.json({ success: true, data: stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงสถิติ';
    res.status(500).json({ error: message });
  }
});

// POST /api/analytics/event — track event จาก frontend
// Body: { type: 'message' | 'tool' | 'error', ...fields }
router.post('/event', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || !body.type) {
      res.status(400).json({ error: 'ต้องระบุ type ใน body' });
      return;
    }
    analyticsService.track(body);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

// POST /api/analytics/reset — reset สถิติ (admin only)
router.post('/reset', (_req: Request, res: Response) => {
  try {
    analyticsService.reset();
    res.json({ success: true, message: 'Analytics reset เรียบร้อย' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

export default router;
