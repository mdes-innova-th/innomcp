<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-009 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2649,"completion_tokens":3085,"total_tokens":5734,"prompt_tokens_details":{"cached_tokens":2560,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2670,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:56:43.139Z -->
FILE: innomcp-server-node/src/mcp/tools/archiveTool.ts
<<<<<<< SEARCH
    logBoth('INFO', `[ArchiveTool] Searching: ${url.toString()}`);
=======
    await logBoth('INFO', `[ArchiveTool] Searching: ${url.toString()}`);
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/archiveTool.ts
<<<<<<< SEARCH
    logBoth('INFO', `[ArchiveTool] Found ${data.response.numFound} results in ${duration}ms`);
=======
    await logBoth('INFO', `[ArchiveTool] Found ${data.response.numFound} results in ${duration}ms`);
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/archiveTool.ts
<<<<<<< SEARCH
    logBoth('ERROR', `[ArchiveTool] Error after ${duration}ms: ${String(error)}`);
=======
    await logBoth('ERROR', `[ArchiveTool] Error after ${duration}ms: ${String(error)}`);
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/archiveTool.ts
<<<<<<< SEARCH
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      }
    });
=======
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      },
      signal: AbortSignal.timeout(10_000)
    });
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/archiveTool.ts
<<<<<<< SEARCH
      format: doc.format,
=======
      format: Array.isArray(doc.format) ? doc.format : (doc.format ? [doc.format] : undefined),
>>>>>>> REPLACE
