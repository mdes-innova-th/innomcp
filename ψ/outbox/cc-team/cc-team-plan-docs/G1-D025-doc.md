<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D025 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2345,"completion_tokens":379,"total_tokens":2724,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:22:53.707Z -->
```ts
/**
 * Snapshot of the runtime's MCP tools/resources, configured providers,
 * the CommandCode model's `/v1/models` reachability, and a static catalog
 * of public API surfaces — produced for the `/api/chat/system/inventory` route.
 */
export interface SystemInventorySnapshot { /* …fields… */ }

/**
 * Optional inputs for {@link buildSystemInventorySnapshot}.
 * @property mcpClient   Live runtime client; its tool/resource getters are used directly when present.
 * @property mcpServerUrl  Base URL of the MCP server; `tools/list` is JSON-RPC-posted here if supplied.
 * @property commandCodeBaseUrl  Base URL of the CommandCode server (defaults to `http://127.0.0.1:4322`).
 * @property timeoutMs    Per-fetch abort timeout in ms (default 1600).
 */
export interface InventoryBuildOptions { /* … */ }

/**
 * Heuristic detector for user messages that are asking to enumerate the
 * system's tools/APIs/providers/models (English + Thai, transliterated Thai
 * inventory terms). Returns `true` only when a system-related subject is
 * present alongside an inventory-style request verb.
 */
export function looksLikeSystemInventoryQuestion(message: string): boolean;

/**
 * Assembles a {@link SystemInventorySnapshot} by merging runtime MCP tools,
 * MCP-server tools, provider registry entries, and a CommandCode `/v1/models`
 * probe. All network calls share `timeoutMs` and never throw — failures are
 * captured in the snapshot's `commandCode.error` or yield empty arrays.
 * @returns A snapshot dated at `generatedAt`; `commandCode.models` is capped at 80 entries.
 */
export async function buildSystemInventorySnapshot(
  options?: InventoryBuildOptions
): Promise<SystemInventorySnapshot>;
```
