# Phase 8.4: Resilience Test Cases

## Abort & Timeout Scenarios

| ID  | Scenario                                                              | Expected Behavior                                                                                                           |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| R01 | User connects to HTTP /chat, asks weather, immediately kills terminal | API catches connection close -> Propagates `AbortController` -> `node-fetch` throws `AbortError` -> Backend releases thread |
| R02 | User asks weather in WebSocket, immediately disconnects               | WS `on("close")` fires -> AbortController signals MCP tool -> API request canceled natively                                 |
| R03 | Upstream TMD API takes 40s to respond                                 | MCP limits the request to `budgetMs` constraints -> Aborts `node-fetch` -> Renders `ERR:WX_TIMEOUT` natively                |

## Station Canonicalization

| ID  | User Input Locale | Canonical Backend Resolution                                                   |
| --- | ----------------- | ------------------------------------------------------------------------------ |
| R04 | "กทม"             | `กรุงเทพมหานคร`                                                                |
| R05 | "กรุงเทพ"         | `กรุงเทพมหานคร`                                                                |
| R06 | "พัทยา"           | Resolved as part of Chonburi province radar logic, or explicit TMD station map |
| R07 | "โคราช"           | `นครราชสีมา`                                                                   |

## Output Aesthetics on Failure

| ID  | Scenario                    | Rendered String                                                                             |
| --- | --------------------------- | ------------------------------------------------------------------------------------------- |
| R08 | Empty Payload from TMD      | "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้ (ERR:WX_NO_DATA)"                             |
| R09 | Connection Refused from TMD | "ขออภัย ยังไม่สามารถดึงข้อมูลอากาศได้ในขณะนี้ (ERR:WX_UPSTREAM_ERROR)"                      |
| R10 | Client Abort while fetching | Trace log records `[TMD:*] err=TMD API aborted`. User sees nothing as connection is closed. |
