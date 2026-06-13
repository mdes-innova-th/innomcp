<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-022 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2894,"completion_tokens":5045,"total_tokens":7939,"prompt_tokens_details":{"cached_tokens":2816,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3960,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T12:03:11.312Z -->
FILE: innomcp-server-node/src/mcp/tools/newtonTool.ts
<<<<<<< SEARCH
const NewtonToolInputSchema = z.object({
  operation: z.enum([
    "simplify",   // Simplify expression
    "factor",     // Factor expression
    "derive",     // Derivative
    "integrate",  // Integral
    "zeroes",     // Find zeros/roots
    "tangent",    // Find tangent line
    "area",       // Area under curve
    "cos",        // Cosine
    "sin",        // Sine
    "tan",        // Tangent
    "arccos",     // Inverse cosine
    "arcsin",     // Inverse sine
    "arctan",     // Inverse tangent
    "abs",        // Absolute value
    "log"         // Logarithm
  ]).describe("Mathematical operation to perform"),
  expression: z.string().describe("Mathematical expression (e.g., 'x^2+3x', '(x+1)(x-1)')"),
});
=======
const NewtonToolInputSchema = z.object({
  operation: z.enum([
    "simplify",   // Simplify expression
    "factor",     // Factor expression
    "derive",     // Derivative
    "integrate",  // Integral
    "zeroes",     // Find zeros/roots
    "tangent",    // Find tangent line
    "area",       // Area under curve
    "cos",        // Cosine
    "sin",        // Sine
    "tan",        // Tangent
    "arccos",     // Inverse cosine
    "arcsin",     // Inverse sine
    "arctan",     // Inverse tangent
    "abs",        // Absolute value
    "log"         // Logarithm
  ]).describe("Mathematical operation to perform"),
  expression: z.string().describe("Mathematical expression (e.g., 'x^2+3x', '(x+1)(x-1)')"),
  point: z.string().optional().describe("Point for tangent (e.g., '2')"),
  start: z.string().optional().describe("Start of interval for area (e.g., '0')"),
  end: z.string().optional().describe("End of interval for area (e.g., '2')"),
}).refine(data => {
  if (data.operation === 'tangent' && !data.point) return false;
  if (data.operation === 'area' && (!data.start || !data.end)) return false;
  return true;
}, {
  message: "Missing required parameters: 'point' for tangent, 'start' and 'end' for area"
});
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/newtonTool.ts
<<<<<<< SEARCH
    // Build URL
    const url = `https://newton.now.sh/api/v2/${params.operation}/${encodeURIComponent(cleanExpression)}`;
=======
    // Build URL
    let url = `https://newton.now.sh/api/v2/${params.operation}/${encodeURIComponent(cleanExpression)}`;
    if (params.operation === 'tangent') {
      url += `/${encodeURIComponent(params.point!)}`;
    } else if (params.operation === 'area') {
      url += `/${encodeURIComponent(params.start!)}/${encodeURIComponent(params.end!)}`;
    }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/newtonTool.ts
<<<<<<< SEARCH
    // Fetch result
    const response = await fetch(url, {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      }
    });
=======
    // Fetch result with timeout (10s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/newtonTool.ts
<<<<<<< SEARCH
    if (!response.ok) {
      throw new Error(`Newton API error: ${response.status} ${response.statusText}`);
    }
    
    const data: NewtonResponse = await response.json();
=======
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Newton API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    
    const data: NewtonResponse = await response.json().catch(async (jsonErr) => {
      const raw = await response.text().catch(() => "unable to read body");
      throw new Error(`Invalid JSON from Newton API: ${jsonErr.message}. Raw body: ${raw}`);
    });
>>>>>>> REPLACE
