<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-025 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2628,"completion_tokens":4070,"total_tokens":6698,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1921,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T12:05:00.870Z -->
Here is a concrete, ordered trace of the data flow through the `shellTool.ts` module, focusing on its main entry points (`executeShell` and `streamShell`). Each step is described with its input shape, transformation, output shape, and any side effects.

---

### **Module Overview**
The module exposes two async functions that receive a shell command and configuration, apply safety gates, execute the command, and return a result. The primary side effect is an audit log entry in the database (via `withDbConnection`); both functions can create a working directory if missing.

---

## **Trace for `executeShell(command, opts)`**

### **Inputs (enter the function)**
| Name | Type / Shape | Source |
|------|--------------|--------|
| `command` | `string` (e.g., `"ls -la"`) | Caller (MCP tool, API, etc.) |
| `opts` | `ShellExecOptions` object | Caller |

**`ShellExecOptions` shape (all optional except `workspaceRoot`):**
```ts
{
  workspaceRoot: string;          // required
  workingDir?: string; 
  timeoutMs?: number;             // default 10k, capped at 30k
  taskId?: string;
  sessionId?: string;
  userId?: number | null;
  strictMode?: boolean;           // default true
  skipAudit?: boolean;            // default false
}
```

---

### **Step‑by‑step data flow**

1. **Record start time**  
   `start = Date.now()` → used for duration calculation.

2. **Clamp timeout**  
   `timeoutMs = Math.min(opts.timeoutMs ?? 10_000, 30_000)`  
   *Transforms* raw timeout into a safe, bounded value.

3. **Extract bare command name**  
   `cmdName = extractCommandName(command)`  
   - Input: raw `command` string  
   - Transformation: trim → split on whitespace → take first token → lowercase → strip leading path (e.g., `/usr/bin/git` → `git`)  
   - Output: `cmdName` (e.g., `"git"`)

4. **Blocklist check**  
   If `COMMAND_BLOCKLIST.has(cmdName)` → call `mkBlocked(...)`  
   - `mkBlocked` builds a `ShellResult` with `exitCode: -1`, `blocked: true`, `blockReason`, `riskLevel: "critical"`, `durationMs` computed from `start`  
   - **Side effect:** None.  
   - **Exit:** Function returns this blocked result immediately (steps 5‑15 skipped).

5. **Risk assessment**  
   `risk = assessRisk(command)`  
   - Input: raw `command` string  
   - External call to `riskDetector` module  
   - Returns `{ riskLevel, reason, requiresApproval }`  
   - `riskLevel`: `"low" | "medium" | "high" | "critical"`  
   - `requiresApproval`: boolean (true for high/critical when approval gate is configured)

6. **Determine strict mode**  
   `strict = opts.strictMode !== false` → boolean. Default is `true`.

7. **Strict + allowlist + risk gate**  
   `if (strict && !COMMAND_ALLOWLIST.has(cmdName))` and `risk.riskLevel` is `"high"` or `"critical"` → block via `mkBlocked`, using the `risk.reason`.  
   - **Exit:** Returns blocked result if conditions met.

8. **Approval gate**  
   `if (risk.requiresApproval && (risk.riskLevel === "high" || risk.riskLevel === "critical"))` → block via `mkBlocked`.  
   - **Exit:** Returns blocked result if conditions met.

9. **Workspace containment check**  
   - Normalise workspace root: `normRoot = normalisePath(opts.workspaceRoot)` → absolute, lowercased.  
   - Resolve working directory:  
     - If `opts.workingDir` absolute → use it  
     - If relative → `path.resolve(opts.workspaceRoot, opts.workingDir)`  
     - Else → `opts.workspaceRoot`  
   - Normalise working directory: `normWd = normalisePath(rawWd)`  
   - Verify prefix: `if (!normWd.startsWith(normRoot))` → block with reason `"Working directory outside workspace"`, riskLevel `"high"`.  
   - **Exit:** Returns blocked result if containment fails.

