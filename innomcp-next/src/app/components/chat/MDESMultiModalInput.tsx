"use client";

import { useEffect, useRef, useState } from "react";

// Types (as provided)
type AttachmentType =
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "csv"
  | "json"
  | "code"
  | "other";

interface AttachmentPreview {
  id: string;
  file: File;
  type: AttachmentType;
  previewUrl?: string;
  thumbnail?: string;
  processingState: "idle" | "analyzing" | "ready" | "error";
  analysis?: string; // extracted content/summary
  error?: string;
}

interface MDESMultiModalInputProps {
  attachments: AttachmentPreview[];
  onRemove: (id: string) => void;
  onAnalysis: (id: string, analysis: string) => void;
  className?: string;
}

// Icons
const IconImage = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8.5" cy="9" r="2" fill="currentColor" />
    <path d="M22 15l-5-5-5 5-3-3-5 5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const IconAudio = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <path d="M9 18V5l8-2v15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" fill="currentColor" />
    <circle cx="18" cy="18" r="3" fill="currentColor" />
  </svg>
);

const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <polygon points="10,8 16,12 10,16" fill="currentColor" />
  </svg>
);

const IconPdf = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
    <text x="8" y="17" fontFamily="Arial" fontSize="5" fill="currentColor" fontWeight="bold">PDF</text>
  </svg>
);

const IconCsv = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1" />
    <line x1="4" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="1" />
    <text x="6" y="9" fontFamily="Arial" fontSize="4" fill="currentColor">A</text>
    <text x="10" y="9" fontFamily="Arial" fontSize="4" fill="currentColor">B</text>
    <text x="14" y="9" fontFamily="Arial" fontSize="4" fill="currentColor">C</text>
  </svg>
);

const IconJson = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <path d="M8 6c-1.5 0-3 .5-3 2s1.5 2 3 2h1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M16 18c1.5 0 3-.5 3-2s-1.5-2-3-2h-1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M8 10c1.5 0 3-.5 3-2s-1.5-2-3-2H7" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M16 14c-1.5 0-3 .5-3 2s1.5 2 3 2h1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const IconCode = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <polyline points="8,6 2,12 8,18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="16,6 22,12 16,18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-gray-400">
    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// Helper: detect programming language from file extension
function detectLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
      return "JavaScript";
    case "ts":
      return "TypeScript";
    case "jsx":
      return "React JSX";
    case "tsx":
      return "React TSX";
    case "py":
      return "Python";
    case "rb":
      return "Ruby";
    case "java":
      return "Java";
    case "cpp":
    case "cc":
      return "C++";
    case "c":
      return "C";
    case "cs":
      return "C#";
    case "go":
      return "Go";
    case "rs":
      return "Rust";
    case "php":
      return "PHP";
    case "swift":
      return "Swift";
    case "kt":
      return "Kotlin";
    case "html":
      return "HTML";
    case "css":
      return "CSS";
    case "scss":
    case "less":
      return "SCSS/Less";
    case "json":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    case "md":
      return "Markdown";
    default:
      return "โค้ด";
  }
}

