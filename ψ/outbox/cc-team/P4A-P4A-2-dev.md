<!-- cc-team deliverable
 group: P4A (Phase 4.1 â€” Playwright browser runtime audit script)
 member: P4A-2 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":106,"completion_tokens":3043,"total_tokens":3149,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2681,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-12T03:43:50.659Z -->
#!/usr/bin/env bash

mkdir -p qa/screenshots

echo "Running Playwright audit..."
if ! npx tsx scripts/playwright-audit.ts; then
    echo "Error: Playwright audit failed." >&2
    exit 1
fi

REPORT_FILE="qa/audit-report.json"
if [ ! -f "$REPORT_FILE" ]; then
    echo "Error: Audit report not found at $REPORT_FILE" >&2
    exit 1
fi

echo ""
echo "=== Audit Summary ==="
node -e "
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('$REPORT_FILE', 'utf8'));
const consoleErrors = report.consoleErrors || report.console_errors || [];
const missingElements = report.missingElements || report.missing_elements || [];
const screenshots = report.screenshots || [];

const errCount = Array.isArray(consoleErrors) ? consoleErrors.length : (typeof consoleErrors === 'number' ? consoleErrors : 0);
const missCount = Array.isArray(missingElements) ? missingElements.length : (typeof missingElements === 'number' ? missingElements : 0);

console.log('Console Errors: ' + errCount);
console.log('Missing Elements: ' + missCount);
console.log('Screenshot Paths:');

if (Array.isArray(screenshots) && screenshots.length > 0) {
    screenshots.forEach(s => {
        const path = typeof s === 'string' ? s : (s.path || s.screenshotPath || JSON.stringify(s));
        console.log('  - ' + path);
    });
} else {
    console.log('  (none)');
}
"
