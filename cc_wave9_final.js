#!/usr/bin/env node
/**
 * cc_wave9_final.js — Wave 9: Final integration + max token burn
 * Uses cc_lib_swarm with semaphore (max 15 concurrent) + min token fix
 */
'use strict';

const { runTasks, PRO, FAST } = require('./cc_lib_swarm');
const { execSync } = require('child_process');

const ROOT = 'C:/Users/USER-NT/DEV/innomcp';
const NEXT = `${ROOT}/innomcp-next/src/app`;
const NODE = `${ROOT}/innomcp-node/src`;

const SYS = `World-class TypeScript/React engineer — INNOMCP Thailand government AI platform by MDES.
Stack: Next.js 14 App Router, TypeScript strict, Tailwind CSS, React 18, Node.js.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม. Primary AI: MDES Ollama (unlimited, 24/7).
Output ONLY the complete production-ready file in \`\`\`tsx/ts/js/json/md ... \`\`\`.
Rules: no truncation, Thai UI strings, preserve existing functionality, no placeholder code.`;

const TASKS = [

  // ── FINAL MISSING COMPONENTS (retried from earlier waves) ────────────────

  {id:'MDES_STREAM_INDICATOR', model:PRO, max:4000,
   out:'innomcp-next/src/app/components/chat/MDESStreamIndicator.tsx',
   msg:`Create MDESStreamIndicator.tsx — real-time streaming indicator for MDES agents.

Props: isStreaming, agentStates (array of {agentId, model, status}), elapsed, streamStatus
States: idle (null), starting, thinking (N agents), tool_use, streaming (cursor only), done
Agent avatars: colored circles with first letter (G=gemma, Q=qwen, D=deepseek)
Elapsed timer ticking every 100ms while active, fades after done
"use client", TypeScript strict, Tailwind. Complete file.`},

  {id:'MDES_SETTINGS_FULL', model:PRO, max:6000,
   out:'innomcp-next/src/app/components/settings/INNOMCPSettingsPanel.tsx',
   msg:`Create INNOMCPSettingsPanel.tsx — full settings panel for INNOMCP.

Props: isOpen, onClose, section? ('general'|'providers'|'models'|'privacy'|'advanced'|'about')

Sections with Thai labels:
1. ทั่วไป: theme toggle (light/dark/system), language (TH/EN), compact mode toggle, sound
2. AI Provider: shows "เพิ่ม Provider" button + ProviderList note (import from './ProviderList')
3. โมเดล: default model input, chat mode select
4. ความเป็นส่วนตัว: telemetry opt-out, clear history button, export data button
5. ขั้นสูง: debug mode, WebSocket URL override input, clear cache button
6. เกี่ยวกับ: version v10.17, links

Design: full-height right sidebar, left nav icons, right content, close button header
"use client", TypeScript strict, Tailwind. Complete file.`},

  {id:'COMMAND_PALETTE_V2', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/common/MDESCommandPaletteV2.tsx',
   msg:`Create MDESCommandPaletteV2.tsx — MDES command palette for INNOMCP (Ctrl+K).

Command groups (Thai):
1. 💬 บทสนทนา: แชทใหม่, ล้างประวัติ, ส่งออก, ค้นหา
2. 🤖 AI Model: เปลี่ยน model, ดูโมเดล MDES, ทดสอบการเชื่อมต่อ
3. 🛠️ เครื่องมือ: เปิด Workspace, สถานะ Provider, Health Check
4. ⚙️ ตั้งค่า: ธีม, ตั้งค่า Provider, Shortcuts
5. 📚 ช่วยเหลือ: Quick Start, Keyboard Shortcuts, About INNOMCP

Props: isOpen, onClose, onNewChat?, onOpenWorkspace?, onOpenProviders?, onOpenModelSettings?
Keyboard: ↑↓ navigate, Enter select, Esc close
Fuzzy search across all commands + recent history (5 items)
"use client", TypeScript strict, Tailwind. Complete file.`},

  {id:'ONBOARDING_FLOW', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/common/MDESOnboarding.tsx',
   msg:`Create MDESOnboarding.tsx — Thai government onboarding for INNOMCP (5 screens).

Props: isOpen, onComplete, onSkip
Screens: Welcome → What is INNOMCP → How to use → Try a prompt → Ready!
Progress dots, smooth slide, skip on every screen
"innomcp.onboarding.done" in localStorage
"use client", TypeScript strict, Tailwind. Complete file.`},

  {id:'MESSAGE_THREAD', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/MessageThread.tsx',
   msg:`Create MessageThread.tsx — message list container for INNOMCP chat.

Props: messages (ChatMessage[]), isWaitingForResponse, streamStatus, agentEvents (AgentEvent[]),
  typingUsers?, onRetry?, onCopy?, onFeedback?, scrollRef?, className?

Import types from "@/types/chat" for ChatMessage, ChatMode, ToolType.
Import AgentEvent from "./useAgentEventStream".

Features:
- Date separators between messages from different days (Thai locale dates)
- MDESStreamIndicator when waiting
- TypingIndicator when typingUsers.length > 0
- Auto-scroll to bottom on new messages (via scrollRef)
- Unread count tracking while scrolled up
- Empty: return null (parent handles empty state)

"use client", TypeScript strict, Tailwind. Complete file.`},

  // ── MORE NEW FEATURES ─────────────────────────────────────────────────────

  {id:'MDES_WORKSPACE_MANAGER', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/WorkspaceManager.tsx',
   msg:`Create WorkspaceManager.tsx — full workspace management UI for INNOMCP.

Combines WorkspaceFileBrowser + WorkspaceTerminalPanel + MDESAgentCard into a unified panel.

Props: events (AgentEvent[]), artifacts (Artifact[]), isStreaming, sessionId, className?
Tabs: 🤖 งาน (AgentStepsView) | 🌐 เว็บ | 💻 Terminal (WorkspaceTerminalPanel) | 📁 ไฟล์ (WorkspaceFileBrowser)
Uses WorkspaceTabBar for tab switching.
Panel header: "MDES Workspace" + model count + close button
Auto-switch to งาน tab when isStreaming starts.
"use client", TypeScript strict, Tailwind. Complete file.`},

  {id:'MDES_FLOATING_STATUS', model:FAST, max:3000,
   out:'innomcp-next/src/app/components/chat/FloatingStatusBadge.tsx',
   msg:`Create FloatingStatusBadge.tsx — small floating badge showing MDES status.

When AI is working, show a compact floating badge bottom-center.
States: thinking (spinning) | tool-use (wrench) | done (check, fades after 2s) | idle (hidden)
Small badge: bg MDES indigo, white text, rounded-full, fixed bottom-24 left-1/2 -translate-x-1/2
Example: "🤖 MDES กำลังคิด... 3s" → "✅ เสร็จแล้ว 4.2s"
"use client", TypeScript strict, Tailwind.`},

  {id:'MDES_SHORTCUT_OVERLAY', model:FAST, max:3000,
   out:'innomcp-next/src/app/components/chat/ShortcutCheatSheet.tsx',
   msg:`Create ShortcutCheatSheet.tsx — quick cheat sheet overlay (press ? when input empty).
Small card near input showing 5 key shortcuts.
Props: visible, onClose
Shows: Enter, Shift+Enter, Ctrl+K, /, Esc
Appears/disappears with fade animation
"use client", TypeScript strict, Tailwind.`},

  // ── NODE BACKEND FINAL ────────────────────────────────────────────────────

  {id:'NODE_WARMUP_SCRIPT', model:PRO, max:5000,
   out:'innomcp-node/src/scripts/warmup.ts',
   msg:`Create warmup.ts — server startup warmup script for innomcp-node.

Runs at server start to pre-warm all services.
Calls: mdesModelCache.warmUp(), analyticsService.reset(), sessionService cleanup
Also pre-checks: MDES Ollama health, DB connection, WebSocket readiness
Logs warmup progress with emojis: 🔥 Warming up... ✅ MDES models loaded (N models) etc.
Exports: async function warmupServer(): Promise<WarmupResult>
TypeScript strict.`},

  {id:'NODE_PROVIDER_MANAGER', model:PRO, max:7000,
   out:'innomcp-node/src/services/providerManager.ts',
   msg:`Create providerManager.ts — dynamic AI provider management for innomcp-node.

Manages the pool of available AI providers at runtime.

\`\`\`ts
interface ProviderConfig {
  id: string; name: string; type: 'mdes-ollama'|'openai-compat'|'anthropic'|'custom';
  baseUrl: string; model: string; apiKey?: string;
  capabilities: string[]; priority: number; enabled: boolean;
  healthStatus: 'healthy'|'degraded'|'unknown'; latencyMs?: number; lastChecked?: number;
}

class ProviderManager {
  async register(config: ProviderConfig): Promise<void>
  async unregister(id: string): Promise<void>
  async getAll(): Promise<ProviderConfig[]>
  async getBest(capability?: string): Promise<ProviderConfig | undefined>
  async checkHealth(id: string): Promise<{ healthy: boolean; latencyMs: number; }>
  async checkAllHealth(): Promise<ProviderConfig[]>
  getMDESPrimary(): ProviderConfig
  async selectForTask(task: 'thai'|'code'|'reasoning'|'fast'|'general'): Promise<ProviderConfig>
}
export const providerManager = new ProviderManager();
\`\`\`
TypeScript strict.`},

  {id:'NODE_WEBSOCKET_ENHANCER', model:PRO, max:6000,
   out:'innomcp-node/src/services/wsEnhancer.ts',
   msg:`Create wsEnhancer.ts — WebSocket enhancement layer for innomcp-node.

Adds features on top of the existing WebSocket server:
1. Room management (per-session isolation)
2. Heartbeat/ping-pong (keep-alive every 30s)
3. Message queuing (buffer messages while client reconnects)
4. Metrics: connection count, message rate, latency
5. Thai system messages: "กำลังเชื่อมต่อ..." / "เชื่อมต่อสำเร็จ" / "ขาดการเชื่อมต่อ"

\`\`\`ts
class WSEnhancer {
  attachToServer(wss: WebSocketServer): void
  broadcast(message: unknown, except?: WebSocket): void
  sendToRoom(roomId: string, message: unknown): void
  joinRoom(ws: WebSocket, roomId: string): void
  getStats(): { connections: number; rooms: number; messagesPerMin: number; }
}
export const wsEnhancer = new WSEnhancer();
\`\`\`
TypeScript strict.`},

  {id:'NODE_THAI_GOVT_TOOLS', model:PRO, max:8000,
   out:'innomcp-node/src/services/thaiGovtTools.ts',
   msg:`Create thaiGovtTools.ts — Thai government data tools service for innomcp-node.

Wraps the 4 existing MCP tools with a clean TypeScript API.

\`\`\`ts
class ThaiGovtTools {
  // Weather & Disaster (TMD/NWP)
  async getWeatherReport(province?: string): Promise<WeatherReport>
  async getDisasterAlerts(): Promise<DisasterAlert[]>
  async getWeatherForecast(province: string, days?: number): Promise<ForecastDay[]>

  // Geographic Data
  async getProvinceInfo(name: string): Promise<ProvinceInfo>
  async findNearest(lat: number, lon: number, type?: string): Promise<GeoPoint[]>
  async searchLocation(query: string): Promise<GeoPoint[]>

  // Evidence & Statistics
  async searchEvidence(query: string, limit?: number): Promise<Evidence[]>
  async getDataStats(category: string): Promise<DataStats>

  // Knowledge Base
  async searchKnowledge(query: string, language?: 'th'|'en'): Promise<KnowledgeItem[]>
  async getGovInfo(topic: string): Promise<GovInfo>
}
export const thaiGovtTools = new ThaiGovtTools();
\`\`\`
TypeScript strict. Wraps existing MCP client calls.`},

  // ── COMPREHENSIVE TESTS ───────────────────────────────────────────────────

  {id:'TEST_THAI_NLP_SERVICE', model:PRO, max:7000,
   out:'innomcp-node/tests/thaiNLPService.test.ts',
   msg:`Write comprehensive Jest tests for thaiNLPService.ts.

Test all public methods:
1. isThai(): 'สวัสดี' → true, 'hello' → false, 'mixed สวัสดี' → true
2. thaiRatio(): 'สวัสดีครับ' → ~1.0, 'hello world' → 0.0, '50% Thai 50%' → ~0.5
3. detectIntent(): various Thai prompts → correct type/domain/urgency
4. suggestModel(): Thai text → recommends Thai-capable model
5. tokenize(): basic Thai sentence tokenization
6. extractEntities(): "กรุงเทพมหานคร วันนี้ กรมอุตุ" → correct entities
7. clean(): removes noise, normalizes spaces

TypeScript. Jest. No external deps in tests.`},

  {id:'TEST_ANALYTICS_SERVICE', model:PRO, max:5000,
   out:'innomcp-node/tests/analyticsService.test.ts',
   msg:`Write Jest tests for analyticsService.ts.

Test:
1. track() MessageEvent increments counters
2. track() ToolEvent increments tool counts
3. track() ErrorEvent increments error count
4. getStats() returns correct aggregates after tracking
5. trackSession() / endSession() updates activeSessions count
6. reset() clears all counters
7. avgLatencyMs calculated correctly across multiple events
8. byModel and byTool maps populated correctly

TypeScript. Jest.`},

  {id:'TEST_SESSION_SERVICE', model:FAST, max:4000,
   out:'innomcp-node/tests/sessionService.test.ts',
   msg:`Write Jest tests for sessionService.ts.

Test:
1. create() returns valid session with id and defaults
2. get() returns session after create
3. get() returns undefined for unknown id
4. update() merges partial updates
5. touch() updates lastActivity
6. delete() removes session
7. count() returns correct number
8. cleanup() removes sessions idle > maxIdleMs
9. addMessageStat() increments messageCount and totalTokens
10. getActive() returns only non-deleted sessions

TypeScript. Jest.`},

  {id:'TEST_WORKSPACE_SERVICE', model:PRO, max:6000,
   out:'innomcp-node/tests/workspaceService.test.ts',
   msg:`Write Jest tests for workspaceService.ts using tmp directory.

Use: import tmp from 'os' + fs.mkdtempSync for test directories
Mock the base path to a temp dir.

Test:
1. listFiles() returns empty array for new session
2. writeFile() creates file
3. readFile() returns written content
4. deleteFile() removes file
5. listFiles() shows created files
6. createDir() creates subdirectory
7. getStats() returns correct totalFiles and totalSize
8. sanitizePath() prevents path traversal (../../etc/passwd → throws)
9. cleanupOldSessions() removes old session directories

TypeScript. Jest.`},

  {id:'TEST_MDES_CACHE', model:FAST, max:4000,
   out:'innomcp-node/tests/mdesModelCache.test.ts',
   msg:`Write Jest tests for mdesModelCache.ts with mocked fetch.

Mock global fetch to return sample MDES model data.

Test:
1. getModels() fetches from MDES endpoint on first call
2. getModels() returns cached result on second call (within TTL)
3. getModels(true) forces refresh
4. getModelFamilies() returns unique families from model names
5. isModelAvailable('gemma4:26b') returns true when in cache
6. isModelAvailable('unknown:model') returns false
7. getBestModelForTask('thai') returns Thai-capable model
8. getStats() shows correct modelCount and TTL

TypeScript. Jest. jest.spyOn(global, 'fetch').`},

  // ── MORE DOCUMENTATION ────────────────────────────────────────────────────

  {id:'DOC_TESTING_GUIDE', model:PRO, max:6000,
   out:'docs/TESTING_GUIDE.md',
   msg:`Write comprehensive testing guide for INNOMCP.

## Testing Strategy

### Frontend (innomcp-next)
- Unit tests: Jest + @testing-library/react
  - Run: pnpm --filter innomcp-next test
  - Coverage: src/app/components/chat/, src/app/hooks/, src/app/lib/
- E2E tests: Playwright
  - Run: pnpm --filter innomcp-next exec playwright test
  - Specs: e2e/manus-layout.spec.ts, e2e/provider-management.spec.ts, e2e/chat-full-flow.spec.ts

### Backend (innomcp-node)
- Unit tests: Jest
  - Run: pnpm --filter innomcp-node test
  - Coverage: src/services/, src/routes/
- Integration: mother-phase-live.js

### System tests
- Release gate: 59/59 system tests (node eval/run-all.js)
- Browser signoff: 61/61 Playwright (SMOKE_MODE=1)

### What to test before shipping
1. tsc --noEmit (both packages)
2. pnpm test (unit tests)
3. Smoke test: node eval/mother-phase-live.js
4. Manual: open chat, send a message, verify MDES responds

### Test coverage targets
- Services: >80%
- Components: >70% (key paths)
- API routes: >60%

Thai + English. Markdown. ~400 words.`},

  {id:'DOC_PERFORMANCE_GUIDE', model:PRO, max:5000,
   out:'docs/PERFORMANCE.md',
   msg:`Write performance optimization guide for INNOMCP.

## ประสิทธิภาพ INNOMCP

### Frontend Performance
1. Code splitting: Next.js dynamic() for heavy panels
2. Image optimization: next/image for all images
3. Font loading: Thai fonts preloaded in layout.tsx
4. Bundle size: analyze with next build --debug
5. React: useMemo for expensive computations, useCallback for handlers
6. Virtual scrolling: for long message lists (consider react-virtual)

### Backend Performance
1. MDES Ollama: model cached in mdesModelCache (5min TTL)
2. Session cleanup: runs every 30min to prevent memory leak
3. Rate limiting: prevents abuse
4. Connection pooling: WebSocket rooms for isolation

### MDES Ollama Optimization
1. Use gemma4:26b for general Thai tasks (best quality/speed ratio)
2. Use qwen2.5:7b for fast responses
3. Use deepseek-r1:32b only for heavy reasoning
4. Parallel dispatch: 2-3 agents = sweet spot

### Monitoring
- /api/health/detailed: memory, uptime, services
- /api/analytics/stats: usage metrics
- /api/providers/health-check: provider latencies

Thai primary, ~350 words, Markdown.`},

  {id:'DOC_MDES_API_MODELS', model:PRO, max:6000,
   out:'docs/MDES_OLLAMA_MODELS.md',
   msg:`Write MDES Ollama model catalog for INNOMCP users.

# โมเดล MDES Ollama

## วิธีเลือกโมเดล
คลิก model name ใน MDES header → เลือกจาก list

## โมเดลหลัก
| โมเดล | ขนาด | เหมาะสำหรับ | ความเร็ว |
|-------|------|------------|---------|
| gemma4:26b | 26B | ภาษาไทยทั่วไป | ปานกลาง |
| qwen2.5:7b | 7B | คำถามเร็ว | เร็ว |
| qwen2.5-coder:7b | 7B | โค้ด | เร็ว |
| deepseek-r1:32b | 32B | reasoning ซับซ้อน | ช้า |
| deepseek-v3:latest | varies | ทั่วไป | ปานกลาง |

## คุณสมบัติแต่ละโมเดล
### gemma4:26b (แนะนำ)
- ภาษาไทยธรรมชาติที่สุด
- เหมาะสำหรับ: สรุปเอกสาร, อธิบาย, ตอบคำถาม

### qwen2.5:7b
- เร็วที่สุด
- เหมาะสำหรับ: คำถามง่าย, ทักทาย, ค้นหาข้อมูลเบื้องต้น

### deepseek-r1:32b
- Reasoning mode (คิดก่อนตอบ)
- เหมาะสำหรับ: วิเคราะห์ซับซ้อน, เปรียบเทียบหลายทาง

## เพิ่มโมเดลเอง
กด ⚙️ → เพิ่ม Provider → กรอก Base URL + model name

Thai primary, Markdown table.`},

  {id:'DOC_INNOMCP_FAQ', model:PRO, max:6000,
   out:'docs/FAQ.md',
   msg:`Write FAQ for INNOMCP Thai government users.

# คำถามที่พบบ่อย (FAQ)

## ทั่วไป
Q: INNOMCP คืออะไร?
A: ระบบ AI ภาครัฐโดย MDES ทำงานแบบ multi-agent สำหรับงานราชการ

Q: ใช้งานได้ฟรีหรือไม่?
A: ฟรีสำหรับบุคลากรภาครัฐ ใช้ MDES Ollama ที่ไม่มีค่าใช้จ่าย

Q: ข้อมูลที่พิมพ์ปลอดภัยหรือไม่?
A: ข้อมูลประมวลผลบน MDES infrastructure ของรัฐ ไม่ส่งไป third-party

## การใช้งาน
Q: ทำไม AI ตอบช้า?
A: Model ขนาดใหญ่ใช้เวลาคิดนาน ลองเปลี่ยนเป็น qwen2.5:7b สำหรับความเร็ว

Q: แนบไฟล์ได้หรือไม่?
A: ได้ PDF, Word, Excel, CSV, รูปภาพ, เสียง (Whisper จะถอดเสียง)

Q: บันทึกบทสนทนาได้หรือไม่?
A: ได้ กด Export ใน conversation header เลือก PDF/MD/JSON

## Technical
Q: รองรับ Thai font หรือไม่?
A: ใช่ Noto Sans Thai + Sarabun

Q: มี API สำหรับ developers หรือไม่?
A: ดู docs/API_REFERENCE.md

Q: เพิ่ม AI model อื่นได้หรือไม่?
A: ได้ กด ⚙️ → เพิ่ม Provider (เหมือน openclaude)

Thai primary, Q&A format, ~400 words.`},

  // ── INTEGRATION FINAL ─────────────────────────────────────────────────────

  {id:'NEXT_CHAT_PAGE_INTEGRATION_GUIDE', model:PRO, max:8000,
   out:'docs/CHATPAGE_INTEGRATION_NOTES.md',
   msg:`Write integration notes for using the new Manus-style components in ChatPage.tsx.

This is a developer guide for how all the new Wave 1-9 components work together.

## ChatPage.tsx Component Tree (Current)

\`\`\`
ChatPage
├── MDESBrandHeader          ← MDES branding, model picker, ⚙️ settings, 🗂️ workspace
├── ManusWorkspacePanel      ← right panel (งาน/เว็บ/Terminal/ไฟล์)
├── ModelSettingsPanel       ← right panel when ⚙️ clicked (provider management)
├── ChatSidebar              ← left sidebar (conversation history)
└── Main area
    ├── ChatEmptyStateManager ← when no messages (hero + quickActions + starters)
    │   ├── ChatWelcomeHero
    │   ├── GovernmentQuickActions
    │   └── StarterPromptsGrid (reduced mode)
    ├── [ChatMessage list]   ← when messages exist
    ├── CollapsibleAgentWrapper ← agent progress (collapsed by default)
    └── ChatInput            ← composer (attach + send/stop)
\`\`\`

## Key State Variables in ChatPage
- workspaceOpen: boolean → controls ManusWorkspacePanel
- modelSettingsOpen: boolean → controls ModelSettingsPanel right panel
- multiAgentOpen: boolean → controls MultiAgentPanel visibility
- providerMode: "remote"|"local" → MDES cloud vs local
- modelSettingsOpen also triggered by ⚙️ in MDESBrandHeader

## Wiring New Components
How to use AgentStepsView, MDESStreamIndicator, SlashCommandMenu, etc.

## Data Flow
User sends message → WebSocket → conductor → MDES agents → agentStreamState.events → ManusWorkspacePanel + CollapsibleAgentWrapper + ChatMessage

Markdown, ~500 words, developer-focused.`},

  {id:'NEXT_RESPONSIVE_BREAKPOINTS', model:PRO, max:6000,
   out:'innomcp-next/src/app/styles/responsive.css',
   msg:`Create responsive.css — INNOMCP responsive design utilities.

Append to existing style system — CSS custom properties + utility classes.

Mobile (<640px):
- .mdes-sidebar: hidden (drawer mode)
- .mdes-workspace: full overlay
- .mdes-header: show only essential controls (no subtitle)

Tablet (640-1024px):
- .mdes-sidebar: 200px fixed
- .mdes-workspace: overlay from right (400px)
- .mdes-header: show most controls

Desktop (>1024px):
- .mdes-sidebar: 16rem fixed
- .mdes-workspace: inline right panel (380px)
- .mdes-header: full controls

Also add:
- .mdes-scroll-smooth: smooth scrolling for chat area
- .mdes-message-gap: proper spacing between messages
- .mdes-compose-area: sticky bottom composer styles

CSS only, no JavaScript.`},

  {id:'NEXT_APP_SHELL', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/common/INNOMCPAppShell.tsx',
   msg:`Create INNOMCPAppShell.tsx — the main app shell wrapper for INNOMCP.

This wraps the whole app with all necessary providers and global UI.

\`\`\`tsx
interface INNOMCPAppShellProps {
  children: React.ReactNode;
}
\`\`\`

Wraps with:
1. MDESThemeProvider (theme CSS vars)
2. INNOMCPProvider (notifications, preferences, health)
3. ARIALiveRegion (screen reader announcements)
4. SkipNavigation (accessibility)
5. MDESToastSystem (global toasts)
6. PWAInstallPrompt (PWA banner)
7. MDESOnboarding (first-time flow, checks localStorage)

Also renders:
- MDESOfflineBanner (fixed top when disconnected)
- MDESProductTour (if tourActive)

Import all components. "use client" where needed.
TypeScript strict, no placeholder code.`},
];

