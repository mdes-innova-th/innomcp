// Utility for extracting client IP from request
export function extractClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    // @ts-expect-error request.ip property doesn't exist on Request type but may be available in some environments
    request.ip ||
    "unknown"
  );
}

// Utility for safely getting API key from env
// NOTE: This function is now async because it may fetch from API
export async function getApiKey(
  user_id: string,
  jwttoken: string
): Promise<string | null> {
  // Use absolute URL for fetch (support server-side)
  const host = `http://${process.env.HOST}:${process.env.PORT || 3001}`;
  const tokenName = process.env.TOKEN_NAME || "token";

  try {
    console.log(
      `[getApiKey] Fetching API key for user_id ${user_id} from ${host}`
    );
    const res = await fetch(`${host}/api/apikey/${user_id}`, {
      headers: {
        Cookie: `${tokenName}=${jwttoken}`,
      },
    });
    console.log(
      `[getApiKey] API key fetch response status: ${res.status} for user_id ${user_id} from ${host}`
    );
    if (res.ok) {
      const data = await res.json();
      // รองรับ response ที่เป็น { apikeys: [...] }
      if (data && data.apikeys && data.apikeys.length > 0) {
        console.log(
          `[getApiKey] Using API key from database for user_id ${user_id}`
        );
        // คืนค่า apikey ตัวแรก (หรือจะเลือก logic อื่นได้ตามต้องการ)
        return data.apikeys[0].apikey;
      } else {
        console.log(
          `[getApiKey] Response received but no apikeys found for user_id ${user_id} from ${host}`
        );
        console.error(
          `[getApiKey] No active API keys found for user_id ${user_id}`
        );
      }
    } else {
      console.log(
        `[getApiKey] API key fetch failed for user_id ${user_id}: ${res.status} from ${host}`
      );
      console.error(
        `[getApiKey] API key fetch failed for user_id ${user_id}: ${res.status}`
      );
    }
  } catch (e) {
    // Ignore fetch error, fallback to env
    console.log(
      `[getApiKey] catch-Error fetching API key: ${
        (e as Error).message
      } for user_id ${user_id} from ${host}`
    );
  }
  // Fallback: ถ้าไม่สามารถดึงจาก API ได้ ให้ใช้ BASE_API_KEY จาก env
  const apiKey = process.env.BASE_API_KEY;
  if (!apiKey) {
    console.error(`[getApiKey] API key not found in environment variables`);
    return null;
  }
  console.log(
    `[getApiKey] Using API key from environment variables: ${apiKey}`
  );
  return apiKey;
}

// Utility for forwarding query params except some keys
export function forwardQueryParams(
  from: URLSearchParams,
  to: URLSearchParams,
  exclude: string[] = ["endpoint", "key"]
) {
  from.forEach((value, key) => {
    if (!exclude.includes(key)) {
      to.append(key, value);
    }
  });
}
