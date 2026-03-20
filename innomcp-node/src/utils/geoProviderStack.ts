/**
 * Geo/Knowledge Provider Stack
 * Layered architecture: try each provider in order, return first grounded result
 *
 * Provider order:
 * 1. Session context entities (carry-forward from previous turns)
 * 2. Deterministic local resolver (resolveThaiGeoLocal in chat.ts)
 * 3. Existing locationResolver aliases/districts/fuzzy
 * 4. thai_geo_tool MCP backup (when DB available)
 * 5. Final safe fallback
 *
 * RULE: This file is ADDITIVE ONLY. Never delete existing providers.
 */

import { resolveProvinces, mapToProvinceThai } from "./locationResolver";
import { sessionManager } from "./sessionManager";

// ─── Provider Result Shape ───────────────────────────────────────────
export interface GeoProviderResult {
  source: "session_context" | "local_resolver" | "location_resolver" | "thai_geo_tool" | "fallback";
  entityType: "region" | "province" | "district" | "subdistrict" | "city" | "unknown";
  canonicalQuery: string;
  geoIntent: string;
  confidence: number;
  data: {
    text: string;
    resolvedEntity?: string;
    parentEntity?: string;
    region?: string;
    province?: string;
    matchedAlias?: string;
  };
  // Carry-forward metadata
  resolvedFromHistory: boolean;
  priorEntity?: string;
  fallbackReason?: string;
}

// ─── Provider 1: Session Context (carry-forward) ─────────────────────
export function trySessionContext(sessionId: string, query: string): GeoProviderResult | null {
  const lastEntities = sessionManager.getLastResolvedEntities(sessionId);
  const lastProvince = sessionManager.getLastResolvedProvince(sessionId);

  if (!lastProvince && lastEntities.length === 0) return null;

  // Check if query is a follow-up that lacks explicit location
  const isFollowUp = /แล้ว|ที่นั่น|จังหวัดนี้|ภาคนี้|อำเภออะไร|เขตอะไร|อยู่ภาคไหน/.test(query);
  const hasExplicitLocation = /กรุงเทพ|เชียงใหม่|โคราช|ภูเก็ต|สงขลา|ภาค(กลาง|เหนือ|ใต้|อีสาน|ตะวันออก)/.test(query);

  if (!isFollowUp || hasExplicitLocation) return null;

  // Use last resolved entity as context
  if (lastProvince && /อำเภอ|เขต|อยู่ภาค|ภาคไหน/.test(query)) {
    return {
      source: "session_context",
      entityType: "province",
      canonicalQuery: lastProvince,
      geoIntent: "context_carry_forward",
      confidence: 0.8,
      data: {
        text: "", // Caller should resolve using the carried province
        resolvedEntity: lastProvince,
        province: lastProvince,
      },
      resolvedFromHistory: true,
      priorEntity: lastProvince,
    };
  }

  return null;
}

// ─── Provider 3: Existing locationResolver ───────────────────────────
// Wraps the existing locationResolver.ts without modifying it
export function tryLocationResolver(query: string): GeoProviderResult | null {
  const provinces = resolveProvinces(query);
  if (provinces.length === 0) return null;

  return {
    source: "location_resolver",
    entityType: "province",
    canonicalQuery: provinces[0],
    geoIntent: "province_resolve",
    confidence: 0.85,
    data: {
      text: `พบจังหวัด: ${provinces.join(", ")}`,
      resolvedEntity: provinces[0],
      province: provinces[0],
    },
    resolvedFromHistory: false,
  };
}

// ─── Provider 5: Final Fallback ──────────────────────────────────────
export function makeFallbackResult(query: string, reason: string): GeoProviderResult {
  return {
    source: "fallback",
    entityType: "unknown",
    canonicalQuery: query.slice(0, 30),
    geoIntent: "unknown",
    confidence: 0,
    data: { text: "" },
    resolvedFromHistory: false,
    fallbackReason: reason,
  };
}
