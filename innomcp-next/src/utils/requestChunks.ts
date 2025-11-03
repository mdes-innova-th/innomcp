"use client";

import { fetchWithApiProxy } from "@/app/lib/apiProxy";

export type BatchOptions = {
  chunkSize?: number; // number of items per request
  concurrency?: number; // how many concurrent requests
  maxRetries?: number; // retries per chunk
  retryDelayMs?: number; // base delay for retry
  onProgress?: (processed: number, total: number) => void;
  // optional AbortSignal to cancel the whole batch
  signal?: AbortSignal | null;
  // optional per-chunk status callback: index, status, processed, total
  onChunk?: (
    index: number,
    status: "pending" | "in-progress" | "success" | "error",
    processed: number,
    total: number
  ) => void;
};

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * POST a large list of URLs to an endpoint in smaller chunks with limited concurrency and retries.
 * Assumes the endpoint accepts { urls: string[], ...extra } and returns an array of results for that chunk.
 */
export async function postUrlsInBatches(
  endpoint: string,
  urls: string[],
  extraPayload: Record<string, unknown> = {},
  opts: BatchOptions = {}
) {
  const chunkSize = opts.chunkSize ?? 50;
  const concurrency = opts.concurrency ?? 4;
  const maxRetries = opts.maxRetries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 500;
  const onProgress = opts.onProgress;

  const total = urls.length;
  // create chunks with their original index so callers can track per-chunk state
  const chunks: { index: number; urls: string[] }[] = [];
  let cIndex = 0;
  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push({ index: cIndex++, urls: urls.slice(i, i + chunkSize) });
  }

  const results: unknown[] = [];

  // process chunks in batches of `concurrency`
  for (let idx = 0; idx < chunks.length; idx += concurrency) {
    const group = chunks.slice(idx, idx + concurrency);

    const promises = group.map(async (chunkObj) => {
      const { index: chunkIndex, urls: chunk } = chunkObj;
      let attempt = 0;
      // notify pending->in-progress
      if (opts.onChunk)
        opts.onChunk(chunkIndex, "in-progress", results.length, total);
      while (true) {
        // respect AbortSignal before each attempt
        if (opts.signal && opts.signal.aborted) {
          // mark chunk as error on abort
          if (opts.onChunk)
            opts.onChunk(chunkIndex, "error", results.length, total);
          throw new Error("Aborted");
        }
        try {
          // dynamically import and call getCSRFToken correctly
          const { getCSRFToken } = await import("@/utils/csrf");
          const csrfToken = await getCSRFToken();
          // fetchWithApiProxy expects full endpoint url proxied, pass endpoint as-is
          const body = JSON.stringify({ urls: chunk, ...extraPayload });
          // Note: fetchWithApiProxy returns result.data in many usages; here we rely on the same shape.
          const fetchOptions: RequestInit = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken || "",
            },
            body,
          };
          // attach signal if provided so underlying fetch can be aborted
          if (opts.signal) fetchOptions.signal = opts.signal;

          const res = await fetchWithApiProxy(endpoint, fetchOptions);

          // on success per-chunk
          if (opts.onChunk)
            opts.onChunk(
              chunkIndex,
              "success",
              results.length + (Array.isArray(res) ? res.length : 1),
              total
            );

          // normalize to array
          if (Array.isArray(res)) return res;
          // Some proxy wrappers return { data } shape already handled in fetchWithApiProxy
          return res;
        } catch (err) {
          // if aborted, rethrow immediately
          if (opts.signal && opts.signal.aborted) {
            if (opts.onChunk)
              opts.onChunk(chunkIndex, "error", results.length, total);
            throw err;
          }
          attempt++;
          if (attempt > maxRetries) {
            // notify error for this chunk
            if (opts.onChunk)
              opts.onChunk(chunkIndex, "error", results.length, total);
            throw err;
          }
          const backoff = retryDelayMs * Math.pow(2, attempt - 1);
          await sleep(backoff);
        }
      }
    });

    const settled = await Promise.all(promises);

    // append in the same order as chunks
    for (const chunkRes of settled) {
      if (Array.isArray(chunkRes)) {
        results.push(...chunkRes);
      } else if (chunkRes) {
        results.push(chunkRes);
      }
      if (onProgress) onProgress(results.length, total);
    }
  }

  return results;
}
