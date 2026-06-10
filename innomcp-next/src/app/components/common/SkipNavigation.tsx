// SkipNavigation.tsx — Component for accessibility skip link (ข้ามไปเนื้อหาหลัก)
// Allows keyboard users to skip to the main content area.
// Hidden by default, visible on focus with MDES branding.

'use client';

import React, { useCallback } from 'react';

interface SkipNavigationProps {
  /** The ID of the element to scroll/focus when the skip link is activated. Defaults to "main-content". */
  targetId?: string;
}

const SkipNavigation: React.FC<SkipNavigationProps> = ({ targetId = 'main-content' }) => {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      const targetElement = document.getElementById(targetId);
      if (!targetElement) {
        // Fallback: scroll to top if target is not found
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Scroll to the target element
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Focus the target element for keyboard users
      // If the element is not naturally focusable, add tabindex="-1" temporarily
      const isFocusable =
        targetElement.hasAttribute('tabindex') ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(targetElement.tagName);
      if (!isFocusable) {
        targetElement.setAttribute('tabindex', '-1');
        // Clean up tabindex after blur to avoid interfering with normal tab order
        const removeTabIndex = () => {
          targetElement.removeAttribute('tabindex');
        };
        targetElement.addEventListener('blur', removeTabIndex, { once: true });
      }
      targetElement.focus({ preventScroll: true }); // prevent scroll because already scrolled
    },
    [targetId]
  );

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="!fixed top-0 left-0 z-50 sr-only focus:not-sr-only focus:bg-white focus:text-blue-700 focus:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:p-4"
      // Ensure the link is always fixed (overrides sr-only's position:absolute)
      // MDES brand styling on focus: white background, blue text, underline, and blue focus ring
    >
      ข้ามไปเนื้อหาหลัก
    </a>
  );
};

export default SkipNavigation;