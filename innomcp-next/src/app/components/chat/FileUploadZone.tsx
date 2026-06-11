'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';

interface FileUploadZoneProps {
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  accept?: string; // e.g. "image/*,.pdf,.csv"
  maxSizeMB?: number;
  multiple?: boolean;
  className?: string;
  compact?: boolean;
}

function isFileTypeAccepted(file: File, accept: string): boolean {
  const acceptedTypes = accept.split(',').map((s) => s.trim());
  return acceptedTypes.some((type) => {
    if (type.endsWith('/*')) {
      const category = type.split('/')[0];
      return file.type.startsWith(`${category}/`);
    }
    if (type.includes('/')) {
      return file.type === type;
    }
    const extension = type.startsWith('.') ? type : `.${type}`;
    return file.name.toLowerCase().endsWith(extension);
  });
}

function formatAcceptedTypes(accept: string): string {
  const parts = accept.split(',').map((s) => s.trim());
  const translations: Record<string, string> = {
    '.pdf': 'PDF (.pdf)',
    '.csv': 'CSV (.csv)',
    '.xlsx': 'Excel (.xlsx)',
    '.docx': 'Word (.docx)',
    '.png': 'PNG (.png)',
    '.jpg': 'JPG (.jpg)',
    '.jpeg': 'JPEG (.jpeg)',
    '.svg': 'SVG (.svg)',
    '.json': 'JSON (.json)',
    '.txt': 'Text (.txt)',
    'image/*': 'รูปภาพ',
    'video/*': 'วิดีโอ',
    'audio/*': 'เสียง',
    '*/*': 'ทุกประเภท',
  };
  return parts.map((part) => translations[part] || part).join(', ');
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`w-6 h-6 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

export default function FileUploadZone({
  onFile,
  onFiles,
  accept,
  maxSizeMB = 10,
  multiple = false,
  className = '',
  compact = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    processFiles(files);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    e.target.value = '';
  };

  const processFiles = (files: FileList) => {
    const fileArray = Array.from(files);
    const validatedFiles: File[] = [];

    for (const file of fileArray) {
      // validate file type
      if (accept && !isFileTypeAccepted(file, accept)) {
        const formatted = formatAcceptedTypes(accept);
        setError(`ประเภทไฟล์ไม่ถูกต้อง รองรับเฉพาะ ${formatted}`);
        return;
      }

      // validate file size
      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        setError(`ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${maxSizeMB} MB)`);
        return;
      }

      validatedFiles.push(file);
    }

    if (multiple) {
      onFiles?.(validatedFiles) || onFile(validatedFiles[0]);
    } else {
      onFile(validatedFiles[0]);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
        ${compact ? 'p-3' : 'p-8'}
        ${error ? 'border-red-400' : ''}
        ${className}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {compact ? (
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <UploadIcon className="w-5 h-5" />
          <span className="text-sm font-medium">วางไฟล์ที่นี่</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-gray-600">
          <UploadIcon className="w-10 h-10 mb-2 text-blue-500" />
          <p className="text-lg font-semibold">ลากและวางไฟล์ที่นี่</p>
          <p className="text-sm">หรือคลิกเพื่อเลือกไฟล์</p>
          {accept && (
            <p className="text-xs text-gray-500 mt-2">
              รองรับ: {formatAcceptedTypes(accept)}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}