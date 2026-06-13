<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-025 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2195,"completion_tokens":4585,"total_tokens":6780,"prompt_tokens_details":{"cached_tokens":2176,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4092,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-13T12:03:52.496Z -->
FILE: innomcp-server-node/src/mcp/tools/ocrTool.ts
<<<<<<< SEARCH
      // Filter words by confidence
      const words = (result.data.words || []).filter((word: any) => word.confidence >= confidence);
      const lines = (result.data.lines || []).filter((line: any) => line.confidence >= confidence);

      // Extract text
      const fullText = result.data.text.trim();
      const avgConfidence = result.data.confidence;

      // Prepare result
=======
      // Filter words by confidence
      const words = (result.data.words || []).filter((word: any) => word.confidence >= confidence);
      const lines = (result.data.lines || []).filter((line: any) => line.confidence >= confidence);

      // Extract text from filtered lines to maintain consistency with confidence threshold
      const fullText = lines.map((line: any) => line.text).join('\n').trim();
      const avgConfidence = result.data.confidence;

      // Prepare result
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/ocrTool.ts
<<<<<<< SEARCH
  confidence: z.number().optional().default(50).describe("ค่าความมั่นใจขั้นต่ำ (0-100). Default: 50"),
=======
  confidence: z.number().min(0).max(100).optional().default(50).describe("ค่าความมั่นใจขั้นต่ำ (0-100). Default: 50"),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/ocrTool.ts
<<<<<<< SEARCH
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR Progress] ${(m.progress * 100).toFixed(0)}%`);
            }
          }
        }
=======
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              try {
                console.log(`[OCR Progress] ${(m.progress * 100).toFixed(0)}%`);
              } catch (e) {
                // Ignore logger errors to prevent breaking OCR flow
              }
            }
          }
        }
>>>>>>> REPLACE
