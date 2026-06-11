"use client";

import React from "react";

interface MDESKbdProps {
  /** Single key string or array of key strings */
  keys: string | string[];
  /** Separator between keys, default "+" */
  separator?: string;
  /** Additional classes for the wrapper element */
  className?: string;
}

export function MDESKbd({
  keys,
  separator = "+",
  className,
}: MDESKbdProps) {
  const keyArray = typeof keys === "string" ? [keys] : keys;

  if (!keyArray.length) return null;

  const ariaLabel = keyArray.join(` ${separator} `);

  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      aria-label={ariaLabel}
    >
      {keyArray.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span
              className="mx-0.5 select-none text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            >
              {separator}
            </span>
          )}
          <kbd
            aria-hidden="true"
            className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export default MDESKbd;