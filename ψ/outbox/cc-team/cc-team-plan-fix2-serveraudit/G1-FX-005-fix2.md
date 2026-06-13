<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-005 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1622,"completion_tokens":775,"total_tokens":2397,"prompt_tokens_details":{"cached_tokens":1536,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":668,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:55:03.697Z -->
FILE: innomcp-server-node/src/mcp/knowledge/types/history.ts
<<<<<<< SEARCH
  data: Array<{
    id: string;
    name_th: string;
    aliases: string[];
    description: string;
    attributes: HistoryAttributes;
  }>;
=======
  data: Array<{
    id: string;
    name_th: string;
    aliases?: string[];
    description: string;
    attributes: HistoryAttributes;
  }>;
>>>>>>> REPLACE
