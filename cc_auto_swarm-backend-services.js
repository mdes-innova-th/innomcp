#!/usr/bin/env node
/**
 * cc_auto_swarm-backend-services.js
 * Swarm: 10 innomcp-node backend service improvements
 */
'use strict';

const { runTasks, PRO } = require('./cc_lib_swarm');

const ROOT = 'C:/Users/USER-NT/DEV/innomcp';
const SYS  = `You are a senior TypeScript/Node.js architect.
Write production-ready TypeScript code for innomcp-node backend services.
- Use TypeScript with proper types and interfaces
- Export a class or factory function as default
- Include JSDoc comments for public methods
- Handle errors gracefully with Thai error messages where specified
- No placeholder comments — write real implementation
- Return ONLY the TypeScript code in a single \`\`\`ts code block`;

const tasks = [
  {
    id   : 'metricsCollector',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/metricsCollector.ts',
    msg  : `Create metricsCollector.ts — collect and export Prometheus-style metrics for innomcp-node.
Requirements:
- MetricsCollector class with singleton getInstance()
- Track: request_count (counter), request_duration_ms (histogram), active_connections (gauge), token_usage_total (counter), cache_hits/misses (counter), model_errors (counter by model name)
- Methods: increment(name, labels?), observe(name, value, labels?), setGauge(name, value, labels?), getMetrics(): string (Prometheus text format), reset()
- Labels support: { model?: string, status?: string, endpoint?: string }
- In-memory storage using Map<string, number[]>
- Export /metrics endpoint formatter
- Type: MetricType = 'counter' | 'gauge' | 'histogram'
- Histogram buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]`
  },
  {
    id   : 'cacheManager',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/cacheManager.ts',
    msg  : `Create cacheManager.ts — in-memory LRU cache with TTL for innomcp-node.
Requirements:
- CacheManager class with singleton getInstance()
- LRU eviction: configurable maxSize (default 1000 entries)
- TTL support: per-entry TTL in milliseconds, default 5 minutes
- Methods: get<T>(key: string): T | null, set<T>(key: string, value: T, ttlMs?: number): void, delete(key: string): void, has(key: string): boolean, clear(): void, size(): number, stats(): CacheStats
- CacheStats: { hits: number, misses: number, evictions: number, size: number, hitRate: number }
- Use Map internally with doubly-linked list for O(1) LRU operations
- Auto-cleanup expired entries every 60 seconds
- Thread-safe (single-threaded Node.js but async-safe)
- Key namespacing: namespace prefix support e.g. 'chat:', 'model:', 'tool:'`
  },
  {
    id   : 'eventBus',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/eventBus.ts',
    msg  : `Create eventBus.ts — simple pub/sub event bus for innomcp-node services.
Requirements:
- EventBus class with singleton getInstance()
- Methods: on(event: string, handler: EventHandler): Unsubscribe, once(event: string, handler: EventHandler): void, emit(event: string, payload?: unknown): void, off(event: string, handler?: EventHandler): void, listenerCount(event: string): number, eventNames(): string[]
- Type: EventHandler = (payload: unknown) => void | Promise<void>
- Type: Unsubscribe = () => void
- Async handlers: catch errors without breaking other handlers
- Built-in events: 'request:start', 'request:end', 'model:error', 'cache:hit', 'cache:miss', 'stream:open', 'stream:close', 'tool:execute', 'tool:result', 'backpressure:triggered'
- Max listeners per event: 50 (warn if exceeded)
- Event history: last 100 events with timestamp for debugging`
  },
  {
    id   : 'healthAggregator',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/healthAggregator.ts',
    msg  : `Create healthAggregator.ts — aggregate health from all innomcp-node services into one response.
Requirements:
- HealthAggregator class with singleton getInstance()
- Register health checkers: registerChecker(name: string, checker: HealthChecker, timeoutMs?: number): void
- Run all checks in parallel: check(): Promise<AggregatedHealth>
- Type: HealthChecker = () => Promise<HealthStatus>
- Type: HealthStatus = { status: 'healthy' | 'degraded' | 'unhealthy', message?: string, details?: Record<string, unknown>, latencyMs?: number }
- Type: AggregatedHealth = { status: 'healthy' | 'degraded' | 'unhealthy', timestamp: string, uptime: number, checks: Record<string, HealthStatus & { durationMs: number }>, summary: { total: number, healthy: number, degraded: number, unhealthy: number } }
- Overall status: healthy if all healthy, degraded if any degraded, unhealthy if any unhealthy
- Timeout per checker: default 5000ms
- Built-in checkers: memory (heap usage), eventLoop (lag), uptime
- Cache results for 10 seconds to avoid hammering on frequent requests`
  },
  {
    id   : 'modelLoadBalancer',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/modelLoadBalancer.ts',
    msg  : `Create modelLoadBalancer.ts — round-robin + latency-aware load balancing across MDES models for innomcp-node.
Requirements:
- ModelLoadBalancer class with singleton getInstance()
- Strategies: 'round-robin' | 'least-latency' | 'weighted' | 'random'
- Methods: addModel(config: ModelConfig): void, removeModel(id: string): void, selectModel(strategy?: Strategy): ModelConfig | null, recordLatency(modelId: string, latencyMs: number): void, recordError(modelId: string): void, getStats(): ModelStats[], setStrategy(strategy: Strategy): void
- Type: ModelConfig = { id: string, endpoint: string, model: string, weight?: number, maxConcurrent?: number, tags?: string[] }
- Type: ModelStats = { id: string, avgLatency: number, errorRate: number, activeRequests: number, totalRequests: number }
- Circuit breaker: disable model after 5 consecutive errors, re-enable after 60 seconds
- Rolling window latency: last 20 requests average
- Health probe: ping models every 30s, re-enable circuit-broken models
- Default MDES models: ollama.mdes-innova.online with gemma4:26b`
  },
  {
    id   : 'contextManager',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/contextManager.ts',
    msg  : `Create contextManager.ts — manage conversation context window for innomcp-node (trim, summarize when too long).
Requirements:
- ContextManager class with singleton getInstance()
- Methods: addMessage(sessionId: string, msg: Message): void, getContext(sessionId: string, maxTokens?: number): Message[], trimContext(messages: Message[], maxTokens: number): Message[], estimateTokens(text: string): number, clearSession(sessionId: string): void, sessionCount(): number, getSessionStats(sessionId: string): SessionStats
- Type: Message = { role: 'system' | 'user' | 'assistant' | 'tool', content: string, timestamp?: number, tokens?: number }
- Type: SessionStats = { messageCount: number, totalTokens: number, oldestMessage: number, newestMessage: number }
- Token estimation: ~4 chars per token (fast heuristic)
- Trim strategy: keep system message + recent messages, drop oldest user/assistant pairs first
- Max messages per session: 200
- Session TTL: 2 hours of inactivity, auto-cleanup
- Context compression hint: when >80% of maxTokens, log warning`
  },
  {
    id   : 'streamManager',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/streamManager.ts',
    msg  : `Create streamManager.ts — manage SSE (Server-Sent Events) stream lifecycle for innomcp-node.
Requirements:
- StreamManager class with singleton getInstance()
- Methods: createStream(id: string, res: Response): StreamHandle, send(id: string, event: string, data: unknown): boolean, sendError(id: string, error: string): void, close(id: string): void, closeAll(): void, getActiveCount(): number, getStreamIds(): string[]
- Type: StreamHandle = { id: string, send: (event: string, data: unknown) => boolean, close: () => void, isOpen: () => boolean }
- SSE format: proper 'data:', 'event:', 'id:' headers
- Heartbeat: send comment ping every 25 seconds to keep connection alive
- Timeout: auto-close after 5 minutes of inactivity
- Backpressure: track write buffer, warn if >100 pending events
- Error handling: catch write errors, mark stream as closed
- Import: use Node.js http.ServerResponse type for Response
- Cleanup: remove stream from registry on close
- Events to support: 'message', 'delta', 'done', 'error', 'ping'`
  },
  {
    id   : 'toolExecutor',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/toolExecutor.ts',
    msg  : `Create toolExecutor.ts — safe tool execution wrapper with timeout and Thai error messages for innomcp-node.
Requirements:
- ToolExecutor class with singleton getInstance()
- Methods: register(tool: ToolDefinition): void, execute(name: string, params: unknown, options?: ExecOptions): Promise<ToolResult>, listTools(): ToolDefinition[], hasTool(name: string): boolean, unregister(name: string): void
- Type: ToolDefinition = { name: string, description: string, parameters: Record<string, unknown>, handler: (params: unknown) => Promise<unknown>, timeout?: number }
- Type: ExecOptions = { timeoutMs?: number, retries?: number, context?: Record<string, unknown> }
- Type: ToolResult = { success: boolean, data?: unknown, error?: string, durationMs: number, retries: number }
- Thai error messages: timeout="เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง", notFound="ไม่พบเครื่องมือที่ต้องการ", paramError="พารามิเตอร์ไม่ถูกต้อง", execError="เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ"
- Timeout: default 30 seconds per tool, configurable per tool
- Retry: exponential backoff, max 3 retries
- Metrics: emit events for tool execution start/end/error`
  },
  {
    id   : 'responseFormatter',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/responseFormatter.ts',
    msg  : `Create responseFormatter.ts — format AI responses for innomcp-node frontend (markdown, tables, code blocks).
Requirements:
- ResponseFormatter class with singleton getInstance()
- Methods: format(raw: string, options?: FormatOptions): FormattedResponse, formatStream(chunk: string): string, detectLanguage(code: string): string, sanitize(html: string): string, truncate(text: string, maxLength: number, ellipsis?: string): string, extractCodeBlocks(text: string): CodeBlock[]
- Type: FormatOptions = { renderMarkdown?: boolean, highlightCode?: boolean, sanitizeHtml?: boolean, maxLength?: number, locale?: 'th' | 'en' }
- Type: FormattedResponse = { text: string, html?: string, codeBlocks: CodeBlock[], tables: string[][], hasMarkdown: boolean, estimatedReadTimeSeconds: number }
- Type: CodeBlock = { language: string, code: string, lineCount: number }
- Markdown detection: check for #, **, \`\`\`, |, -, * patterns
- Table parsing: extract ASCII/markdown tables into string[][]
- Thai text support: word-wrap aware (Thai has no spaces)
- Code language detection from fence: ts, js, py, bash, json, yaml, sql
- Reading time: 200 words/min for English, 150 words/min for Thai
- Stream chunk handler: buffer incomplete markdown, flush on complete patterns`
  },
  {
    id   : 'backpressureHandler',
    model: PRO,
    max  : 4000,
    out  : 'innomcp-node/src/services/backpressureHandler.ts',
    msg  : `Create backpressureHandler.ts — handle queue overflow when too many concurrent requests in innomcp-node.
Requirements:
- BackpressureHandler class with singleton getInstance()
- Methods: acquire(priority?: Priority): Promise<Release>, tryAcquire(priority?: Priority): Release | null, getStats(): BackpressureStats, setLimits(limits: Limits): void, onPressure(handler: PressureHandler): void
- Type: Priority = 'high' | 'normal' | 'low'
- Type: Release = () => void
- Type: BackpressureStats = { active: number, queued: number, rejected: number, totalProcessed: number, avgWaitMs: number, pressure: 'none' | 'low' | 'medium' | 'high' | 'critical' }
- Type: Limits = { maxConcurrent: number, maxQueued: number, highPrioritySlots: number, timeoutMs: number }
- Type: PressureHandler = (stats: BackpressureStats) => void
- Default limits: maxConcurrent=50, maxQueued=200, highPrioritySlots=10, timeoutMs=30000
- Priority queue: high priority requests served first
- Pressure levels: none(<30%), low(<50%), medium(<70%), high(<90%), critical(>=90%)
- Timeout: reject queued requests after timeoutMs with Thai error: "ระบบยุ่งมาก กรุณารอสักครู่"
- Emit pressure change events via EventBus when level changes
- Sliding window metrics: avg wait time over last 100 requests`
  },
];

(async () => {
  console.log(`\n🚀 Swarm: swarm-backend-services (${tasks.length} tasks)\n`);
  const { ok, fail, totalTok, elapsed } = await runTasks(tasks, ROOT, SYS);
  const total = ok + fail;
  console.log(`\n✅ Done: ${ok}/${total} OK | ~${totalTok}tok | ${elapsed}s`);
  console.log(`Swarm swarm-backend-services: ${ok}/${total} OK, ~${totalTok}tok`);
})();
