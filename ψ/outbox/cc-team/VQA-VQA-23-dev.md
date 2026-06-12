<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-23 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":76,"completion_tokens":399,"total_tokens":475,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":247,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-12T04:21:54.113Z -->
export interface ProviderStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  details?: Record<string, unknown>;
}

export interface BuildInfo {
  version: string;
  commit?: string;
  timestamp?: string;
  buildNumber?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: ProviderStatus[];
  build: BuildInfo;
  mcp_status: 'connected' | 'disconnected' | 'error';
  uptime: number; // seconds
  version: string;
}

export interface WSHealthResponse {
  reachable: boolean;
  host: string;
  latencyMs: number;
}
