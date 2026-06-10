"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  DragEvent,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceFile {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string; // ISO date string
  mimeType?: string;
}

export interface Artifact {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  mimeType?: string;
}

export interface WorkspaceFileBrowserProps {
  /** Current browsing path – used as initial if not controlled externally */
  currentPath?: string;
  /** Called when a file is selected (single click / tap) */
  onFileSelect?: (file: WorkspaceFile) => void;
  /** Called when "download" is triggered (context menu or button) */
  onFileDownload?: (file: WorkspaceFile) => void;
  /** Optional artefacts from AI generations – merged into the file list */
  artifacts?: Artifact[];
  /** Additional class names for the outermost container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getFileIcon(file: WorkspaceFile): string {
  if (file.type === "directory") return "📁";

  const mime = file.mimeType?.toLowerCase() ?? "";
  const name = file.name.toLowerCase();

  // Images
  if (mime.startsWith("image/")) return "🖼️";

  // Spreadsheets
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    name.endsWith(".csv") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx")
  )
    return "📊";

  // Code / scripts
  if (
    mime.startsWith("text/") ||
    [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".sh",
      ".bash",
      ".json",
      ".xml",
      ".yaml",
      ".yml",
      ".toml",
      ".md",
      ".css",
      ".scss",
      ".html",
    ].some((ext) => name.endsWith(ext))
  )
    return "💻";

  // Documents
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("msword") ||
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    name.endsWith(".rtf")
  )
    return "📄";

  return "📄"; // default file icon
}

function pathSegments(path: string): { label: string; fullPath: string }[] {
  if (!path || path === "/") return [];
  return path
    .split("/")
    .filter(Boolean)
    .reduce<{ label: string; fullPath: string }[]>((segs, segment, idx, arr) => {
      const fullPath = "/" + arr.slice(0, idx + 1).join("/");
      segs.push({ label: segment, fullPath });
      return segs;
    }, []);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkspaceFileBrowser({
  currentPath: initialPath,
  onFileSelect,
  onFileDownload,
  artifacts,
  className = "",
}: WorkspaceFileBrowserProps) {
  // ----- state -----
  const [path, setPath] = useState<string>(initialPath ?? "/");
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: WorkspaceFile;
  } | null>(null);

  // drag & drop
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);

  const fileListRef = useRef<HTMLDivElement>(null);

  // sync external initialPath changes (controlled by parent)
  useEffect(() => {
    if (initialPath !== undefined) {
      setPath(initialPath);
    }
  }, [initialPath]);

  // ----- data fetching -----
  const fetchFiles = useCallback(async (currentPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/workspace/files?path=${encodeURIComponent(currentPath)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `เซิร์ฟเวอร์ตอบกลับ ${res.status}`);
      }
      const data: WorkspaceFile[] = await res.json();
      setFiles(data);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถโหลดรายการไฟล์ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(path);
  }, [path, fetchFiles]);

  // ----- navigation -----
  const navigateTo = (newPath: string) => {
    setPath(newPath);
    setContextMenu(null); // close context menu on navigation
  };

  const handleFileClick = (file: WorkspaceFile) => {
    if (file.type === "directory") {
      navigateTo(file.path);
      return;
    }
    onFileSelect?.(file);
  };

  const handleFileDoubleClick = (file: WorkspaceFile) => {
    if (file.type === "directory") {
      navigateTo(file.path);
    }
    // files: nothing extra (already handled by single click if needed)
  };

  // ----- context menu -----
  const handleContextMenu = (
    e: React.MouseEvent,
    file: WorkspaceFile
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const closeContextMenu = () => setContextMenu(null);

  const downloadFile = (file: WorkspaceFile) => {
    if (onFileDownload) {
      onFileDownload(file);
    } else {
      // simple fallback: open file in new tab (browser may download)
      window.open(
        `/api/workspace/files?path=${encodeURIComponent(file.path)}&download=true`,
        "_blank"
      );
    }
    closeContextMenu();
  };

  const previewFile = (file: WorkspaceFile) => {
    onFileSelect?.(file);
    closeContextMenu();
  };

  const deleteFile = async (file: WorkspaceFile) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์นี้?")) return;
    closeContextMenu();
    setError(null);
    try {
      const url = `/api/workspace/files?path=${encodeURIComponent(file.path)}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "ลบไฟล์ไม่สำเร็จ");
      }
      // refresh file list
      await fetchFiles(path);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดขณะลบไฟล์");
    }
  };

  // close context menu on outside click
  useEffect(() => {
    const handler = () => {
      if (contextMenu) closeContextMenu();
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu]);

  // ----- drag & drop -----
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < droppedFiles.length; i++) {
        formData.append("files", droppedFiles[i]);
      }
      // upload to current path as target directory
      const uploadUrl = `/api/workspace/files?path=${encodeURIComponent(path)}`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "อัปโหลดไฟล์ไม่สำเร็จ");
      }
      // refresh file list
      await fetchFiles(path);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดขณะอัปโหลด");
    } finally {
      setUploading(false);
    }
  };

  // ----- combined files (workspace + artifacts) -----
  const artifactFiles: WorkspaceFile[] = (artifacts ?? []).map((a) => ({
    name: a.name,
    path: a.path,
    type: a.type,
    size: a.size,
    modified: a.modified,
    mimeType: a.mimeType,
    // we can add a flag if needed, but not required for rendering
  }));

  // simple merge (artifacts first, then workspace files; avoiding exact duplicates by path)
  const allFiles: WorkspaceFile[] = [
    ...artifactFiles,
    ...files.filter(
      (f) => !artifactFiles.some((af) => af.path === f.path)
    ),
  ];

  // ----- breadcrumb -----
  const segments = pathSegments(path);

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      onContextMenu={(e) => {
        // prevent default browser context menu on empty area
        if (!(e.target instanceof HTMLElement && e.target.closest("[data-file-item]"))) {
          e.preventDefault();
        }
      }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          className={`hover:text-blue-600 dark:hover:text-blue-400 ${
            path === "/" ? "font-semibold text-gray-900 dark:text-white" : ""
          }`}
          onClick={() => navigateTo("/")}
        >
          พื้นที่ทำงาน
        </button>
        {segments.map((seg) => (
          <React.Fragment key={seg.fullPath}>
            <span className="text-gray-400">/</span>
            <button
              type="button"
              className={`hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[200px] ${
                path === seg.fullPath
                  ? "font-semibold text-gray-900 dark:text-white"
                  : ""
              }`}
              onClick={() => navigateTo(seg.fullPath)}
            >
              {seg.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* Drop zone overlay */}
      <div
        ref={fileListRef}
        className={`relative flex-1 overflow-auto p-3 ${
          dragOver
            ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400"
            : "bg-white dark:bg-gray-800"
        } transition-colors`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag & drop hint */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 pointer-events-none z-10">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg px-6 py-4 text-center">
              <span className="text-lg">📂</span>
              <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                วางไฟล์ที่นี่เพื่ออัปโหลด
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
          </div>
        )}

        {/* Uploading indicator */}
        {uploading && (
          <div className="flex items-center justify-center p-4 text-sm text-blue-600">
            <span className="animate-pulse mr-2">⏳</span> กำลังอัปโหลด...
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            ⚠️ {error}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setError(null);
                fetchFiles(path);
              }}
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Empty state (no loading, no error, no files) */}
        {!loading && !error && allFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm">ไม่มีไฟล์ในโฟลเดอร์นี้</p>
            <p className="text-xs mt-1">
              ลากและวางไฟล์เพื่ออัปโหลด หรือรอให้ AI สร้างไฟล์ใหม่
            </p>
          </div>
        )}

        {/* File grid */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {allFiles.map((file) => (
              <div
                key={file.path}
                data-file-item
                className={`group relative flex flex-col items-center p-3 rounded-lg cursor-pointer transition-colors
                  hover:bg-gray-100 dark:hover:bg-gray-700/60
                  ${contextMenu?.file.path === file.path ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                `}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                title={`${file.name}\n${formatSize(file.size)} • ${formatDate(file.modified)}`}
              >
                <span className="text-3xl mb-1 select-none">
                  {getFileIcon(file)}
                </span>
                <span className="text-xs text-center text-gray-700 dark:text-gray-200 break-all line-clamp-2">
                  {file.name}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  {formatSize(file.size)}
                </span>
                {/* artifact badge (if came from artifacts) */}
                {artifactFiles.some((af) => af.path === file.path) && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full leading-none">
                    AI
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context menu (portal-like, but simple absolute) */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-md py-1 min-w-[160px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            onClick={() => previewFile(contextMenu.file)}
          >
            🔍 ดูตัวอย่าง
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            onClick={() => downloadFile(contextMenu.file)}
          >
            ⬇️ ดาวน์โหลด
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
            onClick={() => deleteFile(contextMenu.file)}
          >
            🗑️ ลบ
          </button>
        </div>
      )}
    </div>
  );
}