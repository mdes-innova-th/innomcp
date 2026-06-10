'use client';

import React from 'react';

// -----------------------------------------------------------------------------
// Shared animation keyframes (injected once via <style>)
// -----------------------------------------------------------------------------
const ANIMATION_STYLES = `
@keyframes mdes-dot-bounce {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-8px);
    opacity: 1;
  }
}

@keyframes mdes-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes mdes-bar-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
`;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface MDESThinkingDotsProps {
  /** ชื่อของ AI agent เช่น "gemma4:26b" */
  agentName?: string;
  /** ขั้นตอนการประมวลผล เช่น "กำลังวิเคราะห์" "กำลังค้นหา" "กำลังสรุป" */
  stage?: string;
  /** CSS class เพิ่มเติม */
  className?: string;
}

export interface MDESThinkingBarProps {
  /** CSS class เพิ่มเติม */
  className?: string;
}

// -----------------------------------------------------------------------------
// MDESThinkingDots – Three bouncing dots with optional agent & stage text
// -----------------------------------------------------------------------------
export const MDESThinkingDots: React.FC<MDESThinkingDotsProps> = ({
  agentName,
  stage,
  className = '',
}) => {
  return (
    <>
      {/* Inject keyframes only once (safe with React 18 strict mode) */}
      <style>{ANIMATION_STYLES}</style>

      <div
        role="status"
        aria-live="polite"
        aria-label="AI กำลังประมวลผล"
        className={`inline-flex items-center gap-2 h-6 ${className}`}
      >
        {/* Three bouncing dots */}
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delayMs, idx) => (
            <span
              key={idx}
              className="block w-1.5 h-1.5 rounded-full bg-[#1a3c6e]"
              style={{
                animation: `mdes-dot-bounce 0.8s ease-in-out infinite`,
                animationDelay: `${delayMs}ms`,
              }}
            />
          ))}
        </div>

        {/* Optional text: "{agentName} · {stage}" */}
        {(agentName || stage) && (
          <span
            className="text-xs text-[#1a3c6e] whitespace-nowrap animate-[mdes-fade-in_0.5s_ease-out_forwards]"
          >
            {agentName && stage
              ? `${agentName} · ${stage}`
              : agentName || stage}
          </span>
        )}
      </div>
    </>
  );
};

// -----------------------------------------------------------------------------
// MDESThinkingBar – Thin oscillating progress bar (sticky usage example)
// -----------------------------------------------------------------------------
export const MDESThinkingBar: React.FC<MDESThinkingBarProps> = ({
  className = '',
}) => {
  return (
    <>
      {/* Keyframes already injected above, safe to reuse */}
      <div
        role="progressbar"
        aria-label="กำลังโหลด"
        className={`w-full h-1 overflow-hidden bg-gray-200 ${className}`}
      >
        <div
          className="h-full w-1/5 bg-[#1a3c6e] rounded-full"
          style={{
            animation: `mdes-bar-shimmer 1.5s ease-in-out infinite alternate`,
          }}
        />
      </div>
    </>
  );
};

export default MDESThinkingDots;