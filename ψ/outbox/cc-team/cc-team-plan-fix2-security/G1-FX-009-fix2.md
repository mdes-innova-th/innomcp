<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-009 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3311,"completion_tokens":3570,"total_tokens":6881,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2992,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T11:35:16.691Z -->
FILE: innomcp-node/src/services/imageGenService.ts
<<<<<<< SEARCH
      throw new Error(`Gateway HTTP ${res.status}: ${await res.text().catch(() => "")}`);
=======
      throw new Error(`Gateway HTTP ${res.status}`);
>>>>>>> REPLACE

SKIP: Prompt injection mitigation requires a moderation service integration, which is a feature addition and outside the scope of a minimal code fix.

FILE: innomcp-node/src/services/imageGenService.ts
<<<<<<< SEARCH
function buildPollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true`;
}
=======
function buildPollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true`;
}

function isValidGatewayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    // Block known internal hostnames/IPs to prevent SSRF
    const hostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/imageGenService.ts
<<<<<<< SEARCH
  const gatewayUrl = process.env.IMAGE_GEN_GATEWAY_URL?.trim();
  const gatewayToken = process.env.IMAGE_GEN_GATEWAY_TOKEN?.trim();
  const timeoutMs = parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "60000", 10);

  // ─ Try MDES Gateway ─
  if (gatewayUrl) {
=======
  const gatewayUrl = process.env.IMAGE_GEN_GATEWAY_URL?.trim();
  const gatewayToken = process.env.IMAGE_GEN_GATEWAY_TOKEN?.trim();
  const timeoutMs = parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "60000", 10);

  // Validate gateway URL to prevent SSRF
  const validGateway = gatewayUrl && isValidGatewayUrl(gatewayUrl);
  if (!validGateway && gatewayUrl) {
    logBoth("warn", `[ImageGen] Gateway URL is invalid or unsafe, skipping gateway`);
  }

  // ─ Try MDES Gateway ─
  if (validGateway) {
>>>>>>> REPLACE
