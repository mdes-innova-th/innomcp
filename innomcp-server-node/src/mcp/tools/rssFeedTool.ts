import { z } from "zod";
import Parser from "rss-parser";

/**
 * RSS Feed Reader Tool
 * Reads and parses RSS/Atom feeds from news sites and blogs
 */

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'INNOMCP/1.0 RSS Reader'
  }
});

// Popular RSS feeds
const POPULAR_FEEDS = {
  "bbc": "http://feeds.bbci.co.uk/news/rss.xml",
  "techcrunch": "https://techcrunch.com/feed/",
  "reuters": "https://www.reutersagency.com/feed/",
  "theverge": "https://www.theverge.com/rss/index.xml",
  "hackernews": "https://hnrss.org/frontpage",
  "github": "https://github.blog/feed/",
  "stackoverflow": "https://stackoverflow.blog/feed/",
  "medium": "https://medium.com/feed/tag/technology"
};

export const rssFeedToolSchema = z.object({
  feedUrl: z.string().describe(`URL ของ RSS feed หรือชื่อแหล่งข่าวยอดนิยม (เช่น bbc, techcrunch, reuters). ตัวอย่าง: ${Object.keys(POPULAR_FEEDS).join(", ")}`),
  limit: z.number().optional().describe("จำนวนบทความที่ต้องการ (default: 5, max: 20)"),
});

export type RSSFeedInput = z.infer<typeof rssFeedToolSchema>;

export const rssFeedTool = {
  name: "rssFeedTool",
  description: `
หน้าที่: อ่านข่าวและบทความจาก RSS feeds
ใช้เมื่อ:
- ต้องการข่าวล่าสุดจากเว็บไซต์ต่างๆ
- ติดตามบล็อกและเว็บเทคโนโลยี
- รวบรวมข้อมูลจากหลายแหล่ง
- อ่านข่าวสรุป

แหล่งข่าวยอดนิยม:
- bbc: BBC News (world news)
- techcrunch: TechCrunch (technology)
- reuters: Reuters (global news)
- theverge: The Verge (tech, science)
- hackernews: Hacker News (tech discussions)
- github: GitHub Blog (developer news)
- stackoverflow: Stack Overflow Blog (programming)
- medium: Medium Technology (articles)

หรือระบุ RSS URL โดยตรง: https://example.com/feed

ตัวอย่าง:
- "ข่าวล่าสุดจาก BBC"
- "อ่าน RSS feed จาก TechCrunch"
- "ข่าวเทคโนโลยีจาก The Verge 10 ข่าว"
- "Hacker News feed"
`,
  inputSchema: rssFeedToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = rssFeedToolSchema.safeParse(args);
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

    const input = parsed.data;
    
    try {
      const { feedUrl, limit = 5 } = input;

      // Validate limit
      const validLimit = Math.min(Math.max(limit, 1), 20);

      // Check if feedUrl is a preset name
      const actualUrl = POPULAR_FEEDS[feedUrl.toLowerCase() as keyof typeof POPULAR_FEEDS] || feedUrl;

      // Validate URL format
      if (!actualUrl.startsWith("http://") && !actualUrl.startsWith("https://")) {
        throw new Error("URL ไม่ถูกต้อง กรุณาระบุ http:// หรือ https://");
      }

      // Parse RSS feed
      const feed = await parser.parseURL(actualUrl);

      if (!feed || !feed.items) {
        throw new Error("ไม่สามารถอ่าน RSS feed ได้");
      }

      // Extract feed items (limited)
      const items = feed.items.slice(0, validLimit).map(item => ({
        title: item.title || "No title",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || undefined,
        description: item.contentSnippet || item.summary || undefined,
        author: item.creator || item.author || undefined
      }));

      const result = {
        feedTitle: feed.title || "Unknown Feed",
        feedUrl: actualUrl,
        items,
        totalItems: items.length,
        success: true
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอ่าน RSS feed";
      
      console.error(`[RSS Feed Tool] Error: ${errorMessage}`);
      
      const errorResult = {
        feedTitle: "",
        feedUrl: input.feedUrl,
        items: [],
        totalItems: 0,
        success: false,
        error: errorMessage
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResult, null, 2)
          }
        ]
      };
    }
  }
};

export default rssFeedTool;
