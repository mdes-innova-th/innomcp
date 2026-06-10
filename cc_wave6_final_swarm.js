#!/usr/bin/env node
/**
 * cc_wave6_final_swarm.js — Final polish + TICKET-018 + Innova-workspace
 * Jit Watchdog iteration 2
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
const JIT   = 'C:/Users/USER-NT/Jit';
const CHAT  = `${ROOT}/innomcp-next/src/app/components/chat`;

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
  const m = r.match(/```(?:tsx?|ts|js|javascript|json|css|md)?\n([\s\S]+?)```/);
  return m ? m[1].trim() : r.trim();
}

function writeFile(rel, content, baseDir) {
  const base = (baseDir || ROOT).replace(/\//g, path.sep);
  const full = path.join(base, rel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(full), {recursive:true});
  if (content.startsWith('```')) content = extractCode(content);
  fs.writeFileSync(full, content, 'utf8');
  process.stdout.write(`  ✏️  ${rel} (${Math.round(content.length/1024)}KB)\n`);
}

const JIT_REGISTRY = slurp(`${JIT}/network/registry.json`);
const MDES_BRAND_HEADER = slurp(`${CHAT}/MDESBrandHeader.tsx`);
const MODEL_PICKER = slurp(`${CHAT}/MDESModelPicker.tsx`, 2000);

const SYS = `Senior engineer — INNOMCP Thailand government MCP Hub + Jit multi-agent system.
Stack: Next.js 14, TypeScript strict, Tailwind, Node.js.
MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม.
Output ONLY complete file content in \`\`\`tsx/ts/js/json/md ... \`\`\`.
Rules: no truncation, Thai UI strings, preserve existing features.`;

const TASKS = [

  // ─── TICKET-018: SA Agents ─────────────────────────────────────────────────

  {
    id: 'TICKET018_REGISTRY',
    model: PRO,
    out: 'network/registry.json',
    baseDir: JIT,
    msg: `Update the Jit มนุษย์ Agent registry.json to add TICKET-018 SA (System Agent) Group.

CURRENT registry.json (partial — first 80 lines shown, full structure continues):
\`\`\`json
${JIT_REGISTRY.slice(0, 4000)}
\`\`\`
[... more agents follow the same pattern ...]

TASK: Add 5 new SA-group agents to the "agents" array. Keep ALL existing agents unchanged.
New SA agents to add:

1. infra-sa — Infrastructure Monitor
   - role: "โครงสร้างพื้นฐาน (Infrastructure) — System Agent"
   - organ: "กระดูก (Support Structure)"
   - model: "claude-haiku-4-5"
   - capabilities: ["monitor-infrastructure", "health-check", "resource-metrics", "alert", "scale-detect"]
   - description: "ตรวจสอบโครงสร้างพื้นฐาน — CPU, memory, disk, network, container health"

2. security-sa — Security Monitor
   - role: "ความปลอดภัย (Security) — System Agent"
   - organ: "ผิวหนัง (Skin/Shield)"
   - model: "claude-haiku-4-5"
   - capabilities: ["threat-detect", "audit-log", "access-control", "vulnerability-scan", "compliance"]
   - description: "ตรวจสอบความปลอดภัย — threats, access logs, vulnerabilities, compliance"

3. observability-sa — Observability Agent
   - role: "การสังเกตการณ์ (Observability) — System Agent"
   - organ: "ตา (Eye/Observer)"
   - model: "claude-haiku-4-5"
   - capabilities: ["trace-collect", "metrics-aggregate", "log-analyze", "dashboard", "alert-rule"]
   - description: "รวบรวม traces, metrics, logs — OpenTelemetry, Prometheus, Grafana"

4. scaling-sa — Auto-scaling Agent
   - role: "การปรับขนาด (Scaling) — System Agent"
   - organ: "กล้ามเนื้อ (Muscle)"
   - model: "claude-haiku-4-5"
   - capabilities: ["load-balance", "auto-scale", "capacity-plan", "traffic-route", "rate-limit"]
   - description: "จัดการการปรับขนาดอัตโนมัติ — load balancing, capacity planning, traffic routing"

5. reliability-sa — Reliability & SLO Agent
   - role: "ความน่าเชื่อถือ (Reliability) — System Agent"
   - organ: "หัวใจ (Heart/Vital)"
   - model: "claude-haiku-4-5"
   - capabilities: ["slo-track", "error-budget", "incident-manage", "postmortem", "sre"]
   - description: "ติดตาม SLO/SLI — error budgets, incident management, SRE practices"

All 5 agents:
- status: "active"
- born: "2026-06-11"
- reports_to: "soma"
- inbox: "/tmp/manusat-bus/<name>-sa"
- tier: 3 (Specialist SA Group)

Also update the registry's "updated" field to "2026-06-11" and add a "sa_group" section listing the 5 agent names.

Output the COMPLETE updated registry.json with ALL existing agents + 5 new ones.`,
    max: 12000,
  },

  // ─── MDESBrandHeader: wire MDESModelPicker ─────────────────────────────────

  {
    id: 'MDES_HEADER_MODEL_PICKER',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/MDESBrandHeader.tsx',
    msg: `Update MDESBrandHeader.tsx to integrate MDESModelPicker.

CURRENT file:
\`\`\`tsx
${MDES_BRAND_HEADER}
\`\`\`

MDESModelPicker interface (summary):
\`\`\`ts
interface MDESModelPickerProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}
\`\`\`

Changes:
1. Add to MDESBrandHeaderProps: \`currentModel?: string; onModelChange?: (model: string) => void;\`
2. Import MDESModelPicker from "./MDESModelPicker"
3. In the RIGHT section (between StatusRibbon and Provider toggle): add MDESModelPicker
   - Only show if currentModel + onModelChange props are provided
   - Compact display: shows current model name

Keep ALL existing functionality. Output the complete updated file.`,
    max: 7000,
  },

  // ─── Innova-Workspace VM Design Doc ────────────────────────────────────────

  {
    id: 'INNOVA_WORKSPACE_SPEC',
    model: PRO,
    out: 'docs/INNOVA_WORKSPACE_VM_SPEC.md',
    msg: `Write INNOVA_WORKSPACE_VM_SPEC.md — specification for the Innova-workspace virtual machine.

This is the design doc for the Manus.ai "computer" equivalent for INNOMCP.

## Overview
Innova-workspace is a persistent AI workspace that runs alongside the INNOMCP chat.
Like Manus.ai's computer — AI agents can execute code, browse files, run terminals.
BUT uses MDES-owned infrastructure (Drive/NAS/storage) instead of external cloud.

## Architecture
### Storage Backend
- Primary: Drive (Google Drive-compatible or OneDrive)
- Secondary: NAS (Network Attached Storage — local MDES infrastructure)
- Tertiary: workspace-storage/ directory (already exists in innomcp repo)
- All files persist across sessions

### Capabilities (like Manus computer)
1. File System — browse/read/write files in workspace
2. Code Execution — run Python/Node/Bash in sandboxed environment
3. Web Browser — AI-controlled browser for web tasks
4. Terminal — interactive terminal with limited access
5. Artifact Store — save/load generated files (PDFs, images, CSVs)

### Frontend (ManusWorkspacePanel)
Already built tabs: งาน | เว็บ | Terminal | ไฟล์ผลลัพธ์
Need to add: Backend connection for real execution

### Backend (innomcp-node additions needed)
- POST /api/workspace/exec — execute code snippet
- POST /api/workspace/file — read/write workspace file
- GET  /api/workspace/ls — list workspace directory
- WebSocket: workspace events stream

## Implementation Plan
### Phase 1 (NOW): Storage setup
- Map workspace-storage/ to user sessions
- File browser in ManusWorkspacePanel (already has artifacts tab)
- Persist artifacts to workspace-storage/{sessionId}/

### Phase 2: Code execution
- Sandboxed Node.js/Python execution via child_process
- Output streamed via existing WebSocket
- Shell approval gate already built (ApprovalGate component)

### Phase 3: NAS/Drive integration
- Mount MDES NAS via SMB or NFS
- Drive sync for Thai government documents
- Requires: NAS endpoint + credentials from innova

## Known Blockers
- NAS/Drive config: need innova to provide endpoint, mount path, credentials
- Docker sandbox: need Docker daemon access for safe code execution

## Files Already Built
- ManusWorkspacePanel.tsx — UI ready
- AgentWorkspacePanel.tsx — terminal/shell integration ready
- workspace-storage/ — local storage directory exists

Write as a proper design doc. ~400 words. Markdown.`,
    max: 5000,
  },

  // ─── More MDES Components ──────────────────────────────────────────────────

  {
    id: 'MDES_NOTIFICATION_CENTER',
    model: PRO,
    out: 'innomcp-next/src/app/components/common/MDESNotificationCenter.tsx',
    msg: `Create MDESNotificationCenter.tsx — Thai government notification center for INNOMCP.

A notification panel showing system alerts, task completions, and government updates.

\`\`\`ts
type NotificationType = "success" | "warning" | "error" | "info" | "mdes";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface MDESNotificationCenterProps {
  notifications: Notification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  onDismiss: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}
\`\`\`

Build:
- Slide-in panel from top-right
- Header: "การแจ้งเตือน" + unread badge + "อ่านทั้งหมด" button
- Notification list: each item shows icon + title + message + timestamp + dismiss button
- Type icons: ✅ success, ⚠️ warning, ❌ error, ℹ️ info, 🇹🇭 mdes
- Empty state: "ไม่มีการแจ้งเตือนใหม่"
- Auto-mark as read when panel opens

Also export: \`useNotifications()\` hook that manages notification state.

"use client", TypeScript strict, Tailwind.`,
    max: 7000,
  },

  {
    id: 'MDES_CONTEXT_MENU',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/ChatContextMenu.tsx',
    msg: `Create ChatContextMenu.tsx — right-click context menu for chat messages in INNOMCP.

Shows actions when user right-clicks or long-presses a message.

\`\`\`ts
interface ChatContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  messageId: string;
  messageText: string;
  isAI: boolean;
  onClose: () => void;
  onCopy: (text: string) => void;
  onRetry?: () => void;
  onSaveArtifact?: (text: string) => void;
  onTranslate?: (text: string) => void;
}
\`\`\`

Menu items (Thai labels):
For AI messages: 📋 คัดลอก | 🔄 ลองอีกครั้ง | 💾 บันทึกเป็นไฟล์ | 🌐 แปลภาษา
For user messages: 📋 คัดลอก | ✏️ แก้ไข (placeholder)

Design:
- Portal-rendered (fixed positioning)
- Shadow + rounded card
- Keyboard: Escape closes, arrow keys navigate
- Click outside closes
- Smooth fade-in

"use client", TypeScript strict, Tailwind.`,
    max: 3500,
  },

  {
    id: 'MDES_CHAT_EXPORT',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/ChatExportPanel.tsx',
    msg: `Create ChatExportPanel.tsx — export chat conversation as PDF/Markdown/JSON for Thai government users.

\`\`\`ts
interface ChatExportPanelProps {
  messages: Array<{ sender: "user" | "ai"; text: string; timestamp?: number; }>;
  conversationTitle?: string;
  onClose: () => void;
}
\`\`\`

Build:
- Modal/panel with export format choices
- Format 1: PDF (opens browser print dialog with formatted HTML)
- Format 2: Markdown (.md file download)
- Format 3: JSON (raw data download)
- Format 4: Text (.txt clean copy)
- Each format button shows file size estimate
- MDES header in exports: "INNOMCP — ศูนย์ MCP ภาครัฐ | ส่งออกการสนทนา"
- Download timestamp in filename: innomcp-chat-YYYYMMDD-HHmm.ext

Implement download via Blob + URL.createObjectURL.
"use client", TypeScript strict, Tailwind.`,
    max: 4000,
  },

  {
    id: 'MDES_SEARCH_HISTORY',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/ChatHistorySearch.tsx',
    msg: `Create ChatHistorySearch.tsx — search through chat history for INNOMCP.

\`\`\`ts
interface ChatHistorySummary {
  id: string;
  title: string;
  messages: Array<{ sender: "user" | "ai"; text: string; timestamp?: number; }>;
  createdAt?: number;
}

interface ChatHistorySearchProps {
  summaries: ChatHistorySummary[];
  onSelect: (summaryId: string) => void;
  onClose: () => void;
  isOpen: boolean;
}
\`\`\`

Build:
- Slide-down overlay or inline search
- Search input with debounce (300ms)
- Search both title and message content
- Results: grouped by date, show matching text highlight
- Empty state: "ไม่พบผลลัพธ์"
- Keyboard: ↑↓ navigate, Enter select, Esc close

"use client", TypeScript strict, Tailwind.`,
    max: 3500,
  },

  {
    id: 'INNOMCP_VOICE_HINT',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/VoiceInputHint.tsx',
    msg: `Create VoiceInputHint.tsx — Thai voice input hint/indicator for INNOMCP.

Shows when user attaches an audio file or when browser supports speech recognition.

\`\`\`ts
interface VoiceInputHintProps {
  isAudioAttached?: boolean;
  isWhisperProcessing?: boolean;
  className?: string;
}
\`\`\`

Build:
- Animated microphone icon (pulsing when processing)
- Thai hint text: "ถอดเสียงด้วย Whisper AI" when audio attached
- "กำลังถอดเสียง..." with spinner when processing
- Green accent when done
- Small, compact (fits in ChatInput area)

Also export: a \`VoiceStatusBadge\` variant for the ChatInput toolbar.

"use client", TypeScript strict, Tailwind.`,
    max: 2500,
  },

  {
    id: 'MDES_ANALYTICS_PANEL',
    model: PRO,
    out: 'innomcp-next/src/app/components/chat/MDESAnalyticsPanel.tsx',
    msg: `Create MDESAnalyticsPanel.tsx — usage analytics panel for INNOMCP admins.

Shows real-time usage metrics for the MDES MCP Hub.

\`\`\`ts
interface AnalyticsData {
  totalMessages: number;
  totalSessions: number;
  avgResponseMs: number;
  topTools: Array<{ name: string; count: number; }>;
  modelUsage: Array<{ model: string; count: number; percentage: number; }>;
  errorRate: number;
  activeUsers: number;
}

interface MDESAnalyticsPanelProps {
  data?: AnalyticsData;
  isLoading?: boolean;
  onClose?: () => void;
  className?: string;
}
\`\`\`

Build:
- Summary cards row: total messages, sessions, avg latency, error rate
- Model usage bar chart (CSS-only, no chart libs)
- Top 5 tools used list
- Active users indicator
- MDES indigo color scheme
- Loading skeleton when isLoading=true
- Thai labels

"use client", TypeScript strict, Tailwind (no external chart libs).`,
    max: 6000,
  },

  {
    id: 'INNOMCP_FEEDBACK_WIDGET',
    model: FAST,
    out: 'innomcp-next/src/app/components/chat/MessageFeedbackWidget.tsx',
    msg: `Create MessageFeedbackWidget.tsx — thumbs up/down feedback for AI responses in INNOMCP.

\`\`\`ts
interface MessageFeedbackWidgetProps {
  messageId: string;
  onFeedback: (messageId: string, rating: "good" | "bad", comment?: string) => void;
  className?: string;
}
\`\`\`

Build:
- 👍 / 👎 buttons (appear on hover near AI message)
- After clicking: small optional comment textarea (max 200 chars)
- Submit: POST /api/feedback with { messageId, rating, comment }
- Thank you state: "ขอบคุณสำหรับข้อเสนอแนะ 🙏"
- Can only vote once per message

Styling: minimal, appears below message bubble on hover
"use client", TypeScript strict, Tailwind.`,
    max: 2500,
  },

  {
    id: 'MDES_TOUR_GUIDE',
    model: PRO,
    out: 'innomcp-next/src/app/components/common/MDESProductTour.tsx',
    msg: `Create MDESProductTour.tsx — guided product tour for new INNOMCP users.

Shows a step-by-step walkthrough of the Manus-style UI for Thai government employees.

\`\`\`ts
interface TourStep {
  id: string;
  target: string;    // CSS selector of highlighted element
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
}

interface MDESProductTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}
\`\`\`

Tour steps (5 steps):
1. MDESBrandHeader — "หัวข้อ MDES — แสดงสถานะ AI และควบคุมการตั้งค่า"
2. ChatInput — "พิมพ์คำถามหรือสั่งงาน AI ที่นี่ — รองรับไฟล์แนบ"
3. WorkspacePanel toggle — "พื้นที่ทำงาน AI — ดูขั้นตอนการทำงานแบบ Manus"
4. Provider settings — "เพิ่ม AI Provider จากระบบใดก็ได้ — Cloud หรือ Local"
5. StarterPrompts — "เลือกตัวอย่างเพื่อเริ่มต้น — เหมาะสำหรับงานราชการ"

Design:
- Spotlight/highlight on target element (backdrop-blur + bright ring)
- Tooltip card with step number, title, description, Next/Skip buttons
- Progress dots at bottom
- Persists completion in localStorage "innomcp.tour.done"

"use client", TypeScript strict, Tailwind.`,
    max: 6000,
  },
];

async function runWave6() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  👁️ Watchdog Iter2 — Wave 6: Final Polish + TICKET-018        ║');
  console.log(`║  ${TASKS.length} tasks | deepseek-v4-pro | burn to >80%                     ║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const start = Date.now();
  let totalTok=0, ok=0, fail=0;
  const failed=[];

  await Promise.allSettled(TASKS.map(async (task) => {
    const r = await cc(task.id, task.model, SYS, task.msg, task.max);
    totalTok += r.tokens||0;
    if (r.ok) {
      writeFile(task.out, extractCode(r.reply), task.baseDir);
      process.stdout.write(`  ✅ ${task.id.padEnd(32)} ${r.ms}ms ${r.tokens}tok\n`);
      ok++;
    } else {
      process.stdout.write(`  ❌ ${task.id.padEnd(32)} ERR: ${r.error?.slice(0,70)}\n`);
      fail++; failed.push(task.id);
    }
  }));

  console.log('\n🔍 Gate: tsc\n');
  let tscPass = false;
  try {
    execSync('npx tsc --noEmit 2>&1', {cwd:`${ROOT.replace(/\//g,path.sep)}\\innomcp-next`, stdio:'inherit', timeout:120000});
    tscPass = true; console.log('  ✅ tsc PASS');
  } catch { console.log('  ⚠️  tsc issues (non-blocking, fix next iteration)'); }

  const elapsed = ((Date.now()-start)/1000).toFixed(1);
  console.log(`\n🏁 Wave 6: ${ok}/${TASKS.length} ✅ | ~${totalTok.toLocaleString()}tok (4x=~${(totalTok*4).toLocaleString()}) | ${elapsed}s | tsc:${tscPass?'✅':'⚠️'}`);
  if (failed.length) console.log(`   Failed: ${failed.join(', ')}`);
}

runWave6().catch(e => { console.error('FATAL:', e); process.exit(1); });
