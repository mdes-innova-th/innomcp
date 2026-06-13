<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-014 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3583,"completion_tokens":7000,"total_tokens":10583,"prompt_tokens_details":{"cached_tokens":3456,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6470,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T11:58:18.708Z -->
FILE: innomcp-server-node/src/mcp/tools/echartsTool.ts
<<<<<<< SEARCH
import * as echarts from "echarts";
=======
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/echartsTool.ts
<<<<<<< SEARCH
  (mcpserver.registerTool as any)(
=======
  mcpserver.registerTool(
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/echartsTool.ts
<<<<<<< SEARCH
      inputSchema: {
        type: z.string().optional(),
        labels: z.array(z.string()).optional(),
        datasets: z.array(z.object({ label: z.string(), data: z.array(z.number()) })).optional(),
        dataJson: z.string().optional(),
        chatText: z.string().optional(),
        chartTitle: z.string().optional(),
      } as any,
=======
      inputSchema: z.object({
        type: z.string().optional(),
        labels: z.array(z.string()).optional(),
        datasets: z.array(z.object({ label: z.string(), data: z.array(z.number()) })).optional(),
        dataJson: z.string().optional(),
        chatText: z.string().optional(),
        chartTitle: z.string().optional(),
      }),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/echartsTool.ts
<<<<<<< SEARCH
      // Validate type - CRITICAL FIX
      if (!type || type === 'undefined') {
        type = 'bar'; // Default to bar chart
        mcpLog('WARN', `[ECharts Tool] No chart type specified, defaulting to 'bar'`);
      }
=======
      // Validate type - CRITICAL FIX
      const validTypes = ['bar', 'line', 'pie', 'area', 'donut', 'scatter', 'column'];
      if (!type || type === 'undefined' || !validTypes.includes(type)) {
        mcpLog('WARN', `[ECharts Tool] Invalid chart type "${type}" - defaulting to 'bar'`);
        type = 'bar';
      }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/echartsTool.ts
<<<<<<< SEARCH
        // Parse chatText if provided
        if (chatText) {
          try {
            const pairs = chatText.split(",").map((s
