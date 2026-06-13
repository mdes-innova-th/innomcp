<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-011 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2900,"completion_tokens":2450,"total_tokens":5350,"prompt_tokens_details":{"cached_tokens":2816,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1947,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:57:04.223Z -->
FILE: innomcp-server-node/src/mcp/tools/dataAnalysisTool.ts
<<<<<<< SEARCH
  return JSON.stringify({ ok: true, data: result });
=======
  try {
    return JSON.stringify({ ok: true, data: result });
  } catch {
    return JSON.stringify({ ok: false, error: "Result serialization failed" });
  }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/dataAnalysisTool.ts
<<<<<<< SEARCH
  // CSV with csv-parse/sync
  const records = parseCsv(input.data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Record<string, unknown>[];
=======
  // CSV with csv-parse/sync
  const records = parseCsv(input.data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    to: MAX_ROWS,
  }) as Record<string, unknown>[];
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/dataAnalysisTool.ts
<<<<<<< SEARCH
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ ok: false, error: `Failed to parse ${format}: ${msg}` });
  }

  if (allRows.length === 0) {
    return JSON.stringify({ ok: false, error: "Data parsed to zero rows" });
  }
=======
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ ok: false, error: `Failed to parse ${format}: ${msg}` });
  }

  // Validate each row is a plain object
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return JSON.stringify({ ok: false, error: `Row ${i} is not a plain object` });
    }
  }

  if (allRows.length === 0) {
    return JSON.stringify({ ok: false, error: "Data parsed to zero rows" });
  }
>>>>>>> REPLACE
