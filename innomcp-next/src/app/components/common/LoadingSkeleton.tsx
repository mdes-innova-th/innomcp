"use client";
import React from "react";

// Base skeleton pulse block
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/40 ${className}`} />;
}

// Stat card skeleton (4 of these for Dashboard)
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-3">
      <SkeletonBlock className="h-3 w-20 mb-2" />
      <SkeletonBlock className="h-7 w-12 mb-1" />
      <SkeletonBlock className="h-2 w-16" />
    </div>
  );
}

// Task row skeleton
export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/60 px-3 py-2">
      <SkeletonBlock className="h-4 w-16 shrink-0" />
      <SkeletonBlock className="h-4 flex-1" />
      <SkeletonBlock className="h-3 w-10 shrink-0" />
    </div>
  );
}

// Chat message skeleton
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <SkeletonBlock className="h-8 w-8 rounded-full shrink-0" />
      <div className={`flex flex-col gap-1.5 max-w-[70%] ${isUser ? "items-end" : ""}`}>
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-4 w-40" />
      </div>
    </div>
  );
}
