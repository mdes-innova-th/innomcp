#!/usr/bin/env node
/**
 * cc_mega_wave7.js — MAXIMUM BURN SWARM
 * 55 parallel tasks, all deepseek-v4-pro, high token limits
 * Goal: burn as much CODECOMMAND quota as possible while building innomcp 100%
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
const COMMON = `${ROOT}/innomcp-next/src/app/components/common`;
const API   = `${ROOT}/innomcp-next/src/app/api`;
const NODE  = `${ROOT}/innomcp-node/src`;
const HOOKS = `${ROOT}/innomcp-next/src/app/hooks`;
const LIB   = `${ROOT}/innomcp-next/src/app/lib`;

function slurp(fp, max=60000) {
  try { return fs.readFileSync(fp.replace(/\//g, path.sep), 'utf8').replace(/^﻿/, '').slice(0, max); }
  catch { return `[NOT FOUND: ${fp}]`; }
}

async function cc(id, model, sys, msg, max=10000) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${CC_BASE}/chat/completions`, {
      method:'POST',
      headers:{'Authorization':`Bearer ${CC_KEY}`,'Content-Type':'application/json'},
      body: JSON.stringify({
        model, max_tokens:max, temperature:0.15, stream:false,
        messages:[{role:'system',content:sys},{role:'user',content:msg}]
      }),
      signal: AbortSignal.timeout(360000),
    });
    const j=await r.json(), ms=Date.now()-t0;
    const reply=j.choices?.[0]?.message?.content||'', tokens=j.usage?.total_tokens||0;
    if(!reply) return {id, ok:false, ms, tokens, error:JSON.stringify(j).slice(0,200)};
    return {id, ok:true, ms, tokens, reply};
  } catch(e) { return {id, ok:false, ms:Date.now()-t0, tokens:0, error:e.message}; }
}

function extract(r) {
  const m = r.match(/```(?:tsx?|ts|js|javascript|json|css|md|mdx|yaml|sh|bash)?\n([\s\S]+?)```/);
  return m ? m[1].trim() : r.trim();
}

function writeFile(rel, content, baseDir) {
  const b = (baseDir||ROOT).replace(/\//g, path.sep);
  const full = path.join(b, rel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(full), {recursive:true});
  if (content.startsWith('```')) content = extract(content);
  fs.writeFileSync(full, content, 'utf8');
  process.stdout.write(`  ✏️  ${rel.split('/').slice(-1)[0]} (${Math.round(content.length/1024)}KB)\n`);
}

const SYS = `You are a world-class engineer building INNOMCP — Thailand's premier government AI platform by MDES.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม.
Stack: Next.js 14 App Router, TypeScript strict, Tailwind CSS, React 18, Node.js, Jest, Playwright.
Primary AI: MDES Ollama (https://ollama.mdes-innova.online) — unlimited government cloud.
Output ONLY the complete, production-ready file content wrapped in \`\`\`tsx/ts/js/json/md ... \`\`\`.
Absolute rules: (1) No truncation — full file every time (2) Thai UI strings (3) Preserve all existing functionality (4) No placeholder comments`;

// ─── 55 TASKS ────────────────────────────────────────────────────────────────

const TASKS = [

  // ═══ GROUP 1: RICH MESSAGE COMPONENTS (12 tasks) ════════════════════════════

  {id:'MSG_BUBBLE_ENHANCED', model:PRO, max:12000,
   out:'innomcp-next/src/app/components/chat/MDESChatBubble.tsx',
   msg:`Create MDESChatBubble.tsx — the definitive Manus.ai-style message bubble for INNOMCP.
A drop-in replacement/enhancement wrapper around message content.

Props:
\`\`\`ts
interface MDESChatBubbleProps {
  role: "user" | "ai" | "system";
  content: string;
  timestamp?: number;
  model?: string;          // e.g. "gemma4:26b"
  agentId?: string;
  isStreaming?: boolean;
  isComplete?: boolean;
  elapsedMs?: number;
  followUpSuggestions?: string[];
  onSuggestionClick?: (s: string) => void;
  onRetry?: () => void;
  onCopy?: () => void;
  onFeedback?: (rating: "good"|"bad") => void;
  className?: string;
}
\`\`\`

User bubble: right-aligned, indigo/blue bg, white text, rounded-3xl br-sm
AI bubble:   left-aligned, card bg, border, rounded-3xl bl-sm, Manus-style
- AI bubble header: {model} badge (tiny) + elapsed time
- AI bubble footer: copy btn + retry btn + 👍/👎 (appear on hover)
- Streaming: animated typing cursor
- Follow-up suggestions: horizontal scrolling chips below AI bubble
- System: center-aligned, muted, italic

Thai-first: timestamps in Thai locale, "AI กำลังตอบ..." while streaming
Motion: subtle slide-in from respective side (CSS only)

"use client", TypeScript strict, Tailwind.`},

  {id:'FOLLOW_UP_CHIPS', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/FollowUpSuggestions.tsx',
   msg:`Create FollowUpSuggestions.tsx — Manus.ai-style follow-up suggestion chips.

When the AI responds, show clickable suggestion chips for next questions.

\`\`\`ts
interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}
\`\`\`

Design:
- Horizontal scroll container (no wrap on mobile)
- Each chip: pill shape, border, hover highlight
- Truncate long suggestions at 60 chars
- Fade out right edge (gradient mask) when scrollable
- Smooth scroll on overflow
- Thai text support (longer text handled gracefully)
- Entry animation: chips slide in with stagger

"use client", TypeScript strict, Tailwind.`},

  {id:'CODE_BLOCK_RENDERER', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/chat/MDESCodeBlock.tsx',
   msg:`Create MDESCodeBlock.tsx — syntax-highlighted code block for INNOMCP chat.
No external syntax highlighting libs — use CSS classes + inline styles.

\`\`\`ts
interface MDESCodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;      // px, scrollable if content exceeds
}
\`\`\`

Features:
- Header: language badge + filename (if provided) + copy button + run button (if JS/Python)
- Code area: monospace font, dark bg, line numbers optional
- Copy button: shows "คัดลอกแล้ว ✓" for 2s then resets
- Run button: for JS = opens browser console stub; for Python = shows placeholder
- Horizontal scroll for long lines
- Max height with fade-out + "ดูเพิ่มเติม" expand button
- Keywords highlighted via CSS: basic keyword/string/comment coloring
- Dark theme always (code blocks should always be dark regardless of app theme)

"use client", TypeScript strict, Tailwind.`},

  {id:'TABLE_RENDERER', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/MDESTableRenderer.tsx',
   msg:`Create MDESTableRenderer.tsx — smart table renderer for AI-generated tables in INNOMCP.

Parses markdown table syntax and renders as a styled HTML table.

\`\`\`ts
interface MDESTableRendererProps {
  markdown: string;        // raw markdown table string
  caption?: string;
  maxRows?: number;        // show N rows + "ดูเพิ่มเติม N แถว"
  sortable?: boolean;      // enable column sorting
  downloadable?: boolean;  // add "ดาวน์โหลด CSV" button
}
\`\`\`

Features:
- Parse markdown table (| header | header | syntax)
- Responsive: horizontal scroll on mobile
- Striped rows
- Sortable columns (click header to sort asc/desc) when sortable=true
- Row count badge: "N แถว"
- CSV download when downloadable=true
- Thai text support (proper word wrap)
- Compact variant for small tables

"use client", TypeScript strict, Tailwind.`},

  {id:'WEATHER_CARD', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/MDESWeatherCard.tsx',
   msg:`Create MDESWeatherCard.tsx — Thai government weather card for INNOMCP.

Renders weather data from TMD/NWP (Thai Meteorological Department) in a rich card.

\`\`\`ts
interface WeatherData {
  location: string;        // จังหวัด/สถานที่
  temperature: number;     // Celsius
  feelsLike?: number;
  humidity?: number;       // percentage
  condition: string;       // "แดดจัด" | "ฝนตก" | "มีเมฆ" | etc.
  windSpeed?: number;      // km/h
  uvIndex?: number;
  forecast?: Array<{ day: string; high: number; low: number; icon: string; }>;
  warnings?: string[];     // เตือนภัย
  source?: string;         // "กรมอุตุนิยมวิทยา"
  updatedAt?: string;
}

interface MDESWeatherCardProps {
  data: WeatherData;
  compact?: boolean;
  className?: string;
}
\`\`\`

Design: MDES-styled card with weather icon, temperature, humidity, wind
Warnings: show in red banner if present
Forecast: 5-day strip at bottom
"use client", TypeScript strict, Tailwind.`},

  {id:'GEO_MAP_CARD', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/chat/MDESMapCard.tsx',
   msg:`Create MDESMapCard.tsx — geographic info card for Thai government data in INNOMCP.

Shows location/province data from Thai Geo Tool results.

\`\`\`ts
interface GeoData {
  name: string;           // ชื่อจังหวัด/อำเภอ/ตำบล
  type: "province" | "district" | "subdistrict" | "poi";
  region?: string;        // ภาค (เหนือ/กลาง/ตะวันออกเฉียงเหนือ/ใต้/ออก/ตะวันตก)
  population?: number;
  area?: number;          // ตารางกิโลเมตร
  latitude?: number;
  longitude?: number;
  stats?: Record<string, string | number>;
}

interface MDESMapCardProps {
  data: GeoData;
  className?: string;
}
\`\`\`

Design:
- Header: location name + type badge (จังหวัด/อำเภอ/ตำบล)
- Stats grid: population, area, region
- Coordinates: copyable lat/lon
- Link to Google Maps (if lat/lon available)
- Stats table for additional data
- Thai font rendering optimization

"use client", TypeScript strict, Tailwind.`},

  {id:'DOCUMENT_CARD', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/chat/MDESDocumentCard.tsx',
   msg:`Create MDESDocumentCard.tsx — document preview card for INNOMCP.

Shows uploaded/generated documents with preview and actions.

\`\`\`ts
type DocType = "pdf" | "word" | "excel" | "image" | "csv" | "json" | "text";

interface MDESDocumentCardProps {
  name: string;
  type: DocType;
  size?: number;           // bytes
  pages?: number;          // for PDFs
  preview?: string;        // first 200 chars of content
  downloadUrl?: string;
  createdAt?: number;
  onDownload?: () => void;
  onPreview?: () => void;
  className?: string;
}
\`\`\`

Design:
- File type icon (emoji-based: 📄 PDF, 📊 Excel, 📝 Word, 🖼️ Image)
- File name + size badge
- Content preview (truncated, expandable)
- Download + Preview action buttons
- Created time in Thai locale
- Government file stamp style (MDES)

"use client", TypeScript strict, Tailwind.`},

  {id:'EVIDENCE_CARD', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/MDESEvidenceCard.tsx',
   msg:`Create MDESEvidenceCard.tsx — evidence/source citation card for INNOMCP responses.

When AI uses evidence tools, show the sources in a citation card.

\`\`\`ts
interface Evidence {
  id: string;
  title: string;
  source: string;          // source name/URL
  excerpt: string;         // relevant text excerpt
  confidence?: number;     // 0-1
  category?: string;       // "กฎหมาย" | "ข้อมูลสถิติ" | "ข่าว" | etc.
  publishedAt?: string;
  url?: string;
}

interface MDESEvidenceCardProps {
  evidences: Evidence[];
  collapsed?: boolean;     // default collapsed, expand to show all
  className?: string;
}
\`\`\`

Design:
- Collapsed: "อ้างอิง N แหล่ง" badge + expand chevron
- Expanded: list of evidence cards
  - Each: numbered citation + source icon + title + excerpt
  - Confidence bar if provided
  - Link to source if URL available
- Thai citation format
- Government blue accent

"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_QR_RENDERER', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/chat/MDESQRCode.tsx',
   msg:`Create MDESQRCode.tsx — QR code display component for INNOMCP.

Shows QR code results from the system tool.

\`\`\`ts
interface MDESQRCodeProps {
  value: string;         // URL or text encoded in QR
  size?: number;         // px, default 200
  label?: string;        // text below QR
  downloadable?: boolean;
  className?: string;
}
\`\`\`

Since we can't use external QR lib, render as:
- Placeholder card with QR icon (🔲 large)
- The encoded value shown as copyable text
- "ดาวน์โหลด QR" button (placeholder - would need qrcode lib)
- Label below
- Note: "ต้องการ library qrcode เพิ่มเติม"

"use client", TypeScript strict, Tailwind.`},

  {id:'CHAT_TIMESTAMP', model:FAST, max:3000,
   out:'innomcp-next/src/app/components/chat/ChatTimestamp.tsx',
   msg:`Create ChatTimestamp.tsx — smart relative/absolute timestamp for chat messages.

\`\`\`ts
interface ChatTimestampProps {
  timestamp: number;       // unix ms
  format?: "relative" | "absolute" | "both";
  className?: string;
}
\`\`\`

Features:
- relative: "เมื่อสักครู่" | "2 นาทีที่แล้ว" | "1 ชั่วโมงที่แล้ว" | "เมื่อวาน" | "วันที่ DD/MM/YYYY"
- absolute: "HH:MM น. วันที่ DD เดือน YYYY" (Thai format)
- both: shows relative, hover shows absolute as tooltip
- Updates every minute when relative (useEffect interval)
- Thai date/time formatting (month names in Thai)
- Accessible: aria-label with full date

"use client", TypeScript strict, Tailwind.`},

  {id:'MESSAGE_REACTIONS', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/chat/MessageReactions.tsx',
   msg:`Create MessageReactions.tsx — emoji reactions for INNOMCP chat messages.

\`\`\`ts
interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onReact: (emoji: string) => void;
  onAddCustom?: () => void;
  className?: string;
}
\`\`\`

Common reactions: 👍 ✅ ❤️ 😮 🎯 📌
Build:
- Row of reaction pills (emoji + count)
- Active reaction: highlighted border
- + button for adding more (calls onAddCustom)
- Tooltip on hover: show who reacted (count only)
- Animated count change

"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_IMAGE_VIEWER', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/chat/MDESImageViewer.tsx',
   msg:`Create MDESImageViewer.tsx — full-screen image viewer for AI-generated images in INNOMCP.

\`\`\`ts
interface MDESImageViewerProps {
  src: string;
  alt?: string;
  prompt?: string;         // the AI prompt used to generate it
  model?: string;          // image generation model used
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}
\`\`\`

Features:
- Full-screen modal with backdrop
- Image with object-fit contain
- Header: prompt text (truncated 80 chars) + model badge
- Footer: download button + close button + share button
- Keyboard: Escape closes
- Pinch-zoom on mobile (CSS touch-action)
- Loading skeleton while image loads
- Error fallback if image fails

"use client", TypeScript strict, Tailwind.`},

  // ═══ GROUP 2: BACKEND FEATURES (10 tasks) ═══════════════════════════════════

  {id:'BACKEND_WORKSPACE_FILES', model:PRO, max:8000,
   out:'innomcp-next/src/app/api/workspace/files/route.ts',
   msg:`Create Next.js App Router API route: /api/workspace/files

Full CRUD for workspace file management.

GET /api/workspace/files?path=/ — list files in workspace directory
POST /api/workspace/files — create/write a file { path, content, encoding? }
DELETE /api/workspace/files?path=xxx — delete a file
GET /api/workspace/files/download?path=xxx — download a file

Uses innomcp's workspace-storage/ directory as the base.
Base path: process.cwd() + '/workspace-storage'

Security:
- Path traversal prevention (normalize + check stays within base)
- File size limit: 10MB
- Allowed extensions: .txt .md .json .csv .py .js .ts .html .pdf .png .jpg

TypeScript strict. Next.js 14 App Router.
Use Response / NextResponse correctly.`},

  {id:'BACKEND_STATS_API', model:PRO, max:7000,
   out:'innomcp-next/src/app/api/stats/route.ts',
   msg:`Create GET /api/stats — usage statistics endpoint for INNOMCP analytics.

Returns current session stats:
\`\`\`ts
interface INNOMCPStats {
  session: {
    activeConnections: number;
    messagesThisSession: number;
    uptime: number;           // seconds since server start
  };
  models: {
    totalRequests: number;
    byModel: Record<string, number>;
  };
  tools: {
    totalCalls: number;
    byTool: Record<string, number>;
  };
  errors: {
    count: number;
    lastError?: string;
  };
  timestamp: number;
}
\`\`\`

Implementation:
- Read from in-memory counters (module-level singleton)
- Also accept POST to increment counters from frontend
- Add CORS headers
- Cache: no-store (always fresh)

TypeScript strict. Next.js 14.`},

  {id:'BACKEND_PREFERENCES', model:PRO, max:7000,
   out:'innomcp-next/src/app/api/user/preferences/route.ts',
   msg:`Create GET/POST /api/user/preferences — user preferences persistence for INNOMCP.

Stores user preferences server-side (session cookie + localStorage fallback).

Preference schema:
\`\`\`ts
interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "th" | "en";
  providerMode: "remote" | "local";
  defaultModel: string;
  chatMode: "normal" | "multiagent";
  compactMode: boolean;
  showTimestamps: boolean;
  soundEnabled: boolean;
  keyboardShortcuts: boolean;
  tourCompleted: boolean;
  favoritePrompts: string[];
  customProviders: Array<{ name: string; baseUrl: string; }>;
}
\`\`\`

GET: returns current preferences (from cookie or defaults)
POST: updates preferences (merges, not replaces)
DELETE: resets to defaults

Use cookies (httpOnly: false, so frontend can read).
TypeScript strict. Next.js 14.`},

  {id:'BACKEND_MDES_SEARCH', model:PRO, max:7000,
   out:'innomcp-next/src/app/api/mdes/search/route.ts',
   msg:`Create GET /api/mdes/search?q=query&model=xxx — search MDES Ollama models by name.

Proxies to MDES Ollama /api/tags and filters by query.

\`\`\`ts
// Response: { models: [{name, size, modified_at, parameterSize, family}], query, total }
\`\`\`

Features:
- Case-insensitive search
- Filter by family (gemma, qwen, etc.)
- Sort by: name | size | modified_at
- Pagination: ?page=1&limit=20
- Cache: 5 minutes (revalidate)

TypeScript strict. Next.js 14 App Router.`},

  {id:'BACKEND_FEEDBACK_API', model:FAST, max:5000,
   out:'innomcp-next/src/app/api/feedback/route.ts',
   msg:`Create POST /api/feedback — save message feedback for INNOMCP.

\`\`\`ts
// POST body: { messageId: string; rating: "good" | "bad"; comment?: string; sessionId?: string; }
// Response: { success: true; feedbackId: string; }
\`\`\`

Implementation:
- Validate body fields
- Append to logs/feedback.jsonl (newline-delimited JSON)
- Return feedbackId (random uuid-like)
- Rate limit: max 100 feedbacks per session

GET /api/feedback/summary — returns feedback stats (count good/bad)

TypeScript strict. Next.js 14.`},

  {id:'BACKEND_EXPORT_API', model:PRO, max:8000,
   out:'innomcp-next/src/app/api/chat/export/route.ts',
   msg:`Create POST /api/chat/export — export chat conversation in multiple formats.

\`\`\`ts
// POST body: { messages: Array<{sender: "user"|"ai"; text: string; timestamp?: number;}>, format: "markdown" | "json" | "txt", title?: string }
// Response: file download with appropriate Content-Type
\`\`\`

Formats:
- markdown: # {title}\\n\\n**User**: {text}\\n\\n**AI**: {text}\\n---
- json: pretty-printed JSON array
- txt: plain text conversation

Headers:
- Content-Disposition: attachment; filename="innomcp-chat-{timestamp}.{ext}"
- Content-Type: text/markdown | application/json | text/plain

TypeScript strict. Next.js 14. Streaming response for large exports.`},

  {id:'BACKEND_WEBSOCKET_EVENTS', model:PRO, max:10000,
   out:'innomcp-next/src/app/api/ws/events/route.ts',
   msg:`Create a Server-Sent Events (SSE) endpoint: GET /api/ws/events

An alternative to WebSocket for environments that don't support WS.
Streams real-time events from MDES agents.

Event types to stream:
- agent:started — { agentId, model, timestamp }
- tool:called — { toolName, agentId, timestamp }
- answer:delta — { text: string, timestamp }
- answer:complete — { finalText, elapsed, timestamp }
- error — { message, timestamp }

Implementation:
- ReadableStream with TextEncoder
- SSE format: "data: {...}\\n\\n"
- Heartbeat every 30s: "data: {type:'ping'}\\n\\n"
- Proper headers: Content-Type: text/event-stream, Cache-Control: no-cache

TypeScript strict. Next.js 14 App Router.`},

  {id:'BACKEND_RATE_LIMITER', model:PRO, max:6000,
   out:'innomcp-next/src/middleware.ts',
   msg:`Update/create Next.js middleware.ts for INNOMCP with rate limiting and security.

\`\`\`ts
// middleware.ts — runs on edge, protects API routes
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting: simple in-memory approach (resets per edge instance)
// API routes: max 60 req/min per IP
// Chat routes: max 20 req/min per IP

// Security headers to add:
// X-Frame-Options: DENY
// X-Content-Type-Options: nosniff
// Referrer-Policy: strict-origin-when-cross-origin
// X-XSS-Protection: 1; mode=block
// Content-Security-Policy: (permissive for now, allow MDES CDN)

// Paths to rate limit: /api/*
// Paths to exclude: /api/health, /api/mdes/health
\`\`\`

TypeScript strict. Edge runtime compatible (no Node.js APIs).`},

  {id:'BACKEND_HEALTH_DETAILED', model:FAST, max:5000,
   out:'innomcp-next/src/app/api/health/detailed/route.ts',
   msg:`Create GET /api/health/detailed — comprehensive health endpoint for INNOMCP monitoring.

\`\`\`ts
interface DetailedHealth {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;           // from package.json
  uptime: number;            // process.uptime()
  timestamp: number;
  services: {
    mdesOllama: { status: string; latencyMs?: number; };
    database: { status: string; };
    websocket: { activeConnections: number; };
    cache: { entries: number; };
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  environment: "development" | "production" | "test";
}
\`\`\`

TypeScript strict. Next.js 14. Include runtime info from Node.js process.`},

  {id:'BACKEND_MDES_PROXY', model:PRO, max:8000,
   out:'innomcp-next/src/app/api/mdes/proxy/route.ts',
   msg:`Create POST /api/mdes/proxy — proxy endpoint for MDES Ollama chat completions.

Allows frontend to call MDES Ollama without exposing credentials.

POST body: OpenAI-compatible chat completions request
\`\`\`ts
interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string; }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}
\`\`\`

Implementation:
- Forward to https://ollama.mdes-innova.online/v1/chat/completions
- Support streaming (forward SSE chunks to client)
- Add MDES auth header if required
- Timeout: 120s
- Error handling: forward upstream errors with context
- Log request metadata (not content) for analytics

TypeScript strict. Next.js 14 App Router. Streaming support.`},

  // ═══ GROUP 3: HOOKS & UTILITIES (8 tasks) ════════════════════════════════════

  {id:'HOOK_CHAT_STATE', model:PRO, max:10000,
   out:'innomcp-next/src/app/hooks/useChatState.ts',
   msg:`Create useChatState.ts — comprehensive chat state management hook for INNOMCP.

Extracts and centralizes the complex state from ChatPage.tsx into a clean hook.

\`\`\`ts
interface ChatState {
  messages: ChatMessage[];
  input: string;
  isWaitingForResponse: boolean;
  isSocketReady: boolean;
  hasMessages: boolean;
  activeSummaryId: string | null;
  workspaceOpen: boolean;
  modelSettingsOpen: boolean;
  multiAgentOpen: boolean;
  providerMode: "remote" | "local";
  artifacts: Artifact[];
  chatMode: ChatMode;
  selectedToolType: ToolType;
}

interface ChatActions {
  setInput: (v: string) => void;
  sendMessage: () => Promise<void>;
  handleStop: () => void;
  handleNewChat: () => void;
  toggleWorkspace: () => void;
  toggleModelSettings: () => void;
  toggleMultiAgent: () => void;
  setProviderMode: (mode: "remote" | "local") => void;
  addArtifact: (a: Artifact) => void;
}
\`\`\`

Hook: useChatState(config?) → { state, actions }
Encapsulate localStorage persistence, WebSocket management, message handling.
"use client" hook. TypeScript strict.`},

  {id:'HOOK_KEYBOARD_SHORTCUTS', model:PRO, max:8000,
   out:'innomcp-next/src/app/hooks/useKeyboardShortcuts.ts',
   msg:`Create useKeyboardShortcuts.ts — centralized keyboard shortcut manager for INNOMCP.

\`\`\`ts
interface ShortcutAction {
  key: string;             // e.g. "k", "/", "n"
  modifiers?: ("ctrl"|"meta"|"shift"|"alt")[];
  description: string;     // Thai description
  action: () => void;
  enabled?: boolean;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutAction[];
  enabled?: boolean;
}

// Hook: useKeyboardShortcuts(options)
// Registers/unregisters shortcuts on mount/unmount
// Ignores when user is typing in an input/textarea
// Returns: { shortcuts, isEnabled, toggleEnabled }
\`\`\`

Pre-defined shortcuts to support:
- Ctrl+K → command palette
- Ctrl+/ → shortcuts panel
- Ctrl+N → new chat
- Escape → stop AI / close modal
- ? → show shortcuts help (when input is empty)

"use client" hook. TypeScript strict.`},

  {id:'HOOK_NOTIFICATIONS', model:PRO, max:7000,
   out:'innomcp-next/src/app/hooks/useNotifications.ts',
   msg:`Create useNotifications.ts — notification state management hook for INNOMCP.

\`\`\`ts
type NotificationLevel = "success" | "warning" | "error" | "info" | "mdes";

interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message?: string;
  duration?: number;       // ms, 0 = persistent
  action?: { label: string; onClick: () => void; };
  timestamp: number;
}

// Hook: useNotifications()
// Returns: {
//   notifications: Notification[];
//   add: (n: Omit<Notification, "id"|"timestamp">) => string;
//   dismiss: (id: string) => void;
//   dismissAll: () => void;
//   unreadCount: number;
// }
\`\`\`

Implementation:
- In-memory state (no persistence)
- Auto-dismiss after duration
- Max 10 notifications at once (oldest dismissed when overflow)
- Helper: notifySuccess, notifyError, notifyMDES (MDES brand notification)

"use client" hook. TypeScript strict.`},

  {id:'HOOK_PROVIDER_HEALTH', model:FAST, max:5000,
   out:'innomcp-next/src/app/hooks/useProviderHealth.ts',
   msg:`Create useProviderHealth.ts — real-time provider health monitoring hook.

\`\`\`ts
interface ProviderStatus {
  id: string;
  name: string;
  healthy: boolean;
  latencyMs: number;
  lastChecked: number;
  model?: string;
}

// Hook: useProviderHealth(options?: { interval?: number; providers?: string[] })
// Returns: {
//   statuses: ProviderStatus[];
//   mdesStatus: ProviderStatus | undefined;
//   isAllHealthy: boolean;
//   lastChecked: number;
//   refresh: () => void;
// }
\`\`\`

- Polls /api/providers/health-check every interval (default 60s)
- Also polls /api/mdes/health for MDES specifically every 30s
- Returns degraded status if latency > 5s
- Retry 3 times before marking unhealthy

"use client" hook. TypeScript strict.`},

  {id:'LIB_THAI_UTILS', model:PRO, max:8000,
   out:'innomcp-next/src/app/lib/thai-utils.ts',
   msg:`Create thai-utils.ts — Thai language utility library for INNOMCP.

Pure TypeScript, no external deps.

\`\`\`ts
// Thai date formatting
export function formatThaiDate(date: Date | number, options?: {
  includeTime?: boolean;
  shortYear?: boolean;
  buddhistEra?: boolean;  // add 543 for Buddhist Era
}): string

// Thai number formatting
export function formatThaiNumber(n: number, options?: {
  useThai?: boolean;      // use Thai numerals ๐๑๒๓...
  compact?: boolean;      // ล้าน/พัน/แสน suffixes
}): string

// Thai relative time
export function thaiRelativeTime(timestamp: number): string
// Returns: "เมื่อสักครู่" | "2 นาทีที่แล้ว" | "1 ชั่วโมงที่แล้ว" | "เมื่อวาน"

// Thai text truncation (word-aware)
export function truncateThai(text: string, maxChars: number, suffix?: string): string

// Province name validator
export function isThaiProvince(name: string): boolean

// Thai phone number formatter
export function formatThaiPhone(phone: string): string

// Buddhist Era year
export function toBuddhistYear(year: number): number

// Thai currency formatter
export function formatThaiCurrency(amount: number, currency?: "THB"): string
\`\`\`

Full implementations (not stubs). TypeScript strict.`},

  {id:'LIB_MDES_CONSTANTS', model:FAST, max:5000,
   out:'innomcp-next/src/app/lib/mdes-constants.ts',
   msg:`Create mdes-constants.ts — MDES brand and API constants for INNOMCP.

\`\`\`ts
// MDES Endpoints
export const MDES_OLLAMA_URL = 'https://ollama.mdes-innova.online';
export const MDES_THAILLM_URL = 'https://api.thaillm.mdes.go.th/v1';

// MDES Brand Colors
export const MDES_COLORS = {
  primary: '#1a3c6e',
  primaryLight: '#2d5a9e',
  accent: '#c8973e',
  accentLight: '#e8b85e',
  thai: '#C00000',  // Thai red
} as const;

// Thai Government Provinces (all 77)
export const THAI_PROVINCES: Array<{ name: string; nameEN: string; region: string; code: string; }> = [
  { name: 'กรุงเทพมหานคร', nameEN: 'Bangkok', region: 'กลาง', code: '10' },
  // ... all 77 provinces
];

// MDES Model Families (MDES Ollama)
export const MDES_MODEL_FAMILIES = ['gemma', 'qwen', 'llama', 'deepseek', 'mistral', 'phi'] as const;

// Government MCP Tool Names
export const MCP_TOOLS = {
  EVIDENCE: 'detect_evidence_stats',
  GEO: 'thai_geo_tool',
  STATUS: 'system_status_tool',
  KNOWLEDGE: 'thaiKnowledgeTool',
} as const;

// Chat limits
export const CHAT_LIMITS = {
  MAX_INPUT_CHARS: 4000,
  MAX_HISTORY_MESSAGES: 20,
  MAX_ATTACHMENTS: 5,
  MAX_FILE_SIZE_MB: 5,
} as const;
\`\`\`

Include all 77 Thai provinces with correct data. TypeScript strict.`},

  {id:'LIB_FORMAT_MESSAGE', model:PRO, max:8000,
   out:'innomcp-next/src/app/lib/formatMessage.ts',
   msg:`Create formatMessage.ts — message text formatting library for INNOMCP chat.

Converts AI response text (markdown) to structured React-renderable content.

\`\`\`ts
type ContentBlock =
  | { type: 'text'; content: string; }
  | { type: 'code'; language: string; code: string; filename?: string; }
  | { type: 'table'; markdown: string; }
  | { type: 'list'; items: string[]; ordered: boolean; }
  | { type: 'heading'; level: 1|2|3; text: string; }
  | { type: 'blockquote'; text: string; }
  | { type: 'hr' }
  | { type: 'image'; src: string; alt?: string; };

export function parseMessageToBlocks(text: string): ContentBlock[]

export function extractCodeBlocks(text: string): Array<{ language: string; code: string; }>

export function extractMarkdownTables(text: string): string[]

export function detectContentType(text: string): 'simple' | 'rich' | 'code-heavy' | 'table-heavy'

export function sanitizeHTML(html: string): string  // remove dangerous tags

export function renderThaiText(text: string): string  // optimize Thai word spacing
\`\`\`

Full implementations. TypeScript strict.`},

  {id:'LIB_STORAGE', model:PRO, max:7000,
   out:'innomcp-next/src/app/lib/storage.ts',
   msg:`Create storage.ts — robust localStorage wrapper for INNOMCP.

Handles quota exceeded, JSON parse errors, SSR (no window), and TypeScript generics.

\`\`\`ts
interface StorageOptions<T> {
  key: string;
  defaultValue: T;
  ttl?: number;            // milliseconds, undefined = no expiry
  serialize?: (v: T) => string;
  deserialize?: (s: string) => T;
}

class INNOMCPStorage {
  get<T>(key: string, defaultValue: T): T
  set<T>(key: string, value: T, ttl?: number): boolean
  remove(key: string): void
  clear(prefix?: string): void  // clear all or by prefix
  has(key: string): boolean
  keys(prefix?: string): string[]
  size(): number               // bytes used
  quota(): { used: number; total: number; percentage: number; }
}

export const storage = new INNOMCPStorage();

// Typed storage keys
export const STORAGE_KEYS = {
  CHAT_MESSAGES: 'innomcp.chat.messages',
  CHAT_SUMMARIES: 'innomcp.chat.summaries',
  PREFERENCES: 'innomcp.user.preferences',
  PROVIDER_CONFIG: 'innomcp.provider.config',
  TOUR_DONE: 'innomcp.tour.done',
  DRAFT: 'innomcp.chat.draft',
  THEME: 'theme',
  SIDEBAR_STATE: 'innomcp-sidebar-state',
} as const;
\`\`\`

TypeScript strict. Works in SSR (Next.js). Test-friendly (injectable).`},

  // ═══ GROUP 4: ACCESSIBILITY & PWA (5 tasks) ══════════════════════════════════

  {id:'A11Y_FOCUS_MANAGER', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/common/FocusManager.tsx',
   msg:`Create FocusManager.tsx — keyboard focus management for INNOMCP modals and panels.

\`\`\`ts
interface FocusManagerProps {
  active: boolean;         // when true, trap focus inside
  onEscape?: () => void;
  initialFocus?: string;   // CSS selector for initial focus
  children: React.ReactNode;
  className?: string;
}
\`\`\`

Features:
- Focus trap: Tab/Shift+Tab cycles within children when active
- Escape key handler
- Restores focus to trigger element on deactivate
- Initial focus on mount (first focusable element or initialFocus)
- Focusable elements: button, [href], input, select, textarea, [tabindex]

Also export:
- useFocusTrap(containerRef, active) — hook version
- useFocusReturn(active) — returns focus to origin on deactivate

"use client", TypeScript strict.`},

  {id:'SKIP_NAVIGATION', model:FAST, max:3000,
   out:'innomcp-next/src/app/components/common/SkipNavigation.tsx',
   msg:`Create SkipNavigation.tsx — "ข้ามไปเนื้อหาหลัก" skip navigation for accessibility.

A visually hidden link that becomes visible on focus, allowing keyboard users to skip the navigation.

\`\`\`ts
interface SkipNavigationProps {
  targetId?: string;   // default: "main-content"
}
\`\`\`

Implementation:
- Position: fixed top-0 left-0
- Normally: sr-only (visually hidden)
- On focus: visible with MDES brand styling
- Text: "ข้ามไปเนื้อหาหลัก"
- On click: scrolls to #main-content (or targetId)

TypeScript strict, Tailwind.`},

  {id:'ERROR_BOUNDARY_ENHANCED', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/common/MDESErrorBoundary.tsx',
   msg:`Create MDESErrorBoundary.tsx — MDES-branded error boundary for INNOMCP.

Enhanced class-based React error boundary with Thai error messages and recovery options.

\`\`\`ts
interface MDESErrorBoundaryProps {
  componentName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;    // custom fallback UI
  onError?: (error: Error, info: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}
\`\`\`

Error UI states:
- Minor: compact inline "เกิดข้อผิดพลาด — กด รีเฟรช"
- Major: full card with error details (dev mode) or friendly message (prod)
- Recovery: "ลองอีกครั้ง" button + "รายงานปัญหา" link

MDES branding in error card.
Log errors to console + POST to /api/logs/error if severe.

TypeScript strict. "use client".`},

  {id:'PWA_INSTALL_PROMPT', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/common/PWAInstallPrompt.tsx',
   msg:`Create PWAInstallPrompt.tsx — PWA install prompt for INNOMCP.

Shows "ติดตั้ง INNOMCP" banner when browser supports PWA installation.

\`\`\`ts
interface PWAInstallPromptProps {
  className?: string;
}
\`\`\`

Implementation:
- Listen for beforeinstallprompt event
- Show compact banner at bottom: "ติดตั้ง INNOMCP เป็นแอปบนหน้าจอของคุณ" + Install + Dismiss
- Hide after install or dismiss (save to localStorage)
- Don't show on iOS (no PWA install API) — show instructions instead
- MDES brand styling

"use client", TypeScript strict.`},

  {id:'OFFLINE_SYNC', model:PRO, max:7000,
   out:'innomcp-next/src/app/hooks/useOfflineSync.ts',
   msg:`Create useOfflineSync.ts — offline detection and sync for INNOMCP.

\`\`\`ts
interface UseOfflineSyncReturn {
  isOnline: boolean;
  isReconnecting: boolean;
  pendingMessages: ChatMessage[];    // messages sent while offline
  syncPendingMessages: () => void;   // call when back online
  queueMessage: (msg: ChatMessage) => void;
  clearQueue: () => void;
}

// Hook: useOfflineSync()
\`\`\`

Implementation:
- Listen to window.online/offline events
- localStorage queue for messages sent while offline
- Auto-sync when connection restored (with exponential backoff)
- Show count of pending messages
- Retry logic: 3 attempts, 1s/2s/4s

"use client" hook. TypeScript strict.`},

  // ═══ GROUP 5: ADVANCED FEATURES (10 tasks) ═══════════════════════════════════

  {id:'MDES_AGENT_ORCHESTRATOR', model:PRO, max:12000,
   out:'innomcp-next/src/app/lib/agentOrchestrator.ts',
   msg:`Create agentOrchestrator.ts — client-side agent orchestration manager for INNOMCP.

Tracks the real-time state of multiple MDES agents working in parallel.

\`\`\`ts
type AgentStatus = "queued" | "thinking" | "tool-use" | "done" | "error";

interface AgentState {
  id: string;
  agentId: string;
  model: string;
  status: AgentStatus;
  startTime: number;
  endTime?: number;
  toolsUsed: string[];
  confidence?: number;
  summary?: string;
  error?: string;
}

interface OrchestrationState {
  runId: string;
  phase: "routing" | "dispatching" | "executing" | "synthesizing" | "done";
  agents: AgentState[];
  primaryAgent?: string;
  startTime: number;
  endTime?: number;
  totalMs?: number;
}

class AgentOrchestrator {
  constructor(events: AgentEvent[])
  getState(): OrchestrationState
  getActiveAgents(): AgentState[]
  getFastestAgent(): AgentState | undefined
  getSlowestAgent(): AgentState | undefined
  getPhaseProgress(): number  // 0-100
  toTimeline(): Array<{ time: number; event: string; }>
}

export function buildOrchestrationState(events: AgentEvent[]): OrchestrationState
\`\`\`

TypeScript strict. No external deps.`},

  {id:'CONTEXT_PROVIDERS', model:PRO, max:10000,
   out:'innomcp-next/src/app/context/INNOMCPProvider.tsx',
   msg:`Create INNOMCPProvider.tsx — unified context provider for INNOMCP global state.

Wraps the whole app and provides:
1. NotificationContext — global notifications
2. UserPreferencesContext — user settings
3. ProviderHealthContext — real-time provider status
4. ChatHistoryContext — conversation history management

\`\`\`tsx
interface INNOMCPContextValue {
  // Notifications
  notifications: Notification[];
  notify: (n: NotificationInput) => void;
  dismissNotification: (id: string) => void;

  // Preferences
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;

  // Provider health
  mdesHealthy: boolean;
  providerStatuses: ProviderStatus[];

  // Chat history
  totalConversations: number;
  clearAllHistory: () => void;
}

export const INNOMCPContext = createContext<INNOMCPContextValue>(...)

export function INNOMCPProvider({ children }: { children: React.ReactNode }) {
  // ... combines all contexts
}

export function useINNOMCP() {
  const ctx = useContext(INNOMCPContext);
  if (!ctx) throw new Error('useINNOMCP must be used within INNOMCPProvider');
  return ctx;
}
\`\`\`

"use client", TypeScript strict, full implementation.`},

  {id:'MDES_SEARCH_PANEL', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/chat/MDESSearchPanel.tsx',
   msg:`Create MDESSearchPanel.tsx — global search panel for INNOMCP.

Ctrl+K command palette already exists, but this is a dedicated SEARCH panel for:
1. Searching across all conversation history
2. Searching available MCP tools
3. Searching MDES Ollama models

\`\`\`ts
type SearchScope = "conversations" | "tools" | "models" | "all";

interface SearchResult {
  id: string;
  type: "conversation" | "tool" | "model" | "command";
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
  relevance: number;  // 0-1
}

interface MDESSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (result: SearchResult) => void;
  initialScope?: SearchScope;
}
\`\`\`

UI:
- Large centered modal (max-w-2xl)
- Scope tabs: ทั้งหมด | บทสนทนา | เครื่องมือ | โมเดล
- Instant search with debounce (150ms)
- Keyboard: ↑↓ navigate, Enter select, Esc close
- Empty state per scope
- Recent searches history

"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_STICKY_ACTIONS', model:FAST, max:5000,
   out:'innomcp-next/src/app/components/chat/ChatStickyActions.tsx',
   msg:`Create ChatStickyActions.tsx — sticky action bar that appears when conversation is active.

Shows above the ChatInput when conversation has messages.

\`\`\`ts
interface ChatStickyActionsProps {
  hasMessages: boolean;
  isStreaming: boolean;
  onNewChat: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  onClear?: () => void;
  unreadCount?: number;
}
\`\`\`

Build:
- Thin bar (h-8) between message list and composer
- Left: "แชทใหม่" button
- Center: search icon (search through history)
- Right: export + clear history buttons
- Appears with fade-in when hasMessages=true
- Hides when isStreaming

"use client", TypeScript strict, Tailwind.`},

  {id:'WORKSPACE_FILE_BROWSER', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/chat/WorkspaceFileBrowser.tsx',
   msg:`Create WorkspaceFileBrowser.tsx — file browser for Innova-workspace (Manus computer).

The "ไฟล์ผลลัพธ์" tab in ManusWorkspacePanel, enhanced into a real file browser.

\`\`\`ts
interface WorkspaceFile {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  mimeType?: string;
}

interface WorkspaceFileBrowserProps {
  currentPath?: string;
  onFileSelect?: (file: WorkspaceFile) => void;
  onFileDownload?: (file: WorkspaceFile) => void;
  artifacts?: Artifact[];    // from AI generations
  className?: string;
}
\`\`\`

UI:
- Breadcrumb navigation: Workspace > folder > subfolder
- File grid (icon + name + size + date)
- Icons per type: 📁 folder, 📄 doc, 🖼️ image, 📊 spreadsheet, 💻 code
- Right-click context: download, preview, delete
- Drag-drop upload (calls POST /api/workspace/files)
- Fetches from GET /api/workspace/files
- Thai file names supported

"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_QUICK_COMPOSE', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/QuickComposePanel.tsx',
   msg:`Create QuickComposePanel.tsx — quick message compose panel with templates for Thai government.

A floating compose helper that shows preset message templates.

\`\`\`ts
interface MessageTemplate {
  id: string;
  category: string;
  title: string;
  template: string;
  variables?: string[];  // e.g. ["จังหวัด", "วันที่"]
}

interface QuickComposePanelProps {
  onCompose: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}
\`\`\`

Built-in templates (Thai government):
1. สรุปเอกสาร — "กรุณาสรุปเอกสารนี้เป็น 5 ประเด็นหลัก ภาษาที่เข้าใจง่ายสำหรับผู้บริหาร"
2. ร่างหนังสือราชการ — "ช่วยร่างหนังสือราชการเรื่อง [หัวข้อ] ถึง [หน่วยงาน] โดยมีเนื้อหาดังนี้..."
3. วิเคราะห์ข้อมูล — "วิเคราะห์ข้อมูลนี้และสรุป 3 insight หลัก พร้อม recommendation"
4. ค้นหาข้อมูลกฎหมาย — "ค้นหาและอธิบายกฎหมาย/ระเบียบที่เกี่ยวข้องกับ [หัวข้อ]"
5. รายงานสภาพอากาศ — "รายงานสภาพอากาศและการเตือนภัยธรรมชาติ จังหวัด [จังหวัด] วันนี้"

Panel shows categories + templates + variable fill-in form before compose.
"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_TELEMETRY', model:FAST, max:5000,
   out:'innomcp-next/src/app/lib/telemetry.ts',
   msg:`Create telemetry.ts — lightweight analytics/telemetry for INNOMCP.

Privacy-first: no PII, only usage metrics.

\`\`\`ts
type TelemetryEvent =
  | { type: "message_sent"; provider: string; modelFamily: string; }
  | { type: "tool_used"; toolName: string; }
  | { type: "provider_switched"; from: string; to: string; }
  | { type: "workspace_opened" }
  | { type: "export_done"; format: string; }
  | { type: "error"; component: string; code: string; };

class INNOMCPTelemetry {
  track(event: TelemetryEvent): void
  flush(): void           // send batch to /api/stats
  getQueue(): TelemetryEvent[]
  clear(): void
  isEnabled(): boolean
  enable(): void
  disable(): void         // respect user opt-out
}

export const telemetry = new INNOMCPTelemetry();
\`\`\`

Batches events, sends every 60s or on page unload.
localStorage opt-out: "innomcp.telemetry.disabled"
TypeScript strict. No external deps.`},

  {id:'MDES_THEME_SWITCHER', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/common/MDESThemeSwitcher.tsx',
   msg:`Create MDESThemeSwitcher.tsx — theme toggle button for INNOMCP.

\`\`\`ts
interface MDESThemeSwitcherProps {
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}
\`\`\`

Three themes: light (☀️) | dark (🌙) | system (💻)
- Cycles through themes on click
- Persists to localStorage "theme" key
- Syncs with ThemeContext
- Accessible: aria-label changes per state
- Smooth icon transition

"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_FONT_OPTIMIZER', model:FAST, max:3000,
   out:'innomcp-next/src/app/lib/fontOptimizer.ts',
   msg:`Create fontOptimizer.ts — Thai font rendering optimization for INNOMCP.

\`\`\`ts
// Detect Thai content percentage
export function thaiContentRatio(text: string): number  // 0-1

// Add Thai-optimized CSS class based on content
export function getThaiTextClass(text: string): string
// Returns: "thai-content" | "mixed-content" | "latin-content"

// Break long Thai words for better rendering
export function addThaiWordBreaks(text: string): string

// Detect if text needs Thai font (vs Latin)
export function needsThaiFont(text: string): boolean

// Line height recommendation for Thai text
export function thaiLineHeight(fontSize: number): number

// Thai character sets
export const THAI_UNICODE_RANGE = 'U+0E00-U+0E7F';
export const THAI_CONSONANTS: string[];
export const THAI_VOWELS: string[];
export const THAI_TONE_MARKS: string[];
\`\`\`

TypeScript strict. No external deps. Pure string manipulation.`},

  // ═══ GROUP 6: TESTING (8 tasks) ══════════════════════════════════════════════

  {id:'TEST_MDES_MODEL_PICKER', model:PRO, max:8000,
   out:'innomcp-next/tests/components/MDESModelPicker.test.tsx',
   msg:`Write comprehensive Jest unit tests for MDESModelPicker.tsx.

\`\`\`ts
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MDESModelPicker from '@/app/components/chat/MDESModelPicker';
\`\`\`

Test cases:
1. Renders with current model name
2. Shows dropdown on click
3. Fetches models from /api/mdes/models on mount
4. Shows loading state while fetching
5. Displays model list when loaded
6. Filters models when typing in search
7. Calls onModelChange when model selected
8. Shows error state on fetch failure
9. Has retry button on error
10. Closes dropdown on Escape
11. Shows model count badge
12. Caches results in localStorage

Mock fetch. TypeScript strict. Full coverage.`},

  {id:'TEST_STATUS_RIBBON', model:PRO, max:6000,
   out:'innomcp-next/tests/components/StatusRibbon.test.tsx',
   msg:`Write Jest unit tests for StatusRibbon.tsx.

Test all 4 states:
1. Offline state — shows "ออฟไลน์" with red indicator
2. Processing state — shows "MDES กำลังประมวลผล" with pulsing indigo dot
3. Processing with agent count — shows "MDES กำลังวิเคราะห์ N ส่วน"
4. Processing with model — shows model name badge
5. Ready state — shows "พร้อมใช้งาน" with green dot
6. Streaming state (streamStatus="streaming") — same as processing

Also test:
- aria-hidden on dot indicators
- Correct CSS classes per state
- Props defaulting correctly

TypeScript strict. @testing-library/react.`},

  {id:'TEST_COLLAPSIBLE_AGENT', model:PRO, max:7000,
   out:'innomcp-next/tests/components/CollapsibleAgentWrapper.test.tsx',
   msg:`Write Jest unit tests for CollapsibleAgentWrapper.tsx.

\`\`\`ts
import CollapsibleAgentWrapper from '@/app/components/chat/CollapsibleAgentWrapper';
// Mock MultiAgentPanel
jest.mock('@/app/components/chat/MultiAgentPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="multi-agent-panel">Panel</div>
}));
\`\`\`

Test cases:
1. Renders summary header when events.length > 0
2. Returns null when no events
3. Default: collapsed (MultiAgentPanel not visible)
4. Expands on button click → shows MultiAgentPanel
5. Auto-expands when status="streaming"
6. Auto-collapses when status changes to "done"
7. Summary text shows agent count correctly
8. Summary text shows model name
9. Shows pulsing dot when streaming
10. Shows green dot when done
11. Shows "ดูรายละเอียด" / "ซ่อน" label changes
12. Chevron rotates on expand

TypeScript strict. Full test coverage.`},

  {id:'TEST_WORKSPACE_PANEL', model:PRO, max:8000,
   out:'innomcp-next/tests/components/ManusWorkspacePanel.test.tsx',
   msg:`Write Jest unit tests for ManusWorkspacePanel.tsx.

Mock AgentEvent and Artifact types.

Test cases:
1. Renders panel when isOpen=true
2. Does not render when isOpen=false (or minimal)
3. Shows MDES Workspace header
4. Default tab is "งาน" (agent steps)
5. Shows "ยังไม่มีขั้นตอนการทำงาน" when no events
6. Renders agent step list when events provided
7. Clicking tab switches content
8. "เว็บ" tab shows empty state when no web events
9. "Terminal" tab shows empty state when no shell events
10. "ไฟล์ผลลัพธ์" tab shows artifacts
11. onClose called when close button clicked
12. Auto-switches to "งาน" tab when isStreaming becomes true

TypeScript strict. @testing-library/react.`},

  {id:'TEST_MDES_BRAND_HEADER', model:PRO, max:7000,
   out:'innomcp-next/tests/components/MDESBrandHeader.test.tsx',
   msg:`Write Jest unit tests for MDESBrandHeader.tsx.

Mock StatusRibbon and MDESModelPicker.

Test cases:
1. Renders MDES brand logo text
2. Shows "INNOMCP" title
3. Shows "ศูนย์ MCP ภาครัฐ" subtitle (hidden on small screens via class)
4. Shows conversation title when provided
5. Does not show title when not provided
6. Renders Cloud/Local toggle buttons
7. Cloud button click calls onProviderModeChange("remote")
8. Local button click calls onProviderModeChange("local")
9. Active provider button has correct bg class
10. Workspace button renders when onToggleWorkspace provided
11. Workspace button shows bg-muted when workspaceOpen=true
12. Settings button renders when onToggleModelSettings provided
13. MDESModelPicker renders when currentModel+onModelChange provided
14. Agent count badge shows when agentCount > 0

TypeScript strict. @testing-library/react.`},

  {id:'TEST_EMPTY_STATE_MANAGER', model:PRO, max:7000,
   out:'innomcp-next/tests/components/ChatEmptyStateManager.test.tsx',
   msg:`Write Jest unit tests for ChatEmptyStateManager.tsx.

Mock ChatWelcomeHero, GovernmentQuickActions, StarterPromptsGrid.

Test cases:
1. Renders full state when hasMessages=false
2. Shows ChatWelcomeHero in full state
3. Shows GovernmentQuickActions in full state
4. Shows StarterPromptsGrid in full state (reduced=false)
5. Renders reduced state when hasMessages=true
6. Reduced state: StarterPromptsGrid with reduced=true
7. Reduced state: shows "หรือถามได้เลย..." hint
8. Passes isConnected to ChatWelcomeHero
9. Passes providerMode to ChatWelcomeHero
10. onQuerySelect passed to all children

TypeScript strict. @testing-library/react.`},

  {id:'TEST_PROVIDER_MODAL', model:PRO, max:8000,
   out:'innomcp-next/tests/components/ProviderModal.test.tsx',
   msg:`Write Jest unit tests for ProviderModal.tsx (the enhanced version with presets).

\`\`\`ts
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProviderModal from '@/app/components/settings/ProviderModal';
\`\`\`

Mock fetch.

Test cases:
1. Does not render when open=false
2. Renders when open=true
3. Shows preset provider cards
4. Clicking MDES Ollama preset fills form
5. Clicking OpenAI preset fills form + shows "ต้องการ API Key"
6. Name input validation (empty → error)
7. URL validation (non-http → error)
8. Model input validation
9. Save button calls POST /api/ai/providers
10. Test connection button calls provider probe
11. Shows success toast on save
12. Shows error message on save failure
13. Close button calls onClose
14. API Key input is type="password"

TypeScript strict.`},

  {id:'INTEGRATION_TEST_CHAT_FLOW', model:PRO, max:9000,
   out:'innomcp-next/e2e/chat-full-flow.spec.ts',
   msg:`Write comprehensive Playwright E2E test: full INNOMCP chat interaction flow.

\`\`\`ts
import { test, expect } from '@playwright/test';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
\`\`\`

Test the complete user journey:
1. Open /living-chat — verify page loads
2. Verify MDESBrandHeader visible with MDES branding
3. Verify empty state shows ChatWelcomeHero
4. Click a GovernmentQuickAction — verify input populated
5. Clear input, type custom message
6. Click ⚙️ settings → verify ModelSettingsPanel opens
7. Close settings
8. Click workspace panel (🗂️) → verify ManusWorkspacePanel opens
9. Close workspace
10. Click provider toggle Cloud/Local → verify toggle changes
11. Type in chat input → verify Enter sends (smoke: checks for response area)
12. Verify no console errors on page

Include: test.use({ viewport: ... }) for desktop + mobile views
Full TypeScript. Playwright best practices.`},

  // ═══ GROUP 7: DOCUMENTATION (5 tasks) ═════════════════════════════════════════

  {id:'DOC_API_REFERENCE', model:PRO, max:10000,
   out:'docs/API_REFERENCE.md',
   msg:`Write comprehensive API Reference for INNOMCP's Next.js API routes.

Cover all routes created in this sprint:
- GET /api/mdes/models
- GET /api/mdes/health
- POST /api/mdes/proxy
- GET /api/mdes/search
- GET/POST /api/workspace/files
- GET/POST /api/user/preferences
- GET /api/stats
- POST /api/feedback
- POST /api/chat/export
- GET /api/ws/events (SSE)
- POST /api/ai/providers (existing)
- POST /api/ai/providers/:id/test (existing)
- GET /api/health/detailed

Format per route:
## GET /api/xxx
**Description**: Thai + English
**Query params** / **Body**: TypeScript interface
**Response**: TypeScript interface
**Example**: curl command
**Notes**: caching, auth, rate limits

Markdown, ~1000 words.`},

  {id:'DOC_COMPONENT_GUIDE', model:PRO, max:10000,
   out:'docs/COMPONENT_GUIDE.md',
   msg:`Write component usage guide for INNOMCP's new Manus-style UI components.

Cover these new components with usage examples:
1. MDESBrandHeader — props table + example
2. ManusWorkspacePanel — when to use, tabs explained
3. CollapsibleAgentWrapper — usage vs raw MultiAgentPanel
4. StatusRibbon — all states, when each shows
5. MDESModelPicker — integration example
6. ChatEmptyStateManager — full vs reduced mode
7. ChatWelcomeHero — props
8. GovernmentQuickActions — Thai government quick actions
9. MDESChatBubble — role types, streaming
10. FollowUpSuggestions — suggestions from AI

Format:
## ComponentName
**Purpose**: 1 sentence
**When to use**: 2-3 situations
**Props**: markdown table
**Example**:
\`\`\`tsx
<ComponentName ... />
\`\`\`

Thai + English mixed. Markdown.`},

  {id:'DOC_DEPLOYMENT_GUIDE', model:PRO, max:8000,
   out:'docs/DEPLOYMENT.md',
   msg:`Write production deployment guide for INNOMCP.

Sections:
## Prerequisites
- Node.js 20+, pnpm 8+
- MDES Ollama access (https://ollama.mdes-innova.online)
- MariaDB for innomcp-server-node
- Optional: Docker

## Environment Variables
List all .env variables with descriptions:
- MDES_OLLAMA_URL, MDES_API_KEY
- DATABASE_URL, REDIS_URL
- JWT_SECRET (min 32 chars — startup guard)
- NEXT_PUBLIC_BACKEND_URL
- NODE_ENV

## Development
\`\`\`bash
pnpm install
pnpm dev  # starts frontend on :3000 + backend on :3011
\`\`\`

## Production Build
\`\`\`bash
pnpm build
pnpm start
\`\`\`

## Docker Deployment
Include docker-compose.yml usage

## MDES Ollama Integration
How to configure and test MDES connection

## Health Checks
How to verify system is running

## Monitoring
Key endpoints to monitor

Thai + English mixed. ~600 words.`},

  {id:'DOC_SECURITY_GUIDE', model:PRO, max:7000,
   out:'docs/SECURITY.md',
   msg:`Write security guide for INNOMCP.

Thai government security requirements.

Sections:
## Overview
INNOMCP security posture for Thai government MCP Hub

## Authentication & Authorization
- JWT tokens
- Session management
- Role-based access (future)

## API Security
- Rate limiting (middleware.ts)
- Input validation
- Path traversal prevention (workspace files)
- API key management

## Data Privacy
- No PII in logs
- Telemetry opt-out
- Message encryption (future)
- Feedback data handling

## Network Security
- HTTPS only
- CSP headers
- CORS configuration
- Allowed origins

## MDES Ollama Security
- API key management
- Request proxying (not exposing keys to browser)
- Model access control

## Incident Response
- Error logging
- Alert procedures
- Data breach protocol

## Thai Government Compliance
- พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
- ระเบียบสำนักนายกรัฐมนตรี ว่าด้วยการรักษาความปลอดภัยแห่งชาติ
- NIST guidelines

Markdown, ~500 words.`},

  {id:'DOC_THAI_GOV_INTEGRATION', model:PRO, max:8000,
   out:'docs/THAI_GOVERNMENT_INTEGRATION.md',
   msg:`Write Thai Government Integration Guide for INNOMCP.

How to integrate INNOMCP into Thai government workflows.

## Overview
INNOMCP as the AI layer for Thai government digital services

## Supported Government APIs (via MCP Tools)
1. TMD/NWP Weather API — พยากรณ์อากาศ
2. Thai Geo Tool — ข้อมูลภูมิศาสตร์
3. Evidence Stats — ข้อมูลสถิติ
4. Thai Knowledge Base — ฐานความรู้ภาษาไทย

## MDES Provider Setup
How to configure MDES Ollama for your department

## Government Use Cases
1. สรุปเอกสารราชการ — Document summarization
2. ค้นหากฎหมาย — Law/regulation search
3. วิเคราะห์ข้อมูลสถิติ — Statistical analysis
4. รายงานภัยพิบัติ — Disaster reporting
5. ข้อมูลภูมิศาสตร์ — Geographic data

## Custom Provider Integration
How to add department-specific AI providers

## Compliance Notes
PDPA compliance checklist for government deployment

## Support
MDES technical support contact

Thai primary, English secondary. ~600 words. Markdown.`},

  // ═══ GROUP 8: CONFIGURATION (2 tasks) ════════════════════════════════════════

  {id:'NEXT_CONFIG_ENHANCED', model:PRO, max:7000,
   out:'innomcp-next/next.config.ts',
   msg:`Update next.config.ts for INNOMCP with production optimizations.

Current config may be minimal. Write a comprehensive next.config.ts:

\`\`\`ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ollama.mdes-innova.online' },
      { protocol: 'https', hostname: '*.mdes.go.th' },
    ],
  },

  // Environment variables (public)
  env: {
    NEXT_PUBLIC_APP_NAME: 'INNOMCP',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '10.17',
    NEXT_PUBLIC_MDES_OLLAMA_URL: 'https://ollama.mdes-innova.online',
  },

  // Performance
  experimental: {
    optimizePackageImports: ['@fortawesome/react-fontawesome'],
  },

  // Headers for security + CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },

  // Rewrites for MDES proxy
  async rewrites() {
    return [];
  },
};

export default config;
\`\`\`

TypeScript strict. Include comments explaining each option.`},

  {id:'TAILWIND_CONFIG_MDES', model:PRO, max:7000,
   out:'innomcp-next/tailwind.config.ts',
   msg:`Update tailwind.config.ts for INNOMCP with MDES brand tokens and custom utilities.

\`\`\`ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // MDES brand
        'mdes': {
          primary: '#1a3c6e',
          'primary-light': '#2d5a9e',
          accent: '#c8973e',
          'accent-light': '#e8b85e',
        },
        // Thai government
        'thai-red': '#C00000',
        'thai-blue': '#003087',
      },
      fontFamily: {
        'thai': ['Noto Sans Thai', 'Sarabun', 'sans-serif'],
        'display': ['Noto Sans Thai', 'Inter', 'sans-serif'],
      },
      animation: {
        'mdes-shimmer': 'mdes-shimmer 2s linear infinite',
        'float-orbit': 'float-orbit 8s ease-in-out infinite',
        'manus-slide-in': 'manus-slide-in 0.25s ease-out',
        'agent-pulse': 'agent-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'mdes-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-orbit': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '50%': { transform: 'translate(10px, -15px) rotate(180deg)' },
        },
        'manus-slide-in': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'agent-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.05)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
\`\`\`

TypeScript strict. Include all existing custom tokens plus MDES additions.`},
];

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function runMegaWave() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🔥 MEGA WAVE 7 — MAXIMUM BURN                               ║');
  console.log(`║  ${TASKS.length} parallel tasks | deepseek-v4-pro | BURN EVERYTHING     ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`  Starting ${TASKS.length} tasks simultaneously...\n`);

  const start = Date.now();
  let totalTok=0, ok=0, fail=0;
  const failed=[];

  await Promise.allSettled(TASKS.map(async (t) => {
    const r = await cc(t.id, t.model, SYS, t.msg, t.max);
    totalTok += r.tokens||0;
    if (r.ok) {
      const code = extract(r.reply);
      writeFile(t.out, code, t.baseDir);
      process.stdout.write(`  ✅ ${t.id.padEnd(30)} ${r.ms}ms | ${r.tokens}tok\n`);
      ok++;
    } else {
      process.stdout.write(`  ❌ ${t.id.padEnd(30)} ERR: ${r.error?.slice(0,60)}\n`);
      fail++; failed.push(t.id);
    }
  }));

  console.log('\n🔍 tsc check...\n');
  let tscPass = false;
  try {
    execSync('npx tsc --noEmit 2>&1', {cwd:`${ROOT.replace(/\//g,path.sep)}\\innomcp-next`, stdio:'inherit', timeout:120000});
    tscPass = true;
    console.log('  ✅ tsc PASS');
  } catch { console.log('  ⚠️  tsc issues — fix and commit'); }

  const elapsed = ((Date.now()-start)/1000).toFixed(1);
  const est4x = (totalTok*4).toLocaleString();
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  ✅ ${ok}/${TASKS.length} tasks  ❌ ${fail} failed`.padEnd(67)+'║');
  console.log(`║  🪙 ~${totalTok.toLocaleString()} tokens (4x = ~${est4x} effective)`.padEnd(67)+'║');
  console.log(`║  ⏱  ${elapsed}s elapsed`.padEnd(67)+'║');
  console.log(`║  tsc: ${tscPass?'✅ PASS':'⚠️  FAIL (fix errors)'}`.padEnd(67)+'║');
  if (failed.length) console.log(`║  Failed: ${failed.slice(0,5).join(', ')}${failed.length>5?'...':''}`.padEnd(67)+'║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
}

runMegaWave().catch(e => { console.error('FATAL:', e); process.exit(1); });
