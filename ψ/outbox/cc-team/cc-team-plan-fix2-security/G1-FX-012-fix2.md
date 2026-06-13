<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-012 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1287,"completion_tokens":7989,"total_tokens":9276,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6944,"image_tokens":0},"cache_creation_input_tokens":0} | 79s
 generated: 2026-06-13T11:37:45.624Z -->
SKIP: The motherExportService module is a plain internal utility; authentication and authorization enforcement belongs in the HTTP route layer (controllers/middleware) and cannot be meaningfully implemented inside these pure data-transformation functions without breaking their reusability and testability.  

FILE: innomcp-node/src/services/motherExportService.ts
<<<<<<< SEARCH
/**
 * Export history as a JSON string.
 */
export function exportToJSON(options: ExportOptions = {}): string {
  const history = motherHistory.get(options.limit);
  return JSON.stringify(history, null, 2);
}
=======
/**
 * Export history as a JSON string.
 */
export function exportToJSON(options: ExportOptions = {}): string {
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new Error("limit must be a positive integer");
    }
  }
  const history = motherHistory.get(options.limit);
  return JSON.stringify(history, null, 2);
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/motherExportService.ts
<<<<<<< SEARCH
/**
 * Export history as a CSV string.
 * Each row represents a single provider's performance within a specific run.
 */
export function exportToCSV(options: ExportOptions = {}): string {
  const history = motherHistory.get(options.limit);
  if (history.length === 0) {
    return "No history available to export.";
  }

  const headers = [
    "runId",
    "timestamp",
    "intent",
    "query",
    "providerId",
    "providerName",
    "latencyMs",
    "success",
    "qualityScore",
    "preview",
  ];

  const rows = history.flatMap((run) =>
    run.providers.map((p) => [
      run.runId,
      run.timestamp,
      run.intent,
      `"${run.query.replace(/"/g, '""')}"`,
      p.providerId,
      p.providerName,
      p.latencyMs,
      p.success ? "TRUE" : "FALSE",
      p.qualityScore ?? "N/A",
      `"${p.preview.replace(/"/g, '""')}"`,
    ])
  );

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}
=======
/**
 * Sanitize a value for safe CSV output: wraps in double quotes,
 * escapes internal double quotes, and prefixes with a tab if the
 * value begins with a formula-triggering character (=, +, -, @).
 */
function sanitizeCSVField(value: unknown): string {
  const str = String(value ?? '');
  // Escape double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  let quoted = `"${escaped}"`;
  // Prevent CSV injection (Excel formula execution) by prefixing with a tab
  if (/^[=+\-@]/.test(str)) {
    quoted = '\t' + quoted;
  }
  return quoted;
}

/**
 * Export history as a CSV string.
 * Each row represents a single provider's performance within a specific run.
 */
export function exportToCSV(options: ExportOptions = {}): string {
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new Error("limit must be a positive integer");
    }
  }
  const history = motherHistory.get(options.limit);
  if (history.length === 0) {
    return "No history available to export.";
  }

  const headers = [
    "runId",
    "timestamp",
    "intent",
    "query",
    "providerId",
    "providerName",
    "latencyMs",
    "success",
    "qualityScore",
    "preview",
  ];

  const rows = history.flatMap((run) =>
    run.providers.map((p) => [
      sanitizeCSVField(run.runId),
      sanitizeCSVField(run.timestamp),
      sanitizeCSVField(run.intent),
      sanitizeCSVField(run.query),
      sanitizeCSVField(p.providerId),
      sanitizeCSVField(p.providerName),
      sanitizeCSVField(p.latencyMs),
      sanitizeCSVField(p.success ? "TRUE" : "FALSE"),
      sanitizeCSVField(p.qualityScore ?? "N/A"),
      sanitizeCSVField(p.preview),
    ])
  );

  const csvContent = [
    headers.map(sanitizeCSVField).join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}
>>>>>>> REPLACE