async function runWave9() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🔥 WAVE 9 — FINAL INTEGRATION (fixed semaphore + min tokens) ║');
  console.log(`║  ${TASKS.length} tasks | max 15 concurrent | PRO/FLASH                    ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { ok, fail, failed, totalTok, elapsed } = await runTasks(TASKS, ROOT, SYS);

  console.log('\n🔍 tsc check...\n');
  let tscPass = false;
  try {
    execSync('npx tsc --noEmit 2>&1', {
      cwd: `${ROOT.replace(/\//g, require('path').sep)}\\innomcp-next`,
      stdio: 'inherit', timeout: 120000
    });
    tscPass = true; console.log('  ✅ tsc PASS');
  } catch { console.log('  ⚠️  tsc issues (non-blocking)'); }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  ✅ ${ok}/${TASKS.length} tasks | ~${totalTok.toLocaleString()}tok (4x=~${(totalTok*4).toLocaleString()}) | ${elapsed}s   ║`);
  console.log(`║  tsc: ${tscPass ? '✅ PASS' : '⚠️  issues'}`.padEnd(67) + '║');
  if (failed.length) console.log(`║  Failed: ${failed.slice(0,4).join(', ')}`.padEnd(67) + '║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
}

runWave9().catch(e => { console.error('FATAL:', e); process.exit(1); });
