"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface MDESImageViewerProps {
  src: string;
  alt?: string;
  prompt?: string;
  model?: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export default function MDESImageViewer({
  src,
  alt = "AI generated image",
  prompt,
  model,
  isOpen,
  onClose,
  onDownload,
}: MDESImageViewerProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Ensure portal only runs on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reset states whenever modal opens or src changes
  useEffect(() => {
    if (isOpen) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [isOpen, src]);

  // Trap focus & keyboard events & body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Basic focus trapping inside modal
      if (e.key === "Tab") {
        // We could add more sophisticated trapping, but for now just prevent leaving the document? Not strictly required.
        // Minimal implementation: if the focus leaves the modal, maybe no action. We'll just focus the close button if needed.
      }
    };

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the close button after a short delay (to allow render)
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Restore focus
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const handleDownload = useCallback(async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = alt || "image";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed, opening in new tab", error);
      window.open(src, "_blank", "noopener,noreferrer");
    }
  }, [src, alt, onDownload]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) {
      return;
    }

    try {
      const shareData: ShareData = {
        title: alt || "AI Generated Image",
        text: prompt || "",
        url: src,
      };

      // If the browser supports sharing files, try to share the image as a file
      if (navigator.canShare && navigator.canShare({ files: [new File([], "")] })) {
        try {
          const response = await fetch(src);
          const blob = await response.blob();
          const file = new File([blob], alt || "image.png", { type: blob.type || "image/png" });
          await navigator.share({ files: [file], title: alt, text: prompt });
          return;
        } catch {
          // Fallback to URL sharing
        }
      }

      await navigator.share(shareData);
    } catch (error) {
      console.warn("Share failed", error);
    }
  }, [src, alt, prompt]);

  const truncatedPrompt = prompt
    ? prompt.length > 80
      ? prompt.substring(0, 80) + "…"
      : prompt
    : "";

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="ภาพขยายที่สร้างโดย AI"
    >
      <div
        className="relative flex flex-col w-full h-full max-w-5xl mx-auto"
        onClick={(e) => {
          // Close when clicking backdrop (outside image/buttons)
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm rounded-t-lg">
          {truncatedPrompt && (
            <p className="text-white text-sm font-mono line-clamp-1 flex-1 mr-4" title={prompt}>
              {truncatedPrompt}
            </p>
          )}
          {model && (
            <span className="bg-gray-700 text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
              {model}
            </span>
          )}
        </div>

        {/* Image container */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-auto"
          style={{ touchAction: "pinch-zoom" }}
        >
          {imageLoading && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-3/4 max-w-lg max-h-lg bg-gray-700 animate-pulse rounded-lg" />
            </div>
          )}

          {imageError ? (
            <div className="flex flex-col items-center justify-center text-white gap-4">
              <p className="text-lg">ไม่สามารถโหลดรูปภาพ</p>
              <button
                onClick={() => {
                  setImageLoading(true);
                  setImageError(false);
                  // force re-fetch by adding timestamp to src?
                  const img = new Image();
                  img.src = src + "?t=" + Date.now();
                  img.onload = () => setImageLoading(false);
                  img.onerror = () => setImageError(true);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors"
              >
                ลองใหม่
              </button>
            </div>
          ) : (
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain transition-opacity duration-300"
              style={{ touchAction: "pinch-zoom", opacity: imageLoading ? 0 : 1 }}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm rounded-b-lg">
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
              aria-label="ดาวน์โหลดรูปภาพ"
              title="ดาวน์โหลด"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>ดาวน์โหลด</span>
            </button>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                aria-label="แชร์รูปภาพ"
                title="แชร์"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>แชร์</span>
              </button>
            )}
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            aria-label="ปิดหน้าต่างดูภาพ"
            title="ปิด"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>ปิด</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (!isClient) return null;

  return createPortal(isOpen ? modalContent : null, document.body);
}