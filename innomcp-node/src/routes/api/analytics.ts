import { Router, Request, Response } from 'express';
import * as analyticsService from '../services/analyticsService';

const router = Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'default-admin-key';

// Helper to verify admin key
function ensureAdmin(req: Request, res: Response): boolean {
  const key = req.headers['x-admin-key'];
  if (typeof key !== 'string' || key !== ADMIN_KEY) {
    res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง: ต้องใช้ X-Admin-Key ที่ถูกต้อง' });
    return false;
  }
  return true;
}

/**
 * GET /api/analytics/stats
 * ส่งคืนสถิติรวมของระบบ
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await analyticsService.getOverallStats();
    res.json({ success: true, data: stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงสถิติ';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/analytics/event
 * ติดตามเหตุการณ์จาก frontend
 * Body: { event: string, payload?: Record<string, unknown> }
 */
router.post('/event', async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;
    if (typeof event !== 'string' || !event.trim()) {
      return res.status(400).json({ error: 'ต้องมีฟิลด์ event เป็น string ที่ไม่ว่าง' });
    }
    await analyticsService.trackEvent(event.trim(), payload ?? {});
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกเหตุการณ์';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/analytics/export
 * ส่งออกข้อมูล analytics (JSON หรือ CSV)
 * Query: format?: 'json' | 'csv' (default: 'json')
 * ต้องการ X-Admin-Key
 */
router.get('/export', async (req: Request, res: Response) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const format = (req.query.format as string)?.toLowerCase() || 'json';
    const data = await analyticsService.getAllData();

    if (format === 'csv') {
      const csv = dataToCsv(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
      return res.send(csv);
    }
    // default JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออกข้อมูล';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/analytics/reset
 * รีเซ็ตตัวนับทั้งหมด (สำหรับ admin เท่านั้น)
 * ต้องการ X-Admin-Key
 */
router.delete('/reset', async (req: Request, res: Response) => {
  if (!ensureAdmin(req, res)) return;

  try {
    await analyticsService.resetAll();
    res.json({ success: true, message: 'รีเซ็ตข้อมูล analytics เรียบร้อยแล้ว' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล';
    res.status(500).json({ error: message });
  }
});

// Helper: convert array of objects to CSV string (basic implementation)
function dataToCsv(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const lines = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap if contains comma or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headers.join(','), ...lines].join('\n');
}

export default router;