"use client";

import { useState, useCallback } from "react";

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
  successLabel = "คัดลอกแล้ว",
  timeout = 2000,
  className = "",
}: MDESCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }, [text, timeout]);

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ${
        copied
          ? "bg-emerald-500 text-white hover:bg-emerald-600"
          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
      } ${className}`}
    >
      {copied ? successLabel : label}
    </button>
  );
}