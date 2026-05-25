import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { performanceTrackingMiddleware } from "./middleware/performanceTracking";
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
import { chatRouter } from "./routes/api/chat";
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

// Initialize Express application
const app = express();

// Protect tests from crashing due to MCP SDK fetch failures when innomcp-server is down
process.on("unhandledRejection", (err) => {
  if (process.env.SMOKE_MODE === "1" && (String(err).includes("fetch failed") || String(err).includes("ECONNREFUSED"))) {
    return;
  }
  console.error("Unhandled rejection:", err);
});

logger.info('ðŸš€ Backend application starting...');
const allowedOrigin = process.env.ALLOWED_ORIGIN?.split(",") || [];

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
  
  // Production mode: check against whitelist
  if (allowedOrigin.includes(origin)) {
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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

// Phase C: SSE streaming chat (additive â€” does not replace /api/chat)
app.use("/api/chat/stream", generalRateLimit, chatStreamRouter);

// Router à¸ªà¸³à¸«à¸£à¸±à¸š Debug/Test GUI (à¹„à¸¡à¹ˆà¸•à¹‰à¸­à¸‡ auth)
app.use("/api/debug", debugRouter);

// Task persistence — Manus-style task history (requires API key + CSRF via /api)
// Mounted explicitly here before the catch-all /api to allow auth-bypass in tests.
// The /api catch-all below re-mounts via apiRouter but tasks needs the route
// registered at /api/tasks directly for authenticated access with the DB.
app.use("/api/tasks", generalRateLimit, apiKeyMiddleware, csrfMiddleware, tasksRouter);
app.use("/api/dashboard", generalRateLimit, apiKeyMiddleware, csrfMiddleware, dashboardRouter);
app.use("/api/chat/feedback", generalRateLimit, feedbackRouter);
// Live aggregate stats — no auth required (leaderboard panel fetches as guest)
app.use("/api/stats", generalRateLimit, statsRouter);

// Model Settings — ad-hoc connection test + provider presets (no auth, public)
app.use("/api/model-settings", generalRateLimit, modelSettingsRouter);

// Project Memory — key-value store for Private Agent Studio sessions
app.use("/api/memories", generalRateLimit, memoriesRouter);

// Projects — group tasks and memories into named projects
app.use("/api/projects", generalRateLimit, projectsRouter);

// Shell Tool — sandboxed command execution for Private Agent Studio
app.use("/api/shell", generalRateLimit, shellRouter);

// Web Fetch Tool — SSRF-safe URL fetcher + HTML→Markdown + workspace artifact
app.use("/api/fetch", generalRateLimit, webFetchRouter);

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

// Router à¸ªà¸³à¸«à¸£à¸±à¸š API endpoint à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£ API key â€” 60 rpm general rate limit
app.use("/api", generalRateLimit, apiKeyMiddleware, csrfMiddleware, apiRouter);

export default app;
