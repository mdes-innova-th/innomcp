<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-021 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3293,"completion_tokens":6829,"total_tokens":10122,"prompt_tokens_details":{"cached_tokens":3200,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6065,"image_tokens":0},"cache_creation_input_tokens":0} | 65s
 generated: 2026-06-13T12:02:24.368Z -->
FILE: innomcp-server-node/src/mcp/tools/nasaTool.ts
<<<<<<< SEARCH
    // Fetch data
    const response = await fetch(url.toString());
=======
    // Fetch data
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/nasaTool.ts
<<<<<<< SEARCH
      if (dateStr === 'today' || dateStr === 'now' || dateStr === 'วันนี้') {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        url.searchParams.set("date", formattedDate);
        logBoth('INFO', `[NasaTool] Converted '${params.date}' to ${formattedDate}`);
=======
      if (dateStr === 'today' || dateStr === 'now' || dateStr === 'วันนี้') {
        const formattedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
        url.searchParams.set("date", formattedDate);
        logBoth('INFO', `[NasaTool] Converted '${params.date}' to ${formattedDate}`);
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/nasaTool.ts
<<<<<<< SEARCH
        const today = new Date().toISOString().split('T')[0];
=======
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/nasaTool.ts
<<<<<<< SEARCH
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Already in correct format
        url.searchParams.set("date", dateStr);
      }
=======
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Validate the date is a real calendar date
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime()) || !dateStr.startsWith(parsed.toISOString().slice(0, 10))) {
          throw new Error(`Invalid date: ${dateStr} is not a real calendar date`);
        }
        url.searchParams.set("date", dateStr);
      }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/nasaTool.ts
<<<<<<< SEARCH
  if (data.media_type === "image") {
    output += `   Standard: ${data.url}\n`;
    if (data.hdurl) {
      output += `   HD: ${data.hdurl}\n`;
    }
  } else if (data.media_type === "video") {
    output += `   Video: ${data.url}\n`;
  }
=======
  if (data.media_type === "image") {
    output += `   Standard: ${data.url}\n`;
    if (data.hdurl) {
      output += `   HD: ${data.hdurl}\n`;
    }
  } else if (data.media_type === "video") {
    output += `   Video: ${data.url}\n`;
  } else {
    output += `   Unknown type: ${data.url}\n`;
  }
>>>>>>> REPLACE
