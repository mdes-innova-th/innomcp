// MDESMetaTags.tsx
// Server component that renders MDES brand meta tags for Thailand's INNOMCP platform.
// Exports both a component (for manual <head> insertion) and a metadata generator for Next.js Metadata API.

import { Metadata } from "next";

// ---------- Metadata Generator (Recommended for layout.tsx / page.tsx) ----------

/**
 * generateINNOMCPMetadata
 * Returns a Next.js Metadata object for INNOMCP with MDES branding.
 * Usage: export const metadata = generateINNOMCPMetadata();
 */
export function generateINNOMCPMetadata(): Metadata {
  const mdesBlue = "#1a3c6e";
  return {
    title: "INNOMCP — ศูนย์ MCP ภาครัฐ",
    description: "ระบบ AI ภาครัฐ 24/7 โดย MDES — Multi-Agent Chat ด้วย MDES Ollama",
    openGraph: {
      title: "INNOMCP — ศูนย์ MCP ภาครัฐ",
      description: "ระบบ AI ภาครัฐ 24/7 โดย MDES — Multi-Agent Chat ด้วย MDES Ollama",
      images: [
        {
          url: "/og-mdes-innomcp.png",
          width: 1200,
          height: 630,
          alt: "INNOMCP โดย MDES",
        },
      ],
      locale: "th_TH",
      type: "website",
      siteName: "INNOMCP",
    },
    twitter: {
      card: "summary_large_image",
      title: "INNOMCP — ศูนย์ MCP ภาครัฐ",
      description: "ระบบ AI ภาครัฐ 24/7 โดย MDES — Multi-Agent Chat ด้วย MDES Ollama",
      images: ["/og-mdes-innomcp.png"],
    },
    other: {
      "theme-color": mdesBlue,
      "apple-mobile-web-app-title": "INNOMCP",
      "application-name": "INNOMCP",
    },
    manifest: "/manifest.json",
    icons: {
      apple: "/apple-icon.png", // optional default apple touch icon
    },
  };
}

// ---------- Component (for direct <head> use in head.tsx) ----------

/**
 * MDESMetaTags
 * Renders raw meta tags as React elements.
 * Intended for use inside a <head> context (e.g., app/head.tsx or custom head).
 * No props needed.
 */
export default function MDESMetaTags() {
  return (
    <>
      {/* Open Graph */}
      <meta property="og:title" content="INNOMCP — ศูนย์ MCP ภาครัฐ" />
      <meta
        property="og:description"
        content="ระบบ AI ภาครัฐ 24/7 โดย MDES — Multi-Agent Chat ด้วย MDES Ollama"
      />
      <meta property="og:image" content="/og-mdes-innomcp.png" />
      <meta property="og:locale" content="th_TH" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="INNOMCP" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="INNOMCP — ศูนย์ MCP ภาครัฐ" />
      <meta
        name="twitter:description"
        content="ระบบ AI ภาครัฐ 24/7 โดย MDES — Multi-Agent Chat ด้วย MDES Ollama"
      />
      <meta name="twitter:image" content="/og-mdes-innomcp.png" />

      {/* PWA */}
      <meta name="theme-color" content="#1a3c6e" />
      <meta name="apple-mobile-web-app-title" content="INNOMCP" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="application-name" content="INNOMCP" />

      {/* Manifest */}
      <link rel="manifest" href="/manifest.json" />

      {/* Additional Apple touch icon fallback (optional) */}
      <link rel="apple-touch-icon" href="/apple-icon.png" />
    </>
  );
}