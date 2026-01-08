
import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * GovDataTool - US Government Data.gov API Tool
 * 
 * Access US government open data including census, transportation, health, education, and more.
 * API: Data.gov CKAN API
 * 
 * Use cases:
 * - "จำนวนประชากรสหรัฐล่าสุด"
 * - "ข้อมูลสุขภาพสาธารณะในอเมริกา"
 * - "ข้อมูลการจราจรของสหรัฐ"
 */

// Zod schema for input validation
const GovDataToolInputSchema = z.object({
  query: z.string().describe("Search query for datasets (e.g., 'census', 'health', 'transportation')"),
  rows: z.number().min(1).max(100).default(10)
    .describe("Number of results to return (default: 10, max: 100)"),
  category: z.string().optional()
    .describe("Category filter (optional): health, education, transportation, environment, etc.")
});

type GovDataToolInput = z.infer<typeof GovDataToolInputSchema>;

interface CKANDataset {
  id: string;
  name: string;
  title: string;
  notes: string;
  metadata_created: string;
  metadata_modified: string;
  organization: {
    title: string;
    name: string;
  };
  tags: Array<{ name: string }>;
  resources: Array<{
    id: string;
    name: string;
    description: string;
    format: string;
    url: string;
  }>;
}

interface CKANResponse {
  success: boolean;
  result: {
    count: number;
    results: CKANDataset[];
  };
}

/**
 * Search Data.gov datasets
 */
async function searchGovData(params: GovDataToolInput): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Build query
    let q = params.query;
    if (params.category) {
      q = `${q} AND tags:${params.category}`;
    }
    
    // Build URL - using CKAN API
    const url = new URL("https://catalog.data.gov/api/3/action/package_search");
    url.searchParams.set("q", q);
    url.searchParams.set("rows", params.rows.toString());
    url.searchParams.set("sort", "metadata_modified desc"); // Latest first
    
    logBoth('INFO', `[GovDataTool] Searching: ${url.toString()}`);
    
    // Fetch data
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Data.gov API error: ${response.status} ${response.statusText}`);
    }
    
    const data: CKANResponse = await response.json();
    const duration = Date.now() - startTime;
    
    if (!data.success) {
      throw new Error("API request failed");
    }
    
    logBoth('INFO', `[GovDataTool] Found ${data.result.count} datasets in ${duration}ms`);
    
    // Parse results
    const datasets = data.result.results;
    
    if (datasets.length === 0) {
      return JSON.stringify({
        success: true,
        query: params.query,
        totalFound: 0,
        results: [],
        message: "ไม่พบผลลัพธ์ ลองใช้คำค้นหาอื่น"
      }, null, 2);
    }
    
    return formatGovData(datasets, data.result.count, params.query, duration);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth('ERROR', `[GovDataTool] Error after ${duration}ms: ${error && error.message ? error.message : error}`);
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      query: params.query,
      duration: `${duration}ms`,
      hint: "Try broader search terms like 'census', 'health', 'education', 'transportation'"
    }, null, 2);
  }
}

/**
 * Format government data results
 */
function formatGovData(datasets: CKANDataset[], totalCount: number, query: string, duration: number): string {
  let output = `🏛️  US Government Open Data\n\n`;
  
  output += `Query: "${query}"\n`;
  output += `Found: ${totalCount.toLocaleString()} datasets (showing ${datasets.length})\n`;
  output += `Duration: ${duration}ms\n\n`;
  output += `---\n\n`;
  
  datasets.forEach((dataset, index) => {
    output += `${index + 1}. **${dataset.title}**\n`;
    output += `   🆔 ID: ${dataset.name}\n`;
    output += `   🏢 Organization: ${dataset.organization.title}\n`;
    
    // Dates
    const created = new Date(dataset.metadata_created).toLocaleDateString("en-US");
    const modified = new Date(dataset.metadata_modified).toLocaleDateString("en-US");
    output += `   📅 Created: ${created}, Modified: ${modified}\n`;
    
    // Description
    if (dataset.notes) {
      const desc = dataset.notes.length > 200 
        ? dataset.notes.substring(0, 200).replace(/<[^>]*>/g, "") + "..." 
        : dataset.notes.replace(/<[^>]*>/g, "");
      output += `   📝 ${desc}\n`;
    }
    
    // Tags
    if (dataset.tags && dataset.tags.length > 0) {
      const tags = dataset.tags.slice(0, 5).map(t => t.name).join(", ");
      output += `   🏷️  Tags: ${tags}\n`;
    }
    
    // Resources
    if (dataset.resources && dataset.resources.length > 0) {
      output += `   📦 Resources (${dataset.resources.length}):\n`;
      
      dataset.resources.slice(0, 3).forEach(resource => {
        output += `      • ${resource.format || "N/A"}: ${resource.name || "Unnamed"}\n`;
        output += `        ${resource.url}\n`;
      });
      
      if (dataset.resources.length > 3) {
        output += `      ... and ${dataset.resources.length - 3} more resources\n`;
      }
    }
    
    // Link to full dataset
    output += `   🔗 View: https://catalog.data.gov/dataset/${dataset.name}\n`;
    output += `\n`;
  });
  
  output += `---\n\n`;
  output += `✅ Search completed successfully\n`;
  output += `💡 Tip: Visit catalog.data.gov to explore datasets interactively`;
  
  return output;
}

/**
 * Tool definition for MCP
 */
export const govDataTool = {
  name: "govdata",
  description: "Search US government open data from Data.gov. Access census, health, education, transportation, environment, and thousands of other datasets. Returns dataset metadata and download links.",
  inputSchema: GovDataToolInputSchema,
  execute: async (args: unknown) => {
    // Validate input
    const parsed = GovDataToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues,
        hint: "Try queries like: 'census population', 'health statistics', 'transportation data'"
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }
    
    const result = await searchGovData(parsed.data);
    return {
      content: [{ type: "text" as const, text: result }]
    };
  }
};

export default govDataTool;

/**
 * Popular Data.gov categories:
 * - Census & Demographics
 * - Health & Healthcare
 * - Education
 * - Transportation
 * - Environment & Climate
 * - Public Safety
 * - Economy & Commerce
 * - Agriculture
 * - Energy
 * - Science & Research
 */
