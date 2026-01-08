import "dotenv/config";
import express from "express";
import cors from "cors";
import apiRouter from "./routes/api";
import apiCsrfRouter from "./routes/api/csrf";
import aiModeRouter from "./routes/api/aiMode";
import { apiKeyMiddleware } from "./utils/apikey";
import csrfMiddleware from "./utils/csrf";
import { chatRouter } from "./routes/api/chat";
import logger from "./utils/logger";

// Initialize Express application
const app = express();

logger.info('🚀 Backend application starting...');
const allowedOrigin = process.env.ALLOWED_ORIGIN?.split(",") || [];

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

// ใช้ cors middleware แทนการกำหนด header เอง
app.use(
  cors({
    origin: allowedOrigin, // ระบุ origin ที่อนุญาต เช่น ["http://localhost:3000", "https://yourdomain.com"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// รองรับการแปลง JSON ในตัว request
app.use(express.json({ limit: "50mb" }));

// ⏱️ Performance Logging Middleware
app.use((req, res, next) => {
  const requestStartTime = Date.now();
  const method = req.method;
  const url = req.originalUrl || req.url;

  logger.info(`[⏱️  START] ${method} ${url}`);

  // Log response time when request finishes
  res.on("finish", () => {
    const duration = Date.now() - requestStartTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 500 ? "❌" : statusCode >= 400 ? "⚠️ " : statusCode >= 300 ? "↪️ " : "✅";
    
    logger.info(`[⏱️  ${duration}ms] ${statusEmoji} ${method} ${url} → ${statusCode}`);
  });

  next();
});

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

// Router สำหรับ AI Mode (ไม่ต้อง auth เพือ testsuit - ต้องอยู่ก่อน /api middleware)
app.use("/api/ai-mode", aiModeRouter);

// Router สำหรับ Chat (ไม่ต้อง auth เพือ testsuit - ต้องอยู่ก่อน /api middleware)
app.use("/api/chat", chatRouter);

// Router สำหรับ API endpoint ทั้งหมดที่ต้องการ API key
app.use("/api", apiKeyMiddleware, csrfMiddleware, apiRouter);

export default app;
