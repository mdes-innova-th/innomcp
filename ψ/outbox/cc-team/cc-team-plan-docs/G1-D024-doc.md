<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D024 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1018,"completion_tokens":1667,"total_tokens":2685,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1177,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:22:55.824Z -->
- **`PersistedSession`**
  Interface defining the structure of a session stored on disk, including metadata, preferences, and usage statistics.

- **`sessionStore`**
  Singleton instance of `SessionStore` used to persist, load, and manage session data as JSON files on disk.
  *Caveat: Storage directory (`workspace-storage/.sessions`) is resolved relative to `process.cwd()`. The directory is implicitly created on every operation if it doesn't exist.*

  - **`sessionStore.save(session)`**
    Persists a session to disk as a JSON file.
    `@param session` - The session data to persist.
    `@returns` `Promise<void>`
    *Caveat: Overwrites the existing file if the session ID matches.*

  - **`sessionStore.load(sessionId)`**
    Loads a single session by ID.
    `@param sessionId` - The ID of the session to load.
    `@returns` `Promise<PersistedSession | null>` - The session object, or `null` if not found.
    *Caveat: Rethrows filesystem errors other than file-not-found (ENOENT).*

  - **`sessionStore.loadAll()`**
    Loads all persisted sessions from the storage directory.
    `@returns` `Promise<PersistedSession[]>`
    *Caveat: Silently skips non-`.json` files and files that fail to parse (corrupted).*

  - **`sessionStore.delete(sessionId)`**
    Deletes a session file by ID.
    `@param sessionId` - The ID of the session to delete.
    `@returns` `Promise<void>`
    *Caveat: No-ops if the file does not exist (ignores ENOENT errors).*

  - **`sessionStore.cleanup(maxAgeDays?)`**
    Removes sessions older than the specified age based on `lastActivity`.
    `@param maxAgeDays` - Maximum age in days before a session is deleted. Defaults to `30`.
    `@returns` `Promise<number>` - The number of deleted sessions.
    *Caveat: Ignores per-file deletion errors and continues cleaning up remaining sessions.*

  - **`sessionStore.stats()`**
    Computes aggregate statistics across all sessions.
    `@returns` `Promise<{ total: number; active24h: number; totalMessages: number }>` - Totals, count of sessions active in the last 24 hours, and total messages.
    *Caveat: "Active in last 24h" is determined strictly by `lastActivity` timestamp.*
