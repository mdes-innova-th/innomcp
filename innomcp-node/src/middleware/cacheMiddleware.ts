import { Request, Response, NextFunction } from "express";

interface CacheEntry {
  data: string;
  contentType: string;
  cachedAt: number;
  ttlMs: number;
}

const cache = new Map<string, CacheEntry>();

export function cacheResponse(ttlMs: number = 30_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    const userId = (req as any).user?.id ?? (req as any).apiKeyData?.apikey_id ?? "anon";
    const key = `${req.path}?${JSON.stringify(req.query)}:${userId}`;
    const hit = cache.get(key);

    if (hit && Date.now() - hit.cachedAt < hit.ttlMs) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Content-Type", hit.contentType);
      return res.send(hit.data);
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data: unknown) => {
      const body = JSON.stringify(data);
      cache.set(key, {
        data: body,
        contentType: "application/json",
        cachedAt: Date.now(),
        ttlMs,
      });
      res.setHeader("X-Cache", "MISS");
      res.setHeader("Content-Type", "application/json");
      return res.send(body);
    };

    next();
  };
}

export function clearCache(pathPrefix?: string): void {
  if (!pathPrefix) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.startsWith(pathPrefix)) cache.delete(key);
  }
}

export function getCacheStats(): { size: number; keys: string[] } {
  return { size: cache.size, keys: Array.from(cache.keys()).slice(0, 20) };
}
