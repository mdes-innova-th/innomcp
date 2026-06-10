#!/usr/bin/env node
/**
 * cc_chat_manus_swarm.js — Manus.ai-style Chat Page Redesign
 * Plan: Fable 5 (architect) | Workers: CODECOMMAND deepseek-v4-pro (heavy) | Gate: tsc
 *
 * Wave 1 (parallel): New standalone components
 * Wave 2 (parallel): Append-only updates (CSS tokens, StarterPrompts polish)
 * Wave 3 (done by Claude Code manually): ChatPage.tsx 3-column integration
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CC_KEY  = process.env.CC_KEY  || 'user_63PeUo3er88esBvYN2hjW7PqJwtvKeXFCHKUVcwyisVaE13Y1xR9RyGPvHjZbUqqG2CCH3A4gP6JHncr7RW5qwwb';
const CC_BASE = 'https://api.commandcode.ai/provider/v1';
const PRO     = 'deepseek/deepseek-v4-pro';   // 4x credit stretch — use for complex components
const FAST    = 'deepseek/deepseek-v4-flash';  // quick tasks

const ROOT   = 'C:/Users/USER-NT/DEV/innomcp';
const CHAT   = `${ROOT}/innomcp-next/src/app/components/chat`;
const STYLES = `${ROOT}/innomcp-next/src/app/styles`;

function slurp(fp, maxChars = 999999) {
  try { return fs.readFileSync(fp, 'utf8').replace(/^﻿/, '').slice(0, maxChars); }
  catch { return `[NOT FOUND: ${fp}]`; }
}

async function cc(taskId, model, systemPrompt, userMsg, maxTokens = 8000) {
  const t0 = Date.now();
  try {
    const resp = await fetch(`${CC_BASE}/chat/completions`, {
      method : 'POST',
      headers: { 'Authorization': `Bearer ${CC_KEY}`, 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        model,
        messages   : [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens : maxTokens,
        temperature: 0.1,
        stream     : false,
      }),
      signal: AbortSignal.timeout(300000),
    });
    const j      = await resp.json();
    const ms     = Date.now() - t0;
    const reply  = j.choices?.[0]?.message?.content || '';
    const tokens = j.usage?.total_tokens || 0;
    if (!reply) return { taskId, ok: false, ms, tokens, error: JSON.stringify(j).slice(0, 300) };
    return { taskId, ok: true, ms, tokens, reply };
  } catch(e) {
    return { taskId, ok: false, ms: Date.now() - t0, tokens: 0, error: e.message };
  }
}

function extractCode(reply) {
  const m = reply.match(/```(?:tsx?|css|javascript|js)?\n([\s\S]+?)```/);
  return m ? m[1].trim() : reply.trim();
}

function writeFile(relPath, content) {
  const full = path.join(ROOT.replace(/\//g, path.sep), relPath.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log(`  ✏️  Written → ${relPath} (${Math.round(content.length / 1024)}KB)`);
}

// ─── Read source files ─────────────────────────────────────────────────────────
const AGENT_WS   = slurp(`${CHAT}/AgentWorkspacePanel.tsx`);
const MULTI_AGENT= slurp(`${CHAT}/MultiAgentPanel.tsx`);
const STARTER_GRID = slurp(`${CHAT}/StarterPromptsGrid.tsx`);
const AGENT_TLINE  = slurp(`${CHAT}/AgentActivityTimeline.tsx`);
const CHAT_PAGE    = slurp(`${CHAT}/ChatPage.tsx`, 90000); // partial for context only
const GLOBALS_CSS  = slurp(`${STYLES}/globals.css`, 30000);

const SYS = `You are a senior TypeScript/React engineer building INNOMCP — Thailand's government MCP Hub by MDES.

INNOMCP vision: Work like Manus.ai (https://manus.ai/) — persistent workspace, multi-agent AI, 24/7 via MDES Ollama (unlimited Thai government cloud).

Rules:
1. Output ONLY the complete file content wrapped in \`\`\`tsx ... \`\`\` (or \`\`\`css\`\`\` for styles)
2. PRESERVE all existing functionality — additive extraction only, not a rewrite
3. Thai language for ALL user-facing strings
4. Stack: Next.js 14 App Router, TypeScript strict, Tailwind CSS, shadcn/ui conventions
5. MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (primary brand — always prominent)
6. No "// ... rest of code" truncation — output the COMPLETE file every time`;

// ─── Wave 1 Tasks ──────────────────────────────────────────────────────────────

const WAVE1 = [
  {
    id  : 'STATUS_RIBBON_STANDALONE',
    model: PRO,
    out : 'innomcp-next/src/app/components/chat/StatusRibbon.tsx',
    msg : `Create StatusRibbon.tsx as a standalone "use client" component.

Extract and enhance from this inline definition in ChatPage.tsx:
\`\`\`tsx
const StatusRibbon: React.FC<{
  isSocketReady: boolean;
  isWaitingForResponse: boolean;
  streamStatus: string;
}> = ({ isSocketReady, isWaitingForResponse, streamStatus }) => {
  const isStreaming = streamStatus === "streaming";
  if (!isSocketReady) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-[11.5px] font-medium text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        <span>ออฟไลน์</span>
      </div>
    );
  }
  if (isWaitingForResponse || isStreaming) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
        <span>กำลังประมวลผล</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      <span>พร้อมใช้งาน</span>
    </div>
  );
};
\`\`\`

Enhancements for the standalone version:
1. Add optional agentCount?: number prop — when processing, show "MDES กำลังวิเคราะห์ {N} ส่วน"
2. Add optional activeModels?: string[] — show a compact model badge (e.g. "gemma4:26b")
3. When streaming, add a smooth progress shimmer animation
4. Use MDES brand color for the active/processing state (indigo-600 for MDES identity)
5. Export as default`,
    max: 2500,
  },

  {
    id  : 'MANUS_WORKSPACE_PANEL',
    model: PRO,
    out : 'innomcp-next/src/app/components/chat/ManusWorkspacePanel.tsx',
    msg : `Create ManusWorkspacePanel.tsx — Manus.ai-style right-side workspace panel for INNOMCP.

Reference how Manus.ai right panel works: tabs switching between agent steps, browser output, terminal, artifacts.

Props interface:
\`\`\`ts
interface ManusWorkspacePanelProps {
  events: AgentEvent[];          // from useAgentEventStream
  artifacts: Artifact[];         // generated files
  isStreaming: boolean;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}
\`\`\`

AgentEvent type:
\`\`\`ts
interface AgentEvent {
  id: string;
  type: string;
  agentName?: string;
  modelName?: string;
  publicSummary?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  elapsed?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
\`\`\`

Artifact type:
\`\`\`ts
interface Artifact {
  id: string;
  name: string;
  type: string;
  content: string;
  createdAt: number;
}
\`\`\`

Build 4 tabs:
TAB 1 "🤖 งาน" — Agent Steps (active by default when streaming):
- Linear step list, Manus.ai style
- Each step: {icon} {label} · {model} · {duration}ms
- Active step: pulsing amber dot
- Done step: green checkmark
- Map event types to Thai labels: route_selected→"วิเคราะห์คำถาม", agent_started→"เริ่ม Agent", tool_call_started→"เรียกใช้เครื่องมือ", final_answer→"สรุปคำตอบ"

TAB 2 "🌐 เว็บ" — Web results panel:
- Show web_search and browser tool results from events
- If no web events, show empty state: "ยังไม่มีผลการค้นหาเว็บ"

TAB 3 "💻 Terminal" — Shell output:
- Show shell/exec/bash tool results from events
- Code block styling, dark background
- If no terminal events, show empty state

TAB 4 "📁 ไฟล์ผลลัพธ์" — Artifacts:
- List of artifacts with name, type icon, created time
- Download button for each
- If no artifacts, show "ยังไม่มีไฟล์ผลลัพธ์"

Panel design:
- Header: "MDES Workspace" + tab switcher + close button
- body: scrollable per tab
- Dark surface: bg-slate-900/95 dark, bg-white/98 light
- Subtle right border
- Smooth tab transition
- Auto-switch to "งาน" tab when events start streaming

Imports to use:
- "use client"
- React useState useEffect
- No external icon library needed (use emoji or simple SVG inline)`,
    max: 10000,
  },

  {
    id  : 'MDES_BRAND_HEADER',
    model: PRO,
    out : 'innomcp-next/src/app/components/chat/MDESBrandHeader.tsx',
    msg : `Create MDESBrandHeader.tsx — MDES government branding header for INNOMCP.

MDES context:
- MDES = กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (Ministry of Digital Economy and Society)
- INNOMCP = ศูนย์ MCP ภาครัฐ — Thailand's government AI MCP Hub
- Primary AI: MDES Ollama (gemma4:26b + all models), 24/7, unlimited via government cloud

Props:
\`\`\`ts
interface MDESBrandHeaderProps {
  isSocketReady: boolean;
  isWaitingForResponse: boolean;
  streamStatus: string;
  agentCount?: number;
  activeModels?: string[];
  providerMode: "remote" | "local";
  onProviderModeChange: (mode: "remote" | "local") => void;
  onToggleWorkspace?: () => void;   // open/close right workspace panel
  workspaceOpen?: boolean;
  onToggleMultiAgent?: () => void;  // open/close multiagent panel
  conversationTitle?: string;
}
\`\`\`

Import StatusRibbon from "./StatusRibbon"

Layout (horizontal bar, full width, sticky top):
LEFT: 🇹🇭 MDES logo text + "INNOMCP" title + "ศูนย์ MCP ภาครัฐ" subtitle (small)
CENTER: Conversation title (current chat name, truncated)
RIGHT: [StatusRibbon] [Provider toggle: ☁️ Cloud | 💻 Local] [Agent panel button] [Workspace button]

Style:
- Height: h-12
- Background: bg-background/95 backdrop-blur-sm
- Bottom border: border-b border-border/60
- MDES flag/logo: Thai blue (#1a3c6e) for brand identity
- Responsive: hide subtitle and some buttons on mobile`,
    max: 4000,
  },

  {
    id  : 'COLLAPSIBLE_AGENT_WRAPPER',
    model: PRO,
    out : 'innomcp-next/src/app/components/chat/CollapsibleAgentWrapper.tsx',
    msg : `Create CollapsibleAgentWrapper.tsx — wraps MultiAgentPanel to make it collapsible by default.

This is an additive wrapper — do NOT modify MultiAgentPanel.tsx.

MultiAgentPanel props (for reference):
- events: AgentEvent[]
- isStreaming: boolean
- expandAll?: boolean
- runId?: string
- onApprovalRequired?: (payload: ApprovalRequiredPayload) => void
- onApprovalConfirmed?: (approvalId: string) => void

Create CollapsibleAgentWrapper that:
1. Starts COLLAPSED by default
2. Header row: "{activeAgentCount} agents · {latestModel}" + chevron button + "ดูรายละเอียด" text
3. When collapsed: shows only the summary header (compact, ~40px tall)
4. When expanded: shows full MultiAgentPanel below the header
5. Header animates: pulsing dot when isStreaming, green check when done
6. Summary text when done: "ประมวลผลเสร็จแล้ว · {totalAgents} agents · {elapsed}s"
7. Smooth CSS max-height transition for expand/collapse

Forward all MultiAgentPanel props through. Export as default.

Import MultiAgentPanel from "./MultiAgentPanel"`,
    max: 4000,
  },
];

// ─── Wave 2 Tasks ──────────────────────────────────────────────────────────────

const WAVE2 = [
  {
    id  : 'GLOBALS_MDES_TOKENS',
    model: FAST,
    out : 'innomcp-next/src/app/styles/globals.css',
    appendOnly: true,  // flag: append to existing, don't overwrite
    msg : `Generate ONLY the new CSS additions for INNOMCP Manus-style redesign.
Do NOT output the full globals.css — output ONLY the new blocks to append.

Output a CSS block (wrapped in \`\`\`css ... \`\`\`) with:

1. MDES brand variables (in :root and .dark):
\`\`\`
/* MDES Brand */
--mdes-primary: #1a3c6e;        /* Thai government blue */
--mdes-primary-light: #2d5a9e;
--mdes-accent: #c8973e;         /* Thai gold */
--mdes-accent-light: #e8b85e;
\`\`\`

2. Manus workspace panel variables:
\`\`\`
/* Manus Workspace */
--manus-panel-bg: oklch(0.12 0 0 / 0.97);
--manus-panel-border: oklch(0.25 0 0 / 0.4);
--manus-step-active: #f59e0b;   /* amber — active agent */
--manus-step-done: #10b981;     /* emerald — completed */
\`\`\`

3. Animation for workspace panel slide-in:
\`\`\`css
@keyframes manus-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.manus-panel-enter { animation: manus-slide-in 0.25s ease-out; }
\`\`\`

4. Collapsible agent panel transition:
\`\`\`css
.agent-panel-collapse { overflow: hidden; transition: max-height 0.3s ease-in-out; }
\`\`\`

5. MDES shimmer for processing state:
\`\`\`css
@keyframes mdes-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.mdes-processing-shimmer {
  background: linear-gradient(90deg, transparent 0%, var(--mdes-primary-light) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: mdes-shimmer 2s linear infinite;
}
\`\`\``,
    max: 2000,
  },
];

