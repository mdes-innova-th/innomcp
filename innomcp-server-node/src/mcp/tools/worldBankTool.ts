import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * worldBankTool - World Bank Open Data API Tool
 * 
 * Access economic indicators from World Bank databases.
 * API: World Bank Open Data API
 * 
 * Use cases:
 * - "GDP ไทย 2024 เท่าไหร่"
 * - "Population of Thailand"
 * - "Inflation rate in USA"
 */

// Zod schema for input validation
const worldBankToolInputSchema = z.object({
  country: z.string().min(2).describe("Country code (ISO 3166-1 alpha-2, e.g., TH, US, GB) or name"),
  indicator: z.string().describe("World Bank indicator code (e.g., NY.GDP.MKTP.CD for GDP, SP.POP.TOTL for population)"),
  startYear: z.number().min(1960).max(2030).optional()
    .describe("Start year for data range (optional)"),
  endYear: z.number().min(1960).max(2030).optional()
    .describe("End year for data range (optional)")
});

type worldBankToolInput = z.infer<typeof worldBankToolInputSchema>;

// Common indicators for easy reference
const COMMON_INDICATORS = {
  "GDP": "NY.GDP.MKTP.CD", // GDP (current US$)
  "GDP_GROWTH": "NY.GDP.MKTP.KD.ZG", // GDP growth (annual %)
  "POPULATION": "SP.POP.TOTL", // Population, total
  "INFLATION": "FP.CPI.TOTL.ZG", // Inflation, consumer prices (annual %)
  "UNEMPLOYMENT": "SL.UEM.TOTL.ZS", // Unemployment, total (% of total labor force)
  "LIFE_EXPECTANCY": "SP.DYN.LE00.IN", // Life expectancy at birth
  "CO2_EMISSIONS": "EN.ATM.CO2E.PC", // CO2 emissions (metric tons per capita)
  "INTERNET_USERS": "IT.NET.USER.ZS", // Internet users (% of population)
};

interface WorldBankData {
  page: number;
  pages: number;
  per_page: number;
  total: number;
}

interface IndicatorValue {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

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

/**
 * Fetch World Bank data
 */
async function fetchWorldBankData(params: worldBankToolInput): Promise<string> {
  const startTime = Date.now();
  
  try {
    const indicatorCode = resolveIndicatorCode(params.indicator);
    
    // Build URL (Use HTTPS)
    const dateRange = params.startYear && params.endYear 
      ? `${params.startYear}:${params.endYear}`
      : params.startYear 
      ? `${params.startYear}:${new Date().getFullYear()}`
      : "";
    
    // Ensure country is valid (default to 'TH' if empty/invalid, though Zod checks min length)
    const countryCode = (params.country || "TH").trim();

    const url = dateRange
      ? `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?date=${dateRange}&format=json&per_page=100`
      : `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?format=json&per_page=100`;
    
    logBoth("INFO", `[worldBankTool] Fetching: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`World Bank API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    // World Bank returns [metadata, data]
    if (!Array.isArray(data) || data.length < 2) {
      throw new Error("Invalid response format from World Bank API");
    }
    
    const metadata: WorldBankData = data[0];
    const values: IndicatorValue[] = data[1];
    
    logBoth("INFO", `[worldBankTool] Found ${values.length} data points in ${duration}ms`);
    
    if (!values || values.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No data found",
        country: params.country,
        indicator: indicatorCode,
        hint: "Try different years or check if indicator code is correct"
      }, null, 2);
    }
    
    return formatWorldBankData(values, indicatorCode, duration);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth("ERROR", `[worldBankTool] Error after ${duration}ms: ${String(error)}`);
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      country: params.country,
      indicator: params.indicator,
      duration: `${duration}ms`,
      hint: "Common indicators: GDP, POPULATION, INFLATION, UNEMPLOYMENT, LIFE_EXPECTANCY"
    }, null, 2);
  }
}

/**
 * Format World Bank data
 */
function formatWorldBankData(values: IndicatorValue[], indicator: string, duration: number): string {
  // Sort by year (descending)
  const sorted = values
    .filter(v => v.value !== null)
    .sort((a, b) => parseInt(b.date) - parseInt(a.date));
  
  if (sorted.length === 0) {
    return JSON.stringify({
      success: false,
      error: "No non-null values found in the data"
    }, null, 2);
  }
  
  const latest = sorted[0];
  const country = latest.country.value;
  const indicatorName = latest.indicator.value;
  
  let output = `🌍 World Bank Data\n\n`;
  
  output += `📍 Country: **${country}** (${latest.country.id})\n`;
  output += `📊 Indicator: **${indicatorName}**\n`;
  output += `🔖 Code: ${indicator}\n\n`;
  
  output += `---\n\n`;
  
  // Latest value (highlighted)
  output += `📌 **Latest Data (${latest.date})**\n`;
  output += `   Value: **${formatNumber(latest.value)}**\n\n`;
  
  // Historical data (last 10 years)
  if (sorted.length > 1) {
    output += `📈 **Historical Data**\n\n`;
    
    sorted.slice(0, 10).forEach(item => {
      output += `   ${item.date}: ${formatNumber(item.value)}\n`;
    });
    
    if (sorted.length > 10) {
      output += `   ... and ${sorted.length - 10} more years\n`;
    }
    output += `\n`;
    
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
  }
  
  output += `---\n\n`;
  output += `⏱️  Retrieved in ${duration}ms\n`;
  output += `🔗 Source: World Bank Open Data`;
  
  return output;
}

/**
 * Format number with commas and appropriate decimals
 */
function formatNumber(value: number | null): string {
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (Math.abs(value) >= 1e12) {
    return `${(value / 1e12).toFixed(2)} trillion`;
  } else if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(2)} billion`;
  } else if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(2)} million`;
  } else if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  } else {
    return value.toFixed(2);
  }
}

/**
 * Tool definition for MCP
 */
export const worldBankTool = {
  name: "worldbank",
  description: "Access World Bank economic and development indicators for countries worldwide. Supports GDP, population, inflation, unemployment, life expectancy, CO2 emissions, and hundreds of other indicators. Returns historical data with trends.",
  inputSchema: worldBankToolInputSchema,
  execute: async (args: unknown) => {
    // Validate input
    const parsed = worldBankToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues,
        hint: "Common indicators: GDP, POPULATION, INFLATION, UNEMPLOYMENT, LIFE_EXPECTANCY"
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }
    
    const result = await fetchWorldBankData(parsed.data);
    return {
      content: [{ type: "text" as const, text: result }]
    };
  }
};

export default worldBankTool;

/**
 * Helper: List of common country codes
 * TH - Thailand, US - United States, GB - United Kingdom, CN - China
 * JP - Japan, DE - Germany, FR - France, IN - India, BR - Brazil
 * Complete list: https://www.iban.com/country-codes
 */
