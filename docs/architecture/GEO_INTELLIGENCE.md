# GEO INTELLIGENCE ARCHITECTURE (Phase 1 Advanced)

## Overview

This document outlines the intelligence layer sitting _above_ the raw `thai_geo_tool`. It transforms a basic database lookup into a smart, context-aware geographic assistant.

## Components

### 1. Geo Intent (Detection) 🧠

Responsible for deciding "Is this a geographic question?".

- **Input**: User Message (String), Conversation History.
- **Logic**:
  - **Keyword Matching**: `จังหวัด`, `อำเภอ`, `ตำบล`, `ภาค`, `พิกัด`, `แผนที่`, `ระยะทาง`, `อยู่ตรงไหน`.
  - **Named Entity Recognition (NER)**: Detects Thai Location Entities (e.g., "เชียงใหม่", "แม่น้ำเจ้าพระยา").
  - **Pattern Matching**:
    - `{Entity} อยู่ที่ไหน`
    - `ข้อมูลของ {Entity}`
    - `ไป {Entity} ยังไง`
- **Output**: `IntentScore` (0.0 - 1.0), `DetectedEntities` [].

### 2. Geo Tool Router (Selection) 🔀

Decides _which_ specific tool or action to take based on the intent and entities.

- **Rules**:
  - IF `IntentScore > 0.8` AND `RequestType == 'DATA'` -> **Call `thai_geo_tool`**.
  - IF `IntentScore > 0.8` AND `RequestType == 'MAP'` -> **Call `static_map_generator`** (Future).
  - IF `IntentScore > 0.8` AND `RequestType == 'ROUTE'` -> **Call `routing_tool`** (Future).
  - IF `IntentScore < 0.5` -> **Pass to General Chat / LLM**.

### 3. Geo Guard (Safety & Confidence) 🛡️

Ensures quality and safety before returning results.

- **Checks**:
  - **Confidence Threshold**: If `thai_geo_tool` returns confidence < 0.6, flag as "Uncertain".
  - **Ambiguity Check**: If multiple locations match (e.g., "Ban Mai" matches 50 villages), request clarification.
  - **Sensitive Area Filter**: (Optional) Filter restricted military zones or private areas if flagged in DB.
- **Fallback**: If Guard fails, fallback to `WebSearch` or `LLM Knowledge`.

### 4. Geo Aggregator (Composition) 🧩

Combines raw data into a user-friendly response.

- **Function**:
  - Format JSON from `thai_geo_tool` into a beautiful Markdown card.
  - Append "Related Locations" (from DB relations).
  - Generate a static map image URL (if applicable).
  - Translate Lat/Lon to "X km from Bangkok" context.

## Flow Diagram

```mermaid
graph TD
    UserQuery[User Query] --> Intent{Geo Intent?}

    Intent -- No --> GeneralLLM[General LLM Chat]
    Intent -- Yes (Score > 0.7) --> Router[Geo Tool Router]

    Router -- "Ask Data" --> ThaiGeoTool[thai_geo_tool]
    Router -- "Ask Map" --> MapGen[Map Generator (Future)]

    ThaiGeoTool --> Guard{Geo Guard}

    Guard -- "Confidence High" --> Aggregator[Geo Aggregator]
    Guard -- "Confidence Low" --> Fallback[Web Search / Ask Clarification]

    Aggregator --> Response[Final Response UI]
    Fallback --> Response
```

## Implementation Strategy (Future)

This layer can be implemented as:

1.  **Orchestrator Code**: TypeScript logic in `server.ts` or a dedicated `GeoAgent.ts`.
2.  **MCP Chain**: A "Super Tool" that calls sub-tools.
