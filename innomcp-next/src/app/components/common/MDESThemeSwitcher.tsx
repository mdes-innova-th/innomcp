'use client';

import React, { useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type Theme = 'light' | 'dark' | 'system';

interface MDESThemeSwitcherProps {
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const themes: Theme[] = ['light', 'dark', 'system'];
const themeLabels: Record<Theme, string> = {
  light: 'สว่าง',
  dark: 'มืด',
  system: 'ตามระบบ',
};
const themeIcons: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
};
const nextThemeDescriptions: Record<Theme, string> = {
  light: 'เปลี่ยนเป็นธีมมืด',
  dark: 'เปลี่ยนเป็นธีมตามระบบ',
  system: 'เปลี่ยนเป็นธีมสว่าง',
};

const MDESThemeSwitcher: React.FC<MDESThemeSwitcherProps> = ({
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const { theme, setTheme } = useTheme();

  const handleClick = useCallback(() => {
    const currentIndex = themes.indexOf(theme as Theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  }, [theme, setTheme]);

  const currentTheme = (theme as Theme) || 'system'; // fallback

  const currentIcon = themeIcons[currentTheme];
  const currentLabel = themeLabels[currentTheme];
  const currentDescription = nextThemeDescriptions[currentTheme];

  const sizeClasses = useMemo(() => {
    if (size === 'sm') return 'w-8 h-8 text-sm';
    return 'w-10 h-10 text-base';
  }, [size]);

  const labelSizeClasses = useMemo(() => {
    if (size === 'sm') return 'text-sm';
    return 'text-base';
  }, [size]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex items-center justify-center rounded-md bg-transparent transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses} ${className}`}
      aria-label={`ธีมปัจจุบัน: ${currentLabel}. ${currentDescription}`}
      title={currentDescription}
    >
      <span
        className="inline-block transition-transform duration-300 ease-in-out group-hover:scale-110"
        aria-hidden="true"
      >
        {currentIcon}
      </span>
      {showLabel && (
        <span
          className={`ml-1.5 font-medium text-gray-700 dark:text-gray-200 ${labelSizeClasses}`}
        >
          {currentLabel}
        </span>
      )}
    </button>
  );
};

export default MDESThemeSwitcher;