/**
 * OpenSearch Module
 * ค้นหาข้อมูลจากเว็บผ่าน Search APIs
 * 
 * รองรับ:
 * - Google Custom Search API
 * - SerpAPI
 * - Brave Search API
 * - DuckDuckGo Instant Answer API (public fallback)
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  domain?: string;
  score?: number; // Relevance score
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTime: number; // milliseconds
  sources: Array<{
    name: string;
    url?: string;
  }>;
}

function flattenDuckDuckGoTopics(topics: any[]): any[] {
  const flattened: any[] = [];

  for (const topic of topics || []) {
    if (Array.isArray(topic?.Topics)) {
      flattened.push(...flattenDuckDuckGoTopics(topic.Topics));
      continue;
    }

    if (topic?.FirstURL && topic?.Text) {
      flattened.push(topic);
    }
  }

  return flattened;
}

function buildDuckDuckGoResult(url: string, rawText: string, fallbackTitle: string): SearchResult | null {
  const cleanUrl = String(url || '').trim();
  const cleanText = String(rawText || '').replace(/<[^>]+>/g, '').trim();
  if (!cleanUrl || !cleanText) {
    return null;
  }

  const [titlePart, ...rest] = cleanText.split(' - ');
  let domain: string | undefined;
  try {
    domain = new URL(cleanUrl).hostname;
  } catch {
    domain = undefined;
  }

  return {
    title: titlePart || fallbackTitle,
    url: cleanUrl,
    snippet: rest.length > 0 ? rest.join(' - ') : cleanText,
    domain,
  };
}

/**
 * ค้นหาด้วย Google Custom Search API
 */
export async function searchWithGoogle(
  query: string,
  topK: number = 5
): Promise<SearchResponse> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX; // Custom Search Engine ID

  if (!apiKey || !cx) {
    throw new Error('Google Search API credentials not configured');
  }

  const startTime = Date.now();

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
      query
    )}&num=${topK}`;

    const response = await fetch(url, { timeout: 5000 } as any);

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();

    const results: SearchResult[] = (data.items || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      domain: new URL(item.link).hostname,
    }));

    return {
      query,
      results,
      totalResults: parseInt(data.searchInformation?.totalResults || '0'),
      searchTime: Date.now() - startTime,
      sources: [
        {
          name: 'Google Custom Search',
          url: 'https://developers.google.com/custom-search',
        },
      ],
    };
  } catch (error: any) {
    console.error('[OpenSearch] Google error:', error.message);
    throw new Error('Failed to search with Google');
  }
}

/**
 * ค้นหาด้วย SerpAPI
 */
export async function searchWithSerpAPI(
  query: string,
  topK: number = 5
): Promise<SearchResponse> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error('SerpAPI credentials not configured');
  }

  const startTime = Date.now();

  try {
    const url = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(
      query
    )}&api_key=${apiKey}&num=${topK}`;

    const response = await fetch(url, { timeout: 5000 } as any);

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = await response.json();

    const results: SearchResult[] = (data.organic_results || [])
      .slice(0, topK)
      .map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        domain: new URL(item.link).hostname,
        score: item.position,
      }));

    return {
      query,
      results,
      totalResults: parseInt(data.search_information?.total_results || '0'),
      searchTime: Date.now() - startTime,
      sources: [
        {
          name: 'SerpAPI',
          url: 'https://serpapi.com',
        },
      ],
    };
  } catch (error: any) {
    console.error('[OpenSearch] SerpAPI error:', error.message);
    throw new Error('Failed to search with SerpAPI');
  }
}

/**
 * ค้นหาด้วย Brave Search API
 */
export async function searchWithBrave(
  query: string,
  topK: number = 5
): Promise<SearchResponse> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    throw new Error('Brave Search API credentials not configured');
  }

  const startTime = Date.now();

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
      query
    )}&count=${topK}`;

    const response = await fetch(url, {
      headers: {
        'X-Subscription-Token': apiKey,
      },
      timeout: 5000,
    } as any);

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status}`);
    }

    const data = await response.json();

    const results: SearchResult[] = (data.web?.results || [])
      .slice(0, topK)
      .map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        publishedAt: item.age,
        domain: new URL(item.url).hostname,
      }));

    return {
      query,
      results,
      totalResults: data.web?.results?.length || 0,
      searchTime: Date.now() - startTime,
      sources: [
        {
          name: 'Brave Search',
          url: 'https://search.brave.com',
        },
      ],
    };
  } catch (error: any) {
    console.error('[OpenSearch] Brave error:', error.message);
    throw new Error('Failed to search with Brave');
  }
}

