#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
let pass = 0, fail = 0;

function check(label, fn) {
  try {
    const ok = fn();
    if (ok) { console.log('✓', label); pass++; }
    else     { console.log('✗', label); fail++; }
  } catch (e) {
    console.log('✗', label, '—', e.message.split('\n')[0]);
    fail++;
  }
}

check('tsc --noEmit EXIT 0', () => {
  const r = spawnSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8', shell: true });
  return r.status === 0;
});

check('0 @ts-nocheck in src/', () => {
  const src = path.join(ROOT, 'src');
  function findTs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? findTs(path.join(dir, e.name)) :
      e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []
    );
  }
  return findTs(src).every(f =>
    !fs.readFileSync(f, 'utf8').includes('@ts-nocheck')
  );
});

// Only check for FIRST-LINE fence corruption (not legitimate uses in regexes/strings)
check('No first-line fence corruption in src/ .ts files', () => {
  const src = path.join(ROOT, 'src');
  function findTs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? findTs(path.join(dir, e.name)) :
      e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []
    );
  }
  const corrupted = findTs(src).filter(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const firstCode = lines.find(l => l.trim() && !l.trim().startsWith('//'));
    return firstCode && firstCode.trim().startsWith('```');
  });
  if (corrupted.length) { console.log('  Corrupted:', corrupted.map(f => path.relative(ROOT, f))); }
  return corrupted.length === 0;
});

check('Route files exist (analytics, mdesModels, thaiNLP)', () =>
  ['analytics.ts','mdesModels.ts','thaiNLP.ts'].every(r =>
    fs.existsSync(path.join(ROOT, 'src/routes/api', r)))
);

check('pre-commit hook has tsc-gate + fence-check wired', () => {
  const hookPath = path.join(REPO, '.git', 'hooks', 'pre-commit');
  if (!fs.existsSync(hookPath)) return false;
  const content = fs.readFileSync(hookPath, 'utf8');
  return content.includes('pre-commit-fence-check.sh') && content.includes('pre-commit-tsc-gate.sh');
});

check('WAVE-POLICY.md exists', () =>
  fs.existsSync(path.join(ROOT, 'docs', 'WAVE-POLICY.md'))
);

check('RECOVERY-SUMMARY.md exists', () =>
  fs.existsSync(path.join(ROOT, 'docs', 'RECOVERY-SUMMARY.md'))
);

check('fastPathHandler has GREETING_TOKENS', () =>
  fs.readFileSync(path.join(ROOT, 'src/services/fastPathHandler.ts'), 'utf8').includes('GREETING_TOKENS')
);

console.log(`\nRecovery: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
