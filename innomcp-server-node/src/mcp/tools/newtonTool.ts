import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * NewtonTool - Symbolic Math API Tool
 * 
 * Perform symbolic mathematics operations using Newton API.
 * API: https://newton.now.sh
 * 
 * Use cases:
 * - "หาอนุพันธ์ของ x^2 + 3x" → derive
 * - "simplify (x+1)(x-1)" → simplify
 * - "integrate x^2" → integrate
 * 
 * ⚡ ULTRA FAST - Instant symbolic math without AI
 */

// Zod schema for input validation
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

type NewtonToolInput = z.infer<typeof NewtonToolInputSchema>;

interface NewtonResponse {
  operation: string;
  expression: string;
  result: string;
}

/**
 * Perform symbolic math operation
 */
async function performSymbolicMath(params: NewtonToolInput): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Clean expression (URL encode)
    const cleanExpression = params.expression
      .replace(/\s+/g, "")  // Remove spaces
      .replace(/\^/g, "^"); // Keep caret as-is
    
    // Build URL
    const url = `https://newton.now.sh/api/v2/${params.operation}/${encodeURIComponent(cleanExpression)}`;
    
    logBoth("INFO", `[NewtonTool] ${params.operation}(${params.expression})`);
    
    // Fetch result
    const response = await fetch(url, {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Newton API error: ${response.status} ${response.statusText}`);
    }
    
    const data: NewtonResponse = await response.json();
    const duration = Date.now() - startTime;
    
    logBoth("INFO", `[NewtonTool] Result: ${data.result} (${duration}ms)`);
    
    return formatSymbolicResult(data, duration);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth("ERROR", `[NewtonTool] Error after ${duration}ms: ${String(error)}`);
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      operation: params.operation,
      expression: params.expression,
      duration: `${duration}ms`,
      hint: "Check expression syntax. Example: 'x^2+3x' or '(x+1)(x-1)'"
    }, null, 2);
  }
}

/**
 * Format symbolic math result
 */
function formatSymbolicResult(data: NewtonResponse, duration: number): string {
  let output = `🧮 Symbolic Math Result\n\n`;
  
  // Operation emoji mapping
  const opEmoji: Record<string, string> = {
    "simplify": "🔄",
    "factor": "🔢",
    "derive": "📈",
    "integrate": "∫",
    "zeroes": "🎯",
    "tangent": "📐",
    "area": "📊",
    "cos": "〰️",
    "sin": "〰️",
    "tan": "〰️",
    "arccos": "🔙",
    "arcsin": "🔙",
    "arctan": "🔙",
    "abs": "| |",
    "log": "📉"
  };
  
  const emoji = opEmoji[data.operation] || "🔢";
  
  output += `${emoji} **Operation**: ${data.operation}\n`;
  output += `📝 **Expression**: ${data.expression}\n`;
  output += `✅ **Result**: **${data.result}**\n\n`;
  
  // Add explanation for common operations
  switch (data.operation) {
    case "derive":
      output += `💡 This is the derivative (อนุพันธ์) of the expression.\n`;
      break;
    case "integrate":
      output += `💡 This is the integral (ปริพันธ์) of the expression.\n`;
      output += `   Note: Integration constant C is omitted.\n`;
      break;
    case "simplify":
      output += `💡 Expression simplified to its simplest form.\n`;
      break;
    case "factor":
      output += `💡 Expression factored into products.\n`;
      break;
    case "zeroes":
      output += `💡 These are the x-values where the function equals zero.\n`;
      break;
    case "tangent":
      output += `💡 Equation of the tangent line.\n`;
      break;
    case "area":
      output += `💡 Area under the curve (definite integral).\n`;
      break;
  }
  
  output += `\n⚡ **Computed in ${duration}ms** (instant symbolic calculation)\n`;
  output += `🚀 Much faster than asking AI for symbolic math!`;
  
  return output;
}

/**
 * Tool definition for MCP
 */
export const newtonTool = {
  name: "newton",
  description: "⚡ ULTRA-FAST symbolic mathematics: derivatives, integrals, simplification, factoring, finding zeros, and more. Returns exact symbolic results instantly without AI processing. Much faster than asking AI for math.",
  inputSchema: NewtonToolInputSchema,
  execute: async (args: unknown) => {
    // Validate input
    const parsed = NewtonToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues,
        examples: [
          "derive x^2+3x → 2x+3",
          "integrate x^2 → (1/3)x^3",
          "simplify (x+1)(x-1) → x^2-1",
          "factor x^2-1 → (x-1)(x+1)",
          "zeroes x^2-4 → [-2, 2]"
        ]
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }
    
    const result = await performSymbolicMath(parsed.data);
    return {
      content: [{ type: "text" as const, text: result }]
    };
  }
};

export default newtonTool;

/**
 * Supported Operations:
 * 
 * 1. simplify - Simplify algebraic expression
 *    Example: simplify (x+1)(x-1) → x^2-1
 * 
 * 2. factor - Factor expression into products
 *    Example: factor x^2-1 → (x-1)(x+1)
 * 
 * 3. derive - Find derivative
 *    Example: derive x^2+3x → 2x+3
 * 
 * 4. integrate - Find integral
 *    Example: integrate x^2 → (1/3)x^3
 * 
 * 5. zeroes - Find roots/zeros
 *    Example: zeroes x^2-4 → [-2, 2]
 * 
 * 6. tangent - Find tangent line at point
 *    Example: tangent x^2|x=2 → 4x-4
 * 
 * 7. area - Calculate area under curve
 *    Example: area x^2:0:2 → 8/3
 * 
 * 8. cos/sin/tan/arccos/arcsin/arctan - Trigonometric functions
 * 9. abs - Absolute value
 * 10. log - Logarithm
 */
