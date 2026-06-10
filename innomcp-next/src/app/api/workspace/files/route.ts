// app/api/workspace/files/route.ts
import { type NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";

const BASE_PATH = path.join(process.cwd(), "workspace-storage");
const ALLOWED_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".py",
  ".js",
  ".ts",
  ".html",
  ".pdf",
  ".png",
  ".jpg",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

function getSafePath(relativePath: string): string | null {
  if (relativePath.includes("\0")) return null;
  // Normalise to handle different separators and remove '..' / '.' safely
  const resolved = path.resolve(BASE_PATH, relativePath);
  const normalised = path.normalize(resolved);

  // Must be inside BASE_PATH or exactly equal to BASE_PATH
  if (
    normalised.startsWith(BASE_PATH + path.sep) ||
    normalised === BASE_PATH
  ) {
    return normalised;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let relPath = url.searchParams.get("path")?.trim() || "/";
    // Normalise the input to avoid trailing/leading issues
    relPath = path.join("/", relPath);
    const safePath = getSafePath(relPath);
    if (!safePath) {
      return new Response(JSON.stringify({ error: "เส้นทางไม่ถูกต้อง" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Check existence
    try {
      await fs.access(safePath);
    } catch {
      return new Response(JSON.stringify({ error: "ไม่พบไฟล์หรือโฟลเดอร์" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const stat = await fs.stat(safePath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(safePath, { withFileTypes: true });
      const list = [];
      for (const entry of entries) {
        const fullEntryPath = path.join(safePath, entry.name);
        if (entry.isDirectory()) {
          list.push({
            name: entry.name,
            type: "directory",
          });
        } else if (entry.isFile()) {
          const ext = getExtension(entry.name);
          if (ALLOWED_EXTENSIONS.includes(ext)) {
            const fileStat = await fs.stat(fullEntryPath);
            list.push({
              name: entry.name,
              type: "file",
              size: fileStat.size,
              modified: fileStat.mtime.toISOString(),
            });
          }
        }
      }
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    } else {
      // It's a file, return single file info
      const ext = getExtension(safePath);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return new Response(
          JSON.stringify({ error: "ประเภทไฟล์ไม่ได้รับอนุญาต" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          name: path.basename(safePath),
          type: "file",
          size: stat.size,
          modified: stat.mtime.toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
  } catch (error) {
    console.error("GET /api/workspace/files error:", error);
    return new Response(
      JSON.stringify({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.path !== "string" || typeof body.content !== "string") {
      return new Response(
        JSON.stringify({ error: "ต้องระบุ path และ content" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const { path: relPath, content, encoding = "utf8" } = body;
    const safeRelPath = path.join("/", relPath);
    const safePath = getSafePath(safeRelPath);

    if (!safePath) {
      return new Response(JSON.stringify({ error: "เส้นทางไม่ถูกต้อง" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const ext = getExtension(safePath);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return new Response(
        JSON.stringify({ error: "ประเภทไฟล์ไม่ได้รับอนุญาต" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Check file size before writing
    const size = Buffer.byteLength(content, encoding as BufferEncoding);
    if (size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "ขนาดไฟล์เกิน 10 MB" }),
        {
          status: 413,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Ensure parent directory exists
    const dir = path.dirname(safePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(safePath, content, encoding as BufferEncoding);

    return new Response(
      JSON.stringify({ success: true, message: "สร้าง/เขียนไฟล์สำเร็จ" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  } catch (error) {
    console.error("POST /api/workspace/files error:", error);
    return new Response(
      JSON.stringify({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const relPath = url.searchParams.get("path")?.trim();
    if (!relPath) {
      return new Response(
        JSON.stringify({ error: "ต้องระบุ query parameter: path" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const safeRelPath = path.join("/", relPath);
    const safePath = getSafePath(safeRelPath);
    if (!safePath) {
      return new Response(JSON.stringify({ error: "เส้นทางไม่ถูกต้อง" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const ext = getExtension(safePath);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return new Response(
        JSON.stringify({ error: "ประเภทไฟล์ไม่ได้รับอนุญาต" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Check if file exists
    try {
      await fs.access(safePath);
    } catch {
      return new Response(JSON.stringify({ error: "ไม่พบไฟล์" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Only delete if it's a file (not directory)
    const stat = await fs.stat(safePath);
    if (!stat.isFile()) {
      return new Response(
        JSON.stringify({ error: "สามารถลบได้เฉพาะไฟล์" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    await fs.unlink(safePath);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("DELETE /api/workspace/files error:", error);
    return new Response(
      JSON.stringify({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}