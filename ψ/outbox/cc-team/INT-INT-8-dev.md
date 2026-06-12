<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-8 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":69,"completion_tokens":460,"total_tokens":529,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":230,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-12T03:48:49.634Z -->
export interface AnalyticsStatsResponse {
  totalRequests: number;
  totalTokens: number;
  averageLatency: number;
  requestsByModel: Record<string, number>;
  requestsByDay: Record<string, number>;
  timestamp: string;
}

export interface MdesModelsResponse {
  models: MdesModelResponse[];
  total: number;
}

export interface MdesModelResponse {
  id: string;
  name: string;
  version: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ThaiDetectRequest {
  text: string;
}

export interface ThaiDetectResponse {
  isThai: boolean;
  confidence: number;
  detectedScript: string;
}

export interface ThaiTokenizeResponse {
  tokens: string[];
  originalText: string;
  tokenCount: number;
}

export interface ThaiEntitiesResponse {
  entities: Array<{
    text: string;
    type: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  originalText: string;
}
