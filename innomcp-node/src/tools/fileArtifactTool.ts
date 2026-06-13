/**
 * Tool that writes a text/markdown/csv artifact file into the workspace directory.
 *
 * Usage examples:
 *
 * ```ts
 * // Write a markdown report
 * const result = await fileArtifactTool.run(
 *   { name: "report.md", mime: "text/markdown", content: "# Title\n\nContent" },
 *   {}
 * );
 * // result.ok === true, result.artifacts[0].name === "report.md"
 *
 * // Write a CSV (traversal attack prevented)
 * const result2 = await fileArtifactTool.run(
 *   { name: "../../etc/passwd", content: "bad" },
 *   {}
 * );
 * // result2.ok === false, result2.error describes the path traversal rejection
 * ```
 */

import fs from 'fs/promises';
import path from 'path';
import { Tool } from '../types/tool';

/**
 * Sanitize a filename: remove path separators, null bytes, and dangerous characters.
 * Returns a safe string that cannot escape the intended directory.
 */
function sanitizeFilename(raw: string): string {
  // Replace all path separators and null byte
  let safe = raw.replace(/[/\\\0]/g, '_');
  // Remove any '..' sequences that could attempt traversal
  safe = safe.replace(/\.\.+/g, '_');
  // Collapse multiple underscores
  safe = safe.replace(/_+/g, '_');
  // Trim leading/trailing underscores and dots
  safe = safe.replace(/^[_.]+/, '').replace(/[_.]+$/, '');
  // If after sanitization the name is empty, use a fallback
  if (!safe) {
    safe = 'artifact';
  }
  return safe;
}

const fileArtifactTool: Tool = {
  name: 'file_artifact',
  description: 'Writes a text file (markdown, CSV, plain text) as an artifact into the workspace directory. Input requires a `name` (filename), `mime` (optional, defaults to text/plain), and `content` (string). The file is saved safely inside the workspace root.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Desired filename (will be sanitized)' },
      mime: { type: 'string', description: 'MIME type of the file (default: text/plain)' },
      content: { type: 'string', description: 'File content as a string' }
    },
    required: ['name', 'content']
  },

  async run(input: any, ctx: { signal?: AbortSignal }): Promise<{ ok: boolean; output?: any; error?: string; artifacts?: {name:string,mime:string,content:string}[] }> {
    try {
      // Validate and extract input
      if (!input || typeof input !== 'object') {
        return { ok: false, error: 'Input must be an object with name and content properties.' };
      }

      const rawName = input.name;
      const content = input.content;
      const mime = input.mime || 'text/plain';

      if (typeof rawName !== 'string' || typeof content !== 'string') {
        return { ok: false, error: 'Both name and content must be strings.' };
      }

      // Sanitize filename to prevent path traversal
      const safeName = sanitizeFilename(rawName);
      if (!safeName) {
        return { ok: false, error: 'Invalid filename after sanitization.' };
      }

      // Resolve workspace root (use environment variable or default)
      const workspaceRoot = process.env.WORKSPACE_ROOT || path.join(process.cwd(), 'workspace');

      // Ensure workspace directory exists
      await fs.mkdir(workspaceRoot, { recursive: true });

      // Resolve the full path safely
      const fullPath = path.resolve(workspaceRoot, safeName);

      // Verify the resolved path is within workspace root (no traversal)
      if (!fullPath.startsWith(path.resolve(workspaceRoot))) {
        return { ok: false, error: 'Path traversal attempt detected.' };
      }

      // Write the file
      await fs.writeFile(fullPath, content, 'utf-8');

      // Return success with artifact metadata
      return {
        ok: true,
        output: {
          writtenPath: fullPath,
          workspaceRoot,
          filename: safeName,
          mime
        },
        artifacts: [{
          name: safeName,
          mime,
          content
        }]
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || 'Unknown error writing artifact file.'
      };
    }
  }
};

export default fileArtifactTool;
