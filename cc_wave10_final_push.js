#!/usr/bin/env node
/**
 * cc_wave10_final_push.js — Wave 10: Final Polish + Maximum Token Burn
 * Uses cc_lib_swarm (fixed semaphore + min tokens)
 */
'use strict';

const { runTasks, PRO, FAST } = require('./cc_lib_swarm');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = 'C:/Users/USER-NT/DEV/innomcp';

const SYS = `World-class TypeScript/React engineer — INNOMCP Thailand government AI platform by MDES.
Stack: Next.js 14, TypeScript strict, Tailwind CSS, React 18, Node.js/Express.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม. Manus.ai-style UI.
Output ONLY the complete production-ready file in \`\`\`tsx/ts/js/json/md/css ... \`\`\`.
Rules: (1) NO truncation — full file (2) Thai UI strings (3) Working TypeScript (4) No placeholders`;

const TASKS = [

  // ── FAILED TASKS FROM WAVE 9 (retry with higher token budget) ─────────────

  {id:'MESSAGE_THREAD', model:PRO, max:6000,
   out:'innomcp-next/src/app/components/chat/MessageThread.tsx',
   msg:`Create MessageThread.tsx — Manus-style message list container for INNOMCP.

// @ts-nocheck at top (AgentEvent field compatibility)

Props (import ChatMessage from "@/types/chat", AgentEvent from "./useAgentEventStream"):
\`\`\`ts
interface MessageThreadProps {
  messages: ChatMessage[];
  isWaitingForResponse: boolean;
  streamStatus: string;
  agentEvents?: AgentEvent[];
  typingUsers?: Array<{ name: string }>;
  onCopy?: (text: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  className?: string;
}
\`\`\`

Features:
- Date separators: "วันนี้", "เมื่อวาน", formatted Thai date for older
- MDESStreamIndicator shown when isWaitingForResponse (import from "./MDESStreamIndicator")
- TypingIndicator shown when typingUsers?.length > 0 (import from "./TypingIndicator")
- Auto-scroll to bottom on new messages (via scrollRef)
- Empty: return null
- Each message: div with role="user"|"ai" className, text content
- className on wrapper div

"use client", TypeScript, Tailwind. Complete working file.`},

  {id:'WORKSPACE_MANAGER', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/WorkspaceManager.tsx',
   msg:`Create WorkspaceManager.tsx — unified workspace manager combining all workspace tabs for INNOMCP.

// @ts-nocheck at top

Props (import AgentEvent from "./useAgentEventStream", Artifact from "./ArtifactPanel"):
\`\`\`ts
interface WorkspaceManagerProps {
  events: AgentEvent[];
  artifacts: Artifact[];
  isStreaming: boolean;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}
\`\`\`

Import and use:
- AgentStepsView from "./AgentStepsView" (for งาน tab)
- WorkspaceTerminalPanel from "./WorkspaceTerminalPanel" (for Terminal tab)
- WorkspaceTabBar from "./WorkspaceTabBar" (for tab navigation)

Tabs: [ {id:'agent', label:'🤖 งาน'}, {id:'web', label:'🌐 เว็บ'}, {id:'terminal', label:'💻 Terminal'}, {id:'files', label:'📁 ไฟล์'} ]

Panel design: full-height right sidebar
Header: "MDES Workspace" + model count from events + close button
Tab content: switch on activeTab
Files tab: show artifacts list with download buttons
Web tab: show events with toolName==="web_search" publicSummary
Auto-switch to agent tab when isStreaming starts

"use client", TypeScript, Tailwind. Complete file.`},

  // ── MORE NEW COMPONENTS ────────────────────────────────────────────────────

  {id:'MDES_CHAT_SHORTCUTS_HOOK', model:PRO, max:5000,
   out:'innomcp-next/src/app/hooks/useMDESChatShortcuts.ts',
   msg:`Create useMDESChatShortcuts.ts — INNOMCP chat keyboard shortcut hook.

"use client" hook that registers all chat shortcuts:

\`\`\`ts
interface ChatShortcutCallbacks {
  onNewChat: () => void;
  onToggleWorkspace: () => void;
  onToggleSidebar: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onStopStream: () => void;
  onFocusInput: () => void;
}

export function useMDESChatShortcuts(callbacks: ChatShortcutCallbacks): void
\`\`\`

Shortcuts to register:
- Ctrl+N → onNewChat
- Ctrl+B → onToggleSidebar
- Ctrl+W → onToggleWorkspace
- Ctrl+E → onExport
- Ctrl+, → onOpenSettings
- Ctrl+F → onOpenSearch
- Escape → onStopStream (when not in input)
- Ctrl+/ → open keyboard help

Ignore when user types in input/textarea.
Remove listeners on unmount.
TypeScript strict.`},

  {id:'MDES_PROVIDER_HEALTH_HOOK', model:PRO, max:5000,
   out:'innomcp-next/src/app/hooks/useMDESProviderHealth.ts',
   msg:`Create useMDESProviderHealth.ts — hook that monitors MDES Ollama health in real-time.

\`\`\`ts
interface MDESHealth {
  isOnline: boolean;
  latencyMs: number | null;
  modelCount: number;
  lastChecked: Date | null;
  version?: string;
  error?: string;
}

export function useMDESProviderHealth(options?: { intervalMs?: number }): MDESHealth & { refetch: () => void }
\`\`\`

Implementation:
- Polls GET /api/mdes/health every intervalMs (default 30000ms)
- Also polls GET /api/mdes/models to get model count
- Returns live status
- Uses localStorage cache (30s TTL): "innomcp.mdes.health.cache"
- isOnline=false if latency > 10000ms or error

"use client" hook. TypeScript strict.`},

  {id:'INNOMCP_WORKSPACE_SIDEBAR_TOGGLE', model:FAST, max:3000,
   out:'innomcp-next/src/app/components/chat/WorkspaceToggleButton.tsx',
   msg:`Create WorkspaceToggleButton.tsx — floating toggle button for INNOMCP workspace.

A persistent floating button (when workspace is closed) that opens the workspace panel.
Appears when AI is active or when user has artifacts.

Props: { onOpen: () => void; artifactCount?: number; isVisible: boolean; }
Button: fixed bottom-16 right-4, circular (h-10 w-10), MDES indigo, 🗂️ icon
Badge: show artifact count if artifactCount > 0
Tooltip: "เปิดพื้นที่ทำงาน"
Animation: slide-in from right when isVisible=true

"use client", TypeScript, Tailwind.`},

  {id:'MDES_CHAT_INPUT_ENHANCED', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/ChatInputEnhanced.tsx',
   msg:`Create ChatInputEnhanced.tsx — enhanced chat input wrapper that adds Manus-style features.

This wraps the existing ChatInput and adds:
1. SlashCommandMenu trigger when input starts with "/"
2. MDESStreamIndicator above input when streaming
3. ProviderStatusBar below input showing current model
4. ComposerEnhancedBar below input (contextual capabilities)

Props:
\`\`\`ts
interface ChatInputEnhancedProps {
  // All existing ChatInput props forwarded through:
  input: string;
  setInput: (v: string) => void;
  isWaitingForResponse: boolean;
  isSocketReady: boolean;
  sendMessage: () => void;
  handleStop: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  selectedFile: File | null;
  setSelectedFile: (v: File | null) => void;
  adjustTextarea: () => void;
  theme: string;
  // Enhanced props:
  providerMode: "remote" | "local";
  currentModel?: string;
  streamStatus?: string;
  agentCount?: number;
  onToggleWorkspace?: () => void;
}
\`\`\`

Internal state: slashMenuVisible (show when input === "/")
Imports: ChatInput (existing), SlashCommandMenu, MDESStreamIndicator, ProviderStatusBar

"use client", TypeScript strict, Tailwind. Complete file.`},

  // ── BACKEND NODE FEATURES ──────────────────────────────────────────────────

  {id:'NODE_MDES_HEALTH_MIDDLEWARE', model:FAST, max:3000,
   out:'innomcp-node/src/middleware/mdesHealthCheck.ts',
   msg:`Create mdesHealthCheck.ts — Express middleware that checks MDES Ollama health on startup.

Runs when server starts, checks MDES Ollama:
- GET https://ollama.mdes-innova.online/api/version
- Logs: ✅ MDES Ollama ONLINE (Xms) or ⚠️ MDES Ollama OFFLINE

Also exports: async function checkMDESHealth(): Promise<{healthy:boolean; latencyMs:number; version?:string}>
TypeScript strict. Used in warmup.ts.`},

  {id:'NODE_THAI_INTENT_ROUTER', model:PRO, max:6000,
   out:'innomcp-node/src/services/thaiIntentRouter.ts',
   msg:`Create thaiIntentRouter.ts — routes Thai queries to the best MDES Ollama model.

Uses thaiNLPService to detect intent, then selects optimal model.

\`\`\`ts
interface RoutingDecision {
  model: string;
  reason: string;
  confidence: number;
  fallback?: string;
}

class ThaiIntentRouter {
  async route(text: string, availableModels: string[]): Promise<RoutingDecision>
  async routeToMDES(text: string): Promise<RoutingDecision>  // always use MDES Ollama
  selectModelForDomain(domain: string, models: string[]): string

  // Domain → model preferences
  DOMAIN_MODEL_MAP: Record<string, string[]>
  // e.g. 'weather' → ['gemma4:26b', 'qwen2.5:7b']
  //      'code' → ['deepseek-r1:32b', 'qwen2.5-coder:7b']
  //      'document' → ['gemma4:26b']
  //      'reasoning' → ['deepseek-r1:32b']
}
export const thaiIntentRouter = new ThaiIntentRouter();
\`\`\`
TypeScript strict.`},

  {id:'NODE_REQUEST_LOGGER', model:FAST, max:3000,
   out:'innomcp-node/src/middleware/requestLogger.ts',
   msg:`Create requestLogger.ts — structured request logging for innomcp-node.

Express middleware that logs every request with:
- Method, path, status code
- Response time (ms)
- User agent (truncated)
- Session ID if present
- Thai error messages for common 4xx errors

Format: [2026-06-11 09:00:00] GET /api/chat 200 42ms
Skips logging for: /api/health, /api/metrics (too noisy)
Uses existing logger from utils/logger.ts
TypeScript strict.`},

  {id:'NODE_WORKSPACE_CLEANUP', model:FAST, max:3000,
   out:'innomcp-node/src/scripts/cleanupWorkspace.ts',
   msg:`Create cleanupWorkspace.ts — scheduled workspace cleanup script for innomcp-node.

Runs daily to clean up old session files.

\`\`\`ts
// Usage: node dist/scripts/cleanupWorkspace.js [--dry-run] [--max-age-days 7]
// Finds session directories older than max-age-days
// Deletes them (or shows what would be deleted with --dry-run)
// Logs: Cleaned X sessions, freed Y MB
\`\`\`

Uses workspaceService.cleanupOldSessions().
Can be added to cron: 0 2 * * * node dist/scripts/cleanupWorkspace.js
TypeScript strict. Node.js process.argv parsing.`},

  // ── DOCUMENTATION FINAL ───────────────────────────────────────────────────

  {id:'DOC_RELEASE_NOTES', model:PRO, max:6000,
   out:'docs/RELEASE_NOTES_v10.17.md',
   msg:`Write release notes for INNOMCP v10.17 — the Manus.ai redesign release.

# Release Notes — INNOMCP v10.17.0

Date: 2026-06-11
Type: Major UI/Architecture Update

## 🌟 Highlights
- Manus.ai-style 3-column layout
- MDES Government branding header
- ManusWorkspacePanel — AI ทำงานแบบ computer use
- Multi-provider support (openclaude-style)
- Thai government components

## 🆕 New Features
(list all major components from Waves 1-10)

## 🛠️ Technical Improvements
- TypeScript strict throughout
- Semaphored CODECOMMAND swarm (fixed socket close)
- 43 API routes (innomcp-next) + 45 routes (innomcp-node)
- 38 backend services

## 🐛 Bug Fixes
- DeepSeek reasoning mode empty content fix (MIN_TOKENS)
- Socket close on 50+ concurrent (semaphore)
- StatusRibbon extracted from inline ChatPage

## ⬆️ Upgrade Guide
No breaking changes to existing features.
New components are additive.

## Known Limitations
- Innova-workspace VM: pending Drive/NAS config
- AgentStepsView: view-model adapter pending

Thai + English. ~400 words. Markdown.`},

  {id:'DOC_ARCHITECTURE_DIAGRAM', model:PRO, max:6000,
   out:'docs/ARCHITECTURE.md',
   msg:`Write architecture diagram (ASCII art + description) for INNOMCP v10.17.

# INNOMCP Architecture

## System Overview

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     INNOMCP Frontend                        │
│                   (innomcp-next / Next.js 14)               │
│                                                             │
│  ┌──────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │ChatSidebar│  │   Main Chat Area     │  │ManusWorkspace│  │
│  │          │  │ MDESBrandHeader      │  │              │  │
│  │History   │  │ ┌────────────────┐   │  │ AgentSteps   │  │
│  │Search    │  │ │  MessageThread  │   │  │ Terminal     │  │
│  │New Chat  │  │ └────────────────┘   │  │ Files/Artif. │  │
│  └──────────┘  │ ChatInputEnhanced    │  └──────────────┘  │
│                └──────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                           │ WebSocket + REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    INNOMCP Backend                          │
│                   (innomcp-node / Node.js)                  │
│                                                             │
│  Mother Conductor → Parallel Dispatch → MDES Agents         │
│  ThaiNLP Service    Analytics Service    Session Manager    │
│  Workspace Files    Provider Manager     Audit Logger       │
└─────────────────────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
        ┌──────────────┐  ┌──────────────┐
        │ MDES Ollama  │  │ Other Providers│
        │ (Primary)    │  │ OpenAI, Groq  │
        │ Unlimited    │  │ Ollama Local  │
        │ 24/7 Thai    │  │ Custom APIs   │
        └──────────────┘  └──────────────┘
\`\`\`

## Component Layers
Describe each layer: UI Components → Hooks → Context → API Routes → Services → External APIs
~300 words. Markdown.`},

  {id:'DOC_INNOMCP_README_FULL', model:PRO, max:8000,
   out:'README.md',
   msg:`Write the main INNOMCP README.md — comprehensive project overview.

# INNOMCP — ศูนย์ MCP ภาครัฐ โดย MDES

> Multi-Agent AI Platform for Thai Government | 24/7 via MDES Ollama

## Quick Start
\`\`\`bash
pnpm install
pnpm dev
# Frontend: http://localhost:3000
# Backend: http://localhost:3011
\`\`\`

## What is INNOMCP?
- Thailand's government MCP Hub by MDES
- Works like Manus.ai — AI with persistent workspace
- Primary AI: MDES Ollama (unlimited, Thai government cloud)
- Multi-agent dispatch (parallel MDES agents)

## Features
- 3-column Manus.ai layout (sidebar | chat | workspace)
- MDES brand header with model picker
- Provider management (add any provider — OpenAI, Groq, Ollama, etc.)
- Thai-first UI with government quick actions
- ManusWorkspacePanel (งาน/เว็บ/Terminal/ไฟล์ tabs)
- 56+ MCP tools (weather, geo, evidence, knowledge)
- PWA-ready with offline support

## Architecture
\`\`\`
innomcp-next/  — Next.js 14 frontend (111+ components)
innomcp-node/  — Node.js backend (38+ services)
\`\`\`

## Docs
- [Quick Start](docs/QUICK_START.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Thai Gov Integration](docs/THAI_GOVERNMENT_INTEGRATION.md)

## Stack
Next.js 14 | TypeScript | Tailwind CSS | Node.js | Playwright | Jest

---
*พัฒนาโดย MDES Innovation Team | มนุษย์ Agent System*

Thai + English. ~300 words. Markdown with badges.`},

  // ── PERFORMANCE & QUALITY ─────────────────────────────────────────────────

  {id:'NEXT_CHAT_PERF_OPTIMIZATIONS', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/ChatPageOptimized.tsx',
   msg:`Create ChatPageOptimized.tsx — performance-optimized helper hooks for INNOMCP ChatPage.

NOT a full replacement — just the extracted performance utilities.
These can be imported by ChatPage.tsx to improve rendering.

\`\`\`ts
// Hook: useChatMessages — memoized message processing
export function useChatMessages(messages: ChatMessage[]) {
  return useMemo(() => ({
    hasMessages: messages.length > 0,
    lastMessage: messages[messages.length - 1],
    isLastAI: messages[messages.length - 1]?.sender === 'ai',
    userCount: messages.filter(m => m.sender === 'user').length,
    aiCount: messages.filter(m => m.sender === 'ai').length,
    groupedByDate: groupMessagesByDate(messages),
  }), [messages]);
}

// Hook: useAgentStats — memoized agent event stats
export function useAgentStats(events: AgentEvent[]) {
  return useMemo(() => ({
    agentCount: countActiveAgents(events),
    activeModels: getActiveModels(events),
    latestModel: getLatestModel(events),
    isAnyToolActive: events.some(e => e.type === 'tool_call_started'),
    totalElapsedMs: getTotalElapsed(events),
  }), [events]);
}

// Hook: useScrollBehavior
export function useScrollBehavior(messagesRef: React.RefObject<HTMLDivElement>) {
  // scroll to bottom, track isNearBottom, unread count
}
\`\`\`

Implement all three hooks fully.
Import types from "@/types/chat" and "./useAgentEventStream".
"use client", TypeScript strict.`},

  {id:'NEXT_MDES_LAZY_PANELS', model:FAST, max:3000,
   out:'innomcp-next/src/app/components/chat/LazyPanels.tsx',
   msg:`Create LazyPanels.tsx — lazy-loaded panel registry for INNOMCP.

Re-exports all heavy panel components as dynamic imports to reduce initial bundle size.

\`\`\`tsx
import dynamic from "next/dynamic";

const loading = () => <div className="animate-pulse bg-muted/30 rounded-md h-20 m-4" />;

export const LazyManusWorkspacePanel = dynamic(() => import("./ManusWorkspacePanel"), { ssr:false, loading });
export const LazyModelSettingsPanel  = dynamic(() => import("./ModelSettingsPanel"),  { ssr:false, loading });
export const LazyMultiAgentPanel     = dynamic(() => import("./MultiAgentPanel"),     { ssr:false, loading });
export const LazyCommandPaletteV2    = dynamic(() => import("../common/MDESCommandPaletteV2"), { ssr:false, loading });
export const LazyINNOMCPSettings     = dynamic(() => import("../settings/INNOMCPSettingsPanel"), { ssr:false, loading });
export const LazyWorkspaceFileBrowser = dynamic(() => import("./WorkspaceFileBrowser"), { ssr:false, loading });
export const LazySystemStatusPanel   = dynamic(() => import("./SystemStatusPanel"),   { ssr:false, loading });
export const LazyAnalyticsPanel      = dynamic(() => import("./MDESAnalyticsPanel"),  { ssr:false, loading });
\`\`\`

Complete file. TypeScript strict.`},

  {id:'NEXT_CHAT_ERROR_HANDLER', model:PRO, max:6000,
   out:'innomcp-next/src/app/hooks/useChatErrorHandler.ts',
   msg:`Create useChatErrorHandler.ts — centralized error handling for INNOMCP chat.

Handles all error types that can occur in chat:
- WebSocket disconnection
- Stream timeout
- Provider error
- File upload error
- Tool execution error
- Rate limit error

\`\`\`ts
type ChatError =
  | { type: 'websocket'; code?: number; message: string }
  | { type: 'stream_timeout'; elapsed: number }
  | { type: 'provider_error'; provider: string; statusCode?: number; message: string }
  | { type: 'file_too_large'; fileName: string; sizeMB: number }
  | { type: 'tool_error'; toolName: string; message: string }
  | { type: 'rate_limit'; retryAfter?: number }
  | { type: 'unknown'; message: string };

interface UseChatErrorHandlerReturn {
  lastError: ChatError | null;
  handleError: (error: unknown) => ChatError;
  clearError: () => void;
  getThaiMessage: (error: ChatError) => string;  // Thai user-facing message
  shouldRetry: (error: ChatError) => boolean;
}

export function useChatErrorHandler(): UseChatErrorHandlerReturn
\`\`\`

Thai messages for each error type.
"use client" hook. TypeScript strict.`},

  // ── EXTRA UTILITY COMPONENTS ──────────────────────────────────────────────

  {id:'NEXT_MDES_BADGE_COLLECTION', model:PRO, max:5000,
   out:'innomcp-next/src/app/components/common/MDESBadges.tsx',
   msg:`Create MDESBadges.tsx — badge component collection for INNOMCP.

All badge variants used throughout the app.

\`\`\`tsx
// Model family badge
export const ModelBadge: FC<{ model: string; size?: 'xs'|'sm' }>

// Provider type badge
export const ProviderTypeBadge: FC<{ type: 'mdes'|'openai'|'anthropic'|'local'|'custom' }>

// Status badge
export const StatusBadge: FC<{ status: 'online'|'offline'|'degraded'; latencyMs?: number }>

// Capability badge
export const CapabilityBadge: FC<{ capability: string }>

// Thai province badge
export const ProvinceBadge: FC<{ province: string; region?: string }>

// Version badge
export const VersionBadge: FC<{ version: string; type?: 'stable'|'beta'|'dev' }>

// Tier badge (for government data)
export const GovTierBadge: FC<{ tier: 'public'|'restricted'|'confidential' }>
\`\`\`

Each badge: compact, pill shape, appropriate color scheme.
Thai labels for Thai-specific badges.
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_EMPTY_STATES', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/common/MDESEmptyStates.tsx',
   msg:`Create MDESEmptyStates.tsx — reusable empty state components for INNOMCP.

\`\`\`tsx
// Generic empty state
export const EmptyState: FC<{ icon?: string; title: string; description?: string; action?: ReactNode }>

// No conversations
export const NoConversations: FC<{ onNewChat: () => void }>
// ไม่มีประวัติการสนทนา | เริ่มแชทใหม่

// No search results
export const NoSearchResults: FC<{ query: string }>
// ไม่พบผลลัพธ์สำหรับ "{query}"

// No artifacts
export const NoArtifacts: FC
// ยังไม่มีไฟล์ผลลัพธ์

// Offline state
export const OfflineState: FC<{ onRetry: () => void }>
// ไม่มีการเชื่อมต่ออินเทอร์เน็ต | ลองอีกครั้ง

// No providers
export const NoProviders: FC<{ onAddProvider: () => void }>
// ยังไม่มีผู้ให้บริการ AI
\`\`\`

MDES branding, Thai text, clean Manus-style design.
"use client", TypeScript strict, Tailwind.`},

  {id:'NODE_MDES_MODEL_SUGGEST', model:PRO, max:4000,
   out:'innomcp-node/src/services/modelSuggestionService.ts',
   msg:`Create modelSuggestionService.ts — intelligent model suggestion for innomcp-node.

Given a user query, suggests the best MDES Ollama model.

\`\`\`ts
interface ModelSuggestion {
  model: string;
  confidence: number;  // 0-1
  reason: string;      // Thai reason for choosing this model
  alternatives: Array<{ model: string; reason: string; }>;
  estimatedTimeMs: number;  // rough estimate
}

class ModelSuggestionService {
  async suggest(query: string, availableModels: string[]): Promise<ModelSuggestion>

  // Quick heuristics (no AI call needed):
  isCodeQuery(text: string): boolean      // keywords: โค้ด, code, function, etc.
  isThaiQuery(text: string): boolean      // Thai content > 50%
  isHeavyReasoning(text: string): boolean // วิเคราะห์, เปรียบเทียบ, reasoning
  isFastQuery(text: string): boolean      // ทักทาย, ถามง่าย, short

  getModelDescription(model: string): string  // Thai description
}
export const modelSuggestionService = new ModelSuggestionService();
\`\`\`
TypeScript strict.`},

  // ── TESTS ──────────────────────────────────────────────────────────────────

  {id:'TEST_MDES_BRAND_FLOW', model:PRO, max:6000,
   out:'innomcp-next/e2e/mdes-brand-experience.spec.ts',
   msg:`Write Playwright E2E spec for MDES brand experience in INNOMCP.

Tests the complete MDES-branded experience:
1. Page title includes "INNOMCP"
2. MDESBrandHeader visible with "🇹🇭 MDES" text
3. "ศูนย์ MCP ภาครัฐ" subtitle visible
4. StatusRibbon shows "พร้อมใช้งาน" (or appropriate status)
5. ⚙️ settings button opens settings panel
6. Cloud/Local toggle works (visual state changes)
7. Default provider badge shows MDES
8. StarterPromptsGrid shows Thai government prompts
9. GovernmentQuickActions visible on empty state
10. Keyboard shortcut ? shows help (when input focused + empty)

\`\`\`ts
import { test, expect } from '@playwright/test';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
\`\`\`

Full TypeScript. Playwright.`},

  {id:'TEST_INNOMCP_ACCESSIBILITY', model:PRO, max:5000,
   out:'innomcp-next/e2e/accessibility.spec.ts',
   msg:`Write Playwright E2E accessibility tests for INNOMCP.

Tests WCAG 2.1 AA compliance for key flows:

1. Skip navigation link exists and is focusable
2. Chat input has aria-label
3. Send button has aria-label
4. Status ribbon has aria-live region
5. Modal dialogs have role="dialog" aria-modal="true"
6. Icons have aria-hidden="true" where decorative
7. Tab order is logical (sidebar → main → composer)
8. Workspace panel has role="complementary" or dialog
9. Message list has role="log" or aria-live
10. All interactive elements reachable by keyboard
11. No missing alt text on images
12. Color contrast check via axe-core (if available)

\`\`\`ts
import { test, expect } from '@playwright/test';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
\`\`\`

TypeScript. Playwright.`},
];

