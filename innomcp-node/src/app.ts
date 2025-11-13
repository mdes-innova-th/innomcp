import "dotenv/config";
import express from "express";
import cors from "cors";
import apiRouter from "./routes/api";
import apiCsrfRouter from "./routes/api/csrf";
import { apiKeyMiddleware } from "./utils/apikey";
import csrfMiddleware from "./utils/csrf";
import { chatRouter, wss as chatWSS } from "./routes/api/chat";
import url from "node:url";

// Initialize Express application
const app = express();
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

// Default route
app.get("/", (req, res) => {
  res.send("webddsb API Server is running");
});

// Health check endpoint for Docker
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Router สำหรับ API endpoint ทั้งหมดที่ต้องการ API key
app.use("/api", apiKeyMiddleware, csrfMiddleware, apiRouter);

// Router สำหรับ API endpoint CSRF
app.use("/api-get/csrf", apiCsrfRouter);

// Add the chat WebSocket route
app.use("/api/chat", chatRouter);

// Integrate WebSocket server for chat
const port = parseInt(process.env.SERVER_PORT || "3010", 10);
const host = process.env.SERVER_HOST || "localhost";

const httpServer = app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
  console.log(`WebSocket available at ws://${host}:${port}/api/chat`);
});

httpServer.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url || "").pathname;

  console.log(`[WebSocket] Upgrade request for: ${pathname}`);

  if (pathname === "/api/chat") {
    chatWSS.handleUpgrade(request, socket, head, (ws) => {
      chatWSS.emit("connection", ws, request);
    });
  } else {
    console.log(`[WebSocket] Rejected upgrade request for: ${pathname}`);
    socket.destroy();
  }
});

export default app;
