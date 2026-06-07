# Phase 9.1: DetectDB E2E Test Cases

## TC_91_01: Verify 2-Mode Connectivity

- **Description:** Ensure the system can connect via both host and container configurations.
- **Steps:**
  1. Boot the application with host DB credentials (`localhost:3308`). Verify connection.
  2. Boot the application with container DB credentials (`mariadb:3306`). Verify connection.
- **Expected:** Connections in both modes are established without errors.

## TC_91_02: Verify SQL Security Policies

- **Description:** Audit query generation for adherence to aggregation, parameterization, and PII restrictions.
- **Steps:**
  1. Submit a query intended to aggregate data.
  2. Attempt SQL injection syntax within the input parameters.
  3. Attempt to query specific PII fields.
- **Expected:** All queries are parameterized. Injection fails safely. No PII strings are requested. Only aggregated functions are constructed.

## TC_91_03: Structured Content Verification

- **Description:** Ensure the query returns the defined `structuredContent` response contract.
- **Steps:**
  1. Execute a valid DetectDB command via the tool.
  2. Inspect the raw tool response.
- **Expected:** The returned JSON object contains `kpis`, `table`, `series`, and `meta` nodes and formats.

## TC_91_04: Error Taxonomy Execution

- **Description:** Trigger the three required error states.
- **Steps:**
  1. Unset DB credentials -> expect `ERR:EVI_DB_UNCONFIGURED`.
  2. Stop the local DB -> expect `ERR:EVI_DB_DOWN`.
  3. Query aggregation for nonexistent time range -> expect `ERR:EVI_NO_DATA`.
- **Expected:** Respective error codes are accurately generated and propagated to the client.

## TC_91_05: Renderer-Only Adherence

- **Description:** Ensure numbers are not altered by the LLM.
- **Steps:**
  1. Execute a query returning exact values (e.g., `COUNT=42`).
  2. Inspect the final Markdown/UI message output.
- **Expected:** The output relies entirely on the custom UI renderer component to display `42`. The LLM's narrative does not reinterpret the value.
