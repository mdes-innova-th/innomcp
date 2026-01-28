import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/api/health";

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
  res.send("innomcp Server is running");
});

// Health check endpoint for Docker
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Health check with API key validation
app.use("/api/health", healthRouter);


export default app;
