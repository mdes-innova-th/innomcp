// This utility helps with retrieving and applying nonces for Content Security Policy
import { headers, cookies } from "next/headers";
import { cache } from "react";

/**
 * Generates a random nonce using Web Crypto API (for server-side use)
 * Compatible with Edge Runtime
 */
export function generateNonce(): string {
  try {
    if (typeof crypto === "undefined") {
      console.warn("Web Crypto API not available, falling back to Math.random");
      // Use Math.random as fallback but make it more stable
      // This should only happen in very old environments
      const random1 = Math.floor(Math.random() * 0xFFFFFFFF).toString(36);
      const random2 = Math.floor(Math.random() * 0xFFFFFFFF).toString(36);
      return `fallback_${random1}_${random2}`;
    }

    // Create a random array of 16 bytes (128 bits)
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);

    // Convert to base64 and clean up for CSP compatibility
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(randomBytes)));
    // Remove padding and make it CSP-safe
    return base64.replace(/[+/=]/g, (char) => {
      switch (char) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return char;
      }
    });
  } catch (error) {
    console.error("Failed to generate nonce:", error);
    // Use Math.random as fallback to prevent hydration mismatches
    const random1 = Math.floor(Math.random() * 0xFFFFFFFF).toString(36);
    const random2 = Math.floor(Math.random() * 0xFFFFFFFF).toString(36);
    return `error_${random1}_${random2}`;
  }
}

/**
 * Gets the nonce from cookies first, then headers as fallback
 * This provides better performance by reusing nonces from cookies
 * and reduces server load by avoiding unnecessary nonce generation
 */
export const getNonce = cache(async function getNonce(): Promise<string> {
  try {
    // Check if we're in a static generation context
    if (process.env.NODE_ENV === 'production' && process.env.BUILD_TIME === 'true') {
      console.warn("getNonce called during static generation, returning empty string");
      return "";
    }
    
    // Primary method: get nonce from cookies (better performance)
    try {
      const cookieStore = await cookies();
      const nonceCookie = cookieStore.get("csp_nonce")?.value;
      if (nonceCookie && nonceCookie.length > 0) {
        return nonceCookie;
      }
    } catch (cookieError) {
      console.debug("Could not access cookies, falling back to headers:", cookieError);
    }
    
    // Fallback to headers (less efficient but ensures compatibility)
    try {
      const headersList = await headers();
      const nonce = headersList.get("x-nonce");
      
      if (nonce && nonce.length > 0) {
        return nonce;
      }
    } catch (headerError) {
      console.debug("Could not access headers:", headerError);
    }
    
    console.warn("Nonce not found in cookies or headers. CSP may not work properly.");
    return "";
  } catch (error) {
    console.warn("Failed to get nonce from cookies/headers:", error);
    // Return an empty string if we can't get the nonce
    // This could happen during static generation
    return "";
  }
});

/**
 * Creates the nonce attribute for HTML elements
 */
export async function getNonceAttribute(): Promise<
  { nonce: string } | Record<string, never>
> {
  const nonce = await getNonce();
  return nonce ? { nonce } : {};
}


// Tailwind CSS does not require inline <style> tags, so createNonceStyleTag is not needed.
// Use nonce only with HTML elements that require it, e.g. <script> or SSR <style>.

/**
 * Gets nonce for client-side usage (returns empty string if not available)
 */
export async function getClientNonce(): Promise<string> {
  try {
    const nonce = await getNonce();
    return nonce || "";
  } catch {
    return "";
  }
}
