"use client";

import React, { useEffect, useState } from "react";

interface GeneratedImageCardProps {
  imageUrl: string;
  imageBase64?: string;
  imagePrompt?: string;
  imageProvider?: string;
  imageModel?: string;
  imageSource?: "gateway" | "pollinations";
  theme?: string;
}

const GeneratedImageCard: React.FC<GeneratedImageCardProps> = ({
  imageUrl,
  imageBase64,
  imagePrompt,
  imageProvider,
  imageModel,
  imageSource,
  theme = "light",
}) => {
  const src = imageUrl || (imageBase64 ? `data:image/png;base64,${imageBase64}` : "");
  const hasImageSource = Boolean(src);
  const [loading, setLoading] = useState(hasImageSource);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const isGateway = imageSource === "gateway";
  const providerLabel = imageProvider
    ? `${imageProvider}${imageModel ? ` · ${imageModel}` : ""}`
    : "AI Generator";
  const isDark = theme === "dark";

  useEffect(() => {
    setLoading(hasImageSource);
    setError(false);
  }, [hasImageSource, src]);

  const handleDownload = () => {
    if (!hasImageSource) return;
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
    setRetryKey((value) => value + 1);
  };

  return (
    <div
      className={`my-4 overflow-hidden rounded-[28px] border shadow-[0_24px_48px_oklch(0_0_0/0.08)] ${
        isDark ? "border-white/10 bg-white/5" : "border-primary/10 bg-card"
      }`}
      data-testid="generated-image-card"
    >
      <div className={`border-b px-4 py-3 ${isDark ? "border-white/8 bg-white/4" : "border-border/60 bg-primary/6"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {isGateway && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isDark ? "bg-blue-500/16 text-blue-300" : "bg-blue-500/12 text-blue-800"
                  }`}
                >
                  MDES Gateway
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
                  isDark ? "bg-white/8 text-white/70" : "bg-background/80 text-muted-foreground ring-1 ring-border/60"
                }`}
              >
                {providerLabel}
              </span>
            </div>

            <div className="font-display mt-3 text-xl leading-tight text-foreground">ภาพที่สร้างจากคำสั่งนี้</div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {imagePrompt || "ระบบเก็บเฉพาะ metadata และ prompt ของภาพไว้ เพื่อไม่ให้ browser history โตเกินจำเป็น"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 self-start">
            <button
              onClick={handleDownload}
              title="ดาวน์โหลดรูปภาพ"
              disabled={!hasImageSource}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                isDark
                  ? "bg-white/8 text-white/70 hover:bg-white/12 hover:text-white"
                  : "bg-background/90 text-muted-foreground ring-1 ring-border/60 hover:bg-muted"
              } ${!hasImageSource ? "pointer-events-none opacity-40" : ""}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              ดาวน์โหลด
            </button>
            <a
              href={src || "#"}
              target="_blank"
              rel="noopener noreferrer"
              title="เปิดภาพขนาดเต็ม"
              aria-disabled={!hasImageSource}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                isDark
                  ? "bg-white/8 text-white/70 hover:bg-white/12 hover:text-white"
                  : "bg-background/90 text-muted-foreground ring-1 ring-border/60 hover:bg-muted"
              } ${!hasImageSource ? "pointer-events-none opacity-40" : ""}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              เปิดเต็ม
            </a>
          </div>
        </div>
      </div>

      <div className={`relative aspect-square max-h-[512px] w-full ${isDark ? "bg-black/10" : "bg-muted/40"}`}>
        {!hasImageSource && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center ${
              isDark ? "bg-white/5 text-white/70" : "bg-primary/4 text-black/60"
            }`}
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-white/8" : "bg-background/90 ring-1 ring-border/60"}`}>
              <svg className="h-8 w-8 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h9" />
                <path d="M16 3h5v5" />
                <path d="M21 3l-7 7" />
              </svg>
            </div>
            <div className="text-sm font-semibold">ไม่ได้เก็บไฟล์ภาพไว้ใน browser history</div>
            <div className="max-w-sm text-xs leading-6 opacity-80">
              เพื่อลดการใช้ localStorage ระบบจะเก็บเฉพาะ prompt และ metadata ของภาพที่สร้างไว้ คุณยังสามารถสร้างภาพใหม่จาก prompt เดิมได้
            </div>
          </div>
        )}

        {hasImageSource && loading && !error && (
          <div className={`absolute inset-0 flex items-center justify-center ${isDark ? "bg-white/5" : "bg-primary/4"} animate-pulse`}>
            <svg className="h-12 w-12 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {error && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${
              isDark ? "bg-red-900/20 text-red-300" : "bg-red-50 text-red-600"
            }`}
          >
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm font-medium">ไม่สามารถโหลดรูปภาพได้</span>
            <button
              onClick={handleRetry}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isDark ? "border-red-400/40 hover:bg-red-400/10" : "border-red-400/40 hover:bg-red-50"
              }`}
            >
              ลองใหม่
            </button>
          </div>
        )}

        {!error && hasImageSource && (
          <div className="group/img relative h-full w-full">
            <img
              key={retryKey}
              src={src}
              alt={imagePrompt || "AI Generated Image"}
              className={`max-h-[512px] h-auto w-full object-contain transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
              loading="lazy"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
            {/* Phase 10.39 — hover floating action chip (download). The bare
                button has been here all along; expose it visibly on hover. */}
            {!loading && (
              <button
                onClick={handleDownload}
                data-testid="image-download-btn"
                title="ดาวน์โหลดภาพ"
                aria-label="ดาวน์โหลดภาพ"
                className="absolute right-2.5 top-2.5 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 text-[12px] font-medium text-white opacity-0 backdrop-blur-md transition-all hover:bg-black/75 hover:scale-105 group-hover/img:opacity-100 focus-visible:opacity-100"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                บันทึก
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`flex items-center justify-between gap-3 border-t px-4 py-3 text-xs ${isDark ? "border-white/8 bg-white/4" : "border-border/60 bg-background/85"}`}>
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 font-medium text-primary">AI Artwork</span>
          <span className="truncate">{imageSource === "pollinations" ? "Pollinations fallback" : "Primary image pipeline"}</span>
        </div>
        <div className="text-right text-muted-foreground">
          {imagePrompt ? `prompt: ${imagePrompt.slice(0, 48)}${imagePrompt.length > 48 ? "…" : ""}` : "metadata only"}
        </div>
      </div>
    </div>
  );
};

export default GeneratedImageCard;
