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