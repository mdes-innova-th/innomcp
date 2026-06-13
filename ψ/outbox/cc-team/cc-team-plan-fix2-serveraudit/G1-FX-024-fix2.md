<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-024 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3682,"completion_tokens":2458,"total_tokens":6140,"prompt_tokens_details":{"cached_tokens":3584,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2110,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T12:03:07.789Z -->
FILE: innomcp-server-node/src/mcp/tools/nwpHourlyTool.ts
<<<<<<< SEARCH
      const fields = (input.fields || ["tc", "rh", "cond"]).join(",");
=======
      const fields = (input.fields?.length ? input.fields : ["tc", "rh", "cond"]).join(",");
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/nwpHourlyTool.ts
<<<<<<< SEARCH
  if (isLiveMode && (key === "demo" || key === "demokey" || key.includes("api12345"))) {
=======
  if (isLiveMode && (key === "demo" || key === "demokey" || key === "api12345")) {
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/nwpHourlyTool.ts
<<<<<<< SEARCH
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        query.append(key, value.join(","));
      } else {
        query.append(key, String(value));
      }
    }
  }
=======
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        query.append(key, value.join(","));
      } else {
        query.append(key, String(value));
      }
    }
  }
>>>>>>> REPLACE
