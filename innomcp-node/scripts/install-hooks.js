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
