import * as path from 'path';
import * as fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArtifactInfo {
  name: string;
  mime: string;
  content: string; // stored as UTF-8 text (for binary use base64)
}

export interface SaveArtifactInput {
  name: string;
  mime: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT: string = process.env.WORKSPACE_ROOT || path.join(process.cwd(), 'workspace');

function artifactsDir(taskId: string): string {
  return path.join(WORKSPACE_ROOT, 'artifacts', sanitizeTaskId(taskId));
}

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

function sanitizeTaskId(id: string): string {
  // Remove path separators, relative components, and null bytes
  const sanitized = id.replace(/[\\/]/g, '_').replace(/\.\./g, '_').replace(/\0/g, '');
  if (!sanitized) throw new Error('Invalid taskId: empty after sanitization');
  return sanitized;
}

function sanitizeName(name: string): string {
  // Reject any component that could traverse directories
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) {
    throw new Error(`Invalid artifact name: "${name}"`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Helper: ensure directory exists
// ---------------------------------------------------------------------------

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save an artifact under the given taskId directory.
 *
 * @param taskId  identifier of the task (e.g., UUID)
 * @param input   artifact name, mime type, and content
 */
export async function saveArtifact(taskId: string, input: SaveArtifactInput): Promise<void> {
  sanitizeTaskId(taskId);
  const name = sanitizeName(input.name);

  const dir = artifactsDir(taskId);
  await ensureDir(dir);

  const filePath = path.join(dir, name);

  // Prevent directory traversal in case the sanitizer missed something
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir))) {
    throw new Error(`Resolved path outside artifact directory: "${resolved}"`);
  }

  // Write as UTF-8 (adjust for binary content if needed in the future)
  await fs.writeFile(filePath, input.content, 'utf-8');
}

/**
 * List all artifact names for a given task.
 *
 * @param taskId  identifier of the task
 * @returns       array of artifact names
 */
export async function listArtifacts(taskId: string): Promise<string[]> {
  sanitizeTaskId(taskId);
  const dir = artifactsDir(taskId);

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Retrieve an artifact’s metadata and content.
 *
 * @param taskId  identifier of the task
 * @param name    artifact name
 * @returns       ArtifactInfo (name, mime, content)
 * @throws        if the artifact does not exist
 */
export async function getArtifact(taskId: string, name: string): Promise<ArtifactInfo> {
  sanitizeTaskId(taskId);
  const safeName = sanitizeName(name);

  const dir = artifactsDir(taskId);
  const filePath = path.join(dir, safeName);

  // Resolve and check it stays inside the task's artifact directory
  const resolved = path.resolve(filePath);
  const expectedPrefix = path.resolve(dir);
  if (!resolved.startsWith(expectedPrefix)) {
    throw new Error(`Resolved path outside artifact directory: "${resolved}"`);
  }

  const content = await fs.readFile(filePath, 'utf-8');

  // MIME is not stored on the filesystem; we return a default for text
  // In a production system you would store metadata (e.g., in a side‑file or DB)
  return {
    name: safeName,
    mime: 'text/plain; charset=utf-8',
    content,
  };
}
