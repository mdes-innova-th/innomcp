"use client";

import React, { useEffect, useState } from "react";

interface FileUploadProgressProps {
  uploadProgress: number; // 0-100
  fileSize: number; // bytes
  maxSize: number; // bytes
  fileName: string;
  onComplete?: () => void;
}

const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  uploadProgress,
  fileSize,
  maxSize,
  fileName,
  onComplete,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Calculate percentage of max size
  const sizePercentage = (fileSize / maxSize) * 100;

  // Format bytes to readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Determine progress bar color based on size percentage
  const getProgressColor = (): string => {
    if (sizePercentage >= 90) {
      return "bg-red-500"; // Red for >90%
    } else if (sizePercentage >= 70) {
      return "bg-yellow-500"; // Yellow for 70-90%
    } else {
      return "bg-green-500"; // Green for <70%
    }
  };

  // Determine background color based on size percentage
  const getBackgroundColor = (): string => {
    if (sizePercentage >= 90) {
      return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    } else if (sizePercentage >= 70) {
      return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
    } else {
      return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
    }
  };

  // Show warnings at 70% and 90%
  useEffect(() => {
    if (sizePercentage >= 90) {
      setShowWarning(true);
      setWarningMessage("⚠️ ไฟล์ใกล้ถึงขนาดสูงสุด! (>90%)");
    } else if (sizePercentage >= 70) {
      setShowWarning(true);
      setWarningMessage("⚠️ ไฟล์ใกล้ถึงขนาดที่กำหนด (>70%)");
    } else {
      setShowWarning(false);
      setWarningMessage("");
    }
  }, [sizePercentage]);

  // Auto-hide after completion
  useEffect(() => {
    if (uploadProgress >= 100) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onComplete) {
          onComplete();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [uploadProgress, onComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 w-96 rounded-lg border-2 shadow-lg p-4 transition-all duration-300 z-50 ${getBackgroundColor()}`}
    >
      {/* File name and size */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
            {fileName}
          </span>
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          {Math.round(uploadProgress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`absolute top-0 left-0 h-full ${getProgressColor()} transition-all duration-300 ease-out`}
          style={{ width: `${uploadProgress}%` }}
        />
      </div>

      {/* File size display */}
      <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
        <span>
          {formatBytes(fileSize)} / {formatBytes(maxSize)}
        </span>
        <span className="font-medium">
          {uploadProgress < 100 ? "กำลังอัปโหลด..." : "เสร็จสมบูรณ์! ✓"}
        </span>
      </div>

      {/* Warning message */}
      {showWarning && (
        <div
          className={`text-xs font-medium mt-2 p-2 rounded ${
            sizePercentage >= 90
              ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200"
              : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200"
          }`}
        >
          {warningMessage}
        </div>
      )}

      {/* Upload complete indicator */}
      {uploadProgress >= 100 && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default FileUploadProgress;
