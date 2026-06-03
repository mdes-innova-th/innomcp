/**
 * services/motherExportService.ts — Export utilities for mother dispatch history
 *
 * Provides methods to convert the in-memory run history into JSON and CSV formats
 * for analysis and reporting.
 */

import { motherHistory, MotherRun } from "./motherHistory";

export interface ExportOptions {
  limit?: number;
}

/**
 * Export history as a JSON string.
 */
export function exportToJSON(options: ExportOptions = {}): string {
  const history = motherHistory.get(options.limit);
  return JSON.stringify(history, null, 2);
}

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

/** Singleton object exposing export operations. */
export const motherExportService = {
  toJSON: exportToJSON,
  toCSV: exportToCSV,
};
