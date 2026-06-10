"use client";

import React from "react";

interface ChatSkeletonProps {
  lines?: number; // number of skeleton message rows, default 3
}

const ChatSkeleton: React.FC<ChatSkeletonProps> = ({ lines = 3 }) => {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header skeleton */}
      <div className="flex h-12 w-full items-center bg-muted/50 animate-pulse px-4">
        <div className="h-6 w-32 rounded bg-muted-foreground/20" />
        <div className="ml-auto h-6 w-20 rounded bg-muted-foreground/20" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton (hidden on mobile) */}
        <aside className="hidden md:flex w-64 flex-col bg-muted/30 animate-pulse p-4 space-y-4">
          <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
          <div className="h-4 w-1/2 rounded bg-muted-foreground/20" />
          <div className="h-4 w-5/6 rounded bg-muted-foreground/20" />
          <div className="h-4 w-2/3 rounded bg-muted-foreground/20" />
          <div className="h-4 w-3/4 rounded bg-muted-foreground/20" />
        </aside>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {Array.from({ length: lines }).map((_, index) => {
              const isUser = index % 2 === 0; // alternate alignment
              return (
                <div
                  key={index}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl p-3 animate-pulse ${
                      isUser
                        ? "bg-primary/20 rounded-br-sm"
                        : "bg-muted/50 rounded-bl-sm"
                    }`}
                  >
                    <div className="h-3 w-24 rounded bg-muted-foreground/20 mb-2" />
                    <div className="h-3 w-48 rounded bg-muted-foreground/20 mb-2" />
                    <div className="h-3 w-32 rounded bg-muted-foreground/20" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer skeleton */}
          <div className="border-t border-border p-4 bg-background">
            <div className="flex items-center gap-2 animate-pulse">
              <div className="flex-1 h-10 rounded-full bg-muted/50" />
              <div className="h-10 w-10 rounded-full bg-muted/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSkeleton;