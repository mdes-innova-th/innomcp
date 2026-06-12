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

type PinnedArtifactRecord = {
  id: string;
  path: string;
  pinnedAt: string;
};

// ---------------------------------------------------------------------------
// Sandbox root — resolved once at startup
// ---------------------------------------------------------------------------
export const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(process.cwd(), "../workspace");

const PINNED_ARTIFACTS_PATH = path.join(
  WORKSPACE_ROOT,
  ".metadata",
  "pinned-artifacts.json"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a user-supplied path inside WORKSPACE_ROOT.
 * Returns null if the resolved path escapes the sandbox (path traversal).
 */
export function safePath(userPath: string): string | null {
  // Normalize Windows backslashes to forward slashes first (Linux treats \ as literal)
  const normalized = userPath.replace(/\\/g, "/");
  // Strip leading slashes so path.resolve doesn't treat it as absolute
  const cleaned = normalized.replace(/^[/]+/, "");
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
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".dll",
  ".so",
  ".bin",
];

function isSafeExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return !BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function detectType(ext: string): string {
  const code = [
    "js",
    "ts",
    "tsx",
    "jsx",
    "py",
    "json",
    "yaml",
    "yml",
    "toml",
    "css",
    "html",
    "xml",
  ];
  if (ext === "md") return "markdown";
  if (code.includes(ext)) return "code";
  if (ext === "csv") return "csv";
  return "text";
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function artifactIdFromPath(filePath: string): string {
  return Buffer.from(normalizeRelativePath(filePath), "utf-8").toString("base64url");
}

function artifactPathFromId(id: string): string | null {
  try {
    return normalizeRelativePath(Buffer.from(id, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function inferTaskIdFromPath(filePath: string): string | undefined {
  const normalized = normalizeRelativePath(filePath);
  const match = normalized.match(/(?:^|\/)(?:task-|tasks\/)?([0-9a-f]{8}-[0-9a-f-]{27,}|task-[A-Za-z0-9_-]+)/i);
  if (match) return match[1];
  return undefined;
}

async function readPinnedStore(): Promise<PinnedArtifactRecord[]> {
  try {
    const content = await fsPromises.readFile(PINNED_ARTIFACTS_PATH, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed)
      ? parsed.filter(
          (record): record is PinnedArtifactRecord =>
            !!record &&
            typeof record.id === "string" &&
            typeof record.path === "string" &&
            typeof record.pinnedAt === "string"
        )
      : [];
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    return [];
  }
}

async function writePinnedStore(records: PinnedArtifactRecord[]): Promise<void> {
  await fsPromises.mkdir(path.dirname(PINNED_ARTIFACTS_PATH), { recursive: true });
  await fsPromises.writeFile(
    PINNED_ARTIFACTS_PATH,
    `${JSON.stringify(records, null, 2)}\n`,
    "utf-8"
  );
}

async function listDirectoryEntries(userPath: string) {
  const safe = safePath(userPath);
  if (!safe) return null;
  if (!existsSync(safe)) return [];

  const entries = await fsPromises.readdir(safe, { withFileTypes: true });
  return entries.map((entry) => {
    const relativePath = normalizeRelativePath(path.join(userPath, entry.name));
    return {
      id: artifactIdFromPath(relativePath),
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      path: relativePath,
    };
  });
}

async function collectPinnedArtifacts(limit?: number) {
  const records = await readPinnedStore();
  const items = await Promise.all(
    records.map(async (record) => {
      const safe = safePath(record.path);
      if (!safe || !existsSync(safe)) return null;

      const stat = await fsPromises.stat(safe);
      if (!stat.isFile()) return null;

      const ext = path.extname(record.path).slice(1).toLowerCase();
      return {
        id: record.id,
        name: path.basename(record.path),
        path: normalizeRelativePath(record.path),
        type: detectType(ext || "txt"),
        taskId: inferTaskIdFromPath(record.path),
        pinnedAt: record.pinnedAt,
      };
    })
  );

  const filtered = items
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.pinnedAt.localeCompare(a.pinnedAt));

  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}

// ---------------------------------------------------------------------------
// GET /api/files?pinned=true&limit=6
// GET /api/files?path=projects/
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response) => {
  if (String(req.query.pinned || "").toLowerCase() === "true") {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;

    try {
      const files = await collectPinnedArtifacts(limit);
      return res.json({ files });
    } catch {
      return res.status(500).json({ error: "Cannot load pinned artifacts" });
    }
  }

  const userPath = String(req.query.path || "");
  const files = await listDirectoryEntries(userPath);
  if (files === null) return res.status(400).json({ error: "Invalid path" });
  return res.json({ files, root: userPath });
});

// ---------------------------------------------------------------------------
// GET /api/files/list?path=projects/
// ---------------------------------------------------------------------------
router.get("/list", async (req: Request, res: Response) => {
  const userPath = String(req.query.path || "");
  const files = await listDirectoryEntries(userPath);
  if (files === null) return res.status(400).json({ error: "Invalid path" });
  res.json({ files, root: userPath });
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
// PATCH /api/files/:id/pin  { pinned: boolean, path?: string }
// ---------------------------------------------------------------------------
router.patch("/:id/pin", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pinned, path: requestedPath } = req.body as {
    pinned: boolean;
    path?: string;
  };

  if (typeof pinned !== "boolean") {
    return res.status(400).json({ error: "pinned (boolean) is required" });
  }

  const resolvedPath = requestedPath
    ? normalizeRelativePath(requestedPath)
    : artifactPathFromId(id);
  if (!resolvedPath) {
    return res.status(400).json({ error: "path is required when id is not decodable" });
  }

  const safe = safePath(resolvedPath);
  if (!safe) return res.status(400).json({ error: "Invalid path" });
  if (!existsSync(safe)) return res.status(404).json({ error: "File not found" });

  try {
    const records = await readPinnedStore();
    const nextRecords = records.filter((record) => record.id !== id);
    if (pinned) {
      nextRecords.push({
        id,
        path: resolvedPath,
        pinnedAt: new Date().toISOString(),
      });
    }
    await writePinnedStore(nextRecords);
    return res.json({ id, path: resolvedPath, pinned });
  } catch {
    return res.status(500).json({ error: "Failed to update pin state" });
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
    const normalizedPath = normalizeRelativePath(userPath);
    const artifactId = artifactIdFromPath(normalizedPath);
    const records = await readPinnedStore();
    await writePinnedStore(records.filter((record) => record.id !== artifactId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Cannot delete file" });
  }
});

export default router;
