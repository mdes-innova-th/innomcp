<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D038 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":825,"completion_tokens":3055,"total_tokens":3880,"prompt_tokens_details":{"cached_tokens":81,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3102,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:25:55.605Z -->
- **`ToolDispatcher`**  
  Callback signature for invoking an MCP tool by name, keeping `GeoService` decoupled from the tool registry.  
  @param `toolName` — Identifier of the tool to call.  
  @param `params` — Arguments to pass to the tool.  
  @returns Promise resolving to the tool's raw output.

- **`GeoService`**  
  Orchestrates weather-intent requests through intent classification, routing, guarded execution, and aggregation.  
  @param `dispatch` — `ToolDispatcher` injected at construction; all tool execution is delegated through this callback.  
  **Caveat:** Emits processing logs to `stdout`.

- **`GeoService.handleRequest`**  
  Processes a natural-language message through the full pipeline and returns a `WeatherPacket`.  
  @param `userMessage` — Input text to analyze.  
  @returns A formatted `WeatherPacket`; on total failure returns the primary tool's degraded error packet directly (unformatted).  
  **Caveats:**  
  - Returns hardcoded Thai-language rejection responses when the intent confidence is below `0.5` or routing produces no plan.  
  - On primary tool failure, attempts fallback tools in order; a successful fallback mutates the packet with `fallback_used: true`.  
  - If all tools fail, the returned error packet bypasses the aggregator.
