# Phase 8.9 Spec: Weather UX & Station Accuracy

## Overview

Advance the precision of Weather Tools by targeting edge cases in Bangkok Districts and obscure provincial stations without modifying the deterministic routing guard layer. Focus is purely on the accuracy of the StationEngine, the sequence of fallback cascades, and log hygiene.

## UX Contracts & Guidelines

1. **Bangkok District Normalization**
   - Inputs matching `กทม`, `กรุงเทพ`, `กรุงเทพฯ`, `BKK` adjacent to known districts (e.g., `หลักสี่`, `ลาดกระบัง`) must map deterministically to `กรุงเทพมหานคร` and isolated as `เขต[ชื่อเขต]`.
   - The UX must return relevant district-level station data if available from the TMD 3H API before falling back to the generic `กรุงเทพมหานคร` centroid.

2. **Sequential Multi-Targeting**
   - For inputs listing multiple valid locations, queries must cleanly sequence (e.g., Target 1 -> Target 2).
   - A soft failure (e.g., Timeout, Missing Station) on Target 1 MUST NOT globally disable Target 2's execution. Targets are isolated.

3. **Fallback Budget Constraints**
   - Limits on network loops must remain within configured thresholds (`GENERAL_LLM_BUDGET_MS` / upstream timeouts).
   - If `PROVINCE_NOT_FOUND_IN_FORECAST` is raised, NO downstream NWP API fallback should execute. Output `ERR:WX_NO_DATA` directly.

4. **Security & Redaction Defaults (Hygiene)**
   - Mask all URL signatures containing `ukey=` and `uid=`.
   - Exclude `requestInfo.headers` arrays from trace summaries to prevent user agent or session cookie bleed.
   - Absolutely no placeholder content (`30°C`, `70%`, `โหมดทดสอบ`) to leak into output strings.
   - Output tokens (`ERR:WX_TIMEOUT`, `ERR:WX_UPSTREAM`, `ERR:WX_NO_DATA`) must remain deterministic and operator-friendly.
