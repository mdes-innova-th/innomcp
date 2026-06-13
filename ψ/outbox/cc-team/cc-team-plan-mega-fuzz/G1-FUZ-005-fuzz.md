<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-005 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2573,"completion_tokens":3181,"total_tokens":5754,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1509,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:59:59.413Z -->
- **Property: Task creation always yields a valid AgentTask object with default fields**  
  - Fuzz Input: `createTask(description=fuzz.string(), priority=fuzz.string())` where `priority` can be any string (including invalid enum values)  
  - Expected Invariant: Returned object contains `id` matching regex `^task-\d+-[a-z0-9]{6}$`, `description` equals input description, `priority` equals input priority (verbatim), `status === "pending"`, `cycle` is `[]`, `brain1Result`/`brain2Result`/`coordinatorAction` are `undefined`, and `activeTasks` map includes the task by its id.

- **Property: Task id is unique per creation**  
  - Fuzz Input: Create 1000 tasks in rapid succession with random descriptions and priorities  
  - Expected Invariant: All generated task IDs are distinct; no duplicates.

- **Property: executeCycle processes a pending task successfully through all phases when all providers succeed**  
  - Fuzz Input: Mocked `selectProvider` and `fetch` return valid, non-empty JSON responses with `response: fuzz.string()`; call `executeCycle(taskId)` on a task with `status: "pending"` and arbitrary description.  
  - Expected Invariant: Task `status` becomes `"completed"`, `cycle` has length 4, phases are `"analyze"`, `"summarize"`, `"coordinate"`, `"memory"` in sequence, `cycle[0..2].result` lengths ≤ 500, `task.brain1Result`/`task.brain2Result`/`task.coordinatorAction` are set to the full mock responses (except coordinator which may be trimmed).

- **Property: executeCycle sets failed status if brain-1 call fails**  
  - Fuzz Input: Mock `callBrain` throws an `Error` for `brain-1` (e.g., no provider, network error). Call `executeCycle` on a valid task.  
  - Expected Invariant: Task `status === "failed"`, `cycle` contains exactly one error entry with `actor: "coordinator"`, `phase: "coordinate"`, and `result` includes the error message. `brain1Result`/`brain2Result` unchanged (or `brain1Result` not set because it failed before assignment). No memory phase added.

- **Property: executeCycle sets failed status if brain-2 call fails**  
  - Fuzz Input: Brain-1 succeeds, but brain-2 call throws.  
  - Expected Invariant: Task `status === "failed"`, task has `brain1Result` set from the successful Brain-1, `brain2Result` remains `undefined` (or previous value), `cycle` shows analyze phase succeeded, then an error phase with `actor: "coordinator"`. No summarize phase recorded. Coordinator phase result contains error message.

- **Property: executeCycle sets failed status if memory save throws**  
  - Fuzz Input: Mock `saveToMemory` to throw (e.g., disk full, permission), all brain calls succeed.  
  - Expected Invariant: Task `status === "failed"`, `cycle` includes analyze, summarize, coordinate phases (success), then the catch block adds a coordinate error entry (with the memory error). Even though coordinator action succeeded, the cycle may have a duplicate coordinate phase? Code: after `saveToMemory` throws, catch adds a push to `cycle` with `phase: "coordinate"` and the error message. So total cycles = 4 (analyze, summarize, original coordinate, then error coordinate). Expect invariant: last cycle entry is the error entry with phase "coordinate" and actor "coordinator", task status "failed".

- **Property: executeCycle throws if task ID does not exist**  
  - Fuzz Input: Call `executeCycle(taskId="nonexistent")` with any non-existent id (empty string, special characters, very long id).  
  - Expected Invariant: Throws `Error` with message containing the task id. No modification to `activeTasks`.

- **Property: callBrain returns empty string when Ollama response has no "response" field**  
  - Fuzz Input: Mock fetch to return `{ }` (no response key) with HTTP 200; call `callBrain("brain-1", fuzz.string())`.  
  - Expected Invariant: Returns `""` without throwing. Works for both brain roles.

- **Property: coordinate returns fallback SKIP string if provider is null**  
  - Fuzz Input: Mock `selectProvider` to return `{ provider: null }` for coordinator call.  
  - Expected Invariant: Returns `"SKIP: No coordinator provider available - task logged but not committed"` (exact string). Task execution continues normally, status becomes completed if other phases succeed.

- **Property: coordinate returns fallback SKIP string if coordinator fetch fails**  
  - Fuzz Input: Mock fetch to reject or return a non-ok response (e.g., 503).  
  - Expected Invariant: Returns `"SKIP: Coordinator call failed"`. Task status becomes completed (not failed) because coordinate failure is handled gracefuly.

- **Property: coordinate trims response whitespace and defaults to "SKIP" on empty/undefined**  
  - Fuzz Input: Mock fetch to return JSON `{ response: "   " }` or `{ response: undefined }`.  
  - Expected Invariant: Returns `"SKIP"` (since `"   ".trim()` is `""`, `"" || "SKIP"` yields `"SKIP"`; undefined → `"SKIP"`). No crash.

- **Property: executeCycle does not mutate completed/failed tasks idempotently?** (not explicitly prevented)  
  - Fuzz Input: Call `executeCycle` on same taskId after it has already reached `"completed"` or `"failed"`.  
  - Expected Invariant: The method re-executes the full cycle from the beginning (overwrites previous results) because no status check. This may be unintended; property test reveals overwriting. However, invariant at least: It does not crash and produces a new cycle with current results. The test captures that behavior is not blocked, ensuring backwards compatibility.

- **Property: saveToMemory uses config path and writes valid markdown**  
  - Fuzz Input: Provide config with `sharedMemoryPath` being empty string, `null`, relative path, absolute path, path with special characters.  
  - Expected Invariant: The method attempts to write; if path is invalid/empty, the underlying `fs` call may throw, causing task to fail (as per memory-save failure property). No other crash. Markdown template includes task id, status, cycle entries, but exact formatting not testable without mock; fuzz input would be the path string.

- **Property: Brain-1 results up to 500 chars are stored in cycle; full result stored in brain1Result**  
  - Fuzz Input: Mock brain-1 to return a string of length N (0, 1, 500, 1000, 10000).  
  - Expected Invariant: `task.brain1Result` length equals N. `cycle[0].result` length is min(N, 500). For N>500, the cycle entry is the first 500 chars.

- **Property: Consecutive executeCycle calls do not lose activeTasks reference**  
  - Fuzz Input: Call `executeCycle(taskId1)` and `executeCycle(taskId2)` sequentially with the same orchestrator instance, mocking providers.  
  - Expected Invariant: Tasks remain accessible via `activeTasks` after completion; both tasks are independet and their results don't interfere.
