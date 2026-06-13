<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-39 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":1734,"total_tokens":1798,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1000,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-13T05:27:16.323Z -->
import { Request, Response, NextFunction } from 'express';
import zlib from 'node:zlib';

export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip if client does not accept gzip
  const acceptEncoding = req.headers['accept-encoding'];
  if (!acceptEncoding || !acceptEncoding.includes('gzip')) {
    return next();
  }

  // Skip if response already has a content-encoding header
  if (res.getHeader('Content-Encoding')) {
    return next();
  }

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const chunks: Buffer[] = [];
  let totalLength = 0;
  let isFirstCall = true;

  // Override res.write to buffer data
  res.write = function (chunk: any, encoding?: BufferEncoding | ((error?: Error) => void), callback?: (error?: Error) => void): boolean {
    if (isFirstCall) {
      isFirstCall = false;
    }
    if (chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);
      chunks.push(buffer);
      totalLength += buffer.length;
      return true; // Simulate successful write
    }
    return true;
  } as typeof res.write;

  // Override res.end to flush the buffer, possibly compress, then call original end
  res.end = function (this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void): Response {
    // If a chunk is passed directly to end, handle it as well
    if (chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);
      chunks.push(buffer);
      totalLength += buffer.length;
    }

    // Determine if compression is beneficial
    const shouldCompress = totalLength > 1024; // 1 KB

    if (!shouldCompress) {
      // Send uncompressed
      const finalBuffer = Buffer.concat(chunks);
      res.removeHeader('Content-Length'); // Remove because we are about to set it
      res.setHeader('Content-Length', finalBuffer.length);
      return originalEnd(finalBuffer, callback as any);
    }

    // Compress using gzip
    zlib.gzip(Buffer.concat(chunks), (err, compressed) => {
      if (err) {
        // Compression failed, fall back to uncompressed
        console.error('Gzip compression error:', err);
        const finalBuffer = Buffer.concat(chunks);
        res.removeHeader('Content-Length');
        res.setHeader('Content-Length', finalBuffer.length);
        return originalEnd(finalBuffer, callback as any);
      }

      // Set gzip headers
      res.removeHeader('Content-Length');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', compressed.length);
      // Remove Transfer-Encoding if it was chunked (we set content-length now)
      if (res.getHeader('Transfer-Encoding') === 'chunked') {
        res.removeHeader('Transfer-Encoding');
      }

      // Send compressed data
      return originalEnd(compressed, callback as any);
    });

    // Return the response object to allow chaining (simulate original end)
    return this;
  } as typeof res.end;

  next();
}
