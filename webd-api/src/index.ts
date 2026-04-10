/**
 * Web-D Domain API Server (Dual-Mode: live / scaffold)
 *
 * This service owns court-order and blocking-management logic.
 * When WEBD_DB_HOST/USER/PASSWORD are set → "live" mode (real SQL against db_aces).
 * Otherwise → "scaffold" mode (503 responses with honest explanation).
 *
 * Required database: db_aces (separate from detect DB)
 * Expected tables: case_order, courtorder, case_data, case_listdata,
 *                  case_record, isp, outdoc, sent, case_listdata_check
 *
 * Default port: 3014
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
import express from "express";
import cors from "cors";
import { healthCheck, getMode } from "./db";
import courtOrdersRouter from "./routes/courtOrders";
import urlsRouter from "./routes/urls";
import ispRouter from "./routes/isp";

const app = express();
const PORT = Number(process.env.WEBD_API_PORT || 3014);

app.use(cors());
app.use(express.json());

// Health — reflects actual mode and data tier honestly
app.get("/health", (_req, res) => {
  const mode = getMode();
  const dbName = process.env.WEBD_DB_NAME || "db_aces";
  const isMock = process.env.WEBD_API_MODE === "mock" || dbName !== "db_aces";
  const dataTier = isMock ? "MOCK" : "REAL";
  res.json({
    service: "webd-api",
    ok: mode === "live",
    status: mode,
    dataTier,
    dbName,
    note: mode === "live"
      ? (isMock
        ? `Web-D API running in live mode — connected to ${dbName} (MOCK data, NOT real db_aces).`
        : "Web-D API running in live mode — connected to real db_aces.")
      : "Web-D API running in scaffold mode — db_aces connection not yet configured.",
    requiredEnv: ["WEBD_DB_HOST", "WEBD_DB_PORT", "WEBD_DB_USER", "WEBD_DB_PASSWORD", "WEBD_DB_NAME"],
  });
});

// Contract map
app.get("/admin/contract-map", (_req, res) => {
  const mode = getMode();
  res.json({
    domain: "webd",
    version: "0.2.0",
    status: mode === "live" ? "CONNECTED" : "NOT_CONNECTED",
    mode,
    description: "Web-D domain — court orders, blocking obligations, URL source-of-truth management",
    requiredDatabase: "db_aces",
    endpoints: [
      { path: "GET /court-orders/:orderId/url-count", meaning: "How many URLs does this court order contain?", status: mode },
      { path: "GET /court-orders/by-order-no/:orderNo/url-count", meaning: "URL count by order number", status: mode },
      { path: "GET /court-orders/top-by-url-count", meaning: "Court orders ranked by URL count", status: mode },
      { path: "GET /urls/has-court-order?url=...", meaning: "Does this URL already have a court order?", status: mode },
      { path: "GET /urls/by-caselist/:caseId", meaning: "URLs paginated by case ID", status: mode },
      { path: "GET /urls/has-evidence?url=...", meaning: "Does this URL have blocking evidence?", status: mode },
      { path: "GET /isp/top-backlog", meaning: "ISPs ranked by total backlog of unblocked URLs", status: "not_supported" },
      { path: "GET /isp/reduction-rate", meaning: "ISP reduction rate (requires monthly snapshots)", status: "not_supported" },
    ],
    unsupported: [
      { id: "isp_reduction_rate", reason: "Requires historical monthly snapshot table that does not exist. Cannot compute reduction rate without archived monthly totals per ISP." },
      { id: "month_over_month_comparison", reason: "No temporal archival mechanism exists in current schema." },
    ],
  });
});

// Mount routes
app.use("/court-orders", courtOrdersRouter);
app.use("/urls", urlsRouter);
app.use("/isp", ispRouter);

// Boot
async function boot() {
  const hc = await healthCheck();
  const mode = getMode();
  const modeIcon = mode === "live" ? "✅" : "⚠️";
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[WebdAPI] ${modeIcon} Web-D API listening on :${PORT} (mode: ${mode})`);
  });
  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[WebdAPI] ❌ Port ${PORT} already in use.`);
    }
    process.exit(1);
  });
}

boot().catch((err) => {
  console.error("[WebdAPI] ❌ Boot failed:", err);
  process.exit(1);
});
