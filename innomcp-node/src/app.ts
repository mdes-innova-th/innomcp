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
import metricsRouter from "./routes/api/metrics";
import { healthRouter } from "./routes/api/health";
import authRouter from "./routes/api/auth";
import workspaceRouter from "./routes/api/workspace";
import adminRouter from "./routes/api/admin";
import { apiKeyMiddleware } from "./utils/apikey";
import csrfMiddleware from "./utils/csrf";
import { chatRouter } from "./routes/api/chat";
import logger from "./utils/logger";
import debugRouter from "./routes/api/debug";

// Initialize Express application
const app = express();

// Protect tests from crashing due to MCP SDK fetch failures when innomcp-server is down
process.on("unhandledRejection", (err) => {
  if (process.env.SMOKE_MODE === "1" && (String(err).includes("fetch failed") || String(err).includes("ECONNREFUSED"))) {
    return;
  }
  console.error("Unhandled rejection:", err);
});

logger.info('🚀 Backend application starting...');
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

// รองรับการแปลง JSON และ URL-encoded ในตัว request (ต้องมาก่อน CORS)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Debug logging middleware
app.use((req, res, next) => {
  logger.info(`[REQUEST] ${req.method} ${req.url} from ${req.headers.origin || 'no-origin'}`);
  next();
});

// ใช้ cors middleware แทนการกำหนด header เอง
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

// ⏱️ Performance Tracking Middleware (records latency metrics)
app.use(performanceTrackingMiddleware);

// Default route
app.get("/", (req, res) => {
  res.send("webddsb API Server is running");
});

// Health check endpoint for Docker
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Router สำหรับ CSRF (ไม่ต้อง auth เพือ testsuit)
app.use("/api-get/csrf", apiCsrfRouter);

// Router สำหรับ Metrics (ไม่ต้อง auth เพือ monitoring)
app.use("/api/metrics", metricsRouter);

// Router สำหรับ Health Check (ไม่ต้อง auth — ใช้สำหรับ internal health probe และ Next.js proxy)
// ต้องอยู่ก่อน /api middleware เพื่อไม่ให้ถูก apiKeyMiddleware บล็อก
app.use("/api/health", healthRouter);

// Router สำหรับ AI Mode (ไม่ต้อง auth เพือ testsuit - ต้องอยู่ก่อน /api middleware)
app.use("/api/ai-mode", aiModeRouter);

// Router สำหรับ Debug/Test GUI (ไม่ต้อง auth)
app.use("/api/debug", debugRouter);

// Router สำหรับ Chat (ไม่ต้อง auth เพือ testsuit - ต้องอยู่ก่อน /api middleware)
// FastPath middleware อยู่ใน chatRouter แล้ว
app.use("/api/chat", chatRouter);

// Router สำหรับ Authentication (public endpoints) — tighter limit (10 rpm) to slow brute force
app.use("/api/auth", authRateLimit, authRouter);

// Router สำหรับ Workspace (requires authentication)
app.use("/api/workspace", workspaceRouter);

// Router สำหรับ Admin (requires authentication + admin role)
app.use("/api/admin", adminRouter);

// Router สำหรับ API endpoint ทั้งหมดที่ต้องการ API key — 60 rpm general rate limit
app.use("/api", generalRateLimit, apiKeyMiddleware, csrfMiddleware, apiRouter);

export default app;
