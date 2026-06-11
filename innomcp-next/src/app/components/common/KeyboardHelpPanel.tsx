'use client';

import React, { useEffect, useRef } from 'react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

const shortcuts: ShortcutSection[] = [
  {
    title: 'การสนทนา',
    shortcuts: [
      { keys: ['Enter'], description: 'ส่งข้อความ' },
      { keys: ['Shift', 'Enter'], description: 'ขึ้นบรรทัดใหม่' },
      { keys: ['Escape'], description: 'หยุด AI' },
      { keys: ['?'], description: 'เปิด Help (เมื่อ input ว่าง)' },
    ],
  },
  {
    title: 'การนำทาง',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Command Palette' },
      { keys: ['Ctrl', '/'], description: 'คีย์ลัดทั้งหมด' },
      { keys: ['Ctrl', 'N'], description: 'แชทใหม่' },
      { keys: ['Ctrl', 'B'], description: 'เปิด/ปิด Sidebar' },
    ],
  },
  {
    title: 'Workspace',
    shortcuts: [
      { keys: ['Ctrl', 'W'], description: 'เปิด/ปิด Workspace' },
      { keys: ['Ctrl', 'E'], description: 'Export' },
    ],
  },
];

interface KeyboardHelpPanelProps { isOpen: boolean; onClose: () => void; }

const KeyboardHelpPanel: React.FC<KeyboardHelpPanelProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // Prevent triggering AI stop shortcut
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="คีย์ลัดทั้งหมด"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            คีย์ลัดทั้งหมด
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
            aria-label="ปิดหน้าต่าง"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {shortcuts.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.shortcuts.map((shortcut, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <span className="flex gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, keyIdx) => (
                          <kbd
                            key={keyIdx}
                            className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                          >
                            {key === 'Ctrl' ? '⌃' : key === 'Shift' ? '⇧' : key === 'Enter' ? '↵' : key === 'Escape' ? 'Esc' : key}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          กด <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">Esc</kbd> เพื่อปิด
        </div>
      </div>
    </div>
  );
};

export default KeyboardHelpPanel;