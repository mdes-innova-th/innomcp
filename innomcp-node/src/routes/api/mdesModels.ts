import { Router, Request, Response } from 'express';
import { mdesModelCache } from '../../services/mdesModelCache';

const router = Router();

// GET /api/mdes/models — รายการ MDES models ทั้งหมด
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = await mdesModelCache.getModels();
    res.json({ success: true, data: models });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ไม่สามารถดึงรายการ model ได้';
    res.status(500).json({ error: message });
  }
});

// GET /api/mdes/models/:name — ดึง model เฉพาะชื่อ
router.get('/models/:name', async (req: Request, res: Response) => {
  try {
    const model = await mdesModelCache.getModel(req.params.name);
    if (!model) {
      res.status(404).json({ error: `ไม่พบ model: ${req.params.name}` });
      return;
    }
    res.json({ success: true, data: model });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

// GET /api/mdes/best/:task — เลือก model ที่ดีที่สุดสำหรับงาน
// task: 'thai' | 'code' | 'reasoning' | 'fast'
router.get('/best/:task', async (req: Request, res: Response) => {
  const validTasks = ['thai', 'code', 'reasoning', 'fast'] as const;
  type Task = typeof validTasks[number];
  const task = req.params.task as Task;

  if (!validTasks.includes(task)) {
    res.status(400).json({ error: `task ต้องเป็น: ${validTasks.join(', ')}` });
    return;
  }

  try {
    const model = await mdesModelCache.getBestModelForTask(task);
    res.json({ success: true, model });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    res.status(500).json({ error: message });
  }
});

export default router;