/**
 * ค้นหาด้วย DuckDuckGo Instant Answer API (ไม่ต้องใช้ key)
 */
export async function searchWithDuckDuckGo(
  query: string,
  topK: number = 5
): Promise<SearchResponse> {
  const startTime = Date.now();

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const response = await fetch(url, { timeout: 5000 } as any);

    if (!response.ok) {
      throw new Error(`DuckDuckGo error: ${response.status}`);
    }

    const data = await response.json();
    const abstractResult = buildDuckDuckGoResult(
      String(data.AbstractURL || ''),
      String(data.AbstractText || ''),
      String(data.Heading || query)
    );

    const relatedResults = flattenDuckDuckGoTopics(data.RelatedTopics || [])
      .map((item: any) => buildDuckDuckGoResult(item.FirstURL, item.Text, query))
      .filter(Boolean) as SearchResult[];

    const results = [
      ...(abstractResult ? [abstractResult] : []),
      ...relatedResults,
    ].slice(0, topK);

    return {
      query,
      results,
      totalResults: results.length,
      searchTime: Date.now() - startTime,
      sources: [
        {
          name: 'DuckDuckGo Instant Answer',
          url: 'https://duckduckgo.com',
        },
      ],
    };
  } catch (error: any) {
    console.error('[OpenSearch] DuckDuckGo error:', error.message);
    throw new Error('Failed to search with DuckDuckGo');
  }
}

/**
 * ค้นหาแบบ fallback (ลองทุก API)
 */
export async function search(query: string, topK: number = 5): Promise<SearchResponse> {
  const errors: string[] = [];

  // Try Google first
  if (process.env.GOOGLE_SEARCH_API_KEY) {
    try {
      return await searchWithGoogle(query, topK);
    } catch (error: any) {
      errors.push(`Google: ${error.message}`);
    }
  }

  // Try SerpAPI
  if (process.env.SERPAPI_API_KEY) {
    try {
      return await searchWithSerpAPI(query, topK);
    } catch (error: any) {
      errors.push(`SerpAPI: ${error.message}`);
    }
  }

  // Try Brave
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      return await searchWithBrave(query, topK);
    } catch (error: any) {
      errors.push(`Brave: ${error.message}`);
    }
  }

  try {
    return await searchWithDuckDuckGo(query, topK);
  } catch (error: any) {
    errors.push(`DuckDuckGo: ${error.message}`);
  }

  throw new Error(
    `All search providers failed. Errors: ${errors.join('; ')}`
  );
}

/**
 * กรองผลลัพธ์ตามโดเมนคุณภาพสูง
 */
const HIGH_QUALITY_DOMAINS = [
  // ราชการไทย
  '.go.th',
  '.ac.th',
  // ข่าวไทย
  'thairath.co.th',
  'khaosod.co.th',
  'matichon.co.th',
  'bangkokpost.com',
  'nationthailand.com',
  // สากล
  'wikipedia.org',
  'reuters.com',
  'bbc.com',
  'cnn.com',
  // เทคโนโลยี
  'github.com',
  'stackoverflow.com',
  'medium.com',
];

export function filterHighQualityResults(
  results: SearchResult[]
): SearchResult[] {
  return results.filter((result) => {
    const domain = result.domain || new URL(result.url).hostname;
    return HIGH_QUALITY_DOMAINS.some((hqDomain) => domain.includes(hqDomain));
  });
}

/**
 * จัดรูปแบบผลการค้นหาเป็นภาษาไทย
 */
export function formatSearchResponse(response: SearchResponse): string {
  let text = `**ผลการค้นหา:** "${response.query}"\n`;
  text += `พบ ${response.totalResults.toLocaleString()} ผลลัพธ์ ใช้เวลา ${response.searchTime}ms\n\n`;

  response.results.forEach((result, index) => {
    text += `**${index + 1}. ${result.title}**\n`;
    text += `   ${result.snippet}\n`;
    text += `   🔗 ${result.url}\n\n`;
  });

  text += `**แหล่งข้อมูล:**\n`;
  response.sources.forEach((source) => {
    text += `• ${source.name}\n`;
  });

  return text;
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. เพิ่ม rate limiting สำหรับแต่ละ API
 * 2. Cache ผลการค้นหาระยะสั้น (5-10 นาที)
 * 3. ใช้ semantic search เพื่อ re-rank ผลลัพธ์
 * 4. เพิ่ม content extraction จาก URLs
 * 5. รองรับ image search, news search
 */
