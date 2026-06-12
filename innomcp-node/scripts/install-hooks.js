#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const hookPath = path.join(gitRoot, '.git', 'hooks', 'pre-commit');
const hooksDir = path.dirname(hookPath);

if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

const GATE_BLOCK = `
# ── Recovery gates (fence-check + tsc) ──────────────────────────────
if [ -f "$ROOT/innomcp-node/scripts/pre-commit-fence-check.sh" ]; then
  bash "$ROOT/innomcp-node/scripts/pre-commit-fence-check.sh" || exit 1
fi
if [ -f "$ROOT/innomcp-node/scripts/pre-commit-tsc-gate.sh" ]; then
  bash "$ROOT/innomcp-node/scripts/pre-commit-tsc-gate.sh" || exit 1
fi
# ────────────────────────────────────────────────────────────────────
`;

const MARKER = '# RECOVERY-GATES-INSTALLED';

if (!fs.existsSync(hookPath)) {
  // Create minimal hook
  fs.writeFileSync(hookPath, `#!/bin/sh\nROOT="$(git rev-parse --show-toplevel)"\n${GATE_BLOCK}\nexit 0\n`);
  fs.chmodSync(hookPath, 0o755);
  console.log('Created new pre-commit hook with gates.');
  process.exit(0);
}

let content = fs.readFileSync(hookPath, 'utf8');

if (content.includes(MARKER)) {
  console.log('Gates already installed (marker found). No change needed.');
  process.exit(0);
}

// Insert BEFORE the smoke test / "Running quick smoke tests" line
// so gates fire before the expensive tests but after env setup
const insertBefore = 'Running quick smoke tests';
const idx = content.indexOf(insertBefore);

if (idx !== -1) {
  // Find start of that line
  const lineStart = content.lastIndexOf('\n', idx) + 1;
  content = content.slice(0, lineStart) + MARKER + '\n' + GATE_BLOCK + content.slice(lineStart);
} else {
  // Fallback: insert before the last exit
  const lastExit = content.lastIndexOf('\nexit ');
  if (lastExit !== -1) {
    content = content.slice(0, lastExit) + '\n' + MARKER + '\n' + GATE_BLOCK + content.slice(lastExit);
  } else {
    content += '\n' + MARKER + '\n' + GATE_BLOCK;
  }
}

fs.writeFileSync(hookPath, content);
fs.chmodSync(hookPath, 0o755);
console.log('Gates inserted into pre-commit hook before smoke tests.');
console.log('Hook path:', hookPath);
