'use client';

import React, { useEffect, useState } from 'react';

interface INNOMCPAboutPanelProps {
  onClose: () => void;
}

export default function INNOMCPAboutPanel({ onClose }: INNOMCPAboutPanelProps) {
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [nodeVersion, setNodeVersion] = useState<string>('Node.js v18.x');

  // Fetch model count from backend API
  useEffect(() => {
    const fetchModelCount = async () => {
      try {
        const res = await fetch('/api/mdes/models');
        if (!res.ok) throw new Error('Failed to fetch models');
        const data = await res.json();
        // Assume data contains total models count, e.g., data.total or data.length
        if (Array.isArray(data)) {
          setModelCount(data.length);
        } else if (data?.total) {
          setModelCount(data.total);
        } else if (data?.models?.length) {
          setModelCount(data.models.length);
        } else {
          setModelCount(0);
        }
      } catch {
        setModelCount(0);
      }
    };
    fetchModelCount();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const capabilities = [
    'MCP Tools',
    'Thai AI',
    'Multi-agent',
    'Government Data',
    'Computer Use',
  ];

  const links = [
    { label: 'GitHub', url: 'https://github.com/innomcp/mcp-hub' },
    { label: 'เอกสาร', url: 'https://innomcp.mdes.go.th/docs' },
    { label: 'รายงานปัญหา', url: 'https://github.com/innomcp/mcp-hub/issues' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* sliding panel */}
      <div
        className="relative z-10 w-full max-w-sm bg-white shadow-xl border-l border-gray-200 animate-slide-in-left"
        role="dialog"
        aria-modal="true"
        aria-label="เกี่ยวกับ INNOMCP"
      >
        <div className="flex flex-col h-full p-6 overflow-y-auto">
          {/* close button */}
          <button
            onClick={onClose}
            className="self-end mb-4 -mr-2 -mt-2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="ปิด"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* logo + version */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow">
              IN
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                INNOMCP
              </h2>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                v10.17
              </span>
            </div>
          </div>

          {/* full name */}
          <p className="text-lg font-medium text-gray-800 mb-1">
            INNOMCP — ระบบ AI สำหรับภาครัฐ
          </p>

          {/* organization */}
          <p className="text-sm text-gray-500 mb-4">
            กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES)
          </p>

          {/* description */}
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            แพลตฟอร์ม AI แบบ Multi-agent ที่ทำงานตลอด 24 ชั่วโมง ผ่าน MDES Ollama
          </p>

          {/* key capabilities */}
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
            ความสามารถหลัก
          </h3>
          <ul className="grid grid-cols-2 gap-1.5 mb-6">
            {capabilities.map((cap) => (
              <li
                key={cap}
                className="flex items-center gap-1.5 text-sm text-gray-700"
              >
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {cap}
              </li>
            ))}
          </ul>

          {/* links */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              ลิงก์ที่เกี่ยวข้อง
            </h3>
            <div className="space-y-2">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* system info */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              ข้อมูลระบบ
            </h3>
            <div className="space-y-1.5 text-sm text-gray-600">
              <p>Node.js: {nodeVersion}</p>
              <p>
                จำนวนโมเดล:{' '}
                {modelCount !== null ? modelCount : 'กำลังโหลด...'}
              </p>
            </div>
          </div>

          {/* contact */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
              ติดต่อ
            </h3>
            <a
              href="mailto:innova@mdes.go.th"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              innova@mdes.go.th
            </a>
          </div>

          {/* credits */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              สร้างโดย innova-bot
              <br />
              ขับเคลื่อนด้วย MDES Ollama
            </p>
          </div>
        </div>
      </div>

      {/* tailwind animation */}
      <style jsx>{`
        @keyframes slide-in-left {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}