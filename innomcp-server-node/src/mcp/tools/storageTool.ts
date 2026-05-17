import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Workspace Storage Tool — read/write/list/delete files.
 *
 * Three location classes (auto-detected from filename/path):
 *
 *  1) Local sandbox (default): basename only — files land in
 *     `workspace-storage/` under repo root. Safe for untrusted input.
 *
 *  2) Network share (opt-in): full UNC paths like `\\server\share\file`
 *     or `smb://server/share/file`. Requires NAS_ALLOWED_PREFIXES env to
 *     contain a matching prefix (semicolon-separated, glob-like). Without
 *     allow-listing, network paths are rejected so a malicious prompt
 *     can't exfiltrate from arbitrary shares.
 *
 *  3) Absolute paths inside NAS_ROOT_DIR: opt-in mount point, e.g. a
 *     local drive letter mapped to a NAS share. Same allow-list rule.
 */

const STORAGE_ROOT = path.resolve(process.cwd(), "..", "workspace-storage");
const ALLOWED_PREFIXES = (process.env.NAS_ALLOWED_PREFIXES || "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
const NAS_ROOT_DIR = process.env.NAS_ROOT_DIR || "";

(async () => {
  try { await fs.mkdir(STORAGE_ROOT, { recursive: true }); } catch (err) {
    console.error("Failed to create storage directory:", err);
  }
})();

function isNetworkPath(p: string): boolean {
  return p.startsWith("\\\\") || /^smb:\/\//i.test(p) || /^nfs:\/\//i.test(p);
}

function normalizeSmbUrl(p: string): string {
  // smb://server/share/path → \\server\share\path  (Windows-friendly)
  if (/^smb:\/\//i.test(p)) {
    const stripped = p.replace(/^smb:\/\//i, "");
    return "\\\\" + stripped.replace(/\//g, "\\");
  }
  return p;
}

/** Returns { ok, resolved } or { ok: false, error } */
function resolveLocation(filename: string, op: "read" | "write" | "list" | "delete"): { ok: true; resolved: string; isNetwork: boolean } | { ok: false; error: string } {
  if (!filename) {
    if (op === "list") return { ok: true, resolved: STORAGE_ROOT, isNetwork: false };
    return { ok: false, error: "filename is required" };
  }

  // Network UNC / smb://
  if (isNetworkPath(filename)) {
    const norm = normalizeSmbUrl(filename);
    if (ALLOWED_PREFIXES.length === 0) {
      return { ok: false, error: "network paths disabled (set NAS_ALLOWED_PREFIXES env to enable)" };
    }
    const allowed = ALLOWED_PREFIXES.some((p) => norm.toLowerCase().startsWith(p.toLowerCase()));
    if (!allowed) {
      return { ok: false, error: `network path not in NAS_ALLOWED_PREFIXES (got ${norm})` };
    }
    return { ok: true, resolved: norm, isNetwork: true };
  }

  // Absolute path under NAS_ROOT_DIR (e.g. mounted drive letter)
  if (path.isAbsolute(filename)) {
    if (!NAS_ROOT_DIR) {
      return { ok: false, error: "absolute paths disabled (set NAS_ROOT_DIR env to enable a mount point)" };
    }
    const normRoot = path.resolve(NAS_ROOT_DIR);
    const norm = path.resolve(filename);
    if (!norm.toLowerCase().startsWith(normRoot.toLowerCase() + path.sep) && norm.toLowerCase() !== normRoot.toLowerCase()) {
      return { ok: false, error: `path outside NAS_ROOT_DIR (${normRoot})` };
    }
    return { ok: true, resolved: norm, isNetwork: true };
  }

  // Default — sandbox by basename
  const safeName = path.basename(filename);
  return { ok: true, resolved: path.join(STORAGE_ROOT, safeName), isNetwork: false };
}

export const storageTool = {
  name: "storageTool",
  description:
    "Read, write, list, and delete files. Local sandbox by default (workspace-storage/). " +
    "Network paths (UNC \\\\server\\share, smb://server/share) require NAS_ALLOWED_PREFIXES env. " +
    "Absolute paths require NAS_ROOT_DIR env. This protects against prompt-injection exfiltration.",
  inputSchema: z.object({
    operation: z.enum(["write", "read", "list", "delete"]).describe("Operation to perform"),
    filename: z.string().optional().describe("Filename (basename, UNC \\\\server\\share, or smb:// URL)"),
    content: z.string().optional().describe("Content to write (for write op)"),
    encoding: z.enum(["utf-8", "base64"]).optional().describe("Read/write encoding. Default: utf-8"),
  }),
  execute: async (args: any) => {
    const { operation, filename, content, encoding = "utf-8" } = args;
    try {
      const loc = resolveLocation(filename || "", operation as any);
      if (!loc.ok) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: loc.error }) }], isError: true };
      }
      const resolved = loc.resolved;

      if (operation === "list") {
        const target = filename ? resolved : STORAGE_ROOT;
        const entries = await fs.readdir(target, { withFileTypes: true });
        const payload = {
          success: true,
          dir: target,
          isNetwork: loc.isNetwork,
          entries: entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "dir" : "file",
          })),
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
      }

      if (operation === "write") {
        if (content === undefined) throw new Error("content is required for write");
        const buf = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf-8");
        await fs.writeFile(resolved, buf);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, path: resolved, bytes: buf.length, isNetwork: loc.isNetwork }) }] };
      }

      if (operation === "read") {
        const buf = await fs.readFile(resolved);
        const data = encoding === "base64" ? buf.toString("base64") : buf.toString("utf-8");
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, path: resolved, bytes: buf.length, encoding, data, isNetwork: loc.isNetwork }) }] };
      }

      if (operation === "delete") {
        await fs.unlink(resolved);
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, path: resolved, deleted: true, isNetwork: loc.isNetwork }) }] };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "invalid operation" }) }], isError: true };
    } catch (error: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  },
};

export function registerStorageTool(server: McpServer) {
  server.registerTool(
    storageTool.name,
    {
      title: "Workspace Storage + NAS — read/write/list/delete with network support",
      description: storageTool.description,
      inputSchema: storageTool.inputSchema as any,
    },
    storageTool.execute,
  );
}
