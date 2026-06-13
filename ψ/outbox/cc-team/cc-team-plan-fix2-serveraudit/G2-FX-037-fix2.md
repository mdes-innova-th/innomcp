<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-037 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":757,"completion_tokens":1335,"total_tokens":2092,"prompt_tokens_details":{"cached_tokens":640,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1162,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T12:09:06.331Z -->
FILE: innomcp-server-node/src/tools/registerExtraTools.ts
<<<<<<< SEARCH
export function registerExtraTools(server: McpServer) {
  console.log("⚠️  TODO: Copy tool files from docs/ADDON_CODE to this directory");
  console.log("Then uncomment the imports and function calls below");
  
  // registerImageGenTool(server);
  // registerConnectorsTools(server);
  // registerWebSearchAggregatorTool(server);
}
=======
export function registerExtraTools(server: McpServer) {
  throw new Error(
    "Extra tools are not available. Please copy the tool files from docs/ADDON_CODE to this directory " +
    "and uncomment the corresponding imports and calls in registerExtraTools.ts."
  );
}
>>>>>>> REPLACE
