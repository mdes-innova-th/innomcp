<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-019 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":988,"completion_tokens":1283,"total_tokens":2271,"prompt_tokens_details":{"cached_tokens":896,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1161,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:59:31.184Z -->
FILE: innomcp-server-node/src/mcp/tools/keywordTool.ts
<<<<<<< SEARCH
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
      };
    }
=======
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err?.message ?? 'Unknown error'}` }],
        isError: true,
      };
    }
>>>>>>> REPLACE
