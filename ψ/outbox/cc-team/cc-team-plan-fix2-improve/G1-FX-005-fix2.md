<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-005 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3484,"completion_tokens":4292,"total_tokens":7776,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3816,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:32:21.625Z -->
FILE: innomcp-node/src/agents/toolDispatch.ts
<<<<<<< SEARCH
import { checkToolAccess, type GuestLimits } from "../middleware/guestLimiter";

const MCP_URL = (process.env.MCPSERVER_URL ?? "http://localhost:3012/mcp").replace(/\/$/, "");
=======
import { checkToolAccess, type GuestLimits } from "../middleware/guestLimiter";
import { extractThaiProvince } from "../services/thaiProvinceExtractor";

const MCP_URL = (process.env.MCPSERVER_URL ?? "http://localhost:3012/mcp").replace(/\/$/, "");
>>>>>>> REPLACE

FILE: innomcp-node/src/agents/toolDispatch.ts
<<<<<<< SEARCH
  const noCommas = expr.replace(/,(?=\d{3}(\D|$))/g, "");
  const safe = noCommas.match(/[0-9+\-*/%^().\s\[\]]+/g)?.join(" ").trim();
  return safe && /\d/.test(safe) ? safe : expr;
=======
  const noCommas = expr.replace(/,(?=\d{3}(\D|$))/g, "");
  const safe = noCommas.match(/[0-9+\-*/%^().\s\[\]]+/g)?.join(" ").trim();
  if (safe && /\d/.test(safe)) return safe;
  return "__NO_EXPR__";
>>>>>>> REPLACE

FILE: innomcp-node/src/agents/toolDispatch.ts
<<<<<<< SEARCH
  if (intent === "calc") {
    return {
      toolName: "calculatorTool",
      args: { expression: extractMathExpression(trimmed) },
      reason: "calculation intent",
      authoritative: true,
    };
  }
=======
  if (intent === "calc") {
    const expr = extractMathExpression(trimmed);
    if (expr === "__NO_EXPR__") return null;
    return {
      toolName: "calculatorTool",
      args: { expression: expr },
      reason: "calculation intent",
      authoritative: true,
    };
  }
>>>>>>> REPLACE
