/**
 * Detect-Evidence API Server
 * Owns all business SQL for the detect/evidence domain.
 * MCP tools call this API instead of embedding SQL directly.
 *
 * Default port: 3013
 * Health: GET /health
 */
import express from "express";
import cors from "cors";
import { healthCheck } from "./db";
import nipRoutes from "./routes/nip";
import recordRoutes from "./routes/records";
import machineRoutes from "./routes/machines";
import adminRoutes from "./routes/admin";

const app = express();
const PORT = Number(process.env.DETECT_API_PORT || 3013);

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", async (_req, res) => {
  const db = await healthCheck();
  res.json({ service: "detect-evidence-api", ok: db.ok, db });
});

// Domain routes
app.use("/nip", nipRoutes);
app.use("/records", recordRoutes);
app.use("/machines", machineRoutes);
app.use("/admin", adminRoutes);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[DetectAPI] Error:", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

// Port conflict check
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[DetectAPI] ✅ Detect-Evidence API server listening on :${PORT}`);
  console.log(`[DetectAPI] Endpoints: /health, /nip/*, /records/*, /machines/*, /admin/contract-map`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[DetectAPI] ❌ Port ${PORT} already in use. Set DETECT_API_PORT env var to use a different port.`);
  } else {
    console.error(`[DetectAPI] ❌ Server error:`, err.message);
  }
  process.exit(1);
});
