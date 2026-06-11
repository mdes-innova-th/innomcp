'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface ShortcutCheatSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: 'Enter', description: 'ส่งข้อความ' },
  { keys: 'Shift + Enter', description: 'ขึ้นบรรทัดใหม่' },
  { keys: 'Ctrl + K', description: 'เปิดคำสั่ง' },
  { keys: '/', description: 'เปิดคำสั่งด่วน' },
  { keys: 'Esc', description: 'ปิดหน้าต่างนี้' },
];

const ShortcutCheatSheet: React.FC<ShortcutCheatSheetProps> = ({ visible, onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    },
    [visible, onClose]
  );

  // Close when clicking outside the card
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (visible && cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [visible, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  return (
    <div
      ref={cardRef}
      className={`
        absolute bottom-14 left-4 z-50 w-56
        bg-white/95 backdrop-blur-sm shadow-lg rounded-lg
        border border-gray-200
        p-3 text-sm
        transition-all duration-200 ease-in-out
        ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}
    >
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        ทางลัด
      </h3>
      <ul className="space-y-1.5">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.keys} className="flex items-center justify-between">
            <span className="text-gray-700">{shortcut.description}</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-600 whitespace-nowrap">
              {shortcut.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ShortcutCheatSheet;