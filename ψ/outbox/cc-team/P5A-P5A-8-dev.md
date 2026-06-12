<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-8 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":59,"completion_tokens":901,"total_tokens":960,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":659,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-12T03:46:30.191Z -->
```javascript
const fs = require('fs');
const path = process.argv[2];

if (!path) {
    console.error('Usage: node validate-cc-plan.js <plan.json>');
    process.exit(1);
}

let plan;
try {
    const data = fs.readFileSync(path, 'utf8');
    plan = JSON.parse(data);
} catch (err) {
    console.error('Error reading or parsing JSON:', err.message);
    process.exit(1);
}

if (!Array.isArray(plan)) {
    console.error('Plan JSON must be an array of tasks');
    process.exit(1);
}

let hasFailure = false;
for (const task of plan) {
    const valid =
        task.hasOwnProperty('id') &&
        task.hasOwnProperty('task') &&
        typeof task.task === 'string' &&
        task.task.length > 100 &&
        task.hasOwnProperty('output') &&
        task.hasOwnProperty('valid-status');

    console.log(valid ? 'PASS' : 'FAIL');
    if (!valid) {
        hasFailure = true;
    }
}

process.exit(hasFailure ? 1 : 0);
```
