"use client";

export type DownloadChunkOptions = {
  chunkSize?: number; // bytes per range request
  onProgress?: (downloaded: number, total: number) => void;
  fileName?: string;
  concurrency?: number; // currently not used, keep for future
  fetchOptions?: RequestInit;
};

async function fetchHead(url: string, opts?: RequestInit) {
  const r = await fetch(url, { method: "HEAD", ...opts });
  if (!r.ok) throw new Error(`HEAD request failed: ${r.status}`);
  const len = r.headers.get("content-length");
  return { contentLength: len ? parseInt(len, 10) : null, acceptRanges: r.headers.get("accept-ranges") };
}

export async function downloadFileInChunks(
  url: string,
  opts: DownloadChunkOptions = {}
) {
  const chunkSize = opts.chunkSize ?? 5 * 1024 * 1024; // 5 MB
  const onProgress = opts.onProgress;
  const fileName = opts.fileName ?? url.split("/").pop() ?? "download.bin";

  // Get content length
  const head = await fetchHead(url, opts.fetchOptions);
  const total = head.contentLength;
  if (!total) {
    // fallback to normal fetch
    const resp = await fetch(url, opts.fetchOptions);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (onProgress) onProgress(blob.size, blob.size);
    return;
  }

  const parts: Uint8Array[] = [];
  let downloaded = 0;

  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(total - 1, start + chunkSize - 1);
    const headers = { Range: `bytes=${start}-${end}` } as HeadersInit;
    const resp = await fetch(url, { headers, ...opts.fetchOptions });
    if (!(resp.ok || resp.status === 206)) {
      throw new Error(`Chunk request failed: ${resp.status}`);
    }
    const ab = await resp.arrayBuffer();
    const chunk = new Uint8Array(ab);
    parts.push(chunk);
    downloaded += chunk.byteLength;
    if (onProgress) onProgress(downloaded, total);
  }

  // concat
  const result = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }

  const blob = new Blob([result.buffer]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
