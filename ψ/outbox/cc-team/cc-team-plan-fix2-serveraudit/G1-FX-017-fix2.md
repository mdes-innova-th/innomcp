<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-017 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2839,"completion_tokens":6711,"total_tokens":9550,"prompt_tokens_details":{"cached_tokens":2816,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5236,"image_tokens":0},"cache_creation_input_tokens":0} | 83s
 generated: 2026-06-13T12:01:11.487Z -->
FILE: innomcp-server-node/src/mcp/tools/govDataTool.ts
<<<<<<< SEARCH
async function searchGovData(params: GovDataToolInput): Promise<string> {
  const startTime = Date.now();

  try {
    const url = new URL("/search", catalogBaseUrl());
    url.searchParams.set("q", params.query);
    url.searchParams.set("per_page", String(params.rows));
    url.searchParams.set("sort", "last_harvested_date");

    if (params.category) {
      url.searchParams.append("keyword", params.category);
    }

    logBoth("INFO", `[GovDataTool] Searching: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)",
      },
    });

    if (!response.ok) {
      throw new Error(`Data.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as CatalogSearchResponse;
    const duration = Date.now() - startTime;
    const datasets = Array.isArray(data.results) ? data.results : [];
    const totalCount = Number(data.total ?? data.count ?? datasets.length);

    logBoth("INFO", `[GovDataTool] Found ${totalCount} datasets in ${duration}ms`);

    if (datasets.length === 0) {
      return JSON.stringify(
        {
          success: true,
          query: params.query,
          totalFound: 0,
          results: [],
          message: "No datasets found. Try a broader search term.",
        },
        null,
        2,
      );
    }

    return formatGovData(datasets, totalCount, params.query, duration);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const message = error?.message || String(error);
    logBoth("ERROR", `[GovDataTool] Error after ${duration}ms: ${message}`);

    return JSON.stringify(
      {
        success: false,
        error: message,
        query: params.query,
        duration: `${duration}ms`,
        hint: "Try broader search terms like census, health, education, or transportation",
      },
      null,
      2,
    );
  }
}
=======
async function searchGovData(params: GovDataToolInput): Promise<string> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const url = new URL("/search", catalogBaseUrl());
    url.searchParams.set("q", params.query);
    url.searchParams.set("per_page", String(params.rows));
    url.searchParams.set("sort", "last_harvested_date");

    if (params.category) {
      url.searchParams.append("keyword", params.category);
    }

    logBoth("INFO", `[GovDataTool] Searching: ${url.toString()}`);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "INNOMCP/1.0 (MCP Tool)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Data.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as CatalogSearchResponse;
    const duration = Date.now() - startTime;
    const datasets = Array.isArray(data.results) ? data.results : [];
    const totalCount = Number(data.total ?? data.count ?? datasets.length);

    logBoth("INFO", `[GovDataTool] Found ${totalCount} datasets in ${duration}ms`);

    if (datasets.length === 0) {
      return JSON.stringify(
        {
          success: true,
          query: params.query,
          totalFound: 0,
          results: [],
          message: "No datasets found. Try a broader search term.",
        },
        null,
        2,
      );
    }

    const formattedText = formatGovData(datasets, totalCount, params.query, duration);
    return JSON.stringify(
      {
        success: true,
        query: params.query,
        totalFound: totalCount,
        results: datasets,
        formattedText,
      },
      null,
      2,
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    if (error?.name === "AbortError") {
      logBoth("WARN", `[GovDataTool] Request timed out after ${duration}ms`);
      return JSON.stringify(
        {
          success: false,
          error: "Request timed out after 30 seconds",
          query: params.query,
          duration: `${duration}ms`,
          hint: "Try a more specific query or check your network connection",
        },
        null,
        2,
      );
    }
    const message = error?.message || String(error);
    logBoth("ERROR", `[GovDataTool] Error after ${duration}ms: ${message}`);

    return JSON.stringify(
      {
        success: false,
        error: message,
        query: params.query,
        duration: `${duration}ms`,
        hint: "Try broader search terms like census, health, education, or transportation",
      },
      null,
      2,
    );
  }
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/govDataTool.ts
<<<<<<< SEARCH
    if (notes) {
      output += `   ${stripHtml(notes).slice(0, 240)}${stripHtml(notes).length > 240 ? "..." : ""}\n`;
    }
=======
    if (notes) {
      const strippedNotes = stripHtml(notes);
      output += `   ${strippedNotes.slice(0, 240)}${strippedNotes.length > 240 ? "..." : ""}\n`;
    }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/govDataTool.ts
<<<<<<< SEARCH
function catalogBaseUrl(): string {
  return process.env.DATAGOV_CATALOG_BASE_URL || "https://catalog.data.gov";
}
=======
function catalogBaseUrl(): string {
  const envUrl = process.env.DATAGOV_CATALOG_BASE_URL;
  if (!envUrl) return "https://catalog.data.gov";
  try {
    new URL(envUrl); // validates
    return envUrl;
  } catch {
    logBoth("WARN", `[GovDataTool] Invalid DATAGOV_CATALOG_BASE_URL: "${envUrl}". Using default catalog.data.gov`);
    return "https://catalog.data.gov";
  }
}
>>>>>>> REPLACE
