/**
 * Web-D Domain API Server (Scaffold)
 *
 * This service is the future owner of court-order and blocking-management logic.
 * Currently a scaffold because the db_aces database is not yet accessible.
 *
 * Required database: db_aces (separate from detect DB)
 * Expected tables: case_order, courtorder, case_data, case_listdata,
 *                  case_record, isp, outdoc, sent, case_listdata_check
 *
 * Default port: 3014
 */
import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.WEBD_API_PORT || 3014);

app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => {
  res.json({
    service: "webd-api",
    ok: false,
    status: "scaffold",
    note: "Web-D API is a scaffold — db_aces connection not yet configured. Court-order and blocking-management endpoints require the real db_aces database.",
    requiredEnv: ["WEBD_DB_HOST", "WEBD_DB_PORT", "WEBD_DB_USER", "WEBD_DB_PASSWORD", "WEBD_DB_NAME"],
  });
});

// Contract map — documents what WILL be available
app.get("/admin/contract-map", (_req, res) => {
  res.json({
    domain: "webd",
    version: "0.1.0-scaffold",
    status: "NOT_CONNECTED",
    description: "Web-D domain — court orders, blocking obligations, URL source-of-truth management",
    requiredDatabase: "db_aces",
    plannedEndpoints: [
      { path: "GET /court-orders/:orderId/url-count", meaning: "How many URLs does this court order contain?", status: "scaffold" },
      { path: "GET /court-orders/by-order-no/:orderNo/url-count", meaning: "URL count by order number", status: "scaffold" },
      { path: "GET /urls/has-court-order?url=...", meaning: "Does this URL already have a court order?", status: "scaffold" },
      { path: "GET /urls/:caselistId", meaning: "URL details by caselist ID", status: "scaffold" },
      { path: "GET /court-orders/top-by-open-url", meaning: "Court orders ranked by open URL count", status: "scaffold" },
      { path: "GET /isp/top-backlog", meaning: "ISPs ranked by total backlog of unblocked URLs", status: "scaffold" },
      { path: "GET /isp/reduction-rate", meaning: "ISP reduction rate (requires monthly snapshots)", status: "not_supported" },
      { path: "GET /isp/reduction-rate?period=last_month", meaning: "Last month reduction rate", status: "not_supported" },
    ],
    unsupported: [
      { id: "isp_reduction_rate", reason: "Requires historical monthly snapshot table that does not exist. Cannot compute reduction rate without archived monthly totals per ISP." },
      { id: "month_over_month_comparison", reason: "No temporal archival mechanism exists in current schema." },
    ],
  });
});

// Scaffold endpoints — return honest "not yet connected" responses
app.get("/court-orders/:orderId/url-count", (_req, res) => {
  res.status(503).json({ ok: false, status: "scaffold", message: "Web-D court-order database not yet connected" });
});

app.get("/urls/has-court-order", (_req, res) => {
  res.status(503).json({ ok: false, status: "scaffold", message: "Web-D court-order database not yet connected" });
});

app.get("/isp/top-backlog", (_req, res) => {
  res.status(503).json({ ok: false, status: "scaffold", message: "Web-D court-order database not yet connected" });
});

app.get("/isp/reduction-rate", (_req, res) => {
  res.status(501).json({ ok: false, status: "not_supported", message: "Reduction rate requires historical monthly snapshots that do not exist in current schema" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[WebdAPI] ⚠️ Web-D API scaffold listening on :${PORT} (NOT connected to db_aces)`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[WebdAPI] ❌ Port ${PORT} already in use.`);
  }
  process.exit(1);
});
