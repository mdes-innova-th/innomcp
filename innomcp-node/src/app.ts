import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { performanceTrackingMiddleware, trackPerformance } from "./middleware/performanceTracking";
import { generalRateLimit, authRateLimit } from "./middleware/rateLimiter";
import apiRouter from "./routes/api";
import apiCsrfRouter from "./routes/api/csrf";
import aiModeRouter from "./routes/api/aiMode";
import providersRouter from "./routes/api/providers";
import chatStreamRouter from "./routes/api/chatStream";
import metricsRouter from "./routes/api/metrics";
import { healthRouter } from "./routes/api/health";
import authRouter from "./routes/api/auth";
import workspaceRouter from "./routes/api/workspace";
import filesRouter from "./routes/api/files";
import adminRouter from "./routes/api/admin";
import { apiKeyMiddleware } from "./utils/apikey";
import csrfMiddleware from "./utils/csrf";
import { authenticateToken } from "./utils/jwt";
import { chatRouter } from "./routes/api/chat";
import { hydrateStore } from "./providers/registry";
import logger from "./utils/logger";
import debugRouter from "./routes/api/debug";
import tasksRouter from "./routes/api/tasks";
import feedbackRouter from "./routes/api/feedback";
import statsRouter from "./routes/api/stats";
import modelSettingsRouter from "./routes/api/modelSettings";
import memoriesRouter from "./routes/api/memories";
import projectsRouter from "./routes/api/projects";
import shellRouter from "./routes/api/shell";
import webFetchRouter from "./routes/api/webFetch";
import dashboardRouter from "./routes/api/dashboard";
import analyzeRouter from "./routes/api/analyze";
import providerTestRouter from "./routes/api/providerTest";
import providerHealthRouter from "./routes/api/providerHealth";
import pluginsRouter from "./routes/api/plugins";
import webhooksRouter from "./routes/api/webhooks";
import { cacheResponse, getCacheStats, clearCache as clearAllCache } from "./middleware/cacheMiddleware";
import templatesRouter from "./routes/api/templates";
import preferencesRouter from "./routes/api/preferences";
import agentLeaderboardRouter from "./routes/api/agentLeaderboard";
import motherHistoryRouter from "./routes/api/motherHistory";
import motherStatsRouter from "./routes/api/motherStats";
import motherRosterRouter from "./routes/api/motherRoster";
import motherWinnerRouter from "./routes/api/motherWinner";
import motherCircuitsRouter from "./routes/api/motherCircuits";
import motherProvidersRouter from "./routes/api/motherProviders";
import motherRankingsRouter from "./routes/api/motherRankings";
import motherSessionRouter from "./routes/api/motherSession";
import motherExportRouter from "./routes/api/motherExport";
import motherCompareRouter from "./routes/api/motherCompare";
import motherIntentLeadersRouter from "./routes/api/motherIntentLeaders";
import motherBusLogRouter from "./routes/api/motherBusLog";
import motherSummaryRouter from "./routes/api/motherSummary";
import motherLeaderboardSnapshotRouter from "./routes/api/motherLeaderboardSnapshot";
import motherTalkToInnovaBotRouter from "./routes/api/motherTalkToInnovaBot";
import motherTriggerDispatchRouter from "./routes/api/motherTriggerDispatch";
import motherInboxRouter from "./routes/api/motherInbox";
import motherConfigRouter from "./routes/api/motherConfig";
import motherTrendsRouter from "./routes/api/motherTrends";
import motherStreaksRouter from "./routes/api/motherStreaks";
import motherHandoffRouter from "./routes/api/motherHandoff";
import motherScorecardRouter from "./routes/api/motherScorecard";
import presenceRouter from "./routes/api/presence";
import activityRouter from "./routes/api/activity";

// Initialize Express application
const app = express();

// Trust proxy — required for correct IP detection behind reverse proxies (nginx, Cloudflare)
// Without this, req.ip returns the proxy IP and rate limiting by IP is broken
app.set("trust proxy", 1);

// Helmet sets security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
// Configured to allow CORS and framed embedding from same origin
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled separately if needed
  crossOriginEmbedderPolicy: false, // Allow cross-origin resources
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Protect tests from crashing due to MCP SDK fetch failures when innomcp-server is down
process.on("unhandledRejection", (err) => {
  if (process.env.SMOKE_MODE === "1" && (String(err).includes("fetch failed") || String(err).includes("ECONNREFUSED"))) {
    return;
  }
  console.error("Unhandled rejection:", err);
});

logger.info('ðŸš€ Backend application starting...');
hydrateStore();
const DEFAULT_LOOPBACK_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const allowedOrigin = (process.env.ALLOWED_ORIGIN?.split(",") || DEFAULT_LOOPBACK_ORIGINS)
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS origin function - allow all in development, restricted in production
const corsOriginFn = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // No origin = same-origin request (e.g., curl, Postman, server-to-server)
  if (!origin) {
    return callback(null, true);
  }
  
  // Development mode: allow all origins
  if (process.env.NODE_ENV === 'development') {
    return callback(null, true);
  }
  
  const isLoopbackLocalhost = (() => {
    try {
      const parsed = new URL(origin);
      return (
        ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
        ["3000", "3001", "3010"].includes(parsed.port || "")
      );
    } catch {
      return false;
    }
  })();

  // Production mode: check against whitelist plus local Docker/browser loopback.
  if (allowedOrigin.includes(origin) || isLoopbackLocalhost) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

