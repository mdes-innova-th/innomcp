'use client';

import React, { useState } from 'react';

// ---------- Type Definitions ----------
interface Evidence {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  confidence?: number;     // 0–1
  category?: string;       // "กฎหมาย" | "ข้อมูลสถิติ" | "ข่าว" etc.
  publishedAt?: string;
  url?: string;
}

interface MDESEvidenceCardProps {
  evidences: Evidence[];
  collapsed?: boolean;
  className?: string;
}

// ---------- Utility ----------
function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ---------- Icons (inline SVGs to avoid external dependencies) ----------
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn('w-4 h-4', className)}
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn('w-4 h-4', className)}
  >
    <path
      fillRule="evenodd"
      d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
      clipRule="evenodd"
    />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn('w-4 h-4', className)}
  >
    <path d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-3.121-3.122A1.5 1.5 0 0012.38 3H4.5zm1.25 4.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75z" />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn('w-3 h-3', className)}
  >
    <path d="M15 4.25a.75.75 0 01.75.75v4.25a.75.75 0 01-1.5 0V6.56l-7.72 7.72a.75.75 0 01-1.06-1.06L13.44 5.5H9.75a.75.75 0 010-1.5h4.25A.75.75 0 0115 4.25zM4.75 5A1.75 1.75 0 003 6.75v8.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0015 15.25v-3.5a.75.75 0 00-1.5 0v3.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5z" />
  </svg>
);

// ---------- Main Component ----------
export default function MDESEvidenceCard({
  evidences,
  collapsed = true,
  className,
}: MDESEvidenceCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(!collapsed);

  // Hide entirely if no evidences
  if (!evidences || evidences.length === 0) {
    return null;
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Collapsed / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-4 py-2.5',
          'border-blue-200 bg-blue-50 text-blue-800',
          'hover:bg-blue-100 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-blue-300'
        )}
      >
        <span className="text-sm font-medium">
          อ้างอิง {evidences.length} แหล่ง
        </span>
        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>

      {/* Expanded Citation List */}
      <div
        className={cn(
          'mt-3 space-y-3 overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {evidences.map((evidence, idx) => (
          <div
            key={evidence.id}
            className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {/* Citation Number */}
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                {idx + 1}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Title with source icon */}
                <div className="flex items-center gap-1.5">
                  <DocumentIcon className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {evidence.title}
                  </h4>
                </div>

                {/* Excerpt */}
                {evidence.excerpt && (
                  <p className="mt-1 text-xs text-gray-600 line-clamp-3">
                    {evidence.excerpt}
                  </p>
                )}

                {/* Source and confidence row */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  {/* Source */}
                  {evidence.source && (
                    <span>
                      ที่มา:{' '}
                      {evidence.url ? (
                        <a
                          href={evidence.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          {evidence.source}
                          <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                      ) : (
                        evidence.source
                      )}
                    </span>
                  )}

                  {/* Confidence bar */}
                  {evidence.confidence !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <span>ความเชื่อมั่น:</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${Math.round(evidence.confidence * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums">
                        {Math.round(evidence.confidence * 100)}%
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}