
import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * NasaTool - NASA Open Data API Tool
 * 
 * Access NASA's vast collection of space images, missions, and astronomical data.
 * Primary API: APOD (Astronomy Picture of the Day)
 * 
 * Use cases:
 * - "ขอดูภาพ APOD วันนี้"
 * - "ภาพดาราศาสตร์เมื่อวานนี้"
 * - "APOD วันที่ 2024-01-01"
 */

// Zod schema for input validation
const NasaToolInputSchema = z.object({
  endpoint: z.enum(["apod"]).default("apod")
    .describe("NASA API endpoint (currently supports: apod)"),
  date: z.string().optional()
    .describe("Date in YYYY-MM-DD format (optional, defaults to today)"),
  count: z.number().min(1).max(100).optional()
    .describe("Number of random APOD images (optional, if specified, ignores date)")
});

type NasaToolInput = z.infer<typeof NasaToolInputSchema>;

interface APODResponse {
  copyright?: string;
  date: string;
  explanation: string;
  hdurl?: string;
  media_type: "image" | "video";
  service_version: string;
  title: string;
  url: string;
}

/**
 * In-memory cache for last-known-good APOD result.
 * Provides resilience when NASA API returns 500 or is unreachable.
 */
let apodCache: { result: string; fetchedAt: string } | null = null;

/**
 * Get NASA API key from environment or use DEMO_KEY
 */
function getNasaApiKey(): string {
  return process.env.NASA_API_KEY || "DEMO_KEY";
}

/**
 * Fetch APOD (Astronomy Picture of the Day)
 */
async function fetchAPOD(params: NasaToolInput): Promise<string> {
  const startTime = Date.now();
  const apiKey = getNasaApiKey();
  
  try {
    // Build URL
    const url = new URL("https://api.nasa.gov/planetary/apod");
    url.searchParams.set("api_key", apiKey);
    
    if (params.count) {
      // Random images mode
      url.searchParams.set("count", params.count.toString());
    } else if (params.date) {
      // Specific date mode - validate format first
      const dateStr = params.date.toLowerCase();
      
      // If date is 'today', 'now', or similar, convert to YYYY-MM-DD
      if (dateStr === 'today' || dateStr === 'now' || dateStr === 'วันนี้') {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        url.searchParams.set("date", formattedDate);
        logBoth('INFO', `[NasaTool] Converted '${params.date}' to ${formattedDate}`);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Already in correct format
        url.searchParams.set("date", dateStr);
      } else {
        // Invalid format - use today instead
        const today = new Date().toISOString().split('T')[0];
        url.searchParams.set("date", today);
        logBoth('WARN', `[NasaTool] Invalid date format '${params.date}', using today: ${today}`);
      }
    }
    // If neither count nor date, NASA API defaults to today
    
    logBoth('INFO', `[NasaTool] Fetching APOD: ${url.toString().replace(apiKey, "***")}`);
    
    // Fetch data
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NASA API error: ${response.status} - ${error}`);
    }
    
    const data: APODResponse | APODResponse[] = await response.json();
    const duration = Date.now() - startTime;
    
    logBoth('INFO', `[NasaTool] APOD fetched in ${duration}ms`);
    
    // Handle multiple results (random mode)
    if (Array.isArray(data)) {
      const result = formatMultipleAPOD(data, duration);
      apodCache = { result, fetchedAt: new Date().toISOString() };
      return result;
    }
    
    // Handle single result
    const result = formatSingleAPOD(data, duration);
    apodCache = { result, fetchedAt: new Date().toISOString() };
    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth('ERROR', `[NasaTool] Error after ${duration}ms: ${error && error.message ? error.message : error}`);
    
    // Resilience: serve cached result on upstream failure
    if (apodCache) {
      logBoth('INFO', `[NasaTool] Serving cached APOD from ${apodCache.fetchedAt}`);
      return apodCache.result + `\n\n⚠️ หมายเหตุ: ข้อมูลจากแคช (ดึงเมื่อ ${apodCache.fetchedAt}) เนื่องจาก NASA API ขัดข้อง`;
    }
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      duration: `${duration}ms`,
      hint: apiKey === "DEMO_KEY" 
        ? "Using DEMO_KEY (30 requests/hour limit). Consider getting a free API key at https://api.nasa.gov/" 
        : undefined
    }, null, 2);
  }
}

/**
 * Format single APOD result
 */
function formatSingleAPOD(data: APODResponse, duration: number): string {
  let output = `🌌 NASA Astronomy Picture of the Day\n\n`;
  
  output += `📅 Date: ${data.date}\n`;
  output += `📸 Title: **${data.title}**\n\n`;
  
  if (data.copyright) {
    output += `©️ Copyright: ${data.copyright}\n\n`;
  }
  
  output += `🔗 Image URL:\n`;
  if (data.media_type === "image") {
    output += `   Standard: ${data.url}\n`;
    if (data.hdurl) {
      output += `   HD: ${data.hdurl}\n`;
    }
  } else if (data.media_type === "video") {
    output += `   Video: ${data.url}\n`;
  }
  output += `\n`;
  
  output += `📝 Explanation:\n`;
  output += `${data.explanation}\n\n`;
  
  output += `---\n\n`;
  output += `⏱️  Retrieved in ${duration}ms\n`;
  output += `💡 Tip: Click HD link for the highest quality image`;
  
  return output;
}

/**
 * Format multiple APOD results
 */
function formatMultipleAPOD(data: APODResponse[], duration: number): string {
  let output = `🌌 NASA Random APOD Collection\n\n`;
  output += `Found ${data.length} random astronomy pictures\n\n`;
  output += `---\n\n`;
  
  data.forEach((apod, index) => {
    output += `${index + 1}. **${apod.title}** (${apod.date})\n`;
    
    if (apod.copyright) {
      output += `   ©️ ${apod.copyright}\n`;
    }
    
    if (apod.media_type === "image") {
      output += `   🔗 ${apod.hdurl || apod.url}\n`;
    } else {
      output += `   🎥 ${apod.url}\n`;
    }
    
    // Truncate explanation for multiple results
    const shortExplanation = apod.explanation.length > 150 
      ? apod.explanation.substring(0, 150) + "..." 
      : apod.explanation;
    output += `   📝 ${shortExplanation}\n\n`;
  });
  
  output += `---\n\n`;
  output += `⏱️  Retrieved in ${duration}ms\n`;
  output += `💡 Each image links to full resolution version`;
  
  return output;
}

/**
 * Tool definition for MCP
 */
export const nasaTool = {
  name: "nasa",
  description: "Access NASA's Astronomy Picture of the Day (APOD) and space mission data. Returns high-quality space images with detailed explanations. Can fetch specific dates or random collections.",
  inputSchema: NasaToolInputSchema,
  execute: async (args: unknown) => {
    // Validate input
    const parsed = NasaToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }
    
    // Currently only APOD is implemented
    if (parsed.data.endpoint === "apod") {
      const result = await fetchAPOD(parsed.data);
      return {
        content: [{ type: "text" as const, text: result }]
      };
    }
    
    const errorText = JSON.stringify({
      success: false,
      error: `Endpoint "${parsed.data.endpoint}" not yet implemented`
    }, null, 2);
    return {
      content: [{ type: "text" as const, text: errorText }]
    };
  }
};

export default nasaTool;
