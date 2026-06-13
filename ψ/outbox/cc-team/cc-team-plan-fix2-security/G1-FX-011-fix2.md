<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-011 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3147,"completion_tokens":7110,"total_tokens":10257,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6439,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T11:36:40.053Z -->
FILE: innomcp-node/src/services/modelLoadBalancer.ts
<<<<<<< SEARCH
import { EventEmitter } from 'events';

=======
import { EventEmitter } from 'events';
import { isIP, isIPv4, isIPv6 } from 'net';

>>>>>>> REPLACE

FILE: innomcp-node/src/services/modelLoadBalancer.ts
<<<<<<< SEARCH
  addModel(config: ModelConfig): void {
    if (this.models.has(config.id)) {
=======
  addModel(config: ModelConfig): void {
    this.validateEndpoint(config.endpoint);
    if (this.models.has(config.id)) {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/modelLoadBalancer.ts
<<<<<<< SEARCH
  }

  /**
   * Removes a model by ID.
=======
  }

  private validateEndpoint(endpoint: string): void {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error(`Invalid endpoint URL: ${endpoint}`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`Endpoint must use HTTPS: ${endpoint}`);
    }
    const hostname = url.hostname;
    if (hostname.toLowerCase() === 'localhost') {
      throw new Error(`Private/internal endpoint not allowed: ${endpoint}`);
    }
    if (isIP(hostname)) {
      if (isIPv4(hostname)) {
        const parts = hostname.split('.').map(Number);
        const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        if (
          (ipNum >= 0x0A000000 && ipNum <= 0x0AFFFFFF) ||   // 10.0.0.0/8
          (ipNum >= 0xAC100000 && ipNum <= 0xAC1FFFFF) ||   // 172.16.0.0/12
          (ipNum >= 0xC0A80000 && ipNum <= 0xC0A8FFFF) ||   // 192.168.0.0/16
          (ipNum >= 0x7F000000 && ipNum <= 0x7FFFFFFF) ||   // 127.0.0.0/8
          (ipNum >= 0xA9FE0000 && ipNum <= 0xA9FEFFFF)      // 169.254.0.0/16
        ) {
          throw new Error(`Private/internal endpoint not allowed: ${endpoint}`);
        }
      } else if (isIPv6(hostname)) {
        if (
          hostname === '::1' ||
          hostname.startsWith('fe80:') ||
          hostname.startsWith('fc') ||
          hostname.startsWith('fd')
        ) {
          throw new Error(`Private/internal endpoint not allowed: ${endpoint}`);
        }
      }
    }
  }

  /**
   * Removes a model by ID.
>>>>>>> REPLACE
