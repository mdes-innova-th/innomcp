'use client';

import React from 'react';

interface MDESGradientBorderProps {
  /** Content to wrap with the animated gradient border */
  children: React.ReactNode;
  /** When true, the gradient border animates (active state) */
  active?: boolean;
  /** Additional CSS classes to merge */
  className?: string;
}

/**
 * MDESGradientBorder – Animated gradient border wrapper used to highlight
 * active AI response containers in INNOMCP (government MCP Hub).
 *
 * The border renders a smooth rainbow/indigo gradient that moves continuously
 * when the `active` prop is set to `true`. The animation is defined via a
 * `@keyframes` rule injected as a `<style>` tag (scoped by the component).
 *
 * Tailwind CSS classes are used for styling, and the component supports
 * dark mode via the `dark:` variant.
 */
const MDESGradientBorder: React.FC<MDESGradientBorderProps> = ({
  children,
  active = false,
  className = '',
}) => {
  return (
    <>
      {/* Inject animation only once – the style tag is static */}
      <style>{`
        @keyframes gradient-border {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-border {
          animation: gradient-border 4s ease infinite;
          background-size: 200% 200%;
        }
      `}</style>

      {/* Outer wrapper: provides the gradient border */}
      <div
        className={`
          relative rounded-lg p-[3px]
          bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
          ${active ? 'animate-gradient-border' : ''}
          ${className}
        `.trim()}
      >
        {/* Inner container: solid background to show only the gradient border */}
        <div className="rounded-lg bg-white dark:bg-gray-900">
          {children}
        </div>
      </div>
    </>
  );
};

export default MDESGradientBorder;