<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-018 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3629,"completion_tokens":7000,"total_tokens":10629,"prompt_tokens_details":{"cached_tokens":3584,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6582,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T12:05:14.185Z -->
FILE: innomcp-server-node/src/mcp/tools/imageGeneratorTool.ts
<<<<<<< SEARCH
 */

export const imageGeneratorToolSchema = z.object({
=======
 */

const colorSchema = z.string().refine(
  (val) => /^#([0-9A-Fa-f]{3}){1,2}$/.test(val) || /^[a-zA-Z]+$/.test(val),
  { message: "Invalid color format. Use hex (#RGB, #RRGGBB) or a named color." }
);

export const imageGeneratorToolSchema = z.object({
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/imageGeneratorTool.ts
<<<<<<< SEARCH
  width: z.number().optional().default(800).describe("ความกว้างของรูป (pixels)"),
  height: z.number().optional().default(600).describe("ความสูงของรูป (pixels)"),
  backgroundColor: z.string().optional().default("#ffffff").describe("สีพื้นหลัง (hex color)"),
=======
  width: z.number().int().min(1).max(8000).optional().default(800).describe("ความกว้างของรูป (pixels)"),
  height: z.number().int().min(1).max(8000).optional().default(600).describe("ความสูงของรูป (pixels)"),
  backgroundColor: colorSchema.optional().default("#ffffff").describe("สีพื้นหลัง (hex color)"),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/imageGeneratorTool.ts
<<<<<<< SEARCH
    shapes: z.array(z.object({
      type: z.enum(["rectangle", "circle", "line", "triangle"]),
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      radius: z.number().optional(),
      color: z.string().
