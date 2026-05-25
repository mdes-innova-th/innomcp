/**
 * webFetchTool.ts — Web Fetch service for Private Agent Studio
 *
 * Features:
 * - SSRF protection: blocks private/loopback/link-local IP ranges
 * - Fetches URL with 500KB size cap and configurable timeout
 * - Converts HTML → clean Markdown (strips scripts/ads/nav)
 * - Saves Markdown artifact to workspace/artifacts/web/
 * - 1h result cache to avoid redundant re-fetches
 * - Respects User-Agent header (INNOMCP-WebFetch/1.0)
 */

import * as https from "node:https";
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";

export interface FetchResult {
  url: string;
  title: string;
  markdown: string;
  wordCount: number;
  fetchedAt: number;
  cached: boolean;
  artifactPath?: string;
  error?: string;
}

// SSRF protection: block private/loopback/link-local IP ranges
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^169\.254\./,   // link-local / AWS metadata
  /^fc00:/i,       // IPv6 unique local
  /^fe80:/i,       // IPv6 link-local
];

export function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((p) => p.test(hostname));
}

const MAX_RESPONSE_BYTES = 500 * 1024; // 500KB hard cap
const CACHE_TTL_MS = 3_600_000;        // 1 hour

// Simple HTML → Markdown extractor (no external dependencies)
export function htmlToMarkdown(html: string, baseUrl: string): { title: string; markdown: string } {
  // Strip script, style, and layout boilerplate
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(nav|header|footer|aside|iframe|noscript|form|button)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract title
  const titleMatch = clean.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : (() => { try { return new URL(baseUrl).hostname; } catch { return "Untitled"; } })();

  // Convert structural elements to Markdown
  clean = clean
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n#### $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const fetchedAt = new Date().toISOString();
  const markdown = `# ${title}\n\n> Source: ${baseUrl}\n> Fetched: ${fetchedAt}\n\n${clean}`;
  return { title, markdown };
}

async function fetchRawHtml(url: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try { parsed = new URL(url); } catch (e) { return reject(new Error("Invalid URL")); }

    if (isBlockedHost(parsed.hostname)) {
      return reject(new Error(`SSRF: blocked host ${parsed.hostname}`));
    }

    const client = url.startsWith("https") ? https : http;
    let size = 0;
    let settled = false;

    const req = (client.get as Function)(
      url,
      {
        headers: {
          "User-Agent": "INNOMCP-WebFetch/1.0 (research bot; +https://innomcp.ai)",
          Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
        },
        timeout: timeoutMs,
      },
      (res: http.IncomingMessage) => {
        // Follow single redirect
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          req.destroy();
          if (!settled) {
            settled = true;
            fetchRawHtml(res.headers.location, timeoutMs).then(resolve).catch(reject);
          }
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy();
            if (!settled) { settled = true; reject(new Error("Response too large (>500KB)")); }
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString("utf-8")); }
        });
        res.on("error", (e: Error) => { if (!settled) { settled = true; reject(e); } });
      }
    );

    req.on("error", (e: Error) => { if (!settled) { settled = true; reject(e); } });
    req.on("timeout", () => {
      req.destroy();
      if (!settled) { settled = true; reject(new Error(`Timeout after ${timeoutMs}ms`)); }
    });
  });
}

export async function webFetch(
  url: string,
  opts: {
    workspaceRoot: string;
    cacheDir?: string;
    saveArtifact?: boolean;
    timeoutMs?: number;
  }
): Promise<FetchResult> {
  // Pre-validate URL and SSRF before any I/O
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return { url, title: "", markdown: "", wordCount: 0, fetchedAt: Date.now(), cached: false, error: "Invalid URL" };
  }

  if (isBlockedHost(parsed.hostname)) {
    return {
      url, title: "", markdown: "", wordCount: 0,
      fetchedAt: Date.now(), cached: false,
      error: `SSRF: blocked host ${parsed.hostname}`,
    };
  }

  const cacheDir = opts.cacheDir
    ? path.resolve(opts.workspaceRoot, opts.cacheDir)
    : path.resolve(opts.workspaceRoot, ".cache", "web-fetch");

  const cacheKey = crypto.createHash("md5").update(url).digest("hex");
  const cacheFile = path.join(cacheDir, `${cacheKey}.json`);

  // Check 1-hour cache
  try {
    const raw = await fs.readFile(cacheFile, "utf-8");
    const cached = JSON.parse(raw) as FetchResult;
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { ...cached, cached: true };
    }
  } catch {
    /* cache miss — continue */
  }

  try {
    const html = await fetchRawHtml(url, opts.timeoutMs);
    const { title, markdown } = htmlToMarkdown(html, url);
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    let artifactPath: string | undefined;
    if (opts.saveArtifact !== false) {
      const artifactsDir = path.resolve(opts.workspaceRoot, "artifacts", "web");
      await fs.mkdir(artifactsDir, { recursive: true });
      const safeName =
        parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, "_") +
        "-" + cacheKey.slice(0, 8) + ".md";
      artifactPath = path.join(artifactsDir, safeName);
      await fs.writeFile(artifactPath, markdown, "utf-8");
    }

    const result: FetchResult = {
      url,
      title,
      markdown: markdown.slice(0, 50_000), // cap in-memory payload
      wordCount,
      fetchedAt: Date.now(),
      cached: false,
      artifactPath,
    };

    // Persist to cache
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(result), "utf-8");

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return {
      url, title: "", markdown: "", wordCount: 0,
      fetchedAt: Date.now(), cached: false,
      error: message,
    };
  }
}
