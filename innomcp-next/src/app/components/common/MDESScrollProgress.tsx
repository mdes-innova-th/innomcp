```tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';

interface MDESScrollProgressProps {
  containerRef: React.RefObject<HTMLElement>;
  /** Tailwind color name (e.g., "indigo", "blue", "red"), defaults to "indigo" */
  color?: string;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500',
  blue: 'bg