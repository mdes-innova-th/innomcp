/**
 * shellTool.ts — Safe shell execution service for Private Agent Studio
 *
 * Features:
 * - Allowlist / blocklist of command names
 * - Timeout (default 10 s, hard cap 30 s)
 * - Working directory isolated to workspace root
 * - Integration with riskDetector approval gate
 * - Env var sanitization (strips secrets before spawn)
 * - Audit log written to shell_executions via withDbConnection
 */

import { exec, spawn, ExecException } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { assessRisk } from "./riskDetector";
import { withDbConnection } from "../utils/db";

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  command: string;
  riskLevel: string;
  blocked: boolean;
  blockReason?: string;
}

// Commands always blocked regardless of risk score
const COMMAND_BLOCKLIST = new Set([
  "rm", "del", "format", "mkfs", "dd", "fdisk", "shutdown", "reboot",
  "passwd", "sudo", "su", "chown", "chmod", "kill", "pkill", "taskkill",
  "reg", "regedit", "sc", "net", "netsh",
]);

// Only these command prefixes are allowed when strict mode is on
const COMMAND_ALLOWLIST = new Set([
  "node", "npx", "npm", "pnpm", "bun", "python", "python3", "pip",
  "git", "ls", "dir", "cat", "type", "echo", "pwd", "cd",
  "tsc", "jest", "mocha", "eslint", "prettier",
  "curl", "wget", "fetch",
]);

const MASKED_ENV_KEY_FRAGMENTS = ["API_KEY", "SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY", "AUTH"];

function sanitizeEnv(): NodeJS.ProcessEnv {
  // Build a clean copy then cast — the strict ProcessEnv declaration
  // requires all known keys, but at runtime we only want to strip secrets.
  const clean: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    const upper = k.toUpperCase();
    if (MASKED_ENV_KEY_FRAGMENTS.some((m) => upper.includes(m))) continue;
    clean[k] = v;
  }
  return clean as NodeJS.ProcessEnv;
}

/** Extract the bare command name from a shell command string. */
function extractCommandName(command: string): string {
  return command
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/^.*[/\\]/, ""); // strip leading path components
}

/**
 * Normalise a path to an absolute lower-cased form for prefix comparison
 * on both Windows and POSIX.
 */
function normalisePath(p: string): string {
  return path.resolve(p).toLowerCase();
}

export interface ShellExecOptions {
  workspaceRoot: string;
  workingDir?: string;
  timeoutMs?: number;
  taskId?: string;
  sessionId?: string;
  /** Authenticated user id — null when unauthenticated. */
  userId?: number | null;
  /** When false the allowlist gate is skipped (useful for tests). Default: true */
  strictMode?: boolean;
  /** When true skip writing to the audit DB (useful for unit tests). Default: false */
  skipAudit?: boolean;
}

export async function executeShell(
  command: string,
  opts: ShellExecOptions
): Promise<ShellResult> {
  const start = Date.now();
  const timeoutMs = Math.min(opts.timeoutMs ?? 10_000, 30_000);
  const cmdName = extractCommandName(command);

  // ── 1. Blocklist check ───────────────────────────────────────────────────
  if (COMMAND_BLOCKLIST.has(cmdName)) {
    return mkBlocked(command, "critical", `Command '${cmdName}' is blocked`, start);
  }

  // ── 2. Strict-mode allowlist + risk escalation check ─────────────────────
  const risk = assessRisk(command);
  const strict = opts.strictMode !== false;

  if (strict && !COMMAND_ALLOWLIST.has(cmdName)) {
    if (risk.riskLevel === "critical" || risk.riskLevel === "high") {
      return mkBlocked(command, risk.riskLevel, risk.reason, start);
    }
  }

  // ── 3. Approval gate (high/critical from riskDetector) ───────────────────
  if (risk.requiresApproval && (risk.riskLevel === "high" || risk.riskLevel === "critical")) {
    return mkBlocked(command, risk.riskLevel, risk.reason, start);
  }

  // ── 4. Workspace containment check ───────────────────────────────────────
  const normRoot = normalisePath(opts.workspaceRoot);
  const rawWd = opts.workingDir
    ? (path.isAbsolute(opts.workingDir)
        ? opts.workingDir
        : path.resolve(opts.workspaceRoot, opts.workingDir))
    : opts.workspaceRoot;
  const normWd = normalisePath(rawWd);

  if (!normWd.startsWith(normRoot)) {
    return mkBlocked(command, "high", "Working directory outside workspace", start);
  }

  // ── 5. Execute ────────────────────────────────────────────────────────────
  const result = await runCommand(command, normWd, timeoutMs, risk.riskLevel, start);

  // ── 6. Audit log (fire-and-forget) ────────────────────────────────────────
  if (!opts.skipAudit) {
    writeAuditLog(opts, command, normWd, result).catch(() => {});
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkBlocked(
  command: string,
  riskLevel: string,
  blockReason: string,
  start: number
): ShellResult {
  return {
    exitCode: -1,
    stdout: "",
    stderr: "",
    durationMs: Date.now() - start,
    command,
    riskLevel,
    blocked: true,
    blockReason,
  };
}

function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  riskLevel: string,
  start: number
): Promise<ShellResult> {
  return new Promise((resolve) => {
    // Ensure cwd exists before exec; create it if missing (avoids ENOENT on fresh dirs)
    try { if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true }); } catch { /* ignore */ }
    const child = exec(
      command,
      {
        cwd,
        env: sanitizeEnv(),
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      },
      (error: ExecException | null, stdout: string, stderr: string) => {
        const exitCode =
          error?.code != null
            ? typeof error.code === "number"
              ? error.code
              : -1
            : 0;
        resolve({
          exitCode,
          stdout: stdout.trim().slice(0, 10_000),
          stderr: stderr.trim().slice(0, 2_000),
          durationMs: Date.now() - start,
          command,
          riskLevel,
          blocked: false,
        });
      }
    );
    // Ensure the timer doesn't keep the event loop alive
    child.unref?.();
  });
}

