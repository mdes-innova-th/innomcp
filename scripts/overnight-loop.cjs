#!/usr/bin/env node
/**
 * overnight-loop.js — innomcp 24/7 QA loop with provider balancing
 *
 * ลำดับ: commandcode (tokens เหลือ) → ollama (local) → claude (near limit)
 *
 * Usage: node scripts/overnight-loop.cjs
 * Every iteration:
 *   1. Pick provider (CMD first)
 *   2. Run TypeScript check
 *   3. Run jest tests
 *   4. Report any failures to .claude/overnight-log.jsonl
 *   5. Sleep 10 minutes
 */

const { execSync, exec } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const LOG_FILE   = path.join(ROOT, '.claude', 'overnight-log.jsonl');
const BALANCE    = path.join(ROOT, 'scripts', 'pick-provider.cjs');
const INTERVAL   = parseInt(process.env.LOOP_INTERVAL_MS || '600000', 10); // 10 min default

function log(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  console.log(line);
}

function pickProvider(taskType) {
  try {
    const out = execSync(`node "${BALANCE}" ${taskType}`, { timeout: 5000 }).toString();
    return JSON.parse(out);
  } catch {
    return { provider: 'ollama-local', model: 'minimax-m2.5:cloud', reason: 'fallback (pick-provider failed)' };
  }
}

function runTsc(pkg) {
  const dir = path.join(ROOT, pkg);
  try {
    execSync('npx tsc --noEmit --skipLibCheck', { cwd: dir, timeout: 60000 });
    return { ok: true, errors: 0 };
  } catch (e) {
    const errors = (e.stdout || '').toString().match(/error TS/g)?.length || 0;
    return { ok: false, errors };
  }
}

function runJest(pkg) {
  const dir = path.join(ROOT, pkg);
  try {
    execSync('npx jest --passWithNoTests --silent', { cwd: dir, timeout: 120000 });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function iteration(n) {
  log({ event: 'iteration_start', n });

  // Pick cheapest provider for code tasks
  const prov = pickProvider('code');
  log({ event: 'provider_selected', provider: prov.provider, reason: prov.reason });

  // TypeScript checks
  const tsNode = runTsc('innomcp-node');
  const tsNext = runTsc('innomcp-next');
  log({ event: 'tsc', node: tsNode, next: tsNext });

  // Tests (node only — next tests need browser)
  const tests  = runJest('innomcp-node');
  log({ event: 'jest', result: tests });

  const healthy = tsNode.ok && tsNext.ok && tests.ok;
  log({ event: 'iteration_end', n, healthy, provider: prov.provider });

  if (!healthy) {
    console.error(`\n⚠️  Iteration ${n}: failures detected — check .claude/overnight-log.jsonl`);
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────
(async () => {
  log({ event: 'loop_start', interval_ms: INTERVAL });
  let n = 0;
  while (true) {
    await iteration(++n);
    await new Promise(r => setTimeout(r, INTERVAL));
  }
})();
