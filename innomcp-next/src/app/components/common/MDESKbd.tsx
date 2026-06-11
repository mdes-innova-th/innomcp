use client;

import React from 'react';

interface MDESKbdProps {
  keys: string | string[];
  separator?: string;
  className?: string;
}

const MDESKbd: React.FC<MDESKbdProps> = ({
  keys,
  separator = '+',
  className = '',
}) => {
  if (!keys) return null;

  const keyArray = Array.isArray(keys) ? keys : [keys];
  if (keyArray.length === 0) return null;

  const label = keyArray.join(` ${separator} `);

  return (
    <span
      aria-label={`Keyboard shortcut: ${label}`}
      className={`inline-flex items-center gap-x-1 ${className}`}
    >
      {keyArray.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600">
            {key}
          </kbd>
          {index < keyArray.length - 1 && (
            <span
              aria-hidden="true"
              className="text-xs text-gray-500 dark:text-gray-400 mx-0.5 select-none"
            >
              {separator}
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
};

export default MDESKbd;