<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D004 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1555,"completion_tokens":1835,"total_tokens":3390,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1445,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 17s
 generated: 2026-06-13T11:19:44.522Z -->
- **`auditLogger`**: Singleton instance of the `AuditLogger` class, responsible for recording, querying, and managing audit events in JSONL format with daily file rotation.
  - *Caveat*: All file I/O operations are synchronous and will block the event loop.

- **`auditLogger.log(entry)`**: Appends a new audit entry to the current day's log file, creating the log directory and rotating the file if necessary.
  - `@param entry` - The audit data to log (excluding auto-generated `id` and `timestamp`).
  - *Caveat*: Silently catches file write errors, logging them to `console.error` rather than throwing.

- **`auditLogger.getEntries([filter])`**: Retrieves and filters audit entries from all current and rotated audit files.
  - `@param filter` - Optional object specifying `action`, `startTime`, `endTime`, and/or `limit`.
  - `@returns` - An array of `AuditEntry` objects.
  - *Caveat*: The `limit` filter applies after collecting all matching entries across all files; malformed JSON lines are silently skipped.

- **`auditLogger.exportCSV()`**: Exports all audit entries into a CSV formatted string.
  - `@returns` - A string containing the CSV data, with headers.
  - *Caveat*: The `details` object is serialized as a JSON string within its CSV column; loads all entries into memory.

- **`auditLogger.exportJSON()`**: Exports all audit entries into a pretty-printed JSON string.
  - `@returns` - A string containing the JSON array of entries.
  - *Caveat*: Loads all entries into memory.

- **`auditLogger.clear([beforeTimestamp])`**: Removes audit entries older than the specified timestamp across all audit files.
  - `@param beforeTimestamp` - If provided, entries with a timestamp strictly less than this value are removed. If omitted, all valid entries are removed.
  - `@returns` - The total number of entries removed.
  - *Caveat*: Completely deletes files from disk if all entries within them are removed; preserves malformed lines rather than deleting them.
