export type ThaiKnowledgeDomain = "geo" | "law" | "history" | "religion" | "education";

export interface ThaiKnowledgeSource {
  name: string;
  url?: string;
}

export interface ThaiGeoAttributes {
  province: string;
  district?: string;
  subdistrict?: string;
  region?: string;
  lat?: number;
  lon?: number;
  [key: string]: unknown;
}

export interface KnowledgeEntityRelation {
  type: string;
  target_id: string;
}

export interface ThaiKnowledgeEntity {
  id: string;
  domain: ThaiKnowledgeDomain;
  type: string;
  name_th: string;
  aliases?: string[];
  description?: string;
  attributes?: Record<string, unknown>;
  relations?: KnowledgeEntityRelation[];
  source?: ThaiKnowledgeSource[];
  confidence: number;
  version?: string;
  updated_at?: string;
}

export interface ThaiGeoEntity extends ThaiKnowledgeEntity {
  domain: "geo";
  attributes: ThaiGeoAttributes;
}

export interface ThaiGeoToolContext {
  domain?: "geo";
  language?: string;
  confidence_required?: number;
}

export interface ThaiGeoToolInput {
  query: string;
  context?: ThaiGeoToolContext;
  filter_region?: string;
}

export interface ThaiGeoResultItem {
  id: string;
  name_th: string;
  type: string;
  attributes: ThaiGeoAttributes;
  confidence: number;
}

export interface ThaiGeoToolSuccess {
  success: true;
  domain: "geo";
  data: ThaiGeoResultItem[];
  confidence: number;
  source: ThaiKnowledgeSource[];
  note?: string;
}

export type ThaiGeoToolErrorCode = "INVALID_QUERY" | "NOT_FOUND" | "LOW_CONFIDENCE" | "DB_ERROR";

export interface ThaiGeoToolError {
  success: false;
  error_code: ThaiGeoToolErrorCode;
  message: string;
  note?: string;
}

export type ThaiGeoToolOutput = ThaiGeoToolSuccess | ThaiGeoToolError;
