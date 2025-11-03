// Normalize protocol and domain to lowercase, keep path/query/hash as is
export function normalizeUrlProtocolDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.protocol = urlObj.protocol.toLowerCase();
    urlObj.hostname = urlObj.hostname.toLowerCase();
    let normalized = urlObj.protocol + "//" + urlObj.host;
    if (urlObj.pathname) normalized += urlObj.pathname;
    if (urlObj.search) normalized += urlObj.search;
    if (urlObj.hash) normalized += urlObj.hash;
    return normalized;
  } catch {
    return url; // fallback if invalid
  }
}
