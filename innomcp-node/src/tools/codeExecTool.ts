/**
 * Code Execution Tool
 *
 * Runs a short Node.js snippet in a child process with a hard timeout.
 * Captures stdout/stderr. No network access by default.
 *
 * Input schema (JSON):
 * {
 *   "type": "object",
 *   "properties": {
 *     "code": { "type": "string", "description": "Node.js code snippet to execute" },
 *     "timeout": { "type": "number", "description": "Max execution time in ms (default 10000)" },
 *     "allowUnsafe": { "type": "boolean", "description": "Allow dangerous operations (file delete, network)" }
 *   },
 *   "required": ["code"]
 * }
 *
 * Example usage 1 (safe code):
 * ```ts
 * const result = await codeExecTool.run({ code: "console.log('Hello')" });
 * console.log(result.output); // "Hello\n"
 * ```
 *
 * Example usage 2 (with timeout and abort):
 * ```ts
 * const controller = new AbortController();
 * const result = await codeExecTool.run(
 *   { code: "while(true){}", timeout: 2000 },
 *   { signal: controller.signal }
 * );
 * // result.ok === false, result.error contains timeout message
 * ```
 */
import { execFile } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Tool } from '../types/tool';

// Patterns indicating dangerous operations (file deletion / network access)
const DANGEROUS_PATTERNS = [
  /\bfs\.(unlink|rm|rmdir|rmSync|unlinkSync|rmdirSync|truncate|truncateSync)\b/,
  /\bfs\.promises\.(unlink|rm|rmdir|truncate)\b/,
  /\b(child_process|exec|spawn|fork|execSync|spawnSync|execFile|execFileSync)\b/,
  /\b(https?|fetch|axios|request|got|superagent|needle)\b/,
  /\b(WebSocket|ws\.connect|net\.connect|dgram\.createSocket)\b/,
  /\bXMLHttpRequest\b/,
  /\b(process\.exit|process\.abort)\b/,
  /\brequire\(['"]?(child_process|fs|net|dgram|http|https|tls|cluster|worker_threads)['"]?\)/,
];

function isDangerous(code: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(code));
}

function runCodeSnippet(code: string, timeout: number, signal?: AbortSignal): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Write code to a temp file
    const tmpDir = mkdtempSync(join(tmpdir(), 'code-exec-'));
    const filePath = join(tmpDir, 'snippet.js');
    try {
      writeFileSync(filePath, code, 'utf-8');
    } catch (err) {
      reject(new Error(`Failed to write temp file: ${err}`));
      return;
    }

    const child = execFile(
      process.execPath,
      [filePath],
      {
        timeout,
        env: { ...process.env, NODE_ENV: 'development' },
      },
      (error, stdout, stderr) => {
        // Cleanup temp file
        try {
          unlinkSync(filePath);
          // Remove temp directory (if empty)
          const { rmdirSync } = require('fs');
          rmdirSync(tmpDir);
        } catch {
          // Ignore cleanup errors
        }

        if (error) {
          if ((error as any).killed) {
            reject(new Error('Process timed out or was killed'));
          } else {
            reject(new Error(stderr || error.message));
          }
          return;
        }
        resolve({ stdout, stderr });
      }
    );

    // Handle abort via signal
    if (signal) {
      const onAbort = () => {
        child.kill('SIGTERM');
        signal.removeEventListener('abort', onAbort);
      };
      signal.addEventListener('abort', onAbort);
    }
  });
}

const codeExecTool: Tool = {
  name: 'code_exec',
  description: 'Executes a short Node.js snippet in a child process with a timeout. No network by default. Returns stdout as artifact.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Node.js code to execute' },
      timeout: { type: 'number', description: 'Max execution time in ms (default 10000)' },
      allowUnsafe: { type: 'boolean', description: 'Allow dangerous operations (file delete, network)' },
    },
    required: ['code'],
  },
  async run(input: any, ctx: { signal?: AbortSignal }) {
    const code = typeof input?.code === 'string' ? input.code : '';
    const timeout = typeof input?.timeout === 'number' ? input.timeout : 10000;
    const allowUnsafe = !!input?.allowUnsafe;

    if (!code) {
      return { ok: false, error: 'Missing "code" parameter' };
    }

    // Security check
    if (!allowUnsafe && isDangerous(code)) {
      return {
        ok: false,
        error: 'Code contains potentially dangerous operations (file delete, network access). Use allowUnsafe=true to override.',
      };
    }

    try {
      const { stdout, stderr } = await runCodeSnippet(code, timeout, ctx.signal);
      if (stderr) {
        // Include stderr as part of output, but still ok (partial success)
        return {
          ok: true,
          output: stdout + (stderr ? '\n[stderr]\n' + stderr : ''),
          artifacts: [
            { name: 'stdout', mime: 'text/plain', content: stdout },
            ...(stderr ? [{ name: 'stderr', mime: 'text/plain', content: stderr }] : []),
          ],
        };
      }
      return {
        ok: true,
        output: stdout,
        artifacts: [{ name: 'stdout', mime: 'text/plain', content: stdout }],
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || 'Unknown execution error',
      };
    }
  },
};

export default codeExecTool;
