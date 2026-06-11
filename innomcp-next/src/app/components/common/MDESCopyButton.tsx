```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface MDESCopyButtonProps {
  /** The text to copy to clipboard */
  text: string;
  /** Label shown before copy (default: "คัดลอก") */
  label?: string;
  /** Label shown after successful copy (default: "คัดลอกแล้ว") */
  successLabel?: string;
  /** How long to show the success state in ms (default: 2000) */
  timeout?: number;
  /** Additional CSS classes for the button */
  className?: string;
}

export default function MDESCopyButton({
  text,
  label = "คัดลอก",
  successLabel = "คัด