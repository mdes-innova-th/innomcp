<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: SMOKE-4 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":43,"completion_tokens":2548,"total_tokens":2591,"prompt_tokens_details":{"cached_tokens":7,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2294,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 19s
 generated: 2026-06-13T05:28:08.038Z -->
#!/usr/bin/env bash
set -euo pipefail

if output=$(npx tsc --noEmit 2>&1); then
    echo "PASS"
else
    code=$?
    count=$(echo "$output" | grep -c 'error TS[0-9]*:' || true)
    echo "$output"
    if [[ "$count" -gt 0 ]]; then
        echo "FAIL ($count errors)"
    else
        echo "FAIL"
    fi
    exit "$code"
fi
