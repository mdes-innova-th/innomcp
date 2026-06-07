# Phase 8.7: Weather Log Hygiene Test Cases

**Execution:** `cd innomcp-node; npx ts-node scripts/verify_phase87_loghygiene.ts` (if applicable)

| ID    | Category       | Input / Condition                | Expected Output / Behavior                                      |
| ----- | -------------- | -------------------------------- | --------------------------------------------------------------- |
| TC-01 | RESOLVER       | "อากาศ กทม"                      | Resolves to "กรุงเทพมหานคร"                                     |
| TC-02 | RESOLVER       | "ฝนตกไหมเขตบางเขน"               | Resolves accurately without empty array fallback                |
| TC-03 | RESOLVER       | "จ.ภูเก็ต"                       | Resolves to "ภูเก็ต"                                            |
| TC-04 | LOGGING        | Normal Request Completion        | Single `[MCP] completed` log emitted on `res.finish`            |
| TC-05 | LOGGING        | Client Disconnect (Abort)        | Logged as aborted/disconnected without huge duration            |
| TC-06 | LOG_IDEMPOTENT | Late proxy closure on old socket | Discarded; no duplicate completion log emitted                  |
| TC-07 | HYGIENE        | Trace output contains secret     | Rejected. Verify no `[REDACTED]` tokens leaked into real trace. |
| TC-08 | HYGIENE        | "โหมดทดสอบ" presence check       | Rejected. String must not be artificially injected.             |
