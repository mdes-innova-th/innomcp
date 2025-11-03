"use client";

/**
 * Utility function to make API requests through the Next.js API proxy
 * This prevents exposing API keys to the client
 *
 * @param endpoint The API endpoint to call (e.g., "/api/url-stats/by-date")
 * @param options Optional fetch options (method, body, etc.)
 * @param keyName The environment variable name for the API key (default: DASHBOARD_API_KEY)
 * @returns The API response data
 */
export async function fetchWithApiProxy(
  endpoint: string,
  options: RequestInit = {}
) {
  try {
    // Build the proxy URL
    const proxyUrl = `/api/proxy?endpoint=${encodeURIComponent(endpoint)}`;

    // Make the request through the proxy
    const response = await fetch(proxyUrl, options);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();

    // Check if the proxy request was successful
    if (!result.success) {
      throw new Error(result.data?.message || "API error occurred");
    }

    return result.data;
  } catch (error) {
    console.error("catch-Error in fetchWithApiProxy:", error);
    throw error;
  }
}
