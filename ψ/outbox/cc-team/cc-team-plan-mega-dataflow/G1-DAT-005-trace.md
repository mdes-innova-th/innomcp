<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-005 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2564,"completion_tokens":3149,"total_tokens":5713,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1515,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T11:59:34.129Z -->
Here is the data flow trace for `MultiAgentOrchestrator`:

---

### 0. Constructor
**Input:** partial `OrchestratorConfig` (optional object with fields like `coordinatorModel`, `brain1Model`, `sharedMemoryPath`, etc.)  
**Transformation:** Merges provided config with `DEFAULT_CONFIG`.  
**Side-effects:** Creates empty `activeTasks` Map (in‑memory state).  
**Output:** Configured `MultiAgentOrchestrator` instance (held in variable, no return value).

---

### 1. `createTask()`
**Input:** `description: string`, `priority: "low" | "medium" | "high" | "urgent"` (default `"medium"`)  
**Transformation:** Constructs an `AgentTask` object with a generated `id` (`task-{timestamp}-{random6}`), `status: "pending"`, empty `cycle` array.  
**Side-effects:** Sets `this.activeTasks[task.id] = task`.  
**Output (return):** The newly created `AgentTask` (shape: `{ id, description, priority, status: "pending", cycle: [] }`).

---

### 2. `executeCycle(taskId)`
**Input:** `taskId: string`  
**Side-effects:** Multiple network calls, file‑system write, modifications to the in‑memory `AgentTask`.

**Flow step‑by‑step:**

#### 2a. Lookup task  
- Reads `this.activeTasks.get(taskId)`. If missing → throws `Error`.

#### 2b. Brain‑1 Analysis (Phase "analyze")  
- Sets `task.status = "analyzing"`.  
- Calls `this.callBrain("brain-1", task.description)`.  
  - Input: `role = "brain-1"`, `input = task.description` (original user string).  
  - Transformation inside `callBrain`:  
    - Selects provider via `selectProvider({ mode:"hybrid", capabilities:["long-context"], privacyLevel:"internal" })`.  
    - Constructs HTTP POST to `{provider.baseUrl}/api/generate` with JSON body: `{ model: provider.model, prompt: input, stream: false, options: { temperature: 0.3, num_predict: 2048 } }`.  
    - Fetches response, extracts `result.response` string.  
  - **Side-effect:** Network call (POST to Ollama‑like endpoint).  
  - Output: Brain‑1 result string (`brain1Result`).  
- Mutates task:  
  - `task.brain1Result = brain1Result`  
  - Pushes cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "analyze", actor: "brain-1", result: brain1Result.substring(0, 500) }
    ```

#### 2c. Brain‑2 Summarization (Phase "summarize")  
- Sets `task.status = "summarizing"`.  
- Calls `this.callBrain("brain-2", brain1Result)`.  
  - Provider selection with capability `"fast-cheap"`.  
  - HTTP POST with same endpoint, `prompt = brain1Result`, `temperature: 0.7`, `num_predict: 512`.  
- **Network side-effect** (second API call).  
- Output: `brain2Result` string.  
- Mutates task:  
  - `task.brain2Result = brain2Result`  
  - Cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "summarize", actor: "brain-2", result: brain2Result.substring(0, 500) }
    ```

#### 2d. Coordinator Decision (Phase "coordinate")  
- Sets `task.status = "coordinating"`.  
- Calls `this.coordinate(task.description, brain1Result, brain2Result)`.  
  - Selects provider with capability `"tool-use"`.  
  - If no provider → returns `"SKIP: No coordinator provider available - task logged but not committed"` (no network call).  
  - Otherwise: builds a prompt containing `task.description`, `brain1Result` (first 1000 chars), `brain2Result`, and the action options.  
  - HTTP POST to `{coordinatorProvider.baseUrl}/api/generate` with `prompt`, `temperature: 0.2`, `num_predict: 32`.  
  - **Network side-effect** (third API call, if provider exists).  
  - Extracts `result.response`, trims it → `coordinatorAction`.  
- Mutates task:  
  - `task.coordinatorAction = coordinatorAction`  
  - Cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "coordinate", actor: "coordinator", result: coordinatorAction } // full value, no truncation
    ```

#### 2e. Memory Persistence (Phase "memory")  
- Calls `this.saveToMemory(task)`.  
  - **Side-effect:** Writes a file to disk, presumably at `{this.config.sharedMemoryPath}/` (folder `.claude/memory`) using the task’s details. (The code is truncated; it likely creates a markdown file with task id, status, cycle entries, etc.)  
- Mutates task: pushes cycle entry:  
  ```ts
  { timestamp: nowISO, phase: "memory", actor: "coordinator", result: "Task cycle saved to memory" }
  ```

#### 2f. Finalise status  
- Sets `task.status = "completed"`.

#### Exception path  
- If any step throws, catches error:  
  - `task.status = "failed"`  
  - Pushes cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "coordinate", actor: "coordinator", result: `Error: ${message}` }
    ```

#### 2g. Return  
- Returns the fully updated `AgentTask` object.

---

### Summary of Data Flow & Side‑Effects

| Step | Input (shape/source) | Transformation | Output (shape/destination) | Side-effects |
|------|----------------------|----------------|---------------------------|--------------|
| Constructor | Partial config from caller | Merge with defaults | Instance with activeTasks Map | Map creation (memory) |
| `createTask` | description (string), priority (enum) | Build AgentTask with id, status "pending" | AgentTask object | Insert into Map |
| `executeCycle` lookup | taskId (string) | Map.get | Task object or throw | Read from Map |
| Brain‑1 | task.description (string) | HTTP POST to provider → json.response | brain1Result (string) | Network call; task mutated (status, brain1Result, cycle entry) |
| Brain‑2 | brain1Result (string) | HTTP POST → json.response | brain2Result (string) | Network call; task mutated |
| Coordinator | taskDesc, brain1Result (truncated), brain2Result | Prompt build → HTTP POST → trim response | coordinatorAction (string) | Network call; task mutated |
| Memory | full AgentTask | Serialize & write to filesystem (presumably) | void (no return) | File write; task mutated (cycle entry) |
| Final / Error | Updated task | Set status "completed" or "failed" | Modified task object | Task mutation |

No direct database, external events, or event emitters are triggered; all state is held in the in‑memory `activeTasks` map and the local file system.
