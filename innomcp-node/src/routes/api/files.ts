/**
 * routes/api/files.ts — Sandboxed File Tool API (Private Agent Studio)
 *
 * Provides read/write/append/list/delete operations strictly within WORKSPACE_ROOT.
 * Path traversal protection is enforced on every request.
 *
 * Mounted at: /api/files  (NOT /api/workspace — that path is the DB-backed workspace router)
 */

import { Router, Request, Response } from "express";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";

const router = Router();

// ---------------------------------------------------------------------------
// Sandbox root — resolved once at startup
// ---------------------------------------------------------------------------
export const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a user-supplied path inside WORKSPACE_ROOT.
 * Returns null if the resolved path escapes the sandbox (path traversal).
 */
export function safePath(userPath: string): string | null {
  // Strip leading slashes so path.resolve doesn't treat it as absolute
  const cleaned = userPath.replace(/^[/\\]+/, "");
  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);
  // Must start with WORKSPACE_ROOT + sep, or equal WORKSPACE_ROOT itself
  if (
    resolved !== WORKSPACE_ROOT &&
    !resolved.startsWith(WORKSPACE_ROOT + path.sep)
  ) {
    return null;
  }
  return resolved;
}

const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".so", ".bin",
];

function isSafeExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return !BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function detectType(ext: string): string {
  const code = ["js", "ts", "tsx", "jsx", "py", "json", "yaml", "yml", "toml", "css", "html", "xml"];
  if (ext === "md") return "markdown";
  if (code.includes(ext)) return "code";
  if (ext === "csv") return "csv";
  return "text";
}

// ---------------------------------------------------------------------------
// GET /api/files/list?path=projects/
// ---------------------------------------------------------------------------
router.get("/list", async (req: Request, res: Response) => {
  const userPath = String(req.query.path || "");
  const safe = safePath(userPath);
  if (!safe) return res.status(400).json({ error: "Invalid path" });

  try {
    if (!existsSync(safe)) return res.json({ files: [], root: userPath });
    const entries = await fsPromises.readdir(safe, { withFileTypes: true });
    const files = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
      path: path.join(userPath, e.name).replace(/\\/g, "/"),
    }));
    res.json({ files, root: userPath });
  } catch {
    res.status(500).json({ error: "Cannot list directory" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/files/read?path=projects/report.md
// ---------------------------------------------------------------------------
router.get("/read", async (req: Request, res: Response) => {
  const userPath = String(req.query.path || "");
  const safe = safePath(userPath);
  if (!safe) return res.status(400).json({ error: "Invalid path" });

  try {
    const content = await fsPromises.readFile(safe, "utf-8");
    const ext = path.extname(userPath).slice(1).toLowerCase();
    res.json({ content, path: userPath, type: detectType(ext), language: ext });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/files/write  { path, content }
// ---------------------------------------------------------------------------
router.post("/write", async (req: Request, res: Response) => {
  const { path: userPath, content } = req.body as {
    path: string;
    content: string;
  };
  if (!userPath || typeof content !== "string") {
    return res.status(400).json({ error: "path and content required" });
  }
  if (!isSafeExtension(userPath)) {
    return res.status(400).json({ error: "File type not allowed" });
  }
  const safe = safePath(userPath);
  if (!safe) return res.status(400).json({ error: "Invalid path" });

  try {
    await fsPromises.mkdir(path.dirname(safe), { recursive: true });
    await fsPromises.writeFile(safe, content, "utf-8");
    res.json({ success: true, path: userPath, size: content.length });
  } catch {
    res.status(500).json({ error: "Cannot write file" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/files/append  { path, content }
// ---------------------------------------------------------------------------
router.post("/append", async (req: Request, res: Response) => {
  const { path: userPath, content } = req.body as {
    path: string;
    content: string;
  };
  if (!userPath || typeof content !== "string") {
    return res.status(400).json({ error: "path and content required" });
  }
  if (!isSafeExtension(userPath)) {
    return res.status(400).json({ error: "File type not allowed" });
  }
  const safe = safePath(userPath);
  if (!safe) return res.status(400).json({ error: "Invalid path" });

  try {
    await fsPromises.mkdir(path.dirname(safe), { recursive: true });
    await fsPromises.appendFile(safe, content, "utf-8");
    const stat = await fsPromises.stat(safe);
    res.json({ success: true, path: userPath, size: stat.size });
  } catch {
    res.status(500).json({ error: "Cannot append to file" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/files/delete?path=projects/old.md
// ---------------------------------------------------------------------------
router.delete("/delete", async (req: Request, res: Response) => {
  const userPath = String(req.query.path || "");
  const safe = safePath(userPath);
  if (!safe) return res.status(400).json({ error: "Invalid path" });

  try {
    await fsPromises.unlink(safe);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Cannot delete file" });
  }
});

export default router;
