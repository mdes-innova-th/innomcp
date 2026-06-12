<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-6 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":70,"completion_tokens":1771,"total_tokens":1841,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":999,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-12T03:46:46.452Z -->
#!/usr/bin/env node
/**
 * Pre-commit hook runner:
 * 1. Fence check on all staged .ts files.
 * 2. Run tsc --noEmit.
 * Exits with code 1 if any check fails.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration: the exact fence comment that must be present in every .ts file
const FENCE_COMMENT = '// fence';

/**
 * Get the list of staged .ts files (relative to repo root).
 * Uses git diff --cached --name-only --diff-filter=ACMR.
 */
function getStagedTsFiles() {
  try {
    const output = execSync(
      'git diff --cached --name-only --diff-filter=ACMR',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.endsWith('.ts'));
  } catch (err) {
    console.error('Failed to get staged files. Is this a git repository?');
    process.exit(1);
  }
}

/**
 * Perform fence check on all staged .ts files.
 * Returns true if all files pass, false otherwise.
 */
function fenceCheck(files) {
  let allPassed = true;
  const cwd = process.cwd();

  if (files.length === 0) {
    console.log('No staged .ts files to fence check.');
    return true; // nothing to check, treat as success
  }

  for (const relativePath of files) {
    const absolutePath = path.resolve(cwd, relativePath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`File not found: ${relativePath}`);
      allPassed = false;
      continue;
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      if (!content.includes(FENCE_COMMENT)) {
        console.error(
          `Fence check FAILED: ${relativePath} does not contain "${FENCE_COMMENT}"`
        );
        allPassed = false;
      } else {
        console.log(`Fence check passed: ${relativePath}`);
      }
    } catch (err) {
      console.error(`Error reading ${relativePath}: ${err.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * Run tsc --noEmit and return true if it exits with code 0.
 */
function runTypeCheck() {
  console.log('Running tsc --noEmit...');
  try {
    execSync('npx tsc --noEmit', {
      encoding: 'utf-8',
      stdio: 'inherit',          // show tsc output directly
      cwd: process.cwd(),
    });
    console.log('Type-check passed.');
    return true;
  } catch (err) {
    // tsc --noEmit returns non-zero if there are type errors
    console.error('Type-check FAILED.');
    return false;
  }
}

// --------------------------------------------------
// Main
// --------------------------------------------------
const stagedTsFiles = getStagedTsFiles();

const fencePassed = fenceCheck(stagedTsFiles);
const typeCheckPassed = runTypeCheck();

if (!fencePassed || !typeCheckPassed) {
  console.error('\nPre-commit checks failed. Aborting commit.');
  process.exit(1);
}

console.log('\nAll pre-commit checks passed.');
process.exit(0);
