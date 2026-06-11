#!/usr/bin/env node
/**
 * cc_auto_swarm-mdes-hooks.js — MDES React Hooks swarm
 * Generates 10 TypeScript React hooks for innomcp-next
 */
'use strict';

const { cc, runTasks, writeFile, extract, FAST } = require('./cc_lib_swarm');

const ROOT = 'C:/Users/USER-NT/DEV/innomcp';
const OUT_DIR = 'innomcp-next/src/app/hooks';
const MODEL = 'deepseek/deepseek-v4-flash';
const MAX_TOKENS = 3000;

const SYS = `You are a senior TypeScript/React developer.
Write production-quality React custom hooks.
Rules:
- Always include "use client"; at the top
- TypeScript strict mode, no any unless absolutely necessary
- Export both the hook function and all required types/interfaces
- Include proper cleanup (useEffect return) where needed
- SSR-safe where noted
- No external dependencies unless React/Next.js built-ins
- Return ONLY the TypeScript code, no explanation, wrapped in a single typescript code block`;

const tasks = [
  {
    id: 'useScrollToBottom',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useScrollToBottom.ts`,
    msg: `Write a React hook called useScrollToBottom for auto-scrolling a chat message container.

Requirements:
- Hook signature: useScrollToBottom<T extends HTMLElement = HTMLDivElement>(deps?: React.DependencyList)
- Returns: { ref: React.RefObject<T>, scrollToBottom: () => void, isAtBottom: boolean }
- Auto-scrolls to bottom when deps change (new messages)
- Tracks whether user is at the bottom (within 50px threshold)
- If user scrolled up (not at bottom), don't auto-scroll on new messages
- Smooth scroll behavior
- Export type ScrollToBottomReturn`,
  },
  {
    id: 'useCopyToClipboard',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useCopyToClipboard.ts`,
    msg: `Write a React hook called useCopyToClipboard for copying text with success feedback.

Requirements:
- Hook signature: useCopyToClipboard(resetDelay?: number)
- Default resetDelay: 2000ms
- Returns: { copy: (text: string) => Promise<void>, copied: boolean, error: Error | null }
- Uses navigator.clipboard.writeText
- Falls back to document.execCommand for older browsers
- Sets copied=true on success, resets after resetDelay
- Sets error on failure
- Export type CopyToClipboardReturn`,
  },
  {
    id: 'useLocalStorageState',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useLocalStorageState.ts`,
    msg: `Write a React hook called useLocalStorageState that persists state to localStorage.

Requirements:
- Hook signature: useLocalStorageState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void]
- Returns [value, setValue, removeValue]
- Syncs with localStorage on mount (reads existing value)
- Updates localStorage on every setValue call
- removeValue removes the key from localStorage and resets to initialValue
- Handles JSON serialization/deserialization
- SSR-safe: only access localStorage in browser (typeof window !== 'undefined')
- Handles JSON parse errors gracefully (falls back to initialValue)
- Export type SetLocalStorageState<T>`,
  },
  {
    id: 'useDebounce',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useDebounce.ts`,
    msg: `Write a React hook called useDebounce.

Requirements:
- Hook signature: useDebounce<T>(value: T, delay: number): T
- Returns the debounced value
- Uses useEffect with setTimeout/clearTimeout for cleanup
- Also export a second hook: useDebouncedCallback<T extends (...args: unknown[]) => unknown>(callback: T, delay: number): T
  - Returns a debounced version of the callback
  - Uses useCallback and useRef for stability
- Export type DebouncedCallback<T>`,
  },
  {
    id: 'useWindowSize',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useWindowSize.ts`,
    msg: `Write a React hook called useWindowSize for tracking window dimensions.

Requirements:
- Hook signature: useWindowSize(): WindowSize
- Export type WindowSize { width: number | undefined; height: number | undefined }
- SSR-safe: returns { width: undefined, height: undefined } on server
- Listens to window resize event
- Cleans up event listener on unmount
- Debounces resize updates by 100ms
- Also export useIsMobile(): boolean (returns true if width < 768)
- Also export useIsTablet(): boolean (returns true if width >= 768 && width < 1024)`,
  },
  {
    id: 'useMDESTheme',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useMDESTheme.ts`,
    msg: `Write a React hook called useMDESTheme for reading and setting MDES theme preference.

Requirements:
- Export type MDESTheme = 'light' | 'dark' | 'system'
- Export type MDESThemeConfig { theme: MDESTheme; resolvedTheme: 'light' | 'dark'; isDark: boolean }
- Hook signature: useMDESTheme(): MDESThemeConfig & { setTheme: (theme: MDESTheme) => void; toggleTheme: () => void }
- Persists theme to localStorage with key 'mdes-theme'
- 'system' follows prefers-color-scheme media query
- Applies 'dark' class to document.documentElement when dark
- SSR-safe: default to 'system' on server, resolvedTheme defaults to 'light'
- Listens to system theme changes when theme='system'`,
  },
  {
    id: 'useAgentCount',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useAgentCount.ts`,
    msg: `Write a React hook called useAgentCount for counting active agents from AgentEvent array.

Requirements:
- Export type AgentStatus = 'active' | 'idle' | 'error' | 'offline'
- Export interface AgentEvent { agentId: string; status: AgentStatus; timestamp: number; name?: string }
- Export interface AgentCountSummary { total: number; active: number; idle: number; error: number; offline: number; byId: Map<string, AgentStatus> }
- Hook signature: useAgentCount(events: AgentEvent[]): AgentCountSummary
- Processes events to get latest status per agentId
- Counts per status
- Memoizes result with useMemo
- Also export useActiveAgentIds(events: AgentEvent[]): string[] — returns IDs with 'active' status`,
  },
  {
    id: 'useMessageGrouping',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useMessageGrouping.ts`,
    msg: `Write a React hook called useMessageGrouping for grouping chat messages by date.

Requirements:
- Export interface ChatMessage { id: string; content: string; timestamp: number; role: 'user' | 'assistant' | 'system'; agentId?: string }
- Export interface MessageGroup { date: string; label: string; messages: ChatMessage[] }
  - date format: 'YYYY-MM-DD'
  - label: 'Today', 'Yesterday', or formatted date like 'June 5, 2026'
- Hook signature: useMessageGrouping(messages: ChatMessage[]): MessageGroup[]
- Groups messages by calendar date (using message.timestamp)
- Memoizes with useMemo
- Messages within each group maintain original order
- Groups ordered oldest-first
- Export helper: formatGroupLabel(date: Date): string`,
  },
  {
    id: 'useAutoResize',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/useAutoResize.ts`,
    msg: `Write a React hook called useAutoResize for auto-resizing a textarea element.

Requirements:
- Export interface AutoResizeOptions { minHeight?: number; maxHeight?: number; lineHeight?: number }
- Default minHeight: 40, maxHeight: 200
- Hook signature: useAutoResize<T extends HTMLTextAreaElement = HTMLTextAreaElement>(options?: AutoResizeOptions): { ref: React.RefObject<T>; reset: () => void }
- On every input event, sets height to 'auto' then to scrollHeight (clamped to min/max)
- reset() sets height back to minHeight
- Attaches input event listener, cleans up on unmount
- Also runs resize on initial mount
- Export type AutoResizeReturn`,
  },
  {
    id: 'usePrevious',
    model: MODEL,
    max: MAX_TOKENS,
    out: `${OUT_DIR}/usePrevious.ts`,
    msg: `Write a React hook called usePrevious for tracking the previous value of any state or prop.

Requirements:
- Hook signature: usePrevious<T>(value: T): T | undefined
- Returns the value from the previous render
- Returns undefined on first render
- Uses useRef to store previous value
- Also export usePreviousDistinct<T>(value: T, isEqual?: (a: T, b: T) => boolean): T | undefined
  - Only updates previous when value actually changes (deep or custom equality)
  - Default isEqual uses Object.is
- Also export useValueHistory<T>(value: T, maxLength?: number): T[]
  - Returns array of previous N values (newest last)
  - Default maxLength: 10`,
  },
];

async function main() {
  console.log(`\n🚀 MDES Hooks Swarm — ${tasks.length} hooks\n`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Output: ${ROOT}/${OUT_DIR}\n`);
  console.log('─'.repeat(60));

  const start = Date.now();
  const results = await runTasks(tasks, ROOT, SYS);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('─'.repeat(60));
  console.log(`\n📊 Results:`);
  console.log(`   OK:     ${results.ok}/${tasks.length}`);
  console.log(`   Failed: ${results.fail}`);
  console.log(`   Tokens: ~${results.totalTok.toLocaleString()}`);
  console.log(`   Time:   ${elapsed}s`);

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed tasks: ${results.failed.join(', ')}`);
  }

  console.log(`\nSwarm swarm-mdes-hooks: ${results.ok}/${tasks.length} OK, ~${results.totalTok}tok`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
