# Phase 9.3: DetectDB Real Test Cases

## TC_93_01: Real DB Connection Validation

- **Description:** Ensure the `evidenceTool` can query the actual database when valid credentials are provided.
- **Steps:** Set valid `DETECT_DB_PASSWORD`. Execute query.
- **Expected:** Tool returns `structuredContent` with real KPI metrics and `meta.dataSource="detectdb"`.

## TC_93_02: Credential Degradation handling

- **Description:** Ensure system fails gracefully when real DB credentials are missing or invalid.
- **Steps:** Omit `DETECT_DB_PASSWORD`. Execute query.
- **Expected:** Tool returns specific `ERR:EVI_DB_UNCONFIGURED` or `ERR:EVI_DB_DOWN` rather than spoofing data.

## TC_93_03: No Hallucination Assurance

- **Description:** Ensure LLM does not mangle numerical data.
- **Steps:** Inject a trap value (e.g. `999999.99` in DB). Retrieve the value via conversation.
- **Expected:** Output rendered in UI strictly reflects `999999.99` without LLM approximations (e.g., "1 million").
