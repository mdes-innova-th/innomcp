#!/usr/bin/env node
/**
 * cc_wave4_polish_swarm.js — innomcp 100% Polish Swarm
 * Jit Loop Iteration 1 — 20 parallel CODECOMMAND tasks
 * Goal: Burn tokens to >80% + reach Manus-quality polish
 *
 * Tasks: Provider presets, ChatMessage polish, empty state, dark mode,
 *        new utility components, MDES model auto-fetch, a11y, Thai UX
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CC_KEY   = process.env.CC_KEY  || 'user_63PeUo3er88esBvYN2hjW7PqJwtvKeXFCHKUVcwyisVaE13Y1xR9RyGPvHjZbUqqG2CCH3A4gP6JHncr7RW5qwwb';
const CC_BASE  = 'https://api.commandcode.ai/provider/v1';
const PRO      = 'deepseek/deepseek-v4-pro';
const FAST     = 'deepseek/deepseek-v4-flash';
const MDES_URL = 'https://ollama.mdes-innova.online';

const ROOT  = 'C:/Users/USER-NT/DEV/innomcp';
const CHAT  = `${ROOT}/innomcp-next/src/app/components/chat`;
const SETS  = `${ROOT}/innomcp-next/src/app/components/settings`;
const HOOKS = `${ROOT}/innomcp-next/src/app/hooks`;
const LIB   = `${ROOT}/innomcp-next/src/app/lib`;

function slurp(fp, max = 999999) {
  try { return fs.readFileSync(fp.replace(/\//g, path.sep), 'utf8').replace(/^﻿/, '').slice(0, max); }
  catch { return `[NOT FOUND: ${fp}]`; }
}

async function cc(taskId, model, sys, msg, maxTokens = 8000) {
  const t0 = Date.now();
  try {
    const resp = await fetch(`${CC_BASE}/chat/completions`, {
      method : 'POST',
      headers: { 'Authorization': `Bearer ${CC_KEY}`, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ model, messages: [{ role:'system', content:sys }, { role:'user', content:msg }],
                                max_tokens: maxTokens, temperature: 0.1, stream: false }),
      signal : AbortSignal.timeout(300000),
    });
    const j = await resp.json();
    const ms = Date.now() - t0, reply = j.choices?.[0]?.message?.content || '', tokens = j.usage?.total_tokens || 0;
    if (!reply) return { taskId, ok:false, ms, tokens, error: JSON.stringify(j).slice(0,200) };
    return { taskId, ok:true, ms, tokens, reply };
  } catch(e) { return { taskId, ok:false, ms:Date.now()-t0, tokens:0, error:e.message }; }
}

function extractCode(reply) {
  const m = reply.match(/```(?:tsx?|css|js|javascript|json)?\n([\s\S]+?)```/);
  return m ? m[1].trim() : reply.trim();
}

function writeFile(relPath, content) {
  const full = path.join(ROOT.replace(/\//g, path.sep), relPath.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (content.startsWith('```')) {
    // Strip fence markers if model included them
    content = extractCode(content);
  }
  fs.writeFileSync(full, content, 'utf8');
  process.stdout.write(`  ✏️  ${relPath} (${Math.round(content.length/1024)}KB)\n`);
}

const STARTER = slurp(`${CHAT}/StarterPromptsGrid.tsx`);
const PROVIDER_MODAL = slurp(`${SETS}/ProviderModal.tsx`);

const SYS = `You are a senior Thai-government AI product engineer building INNOMCP — Thailand's MCP Hub.
Stack: Next.js 14, TypeScript strict, Tailwind CSS, React 18.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม — always primary brand.
Output ONLY the complete file content in \`\`\`tsx ... \`\`\` (or correct extension).
Rules: (1) No "// ...rest of code" truncation (2) Thai for UI strings (3) Preserve existing functionality (4) No placeholder code`;

const TASKS = [

  // ─── NEW COMPONENTS ─────────────────────────────────────────────────────────

  {
    id: 'MDES_MODEL_PICKER',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/MDESModelPicker.tsx',
    msg: `Create MDESModelPicker.tsx — a compact model picker that fetches and displays all available MDES Ollama models.

MDES Ollama endpoint: https://ollama.mdes-innova.online
API: GET /api/tags → returns { models: [{name, size, modified_at}] }
The component uses the frontend's BACKEND variable pattern.

Props:
\`\`\`ts
interface MDESModelPickerProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}
\`\`\`

Build:
- Button showing current model name (truncated to 16 chars) with dropdown chevron
- Dropdown popover showing:
  - Header: "MDES Ollama Models" + model count + live indicator dot (green if fetched, grey if loading)
  - Model list (scrollable max-h-48): each row = model name + size badge (e.g. "26B", "7B")
  - Filter input to search models
  - "Refresh" button that re-fetches
- While loading: skeleton pulse animation
- On error: "ไม่สามารถโหลดได้" + retry button
- Keyboard: Escape closes, Enter selects highlighted
- Preloads model list on mount
- localStorage cache (5 min TTL) to avoid re-fetching

Use useEffect + useState for async fetch. No external deps beyond React.`,
    max: 8000,
  },

  {
    id: 'PROVIDER_PRESETS_ENHANCED',
    model: PRO,
    out: 'innomcp-next/src/app/components/settings/ProviderModal.tsx',
    msg: `Enhance ProviderModal.tsx to add popular provider presets (openclaude-style).

Current file:
\`\`\`tsx
${PROVIDER_MODAL}
\`\`\`

Add a PRESETS section at the top of the modal (before the manual form):
1. "เลือก Provider สำเร็จรูป" section with clickable preset cards
2. Presets:
   - 🇹🇭 MDES Ollama (ภาครัฐ) — baseUrl: https://ollama.mdes-innova.online/v1, type: ollama-remote, no key needed
   - 🤖 OpenAI — baseUrl: https://api.openai.com/v1, type: openai-compatible, needs key
   - 🅰️ Anthropic — baseUrl: https://api.anthropic.com/v1, type: anthropic-compatible, needs key
   - 🚀 Groq (Fast) — baseUrl: https://api.groq.com/openai/v1, type: openai-compatible, needs key
   - 💻 Ollama Local — baseUrl: http://localhost:11434/v1, type: ollama-local, no key
   - 🔮 Gemini — baseUrl: https://generativelanguage.googleapis.com/v1beta/openai, type: openai-compatible, needs key
   - ⚡ LM Studio — baseUrl: http://localhost:1234/v1, type: openai-compatible, no key
   - 🛡️ MDES ThaiLLM — baseUrl: https://api.thaillm.mdes.go.th/v1, type: openai-compatible, needs key

3. Clicking a preset fills the form fields automatically
4. Add "กรอกเอง" button to show the manual form without selecting a preset
5. If preset selected and no key needed, show green "ไม่ต้องใช้ API Key" badge
6. Design: 2-column grid of preset cards, each 70px tall, icon + name + "ต้องการ Key"/"ฟรี" badge

Keep all existing functionality. Export default stays the same.`,
    max: 10000,
  },

  {
    id: 'STARTER_PROMPTS_MANUS_STYLE',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/StarterPromptsGrid.tsx',
    msg: `Enhance StarterPromptsGrid.tsx to be Manus.ai-style.

Current file:
\`\`\`tsx
${STARTER}
\`\`\`

Changes:
1. Add 4 more government-relevant starter prompts (total 8):
   - 🏛️ ค้นหากฎหมาย/ระเบียบราชการ (Thai law/regulation lookup)
   - 📋 สรุปรายงาน/เอกสารราชการ (summarize government docs)
   - 🗺️ ข้อมูลภูมิศาสตร์จังหวัด (province geo data)
   - 🌤️ รายงานสภาพอากาศ/ภัยธรรมชาติ (weather/disaster report)

2. Make grid 2-column on mobile, 4-column on desktop (currently 1-col mobile, 2-col desktop)

3. Add "reduced" mode properly: when reduced=true, show only 2 prompts in a single row

4. Add a "Capability pills" section above the grid showing:
   - 🤖 Multi-Agent · 🛠️ MCP Tools · 🇹🇭 Thai · 📊 Data · 🌐 Web · 💻 Code
   - Horizontal scrollable on mobile
   - Click pill = add to textarea as context (e.g. "วิเคราะห์ข้อมูล: ")

5. Add a "Government Quick Actions" row: 3 icon buttons for common MDES tasks
   - "ค้นหาข้อมูล" / "วิเคราะห์ไฟล์" / "สร้างรายงาน"

Keep all existing props and onSelect behavior.`,
    max: 8000,
  },

  {
    id: 'MDES_OLLAMA_HOOK',
    model: FAST,
    out: 'innomcp-next/src/app/hooks/useMDESOllama.ts',
    msg: `Create useMDESOllama.ts — React hook for fetching MDES Ollama model list and health.

\`\`\`ts
// useMDESOllama.ts
"use client";

// Hook that:
// 1. Fetches available models from MDES Ollama (/api/tags or similar)
// 2. Checks health of MDES endpoint
// 3. Returns { models, isLoading, isHealthy, error, refetch }
// 4. Caches in localStorage for 5 minutes (TTL key: "innomcp.mdes.models.cache")
// 5. Auto-retries on error (max 3 times, exponential backoff: 1s, 2s, 4s)


interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
  details?: { parameter_size?: string; family?: string; };
}

interface UseMDESOllamaReturn {
  models: OllamaModel[];
  isLoading: boolean;
  isHealthy: boolean | null;
  error: string | null;
  refetch: () => void;
  lastFetchedAt: number | null;
}
\`\`\`

Implement the hook with full TypeScript. Use fetch (no external deps).
Endpoint: GET ${MDES_URL}/api/tags — returns { models: [...] }
Health check: GET ${MDES_URL}/api/version — if 200 = healthy
Export as default.`,
    max: 4000,
  },

  {
    id: 'PROVIDER_HEALTH_MINI',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/ProviderHealthBadge.tsx',
    msg: `Create ProviderHealthBadge.tsx — a compact real-time provider health indicator for the chat UI.

Shows the health of all configured AI providers as colored badges.
Fetches from POST /api/providers/health-check (existing backend endpoint).

Props:
\`\`\`ts
interface ProviderHealthBadgeProps {
  className?: string;
  compact?: boolean; // compact = just dots, no text
}
\`\`\`

Build:
- Fetches health data on mount + every 60 seconds
- compact mode: row of 3 colored dots (MDES=indigo, others=based on health)
- full mode: "3/4 ผู้ให้บริการออนไลน์" text + dots
- Colors: green=healthy, amber=degraded, red=down, grey=unknown
- Hover tooltip showing provider name + latency
- Animated pulse on the MDES dot (primary provider = always shown)
- MDES dot: Thai flag emoji + "MDES" label

HealthStatus type: "healthy" | "degraded" | "down" | "unknown"
Use "use client" + useEffect for polling.`,
    max: 4000,
  },

  {
    id: 'CHAT_WELCOME_HERO',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/ChatWelcomeHero.tsx',
    msg: `Create ChatWelcomeHero.tsx — Manus.ai-style welcome hero section for empty chat state.

Design inspiration from Manus.ai:
- Clean, minimal hero with a central focus area
- Shows product name prominently
- Shows key capabilities as visual cards
- "Start here" suggestions

Build:
\`\`\`tsx
interface ChatWelcomeHeroProps {
  onQuerySelect: (query: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isConnected: boolean;
  providerMode: "remote" | "local";
}
\`\`\`

Layout (Manus-style):
- Center-aligned hero: Large "INNOMCP" title with Thai subtitle "ศูนย์ MCP ภาครัฐ"
- Tagline: "AI ภาครัฐที่ใช้ได้ 24 ชั่วโมง โดย MDES"
- Animated gradient background accent (not too distracting)
- 4 capability icons in a horizontal row: 🔧 MCP Tools | 🤖 Multi-Agent | 🇹🇭 Thai-First | 🏛️ Government Data
- Connection status indicator: green dot "MDES Ollama พร้อมใช้งาน" or red "ออฟไลน์"
- Trust strip: "56+ เครื่องมือ MCP | 3 ประเภท AI | ภาษาไทยธรรมชาติ"
- Smooth fade-in animation on mount

This is SEPARATE from StarterPromptsGrid — hero is the top section, grid is below.
"use client", TypeScript strict, Tailwind CSS, no external deps.`,
    max: 7000,
  },

  {
    id: 'TYPING_INDICATOR_MANUS',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/MDESThinkingDots.tsx',
    msg: `Create MDESThinkingDots.tsx — Manus.ai-style AI thinking animation for INNOMCP.

When MDES agents are processing, show a clean thinking animation.

Props:
\`\`\`ts
interface MDESThinkingDotsProps {
  agentName?: string;    // e.g. "gemma4:26b"
  stage?: string;        // e.g. "กำลังวิเคราะห์" | "กำลังค้นหา" | "กำลังสรุป"
  className?: string;
}
\`\`\`

Design:
- Three bouncing dots animation (CSS keyframes, no JS animation libs)
- Color: MDES indigo (#1a3c6e)
- Optional text: "{agentName} · {stage}" with fade-in/out
- Minimal height (24px)
- Accessible: aria-label="AI กำลังประมวลผล"
- Pulse variants: 3 dots with staggered delay (0ms, 150ms, 300ms)

Also export a \`MDESThinkingBar\` variant: a thin horizontal progress bar that oscillates,
for use as a page-level indicator (sticky below MDESBrandHeader).

"use client", TypeScript, Tailwind only.`,
    max: 3000,
  },

  {
    id: 'GOVERNMENT_QUICK_ACTIONS',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/GovernmentQuickActions.tsx',
    msg: `Create GovernmentQuickActions.tsx — Thai government quick action shortcuts for INNOMCP.

Shows 6 frequently-used government AI tasks as large icon buttons.
Perfect for new users to discover capabilities.

Props:
\`\`\`ts
interface GovernmentQuickActionsProps {
  onAction: (prompt: string) => void;
  compact?: boolean;
}
\`\`\`

Actions:
1. 📋 สรุปเอกสาร — "สรุปเอกสารนี้เป็นภาษาไทยที่เข้าใจง่าย"
2. 🌤️ พยากรณ์อากาศ — "รายงานสภาพอากาศและการเตือนภัยธรรมชาติในประเทศไทยวันนี้"
3. 🗺️ ข้อมูลพื้นที่ — "ข้อมูลภูมิศาสตร์และสถิติจังหวัดในประเทศไทย"
4. 🔍 ค้นหากฎหมาย — "ค้นหาและอธิบายกฎหมายหรือระเบียบราชการที่เกี่ยวข้อง"
5. 📊 วิเคราะห์ข้อมูล — "วิเคราะห์ข้อมูลตารางหรือ CSV และสรุปเป็น insights"
6. 🎨 สร้างรูปภาพ — "สร้างภาพกราฟิกหรือ infographic สำหรับงานราชการ"

Design:
- 2-column grid (mobile) or 3-column (desktop)
- Each button: large emoji (28px) + Thai label + subtle hover effect
- Government blue/indigo accent color for hover state
- Compact mode: 1 row of 6 small icon-only buttons

"use client", TypeScript, Tailwind.`,
    max: 3000,
  },

  // ─── ENHANCEMENT TASKS ───────────────────────────────────────────────────────

  {
    id: 'MDES_FAVICON_META',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/MDESMetaTags.tsx',
    msg: `Create MDESMetaTags.tsx — MDES brand meta tags component for innomcp.

A server component (no "use client") that renders Open Graph + Twitter + PWA meta tags.

\`\`\`tsx
// Renders in <head> via layout.tsx
// No props needed

// Meta tags to include:
// og:title = "INNOMCP — ศูนย์ MCP ภาครัฐ"
// og:description = "ระบบ AI ภาครัฐ 24/7 โดย MDES — Multi-Agent Chat ด้วย MDES Ollama"
// og:image = "/og-mdes-innomcp.png" (placeholder)
// og:locale = "th_TH"
// twitter:card = "summary_large_image"
// theme-color = "#1a3c6e" (MDES blue)
// apple-mobile-web-app-title = "INNOMCP"
// manifest = "/manifest.json"

// Also export a \`generateINNOMCPMetadata\` function for Next.js metadata API
\`\`\`

TypeScript strict. No client-side code.`,
    max: 2000,
  },

  {
    id: 'INNOMCP_PWA_MANIFEST',
    model: FAST,
    out: 'innomcp-next/public/manifest.json',
    msg: `Create public/manifest.json for INNOMCP PWA.

\`\`\`json
{
  "name": "INNOMCP — ศูนย์ MCP ภาครัฐ",
  "short_name": "INNOMCP",
  "description": "ระบบ AI ภาครัฐ 24/7 โดย MDES",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a3c6e",
  "lang": "th",
  "dir": "ltr",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "categories": ["government", "productivity", "utilities"],
  "related_applications": [],
  "prefer_related_applications": false
}
\`\`\`

Output the JSON directly wrapped in \`\`\`json ... \`\`\` with no TypeScript.`,
    max: 800,
  },

  {
    id: 'CHAT_EMPTY_STATE_MANAGER',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/ChatEmptyStateManager.tsx',
    msg: `Create ChatEmptyStateManager.tsx — orchestrates the Manus-style empty state experience.

This component manages which empty state content to show based on context.

\`\`\`ts
interface ChatEmptyStateManagerProps {
  isConnected: boolean;
  onQuerySelect: (query: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  providerMode: "remote" | "local";
  hasMessages: boolean;  // if true, show reduced "continue" state
}
\`\`\`

Build:
- When hasMessages=false:
  - Full state: ChatWelcomeHero (top) + GovernmentQuickActions (middle) + StarterPromptsGrid (bottom)
  - Smooth stagger animation — each section fades in with 100ms offset
- When hasMessages=true (returning user, new chat started):
  - Reduced state: Just StarterPromptsGrid in reduced mode + "หรือถามได้เลย" hint
- Connection offline: Show offline banner above all content

Import ChatWelcomeHero from "./ChatWelcomeHero"
Import GovernmentQuickActions from "./GovernmentQuickActions"
Import StarterPromptsGrid from "./StarterPromptsGrid"

"use client", TypeScript strict, Tailwind. Smooth transitions between states.`,
    max: 6000,
  },

  {
    id: 'MDES_THEME_PROVIDER',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/MDESThemeProvider.tsx',
    msg: `Create MDESThemeProvider.tsx — MDES brand theme extension for innomcp dark/light mode.

"use client" component that:
1. Extends the existing theme with MDES-specific CSS variables
2. Injects theme vars into :root based on current theme (light/dark)
3. Applies MDES-specific overrides for dark mode (deeper backgrounds matching manus.ai)

MDES Light theme overrides (CSS vars):
- --mdes-chat-bg: oklch(0.985 0 0)
- --mdes-message-user: oklch(0.95 0.02 265)
- --mdes-message-ai: oklch(1 0 0)
- --mdes-accent-ring: #1a3c6e

MDES Dark theme overrides:
- --mdes-chat-bg: oklch(0.08 0 0)
- --mdes-message-user: oklch(0.15 0.03 265)
- --mdes-message-ai: oklch(0.11 0 0)
- --mdes-accent-ring: #2d5a9e

Props: { children: React.ReactNode }
Reads current theme from localStorage "theme" key.
Uses useEffect to inject a <style> tag with the CSS vars.`,
    max: 2500,
  },

  {
    id: 'INNOMCP_LOADING_SCREEN',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/INNOMCPLoadingScreen.tsx',
    msg: `Create INNOMCPLoadingScreen.tsx — MDES-branded loading screen for innomcp.

Shows while the app is loading (used in Suspense boundaries).

Build a "use client" component:
- Full-screen backdrop (dark + blur)
- Center: 🇹🇭 MDES logo + "INNOMCP กำลังโหลด..." text
- Animated loading bar (indigo color, bouncing/sweeping)
- Version tag: "MDES Ollama ✓ | MCP Hub ✓ | Thai AI ✓"
- Smooth fade-out when loading completes

Props:
\`\`\`ts
interface INNOMCPLoadingScreenProps {
  message?: string;    // default: "INNOMCP กำลังโหลด..."
  showVersion?: boolean;
}
\`\`\`

Export as default. Tailwind CSS only, no external deps.`,
    max: 2500,
  },

  {
    id: 'WORKSPACE_PANEL_TABS',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/WorkspaceTabBar.tsx',
    msg: `Create WorkspaceTabBar.tsx — reusable Manus-style tab bar component for workspace panels.

Used by ManusWorkspacePanel and other panels that need tabs.

\`\`\`ts
interface Tab {
  id: string;
  label: string;
  icon?: string;       // emoji or SVG string
  badge?: number;      // notification badge count
  disabled?: boolean;
}

interface WorkspaceTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  size?: "sm" | "md";  // sm=compact, md=normal
}
\`\`\`

Design:
- Horizontal tab row with smooth underline indicator (CSS transition)
- Active tab: MDES indigo underline + slightly brighter text
- Badge: small red circle with count
- Disabled: opacity-40, no-click
- Size sm: text-[11px], px-2 | Size md: text-[13px], px-3
- Keyboard: Left/Right arrows to navigate between tabs
- "use client", TypeScript strict, Tailwind.`,
    max: 3500,
  },

  {
    id: 'INNOMCP_CHANGELOG_COMPONENT',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/INNOMCPChangelog.tsx',
    msg: `Create INNOMCPChangelog.tsx — show recent updates in the app.

Shows the latest 5 changes to innomcp as a "What's new" panel.

\`\`\`ts
interface ChangeEntry {
  version: string;
  date: string;
  changes: string[];
  type: "feature" | "fix" | "improvement";
}
\`\`\`

Hardcode the latest 3 entries:
1. v10.17 (2026-06-11): Manus.ai-style redesign — 3-column layout, ManusWorkspacePanel, MDESBrandHeader
2. v10.16 (2026-05-14): MDES multi-agent parallel dispatch with model escalation
3. v10.14 (2026-05-11): Playwright 214/214 PASS, full E2E coverage

Props: { onClose: () => void }
Design: compact modal or slide-in panel, Thai descriptions, version badges
"use client", TypeScript, Tailwind.`,
    max: 2500,
  },

  {
    id: 'ACCESSIBILITY_ANNOUNCE',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/ARIALiveRegion.tsx',
    msg: `Create ARIALiveRegion.tsx — accessible live announcements for innomcp.

Screen reader announcement utility for dynamic content changes.

Build:
1. \`<ARIALiveRegion />\` component — renders an off-screen live region div
2. \`useAnnounce()\` hook — returns \`announce(message: string, priority?: "polite" | "assertive")\`

Usage:
\`\`\`tsx
const { announce } = useAnnounce();
// When AI responds:
announce("MDES AI ตอบแล้ว — คลิกเพื่ออ่าน");
// When error:
announce("ข้อผิดพลาด: ไม่สามารถเชื่อมต่อได้", "assertive");
\`\`\`

Implementation:
- Use aria-live="polite" / aria-live="assertive"
- aria-atomic="true"
- Visually hidden (.sr-only)
- Debounce rapid announcements (50ms)
- Context-based (create ARIALiveRegionProvider for app root)

Export: default ARIALiveRegion, named useAnnounce.
"use client", TypeScript strict.`,
    max: 2500,
  },

  {
    id: 'INNOMCP_SEARCH_COMMAND',
    model: PRO,
    out: 'innomcp-next/src/app/components/common/INNOMCPCommandSearch.tsx',
    msg: `Create INNOMCPCommandSearch.tsx — Manus.ai-style command palette / quick search.

Triggered by Ctrl+K (already wired in ChatPage via CommandPalette).
This is an ENHANCED version with MDES-specific commands.

\`\`\`ts
interface CommandItem {
  id: string;
  icon: string;
  title: string;
  description?: string;
  keywords: string[];
  action: () => void;
  category: "chat" | "navigation" | "tool" | "provider" | "setting";
}
\`\`\`

Build a search modal with:
- Input field (auto-focused on open)
- Grouped results: Chat | เครื่องมือ | ผู้ให้บริการ | การตั้งค่า
- Keyboard navigation: ↑↓ to move, Enter to select, Esc to close
- Fuzzy search across title + keywords
- Empty state: "ไม่พบคำสั่ง '{query}'" + suggestion to try common keywords

Pre-built commands to include:
- "แชทใหม่" (new chat), "เปิดพื้นที่ทำงาน" (open workspace)
- "เพิ่ม Provider" (add provider), "จัดการ Provider" (manage providers)
- "ตั้งค่า MDES Ollama", "ตรวจสุขภาพระบบ" (health check)
- "ธีมมืด/สว่าง" (toggle theme), "ล้างประวัติ" (clear history)
- "ดูคีย์ลัด" (shortcuts), "เกี่ยวกับ INNOMCP" (about)

Props:
\`\`\`ts
interface INNOMCPCommandSearchProps {
  open: boolean;
  onClose: () => void;
  onNewChat?: () => void;
  onOpenWorkspace?: () => void;
  onOpenProviders?: () => void;
  onOpenModelSettings?: () => void;
}
\`\`\`

"use client", TypeScript strict, Tailwind, no external deps.`,
    max: 8000,
  },

  {
    id: 'INNOMCP_STATUS_PAGE',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/SystemStatusPanel.tsx',
    msg: `Create SystemStatusPanel.tsx — comprehensive system status panel for innomcp (like a status.io page, but inline).

Shows real-time health of all innomcp subsystems.

\`\`\`ts
type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  lastChecked: number;
  description: string;
}
\`\`\`

Services to show:
- 🇹🇭 MDES Ollama (ollama.mdes-innova.online) — primary AI
- 🌐 Thai NWP Weather — weather API
- 🗺️ Thai Geo Tool — geographic data
- 🔍 Evidence DB — evidence/stats tool
- 📚 Thai Knowledge — knowledge base
- 🔌 WebSocket — real-time connection
- 🗄️ Database — MariaDB
- 📡 Backend API — Node.js backend

Fetch from: POST /api/providers/health-check (existing endpoint)
Refresh every 30 seconds.

Design:
- Compact list view (each row: emoji + name + status badge + latency)
- Status colors: green=operational, amber=degraded, red=down, grey=unknown
- Overall health summary at top: "ระบบทำงานปกติ" / "ระบบบางส่วนมีปัญหา"
- Last checked timestamp
- Manual refresh button

Props: { onClose?: () => void, className?: string }
"use client", TypeScript strict, Tailwind.`,
    max: 5000,
  },

  {
    id: 'INNOMCP_OFFLINE_BANNER',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/INNOMCPOfflineBanner.tsx',
    msg: `Create INNOMCPOfflineBanner.tsx — offline/reconnecting banner for innomcp.

Shows at the top of the page when the WebSocket connection is lost.

\`\`\`ts
interface INNOMCPOfflineBannerProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  retryIn?: number;          // seconds until next retry
  onRetry?: () => void;
}
\`\`\`

States:
1. Connected: render nothing (null)
2. Reconnecting: amber banner "กำลังเชื่อมต่อใหม่..." with spinning indicator
3. Offline: red banner "ไม่สามารถเชื่อมต่อ INNOMCP ได้ — คลิกเพื่อลองใหม่" + retry button + countdown

Design:
- Full-width banner, fixed top (z-50, above MDESBrandHeader)
- Slides down with CSS animation on disconnect
- Slides up on reconnect (with brief green "เชื่อมต่อแล้ว" flash)
- Accessible: role="alert" aria-live="assertive"

"use client", TypeScript strict, Tailwind.`,
    max: 2500,
  },
];

async function runSwarm() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  🔄 Jit Loop Iteration 1 — Wave 4 Polish Swarm                  ║');
  console.log('║  20 parallel CODECOMMAND tasks | deepseek-v4-pro               ║');
  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);
  console.log(`  Tasks: ${TASKS.length} | Goal: Burn tokens >80% + innomcp 100%\n`);

  const start = Date.now();
  let totalTok = 0, ok = 0, fail = 0;
  const failed = [];

  const settled = await Promise.allSettled(
    TASKS.map(async (task) => {
      const r = await cc(task.id, task.model, SYS, task.msg, task.max);
      totalTok += r.tokens || 0;
      if (r.ok) {
        const code = extractCode(r.reply);
        writeFile(task.out, code);
        process.stdout.write(`  ✅ ${task.id.padEnd(35)} ${r.ms}ms ${r.tokens}tok\n`);
        ok++;
      } else {
        process.stdout.write(`  ❌ ${task.id.padEnd(35)} ERR: ${r.error?.slice(0, 80)}\n`);
        fail++;
        failed.push(task.id);
      }
      return r;
    })
  );

  console.log('\n🔍 Phase Gate: tsc\n');
  let tscPass = false;
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: `${ROOT.replace(/\//g, path.sep)}\\innomcp-next`, stdio: 'inherit', timeout: 120000 });
    tscPass = true;
    console.log('  ✅ tsc PASS');
  } catch {
    console.log('  ⚠️  tsc FAIL — some new components may have type issues (non-blocking, fix in next iteration)');
  }

  const elapsed = ((Date.now() - start)/1000).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  WAVE 4 COMPLETE                                                 ║');
  console.log(`║  Tasks: ${ok}/${TASKS.length} ✅ ${fail > 0 ? `| Failed: ${fail}` : ''}`.padEnd(67) + '║');
  console.log(`║  Tokens: ~${totalTok.toLocaleString()} (4x = ~${(totalTok*4).toLocaleString()} effective)`.padEnd(67) + '║');
  console.log(`║  Time: ${elapsed}s`.padEnd(67) + '║');
  console.log(`║  tsc: ${tscPass ? '✅ PASS' : '⚠️ FAIL (non-blocking)'}`.padEnd(67) + '║');
  if (failed.length > 0) console.log(`║  Failed: ${failed.join(', ')}`.padEnd(67) + '║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  console.log('\n🎯 Next: commit new components + fix tsc errors + continue loop');
}

runSwarm().catch(e => { console.error('FATAL:', e); process.exit(1); });
