# GEO CORE SPEC ADVANCED (Phase 1)

## Overview

Advance the `thai_geo_tool` with a robust intelligence layer comprising Intent, Router, Aggregator, and Guard.

## Core Modules

### 1. Geo Intent (`geo-intent`) 🧠

**Goal**: Classify user input into specific geographic intents.

- **Inputs**: User message string.
- **Logic**:
  - **Keywords**: `สภาพอากาศ`, `ฝนตกไหม`, `พิกัด`, `จังหวัด`, `อำเภอ`
  - **Patterns**: `{Location} อากาศเป็นไง`, `พิกัด {Location}`
- **Outputs**:
  - `type`: `WEATHER_FORECAST`, `WEATHER_CURRENT`, `GEO_COORD`, `UNKNOWN`
  - `slots`: `{ location: string, timeframe: string }`
  - `confidence`: `0.0 - 1.0`

### 2. Geo Tool Router (`geo-tool-router`) 🔀

**Goal**: Select the optimal tool sequence based on intent.

- **Logic**:
  - `WEATHER_FORECAST` + `timeframe=hourly` → `nwp_hourly_tool`
  - `WEATHER_FORECAST` + `timeframe=daily` → `nwp_daily_tool`
  - `GEO_COORD` → `thai_geo_tool`
- **Fallback**: If `confidence < 0.6` or no tool matches → `primary_fallback_tool` (e.g. general search).

### 3. Geo Aggregator (`geo-aggregator`) 🧩

**Goal**: Combine tool outputs into a coherent "Weather/Geo Packet".

- **Logic**:
  - **De-duplication**: Remove identical data points.
  - **Summarization**: Create a short text summary (TH).
  - **Evidence**: Attach raw tool outputs with timestamps.
- **Output**: JSON Packet ready for LLM consumption.

### 4. Geo Guard (`geo-guard`) 🛡️

**Goal**: Resilience and Safety.

- **Checks**:
  - **Timeout**: Enforce 8-12s limit per tool.
  - **Language**: Ensure Thai output (or normalize).
  - **Error Handling**: Catch exceptions and return "Graceful Degradation" packet (local fallback).

## Data Flow

```mermaid
graph LR
    User --> Intent
    Intent --> Router
    Router --> Tools[Tools: NWP/TMD/Geo]
    Tools --> Guard
    Guard --> Aggregator
    Aggregator --> LLM
```

## Constraints

- **Latency**: Total pipeline < 10s.
- **Language**: Thai priority.
- **Code**: TypeScript, no new heavyweight libs.
