/**
 * webSearchTool — Searches the web via a configurable search API.
 *
 * @remarks
 * The tool reads the environment variable `SEARCH_API_URL` (must be a valid URL)
 * to know which backend to call. If the variable is missing or invalid,
 * `run()` returns an error explaining how to configure it.
 *
 * The API is expected to accept at least the query parameters `q` (search terms)
 * and `count` (max. number of results) and respond with JSON whose shape is:
 *   `{ results: Array<{ title: string; url: string; snippet: string }> }`
 *
 * The tool always produces a Markdown artifact listing the results.
 *
 * @example
 * // Basic usage – returns top-5 results as Markdown
 * const outcome = await webSearchTool.run(
 *   { query: 'TypeScript best practices', topN: 3 },
 *   {}
 * );
 * console.log(outcome.artifacts?.[0]?.content); // Markdown list
 *
 * @example
 * // Using an AbortSignal for timeout
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000);
 * const res = await webSearchTool.run(
 *   { query: 'AI safety' },
 *   { signal: controller.signal }
 * );
 * // result.ok === false, result.error contains timeout message
 * */

import { Tool } from '../types/tool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Extract an array of SearchResult objects from the API response.
 * Tries the commonly used keys `results`, `items`, `data`.
 */
function extractResults(body: unknown): SearchResult[] {
  if (Array.isArray(body)) return parseResultArray(body);
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;
    for (const key of ['results', 'items', 'data']) {
      const candidate = obj[key];
      if (Array.isArray(candidate)) return parseResultArray(candidate);
    }
  }
  throw new Error('Response does not contain a recognised results array');
}

function parseResultArray(arr: unknown[]): SearchResult[] {
  return arr.map((item: any, idx: number) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Result at index ${idx} is not an object`);
    }
    const title = String(item.title ?? '').trim();
    const url = String(item.url ?? '').trim();
    const snippet = String(item.snippet ?? '').trim();
    if (!title || !url) {
      throw new Error(
        `Result at index ${idx} is missing required 'title' or 'url'`,
      );
    }
    return { title, url, snippet };
  });
}

function isValidUrl(candidate: string): boolean {
  try {
    new URL(candidate);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_TOP_N = 5;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------
const webSearchTool: Tool = {
  name: 'webSearch',
  description:
    'Search the web for information. Returns a markdown list of results with titles, URLs, and snippets.',

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search terms',
      },
      topN: {
        type: 'number',
        description:
          'Maximum number of results to return (default: 5)',
        default: DEFAULT_TOP_N,
      },
    },
    required: ['query'],
  },

  async run(
    input: any,
    ctx: { signal?: AbortSignal },
  ): Promise<{
    ok: boolean;
    output?: any;
    error?: string;
    artifacts?: { name: string; mime: string; content: string }[];
  }> {
    // --- Validate input ----------------------------------------------------
    const query = typeof (input as any)?.query === 'string' ? (input as any).query.trim() : '';
    if (!query) {
      return { ok: false, error: 'Missing or invalid "query" parameter (must be a non‑empty string)' };
    }

    let topN = DEFAULT_TOP_N;
    if (typeof (input as any)?.topN === 'number') {
      topN = Math.max(1, Math.floor((input as any).topN));
    }

    // --- Check configuration -----------------------------------------------
    const apiUrl = process.env['SEARCH_API_URL']?.trim();
    if (!apiUrl || !isValidUrl(apiUrl)) {
      return {
        ok: false,
        error:
          'Search API is not configured. Set the SEARCH_API_URL environment variable to a valid URL.',
      };
    }

    // --- Build request URL -------------------------------------------------
    let requestUrl: URL;
    try {
      requestUrl = new URL(apiUrl);
      requestUrl.searchParams.set('q', query);
      requestUrl.searchParams.set('count', String(topN));
    } catch (err: unknown) {
      return {
        ok: false,
        error: `Invalid search API URL: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // --- Perform fetch -----------------------------------------------------
    let response: Response;
    try {
      response = await fetch(requestUrl.toString(), {
        signal: ctx.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, error: 'Search request aborted' };
      }
      return {
        ok: false,
        error: `Network or fetch failure: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Search API responded with status ${response.status} ${response.statusText}`,
      };
    }

    // --- Parse JSON body ---------------------------------------------------
    let body: unknown;
    try {
      body = await response.json();
    } catch (err: unknown) {
      return {
        ok: false,
        error: `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // --- Extract results ---------------------------------------------------
    let results: SearchResult[];
    try {
      results = extractResults(body);
    } catch (err: unknown) {
      return {
        ok: false,
        error: `Unable to extract results from API response: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // --- Build Markdown artifact -------------------------------------------
    const lines: string[] = [`# Search Results for "${query}"`];
    for (const r of results) {
      lines.push(`- [${r.title}](${r.url}): ${r.snippet}`);
    }
    const markdown = lines.join('\n');

    return {
      ok: true,
      output: { results, query, topN },
      artifacts: [
        {
          name: 'search_results.md',
          mime: 'text/markdown',
          content: markdown,
        },
      ],
    };
  },
};

export default webSearchTool;