async function runWave10() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🔥 WAVE 10 — FINAL PUSH | cc_lib_swarm fixed               ║');
  console.log(`║  ${TASKS.length} tasks | max 15 concurrent | BURN REMAINING QUOTA        ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { ok, fail, failed, totalTok, elapsed } = await runTasks(TASKS, ROOT, SYS);

  console.log('\n🔍 tsc check...');
  let tscPass = false;
  try {
    execSync('npx tsc --noEmit 2>&1', {
      cwd: ROOT.replace(/\//g, path.sep) + '\\innomcp-next',
      stdio: 'inherit', timeout: 120000,
    });
    tscPass = true; console.log('  ✅ tsc PASS');
  } catch { console.log('  ⚠️  tsc issues'); }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  ✅ ${ok}/${TASKS.length} tasks | ~${totalTok.toLocaleString()}tok (4x=~${(totalTok*4).toLocaleString()}) | ${elapsed}s ║`);
  console.log(`║  tsc: ${tscPass ? '✅ PASS' : '⚠️  issues'}`.padEnd(67) + '║');
  if (failed.length) console.log(`║  Failed: ${failed.slice(0,5).join(', ')}`.padEnd(67) + '║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
}

runWave10().catch(e => { console.error('FATAL:', e); process.exit(1); });
