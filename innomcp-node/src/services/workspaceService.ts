```typescript
import { promises as fs } from 'fs';
import path from 'path';

// ฟังก์ชันช่วยหาค่า MIME type จากนามสกุลไฟล์ (ใช้สำหรับฟีเจอร์ UI, ส่วนของ backend ไม่บังคับ)
function getMimeType(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.md': 'text/markdown',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.jsx': 'application/javascript',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
  };
  return map[ext];
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string; // ISO 8601 date string
  mimeType?: string;
}

class WorkspaceService {
  private basePath: string;

  constructor() {
    this.basePath = path.join(process.cwd(), 'workspace-storage');
  }

  /**
   * ตรวจสอบและสร้าง base directory ถ้ายังไม่มี
   */
  private async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * ป้องกัน path traversal และ normalize path ให้ปลอดภัย
   * @param sessionId รหัสเซสชัน
   * @param inputPath path ที่ผู้ใช้ระบุ
   * @returns absolute path ที่ผ่านการตรวจสอบแล้ว
   * @throws {Error} หากพบการพยายามออกนอกไดเรกทอรีของเซสชัน
   */
  private sanitizePath(sessionId: string, inputPath: string): string {
    const root = path.resolve(this.basePath, sessionId);
    // ป้องกันกรณีที่ sessionId อาจมี ../ หรืออันตรายอื่น ๆ
    const fullPath = path.resolve(root, inputPath);
    if (!fullPath.startsWith(root)) {
      throw new Error('พบการพยายามเข้าถึงไดเรกทอรีภายนอก (path traversal)');
    }
    return fullPath;
  }

  /**
   * แสดงรายการไฟล์และโฟลเดอร์ภายใน Workspace ของเซสชัน
   * @param sessionId รหัสเซสชัน
   * @param subPath path ย่อยภายในเซสชัน (ถ้าไม่ระบุใช้ root)
   * @returns รายการของ WorkspaceFile
   */
  async listFiles(sessionId: string, subPath?: string): Promise<WorkspaceFile[]> {
    await this.ensureBaseDir();
    const dirPath = this.sanitizePath(sessionId, subPath || '.');
    try {
      await fs.access(dirPath);
    } catch {
      return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const rootPath = path.resolve(this.basePath, sessionId);
    const files: WorkspaceFile[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(fullPath);
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/'); // normalize to forward slash
      files.push({
        name: entry.name,
        path: relativePath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        mimeType: entry.isFile() ? getMimeType(entry.name) : undefined,
      });
    }
    return files;
  }

  /**
   * อ่านเนื้อหาไฟล์เป็น string (ใช้ UTF-8)
   * @param sessionId รหัสเซสชัน
   * @param filePath path ของไฟล์ภายในเซสชัน
   * @returns เนื้อหาและ encoding
   */
  async readFile(sessionId: string, filePath: string): Promise<{ content: string; encoding: string }> {
    const fullPath = this.sanitizePath(sessionId, filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    return { content, encoding: 'utf8' };
  }

  /**
   * เขียนไฟล์ (สร้างไดเรกทอรีให้อัตโนมัติถ้ายังไม่มี)
   * @param sessionId รหัสเซสชัน
   * @param filePath path ของไฟล์
   * @param content เนื้อหา (string)
   */
  async writeFile(sessionId: string, filePath: string, content: string): Promise<void> {
    const fullPath = this.sanitizePath(sessionId, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  /**
   * ลบไฟล์หรือไดเรกทอรี (รีเคอร์ซีฟสำหรับไดเรกทอรี)
   * @param sessionId รหัสเซสชัน
   * @param filePath path ของไฟล์/ไดเรกทอรี
   */
  async deleteFile(sessionId: string, filePath: string): Promise<void> {
    const fullPath = this.sanitizePath(sessionId, filePath);
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return; // ไฟล์หรือไดเรกทอรีถูกลบไปแล้ว
      }
      throw err;
    }
  }

  /**
   * สร้างไดเรกทอรี (รวม parent directories ด้วย)
   * @param sessionId รหัสเซสชัน
   * @param dirPath path ของไดเรกทอรี
   */
  async createDir(sessionId: string, dirPath: string): Promise<void> {
    const fullPath = this.sanitizePath(sessionId, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  /**
   * หาขนาดและจำนวนไฟล์ทั้งหมดในเซสชัน
   * @param sessionId รหัสเซสชัน
   * @returns สถิติ { totalFiles, totalSize }
   */
  async getStats(sessionId: string): Promise<{ totalFiles: number; totalSize: number }> {
    const rootPath = this.sanitizePath(sessionId, '.');
    let totalFiles = 0;
    let totalSize = 0;

    async function walk(dir: string): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          totalFiles++;
          try {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          } catch {}
        }
      }
    }

    await walk(rootPath);
    return { totalFiles, totalSize };
  }

  /**
   * ล้างเซสชันเก่าที่ไม่ได้แก้ไขนานเกิน maxAgeMs
   * @param maxAgeMs อายุสูงสุด (ms) นับจากแก้ไขล่าสุด
   * @returns จำนวนเซสชันที่ถูกลบ
   */
  async cleanupOldSessions(maxAgeMs: number): Promise<number> {
    await this.ensureBaseDir();
    let cleanedCount = 0;
    const now = Date.now();
    let dirs;
    try {
      dirs = await fs.readdir(this.basePath, { withFileTypes: true });
    } catch {
      return 0;
    }

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const dirPath = path.join(this.basePath, dir.name);
      try {
        const stats = await fs.stat(dirPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.rm(dirPath, { recursive: true, force: true });
          cleanedCount++;
        }
      } catch {
        // ข้ามกรณีที่เกิดข้อผิดพลาดในการอ่าน/ลบ
      }
    }
    return cleanedCount;
  }
}

// สร้าง instance แบบ singleton สำหรับใช้งานทั้งแอป
export const workspaceService = new WorkspaceService();
```