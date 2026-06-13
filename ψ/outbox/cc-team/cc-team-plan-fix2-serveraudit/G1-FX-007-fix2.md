<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-007 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1112,"completion_tokens":1022,"total_tokens":2134,"prompt_tokens_details":{"cached_tokens":1024,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":890,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:55:41.401Z -->
FILE: innomcp-server-node/src/mcp/knowledge/types/religion.ts
<<<<<<< SEARCH
        location: z.custom<GeoLocation>().optional(),
=======
        location: z.object({ lat: z.number(), lon: z.number(), province: z.string(), district: z.string().optional() }).optional(),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/knowledge/types/religion.ts
<<<<<<< SEARCH
    query: z.string(),
=======
    query: z.string().min(1, "Query cannot be empty"),
>>>>>>> REPLACE
