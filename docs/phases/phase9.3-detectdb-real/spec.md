# Phase 9.3: DetectDB Real DB Integration Specification

## 1. Overview

This specification outlines the transition from local placeholder/seeded mock databases to actual live database environments for the Evidence Tool (DetectDB).

## 2. Requirements

- **No Hallucination:** The LLM must not synthesize or format numbers. The backend `evidenceTool.ts` generates the exact data payload (`structuredContent`).
- **Renderer-Only UI:** The dashboard components dynamically adapt to the structured format exactly as delivered by the backend.
- **Contract Enforcement:** The contract payload must declare `meta.dataSource="detectdb"`. Any fallback or mocked rows must be entirely disabled in production mode.
- **Evidence Logs:** Strict auditing. All queries sent to the real DB must be logged to `innomcp-node/evidence/` via `Trace v3` formatting without leaking `DETECT_DB_PASSWORD`.
