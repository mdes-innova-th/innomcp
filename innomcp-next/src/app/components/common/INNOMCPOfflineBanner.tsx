'use client';

import { useEffect, useState, useCallback } from 'react';

interface INNOMCPOfflineBannerProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  retryIn?: number;
  onRetry?: () => void;
}

export default function INNOMCPOfflineBanner({
  isConnected,
  isReconnecting = false,
  retryIn,
  onRetry,
}: INNOMCPOfflineBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [flashConnected, setFlashConnected] = useState(false);
  const [countdown, setCountdown] = useState(retryIn ?? 0);

  // Animate banner visibility based on connection state
  useEffect(() => {
    if (isConnected) {
      // If we were showing a banner before, first flash green then hide
      if (showBanner) {
        setFlashConnected(true);
        const timer = setTimeout(() => {
          setFlashConnected(false);
          setShowBanner(false);
        }, 2000); // green flash duration
        return () => clearTimeout(timer);
      }
      // Already connected, ensure hidden
      setShowBanner(false);
      setFlashConnected(false);
    } else {
      // Disconnected – show banner
      setShowBanner(true);
    }
  }, [isConnected, showBanner]);

  // Manage countdown timer
  useEffect(() => {
    if (!retryIn || retryIn <= 0) {
      setCountdown(0);
      return;
    }
    setCountdown(retryIn);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryIn]);

  // Determine banner type and message
  const bannerClass = flashConnected
    ? 'bg-green-600 text-white'
    : isReconnecting
      ? 'bg-amber-500 text-white'
      : 'bg-red-600 text-white';

  const icon = flashConnected
    ? '✓'
    : isReconnecting
      ? '⟳'
      : '✕';

  let message: string;
  if (flashConnected) {
    message = 'เชื่อมต่อแล้ว';
  } else if (isReconnecting) {
    message = 'กำลังเชื่อมต่อใหม่...';
  } else {
    message = 'ไม่สามารถเชื่อมต่อ INNOMCP ได้ — คลิกเพื่อลองใหม่';
  }

  // Animation class for slide in/out
  const animationClass = showBanner ? 'translate-y-0' : '-translate-y-full';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${animationClass} ${bannerClass}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{icon}</span>
          <span className="text-sm font-medium">{message}</span>
        </div>

        {/* Retry button (only when offline and not reconnecting) */}
        {!isConnected && !isReconnecting && !flashConnected && (
          <div className="flex items-center gap-2">
            {retryIn !== undefined && retryIn > 0 && (
              <span className="text-xs opacity-80">
                ({countdown} วินาที)
              </span>
            )}
            <button
              onClick={onRetry}
              className="px-3 py-1 text-sm font-semibold bg-white text-red-600 rounded hover:bg-gray-100 transition-colors"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Spinning indicator when reconnecting */}
        {isReconnecting && !flashConnected && (
          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}