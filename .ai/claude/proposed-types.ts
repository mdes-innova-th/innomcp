/**
 * INNOMCP - Proposed TypeScript Types
 * Date: 2026-02-07
 * Reviewer: Claude (Senior Pair Programmer)
 *
 * These types map to the DB schema in tables.sql + database_schema.sql
 * Ready to paste into the project when approved.
 */

// ============================================
// Main DB (innomcp-db) - Existing Tables
// ============================================

export interface User {
  user_id: number;
  username: string;
  password: string | null;
  user_email: string | null;
  user_dispname: string;
  user_birthdate: string | null; // DATE as ISO string
  user_active: '0' | '1';
  reset_token: string | null;
  reset_token_expire: string | null; // DATETIME as ISO string
  userrole_id: number;
  user_phone: string | null;
  user_pwd: string | null;
  user_disp_name: string | null;
  user_nickname: string | null;
  user_profile_image: string | null;
  user_role_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserRole {
  userrole_id: number;
  userrole_name: string;
}

export interface UserLog {
  userlog_id: number;
  ipaddress: string | null;
  activity: string | null;
  date: string; // DATETIME
  user_id: number;
}

export interface ApiKey {
  apikey_id: number;
  apikey: string;
  status: 'active' | 'inactive' | 'revoke';
  apikey_name: string | null;
  create: string | null; // TIMESTAMP
  expire: string | null;
  update: string | null;
  rate_limit: number | null;
  allowed_origins: string | null;
  user_id: number | null;
}

export interface Section {
  section_id: number;
  section_name: string;
}

export interface SectionUser {
  section_user_id: number;
  section_id: number;
  user_id: number;
  section_user_date: string; // DATE
}

export interface FastpathPhrase {
  id: number;
  category: string;
  phrase: string;
  lang: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Main DB - New Tables (tables.sql)
// ============================================

export interface QueryLog {
  id: number;
  query_text: string;
  detected_category: string;
  ai_mode: string;
  response_time_ms: number | null;
  success: boolean;
  created_at: string;
}

export interface AmbiguityCase {
  id: number;
  query_log_id: number;
  top1_category: string;
  top1_score: number;
  top2_category: string;
  top2_score: number;
  score_gap: number;
  llm_judge_decision: string;
  created_at: string;
}

export interface ToolCategory {
  id: string; // VARCHAR(64) - e.g. "weather", "evidence"
  name: string;
  description: string | null;
  priority_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KeywordTraining {
  id: number;
  keyword: string;
  category: string; // FK -> tool_categories.id
  confidence_score: number; // 0.0 to 1.0
  priority_level: 'critical' | 'high' | 'normal' | 'low';
  language: string; // 'th', 'en', 'xx'
  hit_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SemanticEmbedding {
  id: number;
  ref_type: 'keyword' | 'category';
  ref_id: string;
  embedding_vector: number[] | null; // JSON array of floats
  model_version: string;
  created_at: string;
}

// ============================================
// Thai Knowledge DB
// ============================================

export type KnowledgeDomain = 'geo' | 'law' | 'religion' | 'history' | 'general';

export interface KnowledgeEntityAliases {
  [index: number]: string; // Array of alternate names
}

export interface KnowledgeEntityAttributes {
  // Domain-specific - flexible JSON
  [key: string]: unknown;
}

export interface KnowledgeEntityRelation {
  type: string;       // e.g. "located_in", "part_of", "related_to"
  target_id: number;  // FK to another knowledge_entities.id
  label?: string;
}

export interface KnowledgeEntity {
  id: number;
  domain: KnowledgeDomain;
  name_th: string;
  aliases: string[] | null; // JSON array
  description: string | null;
  attributes: KnowledgeEntityAttributes | null; // JSON object
  relations: KnowledgeEntityRelation[] | null;  // JSON array
  source: string | null;
  confidence: number; // 0.0 to 1.0
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Response type from thaiKnowledgeTool */
export interface ThaiKnowledgeResult {
  success: boolean;
  data?: KnowledgeEntity[];
  message?: string;
  confidence: number;
  error?: string;
}

// ============================================
// Evidence / Detect DB Types
// ============================================

/**
 * Evidence DB entry (assumed schema from evidenceTool.ts)
 * WARNING: Actual schema needs verification via tables_schema_dump.ts
 */
export interface DetectEntry {
  url: string;
  title: string | null;
  http_status: number | null;
  isp_name: string | null;
  case_number: string | null;
  create_date: string | null;
  sent_isp_date: string | null;
  update_date: string | null;
  video_path?: string | null; // May not exist - used in report_top_urls
}

/** evidenceTool action types */
export type EvidenceAction =
  | 'list_tables'
  | 'describe_table'
  | 'query_recent'
  | 'custom_query'
  | 'report_latest_undetected'
  | 'report_top_urls';

export interface EvidenceToolInput {
  action: EvidenceAction;
  tableName?: string;
  limit?: number;
  sql?: string;
}

// ============================================
// Keyword Tool Types
// ============================================

export type KeywordAction = 'add' | 'list';

export interface KeywordToolInput {
  action: KeywordAction;
  keyword?: string;
  category?: string;
}

// ============================================
// Storage Tool Types
// ============================================

export type StorageOperation = 'write' | 'read' | 'list';

export interface StorageToolInput {
  operation: StorageOperation;
  filename?: string;
  content?: string;
}

// ============================================
// MCP Tool Response (Standard)
// ============================================

export interface McpToolContent {
  type: 'text';
  text: string;
}

export interface McpToolResponse {
  content: McpToolContent[];
}
