<!-- cc-team deliverable
 group: P5B (Phase 5.3 â€” Wave policy doc + overall recovery summary)
 member: P5B-6 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":62,"completion_tokens":2198,"total_tokens":2260,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1367,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-12T03:47:56.159Z -->
```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Helper: run a command and return exit code (or -1 on error)
function runCommand(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
    return 0;
  } catch (err) {
    return err.status != null ? err.status : -1;
  }
}

// Check 1: tsc exits with 0
function checkTsc() {
  const code = runCommand('npx tsc --noEmit');
  return code === 0;
}

// Check 2: no file contains @ts-nocheck
function checkNoTsNocheck() {
  const code = runCommand(
    'grep -r "@ts-nocheck" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .'
  );
  // grep returns 0 if found, 1 if not found, 2 on error
  // We fail if code is 0 (found) or -1 (error). Pass if code === 1.
  return code === 1;
}

// Check 3: routes exist (common paths)
function checkRoutesExist() {
  const candidates = [
    'src/routes.ts',
    'src/routes/index.ts',
    'routes.ts',
    'routes/index.ts',
    'src/routes.js',
    'src/routes/index.js',
    'api/routes.ts',
    'api/routes/index.ts',
  ];
  return candidates.some((file) => fs.existsSync(path.join(ROOT, file)));
}

// Check 4: hooks installed (husky pre-commit or husky in devDependencies)
function checkHooksInstalled() {
  const huskyDir = path.join(ROOT, '.husky');
  const preCommit = path.join(huskyDir, 'pre-commit');
  if (fs.existsSync(preCommit)) return true;

  // Fallback: check package.json for husky in devDependencies
  const pkgPath = path.join(ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.devDependencies && pkg.devDependencies.husky) return true;
    } catch (e) {
      // ignore parse errors
    }
  }
  return false;
}

// Check 5: policy docs exist (case-insensitive filename containing "policy")
function checkPolicyDocsExist() {
  let files;
  try {
    files = fs.readdirSync(ROOT);
  } catch (e) {
    return false;
  }
  return files.some((f) => f.toLowerCase().includes('policy'));
}

// Define all checks
const checks = [
  { name: 'tsc EXIT 0', fn: checkTsc },
  { name: '0 @ts-nocheck', fn: checkNoTsNocheck },
  { name: 'routes exist', fn: checkRoutesExist },
  { name: 'hooks installed', fn: checkHooksInstalled },
  { name: 'policy docs exist', fn: checkPolicyDocsExist },
];

let allPass = true;
for (const { name, fn } of checks) {
  try {
    const pass = fn();
    console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}`);
    if (!pass) allPass = false;
  } catch (err) {
    console.log(`FAIL: ${name} (error: ${err.message})`);
    allPass = false;
  }
}

process.exit(allPass ? 0 : 1);
```
