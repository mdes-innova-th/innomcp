<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-001 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1754,"completion_tokens":2173,"total_tokens":3927,"prompt_tokens_details":{"cached_tokens":1664,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1813,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-13T11:54:26.915Z -->
FILE: innomcp-server-node/src/intelligence/fastPathLayer.ts
<<<<<<< SEARCH
        // 2. Thai History (Static KB)
        // Check for "รัชกาลที่ X" or "ร.X"
        for (const [key, value] of Object.entries(THAI_HISTORY_KB)) {
             // Simple contains check? Or strict equal?
             // User might ask "รัชกาลที่ 3 ���ือใคร" -> contains "รัชกาลที่ 3"
             if (q.includes(key)) {
                 // Heuristic: If query is SHORT (< 30 chars), treat as fact lookup.
                 if (q.length < 50) {
                     return {
                         handled: true,
                         response: `${key} คือ ${value}`
                     };
                 }
             }
        }
=======
        // 2. Thai History (Static KB)
        // Check for "รัชกาลที่ X" or "ร.X"
        const sortedHistory = Object.entries(THAI_HISTORY_KB).sort(([a], [b]) => b.length - a.length);
        for (const [key, value] of sortedHistory) {
             // Simple contains check? Or strict equal?
             // User might ask "รัชกาลที่ 3 คือใคร" -> contains "รัชกาลที่ 3"
             if (q.includes(key)) {
                 // Heuristic: If query is SHORT (< 30 chars), treat as fact lookup.
                 if (q.length < 50) {
                     return {
                         handled: true,
                         response: `${key} คือ ${value}`
                     };
                 }
             }
        }
>>>>>>> REPLACE
