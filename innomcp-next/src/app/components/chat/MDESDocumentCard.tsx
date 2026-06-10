"use client";

import { useState } from "react";

type DocType = "pdf" | "word" | "excel" | "image" | "csv" | "json" | "text";

interface MDESDocumentCardProps {
  name: string;
  type: DocType;
  size?: number; // bytes
  pages?: number; // for PDFs
  preview?: string; // first 200 chars of content
  downloadUrl?: string;
  createdAt?: number;
  onDownload?: () => void;
  onPreview?: () => void;
  className?: string;
}

const DOC_TYPE_ICONS: Record<DocType, string> = {
  pdf: "📄",
  word: "📝",
  excel: "📊",
  image: "🖼️",
  csv: "📋",
  json: "🧾",
  text: "📃",
};

const MAX_PREVIEW_LENGTH = 200;

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(1);
  return `${size} ${units[i]}`;
}

export default function MDESDocumentCard({
  name,
  type,
  size,
  pages,
  preview,
  downloadUrl,
  createdAt,
  onDownload,
  onPreview,
  className = "",
}: MDESDocumentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const icon = DOC_TYPE_ICONS[type] || "📄";
  const isLong = preview && preview.length > MAX_PREVIEW_LENGTH;
  const displayText = expanded
    ? preview
    : preview?.slice(0, MAX_PREVIEW_LENGTH) + (isLong ? "..." : "");

  return (
    <div
      className={`relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {/* Government stamp overlay */}
      <div className="pointer-events-none absolute right-2 top-2 flex h-16 w-16 -rotate-12 items-center justify-center rounded-full border-2 border-indigo-300 opacity-15">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">MDES</p>
          <p className="text-[8px] font-medium text-indigo-500">Official</p>
        </div>
      </div>

      {/* Top row: icon, name, badges */}
      <div className="flex items-start gap-3 pr-12">
        <span className="text-4xl" role="img" aria-label={type}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900">{name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {size !== undefined && (
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                {formatSize(size)}
              </span>
            )}
            {pages !== undefined && (
              <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {pages} หน้า
              </span>
            )}
            <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium uppercase text-indigo-700">
              {type}
            </span>
          </div>
        </div>
      </div>

      {/* Content preview */}
      {preview && (
        <div className="mt-3">
          <p className="whitespace-pre-wrap break-words text-sm text-gray-600">
            {displayText}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {expanded ? "ย่อ" : "อ่านเพิ่มเติม"}
            </button>
          )}
        </div>
      )}

      {/* Actions and timestamp */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <span role="img" aria-label="download">📥</span>
              <span>ดาวน์โหลด</span>
            </button>
          )}
          {!onDownload && downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <span role="img" aria-label="download">📥</span>
              <span>ดาวน์โหลด</span>
            </a>
          )}
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <span role="img" aria-label="preview">🔍</span>
              <span>ดูตัวอย่าง</span>
            </button>
          )}
        </div>

        {createdAt && (
          <time
            dateTime={new Date(createdAt).toISOString()}
            className="text-xs text-gray-500"
          >
            {new Date(createdAt).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    </div>
  );
}