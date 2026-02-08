export const THAI_KNOWLEDGE_DOMAINS = [
  "geo",
  "law",
  "history",
  "religion",
  "education",
] as const;

export type ThaiKnowledgeDomain = (typeof THAI_KNOWLEDGE_DOMAINS)[number];

export interface ThaiKnowledgeSource {
  name: string;
  url?: string;
}

export interface ThaiKnowledgeEntity {
  id: string;
  domain: ThaiKnowledgeDomain;
  name_th: string;
  aliases?: string[];
  description: string;
  attributes: Record<string, unknown>;
  relations: Array<{
    type: string;
    target_id: string;
  }>;
  source: ThaiKnowledgeSource;
  confidence: number; // 0..1
  version: string; // semver
  updated_at: string; // ISO-8601
}

export interface ThaiKnowledgeLookupRequest {
  query: string;
  domain?: ThaiKnowledgeDomain;
  limit?: number;
}

export interface ThaiKnowledgeLookupResponse {
  query: string;
  matched: ThaiKnowledgeEntity[];
  meta?: {
    mode: "db" | "stub";
    limit: number;
  };
}
