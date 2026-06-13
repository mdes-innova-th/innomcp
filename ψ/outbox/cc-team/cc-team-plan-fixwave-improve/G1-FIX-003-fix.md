<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-003 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2920,"completion_tokens":4156,"total_tokens":7076,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2725,"image_tokens":0},"cache_creation_input_tokens":0} | 65s
 generated: 2026-06-13T11:24:39.874Z -->
## HIGH – Race condition in `executeCycle`

Two concurrent calls for the same `taskId` interleave mutations (status, results, cycle entries) because there is no serialisation. Before executing, atomically lock per task.

**Patch:** Introduce a per‑task promise‑based lock so that concurrent attempts either wait for the existing execution or reuse its result.

```typescript
// In class MultiAgentOrchestrator
private executing = new Map<string, Promise<AgentTask>>();

async executeCycle(taskId: string): Promise<AgentTask> {
  const existing = this.executing.get(taskId);
  if (existing) return existing;   // return the same promise to avoid duplicate work

  const run = this._executeCycle(taskId);
  this.executing.set(taskId, run);
  try {
    return await run;
  } finally {
    this.executing.delete(taskId);
  }
}

private async _executeCycle(taskId: string): Promise<AgentTask> {
  const task = this.activeTasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  // Only allow execution if the task is pending or previously failed.
  if (task.status !== 'pending' && task.status !== 'failed') {
    throw new Error(`Task ${taskId} is already ${task.status}`);
  }
  task.status = 'analyzing';

  let currentPhase: TaskCycle['phase'] = 'analyze';
  let currentActor: BrainRole = 'brain-1';

  try {
    // Phase 1
    const brain1Result = await this.callBrain('brain-1', task.description);
    task.brain1Result = brain1Result;
    task.cycle.push({
      timestamp: new Date().toISOString(),
      phase: 'analyze',
      actor: 'brain-1',
      result: brain1Result.substring(0, 500),
    });

    // Phase 2
    currentPhase = 'summarize';
    currentActor = 'brain-2';
    task.status = 'summarizing';
    const brain2Result = await this.callBrain('brain-2', brain1Result);
    task.brain2Result = brain2Result;
    task.cycle.push({
      timestamp: new Date().toISOString(),
      phase: 'summarize',
      actor: 'brain-2',
      result: brain2Result.substring(0, 500),
    });

    // Phase 3
    currentPhase = 'coordinate';
    currentActor = 'coordinator';
    task.status = 'coordinating';
    const coordinatorAction = await this.coordinate(task.description, brain1Result, brain2Result);
    task.coordinatorAction = coordinatorAction;
    task.cycle.push({
      timestamp: new Date().toISOString(),
      phase: 'coordinate',
      actor: 'coordinator',
      result: coordinatorAction,
    });

    // Phase 4
    currentPhase = 'memory';
    currentActor = 'coordinator';
    await this.saveToMemory(task);
    task.cycle.push({
      timestamp: new Date().toISOString(),
      phase: 'memory',
      actor: 'coordinator',
      result: 'Task cycle saved to memory',
    });

    task.status = 'completed';
  } catch (error) {
    task.status = 'failed';
    task.cycle.push({
      timestamp: new Date().toISOString(),
      phase: currentPhase,
      actor: currentActor,
      result: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  return task;
}
```

---

## HIGH – `callBrain` ignores user-chosen models

`brain1Model` / `brain2Model` from config are never forwarded to `selectProvider`, so the orchestrator may pick a different model and break the intended configuration.

**Patch:** Pass the configured model as `preferredModel` when calling `selectProvider`.

```typescript
// In callBrain(), after obtaining `capability`:
const configuredModel = role === 'brain-1' ? this.config.brain1Model : this.config.brain2Model;

const selection = selectProvider({
  mode: 'hybrid',
  capabilities: [capability],
  preferredModel: configuredModel,
  privacyLevel: 'internal',
});
```

---

## MEDIUM – Misleading phase/actor in error cycle entry

The `catch` block always writes `phase: "coordinate"` and `actor: "coordinator"`, even when the failure occurred during analysis or summarisation.

**Patch** (applies to the existing `executeCycle` before the race-condition refactor – in the refactor above this is already fixed, but here is the standalone change):

```typescript
// In executeCycle, before the try block:
let currentPhase: TaskCycle['phase'] = 'analyze';
let currentActor: BrainRole = 'brain-1';

// Before each phase call, update them, e.g.:
currentPhase = 'summarize';
currentActor = 'brain-2';

// In the catch block, replace the hard-coded values:
task.cycle.push({
  timestamp: new Date().toISOString(),
  phase: currentPhase,
  actor: currentActor,
  result: `Error: ${error instanceof Error ? error.message : String(error)}`,
});
```

---

## MEDIUM – `createTask` accepts empty/whitespace descriptions

No validation allows empty strings to pass, leading to wasted LLM calls and garbled output.

**Patch:**

```typescript
// At the start of createTask:
if (!description?.trim()) {
  throw new Error('Task description must not be empty');
}
```

---

## LOW – Weak ID generation in `createTask`

`Math.random().toString(36).slice(2, 8)` can yield an empty string (`Math.random() === 0`) or an overly short ID, risking collisions.

**Patch:** Replace the ID line with a robust UUID generator.

```typescript
id: `task-${Date.now()}-${crypto.randomUUID()}`,
```

*(If `crypto` is not already imported, add `import { randomUUID } from 'crypto';` and use `randomUUID()`.)*

---

## LOW – `callBrain` silently returns empty string on missing `response`

If Ollama returns `200` with a JSON body lacking a `response` field (e.g., `{}`), the method returns `""` and the empty result propagates without warning.

**Patch:** Add an explicit check after parsing the response.

```typescript
const result = await response.json() as { response?: string };
if (!result.response || result.response.trim().length === 0) {
  throw new Error(`Brain ${role} returned an empty response`);
}
return result.response;
```
