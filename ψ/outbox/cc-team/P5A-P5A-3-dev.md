<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-3 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":158,"completion_tokens":2131,"total_tokens":2289,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1671,"image_tokens":0},"cache_creation_input_tokens":0} | 33s
 generated: 2026-06-12T03:46:08.732Z -->
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // 1. Find Git repository root
  const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  if (!gitRoot) {
    console.error('Not inside a Git repository.');
    process.exit(1);
  }

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const linesToAdd = [
    'bash scripts/pre-commit-fence-check.sh',
    'bash scripts/pre-commit-tsc-gate.sh',
  ];

  let newContent;
  const hookExists = fs.existsSync(hookPath);

  if (!hookExists) {
    newContent = `#!/bin/sh\n\n${linesToAdd.join('\n')}\n`;
  } else {
    const existingContent = fs.readFileSync(hookPath, 'utf8');
    const existingLines = new Set(existingContent.split('\n').map((l) => l.trim()));
    const missing = linesToAdd.filter((line) => !existingLines.has(line));

    if (missing.length === 0) {
      console.log('Pre-commit hooks already installed. No changes needed.');
      // Ensure executable just in case
      fs.chmodSync(hookPath, 0o755);
      process.exit(0);
    }

    let appendContent = existingContent;
    if (!appendContent.endsWith('\n')) {
      appendContent += '\n';
    }
    appendContent += missing.join('\n') + '\n';
    newContent = appendContent;
  }

  fs.writeFileSync(hookPath, newContent);
  fs.chmodSync(hookPath, 0o755);
  console.log('Pre-commit hook installed successfully.');
} catch (error) {
  console.error('Error installing hooks:', error.message);
  process.exit(1);
}
