
import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * ArchiveTool - Internet Archive API Tool
 * 
 * Searches Internet Archive for books, music, videos, and datasets.
 * API: https://archive.org/advancedsearch.php
 * 
 * Use cases:
 * - "หาหนังสือเกี่ยวกับ AI ที่อยู่ใน archive.org"
 * - "ค้นหาเพลงคลาสสิกใน archive.org"
 * - "หาวิดีโอเกี่ยวกับวิทยาศาสตร์"
 */

// Zod schema for input validation
const ArchiveToolInputSchema = z.object({
  query: z.string().describe("Search query for Internet Archive"),
  mediatype: z.enum(["texts", "audio", "movies", "software", "image", "data", "web"]).optional()
    .describe("Media type filter (optional): texts, audio, movies, software, image, data, web"),
  rows: z.number().min(1).max(100).default(10)
    .describe("Number of results to return (default: 10, max: 100)")
});

type ArchiveToolInput = z.infer<typeof ArchiveToolInputSchema>;

interface ArchiveItem {
  identifier: string;
  title: string;
  description?: string;
  creator?: string;
  date?: string;
  mediatype: string;
  downloads?: number;
  format?: string[];
  subject?: string[];
}

interface ArchiveResponse {
  responseHeader: {
    status: number;
    QTime: number;
    params: any;
  };
  response: {
    numFound: number;
    start: number;
    docs: any[];
  };
}

/**
 * Search Internet Archive
 */
async function searchArchive(params: ArchiveToolInput): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Build query parameters
    let q = params.query;
    if (params.mediatype) {
      q = `${q} AND mediatype:${params.mediatype}`;
    }
    
    // Build URL
    const url = new URL("https://archive.org/advancedsearch.php");
    url.searchParams.set("q", q);
    url.searchParams.set("fl[]", "identifier,title,description,creator,date,mediatype,downloads,format,subject");
    url.searchParams.set("rows", params.rows.toString());
    url.searchParams.set("output", "json");
    url.searchParams.set("sort[]", "downloads desc"); // Sort by popularity
    
    logBoth('INFO', `[ArchiveTool] Searching: ${url.toString()}`);
    
    // Fetch data
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Archive API error: ${response.status} ${response.statusText}`);
    }
    
    const data: ArchiveResponse = await response.json();
    const duration = Date.now() - startTime;
    
    logBoth('INFO', `[ArchiveTool] Found ${data.response.numFound} results in ${duration}ms`);
    
    // Parse results
    const items: ArchiveItem[] = data.response.docs.map((doc: any) => ({
      identifier: doc.identifier,
      title: doc.title || "Untitled",
      description: doc.description,
      creator: doc.creator,
      date: doc.date,
      mediatype: doc.mediatype,
      downloads: doc.downloads,
      format: doc.format,
      subject: doc.subject
    }));
    
    // Format output
    if (items.length === 0) {
      return JSON.stringify({
        success: true,
        query: params.query,
        mediatype: params.mediatype || "all",
        totalFound: 0,
        results: [],
        message: "ไม่พบผลลัพธ์ลองใช้คำค้นหาอื่น"
      }, null, 2);
    }
    
    // Build formatted response
    let output = `🔍 Internet Archive Search Results\n\n`;
    output += `Query: "${params.query}"\n`;
    if (params.mediatype) {
      output += `Type: ${params.mediatype}\n`;
    }
    output += `Found: ${data.response.numFound.toLocaleString()} items (showing ${items.length})\n`;
    output += `Duration: ${duration}ms\n\n`;
    output += `---\n\n`;
    
    items.forEach((item, index) => {
      output += `${index + 1}. **${item.title}**\n`;
      output += `   📦 ID: ${item.identifier}\n`;
      output += `   🔗 URL: https://archive.org/details/${item.identifier}\n`;
      
      if (item.creator) {
        output += `   👤 Creator: ${item.creator}\n`;
      }
      
      if (item.date) {
        output += `   📅 Date: ${item.date}\n`;
      }
      
      output += `   📁 Type: ${item.mediatype}\n`;
      
      if (item.downloads) {
        output += `   📥 Downloads: ${item.downloads.toLocaleString()}\n`;
      }
      
      if (item.description) {
        const desc = item.description.length > 200 
          ? item.description.substring(0, 200) + "..." 
          : item.description;
        output += `   📝 ${desc}\n`;
      }
      
      if (item.format && Array.isArray(item.format) && item.format.length > 0) {
        output += `   📄 Formats: ${item.format.slice(0, 5).join(", ")}\n`;
      }
      
      if (item.subject) {
        const subjects = Array.isArray(item.subject) ? item.subject : [item.subject];
        if (subjects.length > 0) {
          output += `   🏷️  Tags: ${subjects.slice(0, 5).join(", ")}\n`;
        }
      }
      
      output += `\n`;
    });
    
    output += `---\n\n`;
    output += `✅ Search completed successfully\n`;
    output += `💡 Tip: Click URL to view full details on archive.org`;
    
    return output;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth('ERROR', `[ArchiveTool] Error after ${duration}ms: ${String(error)}`);
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      query: params.query,
      duration: `${duration}ms`
    }, null, 2);
  }
}

/**
 * Tool definition for MCP
 */
export const archiveTool = {
  name: "archive",
  description: "Search Internet Archive for books, music, videos, software, images, and datasets. Returns metadata including title, creator, date, download count, and formats.",
  inputSchema: ArchiveToolInputSchema,
  execute: async (args: unknown) => {
    // Validate input
    const parsed = ArchiveToolInputSchema.safeParse(args);
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
    
    const result = await searchArchive(parsed.data);
    return {
      content: [{ type: "text" as const, text: result }]
    };
  }
};

export default archiveTool;
