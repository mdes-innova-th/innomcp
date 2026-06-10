'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ChatContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  messageId: string;
  messageText: string;
  isAI: boolean;
  onClose: () => void;
  onCopy: (text: string) => void;
  onRetry?: () => void;
  onSaveArtifact?: (text: string) => void;
  onTranslate?: (text: string) => void;
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
}

export default function ChatContextMenu({
  visible,
  x,
  y,
  messageId,
  messageText,
  isAI,
  onClose,
  onCopy,
  onRetry,
  onSaveArtifact,
  onTranslate,
}: ChatContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rendered, setRendered] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const menuItems: MenuItem[] = React.useMemo(() => {
    const items: MenuItem[] = [
      {
        label: '📋 คัดลอก',
        icon: '📋',
        action: () => {
          onCopy(messageText);
          onClose();
        },
      },
    ];

    if (isAI) {
      items.push(
        {
          label: '🔄 ลองอีกครั้ง',
          icon: '🔄',
          action: () => {
            onRetry?.();
            onClose();
          },
        },
        {
          label: '💾 บันทึกเป็นไฟล์',
          icon: '💾',
          action: () => {
            onSaveArtifact?.(messageText);
            onClose();
          },
        },
        {
          label: '🌐 แปลภาษา',
          icon: '🌐',
          action: () => {
            onTranslate?.(messageText);
            onClose();
          },
        }
      );
    } else {
      items.push({
        label: '✏️ แก้ไข',
        icon: '✏️',
        action: () => {
          // Placeholder for edit functionality
          console.log('Edit message:', messageId);
          onClose();
        },
      });
    }

    return items;
  }, [isAI, messageText, messageId, onCopy, onRetry, onSaveArtifact, onTranslate, onClose]);

  // Handle visibility and animation
  useEffect(() => {
    if (visible) {
      setRendered(true);
      // Trigger fade-in after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateIn(true);
        });
      });
      setActiveIndex(-1);
    } else {
      setAnimateIn(false);
      // Delay unmount for exit animation
      const timeout = setTimeout(() => {
        setRendered(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  // Keyboard navigation and click outside
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < menuItems.length) {
            menuItems[activeIndex].action();
          }
          break;
      }
    },
    [visible, menuItems, activeIndex, onClose]
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside); // close on right-click elsewhere
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('contextmenu', handleClickOutside);
      };
    }
  }, [visible, handleKeyDown, handleClickOutside]);

  // Adjust position to avoid viewport overflow
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - menuItems.length * 44);

  if (!rendered) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
      className={`fixed z-50 min-w-[200px] rounded-xl border border-gray-200 bg-white shadow-2xl transition-opacity duration-200 ${
        animateIn ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseEnter={() => setActiveIndex(-1)} // reset keyboard selection on hover
    >
      <ul className="py-1">
        {menuItems.map((item, index) => (
          <li
            key={index}
            role="menuitem"
            tabIndex={-1}
            className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-gray-800 transition-colors hover:bg-indigo-50 ${
              activeIndex === index ? 'bg-indigo-50' : ''
            }`}
            onClick={item.action}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}