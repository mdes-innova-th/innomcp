<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-033 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3605,"completion_tokens":6990,"total_tokens":10595,"prompt_tokens_details":{"cached_tokens":3584,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5883,"image_tokens":0},"cache_creation_input_tokens":0} | 62s
 generated: 2026-06-13T12:07:50.372Z -->
FILE: innomcp-server-node/src/mcp/tools/worldBankTool.ts
<<<<<<< SEARCH
/**
 * Resolve indicator code from common names
 */
function resolveIndicatorCode(indicator: string): string {
  const upper = indicator.toUpperCase();
  
  // Direct match
  if (upper in COMMON_INDICATORS) {
    return COMMON_INDICATORS[upper as keyof typeof COMMON_INDICATORS];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(COMMON_INDICATORS)) {
    if (upper.includes(key)) {
      return value;
    }
  }
  
  // Return as-is (assume it's a valid code)
  return indicator;
}
=======
/**
 * Resolve indicator code from common names
 */
function resolveIndicatorCode(indicator: string): string {
  const upper = indicator.toUpperCase();
  
  // Direct match
  if (upper in COMMON_INDICATORS) {
    return COMMON_INDICATORS[upper as keyof typeof COMMON_INDICATORS];
  }
  
  // Return as-is (assume it's a valid code)
  return indicator;
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/worldBankTool.ts
<<<<<<< SEARCH
  // Calculate trend
    if (sorted.length >= 2) {
      const oldest = sorted[sorted.length - 1];
      
      // Only calculate trend if both values are not null
      if (latest.value !== null && oldest.value !== null) {
        const change = latest.value - oldest.value;
        const percentChange = ((change / oldest.value) * 100).toFixed(2);
        const trend = change > 0 ? "📈 Increasing" : change < 0 ? "📉 Decreasing" : "➡️  Stable";
        
        output += `📊 **Trend (${oldest.date} to ${latest.date})**\n`;
        output += `   ${trend}\n`;
        output += `   Change: ${formatNumber(change)} (${percentChange}%)\n\n`;
      } else {
        output += `📊 **Trend**\n`;
        output += `   Insufficient data for trend calculation\n\n`;
      }
    }
=======
  // Calculate trend
    if (sorted.length >= 2) {
      const oldest = sorted[sorted.length - 1];
      
      // Only calculate trend if both values are not null
      if (latest.value !== null && oldest.value !== null) {
        const change = latest.value - oldest.value;
        const percentChangeStr = oldest.value !== 0
          ? `${((change / oldest.value) * 100).toFixed(2)}%`
          : "N/A";
        const trend = change > 0 ? "📈 Increasing" : change < 0 ? "📉 Decreasing" : "➡️  Stable";
        
        output += `📊 **Trend (${oldest.date} to ${latest.date})**\n`;
        output += `   ${trend}\n`;
        output += `   Change: ${formatNumber(change)} (${percentChangeStr})\n\n`;
      } else {
        output += `📊 **Trend**\n`;
        output += `   Insufficient data for trend calculation\n\n`;
      }
    }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/worldBankTool.ts
<<<<<<< SEARCH
const worldBankToolInputSchema = z.object({
  country: z.string().min(2).describe("Country code (ISO 3166-1 alpha-2, e.g., TH, US, GB) or name"),
  indicator: z.string().describe("World Bank indicator code (e.g., NY.GDP.MKTP.CD for GDP, SP.POP.TOTL for population)"),
  startYear: z.number().min(1960).max(2030).optional()
    .describe("Start year for data range (optional)"),
  endYear: z.number().min(1960).max(2030).optional()
    .describe("End year for data range (optional)")
});
=======
const worldBankToolInputSchema = z.object({
  country: z.string().trim().min(2).describe("Country code (ISO 3166-1 alpha-2, e.g., TH, US, GB) or name"),
  indicator: z.string().describe("World Bank indicator code (e.g., NY.GDP.MKTP.CD for GDP, SP.POP.TOTL for population)"),
  startYear: z.number().min(1960).max(2030).optional()
    .describe("Start year for data range (optional)"),
  endYear: z.number().min(1960).max(2030).optional()
    .describe("End year for data range (optional)")
}).refine(({ startYear, endYear }) => !startYear || !endYear || startYear <= endYear, { message: 'startYear must not be later than endYear' });
>>>>>>> REPLACE
