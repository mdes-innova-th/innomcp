'use client';

import React from 'react';

interface WorkspaceToggleButtonProps {
  /** Callback to open the workspace panel */
  onOpen: () => void;
  /** Number of current artifacts (optional) */
  artifactCount?: number;
  /** Show/hide the toggle button */
  isVisible: boolean;
}

/**
 * A floating workspace toggle button for the INNOMCP platform.
 * Slides in from the right when `isVisible` is true, shows an artifact badge,
 * and displays a Thai tooltip on hover.
 */
const WorkspaceToggleButton: React.FC<WorkspaceToggleButtonProps> = ({
  onOpen,
  artifactCount,
  isVisible,
}) => {
  return (
    <div
      className={`fixed bottom-16 right-4 z-50 transition-all duration-300 ease-in-out ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-12 opacity-0 pointer-events-none'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label="เปิดพื้นที่ทำงาน"
      >
        {/* Folder icon */}
        <span className="text-lg">🗂️</span>

        {/* Artifact count badge */}
        {artifactCount !== undefined && artifactCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {artifactCount > 99 ? '99+' : artifactCount}
          </span>
        )}

        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
          เปิดพื้นที่ทำงาน
        </div>
      </button>
    </div>
  );
};

export default WorkspaceToggleButton;