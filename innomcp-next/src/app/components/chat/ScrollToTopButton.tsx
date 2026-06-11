'use client';

import React, { useState, useEffect } from 'react';

interface ScrollToTopButtonProps {
  /** Reference to the scrollable container element */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Optional additional CSS classes to merge */
  className?: string;
}

/**
 * Floating button that appears in the bottom-left corner when the user
 * scrolls down more than 500px within the referenced container.
 * Clicking it smoothly scrolls back to the top.
 */
const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  scrollRef,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Show button when scroll position exceeds 500px
      setIsVisible(container.scrollTop > 500);
    };

    container.addEventListener('scroll', handleScroll);
    // Initial check
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="เลื่อนกลับด้านบน"
      className={`
        fixed bottom-4 left-4 z-50 h-8 w-8 rounded-full
        bg-blue-600 text-white shadow-lg
        flex items-center justify-center
        transition-opacity duration-300 ease-in-out
        ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
        ${className}
      `}
    >
      {/* Simple upward arrow icon (no external dependency) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
};

export default ScrollToTopButton;