// Helper: format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MDESMultiModalInput({
  attachments,
  onRemove,
  onAnalysis,
  className = "",
}: MDESMultiModalInputProps) {
  // --- object URL management for image/video previews ---
  const previousUrlsRef = useRef<Record<string, string>>({});
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const newUrls: Record<string, string> = {};

    attachments.forEach((att) => {
      if (!att.previewUrl && (att.type === "image" || att.type === "video")) {
        newUrls[att.id] = URL.createObjectURL(att.file);
      }
    });

    // Revoke old URLs that are no longer needed
    Object.entries(previousUrlsRef.current).forEach(([id, url]) => {
      if (!newUrls[id]) {
        URL.revokeObjectURL(url);
      }
    });

    previousUrlsRef.current = newUrls;
    setBlobUrls(newUrls);

    // Cleanup on unmount: revoke all
    return () => {
      Object.values(previousUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
      previousUrlsRef.current = {};
    };
  }, [attachments]);

  // --- render helpers per attachment ---
  const getPreviewUrl = (att: AttachmentPreview): string | undefined => {
    return att.previewUrl || blobUrls[att.id];
  };

  const renderPreviewContent = (att: AttachmentPreview) => {
    const previewUrl = getPreviewUrl(att);

    switch (att.type) {
      case "image":
        if (previewUrl) {
          return (
            <img
              src={previewUrl}
              alt={att.file.name}
              className="w-full h-full object-cover rounded"
            />
          );
        }
        return <IconImage />;

      case "video":
        if (previewUrl) {
          return (
            <video src={previewUrl} className="w-full h-full object-cover rounded" controls={false} />
          );
        }
        return <IconVideo />;

      case "audio":
        return <IconAudio />;

      case "pdf":
        return <IconPdf />;

      case "csv":
        return <IconCsv />;

      case "json":
        return <IconJson />;

      case "code":
        return <IconCode />;

      default:
        return <IconFile />;
    }
  };

  const renderAnalysisText = (att: AttachmentPreview) => {
    if (att.processingState === "analyzing") {
      return (
        <span className="text-xs text-blue-600 flex items-center gap-1">
          <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          กำลังวิเคราะห์...
        </span>
      );
    }

    if (att.processingState === "error") {
      return (
        <span className="text-xs text-red-600 flex items-center gap-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {att.error ? att.error : "เกิดข้อผิดพลาด"}
        </span>
      );
    }

    // Show custom info based on type and analysis if present
    if (att.analysis) {
      return <span className="text-xs text-gray-700">{att.analysis}</span>;
    }

    // Fallback info based on type
    switch (att.type) {
      case "image":
        return (
          <span className="text-xs text-gray-500">
            {att.file.name} ({formatSize(att.file.size)})
          </span>
        );
      case "audio":
        return (
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 truncate">{att.file.name}</span>
            <span className="text-xs text-gray-400">จะถอดเสียงด้วย Whisper</span>
          </div>
        );
      case "video":
        return (
          <span className="text-xs text-gray-500 truncate">
            {att.file.name} ({formatSize(att.file.size)})
          </span>
        );
      case "pdf":
        return (
          <span className="text-xs text-gray-500 truncate">
            {att.file.name} ({formatSize(att.file.size)})
          </span>
        );
      case "csv":
        return (
          <span className="text-xs text-gray-500 truncate">
            {att.file.name} ({formatSize(att.file.size)})
          </span>
        );
      case "json":
        return (
          <span className="text-xs text-gray-500 truncate">
            {att.file.name} ({formatSize(att.file.size)})
          </span>
        );
      case "code":
        return (
          <span className="text-xs text-gray-500 truncate">
            {detectLanguage(att.file.name)} – {att.file.name}
          </span>
        );
      default:
        return (
          <span className="text-xs text-gray-500 truncate">
            {att.file.name} ({formatSize(att.file.size)})
          </span>
        );
    }
  };

  return (
    <div
      className={`flex gap-2 p-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${className}`}
    >
      {attachments.map((att) => (
        <div
          key={att.id}
          className={`relative group flex-shrink-0 w-36 rounded-lg border bg-white shadow-sm overflow-hidden ${
            att.processingState === "error" ? "border-red-400" : "border-gray-200"
          }`}
        >
          {/* Close button */}
          <button
            onClick={() => onRemove(att.id)}
            className="absolute top-0.5 right-0.5 z-10 bg-white/80 hover:bg-white rounded-full p-0.5 shadow-sm transition-colors"
            title="ลบ"
            aria-label={`ลบไฟล์ ${att.file.name}`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-gray-600 hover:text-red-600"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Preview area */}
          <div className="h-20 flex items-center justify-center bg-gray-50 p-1">
            {renderPreviewContent(att)}
          </div>

          {/* Info area */}
          <div className="p-1.5 text-center">
            {renderAnalysisText(att)}
          </div>
        </div>
      ))}
    </div>
  );
}