10. **Execute the command**  
    `result = await runCommand(command, normWd, timeoutMs, risk.riskLevel, start)`  
    Inside `runCommand`:  
    - **Ensure working directory exists** (side effect on filesystem):  
      `try { if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true }); } catch {}`  
      This may create the directory within the workspace.  
    - **Sanitise environment** (via `sanitizeEnv()`):  
      - Iterates `process.env`, removes any key whose uppercase version contains fragments from `MASKED_ENV_KEY_FRAGMENTS` (`API_KEY`, `SECRET`, etc.)  
      - Returns a clean copy of `ProcessEnv`.  
    - **Spawn process** using `child_process.exec(command, { cwd, env: cleanEnv, timeout: timeoutMs, maxBuffer: 10MB })`  
      - `exec` runs the command in a shell.  
      - *External side effect:* the actual command executes and may read/write files, use network, etc., but these are not direct module side effects.  
    - **Collect output** in callback:  
      - `exitCode`: derived from `error?.code` (number if present, else `0`)  
      - `stdout`: `.trim().slice(0, 10000)`  
      - `stderr`: `.trim().slice(0, 2000)`  
      - `durationMs`: `Date.now() - start`  
    - **Return** a `ShellResult` with `blocked: false`.

11. **Audit log side effect** (fire‑and‑forget)  
    If `!opts.skipAudit`:  
    `writeAuditLog(opts, command, normWd, result).catch(() => {})`  
    - Input: options (taskId, sessionId, userId), command string, normalised working directory, result object  
    - Assumed implementation (not shown in snippet): calls `withDbConnection` to insert a row into `shell_executions` table with fields like:  
      `{ task_id, session_id, user_id, command, cwd, exit_code, duration_ms, risk_level, blocked, created_at }`  
    - **Side effect:** Asynchronous write to the database. Errors are silently caught.

12. **Return final result**  
    The `ShellResult` object (blocked or executed) is returned to the caller.

---

### **Output shape (what exits)**
```ts
{
  exitCode: number | null;       // -1 if blocked
  stdout: string;                // max 10k chars
  stderr: string;                // max 2k chars
  durationMs: number;
  command: string;               // original command
  riskLevel: string;             // "low"|"medium"|"high"|"critical"
  blocked: boolean;
  blockReason?: string;
}
```

**Destination:** Returned to the calling code (e.g., MCP tool response, API handler).

---

## **Trace for `streamShell(command, opts)` (partial, truncated in snippet)**

### **Inputs**
- `command: string`
- `opts: StreamShellOptions` with fields: `workspaceRoot`, `workingDir?`, `timeoutMs?`, callback functions `onStdout`, `onStderr`.

### **Steps shown**
1. Record start time and clamp timeout (same as `executeShell`).  
2. Extract command name (`extractCommandName`).  
3. Blocklist check → throws an error with `{ blocked: true, reason }` if restricted command.  
4. Risk assessment (`assessRisk(command)`).  
5. Strict allowlist + risk check (identical logic to `executeShell`).  
The remaining steps (workspace containment, spawning with streaming output, potential audit log) are not shown because the file is truncated.

**Expected remaining flow** (inferred from the existing pattern):  
- Workspace containment check.  
- Sanitise environment.  
- Spawn with `child_process.spawn` (not `exec`), piping stdout/stderr to the callbacks.  
- Return `{ exitCode, durationMs, truncated }`.  
- Possibly an audit log (fire‑and‑forget) if not skipped.

---

## **Summary of Side Effects**
| Side effect | Trigger | Type | Details |
|-------------|---------|------|---------|
| **Filesystem write** (directory creation) | Inside `runCommand` (both `executeShell` and likely `streamShell`) | Synchronous state change | Creates working directory if it doesn’t exist (inside workspace) – `mkdirSync`. |
| **Database insert** (audit log) | After command execution, if `skipAudit` is false | Asynchronous side effect | Calls `writeAuditLog` → `withDbConnection` inserts a row into `shell_executions` table with command metadata. |
| **External process execution** | During `exec`/`spawn` | External side effect | The commanded process runs; it may alter files, network, etc., but this is not a direct module side effect. The module only orchestrates the execution. |

No direct network calls, event emissions, or in‑memory state mutations are performed by the module itself.
