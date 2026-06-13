import React from 'react';

interface Artifact {
  name: string;
  mime: string;
  content: string;
}

interface ArtifactCardProps {
  artifact: Artifact;
}

// Simple mapping from MIME type to an icon (emoji)
const mimeIcon: Record<string, string> = {
  'text/plain': '📄',
  'text/markdown': '📝',
  'text/csv': '📊',
  'text/html': '🌐',
  'application/json': '📋',
  'application/pdf': '📕',
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
  'image/gif': '🖼️',
  'image/svg+xml': '🖼️',
  'application/javascript': '⚡',
  'text/css': '🎨',
  'application/xml': '🗂️',
  'application/zip': '🗜️',
};

function getIcon(mime: string): string {
  // Exact match
  if (mimeIcon[mime]) return mimeIcon[mime];
  // Partial match (e.g., text/*)
  const category = mime.split('/')[0];
  if (category === 'text') return '📄';
  if (category === 'image') return '🖼️';
  if (category === 'application') return '📦';
  return '📁';
}

function isTextBased(mime: string): boolean {
  const textMimes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'text/css',
    'application/json',
    'application/javascript',
    'application/xml',
  ];
  return textMimes.includes(mime) || mime.startsWith('text/');
}

function formatPreview(content: string, mime: string): React.ReactNode {
  if (mime === 'text/markdown') {
    // Simple markdown-like rendering: just show as pre with basic formatting? For simplicity, render as pre.
    return <pre className="whitespace-pre-wrap break-words text-sm">{content}</pre>;
  }
  if (mime === 'text/csv') {
    // Basic table preview (first few rows)
    const rows = content.trim().split('\n').slice(0, 10);
    if (rows.length === 0) return <p className="text-sm opacity-60">ไม่มีข้อมูล</p>;
    const headers = rows[0].split(',');
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border border-gray-300 dark:border-gray-600 px-2 py-1">{h.trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.split(',').map((cell, ci) => (
                  <td key={ci} className="border border-gray-300 dark:border-gray-600 px-2 py-1">{cell.trim()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // Default text preview
  return <pre className="whitespace-pre-wrap break-words text-sm">{content}</pre>;
}

const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact }) => {
  const { name, mime, content } = artifact;

  const handleDownload = () => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 shadow-sm">
      {/* Header: icon + name + download */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getIcon(mime)}</span>
          <span className="font-medium text-sm truncate max-w-40" title={name}>
            {name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">{mime}</span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="ดาวน์โหลด"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">ดาวน์โหลด</span>
        </button>
      </div>

      {/* Preview area */}
      <div className="mt-1 border-t border-gray-100 dark:border-gray-700 pt-2">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">ดูตัวอย่าง</div>
        {isTextBased(mime) ? (
          <div className="max-h-48 overflow-auto bg-gray-50 dark:bg-gray-900 rounded p-2">
            {formatPreview(content, mime)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 bg-gray-50 dark:bg-gray-900 rounded">
            <span className="text-xs text-gray-400 dark:text-gray-500">ดูตัวอย่างไม่พร้อมใช้งาน</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactCard;
