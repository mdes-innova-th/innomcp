<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-17 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":70,"completion_tokens":1464,"total_tokens":1534,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":773,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-12T03:50:07.443Z -->
```javascript
import { readdir } from 'fs/promises';
import { resolve, join, extname } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const testDir = resolve(__dirname, '..', 'tests', 'recovery');

async function findTestFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.test.js'))
      .map(entry => join(dir, entry.name));
  } catch (err) {
    console.error(`Error reading test directory: ${dir}`);
    console.error(err.message);
    process.exit(1);
  }
}

function runTest(file) {
  return new Promise((resolve) => {
    const child = spawn('node', [file], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        file,
        exitCode: code,
        stdout,
        stderr,
      });
    });

    child.on('error', (err) => {
      resolve({
        file,
        exitCode: -1,
        stdout: '',
        stderr: err.message,
      });
    });
  });
}

function formatTable(results) {
  const header = `${'Test File'.padEnd(55)}Status`;
  const separator = '-'.repeat(header.length);
  const rows = results.map(r => {
    const status = r.exitCode === 0 ? 'PASS' : 'FAIL';
    const relativePath = `tests/recovery/${r.file.split('/').pop()}`;
    return `${relativePath.padEnd(55)}${status}`;
  });
  return [header, separator, ...rows].join('\n');
}

async function main() {
  const files = await findTestFiles(testDir);

  if (files.length === 0) {
    console.log('No test files found in tests/recovery/');
    process.exit(0);
  }

  console.log(`Found ${files.length} test file(s). Running...\n`);

  const results = [];
  for (const file of files) {
    const result = await runTest(file);
    results.push(result);
    if (result.stderr) {
      console.error(`Stderr for ${file}:`, result.stderr);
    }
  }

  console.log(formatTable(results));
  console.log();

  const allPass = results.every(r => r.exitCode === 0);

  if (allPass) {
    console.log('All tests passed.');
    process.exit(0);
  } else {
    const failCount = results.filter(r => r.exitCode !== 0).length;
    console.log(`${failCount} test(s) failed.`);
    process.exit(1);
  }
}

main();
```
