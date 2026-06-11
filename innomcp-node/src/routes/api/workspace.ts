import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import { workspaceService } from '../../services/workspaceService';

/**
 * Interface สำหรับ body ของ POST /files
 */
interface WriteFileRequestBody {
  sessionId?: string;
  path?: string;
  content?: string;
}

/**
 * Interface สำหรับ body ของ DELETE /files
 */
interface DeleteFileRequestBody {
  sessionId?: string;
  path?: string;
}

/**
 * Interface สำหรับ query params ของ GET /files และ /stats
 */
interface FilesQueryParams {
  path?: string;
  sessionId?: string;
}

const router = Router();

// ──────────────────────────────────────────────
// Multer setup สำหรับอัปโหลดไฟล์
// ──────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // สามารถเพิ่มข้อจำกัดประเภทไฟล์ได้ตามต้องการ
    cb(null, true);
  },
});

// ──────────────────────────────────────────────
// ฟังก์ชันช่วยเหลือ (Helpers)
// ──────────────────────────────────────────────

/**
 * ดึง sessionId จาก query parameter หรือ JWT token
 */
function getSessionId(req: Request): string | null {
  // 1. จาก query
  if (req.query.sessionId && typeof req.query.sessionId === 'string') {
    return req.query.sessionId;
  }

  // 2. จาก JWT ใน header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'innomcp-secret';
      const decoded = jwt.verify(token, secret) as { sessionId?: string };
      return decoded.sessionId || null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * ป้องกัน path traversal
 * อนุญาตเฉพาะ path ที่อยู่ภายใต้ /workspace/{sessionId} และไม่มี .. หรือ \0
 */
function isPathTraversalSafe(inputPath: string): boolean {
  if (!inputPath || inputPath.includes('\0') || inputPath.includes('..')) {
    return false;
  }

  const normalized = path.normalize(inputPath);
  // path ต้องไม่ขึ้นต้นด้วย / (root) เพื่อป้องกันการกระโดดออกจาก working dir
  if (normalized.startsWith('/') || normalized.startsWith('\\')) {
    return false;
  }

  // ห้ามเป็น absolute path
  if (path.isAbsolute(normalized)) {
    return false;
  }

  return true;
}

/**
 * ส่ง response สำเร็จ
 */
function sendSuccess(res: Response, data?: unknown, message: string = 'ดำเนินการสำเร็จ') {
  res.json({
    success: true,
    data,
    message,
  });
}

/**
 * ส่ง response ข้อผิดพลาด
 */
function sendError(res: Response, statusCode: number, error: string, message?: string) {
  res.status(statusCode).json({
    success: false,
    error,
    message: message || 'เกิดข้อผิดพลาด',
  });
}

// ──────────────────────────────────────────────
// 1. GET /api/workspace/files
// ──────────────────────────────────────────────
router.get('/files', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendError(res, 401, 'SESSION_MISSING', 'ไม่พบเซสชัน กรุณาระบุ sessionId');
    }

    const dirPath = (req.query.path as string) || '/';
    if (!isPathTraversalSafe(dirPath)) {
      return sendError(res, 400, 'INVALID_PATH', 'เส้นทางไม่ถูกต้องหรือไม่ปลอดภัย');
    }

    const files = await workspaceService.listFiles(sessionId, dirPath);
    sendSuccess(res, files, 'แสดงรายการไฟล์สำเร็จ');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์';
    sendError(res, 500, 'INTERNAL_ERROR', message);
  }
});

