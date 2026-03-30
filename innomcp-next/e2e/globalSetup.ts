/**
 * Playwright globalSetup — pre-warm backend caches before any test runs.
 *
 * Root cause: TMD weather API, NWP API, station API, and MCP geo tool all have
 * 30-40s cold-start latency on first call. ToolCache (LRU, 30min TTL) stores
 * results after the first call, making subsequent calls <1s.
 *
 * This setup fires one representative call per external-API type so that
 * every test in the suite gets a cache-warm response on its first attempt.
 */
import * as http from "http";

const BACKEND_URL = "http://localhost:3011";
const WARMUP_TIMEOUT_MS = 90_000;

interface WarmupQuery {
  message: string;
  label: string;
}

/**
 * Queries that collectively warm every external-API cache used in the suite.
 *
 * TMD forecast:  keyed by { scope: "national" } → ONE call warms all 77 provinces.
 * TMD station:   keyed by province → need one call per province group.
 * NWP:           keyed per location/type → one call per NWP type.
 * MCP geo tool:  first call initialises MCP connection + tool data; thereafter fast.
 */
const WARMUP_QUERIES: WarmupQuery[] = [
  // ── TMD forecast national cache (covers WP*, WN*, WW*, HY2, PM*, W7D*, WT*, WR*) ──
  { message: "อากาศกรุงเทพวันนี้", label: "weather-national-forecast" },

  // ── TMD station cache (covers ST1) ──
  { message: "สถานีอากาศใกล้กรุงเทพมีอะไรบ้าง", label: "station-bkk" },

  // ── TMD station — Phuket (covers TC-05) ──
  { message: "ข้อมูลสถานี ภูเก็ต", label: "station-phuket" },

  // ── NWP daily ChiangMai (covers NP2) ──
  { message: "NWP พยากรณ์รายวันเชียงใหม่", label: "nwp-cnx-daily" },

  // ── Hydro / flood (covers HY2) ──
  { message: "สถานการณ์น้ำท่วมภาคอีสานล่าสุด", label: "hydro-flood-isaan" },

  // ── MCP geo tool init + alias cache (covers IA1/IA3/IA4) ──
  { message: "ปากช่องอยู่จังหวัดอะไร", label: "geo-pakklong" },
  { message: "อยุธยาอยู่ภาคไหน", label: "geo-ayutthaya" },
  { message: "แม่สายอยู่จังหวัดอะไร", label: "geo-maesai" },

  // ── TC-03 rain query ──
  { message: "วันนี้ฝนจะตกไหม", label: "rain-today" },

  // ── Regional forecasts (WR* — exact queries from PM tests, ensures same cache key) ──
  { message: "อากาศภาคใต้", label: "region-south" },
  { message: "ฝนเชียงใหม่วันนี้", label: "region-cnx-rain" },
  { message: "พยากรณ์ทั่วประเทศ", label: "region-nationwide" },
];

function callChatApi(query: WarmupQuery): Promise<void> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      message: query.message,
      sessionId: `warmup-${query.label}-${Date.now()}`,
    });

    const req = http.request(
      {
        hostname: "localhost",
        port: 3011,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: WARMUP_TIMEOUT_MS,
      },
      (res) => {
        // Drain the response body (required to free the socket)
        res.resume();
        res.on("end", () => {
          process.stdout.write(`  [warmup] ${query.label} ✓\n`);
          resolve();
        });
        res.on("error", () => resolve());
      }
    );

    req.on("error", (e) => {
      process.stdout.write(`  [warmup] ${query.label} error: ${e.message}\n`);
      resolve(); // non-fatal
    });

    req.on("timeout", () => {
      process.stdout.write(`  [warmup] ${query.label} timeout (${WARMUP_TIMEOUT_MS}ms)\n`);
      req.destroy();
      resolve(); // non-fatal
    });

    req.write(body);
    req.end();
  });
}

export default async function globalSetup(): Promise<void> {
  const t0 = Date.now();
  process.stdout.write("\n[E2E globalSetup] Pre-warming backend caches…\n");

  // Run in batches of 3 — enough parallelism to finish in ~2min while
  // not overwhelming the single-worker Ollama instance.
  const BATCH = 3;
  for (let i = 0; i < WARMUP_QUERIES.length; i += BATCH) {
    const batch = WARMUP_QUERIES.slice(i, i + BATCH);
    await Promise.all(batch.map(callChatApi));
  }

  process.stdout.write(
    `[E2E globalSetup] All caches warm — ${Date.now() - t0}ms elapsed\n\n`
  );
}
