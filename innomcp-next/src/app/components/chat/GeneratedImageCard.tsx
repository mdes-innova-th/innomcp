"use client";

import React, { useState } from "react";
import Image from "next/image";

interface GeneratedImageCardProps {
  imageUrl: string;
  imageBase64?: string;
  imagePrompt?: string;
  imageProvider?: string;
  imageModel?: string;
  imageSource?: "gateway" | "pollinations";
  theme?: string;
}

/**
 * GeneratedImageCard — renders an AI-generated image inline in the chat.
 * Supports:
 *  - Gateway images (base64 data URIs or external URLs)
 *  - Pollinations.ai URLs
 *  - Loading skeleton while image loads
 *  - Error fallback with retry
 *  - Download + open-fullscreen buttons
 *  - Provider attribution badge
 */
const GeneratedImageCard: React.FC<GeneratedImageCardProps> = ({
  imageUrl,
  imageBase64,
  imagePrompt,
  imageProvider,
  imageModel,
  imageSource,
  theme = "light",
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const src = imageUrl || (imageBase64 ? `data:image/png;base64,${imageBase64}` : "");
  const isGateway = imageSource === "gateway";
  const providerLabel = imageProvider
    ? `${imageProvider}${imageModel ? ` · ${imageModel}` : ""}`
    : "AI Generator";

  const isDark = theme === "dark";

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = `generated-${Date.now()}.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  return (
    <div
      className={`my-3 rounded-xl overflow-hidden border ${
        isDark
          ? "border-white/10 bg-white/5"
          : "border-black/8 bg-black/3"
      } shadow-sm`}
      data-testid="generated-image-card"
    >
      {/* Image area */}
      <div className="relative w-full" style={{ aspectRatio: "1 / 1", maxHeight: 512 }}>
        {/* Loading skeleton */}
        {loading && !error && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              isDark ? "bg-white/5" : "bg-black/4"
            } animate-pulse`}
          >
            <svg
              className="w-10 h-10 opacity-20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${
              isDark ? "bg-red-900/20 text-red-300" : "bg-red-50 text-red-600"
            }`}
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm">ไม่สามารถโหลดรูปภาพได้</span>
            <button
              onClick={handleRetry}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                isDark
                  ? "border-red-400/40 hover:bg-red-400/10"
                  : "border-red-400/40 hover:bg-red-50"
              }`}
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Actual image */}
        {!error && src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={retryKey}
            src={src}
            alt={imagePrompt || "AI Generated Image"}
            className={`w-full h-auto object-contain transition-opacity duration-300 ${
              loading ? "opacity-0" : "opacity-100"
            }`}
            style={{ maxHeight: 512 }}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}
      </div>

      {/* Footer bar */}
      <div
        className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${
          isDark ? "bg-white/5 border-t border-white/8" : "bg-black/3 border-t border-black/6"
        }`}
      >
        {/* Provider badge + prompt */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Gateway badge */}
          {isGateway && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                isDark
                  ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30"
                  : "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
              }`}
            >
              MDES
            </span>
          )}
          <span className={`truncate ${isDark ? "text-white/50" : "text-black/45"}`}>
            🎨 {providerLabel} {imagePrompt ? `· "${imagePrompt.slice(0, 60)}${imagePrompt.length > 60 ? "…" : ""}"` : ""}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDownload}
            title="ดาวน์โหลดรูปภาพ"
            className={`p-1 rounded transition-colors ${
              isDark
                ? "hover:bg-white/10 text-white/50 hover:text-white/80"
                : "hover:bg-black/8 text-black/40 hover:text-black/70"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            title="เปิดภาพขนาดเต็ม"
            className={`p-1 rounded transition-colors ${
              isDark
                ? "hover:bg-white/10 text-white/50 hover:text-white/80"
                : "hover:bg-black/8 text-black/40 hover:text-black/70"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default GeneratedImageCard;