// ──────────────────────────────────────────────
// 2. POST /api/workspace/files (สร้าง/เขียนไฟล์)
// ──────────────────────────────────────────────
router.post('/files', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendError(res, 401, 'SESSION_MISSING', 'ไม่พบเซสชัน กรุณาระบุ sessionId');
    }

    const { path: filePath, content } = req.body as WriteFileRequestBody;
    if (!filePath || typeof filePath !== 'string') {
      return sendError(res, 400, 'PATH_REQUIRED', 'กรุณาระบุเส้นทางของไฟล์');
    }

    if (content === undefined || content === null) {
      return sendError(res, 400, 'CONTENT_REQUIRED', 'กรุณาระบุเนื้อหาของไฟล์');
    }

    if (!isPathTraversalSafe(filePath)) {
      return sendError(res, 400, 'INVALID_PATH', 'เส้นทางไม่ถูกต้องหรือไม่ปลอดภัย');
    }

    // ตรวจสอบขนาดเนื้อหา (string) ไม่เกิน 10MB
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > 10 * 1024 * 1024) {
      return sendError(res, 413, 'CONTENT_TOO_LARGE', 'ขนาดเนื้อหาของไฟล์เกิน 10MB');
    }

    await workspaceService.writeFile(sessionId, filePath, content);
    sendSuccess(res, { path: filePath }, 'บันทึกไฟล์สำเร็จ');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเขียนไฟล์';
    sendError(res, 500, 'WRITE_FILE_ERROR', message);
  }
});

// ──────────────────────────────────────────────
// 3. DELETE /api/workspace/files (ลบไฟล์)
// ──────────────────────────────────────────────
router.delete('/files', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendError(res, 401, 'SESSION_MISSING', 'ไม่พบเซสชัน กรุณาระบุ sessionId');
    }

    const { path: filePath } = req.body as DeleteFileRequestBody;
    if (!filePath || typeof filePath !== 'string') {
      return sendError(res, 400, 'PATH_REQUIRED', 'กรุณาระบุเส้นทางของไฟล์ที่ต้องการลบ');
    }

    if (!isPathTraversalSafe(filePath)) {
      return sendError(res, 400, 'INVALID_PATH', 'เส้นทางไม่ถูกต้องหรือไม่ปลอดภัย');
    }

    await workspaceService.deleteFile(sessionId, filePath);
    sendSuccess(res, { path: filePath }, 'ลบไฟล์สำเร็จ');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบไฟล์';
    sendError(res, 500, 'DELETE_FILE_ERROR', message);
  }
});

// ──────────────────────────────────────────────
// 4. GET /api/workspace/stats
// ──────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendError(res, 401, 'SESSION_MISSING', 'ไม่พบเซสชัน กรุณาระบุ sessionId');
    }

    const stats = await workspaceService.getStats(sessionId);
    sendSuccess(res, stats, 'ข้อมูลสถิติการใช้งาน');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ไม่สามารถดึงสถิติได้';
    sendError(res, 500, 'STATS_ERROR', message);
  }
});

// ──────────────────────────────────────────────
// 5. POST /api/workspace/upload
// ──────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return sendError(res, 401, 'SESSION_MISSING', 'ไม่พบเซสชัน กรุณาระบุ sessionId');
    }

    const file = req.file;
    if (!file) {
      return sendError(res, 400, 'FILE_REQUIRED', 'กรุณาแนบไฟล์มาด้วย');
    }

    // targetPath จาก form field (ถ้าไม่ระบุให้ใช้ชื่อไฟล์เดิม)
    let targetPath = req.body.path || file.originalname;
    if (typeof targetPath !== 'string') {
      targetPath = file.originalname;
    }

    if (!isPathTraversalSafe(targetPath)) {
      return sendError(res, 400, 'INVALID_PATH', 'เส้นทางปลายทางไม่ถูกต้องหรือไม่ปลอดภัย');
    }

    // ส่ง buffer ไปให้ service จัดการ
    await workspaceService.writeFile(
      sessionId,
      targetPath,
      file.buffer.toString('utf8'),
    );

    sendSuccess(res, { path: targetPath }, 'อัปโหลดไฟล์สำเร็จ');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปโหลด';
    sendError(res, 500, 'UPLOAD_ERROR', message);
  }
});

export default router;