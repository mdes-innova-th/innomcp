import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, ApiKeyData } from "@/app/lib/apikey";
import { getRedisClient } from "@/app/lib/redis";

// Check if a key has exceeded its rate limit using Redis
// เพิ่มตรวจสอบ IP ด้วย
export async function checkRateLimit(apiKeyData: ApiKeyData, ip?: string): Promise<boolean> {
  if (!apiKeyData.rate_limit) {
    return true; // No rate limit set, so not exceeded
  }
  console.log(`[checkRateLimit] API Key ID: ${apiKeyData.apikey_id}, Rate Limit: ${apiKeyData.rate_limit}, IP: ${ip}`);
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error("[checkRateLimit] Redis client is null, blocking request for safety.");
      return false;
    }
    const keyId = apiKeyData.apikey_id;
    const now = Date.now();
    // Key for storing timestamps in Redis with proper namespace (per key+ip)
    const redisKey = ip ? `ratelimit:${keyId}:${ip}` : `ratelimit:${keyId}`;
    await redis.zadd(redisKey, now, now.toString());
    const oneMinuteAgo = now - 60000;
    await redis.zremrangebyscore(redisKey, 0, oneMinuteAgo);
    const requestCount = await redis.zcard(redisKey);
    await redis.expire(redisKey, 120);
    const withinLimit = requestCount <= apiKeyData.rate_limit;
    console.log('[checkRateLimit] The request is within the rate limit:', withinLimit);
    return withinLimit;
  } catch (error) {
    console.error("[checkRateLimit] Error checking rate limit, blocking request for safety:", error);
    return false;
  }
}

// Middleware สำหรับตรวจสอบ API Key
export async function apiKeyMiddleware(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // รับ API Key จาก header
  const apiKey = req.headers.get("x-api-key") || req.headers.get("Authorization")?.replace("Bearer ", "") || null;
  console.log("[middleware] API Key received");
  const origin = req.headers.get("origin");
  // ดึง IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    // @ts-expect-error req.ip property doesn't exist on NextRequest type but may be available in some environments
    req.ip ||
    "unknown";

  if (!apiKey) {
    return NextResponse.json(
      { message: "API key is required" },
      { status: 401 }
    );
  }

  const { valid, apiKeyData, error } = await validateApiKey(
    apiKey,
    origin || undefined
  );
  
  if (!valid) {
    return NextResponse.json(
      { message: error || "Invalid or expired API key" },
      { status: 401 }
    );
  }

  // Check rate limits if API key has a rate limit set (by key+ip)
  if (apiKeyData?.rate_limit) {
    const withinLimit = await checkRateLimit(apiKeyData, ip);
    if (!withinLimit) {
      return NextResponse.json(
        { message: "[middleware] Rate limit exceeded", ip },
        { status: 429 }
      );
    }
  }

  return handler(req);
}