// Security headers middleware
app.use((req, res, next) => {
  // Only set HSTS if the request is over HTTPS (or if behind a proxy that sets X-Forwarded-Proto)
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  next();
});

// à¸£à¸­à¸‡à¸£à¸±à¸šà¸à¸²à¸£à¹à¸›à¸¥à¸‡ JSON à¹à¸¥à¸° URL-encoded à¹ƒà¸™à¸•à¸±à¸§ request (à¸•à¹‰à¸­à¸‡à¸¡à¸²à¸à¹ˆà¸­à¸™ CORS)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Debug logging middleware
app.use((req, res, next) => {
  const isHealthProbe = req.path === "/api/health" || req.path.startsWith("/api/health/");
  if (!isHealthProbe) {
    logger.info(`[REQUEST] ${req.method} ${req.url} from ${req.headers.origin || 'no-origin'}`);
  }
  next();
});

// à¹ƒà¸Šà¹‰ cors middleware à¹à¸—à¸™à¸à¸²à¸£à¸à¸³à¸«à¸™à¸” header à¹€à¸­à¸‡
app.use(
  cors({
    origin: corsOriginFn, // Dynamic origin checking
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "authorization", "X-API-Key"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Parse cookies
app.use(cookieParser());

// Correlation ID tracking
app.use(correlationIdMiddleware);

// â±ï¸ Performance Tracking Middleware (records latency metrics)
app.use(performanceTrackingMiddleware);

// In-memory per-route stats (feeds GET /api/metrics/performance)
app.use(trackPerformance);

// Default route
app.get("/", (req, res) => {
  res.send("webddsb API Server is running");
});

// Health check endpoint for Docker
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Router à¸ªà¸³à¸«à¸£à¸±à¸š CSRF (à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ auth à¹€à¸žà¸·à¸­ testsuit)
app.use("/api-get/csrf", apiCsrfRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Metrics (à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ auth à¹€à¸žà¸·à¸­ monitoring)
app.use("/api/metrics", metricsRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Health Check (à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ auth â€” à¹ƒà¸Šà¹‰à¸ªà¸³à¸«à¸£à¸±à¸š internal health probe à¹à¸¥à¸° Next.js proxy)
// à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸à¹ˆà¸­à¸™ /api middleware à¹€à¸žà¸·à¹ˆà¸­à¹„à¸¡à¹ˆà¹ƒà¸«à¹‰à¸–à¸¹à¸ apiKeyMiddleware à¸šà¸¥à¹‡à¸­à¸
app.use("/api/health", healthRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š AI Mode (à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ auth à¹€à¸žà¸·à¸­ testsuit - à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸à¹ˆà¸­à¸™ /api middleware)
app.use("/api/ai-mode", aiModeRouter);

// Phase C: Provider registry CRUD + route-preview (no auth, public)
app.use("/api/ai/providers", providersRouter);

// Phase 3: Provider test-call — fire a real API call through a registered provider
app.use("/api/providers/test-call", generalRateLimit, providerTestRouter);

// Provider health-check — bulk probe all enabled providers (no auth, public)
app.use("/api/providers/health-check", generalRateLimit, providerHealthRouter);

// Phase C: SSE streaming chat (additive â€” does not replace /api/chat)
app.use("/api/chat/stream", generalRateLimit, chatStreamRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Debug/Test GUI — requires auth (prevents info leak)
app.use("/api/debug", generalRateLimit, authenticateToken, debugRouter);

// Task persistence — Manus-style task history (requires API key + CSRF via /api)
// Mounted explicitly here before the catch-all /api to allow auth-bypass in tests.
// The /api catch-all below re-mounts via apiRouter but tasks needs the route
// registered at /api/tasks directly for authenticated access with the DB.
app.use("/api/tasks", generalRateLimit, apiKeyMiddleware, csrfMiddleware, tasksRouter);
app.use("/api/dashboard", generalRateLimit, authenticateToken, cacheResponse(30_000), dashboardRouter);
app.use("/api/chat/feedback", generalRateLimit, feedbackRouter);
// Live aggregate stats — no auth required (leaderboard panel fetches as guest)
app.use("/api/stats", generalRateLimit, cacheResponse(60_000), statsRouter);

// Phase 7: Agent leaderboard — no auth required, short cache (3 s)
app.use("/api/agent-leaderboard", generalRateLimit, cacheResponse(3_000), agentLeaderboardRouter);

// Phase 13-A: Mother dispatch run history — no auth required (read-only metrics)
app.use("/api/mother/history", generalRateLimit, motherHistoryRouter);

// Phase 14-C: Mother dispatch aggregate stats — no auth required, 5 s cache
app.use("/api/mother/stats", generalRateLimit, cacheResponse(5_000), motherStatsRouter);

app.use("/api/mother/roster", generalRateLimit, motherRosterRouter);
app.use("/api/mother/winner", generalRateLimit, motherWinnerRouter);
app.use("/api/mother/circuits", generalRateLimit, motherCircuitsRouter);
app.use("/api/mother/providers", generalRateLimit, motherProvidersRouter);
app.use("/api/mother/rankings", generalRateLimit, motherRankingsRouter);
app.use("/api/mother/session", generalRateLimit, motherSessionRouter);
app.use("/api/mother/export", generalRateLimit, motherExportRouter);
app.use("/api/mother/compare", generalRateLimit, motherCompareRouter);
app.use("/api/mother/intent-leaders", generalRateLimit, motherIntentLeadersRouter);
app.use("/api/mother/bus-log", generalRateLimit, motherBusLogRouter);
app.use("/api/mother/summary", generalRateLimit, motherSummaryRouter);
app.use("/api/mother/leaderboard-snapshot", generalRateLimit, motherLeaderboardSnapshotRouter);
app.use("/api/mother/talk-to-innova-bot", generalRateLimit, motherTalkToInnovaBotRouter);
// trigger-dispatch fires LLM calls — requires auth to prevent cost abuse
app.use("/api/mother/trigger-dispatch", generalRateLimit, authenticateToken, motherTriggerDispatchRouter);
app.use("/api/mother/inbox", generalRateLimit, motherInboxRouter);
app.use("/api/mother/config", generalRateLimit, motherConfigRouter);
app.use("/api/mother/trends", generalRateLimit, motherTrendsRouter);
app.use("/api/mother/streaks", generalRateLimit, motherStreaksRouter);
app.use("/api/mother/handoff", generalRateLimit, motherHandoffRouter);
app.use("/api/mother/scorecard", generalRateLimit, motherScorecardRouter);

// Model Settings — ad-hoc connection test + provider presets (no auth, public)
app.use("/api/model-settings", generalRateLimit, modelSettingsRouter);

// Project Memory — key-value store for Private Agent Studio sessions
// REQUIRES auth: prevents IDOR on DELETE and unauthorized memory access
app.use("/api/memories", generalRateLimit, authenticateToken, memoriesRouter);

// Projects — group tasks and memories into named projects
app.use("/api/projects", generalRateLimit, projectsRouter);

// Shell Tool — sandboxed command execution for Private Agent Studio
// REQUIRES auth: prevents unauthenticated RCE via /api/shell/exec
app.use("/api/shell", generalRateLimit, authenticateToken, shellRouter);

// Web Fetch Tool — SSRF-safe URL fetcher + HTML→Markdown + workspace artifact
app.use("/api/fetch", generalRateLimit, webFetchRouter);

// Plugin Registry — list and toggle installed plugins
app.use("/api/plugins", generalRateLimit, cacheResponse(300_000), pluginsRouter);

// Webhook Registry — register, toggle, and delete outbound webhooks (Phase 4)
// REQUIRES auth: prevents unauthorized webhook registration (SSRF vector)
app.use("/api/webhooks", generalRateLimit, authenticateToken, webhooksRouter);

// Saved Prompt Templates — list, create, use, delete (Phase 5)
app.use("/api/templates", generalRateLimit, cacheResponse(300_000), templatesRouter);

// User Preferences — per-user display/chat settings (Phase 6)
app.use("/api/preferences", generalRateLimit, preferencesRouter);

// Multi-user Presence — who is active in a project room (Phase 8)
app.use("/api/presence", generalRateLimit, presenceRouter);

// Live Activity Feed — recent events across tasks, agents, and projects (Phase 9)
app.use("/api/activity", generalRateLimit, cacheResponse(5000), activityRouter);

// Data Analysis Tool — CSV/JSON stats + bar chart SVG + workspace artifact
app.use("/api/analyze", generalRateLimit, analyzeRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Chat (à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ auth à¹€à¸žà¸·à¸­ testsuit - à¸•à¹‰à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¸à¹ˆà¸­à¸™ /api middleware)
// FastPath middleware à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™ chatRouter à¹à¸¥à¹‰à¸§
app.use("/api/chat", chatRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Authentication (public endpoints) â€” tighter limit (10 rpm) to slow brute force
app.use("/api/auth", authRateLimit, authRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Workspace (requires authentication)
app.use("/api/workspace", workspaceRouter);

// File Tool — sandboxed read/write/append/list/delete for Private Agent Studio
app.use("/api/files", generalRateLimit, filesRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Admin (requires authentication + admin role)
app.use("/api/admin", adminRouter);

// Cache management endpoints (no auth — monitoring use)
app.get("/api/cache/stats", (_req, res) => res.json(getCacheStats()));
app.post("/api/cache/clear", (_req, res) => { clearAllCache(); res.json({ cleared: true }); });

// Router à¸ªà¸³à¸«à¸£à¸±à¸š API endpoint à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£ API key â€” 60 rpm general rate limit
app.use("/api", generalRateLimit, apiKeyMiddleware, csrfMiddleware, apiRouter);

export default app;
