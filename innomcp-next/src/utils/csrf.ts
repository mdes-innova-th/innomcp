"use client";

export async function fetchWithCSRF(url: string, options: RequestInit = {}) {
  // Get the CSRF token first
  const csrfToken = await getCSRFToken();

  // Add the token to the request headers
  const headers = {
    ...options.headers,
    "X-CSRF-Token": csrfToken,
  } as Record<string, string>;

  // Only set Content-Type if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers: headers as HeadersInit,
    credentials: "include", // Include cookies for CSRF protection
  });
}

// ใช้ CSRF token สำหรับ API ที่ Next backend
export async function getCSRFToken() {
  // Try Next internal route first, then fall back to the proxied node endpoint
  const paths = ["/api/csrf", "/api-get/csrf"];
  let csrfToken: string | undefined;
  for (const p of paths) {
    try {
      const csrfResponse = await fetch(p, { credentials: "include" });
      if (!csrfResponse.ok) continue;
      const data = await csrfResponse.json();
      if (data?.csrfToken) {
        csrfToken = data.csrfToken;
        break;
      }
    } catch {
      // ignore and try next
    }
  }
  return csrfToken;
}
