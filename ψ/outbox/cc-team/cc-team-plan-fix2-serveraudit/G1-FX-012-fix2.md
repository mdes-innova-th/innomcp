<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-012 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1716,"completion_tokens":2984,"total_tokens":4700,"prompt_tokens_details":{"cached_tokens":1664,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2709,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T11:57:16.144Z -->
FILE: innomcp-server-node/src/mcp/tools/dateTimeTool.ts
<<<<<<< SEARCH
      inputSchema: {
        format: z
          .string()
          .optional()
          .describe("Output format: thai, iso, timestamp, or default JavaScript Date string"),
      } as any,
=======
      inputSchema: z.object({
        format: z
          .enum(["thai", "iso", "timestamp"])
          .optional()
          .describe("Output format: 'thai', 'iso', or 'timestamp' (default: 'thai')"),
      }),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/dateTimeTool.ts
<<<<<<< SEARCH
            result = now.toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
=======
            result = now.toLocaleString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
>>>>>>> REPLACE
