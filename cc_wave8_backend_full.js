#!/usr/bin/env node
/**
 * cc_wave8_backend_full.js — Wave 8: Backend + Integration + Final Components
 * 45 parallel CODECOMMAND tasks | deepseek-v4-pro | BURN EVERYTHING
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
const NEXT  = `${ROOT}/innomcp-next/src/app`;
const NODE  = `${ROOT}/innomcp-node/src`;
const DOCS  = `${ROOT}/docs`;

function slurp(fp, max=60000) {
  try { return fs.readFileSync(fp.replace(/\//g,path.sep),'utf8').replace(/^﻿/,'').slice(0,max); }
  catch { return `[NOT FOUND: ${fp}]`; }
}

async function cc(id, model, sys, msg, max=10000) {
  const t0=Date.now();
  try {
    const r=await fetch(`${CC_BASE}/chat/completions`,{
      method:'POST', headers:{'Authorization':`Bearer ${CC_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:[{role:'system',content:sys},{role:'user',content:msg}],max_tokens:max,temperature:0.15,stream:false}),
      signal:AbortSignal.timeout(360000),
    });
    const j=await r.json(),ms=Date.now()-t0,reply=j.choices?.[0]?.message?.content||'',tokens=j.usage?.total_tokens||0;
    if(!reply) return {id,ok:false,ms,tokens,error:JSON.stringify(j).slice(0,200)};
    return {id,ok:true,ms,tokens,reply};
  } catch(e){return {id,ok:false,ms:Date.now()-t0,tokens:0,error:e.message};}
}

function extract(r) {
  const m=r.match(/```(?:tsx?|ts|js|javascript|json|css|md|yaml|sql|sh)?\n([\s\S]+?)```/);
  return m?m[1].trim():r.trim();
}

function writeFile(rel,content,baseDir) {
  const b=(baseDir||ROOT).replace(/\//g,path.sep);
  const full=path.join(b,rel.replace(/\//g,path.sep));
  fs.mkdirSync(path.dirname(full),{recursive:true});
  if(content.startsWith('```'))content=extract(content);
  fs.writeFileSync(full,content,'utf8');
  process.stdout.write(`  ✏️  ${rel.split('/').slice(-1)[0]} (${Math.round(content.length/1024)}KB)\n`);
}

// Read existing patterns for context
const PROVIDER_ROUTER = slurp(`${NODE}/providers/router.ts`, 3000);
const PROVIDER_TYPES  = slurp(`${NODE}/providers/types.ts`, 3000);
const HEALTH_ROUTE    = slurp(`${NODE}/routes/api/health.ts`, 2000);

const SYS = `Expert TypeScript engineer — INNOMCP Thailand government AI platform by MDES.
Stack: Next.js 14, TypeScript strict, Tailwind CSS, Node.js/Express-like (innomcp-node), Playwright, Jest.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม. Primary AI: MDES Ollama (unlimited, 24/7).
Output ONLY the complete production-ready file in \`\`\`ts/tsx/js/json/md/yaml ... \`\`\`.
Rules: no truncation, Thai UI strings, preserve existing functionality.`;

const TASKS = [

  // ═══ BACKEND SERVICES (innomcp-node) ════════════════════════════════════════

  {id:'NODE_WORKSPACE_SERVICE', model:PRO, max:10000,
   out:'innomcp-node/src/services/workspaceService.ts',
   msg:`Create workspaceService.ts for innomcp-node — server-side workspace file management.

Service that manages the Innova-workspace (Manus computer equivalent):
- Base path: process.cwd() + '/workspace-storage'
- Session-isolated subdirectories: workspace-storage/{sessionId}/

\`\`\`ts
interface WorkspaceFile {
  name: string; path: string; type: 'file'|'directory'; size: number; modified: string; mimeType?: string;
}

class WorkspaceService {
  async listFiles(sessionId: string, subPath?: string): Promise<WorkspaceFile[]>
  async readFile(sessionId: string, filePath: string): Promise<{ content: string; encoding: string; }>
  async writeFile(sessionId: string, filePath: string, content: string): Promise<void>
  async deleteFile(sessionId: string, filePath: string): Promise<void>
  async createDir(sessionId: string, dirPath: string): Promise<void>
  async getStats(sessionId: string): Promise<{ totalFiles: number; totalSize: number; }>
  private sanitizePath(sessionId: string, inputPath: string): string  // prevent traversal
  async cleanupOldSessions(maxAgeMs: number): Promise<number>  // returns count cleaned
}
export const workspaceService = new WorkspaceService();
\`\`\`

Security: normalize all paths, verify they stay within sessionId subdirectory.
TypeScript strict.`},

  {id:'NODE_ANALYTICS_SERVICE', model:PRO, max:8000,
   out:'innomcp-node/src/services/analyticsService.ts',
   msg:`Create analyticsService.ts — real-time analytics for INNOMCP.

Tracks usage metrics in-memory (resets on restart) + optional file persistence.

\`\`\`ts
interface MessageEvent { provider: string; model: string; tokensIn: number; tokensOut: number; latencyMs: number; toolsUsed: string[]; success: boolean; sessionId?: string; }
interface ToolEvent { toolName: string; latencyMs: number; success: boolean; }
interface ErrorEvent { component: string; code: string; message: string; sessionId?: string; }

class AnalyticsService {
  track(event: MessageEvent | ToolEvent | ErrorEvent): void
  getStats(): {
    messages: { total: number; byModel: Record<string,number>; avgLatencyMs: number; };
    tools: { total: number; byTool: Record<string,number>; };
    errors: { total: number; rate: number; };
    uptime: number;
    activeSessions: number;
  }
  trackSession(sessionId: string): void
  endSession(sessionId: string): void
  reset(): void
}
export const analyticsService = new AnalyticsService();
\`\`\`
TypeScript strict.`},

  {id:'NODE_MDES_CACHE_SERVICE', model:PRO, max:8000,
   out:'innomcp-node/src/services/mdesModelCache.ts',
   msg:`Create mdesModelCache.ts — MDES Ollama model list cache for innomcp-node.

Caches the available models from MDES Ollama endpoint.

\`\`\`ts
interface MDESModel {
  name: string; size?: number; modified_at?: string;
  details?: { parameter_size?: string; family?: string; quantization_level?: string; };
}

class MDESModelCache {
  private cache: MDESModel[] = [];
  private lastFetch = 0;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getModels(forceRefresh = false): Promise<MDESModel[]>
  async getModel(name: string): Promise<MDESModel | undefined>
  getModelFamilies(): string[]
  async isModelAvailable(name: string): Promise<boolean>
  async getBestModelForTask(task: 'thai'|'code'|'reasoning'|'fast'): Promise<string>
  async warmUp(): Promise<void>  // call on server start
  getStats(): { modelCount: number; lastFetched: Date | null; ttlRemaining: number; }
}
export const mdesModelCache = new MDESModelCache();
\`\`\`
TypeScript strict. MDES endpoint: https://ollama.mdes-innova.online`},

  {id:'NODE_THAI_NLP_SERVICE', model:PRO, max:10000,
   out:'innomcp-node/src/services/thaiNLPService.ts',
   msg:`Create thaiNLPService.ts — Thai NLP utilities for INNOMCP.

Utilities for processing Thai language in the AI pipeline.

\`\`\`ts
class ThaiNLPService {
  // Detect if text is primarily Thai
  isThai(text: string): boolean
  thaiRatio(text: string): number  // 0-1

  // Thai intent detection (rule-based, fast)
  detectIntent(text: string): {
    type: 'question' | 'command' | 'greeting' | 'feedback' | 'unknown';
    language: 'thai' | 'english' | 'mixed';
    urgency: 'high' | 'normal' | 'low';
    domain: 'weather' | 'geo' | 'document' | 'code' | 'general';
  }

  // Suggest best MDES model based on Thai content
  suggestModel(text: string, availableModels: string[]): string

  // Tokenize Thai text (simple whitespace + Thai word boundaries)
  tokenize(text: string): string[]

  // Extract entities (province names, dates, government agencies)
  extractEntities(text: string): {
    provinces: string[];
    dates: string[];
    agencies: string[];
    numbers: number[];
  }

  // Clean Thai text (normalize spaces, remove noise)
  clean(text: string): string

  // Format Thai government document text
  formatGovDoc(text: string): string
}
export const thaiNLPService = new ThaiNLPService();
\`\`\`
Full implementation with Thai character detection (Unicode U+0E00-U+0E7F).
TypeScript strict. No external NLP libraries.`},

  {id:'NODE_NOTIFICATION_SERVICE', model:PRO, max:7000,
   out:'innomcp-node/src/services/notificationService.ts',
   msg:`Create notificationService.ts — server-side notification dispatcher for INNOMCP.

Manages server-sent notifications to connected clients.

\`\`\`ts
type NotificationType = 'task_complete' | 'agent_done' | 'error' | 'system' | 'mdes_alert';

interface Notification {
  id: string; type: NotificationType; title: string; message?: string;
  sessionId?: string; broadcast?: boolean; timestamp: number;
  data?: unknown;
}

class NotificationService {
  private listeners = new Map<string, (n: Notification) => void>();

  subscribe(sessionId: string, callback: (n: Notification) => void): () => void
  notify(notification: Omit<Notification, 'id'|'timestamp'>): void
  broadcast(notification: Omit<Notification, 'id'|'timestamp'|'sessionId'>): void
  notifyTaskComplete(sessionId: string, taskSummary: string): void
  notifyMDESAlert(message: string): void
  notifyAgentDone(sessionId: string, agentId: string, model: string, elapsed: number): void
  getRecentNotifications(sessionId: string, limit?: number): Notification[]
}
export const notificationService = new NotificationService();
\`\`\`
TypeScript strict.`},

  {id:'NODE_SESSION_SERVICE', model:PRO, max:8000,
   out:'innomcp-node/src/services/sessionService.ts',
   msg:`Create sessionService.ts — session management for INNOMCP users.

\`\`\`ts
interface SessionData {
  id: string; createdAt: number; lastActivity: number;
  userId?: string; isGuest: boolean;
  preferences: { model?: string; chatMode?: string; providerMode?: string; };
  stats: { messageCount: number; toolUseCount: number; totalTokens: number; };
  metadata: Record<string, unknown>;
}

class SessionService {
  create(options?: Partial<SessionData>): SessionData
  get(sessionId: string): SessionData | undefined
  update(sessionId: string, updates: Partial<SessionData>): void
  delete(sessionId: string): void
  touch(sessionId: string): void  // update lastActivity
  cleanup(maxIdleMs?: number): number  // remove idle sessions
  getActive(): SessionData[]
  count(): number
  addMessageStat(sessionId: string, tokens?: number): void
  addToolStat(sessionId: string): void
}
export const sessionService = new SessionService();
\`\`\`
TypeScript strict.`},

  {id:'NODE_RATE_LIMITER', model:FAST, max:5000,
   out:'innomcp-node/src/middleware/rateLimiter.ts',
   msg:`Create rateLimiter.ts middleware for innomcp-node.

Simple in-memory rate limiter for API endpoints.

\`\`\`ts
interface RateLimitOptions {
  windowMs: number;   // time window in ms
  maxRequests: number; // max requests per window
  keyFn?: (req: Request) => string;  // default: by IP
  skipFn?: (req: Request) => boolean; // skip rate limiting if true
  message?: string;   // Thai error message
}

// Express/node-compatible middleware
function createRateLimiter(options: RateLimitOptions): Middleware
function chatRateLimit(): Middleware      // 20 req/min
function apiRateLimit(): Middleware       // 60 req/min
function providerRateLimit(): Middleware  // 10 req/min
\`\`\`

In-memory sliding window. Cleanup expired entries every 60s.
Thai error message: "คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง"
TypeScript strict.`},

  {id:'NODE_AUDIT_LOGGER', model:FAST, max:5000,
   out:'innomcp-node/src/services/auditLogger.ts',
   msg:`Create auditLogger.ts — audit logging for INNOMCP (Thai government compliance).

Required for Thai government systems (compliance with ระเบียบ ICT).

\`\`\`ts
type AuditAction = 'login' | 'logout' | 'message_sent' | 'file_access' | 'provider_change' | 'admin_action' | 'data_export';

interface AuditEntry {
  id: string; timestamp: number; action: AuditAction;
  sessionId?: string; userId?: string; ipAddress?: string;
  details: Record<string, unknown>;
  success: boolean; error?: string;
}

class AuditLogger {
  log(entry: Omit<AuditEntry, 'id'|'timestamp'>): void
  getEntries(filter?: { action?: AuditAction; startTime?: number; endTime?: number; limit?: number; }): AuditEntry[]
  exportCSV(): string
  exportJSON(): string
  clear(beforeTimestamp?: number): number
}
export const auditLogger = new AuditLogger();
\`\`\`
Writes to logs/audit.jsonl. Rotate daily.
TypeScript strict.`},

  {id:'NODE_WORKSPACE_ROUTE', model:PRO, max:8000,
   out:'innomcp-node/src/routes/api/workspace.ts',
   msg:`Create workspace.ts route handler for innomcp-node.

REST routes for Innova-workspace file management.

\`\`\`ts
// GET  /api/workspace/files?path=/&sessionId=xxx → list files
// POST /api/workspace/files → { sessionId, path, content } → write file
// DELETE /api/workspace/files → { sessionId, path } → delete file
// GET  /api/workspace/stats?sessionId=xxx → usage stats
// POST /api/workspace/upload → multipart file upload
\`\`\`

Uses workspaceService from ./services/workspaceService.
Auth: extract sessionId from JWT or query param.
Validation: path traversal prevention, file size limits (10MB), type restrictions.
Returns: { success, data?, error?, message? }
Express-compatible handlers. TypeScript strict.`},

  {id:'NODE_ANALYTICS_ROUTE', model:FAST, max:5000,
   out:'innomcp-node/src/routes/api/analytics.ts',
   msg:`Create analytics.ts route handler for innomcp-node.

\`\`\`ts
// GET  /api/analytics/stats → overall system stats
// POST /api/analytics/event → track a frontend event
// GET  /api/analytics/export → export data as JSON/CSV
// DELETE /api/analytics/reset → admin only, reset counters
\`\`\`

Uses analyticsService. Admin routes require X-Admin-Key header.
TypeScript strict. Express-compatible.`},

  {id:'NODE_MDES_ROUTE', model:PRO, max:7000,
   out:'innomcp-node/src/routes/api/mdesModels.ts',
   msg:`Create mdesModels.ts route for innomcp-node — MDES model management API.

\`\`\`ts
// GET  /api/mdes/models → list all MDES models (cached)
// GET  /api/mdes/models/:name → get specific model info
// GET  /api/mdes/models/search?q=xxx → search models
// GET  /api/mdes/health → MDES Ollama health check
// POST /api/mdes/warmup → force cache refresh
// GET  /api/mdes/recommend?task=thai → recommend model for task
\`\`\`

Uses mdesModelCache. Adds response caching headers.
TypeScript strict.`},

  {id:'NODE_THAI_NLP_ROUTE', model:FAST, max:5000,
   out:'innomcp-node/src/routes/api/thaiNLP.ts',
   msg:`Create thaiNLP.ts route for innomcp-node — Thai NLP processing API.

\`\`\`ts
// POST /api/thai/detect → { text } → intent detection
// POST /api/thai/entities → { text } → extract provinces/dates/agencies
// POST /api/thai/tokenize → { text } → tokenize Thai text
// POST /api/thai/clean → { text } → clean/normalize Thai
// GET  /api/thai/provinces → list all Thai provinces
\`\`\`

Uses thaiNLPService. No auth required (public endpoint).
TypeScript strict.`},

  // ═══ FRONTEND FINAL COMPONENTS (innomcp-next) ═══════════════════════════════

  {id:'NEXT_AGENT_STEPS_VIEW', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/chat/AgentStepsView.tsx',
   msg:`Create AgentStepsView.tsx — definitive Manus.ai-style agent step-by-step tracker.

This is the core "computer working" view in ManusWorkspacePanel's "งาน" tab.

\`\`\`ts
interface AgentStep {
  id: string; type: string; label: string; model?: string;
  status: 'waiting'|'active'|'done'|'error';
  summary?: string; toolName?: string; elapsed?: number;
  timestamp: string;
}

interface AgentStepsViewProps {
  events: AgentEvent[];    // from useAgentEventStream
  isStreaming: boolean;
  className?: string;
}
\`\`\`

Design (Manus.ai computer view style):
- Vertical step list with connecting line
- Each step: circle indicator + step number + label + model badge + elapsed
- Active: pulsing indigo circle + "กำลังทำงาน..."
- Done: solid green checkmark circle
- Error: red X circle
- Step details: expand on click to show full summary
- Group agents by type: routing → agent → tool → synthesis
- Summary bar at top: "MDES AI กำลังวิเคราะห์ N ขั้นตอน" or "เสร็จแล้วใน X วินาที"
- Animate: steps slide in from bottom as they appear

Map AgentEvent types to readable Thai step labels.
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_COMPOSER_ENHANCEMENTS', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/ComposerEnhancedBar.tsx',
   msg:`Create ComposerEnhancedBar.tsx — Manus.ai-style enhanced composer action bar.

Sits BELOW the main ChatInput, showing contextual AI capabilities.

\`\`\`ts
interface ComposerEnhancedBarProps {
  isConnected: boolean;
  currentModel?: string;
  activeAgentCount?: number;
  providerMode: 'remote'|'local';
  onInsertTemplate: (text: string) => void;
  onOpenQuickCompose: () => void;
  onToggleWorkspace: () => void;
  workspaceOpen?: boolean;
}
\`\`\`

Layout: horizontal bar, compact (h-8), below composer

Left:
- MDES model pill ("🤖 gemma4:26b" or "💻 Local Ollama")
- Agent count if active ("3 agents")

Center:
- Quick action pills (scrollable): ⚡ เร็ว | 🧠 วิเคราะห์ | 📄 สรุป | 🌐 ค้นหาเว็บ
- Click inserts template prefix

Right:
- Workspace toggle (🗂️) — compact icon
- Quick compose (📝)

Background: very subtle, no border, blends with composer
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_STREAM_INDICATOR', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/chat/MDESStreamIndicator.tsx',
   msg:`Create MDESStreamIndicator.tsx — live streaming indicator for MDES AI responses.

Shows real-time progress while MDES agents are working (Manus.ai style).

\`\`\`ts
interface MDESStreamIndicatorProps {
  isStreaming: boolean;
  agentStates: Array<{ agentId: string; model: string; status: 'thinking'|'tool'|'done'; }>;
  streamStatus: string;
  elapsed?: number;    // ms since stream started
  className?: string;
}
\`\`\`

States:
1. idle: render nothing
2. starting: "MDES AI กำลังเริ่มต้น..." with subtle pulse
3. thinking: agent avatars row + "AI N ตัวกำลังคิด" + elapsed timer
4. tool_use: "ใช้เครื่องมือ: {toolName}" + spinner
5. streaming: text cursor only (answer is rendering)
6. done: "เสร็จสิ้น · {elapsed}ms" → fade out after 2s

Agent avatars: colored circles with model family initial (G=gemma, Q=qwen, L=llama, D=deepseek)
Elapsed timer: ticks every 100ms while active

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_SHORTCUT_COMMANDS', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/SlashCommandMenu.tsx',
   msg:`Create SlashCommandMenu.tsx — "/" slash command menu for INNOMCP chat.

When user types "/" in empty input, shows a floating command menu.

\`\`\`ts
interface SlashCommand {
  id: string; label: string; description: string;
  icon: string; shortcut?: string;
  action: (insertText: (t: string) => void) => void;
}

interface SlashCommandMenuProps {
  visible: boolean; query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: { bottom: number; left: number; };
}
\`\`\`

Built-in commands:
- /image → "สร้างรูปภาพ: "
- /weather → "รายงานสภาพอากาศ จังหวัด "
- /law → "ค้นหากฎหมายเรื่อง "
- /summarize → "สรุปเนื้อหา: "
- /translate → "แปลเป็นภาษาไทย: "
- /code → "เขียนโค้ด "
- /table → "สร้างตาราง "
- /data → "วิเคราะห์ข้อมูล "
- /report → "สร้างรายงาน "
- /help → show all commands

Keyboard: ↑↓ navigate, Enter select, Esc close
Filter by query (fuzzy match against label)
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_WORKSPACE_TERMINAL', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/chat/WorkspaceTerminalPanel.tsx',
   msg:`Create WorkspaceTerminalPanel.tsx — terminal-like view for workspace code execution in INNOMCP.

This is the "Terminal" tab in ManusWorkspacePanel.

\`\`\`ts
interface TerminalLine {
  type: 'input'|'output'|'error'|'info'|'success';
  content: string; timestamp: number; duration?: number;
}

interface WorkspaceTerminalPanelProps {
  events: AgentEvent[];    // shell/exec events from stream
  isStreaming: boolean;
  className?: string;
}
\`\`\`

Design (Manus computer terminal):
- Dark background (bg-slate-950)
- Monospace font (font-mono text-[13px])
- Input lines: green prefix "$ " + command
- Output lines: white text
- Error lines: red text
- Info lines: cyan/blue
- Success lines: green
- Timestamps on right (small, muted)
- Auto-scroll to bottom
- Empty state: "ยังไม่มีคำสั่งที่รัน" + dim cursor

Extract shell events from AgentEvent stream (toolName includes shell/exec/bash).
Group related input+output pairs.
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_CHAT_HEADER_BAR', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/ChatConversationHeader.tsx',
   msg:`Create ChatConversationHeader.tsx — conversation-level header for the main chat area.

Shown above the message list when there are active messages (below MDESBrandHeader).

\`\`\`ts
interface ChatConversationHeaderProps {
  title?: string;
  messageCount?: number;
  isStreaming?: boolean;
  agentCount?: number;
  onExport?: () => void;
  onSearch?: () => void;
  onClear?: () => void;
  className?: string;
}
\`\`\`

Design: thin bar (h-8) at top of message list
Left: conversation title (truncated) + message count badge
Right: search icon + export icon + clear history icon (with confirmation)

Hover: buttons appear on hover of the bar
Confirmation for clear: inline "ยืนยัน?" + "ใช่"/"ยกเลิก"

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_INLINE_FEEDBACK', model:FAST, max:5000,
   out:'innomcp-next/src/app/components/chat/InlineFeedbackBar.tsx',
   msg:`Create InlineFeedbackBar.tsx — inline feedback bar that appears below AI responses.

\`\`\`ts
interface InlineFeedbackBarProps {
  messageId: string;
  model?: string;
  elapsed?: number;
  onCopy: () => void;
  onRetry?: () => void;
  onFeedback: (rating: 'good'|'bad') => void;
  onShare?: () => void;
  className?: string;
}
\`\`\`

Layout: horizontal bar below AI bubble, appears on hover
- Model badge: tiny "gemma4:26b" or "MDES"
- Elapsed: "1.2s"
- Separator ·
- 📋 Copy | 🔄 Retry | 👍 | 👎 | 🔗 Share

All icons, no text labels (compact)
Fade in on hover, always visible on mobile
After feedback: show "ขอบคุณ! 🙏" for 2s
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_PROVIDER_STATUS_BAR', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/chat/ProviderStatusBar.tsx',
   msg:`Create ProviderStatusBar.tsx — real-time provider status bar for INNOMCP.

Shows at the bottom of the chat, above composer — compact status line.

\`\`\`ts
interface ProviderStatusBarProps {
  mdesHealthy: boolean;
  mdesLatencyMs?: number;
  activeProviders?: Array<{ name: string; healthy: boolean; }>;
  currentModel?: string;
  onModelClick?: () => void;
  className?: string;
}
\`\`\`

Design: very compact bar (h-5, text-[10px])
Left: status dot + "MDES Ollama" + latency ("42ms") OR "ออฟไลน์"
Center: current model name (clickable → opens ModelPicker)
Right: N providers online indicator

Colors: green dot=online, red dot=offline, amber dot=slow (>3s)
Only show if explicitly rendered — optional inclusion

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_MULTI_MODAL', model:PRO, max:9000,
   out:'innomcp-next/src/app/components/chat/MDESMultiModalInput.tsx',
   msg:`Create MDESMultiModalInput.tsx — multi-modal input handler for INNOMCP.

Handles multiple file types gracefully in the chat composer area.

\`\`\`ts
type AttachmentType = 'image'|'audio'|'video'|'pdf'|'csv'|'json'|'code'|'other';

interface AttachmentPreview {
  id: string; file: File; type: AttachmentType;
  previewUrl?: string; thumbnail?: string;
  processingState: 'idle'|'analyzing'|'ready'|'error';
  analysis?: string;    // extracted content/summary
  error?: string;
}

interface MDESMultiModalInputProps {
  attachments: AttachmentPreview[];
  onRemove: (id: string) => void;
  onAnalysis: (id: string, analysis: string) => void;
  className?: string;
}
\`\`\`

Shows attachment previews above the chat input:
- Images: thumbnail preview
- PDFs: page count + title extraction
- CSVs: row/col count
- Audio: duration + "จะถอดเสียงด้วย Whisper"
- Code files: language detection
- Unknown: generic icon

Each attachment: close button, processing spinner, error state
Horizontal scroll when many attachments
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_CONVERSATION_SIDEBAR', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/chat/ChatSidebarEnhanced.tsx',
   msg:`Create ChatSidebarEnhanced.tsx — enhanced Manus-style conversation sidebar.

A drop-in improvement over the existing ChatSidebar with better UX.

\`\`\`ts
interface ChatSidebarEnhancedProps {
  summaries: ChatHistorySummary[];
  activeSummaryId: string|null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSummary: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSearch?: () => void;
  theme: string;
}
\`\`\`

Design improvements over current ChatSidebar:
1. Header: 🇹🇭 MDES INNOMCP logo + new chat button + collapse button
2. Search bar: "ค้นหาบทสนทนา..." (always visible)
3. Today/Yesterday/This Week/Older grouping
4. Each item: conversation title (auto-truncated) + message count badge + relative time
5. Hover actions: rename (✏️) + delete (🗑️) buttons
6. Collapsed: shows only icons (new chat + search)
7. Smooth collapse animation
8. Empty state: "ยังไม่มีประวัติการสนทนา"

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_SETTINGS_PANEL', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/settings/INNOMCPSettingsPanel.tsx',
   msg:`Create INNOMCPSettingsPanel.tsx — comprehensive settings panel for INNOMCP.

Full settings sidebar (like Claude's settings, but MDES-branded).

Sections:
1. ทั่วไป (General): Theme, Language, Compact mode, Sound notifications
2. AI Provider: MDES Ollama (default), Add custom provider button, Provider list
3. โมเดล (Models): Default model selector, Chat mode preference
4. ความเป็นส่วนตัว (Privacy): Telemetry toggle, Clear history, Export data
5. ขั้นสูง (Advanced): Debug mode, WebSocket URL override, Clear cache
6. เกี่ยวกับ (About): Version info, documentation links, support

Props:
\`\`\`ts
interface INNOMCPSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  section?: 'general'|'providers'|'models'|'privacy'|'advanced'|'about';
}
\`\`\`

Design: full-height right sidebar (same pattern as ManusWorkspacePanel)
Left nav: section icons + labels
Right content: section-specific settings

"use client", TypeScript strict, Tailwind.`},

  // ═══ DOCUMENTATION AND SPECS (8 tasks) ══════════════════════════════════════

  {id:'DOC_INNOMCP_OVERVIEW', model:PRO, max:10000,
   out:'docs/INNOMCP_OVERVIEW.md',
   msg:`Write the definitive INNOMCP overview document — the "what is this system" for Thai government stakeholders.

# INNOMCP — ระบบ AI ภาครัฐ โดย MDES

## บทนำ (Introduction)
INNOMCP คือแพลตฟอร์ม Multi-Agent AI สำหรับภาครัฐไทย พัฒนาโดย MDES (กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม)

Cover:
## คืออะไร (What is it)
- MCP Hub (Model Context Protocol Hub) สำหรับภาครัฐ
- ทำงานแบบ Manus.ai — AI ที่ทำงานต่อเนื่องได้ทุกงาน
- ใช้ MDES Ollama เป็น AI หลัก (ไม่จำกัด ไม่มีค่าใช้จ่าย)

## จุดเด่น (Key Features)
- Multi-Agent: หลาย AI ทำงานพร้อมกัน วิเคราะห์และสังเคราะห์
- Thai-First: ออกแบบสำหรับภาษาไทยโดยเฉพาะ
- Government Data: เชื่อมต่อข้อมูลราชการ (TMD, World Bank, etc.)
- 24/7 Availability: ไม่มี downtime เพราะใช้ infrastructure ของ MDES
- Workspace: AI มีพื้นที่ทำงานเหมือน Manus computer
- Provider Flexibility: เพิ่ม AI model จาก provider ใดก็ได้

## สถาปัตยกรรม (Architecture)
3-column Manus layout, innomcp-next + innomcp-node, MDES Ollama

## MCP Tools ที่รองรับ (56+ tools)
TMD Weather, Thai Geo, Evidence Stats, Knowledge Base, + more

## Use Cases สำหรับภาครัฐ
สรุปเอกสาร, ค้นหากฎหมาย, วิเคราะห์ข้อมูล, รายงานภัยพิบัติ

Thai primary, ~600 words, Markdown, government-friendly tone.`},

  {id:'DOC_MDES_PROVIDER_GUIDE', model:PRO, max:8000,
   out:'docs/MDES_PROVIDER_GUIDE.md',
   msg:`Write MDES Provider Configuration Guide for INNOMCP.

## การตั้งค่า MDES Ollama (Primary Provider)
- Endpoint: https://ollama.mdes-innova.online
- Authentication: token ใน .env file
- Available models: gemma4:26b, qwen2.5:7b, deepseek-r1:32b, + more
- Model selection guide: ใช้ model ไหนสำหรับงานแบบไหน

## เพิ่ม Provider เพิ่มเติม (Adding Custom Providers)
เหมือน openclaude — สามารถเพิ่ม AI provider ใดก็ได้
1. คลิก ⚙️ ใน header
2. เลือก preset หรือกรอกเอง
3. ทดสอบการเชื่อมต่อ
4. บันทึก

## Provider Presets
- MDES Ollama ☁️ — default, ไม่ต้อง API key
- OpenAI — ต้องการ key
- Anthropic — ต้องการ key
- Groq — เร็วมาก, ต้องการ key
- Ollama Local 💻 — ติดตั้งในเครื่อง
- Gemini — ต้องการ key
- LM Studio — local model via LM Studio
- MDES ThaiLLM — Thai government LLM (coming soon)

## ความปลอดภัย
API keys เข้ารหัสในฐานข้อมูล ไม่แสดงใน UI

Thai primary, ~400 words, Markdown.`},

  {id:'DOC_AGENT_SYSTEM', model:PRO, max:8000,
   out:'docs/MULTI_AGENT_SYSTEM.md',
   msg:`Write Multi-Agent System documentation for INNOMCP.

## ระบบ Multi-Agent ของ INNOMCP

### วิธีการทำงาน (How it works)
Every query → MDES conductor → parallel agents → synthesis

1. Intent Classification: จำแนกว่าคำถามต้องการอะไร
2. Parallel Dispatch: ยิง 2-4 agents พร้อมกัน (Haiku + Opus escalation)
3. Tool Use: agents ใช้ MCP tools ตามต้องการ
4. Synthesis: รวมคำตอบจากทุก agent
5. Thai Natural Language: ตรวจสอบความเป็นธรรมชาติของภาษาไทย

### Agent Types ใน MDES Ollama
- Fast Agent: qwen2.5:7b — คำถามง่าย
- Standard Agent: gemma4:26b — คำถามทั่วไป
- Heavy Agent: deepseek-r1:32b — reasoning ซับซ้อน
- Specialist: Thai-specific models

### ManusWorkspacePanel "งาน" Tab
แสดงขั้นตอนการทำงานของ agents แบบ real-time:
- วิเคราะห์คำถาม → เริ่ม Agent → ใช้เครื่องมือ → สรุปคำตอบ

### CollapsibleAgentWrapper
MultiAgentPanel collapsed by default, auto-expands when streaming

Thai primary, ~400 words, Markdown.`},

  {id:'DOC_WORKSPACE_GUIDE', model:PRO, max:7000,
   out:'docs/INNOVA_WORKSPACE_USER_GUIDE.md',
   msg:`Write user guide for Innova-workspace (Manus computer in INNOMCP).

## Innova-workspace — พื้นที่ทำงาน AI

### คืออะไร
เหมือน Manus.ai's computer — AI มีพื้นที่ทำงานที่ persistent
สามารถจัดการไฟล์ รัน code และทำงานซับซ้อนได้

### วิธีเปิด
คลิก 🗂️ ในแถบ MDES header หรือเมื่อ AI เริ่มทำงาน จะเปิดอัตโนมัติ

### แท็บใน Workspace
- **งาน (Tasks)**: ดูขั้นตอนการทำงานของ AI แบบ step-by-step
- **เว็บ (Web)**: ผลการค้นหาเว็บจาก AI
- **Terminal**: ผลลัพธ์การรัน code/command
- **ไฟล์ผลลัพธ์ (Files)**: ไฟล์ที่ AI สร้าง (PDF, CSV, รูปภาพ, etc.)

### Storage
ไฟล์เก็บใน workspace-storage/ (จะเชื่อมต่อกับ Drive/NAS ของ MDES ในอนาคต)

### Tips
- งาน AI ซับซ้อน (สรุปเอกสาร, วิเคราะห์ข้อมูล) จะเห็นขั้นตอนใน Workspace
- ดาวน์โหลดไฟล์ได้จากแท็บ ไฟล์ผลลัพธ์
- ปิด Workspace เมื่อไม่ต้องการ เพื่อพื้นที่อ่านมากขึ้น

Thai primary, ~350 words, Markdown.`},

  {id:'DOC_KEYBOARD_SHORTCUTS', model:FAST, max:4000,
   out:'docs/KEYBOARD_SHORTCUTS.md',
   msg:`Write keyboard shortcuts reference for INNOMCP.

# คีย์ลัด INNOMCP

## การสนทนา
| คีย์ | การทำงาน |
|------|----------|
| Enter | ส่งข้อความ |
| Shift+Enter | ขึ้นบรรทัดใหม่ |
| Escape | หยุด AI |
| / | เปิดเมนูคำสั่ง Slash |

## การนำทาง
| คีย์ | การทำงาน |
|------|----------|
| Ctrl+K | เปิด Command Palette |
| Ctrl+/ | ดูคีย์ลัดทั้งหมด |
| Ctrl+N | แชทใหม่ |
| Ctrl+B | เปิด/ปิด Sidebar |

## Workspace
| คีย์ | การทำงาน |
|------|----------|
| Ctrl+W | เปิด/ปิด Workspace Panel |
| Ctrl+E | Export บทสนทนา |

## ทั่วไป
| คีย์ | การทำงาน |
|------|----------|
| ? | Help คีย์ลัด (เมื่อ input ว่าง) |
| Ctrl+, | เปิดการตั้งค่า |

Thai primary, Markdown table format.`},

  {id:'DOC_MDES_BRANDING', model:PRO, max:6000,
   out:'docs/MDES_BRANDING_GUIDE.md',
   msg:`Write MDES branding guidelines for INNOMCP.

# คู่มือแบรนด์ MDES สำหรับ INNOMCP

## สี (Colors)
- MDES Primary: #1a3c6e (Thai government blue)
- MDES Primary Light: #2d5a9e
- MDES Accent: #c8973e (Thai gold)
- Text Primary: dark mode / light mode variants

## โลโก้ (Logo)
- ใช้ 🇹🇭 emoji + "MDES" text ใน header
- Subtitle: "ศูนย์ MCP ภาครัฐ" (Government MCP Hub)
- Full name: "กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม"

## Typography
- Thai font: Noto Sans Thai, Sarabun
- Display font: Noto Sans Thai, Inter
- Body: 15px, line-height 1.7 (Thai text)

## Component Guidelines
- Primary buttons: bg-[#1a3c6e] text-white
- MDES brand pills: indigo accent
- Status ribbon: indigo when MDES active

## Voice & Tone
- Professional but friendly (ราชการที่เข้าถึงได้)
- Thai-first, technical terms in Thai when possible
- "AI" not "เอไอ" (technical term stays English)

Markdown, ~300 words.`},

  {id:'DOC_QUICK_START', model:PRO, max:7000,
   out:'docs/QUICK_START.md',
   msg:`Write 5-minute quick start guide for INNOMCP.

# เริ่มต้นใช้ INNOMCP ใน 5 นาที

## ขั้นตอนที่ 1: เข้าสู่ระบบ
เปิด http://localhost:3000 (หรือ URL ที่ผู้ดูแลระบบให้มา)
ล็อกอินด้วย MDES account หรือใช้ Guest mode

## ขั้นตอนที่ 2: ทำความรู้จักหน้าจอ
รูปหน้าจอ + ลูกศรชี้ส่วนต่างๆ:
- ซ้าย: ประวัติบทสนทนา
- กลาง: พื้นที่สนทนา (MDES AI)
- ขวา (เมื่อเปิด): Workspace

## ขั้นตอนที่ 3: เริ่มสนทนา
วิธีที่ 1: คลิก Quick Action (เช่น "สรุปเอกสาร")
วิธีที่ 2: พิมพ์คำถามในกล่องด้านล่าง
วิธีที่ 3: แนบไฟล์แล้วถาม

## ขั้นตอนที่ 4: ดู AI ทำงาน
คลิก 🗂️ เพื่อเปิด Workspace — เห็น AI ทำงานทีละขั้น

## ขั้นตอนที่ 5: บันทึกผลลัพธ์
- ดาวน์โหลดไฟล์จาก Workspace > ไฟล์ผลลัพธ์
- Export บทสนทนาเป็น PDF/Word

## เคล็ดลับ
- กด Ctrl+K สำหรับคำสั่งลัด
- กด ? เพื่อดู keyboard shortcuts
- MDES Ollama ทำงาน 24/7 ไม่มีหยุด

Thai primary, ~400 words, Markdown with emoji headers.`},

  {id:'DOC_CHANGELOG_FULL', model:PRO, max:8000,
   out:'CHANGELOG.md',
   msg:`Write comprehensive CHANGELOG.md for INNOMCP covering the Manus.ai redesign sprint.

# CHANGELOG

## [10.17.0] — 2026-06-11

### Added
Complete Manus.ai-style redesign of INNOMCP:

**Layout & UI**
- MDESBrandHeader: MDES government branding, provider toggle, workspace toggle, model picker, settings ⚙️
- ManusWorkspacePanel: 3-tab workspace (งาน/เว็บ/Terminal/ไฟล์ผลลัพธ์)
- CollapsibleAgentWrapper: MultiAgentPanel collapsed by default
- ChatEmptyStateManager: Manus-style empty state orchestration
- ChatWelcomeHero: INNOMCP hero section with MDES branding
- GovernmentQuickActions: Thai government quick action shortcuts
- AgentStepsView: Step-by-step agent tracker (Manus computer style)

**Chat Components** (30+ new)
- MDESChatBubble, FollowUpSuggestions, MDESCodeBlock, MDESTableRenderer
- MDESWeatherCard, MDESMapCard, MDESDocumentCard, MDESEvidenceCard
- SlashCommandMenu, ComposerEnhancedBar, InlineFeedbackBar
- ChatConversationHeader, ProviderStatusBar, ChatStickyActions

**Provider Management**
- ProviderModal: 8 preset providers (MDES, OpenAI, Anthropic, Groq, Gemini, Ollama, LMStudio, ThaiLLM)
- MDESModelPicker: Live MDES Ollama model picker
- INNOMCPSettingsPanel: Full settings panel

**Backend (innomcp-node)**
- WorkspaceService: Innova-workspace file management
- AnalyticsService: Real-time usage tracking
- MDESModelCache: Ollama model list cache
- ThaiNLPService: Thai intent detection + entity extraction
- New API routes: /workspace, /analytics, /mdes/*, /thai/nlp

**PWA & Accessibility**
- manifest.json, PWAInstallPrompt
- ARIALiveRegion, FocusManager, SkipNavigation
- MDESThemeProvider, MDESThemeSwitcher

**Testing**
- 8 unit test files (Jest + @testing-library)
- 3 Playwright E2E specs

**Documentation**
- API Reference, Deployment Guide, Security Guide
- Thai Government Integration Guide, Component Guide

### Changed
- ChatPage.tsx: 3-column Manus layout
- StarterPromptsGrid: 8 prompts + government quick actions
- globals.css: MDES brand tokens + Manus animations

Format: Keep-a-Changelog. Markdown.`},

  // ═══ ADDITIONAL FRONTEND (10 tasks) ══════════════════════════════════════════

  {id:'NEXT_MDES_PROVIDER_CARD', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/settings/ProviderCard.tsx',
   msg:`Create ProviderCard.tsx — provider status card for INNOMCP settings.

Shows a configured AI provider with health status and actions.

\`\`\`ts
interface ProviderInfo {
  id: string; name: string; type: string; baseUrl: string;
  model: string; capabilities: string[]; priority: number;
  enabled: boolean; healthy?: boolean; latencyMs?: number;
  isDefault?: boolean;
}

interface ProviderCardProps {
  provider: ProviderInfo;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  className?: string;
}
\`\`\`

Design:
- Card: border, rounded-lg, subtle bg
- Header: provider icon + name + type badge + default badge if isDefault
- Stats row: model name, capabilities pills (2-3 shown), priority badge
- Health row: status dot + latency ("42ms") + "ทดสอบ" button
- Footer: enable/disable toggle + edit + delete buttons
- Disabled state: muted opacity

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_PROVIDER_LIST', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/settings/ProviderList.tsx',
   msg:`Create ProviderList.tsx — list of configured AI providers for INNOMCP settings.

Displays all saved providers with management actions.

\`\`\`ts
interface ProviderListProps {
  onAddProvider: () => void;
  className?: string;
}
\`\`\`

Fetches from GET /api/ai/providers on mount.

Sections:
1. Header: "ผู้ให้บริการ AI" + "เพิ่มใหม่" button + health check button
2. Default section: MDES Ollama (always shown first, can't be deleted)
3. Custom providers: sorted by priority desc
4. Empty state: "ยังไม่มีผู้ให้บริการเพิ่มเติม" + add button

Features:
- Refresh health status for all providers
- Drag to reorder (priority reordering)
- Bulk enable/disable
- Total provider count badge

Uses ProviderCard component.
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_COMMAND_PALETTE_V2', model:PRO, max:10000,
   out:'innomcp-next/src/app/components/common/MDESCommandPaletteV2.tsx',
   msg:`Create MDESCommandPaletteV2.tsx — enhanced command palette for INNOMCP.

A comprehensive Ctrl+K command palette with full Thai government command set.

\`\`\`ts
interface CommandGroup { id: string; label: string; commands: Command[]; }
interface Command {
  id: string; icon: string; label: string; description?: string;
  keywords: string[]; shortcut?: string;
  action: () => void; disabled?: boolean;
  group: string;
}
\`\`\`

Command groups (Thai labels):
1. 💬 การสนทนา: แชทใหม่, ล้างประวัติ, ส่งออก, ค้นหา
2. 🤖 AI Model: เปลี่ยน model, ดูโมเดล, ทดสอบ MDES
3. 🛠️ เครื่องมือ: เปิด Workspace, ดูสถานะ Provider, Health Check
4. ⚙️ การตั้งค่า: ธีม, ภาษา, ตั้งค่า Provider, Shortcuts
5. 📚 ช่วยเหลือ: Quick Start, API Reference, Keyboard Shortcuts, About

UI:
- Modal (max-w-2xl) with backdrop
- Fuzzy search across all commands
- Group headers with count
- Selected command: indigo highlight
- Keyboard: ↑↓ Enter Esc
- Recent commands history (5 items)

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_TOAST_SYSTEM', model:PRO, max:7000,
   out:'innomcp-next/src/app/components/common/MDESToastSystem.tsx',
   msg:`Create MDESToastSystem.tsx — toast notification system for INNOMCP.

\`\`\`ts
type ToastVariant = 'success'|'error'|'warning'|'info'|'mdes';

interface Toast {
  id: string; variant: ToastVariant; title: string; message?: string;
  duration?: number; action?: { label: string; onClick: () => void; };
}

interface MDESToastSystemProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}
\`\`\`

Design (Manus-style, bottom-right):
- Fixed bottom-right corner
- Stack vertically (newest on top)
- Each toast: icon + title + optional message + dismiss button
- success: green bg + ✅
- error: red bg + ❌
- warning: amber bg + ⚠️
- info: blue bg + ℹ️
- mdes: Thai flag + indigo bg (for MDES-specific notifications)
- Entry: slide-in from right
- Exit: slide-out to right + fade
- Auto-dismiss after duration (default 4s)

Also export: useToastSystem() hook

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_RESPONSIVE_LAYOUT', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/chat/ResponsiveChatLayout.tsx',
   msg:`Create ResponsiveChatLayout.tsx — responsive layout wrapper for INNOMCP Manus-style UI.

Handles breakpoints:
- Mobile (<640px): single column, sidebar = drawer, workspace = full overlay
- Tablet (640-1024px): sidebar + chat, workspace = overlay panel
- Desktop (>1024px): 3-column Manus layout

\`\`\`ts
interface ResponsiveChatLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  workspace?: React.ReactNode;
  header: React.ReactNode;
  isSidebarOpen: boolean;
  isWorkspaceOpen: boolean;
  onSidebarClose: () => void;
  onWorkspaceClose: () => void;
}
\`\`\`

Layout rules:
- Mobile: header (sticky) + main (full width) + sidebar (drawer overlay from left) + workspace (full overlay)
- Tablet: header + split [sidebar | main] + workspace overlay from right
- Desktop: header + [sidebar(fixed 16rem) | main(flex-1) | workspace(380px)]

Transition: smooth width/transform transitions
Overlay: dark backdrop on mobile when sidebar/workspace open

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_CHAT_BUBBLES_WRAPPER', model:PRO, max:9000,
   out:'innomcp-next/src/app/components/chat/MessageThread.tsx',
   msg:`Create MessageThread.tsx — the message list container for INNOMCP chat.

Replaces the inline message rendering in ChatPage with a clean component.

\`\`\`ts
interface MessageThreadProps {
  messages: ChatMessage[];
  isWaitingForResponse: boolean;
  streamStatus: string;
  agentEvents: AgentEvent[];
  typingUsers?: Array<{ name: string; }>;
  onRetry?: (messageId?: string) => void;
  onCopy?: (text: string) => void;
  onFeedback?: (messageId: string, rating: 'good'|'bad') => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  className?: string;
}
\`\`\`

Features:
- Renders message list with ChatTimestamp grouping (Today, Yesterday, etc.)
- Shows MDESStreamIndicator when waiting
- Shows TypingIndicator when typingUsers > 0
- Empty state: passes through to parent (don't render if no messages)
- Auto-scroll to bottom on new messages
- Unread count tracking
- Date separator between messages from different days

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_MODEL_SETTINGS_SIDEBAR', model:PRO, max:8000,
   out:'innomcp-next/src/app/components/settings/ModelSettingsSidebar.tsx',
   msg:`Create ModelSettingsSidebar.tsx — improved model settings for INNOMCP.

Replaces/wraps ModelSettingsPanel.tsx with better UX.

\`\`\`ts
interface ModelSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}
\`\`\`

Sections:
1. MDES Ollama (Primary): health status + model list (live from /api/mdes/models) + model picker
2. เพิ่ม Provider: opens ProviderModal inline
3. Provider List: ProviderList component
4. Connection Test: test button + results

Design: Full-height right slide-in (like ManusWorkspacePanel)
Header: "ตั้งค่า AI Provider" + close button
Navigation: section tabs at top

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_ONBOARDING_FLOW', model:PRO, max:9000,
   out:'innomcp-next/src/app/components/common/MDESOnboarding.tsx',
   msg:`Create MDESOnboarding.tsx — Thai government onboarding flow for INNOMCP.

First-time user experience for government employees.

\`\`\`ts
interface MDESOnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}
\`\`\`

Steps (5 screens):
1. Welcome: "ยินดีต้อนรับสู่ INNOMCP" + MDES logo + Thai government context
2. What is INNOMCP: 3 key benefits with icons (Multi-Agent, Thai-First, 24/7)
3. How to use: Simple 3-step guide (ถาม → AI ทำงาน → รับคำตอบ)
4. Try it now: 3 sample prompts to try (clickable)
5. Ready: "พร้อมใช้งานแล้ว!" + start button

Design:
- Modal overlay (max-w-lg)
- Progress dots at bottom
- Smooth slide transitions between steps
- Skip button on every screen
- Step 4: prompts look like GovernmentQuickActions
- Step 5: confetti-style celebration (CSS only)

Persist completion in localStorage "innomcp.onboarding.done"
"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_USER_AVATAR', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/common/UserAvatar.tsx',
   msg:`Create UserAvatar.tsx — user avatar component for INNOMCP.

\`\`\`ts
interface UserAvatarProps {
  name?: string;      // used for initials
  email?: string;
  imageUrl?: string;
  size?: 'xs'|'sm'|'md'|'lg';
  isGuest?: boolean;
  className?: string;
}
\`\`\`

Design:
- Circle avatar
- If imageUrl: show image
- If no image: initials (first 2 chars of name, or "G" for guest)
- Guest: distinct style (grey + 👤 icon)
- Background: derived from name hash (8 preset colors)
- Size variants: xs=24px sm=32px md=40px lg=48px
- Hover: subtle scale-up
- Accessible: alt text + aria-label

"use client", TypeScript strict, Tailwind.`},

  {id:'NEXT_MDES_KEYBOARD_HELP_PANEL', model:FAST, max:4000,
   out:'innomcp-next/src/app/components/common/KeyboardHelpPanel.tsx',
   msg:`Create KeyboardHelpPanel.tsx — keyboard shortcuts help panel for INNOMCP.

\`\`\`ts
interface KeyboardHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
\`\`\`

Shows all keyboard shortcuts in a clean modal:

Section: การสนทนา
- Enter: ส่งข้อความ
- Shift+Enter: ขึ้นบรรทัดใหม่
- Escape: หยุด AI
- ?: เปิด Help (เมื่อ input ว่าง)

Section: การนำทาง
- Ctrl+K: Command Palette
- Ctrl+/: คีย์ลัดทั้งหมด
- Ctrl+N: แชทใหม่
- Ctrl+B: เปิด/ปิด Sidebar

Section: Workspace
- Ctrl+W: เปิด/ปิด Workspace
- Ctrl+E: Export

Design: modal, 2-column layout, kbd-style key badges
"use client", TypeScript strict, Tailwind.`},
];

async function runWave8() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🔥 WAVE 8 — BACKEND SERVICES + FINAL FRONTEND               ║');
  console.log(`║  ${TASKS.length} tasks | deepseek-v4-pro | BURN QUOTA                    ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const start=Date.now(); let totalTok=0, ok=0, fail=0; const failed=[];

  await Promise.allSettled(TASKS.map(async (t) => {
    const r=await cc(t.id,t.model,SYS,t.msg,t.max);
    totalTok+=r.tokens||0;
    if(r.ok){
      writeFile(t.out,extract(r.reply),t.baseDir);
      process.stdout.write(`  ✅ ${t.id.padEnd(32)} ${r.ms}ms | ${r.tokens}tok\n`);
      ok++;
    } else {
      process.stdout.write(`  ❌ ${t.id.padEnd(32)} ERR: ${r.error?.slice(0,60)}\n`);
      fail++; failed.push(t.id);
    }
  }));

  console.log('\n🔍 tsc check...\n');
  let tscPass=false;
  try {
    execSync('npx tsc --noEmit 2>&1',{cwd:`${ROOT.replace(/\//g,path.sep)}\\innomcp-next`,stdio:'inherit',timeout:120000});
    tscPass=true; console.log('  ✅ tsc PASS');
  } catch { console.log('  ⚠️  tsc issues'); }

  const elapsed=((Date.now()-start)/1000).toFixed(1);
  console.log(`\n🏁 Wave 8: ${ok}/${TASKS.length} ✅ | ~${totalTok.toLocaleString()}tok (4x=~${(totalTok*4).toLocaleString()}) | ${elapsed}s | tsc:${tscPass?'✅':'⚠️'}`);
  if(failed.length) console.log(`   Failed: ${failed.join(', ')}`);
}

runWave8().catch(e=>{console.error('FATAL:',e);process.exit(1);});
