# Phase 7.3 Quality - Specifications

## 1. Overview

This specification outlines the required fixes and enhancements derived from the Phase 7.3 Quality Audit. The goal is to address 6 critical failures in the GEO service, 5 failures in the Evidence service, 1 failure in Multi-tool orchestration, and 1 severe data leak vulnerability in the Adversarial handling.

## 2. Component Specifications

### 2.1 Thai Geo Tool (`thai_geo_tool.ts`)

**Goal**: Improve precision of Thai geographical resolution to handle sub-districts (ตำบล), districts (อำเภอ), and postal codes (รหัสไปรษณีย์).
**Requirements**:

- The tool MUST parse and match postal codes (e.g., `10110`, `30000`).
- The tool MUST support hierarchical location matching when ambiguous (e.g., `ต.สุเทพ`, `บางจาก`, `แขวงลาดพร้าว`).
- The tool MUST return the resolved Province, District, and Sub-district along with the region.

### 2.2 Evidence Service DB Fallback (`detect_evidence_stats.ts` / `evidenceTool`)

**Goal**: Prevent abrupt connection errors when DetectDB credentials are not provided.
**Requirements**:

- The system MUST implement a safe "Mocked Data Mode" or graceful failover when `DETECT_DB_HOST` is missing.
- When failing over, it MUST return a structured payload indicating: `{ status: 'OFFLINE_MOCK', data: ... }` rather than crashing or throwing `ERR:MISSING_DETECT_DB_CREDS` to the LLM router.

### 2.3 Intent Classification Router (`fastPathHandler` / `chat.ts`)

**Goal**: Stop Weather Tools from hijacking Evidence (URL/Machine) prompts.
**Requirements**:

- "วันนี้พบ URL ใหม่กี่รายการ" MUST NOT trigger `nwp_hourly_by_place` (Weather).
- The intent classifier MUST recognize "URL", "เครื่อง", "ออนไลน์", "หลักฐาน" and strictly route to Evidence/Officer paths.

### 2.4 Security & Adversarial Block (`evidenceTool`)

**Goal**: Block arbitrary database schema queries.
**Requirements**:

- The `evidenceTool` MUST explicitly reject or drop `action: "list_tables"` or any action that enumerates database structure if not explicitly authorized by an admin context constraint.
- Return `SEC_BLOCK: Unauthorized Schema Access` when an LLM attempts to dump `machines` or tables.
