# GEO CORE SPEC (Phase 1)

## Scope
Focus ONLY on weather-related tool selection and answer assembly:
- NWP (hourly/daily)
- TMD endpoints
- Existing weather tools in MCP

NOT in scope:
- History/Law tools
- UI/Auth/Permissions
- Training pipelines

---

## Inputs
User message (Thai/English), optional coords/place.

## Output
A compact "Weather Packet" for remote AI OR a local fallback answer.

---

## Core Modules

### 1) geo-intent
**Goal:** classify question into:
- domain = weather
- subdomain = nwp_hourly | nwp_daily | tmd_forecast | other_weather
- features: has_coords, has_time_range_24h, wants_hourly, wants_daily, location_terms

Rules must be deterministic + minimal ML optional.

### 2) geo-tool-router
**Goal:** map intent -> tool plan (ordered):
- primary tool (best match)
- fallback tool(s)
- required params normalization (coords/place/province anchoring)

### 3) geo-aggregator
**Goal:** execute tool plan and merge results:
- de-duplicate
- keep it short (for remote AI)
- produce "packet" with:
  - summary fields
  - raw snippets (small)
  - evidence: tool name + timestamp + confidence

### 4) geo-guard
**Goal:** resilience layer:
- timeout per tool (e.g. 8–12s)
- retry policy (1 retry max unless critical)
- if remote AI down => local answer from packet
- if response language mismatch => normalize Thai
- if tool fails => degrade and ask follow-up question

---

## Test Matrix (Minimum)
1) "พยากรณ์อากาศ 24 ชม ที่พิกัด x,y" => nwp_hourly_by_location
2) "พรุ่งนี้ฝนตกไหมที่โคราช" => daily/tmd forecast
3) "รายชั่วโมง" keyword => hourly
4) "7 วัน" keyword => daily
5) tool timeout => retry then degrade
6) remote down => local answer produced
7) language mismatch => normalize
8) ambiguous location => ask follow-up

---

## Non-Functional
- typical response <10s
- no duplicate tool registration
- logging: tool selected + latency + fallback reason