// ─── Swarm runner ──────────────────────────────────────────────────────────────

async function runSwarm() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  INNOMCP Manus-style Redesign — CODECOMMAND Swarm           ║');
  console.log('║  Plan: Fable5 (architect) | Workers: deepseek-v4-pro        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const start  = Date.now();
  let totalTok = 0;
  const failed = [];

  // Helper: run + apply result
  async function runTask(task) {
    const r = await cc(task.id, task.model, SYS, task.msg, task.max);
    totalTok += r.tokens || 0;
    if (r.ok) {
      const code = extractCode(r.reply);
      if (task.appendOnly) {
        // Append-only: prepend a section marker + append to end
        const existing = slurp(path.join(ROOT.replace(/\//g, path.sep), task.out.replace(/\//g, path.sep)));
        const separator = '\n\n/* ── MDES/Manus additions (cc_chat_manus_swarm) ── */\n';
        writeFile(task.out, existing + separator + code);
      } else {
        writeFile(task.out, code);
      }
      console.log(`  ✅ ${task.id} | ${r.ms}ms | ${r.tokens}tok`);
      return true;
    } else {
      console.log(`  ❌ ${task.id} | ERR: ${r.error}`);
      failed.push(task.id);
      return false;
    }
  }

  // ── Wave 1: parallel ──────────────────────────────────────────
  console.log('⚡ WAVE 1 — New isolated components (parallel)\n');
  await Promise.allSettled(WAVE1.map(t => runTask(t)));

  // ── Wave 2: parallel ──────────────────────────────────────────
  console.log('\n⚡ WAVE 2 — Append-only style updates (parallel)\n');
  await Promise.allSettled(WAVE2.map(t => runTask(t)));

  // ── Phase gate: tsc ───────────────────────────────────────────
  console.log('\n🔍 PHASE GATE — TypeScript compilation\n');
  let tscPass = false;
  try {
    execSync('pnpm --filter innomcp-next exec tsc --noEmit 2>&1', {
      cwd    : ROOT.replace(/\//g, path.sep),
      stdio  : 'inherit',
      timeout: 120000,
    });
    tscPass = true;
    console.log('  ✅ tsc: PASS');
  } catch {
    console.log('  ❌ tsc: FAIL — TypeScript errors above');
  }

  // ── Summary ───────────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SWARM COMPLETE                                              ║');
  console.log(`║  Tokens: ~${totalTok.toLocaleString().padEnd(8)} (4x stretch → ~${(totalTok*4).toLocaleString().padEnd(8)}) ║`);
  console.log(`║  Time:   ${elapsed}s`.padEnd(65) + '║');
  console.log(`║  tsc:    ${tscPass ? '✅ PASS' : '❌ FAIL (fix errors, rerun)'}`.padEnd(65) + '║');
  console.log(`║  Failed: ${failed.length === 0 ? 'none' : failed.join(', ')}`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (tscPass) {
    console.log('\n🎯 Wave 1+2 done. Wave 3 (ChatPage integration) → Claude Code will apply manually.');
    console.log('   Next: git add + commit → run smoke tests → check UI');
  } else {
    console.log('\n⚠️  Fix tsc errors first, then run Wave 3 integration.');
  }
}

runSwarm().catch(e => { console.error('FATAL:', e); process.exit(1); });
