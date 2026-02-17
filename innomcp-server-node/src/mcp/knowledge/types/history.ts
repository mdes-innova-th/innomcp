/**
 * Phase 2: Thai History Knowledge — Domain Type Contracts
 *
 * Discriminated union on `entity_type` enforces correct attributes per type.
 * These types define the TARGET schema — the existing ThaiHistoryAttributes
 * in thaiHistoryTool.ts should be migrated to use these.
 *
 * @see docs/phases/phase2-history/PHASE2_SPEC.md
 * @see docs/architecture/THAI_KNOWLEDGE_SCHEMA.json
 */

import type { ThaiKnowledgeSource } from "../../tools/thaiKnowledge.types";

// ---------------------------------------------------------------------------
// Entity Type Discriminator
// ---------------------------------------------------------------------------

export type HistoryEntityType = "era" | "person" | "event";

// ---------------------------------------------------------------------------
// Domain-Specific Attribute Interfaces (Discriminated Union)
// ---------------------------------------------------------------------------

/** Attributes for a historical era / kingdom (e.g. Sukhothai, Ayutthaya) */
export interface HistoryEra {
  entity_type: "era";
  capital?: string;
  year_start: number; // CE year
  year_end?: number; // undefined = ongoing (Rattanakosin)
  period: string; // Buddhist Era format, e.g. "พ.ศ. 1792–1981"
  key_figures: string[];
  successor_era?: string; // entity id ref, e.g. "history:ayutthaya"
  predecessor_era?: string;
}

/** Attributes for a historical person (monarch, poet, general, politician) */
export interface HistoryPerson {
  entity_type: "person";
  era: string; // era entity id ref, e.g. "history:ayutthaya"
  role: string; // "King" | "Poet" | "General" | "Politician" | etc.
  reign_period?: string; // for monarchs, e.g. "พ.ศ. 2133–2148"
  year_birth?: number; // CE year
  year_death?: number; // CE year
  significance: string; // 1-line summary of key contribution
  titles?: string[];
}

/** Attributes for a historical event (battle, treaty, revolution, etc.) */
export interface HistoryEvent {
  entity_type: "event";
  era: string; // era entity id ref
  year: number; // CE year of occurrence
  date?: string; // exact date if known, e.g. "7 เมษายน พ.ศ. 2310"
  event_type: string; // "battle" | "treaty" | "revolution" | "founding" | etc.
  key_figures: string[];
  outcome?: string;
  significance: string;
}

/** Union of all history attribute types — use as `attributes` field in entities */
export type HistoryAttributes = HistoryEra | HistoryPerson | HistoryEvent;

// ---------------------------------------------------------------------------
// Typed Entity (extends base ThaiKnowledgeEntity pattern for history domain)
// ---------------------------------------------------------------------------

export interface ThaiHistoryEntityTyped<
  A extends HistoryAttributes = HistoryAttributes,
> {
  id: string; // e.g. "history:sukhothai", "person:naresuan", "event:fall-ayutthaya-2"
  domain: "history";
  name_th: string;
  aliases?: string[];
  description: string;
  attributes: A;
  relations: Array<{ type: string; target_id: string }>;
  source: ThaiKnowledgeSource;
  confidence: number; // 0..1
  version: string; // semver
  updated_at: string; // ISO-8601
}

// Convenience aliases for typed construction
export type EraEntity = ThaiHistoryEntityTyped<HistoryEra>;
export type PersonEntity = ThaiHistoryEntityTyped<HistoryPerson>;
export type EventEntity = ThaiHistoryEntityTyped<HistoryEvent>;

// ---------------------------------------------------------------------------
// Tool Response Contracts
// ---------------------------------------------------------------------------

export interface HistoryToolSuccess {
  success: true;
  domain: "history";
  data: Array<{
    id: string;
    name_th: string;
    aliases: string[];
    description: string;
    attributes: HistoryAttributes;
  }>;
  confidence: number;
  source: string[];
  note?: string;
}

export interface HistoryToolError {
  success: false;
  error_code: "INVALID_QUERY" | "NOT_FOUND" | "DB_ERROR";
  message: string;
}

export type HistoryToolOutput = HistoryToolSuccess | HistoryToolError;
