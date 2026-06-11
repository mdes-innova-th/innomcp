// TypingCursor.tsx
// INNOMCP — Blinking cursor for streaming AI text
// "use client" for Next.js client component
// Props: isStreaming (boolean), className (optional string)
// Renders a blinking ▍ (U+258D) when streaming, hidden when done

"use client";

import React from "react";

interface TypingCursorProps {
  isStreaming: boolean;
  className?: string;
}

const TypingCursor: React.FC<TypingCursorProps> = ({ isStreaming, className }) => {
  // Do not render anything when streaming has finished
  if (!isStreaming) return null;

  return (
    <span
      className={`animate-pulse inline-block ${className ?? ""}`.trim()}
      aria-hidden="true"
    >
      ▍
    </span>
  );
};

export default TypingCursor;