// Client-side nonce utilities
"use client";

// Client-side nonce utilities with performance optimizations
"use client";

// Cache the nonce value to avoid repeated cookie parsing
let cachedNonce: string | null = null;
let lastCookieString: string | null = null;

/**
 * Gets nonce from cookies on the client side with caching for better performance
 */
export function getClientNonce(): string {
  try {
    if (typeof document === "undefined") {
      return "";
    }
    
    // Use cached value if cookies haven't changed
    const currentCookieString = document.cookie;
    if (cachedNonce !== null && currentCookieString === lastCookieString) {
      return cachedNonce;
    }
    
    // Parse cookies to find csp_nonce
    const cookies = currentCookieString.split(";");
    const nonceCookie = cookies.find(cookie => 
      cookie.trim().startsWith("csp_nonce=")
    );
    
    if (nonceCookie) {
      const nonceValue = nonceCookie.split("=")[1]?.trim() || "";
      // Cache the result
      cachedNonce = nonceValue;
      lastCookieString = currentCookieString;
      return nonceValue;
    }
    
    // Cache empty result
    cachedNonce = "";
    lastCookieString = currentCookieString;
    return "";
  } catch (error) {
    console.warn("Failed to get nonce from client cookies:", error);
    return "";
  }
}

/**
 * Creates nonce attribute object for client-side use
 */
export function getClientNonceAttribute(): { nonce: string } | Record<string, never> {
  const nonce = getClientNonce();
  return nonce ? { nonce } : {};
}

/**
 * Hook for using nonce in React components
 */
export function useNonce(): string {
  try {
    return getClientNonce();
  } catch {
    return "";
  }
}

/**
 * Clears the cached nonce value (useful for testing or when cookies change)
 */
export function clearNonceCache(): void {
  cachedNonce = null;
  lastCookieString = null;
}
