"use client";

import React from "react";

interface MDESSkeletonLoaderProps {
  variant: "message" | "panel" | "avatar" | "text";
  lines?: number;
  className?: string;
}

const widthClasses = [
  "w-full",
  "w-5/6",
  "w-4/5",
  "w-3/4",
  "w-2/3",
  "w-1/2",
  "w-1/3",
];

export default function MDESSkeletonLoader({
  variant,
  lines = 3,
  className = "",
}: MDESSkeletonLoaderProps) {
  const skeletonBase = "bg-gray-200 dark:bg-gray-700 animate-pulse rounded";

  if (variant === "avatar") {
    return (
      <div
        role="status"
        aria-label="Loading..."
        className={`flex items-center justify-center ${className}`}
      >
        <div
          className={`w-12 h-12 rounded-full ${skeletonBase}`}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div
        role="status"
        aria-label="Loading..."
        className={`flex flex-col gap-2 ${className}`}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-4 ${skeletonBase} ${widthClasses[i % widthClasses.length]}`}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (variant === "message") {
    return (
      <div
        role="status"
        aria-label="Loading..."
        className={`flex gap-3 ${className}`}
      >
        <div
          className={`w-10 h-10 rounded-full flex-shrink-0 ${skeletonBase}`}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-2 flex-1">
          <div className={`h-4 w-3/4 ${skeletonBase}`} aria-hidden="true" />
          <div className={`h-4 w-1/2 ${skeletonBase}`} aria-hidden="true" />
          {lines > 2 && (
            <div className={`h-4 w-5/6 ${skeletonBase}`} aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div
        role="status"
        aria-label="Loading..."
        className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}
      >
        {/* Header */}
        <div className="flex gap-4 mb-4">
          <div
            className={`w-12 h-12 rounded-full ${skeletonBase}`}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-2 flex-1">
            <div className={`h-5 w-1/3 ${skeletonBase}`} aria-hidden="true" />
            <div className={`h-4 w-1/4 ${skeletonBase}`} aria-hidden="true" />
          </div>
        </div>
        {/* Body lines */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={`h-4 ${skeletonBase} ${
                i === lines - 1 ? "w-3/4" : "w-full"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}