"use client";

import React, { useState, useEffect, useCallback } from "react";

// --- Types ---
interface ResponsiveChatLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  workspace?: React.ReactNode;
  header: React.ReactNode;
  isSidebarOpen: boolean;
  isWorkspaceOpen: boolean;
  onSidebarClose: () => void;
  onWorkspaceClose: () => void;
}

type Breakpoint = "mobile" | "tablet" | "desktop";

// --- Hook: detect breakpoint ---
function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 640) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 640) setBreakpoint("mobile");
      else if (w < 1024) setBreakpoint("tablet");
      else setBreakpoint("desktop");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return breakpoint;
}

// --- Sub-layouts ---

const MobileLayout: React.FC<
  Omit<ResponsiveChatLayoutProps, "header">
> = ({
  sidebar,
  main,
  workspace,
  isSidebarOpen,
  isWorkspaceOpen,
  onSidebarClose,
  onWorkspaceClose,
}) => (
  <div className="flex-1 relative overflow-hidden">
    {/* Main content – always visible and full width */}
    <div className="h-full w-full">{main}</div>

    {/* Sidebar drawer overlay (from left) */}
    {isSidebarOpen && (
      <>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 z-30 transition-opacity duration-300"
          onClick={onSidebarClose}
        />
        {/* Drawer panel */}
        <aside
          className={`absolute left-0 top-0 bottom-0 w-3/4 max-w-xs bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </aside>
      </>
    )}

    {/* Workspace full overlay */}
    {isWorkspaceOpen && workspace && (
      <>
        <div
          className="absolute inset-0 bg-black/50 z-30 transition-opacity duration-300"
          onClick={onWorkspaceClose}
        />
        <div
          className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
            isWorkspaceOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {workspace}
        </div>
      </>
    )}
  </div>
);

const TabletLayout: React.FC<
  Omit<ResponsiveChatLayoutProps, "header">
> = ({
  sidebar,
  main,
  workspace,
  isSidebarOpen,
  isWorkspaceOpen,
  onSidebarClose,
  onWorkspaceClose,
}) => (
  <div className="flex-1 flex overflow-hidden">
    {/* Sidebar – permanent static column */}
    <aside className="w-64 flex-shrink-0 bg-white border-r h-full overflow-auto">
      {sidebar}
    </aside>

    {/* Main content area */}
    <div className="flex-1 relative overflow-hidden">
      {main}

      {/* Workspace overlay (from right) */}
      {isWorkspaceOpen && workspace && (
        <>
          <div
            className="absolute inset-0 bg-black/50 z-30 transition-opacity duration-300"
            onClick={onWorkspaceClose}
          />
          <div
            className={`absolute right-0 top-0 bottom-0 w-96 bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
              isWorkspaceOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {workspace}
          </div>
        </>
      )}
    </div>
  </div>
);

const DesktopLayout: React.FC<
  Omit<ResponsiveChatLayoutProps, "header">
> = ({
  sidebar,
  main,
  workspace,
  isSidebarOpen,
  isWorkspaceOpen,
  onSidebarClose,
  onWorkspaceClose,
}) => (
  <div className="flex-1 flex overflow-hidden">
    {/* Sidebar – fixed 16rem */}
    <aside className="w-64 flex-shrink-0 bg-white border-r h-full overflow-auto">
      {sidebar}
    </aside>

    {/* Main content */}
    <main className="flex-1 overflow-auto">{main}</main>

    {/* Workspace column – slides width */}
    {workspace && (
      <div
        className={`h-full bg-white border-l overflow-hidden transition-all duration-300 ${
          isWorkspaceOpen ? "w-[380px]" : "w-0"
        }`}
      >
        <div className="min-w-[380px] h-full">{workspace}</div>
      </div>
    )}
  </div>
);

// --- Main component ---
const ResponsiveChatLayout: React.FC<ResponsiveChatLayoutProps> = ({
  sidebar,
  main,
  workspace,
  header,
  isSidebarOpen,
  isWorkspaceOpen,
  onSidebarClose,
  onWorkspaceClose,
}) => {
  const breakpoint = useBreakpoint();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header – sticky */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        {header}
      </header>

      {/* Body */}
      {breakpoint === "mobile" && (
        <MobileLayout
          sidebar={sidebar}
          main={main}
          workspace={workspace}
          isSidebarOpen={isSidebarOpen}
          isWorkspaceOpen={isWorkspaceOpen}
          onSidebarClose={onSidebarClose}
          onWorkspaceClose={onWorkspaceClose}
        />
      )}

      {breakpoint === "tablet" && (
        <TabletLayout
          sidebar={sidebar}
          main={main}
          workspace={workspace}
          isSidebarOpen={isSidebarOpen}
          isWorkspaceOpen={isWorkspaceOpen}
          onSidebarClose={onSidebarClose}
          onWorkspaceClose={onWorkspaceClose}
        />
      )}

      {breakpoint === "desktop" && (
        <DesktopLayout
          sidebar={sidebar}
          main={main}
          workspace={workspace}
          isSidebarOpen={isSidebarOpen}
          isWorkspaceOpen={isWorkspaceOpen}
          onSidebarClose={onSidebarClose}
          onWorkspaceClose={onWorkspaceClose}
        />
      )}
    </div>
  );
};

export default ResponsiveChatLayout;