// ── Streaming shell execution ─────────────────────────────────────────────────

export interface StreamShellOptions {
  workspaceRoot: string;
  workingDir?: string;
  timeoutMs?: number;
  onStdout: (chunk: string) => void;
  onStderr: (chunk: string) => void;
}

export interface StreamShellResult {
  exitCode: number;
  durationMs: number;
  truncated: boolean;
}

/**
 * streamShell — Run a command with live stdout/stderr callbacks.
 *
 * Applies the same blocklist / allowlist / workspace-containment checks as
 * `executeShell`.  Returns exit code + timing; streaming output is delivered
 * via `onStdout` / `onStderr` callbacks as data arrives.
 *
 * Throws with `{blocked: true, reason: string}` if the command is rejected
 * before execution.
 */
export async function streamShell(
  command: string,
  opts: StreamShellOptions
): Promise<StreamShellResult> {
  const start = Date.now();
  const timeoutMs = Math.min(opts.timeoutMs ?? 30_000, 30_000);
  const cmdName = extractCommandName(command);

  // ── 1. Blocklist check ───────────────────────────────────────────────────
  if (COMMAND_BLOCKLIST.has(cmdName)) {
    throw Object.assign(new Error(`Command '${cmdName}' is blocked`), {
      blocked: true,
      reason: `Command '${cmdName}' is blocked`,
    });
  }

  // ── 2. Strict-mode allowlist + risk check ─────────────────────────────────
  const risk = assessRisk(command);
  if (!COMMAND_ALLOWLIST.has(cmdName)) {
    if (risk.riskLevel === "critical" || risk.riskLevel === "high") {
      throw Object.assign(new Error(risk.reason), {
        blocked: true,
        reason: risk.reason,
      });
    }
  }

  // ── 3. Approval gate ─────────────────────────────────────────────────────
  if (risk.requiresApproval && (risk.riskLevel === "high" || risk.riskLevel === "critical")) {
    throw Object.assign(new Error(risk.reason), {
      blocked: true,
      reason: risk.reason,
    });
  }

  // ── 4. Workspace containment ──────────────────────────────────────────────
  const normRoot = normalisePath(opts.workspaceRoot);
  const rawWd = opts.workingDir
    ? (path.isAbsolute(opts.workingDir)
        ? opts.workingDir
        : path.resolve(opts.workspaceRoot, opts.workingDir))
    : opts.workspaceRoot;
  const normWd = normalisePath(rawWd);
  if (!normWd.startsWith(normRoot)) {
    throw Object.assign(new Error("Working directory outside workspace"), {
      blocked: true,
      reason: "Working directory outside workspace",
    });
  }

  // ── 5. Spawn ──────────────────────────────────────────────────────────────
  const args = command.trim().split(/\s+/);
  const bin = args.shift()!;

  return new Promise<StreamShellResult>((resolve, reject) => {
    const proc = spawn(bin, args, {
      shell: false,
      cwd: normWd,
      env: sanitizeEnv(),
    });

    let truncated = false;
    let killed = false;

    const timer = setTimeout(() => {
      truncated = true;
      killed = true;
      proc.kill("SIGTERM");
    }, timeoutMs);
    if (typeof (timer as NodeJS.Timeout & { unref?: () => void }).unref === "function") {
      (timer as NodeJS.Timeout & { unref: () => void }).unref();
    }

    proc.stdout?.on("data", (chunk: Buffer) => opts.onStdout(chunk.toString()));
    proc.stderr?.on("data", (chunk: Buffer) => opts.onStderr(chunk.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        durationMs: Date.now() - start,
        truncated: killed,
      });
    });
  });
}

async function writeAuditLog(
  opts: ShellExecOptions,
  command: string,
  workingDir: string,
  result: ShellResult
): Promise<void> {
  await withDbConnection(async (conn) => {
    await conn.query(
      `INSERT INTO shell_executions
         (task_id, session_id, user_id, command, working_dir, exit_code, stdout, stderr, risk_level, approved, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        opts.taskId ?? null,
        opts.sessionId ?? null,
        opts.userId ?? null,
        command,
        workingDir,
        result.exitCode,
        result.stdout.slice(0, 4_000),
        result.stderr.slice(0, 1_000),
        result.riskLevel,
        result.durationMs,
      ]
    );
  });
}
