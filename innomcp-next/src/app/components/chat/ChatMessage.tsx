"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useTheme } from "@/app/context/ThemeContext";
import { useAuth } from "@/app/context/AuthContext";
import { useToast } from "@/app/context/ToastContext";
import ToolTypeBadge from "./ToolTypeBadge";
import EvidenceDashboard from "./EvidenceDashboard";
import GeneratedImageCard from "./GeneratedImageCard";

type Props = {
  html: string;
  className?: string;
  structuredContent?: any;
};

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] || []), "class"], // Allow class attributes on all elements for styling; do NOT allow inline `style` to reduce XSS risk
  },
};

export default function ChatMessage({
  html,
  className,
  structuredContent,
}: Props) {
  const [copiedChart, setCopiedChart] = React.useState(false);
  // Phase 10.62 — APOD lazy-load shimmer + onError fallback.
  // Two flags drive the UI: while !apodLoaded we paint a shimmering violet/sky
  // skeleton (the same brand tint as the card header), and on apodError we
  // swap the img for a quiet placeholder card so the bubble never collapses.
  const [apodLoaded, setApodLoaded] = React.useState(false);
  const [apodError, setApodError] = React.useState(false);
  const { theme } = useTheme();
  const rawMapTiles = Array.isArray(structuredContent?.weatherPayload?.mapTiles)
    ? structuredContent.weatherPayload.mapTiles
    : [];
  const hasProvinceMissingError = Array.isArray(structuredContent?.weatherPipeline)
    ? structuredContent.weatherPipeline.some((item: any) => String(item?.error || "") === "PROVINCE_MISSING")
    : false;
  // Filter tiles: exclude fallback/no-area tiles and any default.svg placeholder
  const mapTiles = rawMapTiles.filter((tile: any) => {
    const area = String(tile?.area || "").trim();
    const url = String(tile?.url || "").trim();
    if (!area || area === "ไม่ระบุพื้นที่" || area === "ประเทศไทย") return false;
    // Exclude any URL whose path contains default.svg (with or without query params)
    try {
      const pathname = new URL(url, "http://localhost").pathname;
      if (pathname.includes("default.svg")) return false;
    } catch {
      if (url.includes("default.svg")) return false;
    }
    return true;
  });

  // Placeholder strings emitted by backend when a field has no real data
  const PLACEHOLDER_STRINGS = new Set([
    "ยังไม่มีข้อมูล", "ยังไม่มี", "—", "-", "N/A", "n/a", "null", "undefined", "",
  ]);
  const isPlaceholder = (v: any): boolean => {
    const s = String(v ?? "").trim();
    return PLACEHOLDER_STRINGS.has(s) || s.startsWith("ยังไม่");
  };

  // Returns true only when the weather payload contains actual retrieved data,
  // not just a generated placeholder. Guards against showing the map section
  // when all upstream tools returned errors (TMD_AUTH_FAIL, NWP_UNAVAILABLE, etc.).
  const hasRealWeatherData = (payload: any): boolean => {
    if (!payload || typeof payload !== "object") return false;

    // Fast-fail: if ALL errTaxonomy buckets > 0 and no sources used, no real data
    const tax = payload.errTaxonomy;
    if (tax && typeof tax === "object") {
      const errTotal = (tax.timeout || 0) + (tax.noData || 0) + (tax.upstream || 0);
      const topSrc = Array.isArray(payload.sourcesUsed) ? payload.sourcesUsed.length : 0;
      if (errTotal > 0 && topSrc === 0) return false;
    }

    // Top-level sourcesUsed: any entry means at least one tool returned real data
    const topSources = Array.isArray(payload.sourcesUsed) ? payload.sourcesUsed : [];
    if (topSources.length > 0) return true;

    const areas = Array.isArray(payload.areas) ? payload.areas : [];
    // Exclude fallback-only areas ("ไม่ระบุพื้นที่" / "ประเทศไทย" without sources)
    const realAreas = areas.filter((a: any) => {
      const name = String(a?.area || "").trim();
      return name && name !== "ไม่ระบุพื้นที่";
    });

    // Area-level sourcesUsed
    if (realAreas.some((a: any) => Array.isArray(a?.sourcesUsed) && a.sourcesUsed.length > 0)) return true;
    // Area has a numeric rainChancePct — only set when real forecast data exists
    if (realAreas.some((a: any) => typeof a?.rainChancePct === "number")) return true;
    // Area has a real temperature value (not a placeholder)
    if (realAreas.some((a: any) => !isPlaceholder(a?.temperature))) return true;
    // Area has a real wind value (not a placeholder)
    if (realAreas.some((a: any) => !isPlaceholder(a?.wind))) return true;

    return false;
  };

  const handleCopyChartCode = async () => {
    try {
      if (structuredContent?.chartSvg) {
        await navigator.clipboard.writeText(structuredContent.chartSvg);
        setCopiedChart(true);
        setTimeout(() => setCopiedChart(false), 1500);
      }
    } catch (err) {
      console.error("Failed to copy chart code:", err);
    }
  };

  const handleDownloadChart = () => {
    if (structuredContent?.chartSvg) {
      const element = document.createElement("a");
      const file = new Blob([structuredContent.chartSvg], {
        type: "image/svg+xml",
      });
      element.href = URL.createObjectURL(file);
      element.download = `chart-${Date.now()}.svg`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
    }
  };

  return (
    <div className={className ?? ""}>
      <div className="prose prose-sm wrap-break-word dark:prose-invert">
        {/* Evidence Dashboard (structuredContent-only) */}
        <EvidenceDashboard structuredContent={structuredContent} />

        {/* Display NASA APOD Image — Phase 10.59 themed card */}
        {structuredContent?.url && structuredContent?.media_type === 'image' && (
          <div className="mb-4 overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/8 via-sky-500/4 to-transparent shadow-sm dark:border-violet-400/25 dark:from-violet-900/15">
            <div className="flex items-center justify-between gap-2 border-b border-violet-500/15 bg-violet-500/8 px-3 py-2 dark:border-violet-400/15">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-900 dark:text-violet-100">
                <span aria-hidden="true">🚀</span>
                NASA APOD · ภาพอวกาศประจำวัน
              </span>
              <a
                href={structuredContent.hdurl || structuredContent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-500/20 transition-colors hover:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/25"
                title="เปิดภาพขนาดเต็ม"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                เต็มจอ
              </a>
            </div>
            <div className="group/apod relative overflow-hidden">
              {/* Skeleton shimmer — hides itself as soon as apodLoaded or apodError flips.
                  aspect-[4/3] reserves space so the bubble doesn't jump when the
                  image lands; the gradient matches the card header brand tint. */}
              {!apodLoaded && !apodError && (
                <div
                  className="skeleton-shimmer aspect-[4/3] w-full bg-gradient-to-br from-violet-500/15 via-sky-500/10 to-violet-400/8"
                  aria-hidden="true"
                />
              )}
              {!apodError && (
                <img
                  src={structuredContent.hdurl || structuredContent.url}
                  alt={structuredContent.title || 'NASA Astronomy Picture of the Day'}
                  className={`h-auto w-full transition-all duration-500 group-hover/apod:scale-[1.01] ${
                    apodLoaded ? "opacity-100" : "absolute inset-0 opacity-0"
                  }`}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setApodLoaded(true)}
                  onError={() => setApodError(true)}
                />
              )}
              {apodError && (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-violet-500/12 via-sky-500/8 to-transparent text-center text-violet-900/80 dark:text-violet-100/80">
                  <span aria-hidden="true" className="text-2xl">🌌</span>
                  <p className="text-[12.5px] font-medium">โหลดภาพอวกาศไม่สำเร็จ</p>
                  <a
                    href={structuredContent.hdurl || structuredContent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-600 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    ลองเปิดในแท็บใหม่
                  </a>
                </div>
              )}
              {structuredContent.title && apodLoaded && !apodError && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white">
                  <p className="text-[13.5px] font-semibold leading-tight">{structuredContent.title}</p>
                  {structuredContent.copyright && (
                    <p className="mt-0.5 text-[11px] text-white/75">© {structuredContent.copyright}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR Code Image — Phase 10.60 themed card with eyebrow + decoded text */}
        {structuredContent?.__qrDirect && structuredContent?.qrCodeImage && (
          <div
            className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
            data-testid="qr-code-image"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <span aria-hidden="true">🔳</span>
                QR Code
              </span>
              {structuredContent.text && (
                <span
                  className="max-w-[14rem] truncate rounded-full bg-primary/8 px-2 py-0.5 font-mono text-[10.5px] text-primary"
                  title={String(structuredContent.text)}
                >
                  {String(structuredContent.text)}
                </span>
              )}
            </div>
            <div className="flex justify-center bg-gradient-to-b from-background to-muted/30 p-4">
              <img
                src={structuredContent.qrCodeImage}
                alt={`QR Code: ${structuredContent.text || ''}`}
                className="h-auto max-w-[260px] rounded-md ring-1 ring-border/40"
              />
            </div>
          </div>
        )}

        {/* AI Generated Image: render via GeneratedImageCard (MDES Gateway or Pollinations.ai) */}
        {(structuredContent?.generatedImageUrl || structuredContent?.generatedImageBase64 || structuredContent?.imagePrompt) && (
          <GeneratedImageCard
            imageUrl={structuredContent.generatedImageUrl}
            imageBase64={structuredContent.generatedImageBase64}
            imagePrompt={structuredContent.imagePrompt}
            imageProvider={structuredContent.imageProvider}
            imageModel={structuredContent.imageModel}
            imageSource={structuredContent.imageSource}
            theme={theme}
          />
        )}

        {/* Weather unavailable notice: shown when weather was attempted but no real data */}
        {structuredContent?.weatherPayload && !hasProvinceMissingError &&
          (mapTiles.length === 0 || !hasRealWeatherData(structuredContent?.weatherPayload)) && (() => {
          const tax = structuredContent.weatherPayload?.errTaxonomy;
          const errTotal = tax ? (tax.timeout || 0) + (tax.noData || 0) + (tax.upstream || 0) : 0;
          const sources = Array.isArray(structuredContent.weatherPayload?.sourcesUsed)
            ? structuredContent.weatherPayload.sourcesUsed : [];
          if (errTotal === 0 && sources.length === 0) return null; // not a weather query
          if (errTotal === 0 && sources.length > 0) return null;  // data retrieved, map tiles just not available — text answer is fine

          // Color-coded severity: red=auth/upstream, amber=timeout, blue=noData, yellow=offline
          let icon: string;
          let reason: string;
          let colorClass: string;
          if (tax?.upstream > 0) {
            icon = "🔴";
            reason = "ขออภัย ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้ — TMD/NWP ตอบกลับผิดปกติ (อาจเกิดจาก credentials หรือ API key ไม่ถูกต้อง)";
            colorClass = "border-red-400/30 bg-red-50/30 text-red-800 dark:border-red-400/20 dark:bg-red-900/10 dark:text-red-300";
          } else if (tax?.timeout > 0) {
            icon = "🟠";
            reason = "การเชื่อมต่อ TMD/NWP ใช้เวลานานเกินไป — ลองถามใหม่อีกครั้ง";
            colorClass = "border-orange-400/30 bg-orange-50/30 text-orange-800 dark:border-orange-400/20 dark:bg-orange-900/10 dark:text-orange-300";
          } else if (tax?.noData > 0 && sources.length === 0) {
            icon = "🔵";
            reason = "ไม่พบข้อมูลอากาศสำหรับพื้นที่ที่ต้องการ (สถานีไม่มีข้อมูล หรืออาจระบุจังหวัดไม่ชัดเจน)";
            colorClass = "border-blue-400/30 bg-blue-50/30 text-blue-800 dark:border-blue-400/20 dark:bg-blue-900/10 dark:text-blue-300";
          } else if (sources.length > 0) {
            icon = "⚠️";
            reason = "ข้อมูลอากาศที่ได้รับยังไม่ครบถ้วนสำหรับการแสดงแผนที่";
            colorClass = "border-yellow-400/30 bg-yellow-50/30 text-yellow-800 dark:border-yellow-400/20 dark:bg-yellow-900/10 dark:text-yellow-300";
          } else {
            icon = "⚠️";
            reason = "ขออภัย ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้ (อาจเกิดจาก credentials หรือ mode=offline)";
            colorClass = "border-yellow-400/30 bg-yellow-50/30 text-yellow-800 dark:border-yellow-400/20 dark:bg-yellow-900/10 dark:text-yellow-300";
          }
          return (
            // Phase 10.58 — notice now reads as a labelled hint block,
            // not a raw single-line warning.
            <div
              className={`mb-3 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px] leading-snug ${colorClass}`}
              role="status"
            >
              <span className="shrink-0 text-base leading-none" aria-hidden="true">
                {icon}
              </span>
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-80">
                  สถานะข้อมูลอากาศ
                </div>
                <div className="mt-0.5">{reason}</div>
              </div>
            </div>
          );
        })()}

        {/* Weather map tiles (Phase 10.1B minimal contract renderer) */}
        {!hasProvinceMissingError && mapTiles.length > 0 && hasRealWeatherData(structuredContent?.weatherPayload) && (() => {
          const sourcesUsed: string[] = Array.isArray(structuredContent?.weatherPayload?.sourcesUsed)
            ? structuredContent.weatherPayload.sourcesUsed : [];
          return (
            <div
              data-testid="weather-map-tiles"
              className="mb-4 overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-50/50 via-sky-50/30 to-transparent shadow-sm dark:border-emerald-400/25 dark:from-emerald-900/15 dark:via-sky-900/10"
            >
              <div className="flex items-center justify-between gap-2 border-b border-emerald-500/15 bg-emerald-500/8 px-3 py-2 dark:border-emerald-400/15">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-900 dark:text-emerald-100">
                  <span aria-hidden="true">🗺️</span>
                  แผนที่สภาพอากาศ
                </span>
                {sourcesUsed.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100/95 px-2 py-0.5 font-mono text-[10.5px] font-medium text-emerald-800 ring-1 ring-emerald-500/15 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-400/20"
                    title={`แหล่งข้อมูล: ${sourcesUsed.join(", ")}`}
                  >
                    <span aria-hidden="true">📡</span>
                    {sourcesUsed.join(" · ")}
                  </span>
                )}
              </div>
              <div className="space-y-2.5 p-3">
                {mapTiles.slice(0, 3).map((tile: any, idx: number) => {
                  const url = String(tile?.url || "").trim();
                  const label = String(tile?.label || tile?.area || "แผนที่อากาศ").trim();
                  if (!url) return null;
                  return (
                    <div
                      key={`${url}-${idx}`}
                      className="group/tile overflow-hidden rounded-lg border border-emerald-500/20 bg-card shadow-[0_2px_8px_-4px_oklch(0.7_0.15_165/0.25)] transition-all hover:shadow-[0_6px_20px_-6px_oklch(0.7_0.15_165/0.35)] dark:border-emerald-400/20"
                    >
                      <img src={url} alt={label} className="h-auto w-full transition-transform duration-300 group-hover/tile:scale-[1.01]" loading="lazy" />
                      <div className="border-t border-emerald-500/15 bg-background/85 px-2.5 py-1 text-[11.5px] font-medium text-emerald-900/85 backdrop-blur-sm dark:bg-card/70 dark:text-emerald-100/85">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Display SVG chart if available */}
        {structuredContent?.chartSvg && (
          <div className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <span aria-hidden="true">📈</span> แผนภูมิ SVG
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 font-mono text-[10.5px] text-primary">
                vector
              </span>
            </div>
            <div className="flex justify-center bg-gradient-to-b from-background to-muted/30 p-4">
              <div
                className="relative inline-flex overflow-hidden rounded-md ring-1 ring-border/40"
                dangerouslySetInnerHTML={{ __html: structuredContent.chartSvg }}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 bg-muted/30 px-3 py-2">
              <button
                onClick={handleCopyChartCode}
                title="คัดลอก SVG Code"
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all ${
                  copiedChart
                    ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "border-border/70 bg-card text-foreground/80 hover:bg-muted hover:text-foreground"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
                {copiedChart ? "คัดลอกแล้ว" : "คัดลอก SVG"}
              </button>
              <button
                onClick={handleDownloadChart}
                title="ดาวน์โหลด SVG"
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11.5px] font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                ดาวน์โหลด
              </button>
            </div>
          </div>
        )}
        {/*
            Render markdown to React elements. We enable remark-gfm for GitHub Flavored Markdown.
            IMPORTANT: We DO NOT enable `rehype-raw` (do not parse raw HTML inside markdown)
            to avoid the risk of executing or injecting unsafe HTML. Any HTML-like text will
            be rendered as literal text. We still include `rehype-sanitize` for defense-in-depth
            if other rehype plugins are used, and to ensure nodes are safe should you enable
            additional rehype processing later.
          */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, schema]]}
          components={{
            h1: ({ children }) => (
              <h1
                className={`text-2xl font-bold mb-4 ${
                  theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                className={`text-lg font-bold mb-3 ${
                  theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                className={`text-lg font-bold mb-2 ${
                  theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4
                className={`text-lg font-bold mb-2 ${
                  theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h4>
            ),
            h5: ({ children }) => (
              <h5
                className={`text-lg font-bold mb-1 ${
                  theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h5>
            ),
            h6: ({ children }) => (
              <h6
                className={`text-base font-bold mb-1 ${
                  theme === "dark" ? "text-gray-100" : "text-black"
                }`}
              >
                {children}
              </h6>
            ),
            table: ({ children }) => (
              <table className="border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                {children}
              </td>
            ),
            /* Phase 10.31 — premium code/quote/link styling */
            code: ({ children, className, ...rest }) => {
              // Inline code (no language class) → tinted pill.
              if (!className || !className.includes("language-")) {
                return (
                  <code
                    className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[12.5px] text-primary dark:bg-primary/15 dark:text-primary"
                    {...rest}
                  >
                    {children}
                  </code>
                );
              }
              // Block code (inside <pre>) — let the pre wrapper handle the surface.
              return (
                <code className={`${className} font-mono text-[12.5px] leading-relaxed`} {...rest}>
                  {children}
                </code>
              );
            },
            pre: ({ children }) => {
              // Extract language from first <code>'s class if present.
              const child: any = Array.isArray(children) ? children[0] : children;
              const lang =
                (child && child.props && typeof child.props.className === "string"
                  ? child.props.className.match(/language-([\w-]+)/)?.[1]
                  : null) || "code";
              return (
                <div className="group/code my-3 overflow-hidden rounded-lg border border-border/70 bg-slate-950/95 text-slate-100 shadow-sm dark:bg-black/60">
                  <div className="flex items-center justify-between border-b border-white/8 bg-white/5 px-3 py-1.5">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-300/80">
                      {lang}
                    </span>
                    <span className="text-[10px] text-slate-400/70 opacity-0 transition-opacity group-hover/code:opacity-100">
                      โค้ดบล็อก
                    </span>
                  </div>
                  <pre className="m-0 overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed">
                    {children}
                  </pre>
                </div>
              );
            },
            blockquote: ({ children }) => (
              <blockquote className="my-3 border-l-[3px] border-primary/45 bg-primary/4 px-4 py-2 italic text-foreground/85">
                {children}
              </blockquote>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary"
              >
                {children}
              </a>
            ),
            hr: () => (
              <hr className="my-4 border-0 border-t border-border/60" />
            ),
            ul: ({ children }) => (
              <ul className="my-2 ml-4 list-disc space-y-1 text-[14px] marker:text-muted-foreground/70">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-2 ml-4 list-decimal space-y-1 text-[14px] marker:text-muted-foreground/70">
                {children}
              </ol>
            ),
          }}
        >
          {html}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// Enhanced chat message renderer used by ChatPage when passing message objects.
export type Message = {
  sender: "user" | "ai";
  text: string;
  fullText?: string;
  isAnimating?: boolean;
  structuredContent?: any;
  timestamp?: number; // Unix timestamp
  tokenCount?: number; // Number of tokens
  responseTime?: number; // Response time in ms
  toolsUsed?: string[]; // List of tools used by AI
  isComplete?: boolean;
  elapsedMs?: number;
  followUpSuggestions?: string[];
};

type EnhancedProps = {
  message: Message;
  index: number;
  className?: string;
  onUpdate: (index: number, msg: Message) => void;
  onDelete?: (index: number) => void;
  onRetry?: (index: number) => void;
  onFollowUp?: (text: string) => void;
  /** Optional inline content rendered inside this bubble (e.g. MultiAgentPanel). */
  inlineExtras?: React.ReactNode;
};

function StarRating({ messageId }: { messageId: string }) {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(false);
  const handleRate = async (stars: number) => {
    setRating(stars);
    setSubmitted(true);
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating: stars, messageId }),
      });
    } catch {}
  };
  if (submitted) return <p className="mt-1.5 text-[11px] text-muted-foreground">ขอบคุณสำหรับ feedback</p>;
  return (
    <div className="mt-2 flex items-center gap-1">
      <span className="text-[11px] text-muted-foreground mr-1">คุณพอใจแค่ไหน?</span>
      {[1,2,3,4,5].map((s) => (
        <button key={s} onClick={() => handleRate(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          className={`text-base transition-colors ${s <= (hover || rating) ? "text-amber-400" : "text-muted-foreground/40"}`}>
          ★
        </button>
      ))}
    </div>
  );
}

export function MessageView({
  message,
  index,
  className,
  onUpdate,
  onDelete,
  onRetry,
  onFollowUp,
  inlineExtras,
}: EnhancedProps) {
  const [copied, setCopied] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [showMoreActions, setShowMoreActions] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [isReading, setIsReading] = React.useState(false);
  const [likeStatus, setLikeStatus] = React.useState<"none" | "like" | "dislike">("none");
  const [showReportModal, setShowReportModal] = React.useState(false);
  const { theme } = useTheme();
  const { isGuestMode } = useAuth();
  const { notify } = useToast();

  React.useEffect(() => {
    return () => {
      // cleanup timers if any (none stored here)
    };
  }, []);

  const doCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      notify("คัดลอกข้อความแล้ว", "success", 1800);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
      notify("คัดลอกไม่สำเร็จ — ลองอีกครั้ง", "error", 2500);
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const TypingDots: React.FC = () => (
    /* Phase 10.44 — tri-tone dots (emerald → primary → sky) match the AI
       avatar gradient so the typing indicator visually belongs to MDES. */
    <span className="inline-flex items-center gap-1" aria-label="กำลังพิมพ์">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:140ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:280ms]" />
    </span>
  );

  const startEdit = () => {
    setEditValue(message.text);
    setIsEditing(true);
  };

  const saveEdit = () => {
    onUpdate(index, {
      ...message,
      text: editValue,
      fullText: editValue,
      isAnimating: false,
      timestamp: Date.now(),
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && confirm("ต้องการลบข้อความนี้?")) {
      onDelete(index);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(index);
    }
  };

  const handleBranchChat = () => {
    // Copy conversation up to this message into new chat
    const confirmed = confirm("สร้างการสนทนาใหม่จากข้อความนี้?");
    if (confirmed) {
      // Store messages in localStorage for new chat
      const messagesUpToHere = JSON.parse(localStorage.getItem("chatMessages") || "[]").slice(0, index + 1);
      localStorage.setItem("branchMessages", JSON.stringify(messagesUpToHere));
      // Reload page to start new chat with branched messages
      window.location.href = "/";
    }
  };

  const handleReadAloud = () => {
    if (isReading) {
      // Stop reading
      window.speechSynthesis.cancel();
      setIsReading(false);
    } else {
      // Start reading
      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.lang = "th-TH"; // Thai language
      utterance.rate = 0.9;
      utterance.onend = () => setIsReading(false);
      window.speechSynthesis.speak(utterance);
      setIsReading(true);
    }
  };

  // TODO #42: Handle report message with multi-checkbox modal
  const handleReportMessage = async (categories: string[]) => {
    if (categories.length === 0) return;
    
    try {
      await fetch("/api/chat/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIndex: index,
          messageText: message.text,
          categories,
          timestamp: Date.now(),
        }),
      });
      setShowReportModal(false);
      notify("ขอบคุณสำหรับการรายงาน — เราจะตรวจสอบและดำเนินการต่อไป", "success", 4500);
    } catch (error) {
      console.error("Report failed:", error);
      notify("เกิดข้อผิดพลาดในการรายงาน กรุณาลองใหม่อีกครั้ง", "error", 5000);
    }
  };

  // TODO #43: Handle like/dislike feedback
  const handleLike = async () => {
    const newStatus = likeStatus === "like" ? "none" : "like";
    setLikeStatus(newStatus);
    
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIndex: index,
          messageText: message.text,
          feedback: newStatus,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error("Like feedback failed:", error);
    }
  };

  const handleDislike = async () => {
    const newStatus = likeStatus === "dislike" ? "none" : "dislike";
    setLikeStatus(newStatus);
    
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIndex: index,
          messageText: message.text,
          feedback: newStatus,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error("Dislike feedback failed:", error);
    }
  };

  const chatMeta = (message as any)?.structuredContent?.chatMeta;
  const modeBadge = chatMeta?.mode === "online" ? "online" : "offline";
  const groundedContract = (message as any)?.structuredContent?.__groundedContract;
  const renderMeta = (message as any)?.structuredContent?.__render;
  const namesFromTools = (tools: any): string[] => Array.isArray(tools)
    ? tools
        .map((tool: any) =>
          typeof tool === "string"
            ? tool
            : String(tool?.name || tool?.toolName || tool?.id || "")
        )
        .map((name) => name.trim())
        .filter(Boolean)
    : [];
  const toolNames = Array.from(new Set([
    ...namesFromTools(chatMeta?.toolsUsed),
    ...namesFromTools(message.toolsUsed),
    ...namesFromTools(message.structuredContent?.toolsUsed),
    ...namesFromTools(groundedContract?.selectedTools),
    ...namesFromTools(renderMeta?.selectedTools),
  ]));
  const metaTools: Array<{ name: string }> = toolNames.map((name) => ({ name }));
  const toolsUsedMetaText = toolNames.length > 0 ? toolNames.join(", ") : "ไม่มี";
  const metaConfidence = Number(chatMeta?.confidence);
  const confidenceLabel = Number.isFinite(metaConfidence) ? metaConfidence.toFixed(2) : "-";
  const reasonCode = String(chatMeta?.reason_code || "");
  const guidance = Array.isArray(chatMeta?.userGuidance) ? chatMeta.userGuidance.slice(0, 2) : [];

  // Memory + RAG metadata from __groundedContract
  const memoryRag = (message as any)?.structuredContent?.__groundedContract?.memoryRag;
  const ragMode = memoryRag?.retrievalMode || null;
  const ragEntities = Array.isArray(memoryRag?.memoryEntities) ? memoryRag.memoryEntities : [];
  const ragTurn = memoryRag?.sessionTurnCount ?? 0;
  const ragColdHits = memoryRag?.coldDocHits ?? 0;

  // PS1: Answer truth from grounded contract
  const sourceType = groundedContract?.sourceType || null;
  const answerMode = groundedContract?.answerMode || null;
  const isDegraded = groundedContract?.degraded === true;
  const degradedReasons = Array.isArray(groundedContract?.degradedReasons) ? groundedContract.degradedReasons : [];
  const modelUsed = groundedContract?.modelUsed || null;
  const fallbackReason = groundedContract?.fallbackReason || null;
  // Mobile (< sm): rail is always visible so touch users can reach copy/like.
  // Desktop (≥ sm): rail fades in on hover only — keeps the chat surface calm.
  const actionRailVisibility = showActions
    ? "opacity-100 translate-y-0"
    : "opacity-100 translate-y-0 sm:pointer-events-none sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto sm:group-hover:translate-y-0 sm:focus-within:opacity-100 sm:focus-within:pointer-events-auto sm:focus-within:translate-y-0";
  const actionSurfaceClass = message.sender === "user"
    ? "border border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground"
    : "border border-border/70 bg-background/90 text-muted-foreground backdrop-blur";
  const actionButtonClass = message.sender === "user"
    ? "text-primary-foreground/85 hover:bg-primary-foreground/12"
    : theme === "light"
    ? "text-gray-600 hover:bg-gray-200/80"
    : "text-gray-300 hover:bg-white/10";

  return (
    <div
      className={`relative group px-4 py-3.5 sm:px-5 animate-bubble-in ${
        message.sender === "user"
          ? "ml-auto max-w-[min(78%,46rem)] self-end rounded-2xl rounded-br-sm bg-gradient-to-br from-primary via-primary to-primary/92 text-primary-foreground shadow-[0_4px_14px_-4px_oklch(0.65_0.18_265/0.35)]"
          : "max-w-[min(88%,50rem)] self-start rounded-2xl border border-border/70 bg-background/96 text-left shadow-[0_1px_2px_oklch(0_0_0/0.04)] dark:border-white/10 dark:bg-white/5"
      } ${className || ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      data-testid={message.sender === "user" ? "message-user" : "message-assistant"}
    >
      <div className={`mb-2.5 flex items-center gap-2 ${
        message.sender === "user" ? "text-primary-foreground/80" : "text-muted-foreground"
      }`}>
        {message.sender === "ai" ? (
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-sky-400 to-violet-500 text-[11px] font-bold text-white shadow-sm ring-1 ring-white/40 dark:ring-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M12 2 14.39 8.42 21 11l-6.61 2.58L12 20l-2.39-6.42L3 11l6.61-2.58L12 2z" />
            </svg>
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-[11px] font-semibold text-primary-foreground/95 ring-1 ring-primary-foreground/15"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 21a7 7 0 0 1 14 0" />
            </svg>
          </span>
        )}
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
            message.sender === "ai" && message.isAnimating ? "animate-pulse" : ""
          }`}
        >
          {message.sender === "user" ? "คุณ" : "MDES AI"}
        </span>
        {message.sender === "ai" && modelUsed ? (
          <span
            className="rounded-full bg-primary/8 px-2 py-0.5 font-mono text-[10px] normal-case tracking-normal text-primary dark:bg-white/8 dark:text-white/75"
            title={`Model: ${String(modelUsed)}`}
          >
            {String(modelUsed)}
          </span>
        ) : null}
      </div>

      {/* Action buttons - moved to bottom-right */}
      {!message.isAnimating && (
        <div
          className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-1.5 py-1 shadow-lg transition-all duration-200 ${actionRailVisibility} ${actionSurfaceClass}
          }`}
        >
          {/* Like/Dislike buttons (AI messages only) - TODO #43 */}
          {message.sender === "ai" && (
            <>
              <button
                title="ถูกใจ"
                className={`rounded-full p-1.5 transition-colors ${
                  likeStatus === "like"
                    ? "text-green-500"
                    : actionButtonClass
                }`}
                onClick={handleLike}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill={likeStatus === "like" ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
              </button>
              <button
                title="ไม่ถูกใจ"
                className={`rounded-full p-1.5 transition-colors ${
                  likeStatus === "dislike"
                    ? "text-red-500"
                    : actionButtonClass
                }`}
                onClick={handleDislike}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill={likeStatus === "dislike" ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                </svg>
              </button>
            </>
          )}

          {/* Copy button */}
          <div className="relative">
            <button
              title="คัดลอกข้อความ"
              className={`rounded-full p-1.5 transition-colors ${actionButtonClass}`}
              onClick={(e) => {
                e.stopPropagation();
                void doCopy(message.text);
              }}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            {copied && (
              <div className="absolute -top-8 right-0 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                คัดลอกแล้ว
              </div>
            )}
          </div>

          {/* Edit button (user messages only) */}
          {message.sender === "user" && (
            <button
              title="แก้ไขข้อความ"
              className={`rounded-full p-1.5 transition-colors ${actionButtonClass}`}
              onClick={startEdit}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          )}

          {/* Try Again button (AI messages only) */}
          {message.sender === "ai" && onRetry && (
            <button
              title="ตอบใหม่อีกครั้ง"
              className={`rounded-full p-1.5 transition-colors ${actionButtonClass}`}
              onClick={handleRetry}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          )}

          {/* More Actions button (AI messages only) */}
          {message.sender === "ai" && (
            <div className="relative">
              <button
                title="การทำงานเพิ่มเติม"
                className={`rounded-full p-1.5 transition-colors ${actionButtonClass}`}
                onClick={() => setShowMoreActions(!showMoreActions)}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
              {showMoreActions && (
                <div
                  className={`chat-elevated-panel absolute bottom-full right-0 z-10 mb-2 w-64 overflow-hidden rounded-[22px] ${
                    theme === "light"
                      ? "border border-gray-200 bg-white"
                      : "border border-gray-700 bg-gray-800"
                  }`}
                >
                  <button
                    onClick={() => {
                      handleBranchChat();
                      setShowMoreActions(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${
                      theme === "light"
                        ? "hover:bg-gray-100 text-gray-700"
                        : "hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                    </svg>
                    แตกแขนงเป็นแชตใหม่
                  </button>
                  <button
                    onClick={() => {
                      handleReadAloud();
                      setShowMoreActions(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${
                      theme === "light"
                        ? "hover:bg-gray-100 text-gray-700"
                        : "hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                    {isReading ? "หยุดอ่านออกเสียง" : "อ่านออกเสียง"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReportModal(true);
                      setShowMoreActions(false);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm rounded-b-lg ${
                      theme === "light"
                        ? "hover:bg-red-50 text-red-600"
                        : "hover:bg-red-900/20 text-red-400"
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    รายงานข้อความนี้
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delete button */}
          {onDelete && (
            <button
              title="ลบข้อความ"
              className={`p-1 rounded ${
                message.sender === "user"
                  ? "text-white hover:bg-red-600"
                  : theme === "light"
                  ? "text-gray-600 hover:bg-red-100"
                  : "text-gray-400 hover:bg-red-900"
              }`}
              onClick={handleDelete}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Edit mode — Phase 10.56 themed input + Ctrl+Enter save shortcut. */}
      {isEditing ? (
        <div>
          <textarea
            className="mb-2 w-full rounded-lg border border-border/70 bg-background/95 p-2.5 text-[14px] leading-6 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/20"
            value={editValue}
            rows={Math.max(2, editValue.split("\n").length)}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                saveEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsEditing(false);
              }
            }}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 text-[12px]">
            <span className="mr-auto inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
              <kbd className="inline-flex h-4 min-w-[26px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
                {typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"}
              </kbd>
              <span aria-hidden="true">+</span>
              <kbd className="inline-flex h-4 min-w-[26px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
                ↵
              </kbd>
              <span>บันทึก</span>
              <span className="ml-1 opacity-60">·</span>
              <kbd className="inline-flex h-4 min-w-[28px] items-center justify-center rounded border border-border/70 bg-background px-1 font-mono text-[10px] leading-none shadow-[inset_0_-1px_0_var(--border)]">
                Esc
              </kbd>
              <span>ยกเลิก</span>
            </span>
            <button
              className="rounded-md bg-muted px-3 py-1 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted/70"
              onClick={() => setIsEditing(false)}
            >
              ยกเลิก
            </button>
            <button
              className="rounded-md bg-primary px-3 py-1 text-[12.5px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              onClick={saveEdit}
            >
              บันทึก
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tool Type Badge - Only show in auto mode with tools used */}
          {message.sender === "ai" && !isGuestMode && message.toolsUsed && message.toolsUsed.length > 0 && (
            <ToolTypeBadge 
              toolType="auto"
              toolsUsed={message.toolsUsed}
              theme={theme}
            />
          )}
          
          {/* AI message technical metadata — collapsed by default to keep the canvas calm */}
          {message.sender === "ai" && (() => {
            const summaryToolName = (() => {
              if (metaTools.length > 0) {
                const first = String(metaTools[0]?.name || "").trim();
                return first || (message.structuredContent?.toolsUsed?.[0] ?? "");
              }
              return message.structuredContent?.toolsUsed?.[0] ?? "";
            })();

            const sourceTypeLabel =
              sourceType === "deterministic" ? "ข้อมูลตรง" :
              sourceType === "tool-only" ? "เครื่องมือ" :
              sourceType === "tool+rewrite" ? "เครื่องมือ+AI" :
              sourceType ? "AI" : "";

            // Map sourceType to a tinted pill for premium feel.
            const sourceTypeTone =
              sourceType === "deterministic" ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
              : sourceType === "tool-only" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : sourceType === "tool+rewrite" ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
              : sourceType ? "bg-muted/60 text-muted-foreground" : "";

            return (
              <details
                className="group/meta mb-2 -mt-1 rounded-md text-xs text-muted-foreground"
                data-testid="tool-meta-row"
              >
                <summary
                  className="flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none rounded-md px-1.5 py-0.5 transition-all hover:bg-muted/40"
                >
                  {/* Compact: just the status dot + mode badge. Full details inside the opened body. */}
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                      modeBadge === "online"
                        ? "bg-emerald-100/60 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${modeBadge === "online" ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {modeBadge}
                  </span>
                  {isDegraded && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                      ⚠
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground/50 transition-colors group-hover/meta:text-muted-foreground">
                    <svg
                      className="h-2.5 w-2.5 transition-transform group-open/meta:rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>

                <div className="mt-2 space-y-1.5 px-1 pb-1.5 text-[11px] leading-5">
                  <div data-testid="tools-used-meta-details">
                    <span className="text-muted-foreground/70">เครื่องมือ:</span>{" "}
                    <span className="font-mono">
                      {toolsUsedMetaText}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">ความมั่นใจ:</span>{" "}
                    {confidenceLabel}
                  </div>
                  {reasonCode && (
                    <div>
                      <span className="text-muted-foreground/70">reason:</span>{" "}
                      <span className="font-mono">{reasonCode}</span>
                    </div>
                  )}
                  {ragMode && ragMode !== "none" && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span data-testid="memory-rag-badge">
                        <span className="text-muted-foreground/70">RAG:</span> {ragMode}
                      </span>
                      {ragEntities.length > 0 && (
                        <span>
                          <span className="text-muted-foreground/70">เอนทิตี:</span>{" "}
                          {ragEntities.slice(0, 3).join(", ")}
                        </span>
                      )}
                      {ragColdHits > 0 && (
                        <span>
                          <span className="text-muted-foreground/70">cold hits:</span> {ragColdHits}
                        </span>
                      )}
                      <span>
                        <span className="text-muted-foreground/70">รอบ:</span> {ragTurn}
                      </span>
                    </div>
                  )}
                  {sourceType && (
                    <span data-testid="source-type-badge" className="sr-only">{sourceType}</span>
                  )}
                </div>
              </details>
            );
          })()}

          {message.sender === "ai" && guidance.length > 0 && (
            <div className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {guidance.map((g: string, idx: number) => (
                <div key={idx}>{g}</div>
              ))}
            </div>
          )}

          {/* Phase 10.64 — MultiAgentPanel placed ABOVE the main answer text as
              a thinking-mode strip. Mom's directive: simple Q&A should not be
              dominated by a 4-agent panel under the answer; surface the
              "thinking" tape at the top, collapsed by default, so the answer
              stays the protagonist. */}
          {message.sender === "ai" && inlineExtras && (
            <div className="mb-2.5 -mt-0.5">
              {inlineExtras}
            </div>
          )}

          {/* Source attachments — small chips above the AI body (req 5) */}
          {message.sender === "ai" && (() => {
            const sc = message.structuredContent as any;
            if (!sc || typeof sc !== "object") return null;
            const candidates: string[] = [];
            const pushOne = (val: unknown) => {
              if (typeof val !== "string") return;
              const trimmed = val.trim();
              if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
            };
            const pushArr = (arr: unknown) => {
              if (!Array.isArray(arr)) return;
              for (const item of arr) {
                if (typeof item === "string") pushOne(item);
                else if (item && typeof item === "object") {
                  const obj = item as { name?: unknown; filename?: unknown; title?: unknown; source?: unknown };
                  pushOne(obj.name);
                  pushOne(obj.filename);
                  pushOne(obj.title);
                  pushOne(obj.source);
                }
              }
            };
            pushArr(sc.sources);
            pushArr(sc.attachments);
            pushArr(sc.documents);
            pushArr(sc.sourceDocuments);
            const visible = candidates.slice(0, 4);
            if (visible.length === 0) return null;
            const fileIcon = (name: string) => {
              const ext = name.split(".").pop()?.toLowerCase() ?? "";
              if (["pdf"].includes(ext)) return "📑";
              if (["doc", "docx"].includes(ext)) return "📝";
              if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
              if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "🖼️";
              return "📄";
            };
            return (
              <div className="mb-2 flex flex-wrap gap-1.5" data-testid="ai-source-chips">
                {visible.map((src, idx) => (
                  <span
                    key={`${src}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-[12px] leading-snug text-muted-foreground"
                    title={src}
                  >
                    <span aria-hidden="true">{fileIcon(src)}</span>
                    <span className="max-w-[14rem] truncate font-mono text-[11.5px]">{src}</span>
                  </span>
                ))}
                {candidates.length > visible.length && (
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground">
                    +{candidates.length - visible.length}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Message content — Thai-friendly: 16px body, leading-7 for breathing room (req 6) */}
          <div className="whitespace-pre-wrap wrap-break-word text-[15px] leading-7 sm:text-base sm:leading-[1.75]">
            {/* Progress indicator — Phase 10.46: themed pill instead of grey box. */}
            {(message as any).isProgress && (
              <div
                className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/[0.06] via-sky-500/[0.04] to-transparent px-3.5 py-2 text-foreground/85"
                role="status"
                aria-live="polite"
              >
                {/* Spinner with primary tint */}
                <svg className="h-4 w-4 shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" opacity="0.2" />
                  <path d="M4 12a8 8 0 0 1 8-8" strokeLinecap="round" />
                </svg>
                <span className="text-[13.5px] font-medium">{message.text}</span>
                {(message as any).elapsedTime && (
                  <span className="ml-auto rounded-full bg-primary/8 px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-primary/85">
                    {(message as any).elapsedTime}s
                  </span>
                )}
              </div>
            )}
            
            {/* Normal message content */}
            {!(message as any).isProgress && (
              <>
                {message.sender === "ai" ? (
                  <ChatMessage
                    html={message.fullText || message.text}
                    structuredContent={message.structuredContent}
                  />
                ) : (
                  message.text
                )}
                {message.sender === "ai" && message.isAnimating && (
                  <span
                    className="ml-2 inline-flex translate-y-[1px] items-center align-middle text-foreground/80"
                    aria-hidden="true"
                  >
                    <TypingDots />
                  </span>
                )}
                {(message as any).mdesEnhanced && (
                  <span
                    className="ml-1.5 inline-flex select-none items-center gap-0.5 rounded-full bg-gradient-to-r from-emerald-500/15 via-sky-500/15 to-violet-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25"
                    title="คำตอบนี้เสริมโดย MDES multi-agent (qwen / gemma / minimax)"
                  >
                    <span aria-hidden="true">⚡</span> MDES
                  </span>
                )}
              </>
            )}

            {/* Tool chips — visible indicator of which MCP tools were called.
                Phase 10.51 — friendlier names + per-tool icons. */}
            {message.sender === "ai" && message.toolsUsed && message.toolsUsed.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {message.toolsUsed.map((tool: string, i: number) => {
                  const bare = tool.replace(/^[^:]+:/, "").replace(/_/g, " ");
                  // Quick keyword → emoji mapping so each chip self-identifies.
                  const lower = bare.toLowerCase();
                  const glyph =
                    /weather|nwp|tmd/i.test(lower) ? "🌦"
                    : /seismic|earthquake/i.test(lower) ? "🌐"
                    : /calc|math|newton/i.test(lower) ? "🔢"
                    : /chart|echarts/i.test(lower) ? "📊"
                    : /image|qr/i.test(lower) ? "🎨"
                    : /datetime/i.test(lower) ? "⏰"
                    : /evidence|webd|detect/i.test(lower) ? "🛡"
                    : /thai|geo|knowledge|history|law|religion/i.test(lower) ? "📍"
                    : /currency|exchange/i.test(lower) ? "💱"
                    : /rss|feed|news/i.test(lower) ? "📰"
                    : /translation/i.test(lower) ? "🌏"
                    : /doc|writer|file/i.test(lower) ? "📄"
                    : /audio|whisper/i.test(lower) ? "🎙"
                    : /nasa/i.test(lower) ? "🚀"
                    : /worldbank/i.test(lower) ? "🌍"
                    : "🛠";
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/12 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-300"
                      title={tool}
                    >
                      <span aria-hidden="true">{glyph}</span>
                      <span className="truncate max-w-[10rem]">{bare}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline extras moved to ABOVE the answer text in Phase 10.64.
              (Previously rendered below the body — caused panel-domination
              for short answers per mom's review.) */}

          {/* Task completion banner — Manus-style UX */}
          {message.sender === "ai" && message.isComplete && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[12.5px] text-emerald-700 dark:text-emerald-300">
                <span className="text-base">✅</span>
                <span className="font-medium">Task completed</span>
                {message.elapsedMs && message.elapsedMs > 0 && (
                  <span className="text-emerald-600/70 dark:text-emerald-400/70">
                    · completed in {Math.floor(message.elapsedMs / 60000)}:{String(Math.floor((message.elapsedMs % 60000) / 1000)).padStart(2, "0")}
                  </span>
                )}
              </div>
              <StarRating messageId={(message as any).id || ""} />
            </div>
          )}

          {/* Follow-up suggestion cards */}
          {message.sender === "ai" && message.isComplete && message.followUpSuggestions && message.followUpSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.followUpSuggestions.map((suggestion, idx) => (
                <button key={idx} onClick={() => onFollowUp?.(suggestion)}
                  className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[12px] text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/8 hover:text-foreground">
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Metadata footer — Phase 10.49 tightened icons. */}
          <div
            className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px] ${
              message.sender === "user"
                ? "border-primary-foreground/15 text-primary-foreground/70"
                : theme === "light"
                ? "border-border/70 text-gray-500"
                : "border-white/10 text-gray-400"
            }`}
          >
            {/* Timestamp */}
            {message.timestamp && (
              <span className="inline-flex items-center gap-1 font-mono tabular-nums" title={new Date(message.timestamp).toLocaleString("th-TH")}>
                <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {formatTimestamp(message.timestamp)}
              </span>
            )}

            {/* Token count (AI messages only) */}
            {message.sender === "ai" && message.tokenCount && (
              <span className="inline-flex items-center gap-1 font-mono tabular-nums" title="โทเค็นที่ใช้">
                <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
                  <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
                  <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
                  <rect x="14.5" y="14.5" width="6" height="6" rx="1" />
                </svg>
                {message.tokenCount.toLocaleString()} tok
              </span>
            )}

            {/* Response time (AI messages only) */}
            {message.sender === "ai" && message.responseTime && (
              <span className="inline-flex items-center gap-1 font-mono tabular-nums" title="เวลาตอบสนอง">
                <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
                </svg>
                {formatResponseTime(message.responseTime)}
              </span>
            )}
          </div>
        </>
      )}

      {/* TODO #42: Report Modal */}
      {showReportModal && <ReportModal onClose={() => setShowReportModal(false)} onSubmit={handleReportMessage} theme={theme} />}
    </div>
  );
}

// TODO #42: Report Modal Component
const ReportModal: React.FC<{
  onClose: () => void;
  onSubmit: (categories: string[]) => void;
  theme: string;
}> = ({ onClose, onSubmit, theme }) => {
  const [selectedCategories, setSelectedCategories] = React.useState<Set<string>>(new Set());

  const categories = [
    { id: "violence", label: "ความรุนแรงหรือการทำร้ายตนเอง" },
    { id: "sexual", label: "การแสวงหาประโยชน์ทางเพศ" },
    { id: "child-abuse", label: "การล่วงละเมิดเด็ก" },
    { id: "bullying", label: "การกลั่นแกล้งหรือคุกคาม" },
    { id: "spam", label: "สแปมหรือการหลอกลวง" },
    { id: "privacy", label: "การละเมิดความเป็นส่วนตัว" },
    { id: "ip", label: "การละเมิดทรัพย์สินทางปัญญา" },
    { id: "age-inappropriate", label: "เนื้อหาไม่เหมาะสมกับเด็ก" },
    { id: "other", label: "อื่นๆ" },
  ];

  const toggleCategory = (id: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCategories(newSet);
  };

  const handleSubmit = () => {
    if (selectedCategories.size === 0) {
      alert("กรุณาเลือกอย่างน้อย 1 หมวดหมู่");
      return;
    }
    onSubmit(Array.from(selectedCategories));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${
          theme === "light" ? "bg-white text-gray-900" : "bg-gray-800 text-gray-100"
        } rounded-lg shadow-2xl p-6 w-full max-w-md m-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">รายงานข้อความ</h2>
        <p className={`mb-4 text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}>
          เลือกหมวดหมู่ที่เหมาะสมกับเหตุผลในการรายงาน (เลือกได้หลายรายการ):
        </p>

        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${
                selectedCategories.has(cat.id)
                  ? theme === "light"
                    ? "bg-blue-50 border border-blue-500"
                    : "bg-blue-900/30 border border-blue-500"
                  : theme === "light"
                  ? "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                  : "bg-gray-700/50 border border-gray-600 hover:bg-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedCategories.has(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="w-5 h-5 rounded accent-blue-500"
              />
              <span>{cat.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded transition-colors ${
              theme === "light"
                ? "bg-gray-200 hover:bg-gray-300 text-gray-800"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedCategories.size === 0}
            className={`px-4 py-2 rounded transition-colors ${
              selectedCategories.size === 0
                ? "bg-gray-400 cursor-not-allowed text-gray-600"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            ส่งรายงาน
          </button>
        </div>
      </div>
    </div>
  );
};
