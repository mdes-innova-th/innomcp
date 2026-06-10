'use client';

import { useEffect, useRef } from 'react';
import type { FC } from 'react';

interface ShortcutHelpBubbleProps {
  visible: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: 'Enter', description: 'ส่งข้อความ' },
  { keys: 'Shift+Enter', description: 'ขึ้นบรรทัดใหม่' },
  { keys: 'Ctrl+K', description: 'คำสั่งด่วน (Command Palette)' },
  { keys: 'Ctrl+/', description: 'คีย์ลัดทั้งหมด' },
  { keys: 'Esc', description: 'หยุด AI' },
  { keys: '/', description: 'เปิดเมนูคำสั่ง (slash commands)' },
] as const;

const ShortcutHelpBubble: FC<ShortcutHelpBubbleProps> = ({ visible, onClose }) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Focus trap: move focus into bubble when it appears
  useEffect(() => {
    if (visible && bubbleRef.current) {
      // Optionally set focus to close button for accessibility
      const closeButton = bubbleRef.current.querySelector('button');
      closeButton?.focus();
    }
  }, [visible]);

  return (
    <div
      ref={bubbleRef}
      role="tooltip"
      aria-hidden={!visible}
      className={`
        fixed bottom-24 left-1/2 -translate-x-1/2 z-50
        w-full max-w-xs
        bg-white border border-gray-200 rounded-xl shadow-2xl
        p-4
        transition-opacity duration-200 ease-in-out
        ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">คีย์ลัด</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Shortcut rows */}
      <ul className="space-y-2">
        {shortcuts.map(({ keys, description }) => (
          <li key={keys} className="flex items-center gap-2 text-sm">
            <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 text-xs font-mono font-semibold text-gray-700 bg-gray-100 rounded-md border border-gray-300">
              {keys}
            </kbd>
            <span className="text-gray-600">{description}</span>
          </li>
        ))}
      </ul>

      {/* Footer hint */}
      <p className="mt-3 text-xs text-gray-400 text-center">กด Esc เพื่อปิด</p>
    </div>
  );
};

export default ShortcutHelpBubble;