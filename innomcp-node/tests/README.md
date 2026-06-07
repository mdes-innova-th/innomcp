# innomcp-node Test Guide

This folder contains tests for the recent Opus fixes and infrastructure updates.

## New tests added

- `tests/unit/mcpClient.test.ts`
  - Covers the new `innomcp-node/src/services/mcpClient.ts` scaffold.
  - Verifies `callTool`, `callBatch`, `isAvailable`, retry behavior, and singleton creation.

- `tests/unit/feedbackMigration.test.ts`
  - Verifies the new migration file `mariadb/migrations/006_chat_feedback.sql` exists.
  - Validates the required `chat_feedback` columns and indexes.

- `tests/unit/pytestConfig.test.ts`
  - Verifies `pytest.ini` contains the new ignore rules.
  - Confirms `testpaths` and `python_files` settings for Python collection.

## How to run these tests

From the workspace root:

```powershell
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
npm test -- tests/unit/mcpClient.test.ts
npm test -- tests/unit/feedbackMigration.test.ts
npm test -- tests/unit/pytestConfig.test.ts
```

Or run them all together:

```powershell
cd c:\Users\USER-NT\DEV\innomcp\innomcp-node
npm test -- tests/unit
```

## Notes

- These tests are read-only and do not modify runtime behavior.
- They are designed to support Opus changes without affecting other developers.
- Do not run these tests in a shared `main` branch during active development without communicating first.
