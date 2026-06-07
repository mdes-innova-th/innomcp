# Phase 9.1: DetectDB E2E Specification

## 1. Overview

This specification defines the behavior for the DetectDB integration and Evidence E2E flow.

## 2. DetectDB Connectivity

The system must support **2-mode connectivity**:

- **Host mode:** `localhost:3308`
- **Container mode:** `mariadb:3306`
  The connection string MUST be configurable via environment variables without hardcoding.

## 3. SQL Policy

All interactions with DetectDB MUST adhere strictly to the following security policies:

- **Aggregation-only:** Queries must use aggregation functions (`COUNT`, `SUM`, `AVG`, etc.).
- **Parameterized Queries:** All user inputs must be parameterized. No string concatenation for SQL queries is allowed.
- **No Raw Rows:** Do not select or return individual raw record rows.
- **No PII:** Queries must never request Personally Identifiable Information (such as names, raw IP addresses, or emails).

## 4. Response Contract

The tool must return data strictly in the `structuredContent` format.
**Schema Requirements:**

- `kpis`: Key Performance Indicators (e.g., total counts).
- `table`: Tabular aggregated data suitable for rendering.
- `series`: Time-series data points for charting.
- `meta`: Metadata regarding the query execution (timing, source).

## 5. Error Taxonomy

The system must handle and classify errors using the following taxonomy:

- `ERR:EVI_DB_UNCONFIGURED`: Database connection details are missing or invalid.
- `ERR:EVI_DB_DOWN`: The database server is unreachable or connection timed out.
- `ERR:EVI_NO_DATA`: The query executed successfully but returned completely empty results.

## 6. Renderer-Only Policy

- **LLM Restriction:** The LLM MUST NOT fabricate, extrapolate, or rewrite numbers. Data must be passed directly to the renderer.
- **Renderer Responsibility:** The UI/Renderer is solely responsible for presenting the numbers from `structuredContent`.
