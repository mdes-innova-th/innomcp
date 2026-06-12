<!-- cc-team deliverable
 group: P3D (Phase 3.4 â€” Smoke suite: hello round-trip + WS reconnect + provider-select)
 member: P3D-5 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":1376,"total_tokens":1440,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1040,"image_tokens":0},"cache_creation_input_tokens":0} | 17s
 generated: 2026-06-12T03:43:03.261Z -->
#!/bin/bash
# Phase 3 smoke test runner
# Usage: run-p3-smoke.sh
# Scans current directory for *p3*.js and *phase3*.js files,
# runs each with `node --test`, prints PASS/FAIL, then summary.

set -u  # treat unset variables as error, but do NOT exit on test failure

# Get script directory to run from correct location
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || { echo "ERROR: Cannot cd to $DIR"; exit 1; }

total=0
pass=0
fail=0

echo "Phase 3 Smoke Tests"
echo "========================"

shopt -s nullglob
test_files=( *p3*.js *phase3*.js )
shopt -u nullglob

if [ ${#test_files[@]} -eq 0 ]; then
    echo "No Phase 3 test files found."
    exit 0
fi

for test_file in "${test_files[@]}"; do
    ((total++))
    echo "--- Running: $test_file ---"
    if node --test "$test_file"; then
        echo "[PASS] $test_file"
        ((pass++))
    else
        echo "[FAIL] $test_file"
        ((fail++))
    fi
    echo ""
done

echo "========================"
echo "Summary: $total test file(s), $pass passed, $fail failed"
if [ $fail -gt 0 ]; then
    exit 1
fi
exit 0
