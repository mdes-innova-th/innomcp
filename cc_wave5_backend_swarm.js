#!/usr/bin/env node
/**
 * cc_wave5_backend_swarm.js — Backend + Tests + E2E Wave
 * Jit Watchdog Iteration — burn tokens, finish innomcp 100%
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CC_KEY  = process.env.CC_KEY || 'user_63PeUo3er88esBvYN2hjW7PqJwtvKeXFCHKUVcwyisVaE13Y1xR9RyGPvHjZbUqqG2CCH3A4gP6JHncr7RW5qwwb';
const CC_BASE = 'https://api.commandcode.ai/provider/v1';
const PRO  = 'deepseek/deepseek-v4-pro';
const FAST = 'deepseek/deepseek-v4-flash';

const ROOT  = 'C:/Users/USER-NT/DEV/innomcp';
const CHAT  = `${ROOT}/innomcp-next/src/app/components/chat`;
const API   = `${ROOT}/innomcp-next/src/app/api`;
const TESTS = `${ROOT}/innomcp-next/tests`;

function slurp(fp, max=80000) {
  try { return fs.readFileSync(fp.replace(/\//g, path.sep), 'utf8').replace(/^﻿/, '').slice(0, max); }
  catch { return `[NOT FOUND: ${fp}]`; }
}

async function cc(id, model, sys, msg, max=8000) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${CC_BASE}/chat/completions`, {
      method:'POST', headers:{'Authorization':`Bearer ${CC_KEY}`,'Content-Type':'application/json'},
      body: JSON.stringify({ model, messages:[{role:'system',content:sys},{role:'user',content:msg}], max_tokens:max, temperature:0.1, stream:false }),
      signal: AbortSignal.timeout(300000),
    });
    const j=await r.json(), ms=Date.now()-t0, reply=j.choices?.[0]?.message?.content||'', tokens=j.usage?.total_tokens||0;
    if(!reply) return {id, ok:false, ms, tokens, error:JSON.stringify(j).slice(0,200)};
    return {id, ok:true, ms, tokens, reply};
  } catch(e) { return {id, ok:false, ms:Date.now()-t0, tokens:0, error:e.message}; }
}

function extractCode(r) {
  const m = r.match(/```(?:tsx?|ts|js|javascript|json|css|mdx?)?\n([\s\S]+?)```/);
  return m ? m[1].trim() : r.trim();
}

function writeFile(rel, content) {
  const full = path.join(ROOT.replace(/\//g,path.sep), rel.replace(/\//g,path.sep));
  fs.mkdirSync(path.dirname(full), {recursive:true});
  if (content.startsWith('```')) content = extractCode(content);
  fs.writeFileSync(full, content, 'utf8');
  process.stdout.write(`  ✏️  ${rel} (${Math.round(content.length/1024)}KB)\n`);
}

const SYS = `Senior engineer — INNOMCP Thailand government MCP Hub (MDES).
Stack: Next.js 14, TypeScript strict, Tailwind, Node.js, Jest/Playwright.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม.
Output ONLY complete file content in \`\`\`tsx/ts/js/json ... \`\`\`.
Rules: no truncation, Thai UI strings, preserve existing features.`;

const TASKS = [

  // ── Documentation ──────────────────────────────────────────────────────────

  {
    id: 'ARCHITECTURE_DOC',
    model: PRO,
    out: 'docs/MANUS_REDESIGN_ARCHITECTURE.md',
    msg: `Write MANUS_REDESIGN_ARCHITECTURE.md documenting the Manus.ai-style redesign of INNOMCP.

Cover:
## Overview
- INNOMCP is Thailand's government MCP Hub by MDES
- Redesigned as Manus.ai-style with 3-column layout
- Primary provider: MDES Ollama (24/7, unlimited, Thai government cloud)

## Architecture
### Layout (3-column Manus style)
- Left: ChatSidebar (conversation history)
- Center: Chat area (MDESBrandHeader + messages + ChatInput)
- Right: ManusWorkspacePanel (งาน/เว็บ/Terminal/ไฟล์) — auto-opens on streaming

### Key Components
List all new components with purpose (StatusRibbon, ManusWorkspacePanel, MDESBrandHeader,
CollapsibleAgentWrapper, MDESModelPicker, ChatWelcomeHero, GovernmentQuickActions,
ChatEmptyStateManager, WorkspaceTabBar, ProviderHealthBadge, MDESThinkingDots,
SystemStatusPanel, INNOMCPCommandSearch, INNOMCPChangelog, ARIALiveRegion,
INNOMCPOfflineBanner, MDESThemeProvider, MDESMetaTags, useMDESOllama)

### Provider Management
- MDES Ollama is default (ollama.mdes-innova.online)
- ⚙️ button in header → ModelSettingsPanel
- 8 preset providers (openclaude-style): MDES, OpenAI, Anthropic, Groq, Gemini, Ollama local, LM Studio, MDES ThaiLLM

### Agent Flow
- User sends message → conductor routes → MDES agents run in parallel
- CollapsibleAgentWrapper shows progress (collapsed by default, auto-expand on stream)
- ManusWorkspacePanel "งาน" tab shows live agent steps

## Files Changed (2026-06-11)
- 3 waves of CODECOMMAND swarms
- ~73k tokens consumed

Write in Thai+English mixed format. Markdown. ~400 words.`,
    max: 5000,
  },

  // ── Playwright E2E Tests ────────────────────────────────────────────────────

  {
    id: 'E2E_MANUS_LAYOUT',
    model: PRO,
    out: 'innomcp-next/e2e/manus-layout.spec.ts',
    msg: `Write a Playwright E2E test for the Manus-style INNOMCP chat layout.

Test file structure for Playwright:
\`\`\`ts
import { test, expect } from '@playwright/test';

// Test: Manus-style 3-column layout is present
// Test: MDESBrandHeader shows MDES brand
// Test: Workspace panel toggles on click
// Test: ⚙️ settings button opens ModelSettingsPanel
// Test: Provider toggle switches cloud/local
// Test: Empty state shows ChatWelcomeHero
// Test: GovernmentQuickActions are clickable
// Test: StarterPromptsGrid populates chat input

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Manus-style Chat Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + '/living-chat');
    await page.waitForLoadState('networkidle');
  });

  // ... implement tests
});
\`\`\`

Write all tests fully. Use data-testid attributes where they exist, or reliable selectors.
Include: layout assertions, MDES brand visibility, workspace panel toggle, provider toggle, empty state content.
TypeScript strict. Playwright test syntax.`,
    max: 6000,
  },

  {
    id: 'E2E_PROVIDER_MANAGEMENT',
    model: PRO,
    out: 'innomcp-next/e2e/provider-management.spec.ts',
    msg: `Write Playwright E2E tests for the openclaude-style provider management in INNOMCP.

Tests to cover:
1. ⚙️ button in MDESBrandHeader opens ModelSettingsPanel
2. ModelSettingsPanel is visible (right slide-in panel)
3. ProviderModal can be opened
4. Provider type dropdown works
5. Base URL input accepts text
6. API Key input is type="password" (masked)
7. "ทดสอบการเชื่อมต่อ" button is present
8. Provider presets section exists (8 presets)
9. Clicking a preset fills the form
10. Closing the settings panel works

\`\`\`ts
import { test, expect } from '@playwright/test';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
\`\`\`

TypeScript strict. Playwright. All tests fully implemented.`,
    max: 5000,
  },

  // ── MDES API Route ──────────────────────────────────────────────────────────

  {
    id: 'MDES_MODELS_API_ROUTE',
    model: PRO,
    out: 'innomcp-next/src/app/api/mdes/models/route.ts',
    msg: `Create Next.js App Router API route: GET /api/mdes/models

This route proxies to MDES Ollama and returns the list of available models.

\`\`\`ts
// src/app/api/mdes/models/route.ts
// GET /api/mdes/models → { models: [{name, size, modified_at, parameterSize}], total: N, healthy: boolean }

import { NextResponse } from 'next/server';

const MDES_OLLAMA = 'https://ollama.mdes-innova.online';

export const dynamic = 'force-dynamic'; // always fresh

export async function GET() {
  // Fetch from MDES Ollama /api/tags
  // Transform: extract name, size, parameter_size from details
  // Add response caching headers (5 min)
  // Handle errors gracefully (return {models: [], healthy: false})
}
\`\`\`

Full implementation. TypeScript strict. Next.js 14 App Router.
No auth needed (MDES Ollama is public endpoint).
Add CORS headers for frontend fetch.`,
    max: 3000,
  },

  {
    id: 'PROVIDER_HEALTH_API',
    model: FAST,
    out: 'innomcp-next/src/app/api/mdes/health/route.ts',
    msg: `Create Next.js App Router API route: GET /api/mdes/health

Quick health check for MDES Ollama.

\`\`\`ts
// GET /api/mdes/health → { healthy: boolean, latencyMs: number, version?: string }
import { NextResponse } from 'next/server';

const MDES_OLLAMA = 'https://ollama.mdes-innova.online';

export async function GET() {
  const t0 = Date.now();
  try {
    const r = await fetch(\`\${MDES_OLLAMA}/api/version\`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 }, // cache 1 min
    });
    const latencyMs = Date.now() - t0;
    if (!r.ok) return NextResponse.json({ healthy: false, latencyMs });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json({ healthy: true, latencyMs, version: data.version });
  } catch (e: unknown) {
    return NextResponse.json({ healthy: false, latencyMs: Date.now() - t0, error: String(e) });
  }
}
\`\`\`

Implement fully. TypeScript strict. No auth.`,
    max: 1500,
  },

  // ── More UI Components ──────────────────────────────────────────────────────

  {
    id: 'MDES_FLOATING_ACTION',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/MDESFloatingActions.tsx',
    msg: `Create MDESFloatingActions.tsx — floating action buttons for INNOMCP chat.

Floating buttons shown at bottom-right of the chat area (above ChatInput).
Appear when user scrolls up (not at bottom) or after conversation starts.

\`\`\`ts
interface MDESFloatingActionsProps {
  showScrollToBottom: boolean;
  unreadCount?: number;
  onScrollToBottom: () => void;
  onNewChat: () => void;
  showNewChat?: boolean;
}
\`\`\`

Build:
- "ลงล่าง" scroll button (arrow down) + unread badge (when unreadCount > 0)
- "แชทใหม่" button (shown when showNewChat=true, e.g. after 5+ messages)
- Both buttons: glass morphism style (bg-background/80 backdrop-blur)
- Stack vertically, gap-2
- Smooth fade-in with scale animation
- MDES indigo color for badges

"use client", TypeScript strict, Tailwind.`,
    max: 3000,
  },

  {
    id: 'INNOMCP_ABOUT_PANEL',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/INNOMCPAboutPanel.tsx',
    msg: `Create INNOMCPAboutPanel.tsx — "เกี่ยวกับ INNOMCP" info panel.

Shows product information for Thai government users.

Props: { onClose: () => void }

Content to include:
- INNOMCP logo + version badge (v10.17)
- Full name: "INNOMCP — ระบบ AI สำหรับภาครัฐ"
- Organization: กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES)
- Description: Multi-agent AI chat platform, 24/7 via MDES Ollama
- Key capabilities list: MCP Tools, Thai AI, Multi-agent, Government Data, Computer Use
- Links section: GitHub, Documentation, Report Problem
- System info: Node.js version, Model count (from /api/mdes/models)
- Contact: innova@mdes.go.th (placeholder)
- Credits: "สร้างโดย innova-bot | ขับเคลื่อนด้วย MDES Ollama"

Design: compact slide-in panel, MDES branding, Thai text prominent
"use client", TypeScript strict, Tailwind.`,
    max: 3500,
  },

  {
    id: 'CHAT_SHORTCUT_HELP',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/ShortcutHelpBubble.tsx',
    msg: `Create ShortcutHelpBubble.tsx — inline keyboard shortcut help for INNOMCP.

A compact tooltip/bubble that appears near the ChatInput showing keyboard shortcuts.
Triggered by pressing "?" in an empty input field.

\`\`\`ts
interface ShortcutHelpBubbleProps {
  visible: boolean;
  onClose: () => void;
}
\`\`\`

Content (Thai + key combo):
- Enter → ส่งข้อความ
- Shift+Enter → ขึ้นบรรทัดใหม่
- Ctrl+K → คำสั่งด่วน (Command Palette)
- Ctrl+/ → คีย์ลัดทั้งหมด
- Esc → หยุด AI
- / → เปิดเมนูคำสั่ง (slash commands)

Design:
- Small floating card (max-w-xs) near the input
- Fade in/out animation
- Each row: key badge + Thai description
- "ปิด" button (×)
- Keyboard: Escape closes it

"use client", TypeScript strict, Tailwind.`,
    max: 2500,
  },

  {
    id: 'INNOMCP_LOADING_SKELETON',
    model: FAST,
    out: 'innomcp-next/src/app/components/common/ChatSkeleton.tsx',
    msg: `Create ChatSkeleton.tsx — loading skeleton for the INNOMCP chat page.

Shows while the chat page is loading (Suspense boundary / initial hydration).

\`\`\`ts
interface ChatSkeletonProps {
  lines?: number; // number of skeleton message rows, default 3
}
\`\`\`

Build:
- Header skeleton: MDESBrandHeader shape (full width, h-12)
- Sidebar skeleton: left column (hidden on mobile)
- 3 message bubbles (alternating left/right): rounded rect, pulsing animation
- Composer skeleton: bottom input area

Use Tailwind's animate-pulse for skeleton effect.
Colors: bg-muted/50 for skeleton elements.
Match the INNOMCP layout dimensions.

"use client", TypeScript strict, Tailwind.`,
    max: 2000,
  },

  {
    id: 'MDES_AGENT_CARD',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/MDESAgentCard.tsx',
    msg: `Create MDESAgentCard.tsx — a compact card showing an MDES AI agent's status.

Used in ManusWorkspacePanel "งาน" tab to show active agents.

\`\`\`ts
interface MDESAgentCardProps {
  agentId: string;
  model: string;
  status: "thinking" | "using-tool" | "done" | "error";
  publicSummary?: string;
  toolName?: string;
  latencyMs?: number;
  className?: string;
}
\`\`\`

Design (Manus-style agent card):
- Left: Status icon (🤔 thinking, 🔧 tool, ✅ done, ❌ error) with color ring
- Center: agentId truncated + model badge + publicSummary (1 line, truncated)
- Right: latencyMs if done
- Card: rounded-lg, border, subtle bg
- "thinking" state: pulsing indigo border
- "using-tool" state: amber border + tool name badge
- "done" state: green border, static
- "error" state: red border

Animate: entry animation (slide-in from bottom) via CSS

"use client", TypeScript strict, Tailwind.`,
    max: 3500,
  },

  {
    id: 'INNOMCP_404_PAGE',
    model: FAST,
    out: 'innomcp-next/src/app/not-found.tsx',
    msg: `Update innomcp-next/src/app/not-found.tsx with MDES branding.

The current not-found.tsx may be plain. Write a MDES-branded 404 page:

\`\`\`tsx
// No "use client" needed — server component is fine
import Link from 'next/link';

export default function NotFound() {
  return (
    // Full-screen centered layout
    // 🇹🇭 MDES INNOMCP header
    // "404 — ไม่พบหน้าที่ต้องการ" headline
    // Thai description: "หน้าที่คุณต้องการอาจถูกย้ายหรือลบแล้ว"
    // "กลับหน้าหลัก" button → href="/"
    // MDES indigo branding
  )
}
\`\`\`

TypeScript. No "use client". Tailwind CSS. Thai language. MDES brand.`,
    max: 1500,
  },

  {
    id: 'README_UPDATE',
    model: PRO,
    out: 'innomcp-next/README.md',
    msg: `Write a comprehensive README.md for innomcp-next (the Next.js frontend of INNOMCP).

## INNOMCP Frontend (innomcp-next)

MDES-branded Manus.ai-style chat frontend for Thailand's Government MCP Hub.

### Features
- 3-column Manus.ai layout: sidebar | chat | workspace panel
- MDES Ollama as primary AI provider (24/7, unlimited)
- Multi-agent dispatch with real-time progress tracking
- Provider management: add any provider (OpenAI, Anthropic, Groq, Ollama, etc.)
- Thai-first UI with government-focused starter prompts
- PWA-ready with offline detection

### Architecture
- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS + shadcn/ui conventions
- WebSocket for real-time streaming
- MDES Ollama integration

### Key Components
Brief descriptions of: MDESBrandHeader, ManusWorkspacePanel, CollapsibleAgentWrapper,
ChatEmptyStateManager, MDESModelPicker, ProviderModal (presets)

### Setup
\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Frontend: http://localhost:3000
Backend (innomcp-node): http://localhost:3011

### Provider Config
Default: MDES Ollama (https://ollama.mdes-innova.online)
Click ⚙️ in header to add custom providers.

Write in English + Thai mixed. ~500 words. Markdown.`,
    max: 5000,
  },
];

async function runWave5() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  👁️ Jit Watchdog — Wave 5: Backend + Tests + Docs            ║');
  console.log(`║  ${TASKS.length} parallel tasks | CODECOMMAND deepseek-v4-pro              ║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const start = Date.now();
  let totalTok = 0, ok = 0, fail = 0;
  const failed = [];

  await Promise.allSettled(TASKS.map(async (task) => {
    const r = await cc(task.id, task.model, SYS, task.msg, task.max);
    totalTok += r.tokens || 0;
    if (r.ok) {
      writeFile(task.out, extractCode(r.reply));
      process.stdout.write(`  ✅ ${task.id.padEnd(30)} ${r.ms}ms ${r.tokens}tok\n`);
      ok++;
    } else {
      process.stdout.write(`  ❌ ${task.id.padEnd(30)} ERR: ${r.error?.slice(0,70)}\n`);
      fail++;
      failed.push(task.id);
    }
  }));

  console.log('\n🔍 Gate: tsc\n');
  let tscPass = false;
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd:`${ROOT.replace(/\//g,path.sep)}\\innomcp-next`, stdio:'inherit', timeout:120000 });
    tscPass = true;
    console.log('  ✅ tsc PASS');
  } catch { console.log('  ⚠️  tsc FAIL (non-blocking)'); }

  const elapsed = ((Date.now()-start)/1000).toFixed(1);
  console.log(`\n🏁 Wave 5: ${ok}/${TASKS.length} ✅ | ~${totalTok.toLocaleString()}tok (4x=~${(totalTok*4).toLocaleString()}) | ${elapsed}s | tsc:${tscPass?'✅':'⚠️'}`);
  if (failed.length) console.log(`   Failed: ${failed.join(', ')}`);
}

runWave5().catch(e => { console.error('FATAL:', e); process.exit(1); });
