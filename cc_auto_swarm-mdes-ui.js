#!/usr/bin/env node
/**
 * cc_auto_swarm-mdes-ui.js — MDES UI Components Swarm
 * Generates 10 common UI components for INNOMCP in parallel.
 */
'use strict';

const { cc, runTasks, writeFile, extract, PRO } = require('./cc_lib_swarm');

const ROOT    = 'C:/Users/USER-NT/DEV/innomcp';
const OUT_DIR = 'innomcp-next/src/app/components/common';

const SYS = `You are an expert React/TypeScript/Tailwind developer.
Generate a complete, production-ready React component file.
Rules:
- First line must be "use client";
- TypeScript strict mode, all props typed with interfaces
- Tailwind CSS only (no inline styles, no CSS modules)
- Accessible (aria attributes where needed)
- Complete file — no placeholders, no TODOs
- Return ONLY the file content inside a single tsx code block
- No explanation outside the code block`;

const tasks = [
  {
    id   : 'MDESLoadingBar',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESLoadingBar.tsx`,
    msg  : `Create MDESLoadingBar.tsx — an animated indigo progress bar component for INNOMCP.
Props: value (0-100), label (default "กำลังโหลด..."), className?
Features:
- Animated fill bar using Tailwind's transition-all
- Optional pulsing shimmer animation when value < 100
- Thai label below the bar
- Accessible with role="progressbar" and aria-valuenow/min/max
- Indigo color scheme (indigo-600 fill on gray-200 track)
- Smooth 500ms transition`,
  },
  {
    id   : 'MDESSkeletonLoader',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESSkeletonLoader.tsx`,
    msg  : `Create MDESSkeletonLoader.tsx — skeleton placeholder loader for messages and panels.
Props: variant ("message" | "panel" | "avatar" | "text"), lines? (number, default 3), className?
Features:
- animate-pulse Tailwind shimmer
- "message" variant: avatar circle + 2-3 text lines
- "panel" variant: full panel with header + body lines
- "avatar" variant: just a circle
- "text" variant: multiple text lines of varying width
- All variants use bg-gray-200 dark:bg-gray-700`,
  },
  {
    id   : 'MDESScrollProgress',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESScrollProgress.tsx`,
    msg  : `Create MDESScrollProgress.tsx — scroll progress indicator for long chat windows.
Props: containerRef (React.RefObject<HTMLElement>), color? (default "indigo"), className?
Features:
- Thin bar (3px) fixed at top of the scroll container
- Reads scroll position from containerRef via onScroll event
- useState + useEffect for scrollPercent
- useCallback for scroll handler
- Smooth width transition
- z-index above content`,
  },
  {
    id   : 'MDESDivider',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESDivider.tsx`,
    msg  : `Create MDESDivider.tsx — section divider with optional label.
Props: label? (string), orientation? ("horizontal" | "vertical", default "horizontal"), className?
Features:
- Horizontal: full-width line with optional centered label
- Vertical: full-height line (for flex/grid usage)
- Label styled with small caps, gray-500 text, bg-white padding
- Border color: gray-200
- Works in dark mode: dark:border-gray-700 dark:bg-gray-900`,
  },
  {
    id   : 'MDESKbd',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESKbd.tsx`,
    msg  : `Create MDESKbd.tsx — keyboard key display component for shortcut displays.
Props: keys (string | string[]), separator? (string, default "+"), className?
Features:
- Renders each key as a <kbd> styled element
- Keys look like physical keyboard keys: border, shadow-sm, rounded, font-mono
- Supports array of keys joined by separator
- Small size appropriate for inline shortcut hints
- Example: <MDESKbd keys={["Ctrl", "K"]} /> renders Ctrl + K
- Dark mode support`,
  },
  {
    id   : 'MDESHighlight',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESHighlight.tsx`,
    msg  : `Create MDESHighlight.tsx — text highlight component for search result highlighting.
Props: text (string), highlight (string), highlightClassName? (default: yellow bg), caseSensitive? (boolean)
Features:
- Splits text into segments: normal and highlighted
- Wraps highlighted segments in <mark> with Tailwind classes
- Default highlight: bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100
- Case-insensitive by default
- Handles empty highlight gracefully (returns plain text)
- Uses useMemo for performance`,
  },
  {
    id   : 'MDESCopyButton',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESCopyButton.tsx`,
    msg  : `Create MDESCopyButton.tsx — copy-to-clipboard button with Thai feedback.
Props: text (string), label? (string, default "คัดลอก"), successLabel? (string, default "คัดลอกแล้ว"), timeout? (ms, default 2000), className?
Features:
- Uses navigator.clipboard.writeText
- Shows checkmark icon + "คัดลอกแล้ว" for 2 seconds after copy
- Copy icon (SVG inline) + label text
- Tailwind button styling with hover state
- useCallback + useState for copied state
- Accessible: aria-label changes on copy`,
  },
  {
    id   : 'MDESResizablePanel',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESResizablePanel.tsx`,
    msg  : `Create MDESResizablePanel.tsx — resizable panel using CSS resize property.
Props: defaultWidth? (number, px), defaultHeight? (number, px), direction? ("horizontal" | "vertical" | "both", default "horizontal"), minWidth? minHeight? maxWidth? maxHeight?, children, className?
Features:
- Uses CSS resize + overflow-auto for browser-native resize handle
- Optional min/max constraints via style prop
- Wraps children in a div with resize class
- Shows resize handle hint in bottom-right corner
- Works without JavaScript event handlers`,
  },
  {
    id   : 'MDESCollapseSection',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESCollapseSection.tsx`,
    msg  : `Create MDESCollapseSection.tsx — collapsible section with smooth animation.
Props: title (string), defaultOpen? (boolean, default false), children, className?, titleClassName?
Features:
- Toggle open/close with smooth height animation
- Uses CSS grid rows trick for smooth height transition: grid-rows-[0fr] → grid-rows-[1fr]
- Chevron icon that rotates 180deg when open (CSS transform)
- Accessible: aria-expanded on button
- Title is a button element
- Inner div with overflow-hidden`,
  },
  {
    id   : 'MDESProgressSteps',
    model: PRO,
    max  : 4000,
    out  : `${OUT_DIR}/MDESProgressSteps.tsx`,
    msg  : `Create MDESProgressSteps.tsx — numbered step progress indicator (like Manus task progress).
Props: steps (Array<{label: string, description?: string}>), currentStep (number, 0-indexed), className?
Features:
- Horizontal step indicator with numbered circles
- Completed steps: filled indigo circle with checkmark
- Current step: indigo ring with indigo number
- Future steps: gray circle with gray number
- Connecting lines between steps (completed = indigo, future = gray)
- Step label below each circle
- Optional description text
- Responsive: labels can truncate on small screens`,
  },
];

(async () => {
  console.log(`\n🚀 MDES UI Swarm — ${tasks.length} components in parallel\n`);
  const { ok, fail, failed, totalTok, elapsed } = await runTasks(tasks, ROOT, SYS);
  console.log(`\n── Summary ─────────────────────────────`);
  console.log(`   OK   : ${ok}/${tasks.length}`);
  console.log(`   FAIL : ${fail}`);
  if (failed.length) console.log(`   FAILED: ${failed.join(', ')}`);
  console.log(`   Tokens: ~${totalTok.toLocaleString()}`);
  console.log(`   Time  : ${elapsed}s`);
  console.log(`────────────────────────────────────────\n`);
  // Machine-readable last line for orchestrator
  console.log(`RESULT: Swarm swarm-mdes-ui: ${ok}/${tasks.length} OK, ~${totalTok}tok`);
})();
