<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-017 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1581,"completion_tokens":599,"total_tokens":2180,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":361,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:59:39.377Z -->
**Single responsibility:** In-memory TTL‑evicting LRU cache with size cap and stats.  
**Key API:** Singleton `CacheManager.getInstance()` exposes `get<T>(key)`, `set(key, value, ttl?)`, `delete`, `has`, `clear`, `size()`, `stats(): CacheStats`, `configure(maxSize)`.  
**Upstream callers:** Any agent pipeline stage that benefits from memoizing expensive results – tool executors, embedding fetchers, MCP resource resolvers, context summarizers.  
**Downstream deps:** None; pure data‑structure using `Map` and a doubly linked list.  
**Role in chat/agent pipeline:** Sits as a cross‑cutting utility to avoid redundant LLM or API calls for identical inputs within a conversation turn or across similar tasks.  
**Surprising coupling:** The `CacheManager` is a hard global singleton, making parallel test suites and state isolation awkward; the background `setInterval` cleanup timer (unref’d) ties cache lifetime to the process rather than to an agent session, risking stale entries interleaving between unrelated runs.
