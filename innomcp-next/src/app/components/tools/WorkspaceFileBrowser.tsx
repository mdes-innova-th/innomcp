"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: "file" | "dir";
}

interface PreviewState {
  path: string;
  content: string | null;
  error: string | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the backend base URL. In dev (Next on :3000) the API runs on :3011. */
function backendBase(): string {
  if (typeof window !== "undefined" && window.location.port === "3000") {
    return "http://localhost:3011";
  }
  return "";
}

/** File-extension → emoji icon. */
function fileIcon(name: string, type: "file" | "dir"): string {
  if (type === "dir") return "📁";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "md":
      return "📝";
    case "csv":
      return "📊";
    case "svg":
      return "📈";
    case "json":
      return "🔧";
    case "txt":
      return "📄";
    case "zip":
      return "📦";
    default:
      return "📁";
  }
}

/** Format bytes into human-readable KB/MB string. */
function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Relative time string ("5 minutes ago", "3 days ago"). */
function relativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

interface TreeNode {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: "file" | "dir";
  children: TreeNode[];
}

function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const byPath: Record<string, TreeNode> = {};

  // Sort so dirs come first, then files, both alphabetically
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const f of sorted) {
    const node: TreeNode = { ...f, children: [] };
    byPath[f.path] = node;
    const parts = f.path.split("/");
    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      if (byPath[parentPath]) {
        byPath[parentPath].children.push(node);
      } else {
        // Parent wasn't in the list (shouldn't happen) — attach to root
        root.push(node);
      }
    }
  }

  return root;
}

// ---------------------------------------------------------------------------
// FileRow — single row in the tree
// ---------------------------------------------------------------------------

interface FileRowProps {
  node: TreeNode;
  depth: number;
  onClickFile: (path: string) => void;
}

function FileRow({ node, depth, onClickFile }: FileRowProps) {
  const [open, setOpen] = useState(false);
  const isDir = node.type === "dir";

  const handleClick = () => {
    if (isDir) {
      setOpen((o) => !o);
    } else {
      onClickFile(node.path);
    }
  };

  return (
    <>
      <div
        role={isDir ? "button" : "button"}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        className={[
          "flex items-center gap-1.5 px-3 py-[3px] text-[11px] leading-5 cursor-pointer select-none",
          "hover:bg-white/5 transition-colors",
          isDir ? "text-[#9ca3af]" : "text-[#d4d4d4]",
        ].join(" ")}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        {/* Expand toggle for dirs */}
        {isDir && (
          <span className="text-[9px] text-[#4b5563] w-3 shrink-0">
            {open ? "▾" : "▸"}
          </span>
        )}
        {!isDir && <span className="w-3 shrink-0" />}

        {/* Icon */}
        <span className="text-[12px] shrink-0">{fileIcon(node.name, node.type)}</span>

        {/* Name */}
        <span className="flex-1 truncate font-mono">{node.name}</span>

        {/* Meta — only for files */}
        {!isDir && (
          <span className="text-[#4b5563] text-[10px] shrink-0 tabular-nums">
            {formatSize(node.size)}
          </span>
        )}
        {!isDir && (
          <span className="text-[#4b5563] text-[10px] shrink-0 ml-2">
            {relativeTime(node.mtime)}
          </span>
        )}
      </div>

      {/* Children (only when dir is open) */}
      {isDir && open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileRow
              key={child.path}
              node={child}
              depth={depth + 1}
              onClickFile={onClickFile}
            />
          ))}
        </div>
      )}

      {isDir && open && node.children.length === 0 && (
        <div
          className="text-[10px] text-[#4b5563] italic"
          style={{ paddingLeft: `${12 + (depth + 1) * 14 + 16}px`, paddingTop: 2, paddingBottom: 2 }}
        >
          ว่างเปล่า
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Preview popup
// ---------------------------------------------------------------------------

interface PreviewPopupProps {
  preview: PreviewState;
  onClose: () => void;
}

function PreviewPopup({ preview, onClose }: PreviewPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-2xl mx-4 rounded-lg border border-white/10 bg-[#141414] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#111111] px-4 py-2 border-b border-white/10">
          <span className="text-[11px] font-mono text-[#9ca3af] truncate flex-1">
            {preview.path}
          </span>
          <button
            onClick={onClose}
            className="ml-3 text-[#4b5563] hover:text-[#9ca3af] text-xs shrink-0 transition-colors"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="bg-[#1a1a1a] max-h-[60vh] overflow-y-auto">
          {preview.loading && (
            <div className="px-4 py-6 text-[#4b5563] text-[12px] italic text-center">
              กำลังโหลด…
            </div>
          )}
          {preview.error && !preview.loading && (
            <div className="px-4 py-6 text-[#f87171] text-[12px] italic text-center">
              {preview.error}
            </div>
          )}
          {preview.content !== null && !preview.loading && (
            <pre className="px-4 py-3 text-[11px] text-[#d4d4d4] font-mono whitespace-pre-wrap break-words leading-relaxed">
              {preview.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WorkspaceFileBrowser() {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendBase()}/api/workspace/files`);
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data: { files: WorkspaceFile[] } = await res.json();
      setFiles(data.files ?? []);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleClickFile = useCallback(async (filePath: string) => {
    setPreview({ path: filePath, content: null, error: null, loading: true });
    try {
      const res = await fetch(
        `${backendBase()}/api/workspace/files/${filePath.split("/").map(encodeURIComponent).join("/")}`
      );
      if (!res.ok) {
        if (res.status === 413) {
          setPreview({ path: filePath, content: null, error: "ไฟล์ใหญ่เกินไปสำหรับ preview (>512 KB)", loading: false });
          return;
        }
        const text = await res.text().catch(() => res.statusText);
        setPreview({ path: filePath, content: null, error: text || `HTTP ${res.status}`, loading: false });
        return;
      }
      const data: { content: string } = await res.json();
      setPreview({ path: filePath, content: data.content, error: null, loading: false });
    } catch (err: unknown) {
      setPreview({
        path: filePath,
        content: null,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  }, []);

  const tree = buildTree(files);

  return (
    <>
      <div className="rounded-lg border border-border/40 overflow-hidden text-[12px]">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-[#111111] px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[#6b7280] text-[10px]">📂</span>
            <span className="text-[#9ca3af] font-mono text-[11px]">workspace files</span>
            {!loading && !error && (
              <span className="text-[10px] text-[#4b5563]">
                ({files.length} items)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && !loading && (
              <span className="text-[10px] text-[#4b5563]">
                {relativeTime(lastRefresh.toISOString())}
              </span>
            )}
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="rounded px-2 py-0.5 text-[10px] bg-[#1f2937] text-[#9ca3af] hover:bg-[#374151] disabled:opacity-40 transition-colors"
              aria-label="Refresh file list"
            >
              {loading ? "…" : "↻"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="bg-[#1a1a1a] max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-5 text-[#4b5563] italic text-center text-[11px]">
              กำลังโหลดไฟล์…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-5 text-[#f87171] italic text-center text-[11px]">
              ไม่สามารถโหลดไฟล์ได้: {error}
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="px-4 py-5 text-[#4b5563] italic text-center text-[11px]">
              workspace ว่างเปล่า — agent จะสร้างไฟล์ที่นี่เมื่อทำงาน
            </div>
          )}

          {!loading && !error && tree.length > 0 && (
            <div className="py-1">
              {tree.map((node) => (
                <FileRow
                  key={node.path}
                  node={node}
                  depth={0}
                  onClickFile={handleClickFile}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview popup */}
      {preview && (
        <PreviewPopup preview={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
